/**
 * /stories/:id — single Trip Story: media gallery, body text, and a Leaflet
 * map pinning the real POIs the creator tagged (not freeform location text —
 * see posts.city/poiIds in lib/db/src/schema/posts.ts). Plain Leaflet + raster
 * OSM tiles, same approach as itinerary.tsx's DestinationMap, kept as its own
 * small instance here rather than a shared module since the two have
 * different data shapes (a day's ordered stops vs. a story's unordered tags).
 */
import { useEffect, useRef, useState } from "react";
import { useParams, Link } from "wouter";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { MapPin, ArrowLeft, Compass } from "lucide-react";
import { useTranslation } from "@/providers/translation-context";
import { usePageMeta } from "@/lib/usePageMeta";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { TikTokEmbed } from "@/components/TikTokEmbed";
import { fetchStory, type Post } from "@/lib/posts-api";
import { poiName } from "@/lib/poi-i18n";
import type { POI } from "@/lib/engine";
import poisData from "@/data/pois.json";

const CITY_FALLBACK_CENTER: [number, number] = [24.7136, 46.6753]; // Riyadh

function StoryMap({ poiIds }: { poiIds: string[] }) {
  const { t } = useTranslation();
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);

  const pois = (poisData as POI[]).filter((p) => poiIds.includes(p.id));

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;
    const map = L.map(containerRef.current, {
      center: CITY_FALLBACK_CENTER,
      zoom: 11,
      zoomControl: true,
      attributionControl: false,
      scrollWheelZoom: false,
    });
    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      subdomains: "abc",
      maxZoom: 19,
    }).addTo(map);
    mapRef.current = map;
    return () => { map.remove(); mapRef.current = null; };
  }, []);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    if (pois.length === 0) return;

    const markers = pois.map((poi) =>
      L.marker([poi.lat, poi.lng]).bindTooltip(poiName(t, poi)).addTo(map),
    );
    const bounds = L.latLngBounds(pois.map((p) => [p.lat, p.lng]));
    map.fitBounds(bounds, { padding: [30, 30], maxZoom: 15 });

    return () => { markers.forEach((m) => m.remove()); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [poiIds.join(",")]);

  if (pois.length === 0) return null;

  return <div ref={containerRef} className="w-full h-64 rounded-xl overflow-hidden border" />;
}

function MediaItem({ item }: { item: Post["media"][number] }) {
  if (item.type === "image") {
    return <img src={item.url} alt={item.caption ?? ""} className="w-full rounded-xl" />;
  }
  if (item.type === "video") {
    return <video src={item.url} controls className="w-full rounded-xl" />;
  }
  return <TikTokEmbed videoId={item.tiktokVideoId ?? ""} videoUrl={item.url} />;
}

export function StoryDetail() {
  const params = useParams<{ id: string }>();
  const { t } = useTranslation();
  const [post, setPost] = useState<Post | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetchStory(params.id).then((result) => {
      if (cancelled) return;
      if (result.ok) setPost(result.post);
      else setError(result.error);
    });
    return () => { cancelled = true; };
  }, [params.id]);

  usePageMeta(post?.title ?? t("stories.title"), post?.content.slice(0, 160) ?? t("stories.subtitle"));

  if (error) {
    return <div className="max-w-3xl mx-auto px-4 py-16 text-center text-destructive">{error}</div>;
  }
  if (!post) {
    return <div className="max-w-3xl mx-auto px-4 py-16 text-sm text-muted-foreground">{t("stories.loading")}</div>;
  }

  return (
    <div className="max-w-3xl mx-auto px-4 py-10">
      <Link href="/stories" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground mb-6">
        <ArrowLeft className="w-4 h-4" aria-hidden /> {t("stories.back")}
      </Link>

      <h1 className="text-3xl font-bold mb-2">{post.title}</h1>
      <div className="flex items-center gap-2 text-sm text-muted-foreground mb-6">
        <MapPin className="w-4 h-4" aria-hidden />
        <span className="capitalize">{post.city}</span>
        <span aria-hidden>&middot;</span>
        <span>{post.creatorName}</span>
      </div>

      {post.tags.length > 0 && (
        <div className="flex flex-wrap gap-1.5 mb-6">
          {post.tags.map((tag) => <Badge key={tag} variant="secondary">{tag}</Badge>)}
        </div>
      )}

      <div className="space-y-4 mb-8">
        {post.media.map((item) => <MediaItem key={item.id} item={item} />)}
      </div>

      <p className="whitespace-pre-wrap leading-relaxed mb-10">{post.content}</p>

      {post.poiIds.length > 0 && (
        <div className="mb-10">
          <h2 className="text-lg font-semibold mb-3">{t("stories.map_title")}</h2>
          <StoryMap poiIds={post.poiIds} />
        </div>
      )}

      <Link href={`/planner?city=${encodeURIComponent(post.city)}`}>
        <Button size="lg" className="gap-2 w-full sm:w-auto">
          <Compass className="w-4 h-4" aria-hidden />
          {t("stories.start_trip_cta")}
        </Button>
      </Link>
    </div>
  );
}
