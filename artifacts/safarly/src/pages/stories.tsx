/**
 * /stories — public feed of creator Trip Stories, newest first.
 * Local-first product philosophy applies here too: the feed is just a list
 * of posts, no ranking algorithm, no infinite-scroll trickery.
 */
import { useEffect, useState } from "react";
import { Link } from "wouter";
import { MapPin, ImageOff, PlusCircle } from "lucide-react";
import { useTranslation } from "@/providers/translation-context";
import { usePageMeta } from "@/lib/usePageMeta";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { fetchStories, type Post } from "@/lib/posts-api";

function CoverThumb({ post }: { post: Post }) {
  const cover = post.media[0];
  if (cover?.type === "image") {
    return <img src={cover.url} alt="" className="w-full h-40 object-cover rounded-t-xl" />;
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

  return (
    <div className="max-w-5xl mx-auto px-4 py-10">
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

      {error && <p className="text-sm text-destructive">{error}</p>}
      {posts === null && !error && <p className="text-sm text-muted-foreground">{t("stories.loading")}</p>}
      {posts?.length === 0 && <p className="text-sm text-muted-foreground">{t("stories.empty")}</p>}

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
                <div className="flex flex-wrap gap-1.5">
                  {post.tags.slice(0, 3).map((tag) => (
                    <Badge key={tag} variant="secondary" className="text-xs">{tag}</Badge>
                  ))}
                </div>
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>
    </div>
  );
}
