/**
 * /stories/new — creator form. See components/StoryForm.tsx for the shared
 * fields (also used by /stories/:id/edit); this page only owns the auth gate
 * and the create-specific submit call.
 */
import { useLocation } from "wouter";
import { useTranslation } from "@/providers/translation-context";
import { usePageMeta } from "@/lib/usePageMeta";
import { getAuth } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { StoryForm } from "@/components/StoryForm";
import { createStory } from "@/lib/posts-api";

export function CreateStory() {
  const { t } = useTranslation();
  usePageMeta(t("stories.new.title"), t("stories.subtitle"));
  const [, navigate] = useLocation();
  const auth = getAuth();

  if (!auth) {
    return (
      <div className="max-w-lg mx-auto px-4 pt-24 pb-16 text-center">
        <p className="mb-4">{t("stories.new.sign_in_required")}</p>
        <Button onClick={() => navigate("/login")}>{t("gate.cta")}</Button>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto px-4 pt-24 pb-10">
      <h1 className="text-2xl font-bold mb-6">{t("stories.new.title")}</h1>
      <StoryForm
        submitLabel={t("stories.new.publish")}
        submittingLabel={t("stories.new.publishing")}
        onSubmit={createStory}
        onSuccess={(post) => navigate(`/stories/${post.id}`)}
      />
    </div>
  );
}
