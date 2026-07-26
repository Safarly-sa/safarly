/**
 * Shared Trip Story composer — used by both /stories/new and /stories/:id/edit
 * (the latter just supplies `initial` + a different `onSubmit`). Pulled out of
 * create-story.tsx once an edit flow needed the identical fields, rather than
 * forking the form in two places.
 *
 * Media: a file upload (direct-to-R2 via lib/media-api.ts) when storage is
 * configured server-side, or a pasted external URL always — the paste path
 * never goes away since TikTok links are never uploaded. POIs: a city-scoped
 * autocomplete over the same pois.json the itinerary engine reads, so a
 * story can only tag real places, not free text.
 */
import { useRef, useState } from "react";
import { Trash2, PlusCircle, Upload, Loader2 } from "lucide-react";
import { useTranslation } from "@/providers/translation-context";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { extractTikTokId } from "@/lib/tiktok";
import { uploadMediaFile } from "@/lib/media-api";
import type { PostMediaInput, Post, PostResult } from "@/lib/posts-api";
import type { POI } from "@/lib/engine";
import poisData from "@/data/pois.json";

export interface StoryFormValues {
  title: string;
  content: string;
  city: string;
  tags: string[];
  poiIds: string[];
  media: PostMediaInput[];
}

export function StoryForm({
  initial,
  submitLabel,
  submittingLabel,
  onSubmit,
  onSuccess,
}: {
  initial?: Post;
  submitLabel: string;
  submittingLabel: string;
  onSubmit: (values: StoryFormValues) => Promise<PostResult>;
  onSuccess: (post: Post) => void;
}) {
  const { t } = useTranslation();

  const [title, setTitle] = useState(initial?.title ?? "");
  const [content, setContent] = useState(initial?.content ?? "");
  const [city, setCity] = useState(initial?.city ?? "");
  const [tagsInput, setTagsInput] = useState(initial?.tags.join(", ") ?? "");
  const [media, setMedia] = useState<PostMediaInput[]>(initial?.media.map((m) => ({
    type: m.type, url: m.url, tiktokVideoId: m.tiktokVideoId ?? undefined, caption: m.caption ?? undefined,
  })) ?? []);
  const [imageUrl, setImageUrl] = useState("");
  const [tiktokUrl, setTiktokUrl] = useState("");
  const [poiQuery, setPoiQuery] = useState("");
  const [selectedPoiIds, setSelectedPoiIds] = useState<string[]>(initial?.poiIds ?? []);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const allPois = poisData as POI[];
  const selectedPois = selectedPoiIds
    .map((id) => allPois.find((p) => p.id === id))
    .filter((p): p is POI => Boolean(p));

  const matchingPois = city.trim()
    ? allPois
        .filter((p) => p.city === city.trim().toLowerCase())
        .filter((p) => !selectedPoiIds.includes(p.id))
        .filter((p) => !poiQuery.trim() || p.name.toLowerCase().includes(poiQuery.trim().toLowerCase()))
        .slice(0, 8)
    : [];

  function addPoi(id: string) {
    setSelectedPoiIds((ids) => [...ids, id]);
    setPoiQuery("");
  }

  function removePoi(id: string) {
    setSelectedPoiIds((ids) => ids.filter((x) => x !== id));
  }

  function addImageUrl() {
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

  async function handleFilePicked(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;

    setUploading(true);
    setError(null);
    const result = await uploadMediaFile(file);
    setUploading(false);

    if (!result.ok) {
      setError(result.error);
      return;
    }
    setMedia((m) => [...m, { type: result.type, url: result.url }]);
  }

  function removeMedia(index: number) {
    setMedia((m) => m.filter((_, i) => i !== index));
  }

  async function handleSubmit() {
    setError(null);
    if (media.length === 0) {
      setError(t("stories.new.needs_media"));
      return;
    }
    setSubmitting(true);
    const result = await onSubmit({
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
    onSuccess(result.post);
  }

  return (
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

        {selectedPois.length > 0 && (
          <div className="flex flex-wrap gap-1.5 mb-2">
            {selectedPois.map((p) => (
              <Badge key={p.id} variant="secondary" className="gap-1">
                {p.name}
                <button type="button" onClick={() => removePoi(p.id)} aria-label={t("stories.new.remove_poi")}>
                  &times;
                </button>
              </Badge>
            ))}
          </div>
        )}

        <Input
          id="story-pois"
          value={poiQuery}
          onChange={(e) => setPoiQuery(e.target.value)}
          placeholder={city.trim() ? t("stories.new.poi_search_placeholder") : t("stories.new.poi_needs_city")}
          disabled={!city.trim()}
        />
        {matchingPois.length > 0 && (
          <div className="mt-1.5 border rounded-md divide-y overflow-hidden">
            {matchingPois.map((p) => (
              <button
                key={p.id}
                type="button"
                onClick={() => addPoi(p.id)}
                className="w-full text-left px-3 py-2 text-sm hover:bg-muted transition-colors"
              >
                {p.name}
              </button>
            ))}
          </div>
        )}
      </div>

      <div className="border-t pt-5 space-y-3">
        <p className="text-sm font-medium">{t("stories.new.media_heading")}</p>

        <div className="flex gap-2">
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={handleFilePicked}
          />
          <Button
            type="button"
            variant="secondary"
            className="gap-2"
            disabled={uploading}
            onClick={() => fileInputRef.current?.click()}
          >
            {uploading ? <Loader2 className="w-4 h-4 animate-spin" aria-hidden /> : <Upload className="w-4 h-4" aria-hidden />}
            {uploading ? t("stories.new.uploading") : t("stories.new.upload_file")}
          </Button>
        </div>

        <div className="flex gap-2">
          <Input value={imageUrl} onChange={(e) => setImageUrl(e.target.value)} placeholder={t("stories.new.image_url_placeholder")} />
          <Button type="button" variant="secondary" onClick={addImageUrl}>{t("stories.new.add")}</Button>
        </div>

        <div className="flex gap-2">
          <Input value={tiktokUrl} onChange={(e) => setTiktokUrl(e.target.value)} placeholder={t("stories.new.tiktok_placeholder")} />
          <Button type="button" variant="secondary" onClick={addTikTok}>{t("stories.new.add")}</Button>
        </div>

        {media.length > 0 && (
          <ul className="space-y-1.5">
            {media.map((m, i) => (
              <li key={i} className="flex items-center justify-between text-sm bg-muted rounded-md px-3 py-2">
                <span className="truncate">{m.type === "tiktok" ? "TikTok" : m.type === "video" ? "Video" : "Image"}: {m.url}</span>
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
        {submitting ? submittingLabel : submitLabel}
      </Button>
    </div>
  );
}
