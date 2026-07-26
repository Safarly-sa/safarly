/**
 * /stories/:id/edit — same StoryForm as create, pre-filled and PATCHing
 * instead of POSTing. Ownership is re-checked here even though the server
 * enforces it too (403 on PATCH) — this avoids flashing the form for a
 * moment before a server rejection would kick in.
 */
import { useEffect, useState } from "react";
import { useParams, useLocation, Link } from "wouter";
import { useTranslation } from "@/providers/translation-context";
import { usePageMeta } from "@/lib/usePageMeta";
import { Button } from "@/components/ui/button";
import { StoryForm } from "@/components/StoryForm";
import { fetchStory, updateStory, type Post } from "@/lib/posts-api";
import { fetchMe } from "@/lib/auth-api";

export function EditStory() {
  const params = useParams<{ id: string }>();
  const { t } = useTranslation();
  usePageMeta(t("stories.new.edit_title"), t("stories.subtitle"));
  const [, navigate] = useLocation();

  const [post, setPost] = useState<Post | null>(null);
  const [currentUserId, setCurrentUserId] = useState<string | null | undefined>(undefined);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetchStory(params.id).then((result) => {
      if (cancelled) return;
      if (result.ok) setPost(result.post);
      else setError(result.error);
    });
    fetchMe().then((user) => { if (!cancelled) setCurrentUserId(user?.id ?? null); });
    return () => { cancelled = true; };
  }, [params.id]);

  if (error) {
    return <div className="max-w-3xl mx-auto px-4 pt-24 pb-16 text-center text-destructive">{error}</div>;
  }
  if (!post || currentUserId === undefined) {
    return <div className="max-w-3xl mx-auto px-4 pt-24 pb-16 text-sm text-muted-foreground">{t("stories.loading")}</div>;
  }
  if (currentUserId === null) {
    return (
      <div className="max-w-lg mx-auto px-4 pt-24 pb-16 text-center">
        <p className="mb-4">{t("stories.new.sign_in_required")}</p>
        <Button onClick={() => navigate("/login")}>{t("gate.cta")}</Button>
      </div>
    );
  }
  if (post.creatorId !== currentUserId) {
    return (
      <div className="max-w-lg mx-auto px-4 pt-24 pb-16 text-center">
        <p className="mb-4">{t("stories.new.not_your_story")}</p>
        <Link href={`/stories/${post.id}`}><Button variant="secondary">{t("stories.back")}</Button></Link>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto px-4 pt-24 pb-10">
      <h1 className="text-2xl font-bold mb-6">{t("stories.new.edit_title")}</h1>
      <StoryForm
        initial={post}
        submitLabel={t("stories.new.save")}
        submittingLabel={t("stories.new.saving")}
        onSubmit={(values) => updateStory(post.id, values)}
        onSuccess={(updated) => navigate(`/stories/${updated.id}`)}
      />
    </div>
  );
}
