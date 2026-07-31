/**
 * /stories — public feed of creator Trip Stories, newest first, plus two
 * ranked sections above it (top clips, top places).
 *
 * The main list stays chronological on purpose. Ranking is presented as a
 * separate, clearly-labelled slice rather than reordering the feed itself — a
 * new story from a first-time contributor should still be visible, which it
 * would not be if everything were sorted by likes.
 */
import { useEffect, useState } from "react";
import { Link } from "wouter";
import { MapPin, ImageOff, PlusCircle } from "lucide-react";
import { useTranslation } from "@/providers/translation-context";
import { usePageMeta } from "@/lib/usePageMeta";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { TikTokVideoFeed } from "@/components/TikTokVideoFeed";
import { TopPlaces } from "@/components/TopPlaces";
import { LikeButton } from "@/components/LikeButton";
import {
  fetchStories,
  fetchTopVideos,
  fetchTopPlaces,
  type Post,
  type TopVideo,
  type TopPlace,
} from "@/lib/posts-api";

function CoverThumb({ post }: { post: Post }) {
  const cover = post.media[0];
  if (cover?.type === "image") {
    return <img src={cover.url} alt="" className="w-full h-40 object-cover rounded-t-xl" />;
  }
  // A tiktok cover now usually has a real thumbnail captured at write time;
  // the lettering below is the fallback for captures that failed or predate it.
  if (cover?.type === "tiktok" && cover.thumbnailUrl) {
    return <img src={cover.thumbnailUrl} alt="" className="w-full h-40 object-cover rounded-t-xl" />;
  }
  return (
    <div className="w-full h-40 rounded-t-xl bg-muted flex items-center justify-center">
      {cover?.type === "tiktok" ? (
        <span className="text-sm font-semibold text-muted-foreground">TikTok</span>
      ) : (
        <ImageOff className="w-6 h-6 text-muted-foreground" aria-hidden />
      )}
    </div>
  );
}

export function Stories() {
  const { t } = useTranslation();
  usePageMeta(t("stories.title"), t("stories.subtitle"));

  const [posts, setPosts] = useState<Post[] | null>(null);
  const [videos, setVideos] = useState<TopVideo[]>([]);
  const [places, setPlaces] = useState<TopPlace[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetchStories().then((result) => {
      if (cancelled) return;
      if (result.ok) setPosts(result.posts);
      else setError(result.error);
    });
    return () => { cancelled = true; };
  }, []);

  /**
   * The ranked sections load separately and fail silently. They are a bonus on
   * top of the feed, so a ranking query that errors should cost the reader a
   * section, never the stories themselves — the same additive-not-blocking rule
   * the trip enrichment agents follow.
   */
  useEffect(() => {
    let cancelled = false;
    fetchTopVideos(undefined, 8).then((result) => {
      if (!cancelled && result.ok) setVideos(result.videos);
    });
    fetchTopPlaces(undefined, 6).then((result) => {
      if (!cancelled && result.ok) setPlaces(result.places);
    });
    return () => { cancelled = true; };
  }, []);

  return (
    <div className="max-w-5xl mx-auto px-4 pt-24 pb-10">
      <div className="flex items-center justify-between gap-4 mb-8 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold">{t("stories.title")}</h1>
          <p className="text-muted-foreground text-sm mt-1">{t("stories.subtitle")}</p>
        </div>
        <Link href="/stories/new">
          <Button className="gap-2">
            <PlusCircle className="w-4 h-4" aria-hidden />
            {t("stories.share_cta")}
          </Button>
        </Link>
      </div>

      <TikTokVideoFeed videos={videos} />
      <TopPlaces places={places} />

      {error && <p className="text-sm text-destructive">{error}</p>}
      {posts === null && !error && <p className="text-sm text-muted-foreground">{t("stories.loading")}</p>}
      {posts?.length === 0 && <p className="text-sm text-muted-foreground">{t("stories.empty")}</p>}

      {(videos.length > 0 || places.length > 0) && posts && posts.length > 0 && (
        <h2 className="text-lg font-semibold mb-4">{t("stories.all_stories")}</h2>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
        {posts?.map((post) => (
          <Link key={post.id} href={`/stories/${post.id}`}>
            <Card className="overflow-hidden cursor-pointer hover:shadow-md transition-shadow h-full">
              <CoverThumb post={post} />
              <CardHeader className="pb-2">
                <CardTitle className="text-base leading-snug line-clamp-2">{post.title}</CardTitle>
              </CardHeader>
              <CardContent className="pt-0 space-y-2">
                <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                  <MapPin className="w-3.5 h-3.5" aria-hidden />
                  <span className="capitalize">{post.city}</span>
                  <span aria-hidden>&middot;</span>
                  <span>{post.creatorName}</span>
                </div>
                <div className="flex items-center justify-between gap-2">
                  <div className="flex flex-wrap gap-1.5">
                    {post.tags.slice(0, 3).map((tag) => (
                      <Badge key={tag} variant="secondary" className="text-xs">{tag}</Badge>
                    ))}
                  </div>
                  <LikeButton
                    postId={post.id}
                    likeCount={post.likeCount}
                    likedByMe={post.likedByMe}
                  />
                </div>
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>
    </div>
  );
}
