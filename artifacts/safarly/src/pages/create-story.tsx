/**
 * /stories/new — creator form. No rich-text editor: plain text/markdown
 * textarea, consistent with the "no unnecessary deps" approach elsewhere in
 * the app (see prepareImageForUpload's client-side-only image handling).
 * Media is either a pasted-in image/video URL or a TikTok link — there is no
 * file upload/object storage wired up yet (see the plan's Media Storage
 * section), so images/videos are entered as URLs for this slice.
 */
import { useState } from "react";
import { useLocation } from "wouter";
import { Trash2, PlusCircle } from "lucide-react";
import { useTranslation } from "@/providers/translation-context";
import { usePageMeta } from "@/lib/usePageMeta";
import { getAuth } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { extractTikTokId } from "@/lib/tiktok";
import { createStory, type PostMediaInput } from "@/lib/posts-api";
import type { POI } from "@/lib/engine";
import poisData from "@/data/pois.json";

export function CreateStory() {
  const { t } = useTranslation();
  usePageMeta(t("stories.new.title"), t("stories.subtitle"));
  const [, navigate] = useLocation();
  const auth = getAuth();

  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [city, setCity] = useState("");
  const [tagsInput, setTagsInput] = useState("");
  const [poiInput, setPoiInput] = useState("");
  const [media, setMedia] = useState<PostMediaInput[]>([]);
  const [imageUrl, setImageUrl] = useState("");
  const [tiktokUrl, setTiktokUrl] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const matchingPois = city.trim()
    ? (poisData as POI[]).filter((p) => p.city === city.trim().toLowerCase()).slice(0, 40)
    : [];
  const selectedPoiIds = poiInput.split(",").map((s) => s.trim()).filter(Boolean);

  function addImage() {
    if (!imageUrl.trim()) return;
    setMedia((m) => [...m, { type: "image", url: imageUrl.trim() }]);
    setImageUrl("");
  }

  function addTikTok() {
    const videoId = extractTikTokId(tiktokUrl);
    if (!videoId) {
      setError(t("stories.new.invalid_tiktok"));
      return;
    }
    setMedia((m) => [...m, { type: "tiktok", url: tiktokUrl.trim(), tiktokVideoId: videoId }]);
    setTiktokUrl("");
    setError(null);
  }

  function removeMedia(index: number) {
    setMedia((m) => m.filter((_, i) => i !== index));
  }

  if (!auth) {
    return (
      <div className="max-w-lg mx-auto px-4 py-16 text-center">
        <p className="mb-4">{t("stories.new.sign_in_required")}</p>
        <Button onClick={() => navigate("/login")}>{t("gate.cta")}</Button>
      </div>
    );
  }

  async function handleSubmit() {
    setError(null);
    if (media.length === 0) {
      setError(t("stories.new.needs_media"));
      return;
    }
    setSubmitting(true);
    const result = await createStory({
      title,
      content,
      city: city.trim(),
      tags: tagsInput.split(",").map((s) => s.trim()).filter(Boolean),
      poiIds: selectedPoiIds,
      media,
    });
    setSubmitting(false);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    navigate(`/stories/${result.post.id}`);
  }

  return (
    <div className="max-w-2xl mx-auto px-4 py-10">
      <h1 className="text-2xl font-bold mb-6">{t("stories.new.title")}</h1>

      <div className="space-y-5">
        <div>
          <Label htmlFor="story-title">{t("stories.new.field_title")}</Label>
          <Input id="story-title" value={title} onChange={(e) => setTitle(e.target.value)} maxLength={120} />
        </div>

        <div>
          <Label htmlFor="story-city">{t("stories.new.field_city")}</Label>
          <Input
            id="story-city"
            value={city}
            onChange={(e) => setCity(e.target.value)}
            placeholder="riyadh, alula, jeddah..."
          />
        </div>

        <div>
          <Label htmlFor="story-content">{t("stories.new.field_content")}</Label>
          <Textarea id="story-content" rows={8} value={content} onChange={(e) => setContent(e.target.value)} maxLength={8000} />
        </div>

        <div>
          <Label htmlFor="story-tags">{t("stories.new.field_tags")}</Label>
          <Input id="story-tags" value={tagsInput} onChange={(e) => setTagsInput(e.target.value)} placeholder="Heritage, Desert, Food" />
        </div>

        <div>
          <Label htmlFor="story-pois">{t("stories.new.field_pois")}</Label>
          <Input
            id="story-pois"
            value={poiInput}
            onChange={(e) => setPoiInput(e.target.value)}
            placeholder="poi_id_1, poi_id_2"
          />
          {matchingPois.length > 0 && (
            <p className="text-xs text-muted-foreground mt-1.5">
              {matchingPois.map((p) => p.id).join(", ")}
            </p>
          )}
        </div>

        <div className="border-t pt-5 space-y-3">
          <p className="text-sm font-medium">{t("stories.new.media_heading")}</p>

          <div className="flex gap-2">
            <Input value={imageUrl} onChange={(e) => setImageUrl(e.target.value)} placeholder={t("stories.new.image_url_placeholder")} />
            <Button type="button" variant="secondary" onClick={addImage}>{t("stories.new.add")}</Button>
          </div>

          <div className="flex gap-2">
            <Input value={tiktokUrl} onChange={(e) => setTiktokUrl(e.target.value)} placeholder={t("stories.new.tiktok_placeholder")} />
            <Button type="button" variant="secondary" onClick={addTikTok}>{t("stories.new.add")}</Button>
          </div>

          {media.length > 0 && (
            <ul className="space-y-1.5">
              {media.map((m, i) => (
                <li key={i} className="flex items-center justify-between text-sm bg-muted rounded-md px-3 py-2">
                  <span className="truncate">{m.type === "tiktok" ? "TikTok" : "Image"}: {m.url}</span>
                  <button type="button" onClick={() => removeMedia(i)} aria-label={t("stories.new.remove_media")}>
                    <Trash2 className="w-4 h-4 text-muted-foreground" aria-hidden />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>

        {error && <p className="text-sm text-destructive">{error}</p>}

        <Button size="lg" className="w-full gap-2" disabled={submitting} onClick={handleSubmit}>
          <PlusCircle className="w-4 h-4" aria-hidden />
          {submitting ? t("stories.new.publishing") : t("stories.new.publish")}
        </Button>
      </div>
    </div>
  );
}
