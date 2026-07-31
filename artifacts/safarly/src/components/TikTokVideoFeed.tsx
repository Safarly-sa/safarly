/**
 * Ranked TikTok clips, rendered as cached-thumbnail cards that only become
 * real embeds on demand.
 *
 * The constraint that shapes this component: TikTok's embed.js turns each
 * blockquote into an iframe, and a scroll view holding a dozen of them is
 * unusable — every one loads TikTok's player, its own scripts, and its own
 * network waterfall. So the feed renders the thumbnail captured server-side at
 * write time, and mounts the actual embed only for the card the reader chose
 * to play.
 *
 * Only one embed is live at a time. Playing a second unmounts the first, which
 * both keeps the page light and stops two clips playing over each other.
 *
 * `thumbnailUrl` is null whenever the oEmbed capture failed or the story
 * predates it. That is a normal state, not an error: those cards render a
 * neutral placeholder and still play on click.
 */
import { useEffect, useRef, useState } from "react";
import { Link } from "wouter";
import { Play, Heart, MapPin } from "lucide-react";
import { useTranslation } from "@/providers/translation-context";
import { TikTokEmbed } from "@/components/TikTokEmbed";
import type { TopVideo } from "@/lib/posts-api";

function VideoCard({ video, isPlaying, onPlay }: { video: TopVideo; isPlaying: boolean; onPlay: () => void }) {
  const { t } = useTranslation();
  const [thumbFailed, setThumbFailed] = useState(false);

  // TikTok CDN thumbnail URLs expire, so a card that worked last week can 404
  // today. Falling back to the placeholder keeps a broken-image icon out of the
  // feed; the clip itself still plays.
  const showThumb = video.thumbnailUrl && !thumbFailed;

  if (isPlaying && video.tiktokVideoId) {
    return (
      <div className="rounded-xl overflow-hidden bg-card border border-border">
        <TikTokEmbed videoId={video.tiktokVideoId} videoUrl={video.url} />
      </div>
    );
  }

  return (
    <button
      type="button"
      onClick={onPlay}
      className="group relative block w-full text-left rounded-xl overflow-hidden bg-card border border-border hover:border-primary/50 transition-colors"
      aria-label={t("stories.play_video")}
    >
      <div className="relative aspect-[9/16] bg-muted">
        {showThumb ? (
          <img
            src={video.thumbnailUrl!}
            alt=""
            loading="lazy"
            onError={() => setThumbFailed(true)}
            className="w-full h-full object-cover"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <span className="text-sm font-semibold text-muted-foreground">TikTok</span>
          </div>
        )}

        <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-transparent" />

        <span className="absolute inset-0 flex items-center justify-center">
          <span className="rounded-full bg-black/55 p-3 group-hover:bg-black/75 transition-colors">
            <Play className="w-6 h-6 text-white fill-white" aria-hidden />
          </span>
        </span>

        {video.likeCount > 0 && (
          <span className="absolute top-2 right-2 flex items-center gap-1 rounded-full bg-black/60 px-2 py-1 text-xs text-white">
            <Heart className="w-3 h-3 fill-white" aria-hidden />
            {video.likeCount}
          </span>
        )}

        <span className="absolute bottom-2 left-2 right-2 text-xs text-white/90 line-clamp-2">
          {video.oembedTitle ?? video.caption ?? video.postTitle}
        </span>
      </div>

      <span className="block px-3 py-2 text-xs text-muted-foreground truncate">
        {video.authorName ? `@${video.authorName}` : video.creatorName}
      </span>
    </button>
  );
}

export function TikTokVideoFeed({ videos }: { videos: TopVideo[] }) {
  const { t } = useTranslation();
  const [playingId, setPlayingId] = useState<string | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Stop playback when the feed scrolls out of view — an embed left running
  // offscreen keeps its iframe (and its audio) alive.
  useEffect(() => {
    const node = containerRef.current;
    if (!node || !playingId) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (!entry.isIntersecting) setPlayingId(null);
      },
      { threshold: 0 },
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, [playingId]);

  if (videos.length === 0) return null;

  return (
    <section ref={containerRef} className="mb-10" data-testid="top-videos">
      <h2 className="text-lg font-semibold mb-1">{t("stories.top_videos")}</h2>
      <p className="text-sm text-muted-foreground mb-4">{t("stories.top_videos_note")}</p>

      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
        {videos.map((video) => (
          <div key={video.id} className="flex flex-col">
            <VideoCard
              video={video}
              isPlaying={playingId === video.id}
              onPlay={() => setPlayingId(video.id)}
            />
            <Link
              href={`/stories/${video.postId}`}
              className="mt-1 px-1 text-xs text-primary hover:underline inline-flex items-center gap-1"
            >
              <MapPin className="w-3 h-3" aria-hidden />
              {video.postTitle}
            </Link>
          </div>
        ))}
      </div>
    </section>
  );
}
