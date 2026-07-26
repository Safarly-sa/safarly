import { useEffect, useMemo, useRef, useState } from "react";
import { useLocation } from "wouter";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import {
  CheckCircle2, ExternalLink, MapPin, Utensils,
  Wrench, RotateCcw, ArrowLeft, Moon, Gem,
  AlertTriangle, ShieldAlert, Compass, Navigation, Wallet, X, Camera,
  ZoomIn, ZoomOut, Plane, CalendarDays, BedDouble, Heart,
} from "lucide-react";
import { useTranslation } from "@/providers/translation-context";
import { usePageMeta } from "@/lib/usePageMeta";
import { AuroraHero } from "@/components/AuroraHero";
import { poiName, poiCulture, resolve } from "@/lib/poi-i18n";
import { dishName, dishDesc, mealVenue, mealArea } from "@/lib/dish-i18n";
import { localeTag } from "@/lib/locale-format";
import { generateItinerary, isVerified, optimizeDayStops, CITY_NAMES_AR, type ItineraryResult, type ItineraryDay, type ItineraryStop, type ItineraryMeal, type TripSpec, type TravelerProfile, type Objectives, type TransportLeg, type TripEvent, type AccommodationOption, type POI } from "@/lib/engine";
import { isFavorite as isFavoritePoi, toggleFavorite as toggleFavoritePoi } from "@/lib/favorites";
import { ConciergeChat } from "@/components/ConciergeChat";
import { ResultsGate } from "@/components/ResultsGate";
import { getAuth } from "@/lib/auth";
import { pois as poisRaw } from "@workspace/poi-data";

/* ── POI type (mirrors pois.json shape) ────────────────────────────── */
interface RawPoi {
  id: string; name: string; city: string;
  category: string; lat: number; lng: number;
  price_range: number; duration_hrs: number;
  hidden_gem: boolean; family_friendly: boolean;
  accessible: boolean; indoor: boolean; best_slot: string;
  map_url?: string; culture_note?: string;
}
const ALL_POIS = poisRaw as RawPoi[];

/* ── City fallback coordinates (used only when a day has no stops) ──── */
const CITY_COORDS: Record<string, [number, number]> = {
  riyadh:  [24.6877, 46.7219],
  jeddah:  [21.4858, 39.1925],
  madinah: [24.5247, 39.5692],
  makkah:  [21.3891, 39.8579],
  abha:    [18.2164, 42.5053],
  alula:   [26.6133, 37.9169],
  taif:    [21.2702, 40.4158],
  khobar:  [26.2854, 50.2088],
  dammam:  [26.4207, 50.0888],
  neom:    [28.3000, 35.3000],
  ai:      [24.6877, 46.7219],
};

const MAP_MIN_ZOOM = 3;
const MAP_MAX_ZOOM = 18;
// Same hex in both themes (see index.css --sf-indigo) — Leaflet's canvas/SVG
// renderer can't resolve CSS custom properties, so it needs a literal value.
const MAP_ROUTE_COLOR = "#5C6CFF";

interface MapStop { id: string; lat: number; lng: number; name: string }

/** Google Maps directions URL that reproduces the day's stops, in visit order. */
function dayRouteMapsUrl(stops: MapStop[]): string {
  if (stops.length === 0) return "";
  if (stops.length === 1) {
    return `https://www.google.com/maps/search/?api=1&query=${stops[0].lat},${stops[0].lng}`;
  }
  const origin = stops[0];
  const destination = stops[stops.length - 1];
  const waypoints = stops.slice(1, -1);
  const params = new URLSearchParams({
    api: "1",
    origin: `${origin.lat},${origin.lng}`,
    destination: `${destination.lat},${destination.lng}`,
    travelmode: "walking",
  });
  if (waypoints.length > 0) {
    params.set("waypoints", waypoints.map(w => `${w.lat},${w.lng}`).join("|"));
  }
  return `https://www.google.com/maps/dir/?${params.toString()}`;
}

/**
 * Per-day route map: one numbered marker per stop (in visit order) connected
 * by a route line, auto-fit to the day's bounds. Plain Leaflet (no
 * react-leaflet) + raster OSM tiles — no API key. Re-draws markers/route
 * whenever `day` changes (switching day tabs, or a cascade re-plan swapping a
 * stop), without tearing down and re-creating the underlying map instance.
 */
function DestinationMap({ day, city }: { day: ItineraryDay | undefined; city: string }) {
  const { t, language, dir } = useTranslation();
  const containerRef  = useRef<HTMLDivElement>(null);
  const mapRef        = useRef<L.Map | null>(null);
  const routeLayerRef = useRef<L.FeatureGroup | null>(null);
  const [zoom, setZoom]       = useState(13);
  const [tilesOk, setTilesOk] = useState(true);

  const fallbackCenter = CITY_COORDS[city] ?? CITY_COORDS["riyadh"];
  const stops: MapStop[] = (day?.stops ?? []).map(s => ({
    id: s.poi.id, lat: s.poi.lat, lng: s.poi.lng, name: poiName(t, s.poi),
  }));
  const stopsKey = stops.map(s => `${s.id}:${s.lat}:${s.lng}`).join("|");

  /* Create the map once; tear down on unmount. */
  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;
    const map = L.map(containerRef.current, {
      center: fallbackCenter,
      zoom: 13,
      minZoom: MAP_MIN_ZOOM,
      maxZoom: MAP_MAX_ZOOM,
      zoomControl: false,
      attributionControl: false,
      // Enabled only on hover/focus below — otherwise scrolling the page past
      // the map gets hijacked into a map zoom, a classic embedded-map trap.
      scrollWheelZoom: false,
    });

    let tileErrors = 0;
    const tiles = L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      subdomains: "abc",
      maxZoom: 19,
    });
    tiles.on("tileerror", () => { tileErrors += 1; if (tileErrors >= 4) setTilesOk(false); });
    tiles.on("load", () => setTilesOk(true));
    tiles.addTo(map);

    routeLayerRef.current = L.featureGroup().addTo(map);
    map.on("zoomend", () => setZoom(map.getZoom()));

    const enableScroll  = () => map.scrollWheelZoom.enable();
    const disableScroll = () => map.scrollWheelZoom.disable();
    map.getContainer().addEventListener("mouseenter", enableScroll);
    map.getContainer().addEventListener("mouseleave", disableScroll);

    mapRef.current = map;
    return () => {
      map.getContainer().removeEventListener("mouseenter", enableScroll);
      map.getContainer().removeEventListener("mouseleave", disableScroll);
      map.remove();
      mapRef.current = null;
    };
    // Init/teardown only — redraws are handled by the effect below.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /* Redraw numbered markers + route line for the active day, and fit bounds. */
  useEffect(() => {
    const map = mapRef.current;
    const layer = routeLayerRef.current;
    if (!map || !layer) return;
    layer.clearLayers();

    if (stops.length === 0) {
      map.setView(fallbackCenter, 13);
      setZoom(map.getZoom());
      return;
    }

    const latlngs = stops.map(s => L.latLng(s.lat, s.lng));

    if (latlngs.length > 1) {
      L.polyline(latlngs, {
        color: MAP_ROUTE_COLOR, weight: 3, opacity: 0.85, dashArray: "1 8", lineCap: "round",
      }).addTo(layer);
    }

    stops.forEach((s, i) => {
      const icon = L.divIcon({
        className: "sf-map-pin",
        html: String(i + 1),
        iconSize: [26, 26],
        iconAnchor: [13, 13],
        popupAnchor: [0, -13],
      });
      const popupEl = document.createElement("div");
      popupEl.className = "sf-map-popup";
      popupEl.dir = dir;
      popupEl.textContent = `${i + 1}. ${s.name}`;
      L.marker([s.lat, s.lng], { icon, alt: `${i + 1}. ${s.name}`, keyboard: true })
        .bindPopup(popupEl)
        .addTo(layer);
    });

    if (latlngs.length === 1) {
      map.setView(latlngs[0], 15);
    } else {
      map.fitBounds(layer.getBounds(), { padding: [36, 36], maxZoom: 16 });
    }
    setZoom(map.getZoom());
    // `stopsKey` (not the freshly-mapped `stops` array) keeps this from
    // redrawing every render; `language` is added so switching the UI
    // language relabels already-drawn popups even without a day-tab click.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stopsKey, language]);

  const mapsUrl  = dayRouteMapsUrl(stops);
  const dayLabel = day ? t("itin.day").replace("{n}", String(day.dayNumber)) : "";

  return (
    <div style={{ marginTop: 32, marginBottom: 8 }}>
      <div style={{
        display: "flex", alignItems: "center", justifyContent: "space-between",
        marginBottom: 12, flexWrap: "wrap", gap: 8,
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
          <MapPin size={15} style={{ color: "var(--sf-text-accent)" }} aria-hidden />
          <span style={{ fontSize: "0.875rem", fontWeight: 700, color: "var(--sf-text)" }}>
            {t("itin.map.title")}
          </span>
          <span style={{ fontSize: "0.75rem", color: "var(--sf-text-muted)", textTransform: "capitalize" }}>
            — {city} · {dayLabel}
          </span>
        </div>
        {/* Zoom controls (Leaflet's own zoomControl is disabled so this pair,
            already logical-property-based for RTL, is the only one shown) */}
        <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
          <button
            onClick={() => mapRef.current?.zoomIn()}
            disabled={zoom >= MAP_MAX_ZOOM}
            aria-label={t("itin.map.zoom_in")}
            style={{
              display: "flex", alignItems: "center", justifyContent: "center",
              width: 34, height: 34, borderRadius: 8,
              border: "1px solid var(--sf-border)", background: "var(--sf-surface)",
              color: "var(--sf-text-muted)", cursor: zoom >= MAP_MAX_ZOOM ? "not-allowed" : "pointer",
              opacity: zoom >= MAP_MAX_ZOOM ? 0.4 : 1, transition: "border-color 0.15s, color 0.15s",
            }}
            onMouseEnter={e => { if (zoom < MAP_MAX_ZOOM) { (e.currentTarget as HTMLElement).style.borderColor = "var(--sf-indigo)"; (e.currentTarget as HTMLElement).style.color = "var(--sf-indigo)"; } }}
            onMouseLeave={e => { (e.currentTarget as HTMLElement).style.borderColor = "var(--sf-border)"; (e.currentTarget as HTMLElement).style.color = "var(--sf-text-muted)"; }}
          >
            <ZoomIn size={16} aria-hidden />
          </button>
          <span style={{ fontSize: "0.75rem", fontWeight: 700, color: "var(--sf-text-muted)", minWidth: 28, textAlign: "center" }}>
            {zoom}
          </span>
          <button
            onClick={() => mapRef.current?.zoomOut()}
            disabled={zoom <= MAP_MIN_ZOOM}
            aria-label={t("itin.map.zoom_out")}
            style={{
              display: "flex", alignItems: "center", justifyContent: "center",
              width: 34, height: 34, borderRadius: 8,
              border: "1px solid var(--sf-border)", background: "var(--sf-surface)",
              color: "var(--sf-text-muted)", cursor: zoom <= MAP_MIN_ZOOM ? "not-allowed" : "pointer",
              opacity: zoom <= MAP_MIN_ZOOM ? 0.4 : 1, transition: "border-color 0.15s, color 0.15s",
            }}
            onMouseEnter={e => { if (zoom > MAP_MIN_ZOOM) { (e.currentTarget as HTMLElement).style.borderColor = "var(--sf-indigo)"; (e.currentTarget as HTMLElement).style.color = "var(--sf-indigo)"; } }}
            onMouseLeave={e => { (e.currentTarget as HTMLElement).style.borderColor = "var(--sf-border)"; (e.currentTarget as HTMLElement).style.color = "var(--sf-text-muted)"; }}
          >
            <ZoomOut size={16} aria-hidden />
          </button>
        </div>
      </div>
      <div style={{ position: "relative", borderRadius: 14, overflow: "hidden", border: "1px solid var(--sf-border)", height: 320 }}>
        <div
          ref={containerRef}
          role="region"
          aria-label={t("itin.map.title")}
          style={{ width: "100%", height: "100%", background: "var(--sf-surface-alt)" }}
        />
        {!tilesOk && (
          <div className="sf-map-tile-error" role="status">
            {t("itin.map.tile_error")}
          </div>
        )}
      </div>
      <div style={{
        display: "flex", alignItems: "center", justifyContent: "space-between",
        marginTop: 6, flexWrap: "wrap", gap: 8,
      }}>
        <p style={{ fontSize: "0.6875rem", color: "var(--sf-text-muted)" }}>
          © <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener noreferrer" style={{ color: "inherit" }}>OpenStreetMap</a> contributors
        </p>
        {mapsUrl && (
          <a href={mapsUrl} target="_blank" rel="noopener noreferrer" className="sf-maps-link">
            <MapPin size={12} aria-hidden />
            {t("itin.map.open_route")}
          </a>
        )}
      </div>
    </div>
  );
}

/* ── Cascade state shape ────────────────────────────────────────────── */
type CascadePhase = "idle" | "closed" | "feeding" | "replanned";
interface CascadeInfo {
  phase:          CascadePhase;
  closedPoiId:    string;
  closedPoiName:  string;
  replacementPoiId: string;
  altName1:       string;
  altName2:       string;
  newDailyCost:   number;
  shiftedLunch:   string;
  reorderedCount: number;
  feedStep:       number; // 1-5 visible agent messages
}

/* ── Style injection ────────────────────────────────────────────────── */
function useItinStyles() {
  useEffect(() => {
    const id = "sf-itin-styles";
    if (document.getElementById(id)) return;
    const s = document.createElement("style");
    s.id = id;
    s.textContent = `
      /* Day tabs */
      .sf-day-tab {
        background: var(--sf-surface);
        color: var(--sf-text-muted);
        border: 1px solid var(--sf-border);
        border-radius: 999px;
        padding: 8px 18px;
        font-size: 0.8125rem;
        font-weight: 600;
        white-space: nowrap;
        cursor: pointer;
        transition: background 0.15s, color 0.15s, border-color 0.15s, box-shadow 0.15s;
        min-height: 44px;
        display: flex; align-items: center;
      }
      .sf-day-tab:hover {
        background: var(--sf-surface-alt);
        color: var(--sf-text);
      }
      .sf-day-tab-active {
        background: var(--sf-accent);
        color: #0A0E16;
        border-color: var(--sf-accent);
        box-shadow: 0 0 12px rgba(0,216,164,0.30);
      }
      .sf-day-tab-active:hover {
        background: var(--sf-accent-hover);
        color: #0A0E16;
      }

      /* Timeline line */
      .sf-tl-track {
        position: relative;
      }
      .sf-tl-track::before {
        content: '';
        position: absolute;
        inset-block: 12px;
        inset-inline-start: 11px;
        width: 2px;
        background: var(--sf-border);
        border-radius: 2px;
      }

      /* Stop card */
      .sf-stop-card {
        background: var(--sf-surface);
        border: 1px solid var(--sf-border);
        border-radius: 12px;
        padding: 14px 16px;
        transition: box-shadow 0.18s;
      }
      .sf-stop-card:hover {
        box-shadow: 0 4px 24px color-mix(in srgb, var(--sf-accent) 12%, transparent);
      }

      /* Meal card */
      .sf-meal-card {
        background: var(--sf-surface-alt);
        border: 1px solid var(--sf-border);
        border-radius: 10px;
        padding: 12px 14px;
        transition: box-shadow 0.18s;
      }

      /* Objective bar animation */
      .sf-obj-bar {
        height: 4px;
        border-radius: 4px;
        background: var(--sf-indigo);
        width: 0%;
        transition: width 0.75s cubic-bezier(0.25, 1, 0.5, 1);
      }

      /* Maps link */
      .sf-maps-link {
        color: var(--sf-text-accent);
        text-decoration: none;
        font-size: 0.75rem;
        font-weight: 600;
        display: inline-flex;
        align-items: center;
        gap: 4px;
        transition: opacity 0.15s;
      }
      .sf-maps-link:hover { opacity: 0.75; }

      /* Ghost wrench button */
      .sf-wrench-btn {
        position: fixed;
        inset-block-end: 100px;
        inset-inline-end: 20px;
        width: 44px;
        height: 44px;
        border-radius: 50%;
        border: 1px solid var(--sf-border);
        background: var(--sf-surface);
        color: var(--sf-text-muted);
        display: flex;
        align-items: center;
        justify-content: center;
        cursor: pointer;
        z-index: 50;
        transition: border-color 0.15s, color 0.15s, box-shadow 0.15s;
        box-shadow: 0 2px 8px rgba(0,0,0,0.12);
      }
      .sf-wrench-btn:hover {
        border-color: var(--sf-accent);
        color: var(--sf-accent);
        box-shadow: 0 4px 16px color-mix(in srgb, var(--sf-accent) 20%, transparent);
      }

      /* Action buttons */
      .sf-btn-primary {
        background: var(--sf-primary);
        color: #fff;
        border: none;
        border-radius: 10px;
        padding: 12px 20px;
        font-size: 0.875rem;
        font-weight: 700;
        cursor: pointer;
        display: flex; align-items: center; gap: 8px;
        min-height: 44px;
        width: 100%;
        justify-content: center;
        transition: opacity 0.15s;
      }
      .sf-btn-primary:hover { opacity: 0.85; }

      .sf-btn-ghost {
        background: transparent;
        color: var(--sf-text-muted);
        border: 1px solid var(--sf-border);
        border-radius: 10px;
        padding: 12px 20px;
        font-size: 0.875rem;
        font-weight: 600;
        cursor: pointer;
        display: flex; align-items: center; gap: 8px;
        min-height: 44px;
        width: 100%;
        justify-content: center;
        transition: border-color 0.15s, color 0.15s;
      }
      .sf-btn-ghost:hover {
        border-color: var(--sf-text-muted);
        color: var(--sf-text);
      }

      /* ── Cascade animations ─────────────────────────────────── */
      @keyframes sf-shake {
        0%,100% { transform: translateX(0); }
        15%  { transform: translateX(-6px); }
        30%  { transform: translateX( 6px); }
        45%  { transform: translateX(-5px); }
        60%  { transform: translateX( 5px); }
        75%  { transform: translateX(-3px); }
        90%  { transform: translateX( 3px); }
      }
      @keyframes sf-step-appear {
        from { opacity: 0; transform: translateY(5px); }
        to   { opacity: 1; transform: translateY(0);   }
      }
      @keyframes sf-new-stop-in {
        from { opacity: 0; transform: translateY(-14px); }
        to   { opacity: 1; transform: translateY(0);      }
      }
      @keyframes sf-toast-in {
        from { opacity: 0; transform: translateY(12px); }
        to   { opacity: 1; transform: translateY(0);    }
      }
      @keyframes sf-panel-in {
        from { opacity: 0; transform: translateY(40px); }
        to   { opacity: 1; transform: translateY(0);    }
      }
      @keyframes sf-error-pulse {
        0%,100% { box-shadow: 0 0 0 0 color-mix(in srgb, var(--sf-warning) 40%, transparent); }
        50%     { box-shadow: 0 0 0 6px color-mix(in srgb, var(--sf-warning) 0%, transparent); }
      }

      .sf-stop-shake { animation: sf-shake 0.55s cubic-bezier(.36,.07,.19,.97) both; }
      .sf-new-stop   { animation: sf-new-stop-in 0.45s cubic-bezier(0.25,1,0.5,1) forwards; }

      /* Responsive layout */
      .sf-itin-layout {
        display: flex;
        flex-direction: column;
        gap: 0;
      }
      .sf-itin-sidebar {
        /* mobile: show as top card */
        order: -1;
      }
      .sf-itin-main {
        flex: 1;
        min-width: 0;
      }

      @media (min-width: 768px) {
        .sf-itin-layout {
          flex-direction: row;
          align-items: flex-start;
          gap: 24px;
        }
        .sf-itin-sidebar {
          order: 1;
          width: 300px;
          flex-shrink: 0;
          position: sticky;
          top: 80px;
        }
        .sf-itin-main {
          order: 0;
        }
      }

      @media (min-width: 1024px) {
        .sf-itin-sidebar {
          width: 320px;
        }
      }

      /* Day route map (Leaflet) */
      .leaflet-div-icon.sf-map-pin {
        background: ${MAP_ROUTE_COLOR};
        border: 2px solid #fff;
        border-radius: 50%;
        box-shadow: 0 1px 4px rgba(0,0,0,0.35);
        display: flex;
        align-items: center;
        justify-content: center;
        color: #fff;
        font-size: 12px;
        font-weight: 700;
        font-family: var(--app-font-sans, sans-serif);
      }
      .leaflet-popup-content-wrapper {
        background: var(--sf-surface);
        color: var(--sf-text);
        border-radius: 10px;
      }
      .leaflet-popup-tip { background: var(--sf-surface); }
      .sf-map-popup { font-size: 0.8125rem; font-weight: 600; }
      html[dir="rtl"] .leaflet-popup-content { direction: rtl; text-align: right; }
      .sf-map-tile-error {
        position: absolute;
        top: 8px;
        left: 50%;
        transform: translateX(-50%);
        max-width: calc(100% - 24px);
        background: var(--sf-surface);
        color: var(--sf-text-muted);
        border: 1px solid var(--sf-border);
        border-radius: 8px;
        padding: 6px 12px;
        font-size: 0.75rem;
        text-align: center;
        box-shadow: 0 2px 8px rgba(0,0,0,0.15);
        z-index: 1000;
        pointer-events: none;
      }
    `;
    document.head.appendChild(s);
  }, []);
}

/* ── Prayer name map ────────────────────────────────────────────────── */
const PRAYER_NAMES: Record<string, { en: string; ar: string }> = {
  "12:00": { en: "Dhuhr",   ar: "الظهر"  },
  "15:30": { en: "Asr",     ar: "العصر"   },
  "18:00": { en: "Maghrib", ar: "المغرب" },
};

/* ── Category label map ─────────────────────────────────────────────── */
const CAT_KEY: Record<string, string> = {
  heritage:      "itin.cat.heritage",
  museum:        "itin.cat.museum",
  nature:        "itin.cat.nature",
  religion:      "itin.cat.religion",
  shopping:      "itin.cat.shopping",
  adventure:     "itin.cat.adventure",
  art:           "itin.cat.art",
  food:          "itin.cat.food",
  modern:        "itin.cat.modern",
  entertainment: "itin.cat.entertainment",
};

/* ── Slot color map ─────────────────────────────────────────────────── */
const SLOT_NODE_COLOR: Record<string, string> = {
  morning:   "var(--sf-accent)",
  midday:    "var(--sf-indigo)",
  afternoon: "var(--sf-accent)",
  evening:   "var(--sf-indigo)",
};

/* ── Objective labels (reuse gen keys) ──────────────────────────────── */
const OBJ_KEYS: (keyof Objectives)[] = ["culture", "hiddenGems", "food", "photography", "family", "budget"];
const OBJ_LABEL_KEYS: Record<string, string> = {
  culture:     "gen.obj.culture",
  budget:      "gen.obj.budget",
  hiddenGems:  "gen.obj.hiddenGems",
  food:        "gen.obj.food",
  family:      "gen.obj.family",
  photography: "gen.obj.photography",
};

/* ── Sub-components ─────────────────────────────────────────────────── */

function PrayerMarker({ time, language }: { time: string; language: string }) {
  const prayer = PRAYER_NAMES[time];
  const label  = prayer
    ? (language === "ar" ? `صلاة ${prayer.ar}` : `${prayer.en} prayer`)
    : (language === "ar" ? `استراحة صلاة · ${time}` : `Prayer break · ${time}`);

  return (
    <div style={{
      display:        "flex",
      alignItems:     "center",
      gap:            "8px",
      padding:        "10px 0",
      paddingInlineStart: "36px",
    }}>
      <Moon
        size={13}
        style={{ color: "var(--sf-text-muted)", flexShrink: 0 }}
        aria-hidden
      />
      <span style={{
        fontSize:      "0.6875rem",
        fontWeight:    600,
        color:         "var(--sf-text-muted)",
        letterSpacing: "0.04em",
        textTransform: "uppercase",
      }}>
        {label} · {time}
      </span>
    </div>
  );
}

function CategoryChip({ category, t }: { category: string; t: (k: string) => string }) {
  const label = t(CAT_KEY[category] ?? "itin.cat.heritage") || category;
  const COLOR_MAP: Record<string, string> = {
    heritage:      "var(--sf-accent)",
    museum:        "var(--sf-indigo)",
    nature:        "#34D399",
    religion:      "#A78BFA",
    shopping:      "#FB923C",
    adventure:     "#F59E0B",
    art:           "#EC4899",
    food:          "#F87171",
    modern:        "var(--sf-indigo)",
    entertainment: "#06B6D4",
  };
  const color = COLOR_MAP[category] ?? "var(--sf-accent)";
  return (
    <span style={{
      display:         "inline-flex",
      alignItems:      "center",
      padding:         "2px 8px",
      borderRadius:    "999px",
      fontSize:        "0.6875rem",
      fontWeight:      700,
      letterSpacing:   "0.05em",
      textTransform:   "uppercase",
      color,
      background:      `color-mix(in srgb, ${color} 12%, var(--sf-surface))`,
      border:          `1px solid color-mix(in srgb, ${color} 30%, transparent)`,
      flexShrink:      0,
    }}>
      {label}
    </span>
  );
}

function VerifiedBadge({ t }: { t: (k: string) => string }) {
  return (
    <span style={{
      display:       "inline-flex",
      alignItems:    "center",
      gap:           "4px",
      padding:       "3px 8px",
      borderRadius:  "999px",
      fontSize:      "0.6875rem",
      fontWeight:    700,
      color:         "var(--sf-accent)",
      background:    "color-mix(in srgb, var(--sf-accent) 12%, var(--sf-surface))",
      border:        "1px solid color-mix(in srgb, var(--sf-accent) 30%, transparent)",
      flexShrink:    0,
    }}>
      <CheckCircle2 size={11} aria-hidden />
      {t("itin.verified")}
    </span>
  );
}

/**
 * Shown instead of VerifiedBadge for authored entries. The place is real, but
 * its pin and price are estimates, and saying nothing at all would let the
 * absence of a badge read as an oversight rather than a statement.
 */
function EstimatedBadge({ t }: { t: (k: string) => string }) {
  return (
    <span
      title={t("itin.estimated.hint")}
      style={{
        display:       "inline-flex",
        alignItems:    "center",
        gap:           "4px",
        padding:       "3px 8px",
        borderRadius:  "999px",
        fontSize:      "0.6875rem",
        fontWeight:    700,
        color:         "var(--sf-text-muted)",
        background:    "var(--sf-surface-alt)",
        border:        "1px solid var(--sf-border)",
        flexShrink:    0,
      }}
    >
      <AlertTriangle size={11} aria-hidden />
      {t("itin.estimated")}
    </span>
  );
}

function SafeBadge({ t }: { t: (k: string) => string }) {
  return (
    <span style={{
      display:       "inline-flex",
      alignItems:    "center",
      gap:           "4px",
      padding:       "3px 8px",
      borderRadius:  "999px",
      fontSize:      "0.6875rem",
      fontWeight:    700,
      color:         "var(--sf-success)",
      background:    "color-mix(in srgb, var(--sf-success) 12%, var(--sf-surface-alt))",
      border:        "1px solid color-mix(in srgb, var(--sf-success) 25%, transparent)",
      flexShrink:    0,
    }}>
      <CheckCircle2 size={11} aria-hidden />
      {t("itin.safe")}
    </span>
  );
}

function HiddenGemPip({ t }: { t: (k: string) => string }) {
  return (
    <span style={{
      display:       "inline-flex",
      alignItems:    "center",
      gap:           "4px",
      padding:       "2px 8px",
      borderRadius:  "999px",
      fontSize:      "0.6875rem",
      fontWeight:    700,
      color:         "#A78BFA",
      background:    "color-mix(in srgb, #A78BFA 12%, var(--sf-surface))",
      border:        "1px solid color-mix(in srgb, #A78BFA 25%, transparent)",
      flexShrink:    0,
    }}>
      <Gem size={10} aria-hidden />
      {t("itin.hidden_gem")}
    </span>
  );
}

function TimelineNode({ color }: { color: string }) {
  return (
    <div
      aria-hidden
      style={{
        width:        "24px",
        height:       "24px",
        borderRadius: "50%",
        background:   color,
        flexShrink:   0,
        position:     "relative",
        zIndex:       1,
        boxShadow:    `0 0 0 3px var(--sf-bg), 0 0 0 4px ${color}33`,
        alignSelf:    "flex-start",
        marginBlockStart: "0px",
      }}
    />
  );
}

function StopCard({
  stop, t, language,
  cascadePhase, closedPoiId, replacementPoiId,
  onPhotoClick,
}: {
  stop: ItineraryStop;
  t: (k: string) => string;
  language: string;
  cascadePhase?: CascadePhase;
  closedPoiId?: string | null;
  replacementPoiId?: string | null;
  onPhotoClick?: () => void;
}) {
  const { poi } = stop;
  const [isFav, setIsFav] = useState(() => isFavoritePoi("poi", poi.id));

  const isClosed      = !!closedPoiId && poi.id === closedPoiId &&
                        (cascadePhase === "closed" || cascadePhase === "feeding");
  const isReplacement = !!replacementPoiId && poi.id === replacementPoiId &&
                        cascadePhase === "replanned";

  return (
    <div
      style={{ display: "flex", gap: "12px", alignItems: "flex-start", paddingBlock: "6px" }}
      className={isReplacement ? "sf-new-stop" : ""}
    >
      <TimelineNode color={
        isClosed ? "var(--sf-warning)" : (SLOT_NODE_COLOR[stop.slot] ?? "var(--sf-accent)")
      } />

      <div
        className={`sf-stop-card${isClosed ? " sf-stop-shake" : ""}`}
        style={{
          flex: 1, minWidth: 0,
          ...(isClosed ? {
            borderColor: "color-mix(in srgb, var(--sf-warning) 45%, transparent)",
            boxShadow:   "0 0 0 2px color-mix(in srgb, var(--sf-warning) 15%, transparent)",
          } : {}),
        }}
      >
        {/* Time row */}
        <div style={{
          fontSize:      "0.6875rem",
          fontWeight:    600,
          color:         "var(--sf-text-muted)",
          marginBottom:  "6px",
          letterSpacing: "0.04em",
        }}>
          {stop.startTime} – {stop.endTime}
        </div>

        {/* Name */}
        <div style={{ marginBottom: "8px", display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 8 }}>
          <span style={{
            fontSize:   "1rem",
            fontWeight: 700,
            color:      isClosed ? "var(--sf-warning)" : "var(--sf-text)",
            lineHeight: 1.3,
          }}>
            {poiName(t, poi)}
          </span>
          {!isClosed && (
            <button
              type="button"
              aria-label={t(isFav ? "itinerary.stop.unfavorite" : "itinerary.stop.favorite")}
              aria-pressed={isFav}
              onClick={() => setIsFav(toggleFavoritePoi("poi", poi.id))}
              style={{
                display: "flex", alignItems: "center", justifyContent: "center",
                width: 32, height: 32, flexShrink: 0, borderRadius: 8,
                border: "none", background: "transparent", cursor: "pointer",
                color: isFav ? "var(--sf-warning)" : "var(--sf-text-muted)",
              }}
            >
              <Heart size={18} fill={isFav ? "currentColor" : "none"} aria-hidden />
            </button>
          )}
        </div>

        {/* Badges row */}
        <div style={{
          display:      "flex",
          flexWrap:     "wrap",
          gap:          "6px",
          marginBottom: "10px",
        }}>
          <CategoryChip category={poi.category} t={t} />
          {isClosed      && <ErrorChip label={t("cascade.closed_chip")} />}
          {isReplacement && <ReplanBadge label={t("cascade.replanned_badge")} />}
          {!isClosed && !isReplacement && (
            isVerified(stop.poi) ? <VerifiedBadge t={t} /> : <EstimatedBadge t={t} />
          )}
          {poi.hidden_gem && !isClosed && <HiddenGemPip t={t} />}
        </div>

        {/* Culture note */}
        {poi.culture_note && !isClosed && (
          <p style={{
            fontSize:     "0.8125rem",
            color:        "var(--sf-text-muted)",
            lineHeight:   1.65,
            marginBottom: "12px",
          }}>
            {poiCulture(t, poi)}
          </p>
        )}

        {/* Action row: Photos button + Maps link */}
        {!isClosed && (
          <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
            {onPhotoClick && (
              <button
                type="button"
                onClick={onPhotoClick}
                style={{
                  display: "inline-flex", alignItems: "center", gap: 5,
                  padding: "5px 11px", borderRadius: 8,
                  border: "1.5px solid var(--sf-border)",
                  background: "var(--sf-surface-alt)",
                  color: "var(--sf-text-muted)", cursor: "pointer",
                  fontSize: "0.8125rem", fontWeight: 600,
                  transition: "border-color .15s, color .15s",
                }}
                onMouseEnter={e => {
                  e.currentTarget.style.borderColor = "var(--sf-indigo)";
                  e.currentTarget.style.color = "var(--sf-text)";
                }}
                onMouseLeave={e => {
                  e.currentTarget.style.borderColor = "var(--sf-border)";
                  e.currentTarget.style.color = "var(--sf-text-muted)";
                }}
              >
                <Camera size={12} aria-hidden />
                {t("itin.photos.button")}
              </button>
            )}
            {poi.map_url && (
              <a
                href={poi.map_url}
                target="_blank"
                rel="noopener noreferrer"
                className="sf-maps-link"
              >
                <MapPin size={12} aria-hidden />
                {t("itin.maps")}
                <ExternalLink size={11} aria-hidden style={{ opacity: 0.7 }} />
              </a>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function MealCard({
  meal, t, language, onPhotoClick,
}: {
  meal: ItineraryMeal;
  t: (k: string) => string;
  language: string;
  onPhotoClick?: () => void;
}) {
  const { dish } = meal;
  const mealLabel = meal.type === "lunch" ? t("itin.lunch") : t("itin.dinner");
  const dishDisplayName = dishName(t, dish);
  const venueText = mealVenue(meal, language);
  const areaText  = mealArea(meal, language);

  return (
    <div style={{ display: "flex", gap: "12px", alignItems: "flex-start", paddingBlock: "6px" }}>
      {/* Meal node — softer */}
      <div
        aria-hidden
        style={{
          width:        "24px",
          height:       "24px",
          borderRadius: "50%",
          background:   "var(--sf-surface-alt)",
          border:       "2px solid var(--sf-border)",
          flexShrink:   0,
          display:      "flex",
          alignItems:   "center",
          justifyContent: "center",
          position:     "relative",
          zIndex:       1,
          boxShadow:    "0 0 0 3px var(--sf-bg)",
        }}
      >
        <Utensils size={11} style={{ color: "var(--sf-text-muted)" }} />
      </div>

      <div className="sf-meal-card" style={{ flex: 1, minWidth: 0 }}>
        {/* Meal time + type row */}
        <div style={{
          display:      "flex",
          alignItems:   "center",
          gap:          "8px",
          marginBottom: "6px",
          flexWrap:     "wrap",
        }}>
          <span style={{
            fontSize:    "0.6875rem",
            fontWeight:  600,
            color:       "var(--sf-text-muted)",
            letterSpacing: "0.04em",
          }}>
            {meal.estimatedTime} · {mealLabel}
          </span>
          <SafeBadge t={t} />
        </div>

        {/* Dish name */}
        <div style={{
          fontSize:    "0.9375rem",
          fontWeight:  700,
          color:       "var(--sf-text)",
          marginBottom: "4px",
        }}>
          {dishDisplayName}
          {/* Show Arabic script alongside when viewing in a non-Arabic language */}
          {language !== "ar" && dish.name_ar && (
            <span style={{ fontWeight: 400, fontSize: "0.8125rem", color: "var(--sf-text-muted)", marginInlineStart: "6px" }}>
              {dish.name_ar}
            </span>
          )}
          {/* Show English romanisation alongside Arabic */}
          {language === "ar" && dish.name_ar && dish.name_ar !== dish.name && (
            <span style={{ fontWeight: 400, fontSize: "0.8125rem", color: "var(--sf-text-muted)", marginInlineStart: "6px" }}>
              {dish.name}
            </span>
          )}
        </div>

        {/* Description */}
        <p style={{
          fontSize:    "0.8125rem",
          color:       "var(--sf-text-muted)",
          lineHeight:  1.55,
          marginBottom: "6px",
        }}>
          {dishDesc(t, dish)}
        </p>

        {/* Venue + area — every meal must be actionable, not just a dish name */}
        {venueText && areaText ? (
          <p style={{
            display:      "flex",
            alignItems:   "center",
            gap:          "6px",
            fontSize:     "0.8125rem",
            color:        "var(--sf-text-muted)",
            lineHeight:   1.5,
            marginBottom: "6px",
          }}>
            <MapPin size={12} aria-hidden style={{ flexShrink: 0, opacity: 0.7 }} />
            <span>{venueText} · {areaText}</span>
          </p>
        ) : (
          <p style={{
            fontSize:     "0.8125rem",
            color:        "var(--sf-text-muted)",
            fontStyle:    "italic",
            marginBottom: "6px",
          }}>
            {t("itin.meal.venue_pending")}
          </p>
        )}

        {/* Price + action row */}
        <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
          <span style={{
            fontSize:    "0.8125rem",
            fontWeight:  700,
            color:       "var(--sf-text)",
          }}>
            {t("itin.summary.sar")} {dish.price_sar}
          </span>
          {meal.mapUrl && (
            <a
              href={meal.mapUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="sf-maps-link"
            >
              <MapPin size={12} aria-hidden />
              {t("itin.maps")}
              <ExternalLink size={11} aria-hidden style={{ opacity: 0.7 }} />
            </a>
          )}
          {onPhotoClick && (
            <button
              type="button"
              onClick={onPhotoClick}
              style={{
                display: "inline-flex", alignItems: "center", gap: 5,
                padding: "5px 11px", borderRadius: 8,
                border: "1.5px solid var(--sf-border)",
                background: "var(--sf-surface-alt)",
                color: "var(--sf-text-muted)", cursor: "pointer",
                fontSize: "0.8125rem", fontWeight: 600,
                transition: "border-color .15s, color .15s",
              }}
              onMouseEnter={e => {
                e.currentTarget.style.borderColor = "var(--sf-indigo)";
                e.currentTarget.style.color = "var(--sf-text)";
              }}
              onMouseLeave={e => {
                e.currentTarget.style.borderColor = "var(--sf-border)";
                e.currentTarget.style.color = "var(--sf-text-muted)";
              }}
            >
              <Camera size={12} aria-hidden />
              {t("itin.photos.button")}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

/* ── Cascade sub-components ─────────────────────────────────────────── */

function ErrorChip({ label }: { label: string }) {
  return (
    <span style={{
      display:     "inline-flex",
      alignItems:  "center",
      gap:         "4px",
      padding:     "3px 8px",
      borderRadius:"999px",
      fontSize:    "0.6875rem",
      fontWeight:  700,
      color:       "var(--sf-warning)",
      background:  "color-mix(in srgb, var(--sf-warning) 14%, var(--sf-surface))",
      border:      "1px solid color-mix(in srgb, var(--sf-warning) 35%, transparent)",
      flexShrink:  0,
      animation:   "sf-error-pulse 1.4s ease-in-out infinite",
    }}>
      <AlertTriangle size={10} aria-hidden />
      {label}
    </span>
  );
}

function ReplanBadge({ label }: { label: string }) {
  return (
    <span style={{
      display:     "inline-flex",
      alignItems:  "center",
      gap:         "4px",
      padding:     "3px 8px",
      borderRadius:"999px",
      fontSize:    "0.6875rem",
      fontWeight:  700,
      color:       "var(--sf-accent)",
      background:  "color-mix(in srgb, var(--sf-accent) 14%, var(--sf-surface))",
      border:      "1px solid color-mix(in srgb, var(--sf-accent) 35%, transparent)",
      flexShrink:  0,
    }}>
      ✦ {label}
    </span>
  );
}

function SwappedStub({ poiName, t, language }: { poiName: string; t: (k:string)=>string; language: string }) {
  return (
    <div style={{
      display:   "flex",
      gap:       "12px",
      alignItems:"flex-start",
      paddingBlock: "4px",
      opacity:   0.55,
    }}>
      <div style={{
        width:"24px", height:"24px", borderRadius:"50%",
        background:"var(--sf-surface-alt)",
        border:"2px dashed var(--sf-border)",
        flexShrink:0, zIndex:1,
        boxShadow:"0 0 0 3px var(--sf-bg)",
      }} aria-hidden />
      <div style={{
        flex:1, minWidth:0,
        background:"var(--sf-surface-alt)",
        border:"1px dashed var(--sf-border)",
        borderRadius:"10px",
        padding:"10px 14px",
        display:"flex", alignItems:"center", gap:"8px",
      }}>
        <X size={13} style={{color:"var(--sf-warning)", flexShrink:0}} aria-hidden />
        <span style={{
          fontSize:"0.8125rem", fontWeight:600,
          color:"var(--sf-text-muted)",
          textDecoration:"line-through",
        }}>
          {poiName}
        </span>
        <span style={{
          fontSize:"0.6875rem", fontWeight:700,
          color:"var(--sf-warning)",
          marginInlineStart:"auto", whiteSpace:"nowrap",
        }}>
          {t("cascade.swapped")}
        </span>
      </div>
    </div>
  );
}

/* ── Agent feed panel ───────────────────────────────────────────────── */
interface AgentFeedPanelProps {
  info: CascadeInfo;
  t:   (k: string) => string;
  language: string;
}

const AGENT_STEPS = [
  {
    key: "safety",
    iconEl: ShieldAlert,
    nameKey: "cascade.name.safety",
    msgFn: (info: CascadeInfo, t: (k:string)=>string) =>
      t("cascade.agent.safety").replace("{poi}", info.closedPoiName),
  },
  {
    key: "discovery",
    iconEl: Compass,
    nameKey: "cascade.name.discovery",
    msgFn: (info: CascadeInfo, t: (k:string)=>string) =>
      t("cascade.agent.discovery").replace("{alt1}", info.altName1).replace("{alt2}", info.altName2),
  },
  {
    key: "transport",
    iconEl: Navigation,
    nameKey: "cascade.name.transport",
    msgFn: (info: CascadeInfo, t: (k:string)=>string) =>
      t("cascade.agent.transport").replace("{n}", String(info.reorderedCount)),
  },
  {
    key: "budget",
    iconEl: Wallet,
    nameKey: "cascade.name.budget",
    msgFn: (info: CascadeInfo, t: (k:string)=>string) =>
      t("cascade.agent.budget").replace("{cost}", String(info.newDailyCost)),
  },
  {
    key: "restaurant",
    iconEl: Utensils,
    nameKey: "cascade.name.restaurant",
    msgFn: (info: CascadeInfo, t: (k:string)=>string) =>
      info.shiftedLunch
        ? t("cascade.agent.restaurant").replace("{time}", info.shiftedLunch)
        : t("cascade.agent.restaurant_no_shift"),
  },
] as const;

function AgentFeedPanel({ info, t, language }: AgentFeedPanelProps) {
  const visible = AGENT_STEPS.slice(0, info.feedStep);
  return (
    <div
      role="status"
      aria-label={t("cascade.panel.title")}
      style={{
        position:     "fixed",
        insetBlockEnd:  "90px",
        insetInlineStart: "50%",
        transform:    "translateX(-50%)",
        width:        "min(420px, calc(100vw - 32px))",
        background:   "var(--sf-surface)",
        border:       "1px solid var(--sf-border)",
        borderRadius: "16px",
        padding:      "16px",
        zIndex:       200,
        boxShadow:    "0 8px 40px rgba(0,0,0,0.28)",
        animation:    "sf-panel-in 0.35s cubic-bezier(0.25,1,0.5,1) both",
      }}
    >
      {/* Header */}
      <div style={{
        display:"flex", alignItems:"center", gap:"8px",
        marginBottom:"12px",
        paddingBottom:"10px",
        borderBottom:"1px solid var(--sf-border)",
      }}>
        <span style={{
          width:"8px", height:"8px", borderRadius:"50%",
          background:"var(--sf-accent)",
          boxShadow:"0 0 6px var(--sf-accent)",
          flexShrink:0,
          animation: info.phase === "feeding" ? "sf-error-pulse 1s ease-in-out infinite" : "none",
        }} aria-hidden />
        <span style={{
          fontSize:"0.8125rem", fontWeight:700, color:"var(--sf-text)",
        }}>
          {t("cascade.panel.title")}
        </span>
        <span style={{
          marginInlineStart:"auto",
          fontSize:"0.6875rem", fontWeight:600,
          color:"var(--sf-text-muted)",
        }}>
          {info.feedStep} / {AGENT_STEPS.length}
        </span>
      </div>

      {/* Agent rows */}
      <div style={{ display:"flex", flexDirection:"column", gap:"8px" }}>
        {visible.map((step, i) => {
          const Icon = step.iconEl;
          return (
            <div
              key={step.key}
              style={{
                display:"flex", alignItems:"flex-start", gap:"10px",
                animation:"sf-step-appear 0.3s ease both",
                animationDelay:`${i * 0.04}s`,
              }}
            >
              <div style={{
                width:"28px", height:"28px", borderRadius:"8px",
                background:"color-mix(in srgb, var(--sf-indigo) 14%, var(--sf-surface-alt))",
                display:"flex", alignItems:"center", justifyContent:"center",
                flexShrink:0,
              }}>
                <Icon size={13} style={{ color:"var(--sf-indigo)" }} aria-hidden />
              </div>
              <div style={{ flex:1, minWidth:0 }}>
                <div style={{ fontSize:"0.6875rem", fontWeight:700, color:"var(--sf-text-muted)", letterSpacing:"0.04em" }}>
                  {t(step.nameKey)}
                </div>
                <div style={{ fontSize:"0.8125rem", color:"var(--sf-text)", lineHeight:1.4, marginTop:"1px", wordBreak:"break-word" }}>
                  {step.msgFn(info, t)}
                </div>
              </div>
              <span style={{
                fontSize:"0.625rem", fontWeight:700,
                color:"var(--sf-accent)",
                background:"color-mix(in srgb, var(--sf-accent) 12%, var(--sf-surface))",
                padding:"2px 6px", borderRadius:"999px",
                alignSelf:"center", flexShrink:0,
              }}>
                ✓
              </span>
            </div>
          );
        })}
        {/* Typing indicator for next pending step */}
        {info.feedStep < AGENT_STEPS.length && (
          <div style={{ display:"flex", alignItems:"center", gap:"6px", paddingInlineStart:"4px", opacity:0.5 }}>
            {[0,1,2].map(i => (
              <span key={i} style={{
                width:"5px", height:"5px", borderRadius:"50%",
                background:"var(--sf-text-muted)",
                display:"inline-block",
                animation:`sf-shake 1.2s ease-in-out ${i*0.2}s infinite`,
              }} aria-hidden />
            ))}
            <span style={{ fontSize:"0.6875rem", color:"var(--sf-text-muted)" }}>
              {t("cascade.panel.thinking")}
            </span>
          </div>
        )}
      </div>
    </div>
  );
}

/* ── Replan toast ───────────────────────────────────────────────────── */
function ReplanToast({
  poiName, t, language, onUndo, onDismiss,
}: {
  poiName: string;
  t: (k:string) => string;
  language: string;
  onUndo: () => void;
  onDismiss: () => void;
}) {
  return (
    <div
      role="status"
      aria-live="polite"
      aria-atomic="true"
      style={{
        position:     "fixed",
        insetBlockEnd:  "100px",
        insetInlineStart: "50%",
        transform:    "translateX(-50%)",
        width:        "min(380px, calc(100vw - 32px))",
        background:   "var(--sf-surface)",
        border:       "1px solid var(--sf-border)",
        borderRadius: "14px",
        padding:      "14px 16px",
        zIndex:       300,
        boxShadow:    "0 8px 40px rgba(0,0,0,0.32)",
        animation:    "sf-toast-in 0.3s cubic-bezier(0.25,1,0.5,1) both",
        display:      "flex",
        alignItems:   "center",
        gap:          "10px",
      }}
    >
      <div style={{
        width:"32px", height:"32px", borderRadius:"50%",
        background:"color-mix(in srgb, var(--sf-accent) 14%, var(--sf-surface-alt))",
        display:"flex", alignItems:"center", justifyContent:"center",
        flexShrink:0,
      }}>
        <CheckCircle2 size={16} style={{ color:"var(--sf-accent)" }} aria-hidden />
      </div>
      <p style={{ flex:1, fontSize:"0.8125rem", color:"var(--sf-text)", lineHeight:1.4, margin:0 }}>
        {t("cascade.toast.msg").replace("{poi}", poiName)}
      </p>
      <div style={{ display:"flex", gap:"6px", flexShrink:0 }}>
        <button
          onClick={onUndo}
          style={{
            padding:      "7px 12px",
            borderRadius: "8px",
            border:       "1px solid var(--sf-border)",
            background:   "transparent",
            color:        "var(--sf-text)",
            fontSize:     "0.75rem",
            fontWeight:   700,
            cursor:       "pointer",
            minHeight:    "36px",
            whiteSpace:   "nowrap",
          }}
        >
          {t("cascade.toast.undo")}
        </button>
        <button
          onClick={onDismiss}
          aria-label={t("cascade.toast.dismiss")}
          style={{
            width:"32px", height:"32px",
            borderRadius:"50%",
            border:"none",
            background:"var(--sf-surface-alt)",
            color:"var(--sf-text-muted)",
            display:"flex", alignItems:"center", justifyContent:"center",
            cursor:"pointer",
            flexShrink:0,
          }}
        >
          <X size={14} aria-hidden />
        </button>
      </div>
    </div>
  );
}

/* ── Day timeline ───────────────────────────────────────────────────── */
function DayTimeline({
  day, t, language,
  cascadePhase, closedPoiId, closedPoiName, replacementPoiId,
  onPhotoClick, onMealPhotoClick,
}: {
  day: ItineraryDay;
  t: (k: string) => string;
  language: string;
  cascadePhase?: CascadePhase;
  closedPoiId?: string | null;
  closedPoiName?: string;
  replacementPoiId?: string | null;
  onPhotoClick?: (poi: RawPoi) => void;
  onMealPhotoClick?: (meal: ItineraryMeal) => void;
}) {
  // Build interleaved items: prayer markers + stops + meals in time order
  type Item =
    | { kind: "stop"; stop: ItineraryStop; prayer: string | null }
    | { kind: "meal"; meal: ItineraryMeal };

  const items: Item[] = [];

  // In "replanned" phase the day already has the replacement stop.
  // In "closed"/"feeding" the original day is shown (closed stop still visible with error).
  const sortedStops = [...day.stops].sort((a, b) =>
    a.startTime.localeCompare(b.startTime)
  );

  const sortedMeals = [...day.meals].sort((a, b) =>
    a.estimatedTime.localeCompare(b.estimatedTime)
  );

  let mealIdx = 0;
  for (const stop of sortedStops) {
    while (
      mealIdx < sortedMeals.length &&
      sortedMeals[mealIdx].estimatedTime < stop.startTime
    ) {
      items.push({ kind: "meal", meal: sortedMeals[mealIdx] });
      mealIdx++;
    }
    items.push({ kind: "stop", stop, prayer: stop.prayerGapBefore });
  }
  while (mealIdx < sortedMeals.length) {
    items.push({ kind: "meal", meal: sortedMeals[mealIdx] });
    mealIdx++;
  }

  return (
    <div className="sf-tl-track" style={{ paddingBlock: "8px" }}>
      {/* Swapped stub — shown at top of track after replanning */}
      {cascadePhase === "replanned" && closedPoiId && closedPoiName && (
        <SwappedStub poiName={closedPoiName} t={t} language={language} />
      )}

      {items.map((item, idx) => {
        if (item.kind === "stop") {
          return (
            <div key={`stop-${item.stop.poi.id}-${idx}`}>
              {item.prayer && (
                <PrayerMarker time={item.prayer} language={language} />
              )}
              <StopCard
                stop={item.stop}
                t={t}
                language={language}
                cascadePhase={cascadePhase}
                closedPoiId={closedPoiId}
                replacementPoiId={replacementPoiId}
                onPhotoClick={onPhotoClick
                  ? () => onPhotoClick(item.stop.poi as unknown as RawPoi)
                  : undefined}
              />
            </div>
          );
        }
        return (
          <MealCard
            key={`meal-${idx}`} meal={item.meal} t={t} language={language}
            onPhotoClick={onMealPhotoClick ? () => onMealPhotoClick(item.meal) : undefined}
          />
        );
      })}
    </div>
  );
}

/* ── Summary sidebar ────────────────────────────────────────────────── */
function ObjBar({
  label, value, mounted,
}: {
  label: string;
  value: number;
  mounted: boolean;
}) {
  return (
    <div style={{ marginBottom: "10px" }}>
      <div style={{
        display:        "flex",
        justifyContent: "space-between",
        marginBottom:   "5px",
        fontSize:       "0.75rem",
        color:          "var(--sf-text-muted)",
      }}>
        <span style={{ fontWeight: 600, textTransform: "capitalize" }}>{label}</span>
        <span style={{ color: "var(--sf-indigo)", fontWeight: 700 }}>
          {Math.round(value * 100)}%
        </span>
      </div>
      <div style={{
        height:       "4px",
        background:   "var(--sf-surface-alt)",
        borderRadius: "4px",
        overflow:     "hidden",
      }}>
        <div
          className="sf-obj-bar"
          style={{ width: mounted ? `${Math.round(value * 100)}%` : "0%" }}
        />
      </div>
    </div>
  );
}

function TripSummary({
  result, trip, t, onRegen, onEdit, onConfirm, language,
}: {
  result: ItineraryResult;
  trip: TripSpec;
  t: (k: string) => string;
  onRegen: () => void;
  onEdit: () => void;
  onConfirm: () => void;
  language: string;
}) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    const id = setTimeout(() => setMounted(true), 80);
    return () => clearTimeout(id);
  }, []);

  const [confirmed, setConfirmed] = useState(() => {
    try {
      const raw = localStorage.getItem("safarly_ongoing_trip");
      if (!raw) return false;
      const saved = JSON.parse(raw);
      return saved?.trip?.city === trip.city &&
             saved?.trip?.dateStart === trip.dateStart;
    } catch { return false; }
  });

  function handleConfirmClick() {
    onConfirm();
    setConfirmed(true);
  }

  const totalStops = result.days.reduce((s, d) => s + d.stops.length, 0);
  const gemCount   = Math.round(result.hiddenGemShare * totalStops);
  const overBudget = result.budgetStatus === "over";
  const budgetPct  = Math.min(1, result.estimatedDailyAvg / trip.budget);

  const sortedObj = OBJ_KEYS
    .map(k => ({ key: k, val: result.objectives[k] }))
    .sort((a, b) => b.val - a.val);

  const cityDisplay = language === "ar"
    ? (CITY_NAMES_AR[trip.city] ?? result.cityName)
    : result.cityName;

  const daysLabel = t("itin.days_summary")
    .replace("{n}", String(result.days.length))
    .replace("{city}", cityDisplay);

  return (
    <div style={{
      background:   "var(--sf-surface)",
      border:       "1px solid var(--sf-border)",
      borderRadius: "14px",
      padding:      "20px",
      display:      "flex",
      flexDirection: "column",
      gap:          "20px",
    }}>
      {/* Title */}
      <div>
        <h2 style={{
          fontSize:    "0.9375rem",
          fontWeight:  800,
          color:       "var(--sf-text)",
          marginBottom: "4px",
        }}>
          {t("itin.summary.title")}
        </h2>
        <p style={{ fontSize: "0.75rem", color: "var(--sf-text-muted)" }}>
          {daysLabel}
        </p>
      </div>

      {/* Objective bars */}
      <div>
        <p style={{
          fontSize:    "0.6875rem",
          fontWeight:  700,
          letterSpacing: "0.06em",
          textTransform: "uppercase",
          color:       "var(--sf-text-muted)",
          marginBottom: "12px",
        }}>
          {t("itin.summary.objectives")}
        </p>
        {sortedObj.map(({ key, val }) => (
          <ObjBar
            key={key}
            label={t(OBJ_LABEL_KEYS[key])}
            value={val}
            mounted={mounted}
          />
        ))}
      </div>

      {/* Cost vs budget */}
      <div>
        <div style={{
          display:        "flex",
          justifyContent: "space-between",
          marginBottom:   "6px",
          fontSize:       "0.75rem",
        }}>
          <span style={{ color: "var(--sf-text-muted)", fontWeight: 600 }}>
            {t("itin.summary.cost")}
          </span>
          <span style={{
            fontWeight: 700,
            color: overBudget ? "var(--sf-warning)" : "var(--sf-success)",
          }}>
            {t("itin.summary.sar")} {result.totalCostSar.toLocaleString()}
          </span>
        </div>
        <div style={{
          height:       "6px",
          background:   "var(--sf-surface-alt)",
          borderRadius: "4px",
          overflow:     "hidden",
        }}>
          <div style={{
            height:     "100%",
            borderRadius: "4px",
            background: overBudget ? "var(--sf-warning)" : "var(--sf-success)",
            width:      mounted ? `${Math.round(budgetPct * 100)}%` : "0%",
            transition: "width 0.75s cubic-bezier(0.25, 1, 0.5, 1)",
          }} />
        </div>
        <div style={{
          marginTop:   "5px",
          fontSize:    "0.6875rem",
          color:       overBudget ? "var(--sf-warning)" : "var(--sf-text-muted)",
          textAlign:   "end",
          fontWeight:  600,
        }}>
          {t("itin.summary.budget")}: {t("itin.summary.sar")} {trip.budget}/
          {language === "ar" ? "يوم" : "day"}
          {overBudget && (
            <span style={{ marginInlineStart: "6px", color: "var(--sf-warning)" }}>
              · {t("itin.summary.over")}
            </span>
          )}
        </div>
      </div>

      {/* Stats row */}
      <div style={{
        display:     "grid",
        gridTemplateColumns: "1fr 1fr",
        gap:         "12px",
      }}>
        {[
          { label: t("itin.summary.stops"), val: totalStops },
          { label: t("itin.summary.gems"),  val: gemCount },
        ].map(({ label, val }) => (
          <div key={label} style={{
            background:   "var(--sf-surface-alt)",
            borderRadius: "10px",
            padding:      "12px",
            textAlign:    "center",
          }}>
            <div style={{
              fontSize:  "1.375rem",
              fontWeight: 800,
              color:     "var(--sf-text)",
            }}>
              {val}
            </div>
            <div style={{
              fontSize: "0.6875rem",
              color:    "var(--sf-text-muted)",
              fontWeight: 600,
              marginTop: "2px",
            }}>
              {label}
            </div>
          </div>
        ))}
      </div>

      {/* Actions */}
      <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>

        {/* Confirm Trip — primary green CTA */}
        {!confirmed ? (
          <button
            onClick={handleConfirmClick}
            style={{
              display: "flex", alignItems: "center", justifyContent: "center",
              gap: 8, minHeight: 44, borderRadius: 8, border: "none",
              background: "var(--sf-accent)", color: "#0A0E16",
              fontWeight: 700, fontSize: "0.9375rem", cursor: "pointer",
              transition: "background .18s",
            }}
            onMouseEnter={e => (e.currentTarget.style.background = "var(--sf-accent-hover)")}
            onMouseLeave={e => (e.currentTarget.style.background = "var(--sf-accent)")}
          >
            <CheckCircle2 size={16} aria-hidden />
            {t("itin.confirm.btn")}
          </button>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            <div style={{
              display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
              minHeight: 44, borderRadius: 8,
              background: "color-mix(in srgb, var(--sf-success) 14%, var(--sf-surface))",
              border: "1.5px solid var(--sf-success)",
              color: "var(--sf-success)", fontWeight: 700, fontSize: "0.875rem",
            }}>
              <CheckCircle2 size={15} aria-hidden />
              {t("itin.confirm.done")}
            </div>
            <a
              href="/dashboard"
              style={{
                display: "flex", alignItems: "center", justifyContent: "center",
                gap: 6, minHeight: 38, borderRadius: 8,
                border: "1px solid var(--sf-border)",
                background: "var(--sf-surface-alt)",
                color: "var(--sf-text)", fontWeight: 600, fontSize: "0.875rem",
                textDecoration: "none", transition: "border-color .18s",
              }}
              onMouseEnter={e => ((e.currentTarget as HTMLElement).style.borderColor = "var(--sf-indigo)")}
              onMouseLeave={e => ((e.currentTarget as HTMLElement).style.borderColor = "var(--sf-border)")}
            >
              {t("itin.confirm.goto")} →
            </a>
          </div>
        )}

        <button className="sf-btn-primary" onClick={onRegen}>
          <RotateCcw size={15} aria-hidden />
          {t("itin.regen")}
        </button>
        <button className="sf-btn-ghost" onClick={onEdit}>
          <ArrowLeft size={15} aria-hidden style={{ transform: "var(--sf-dir-flip, none)" }} />
          {t("itin.edit")}
        </button>
      </div>
    </div>
  );
}

/* ── Photo modal ────────────────────────────────────────────────────────
   Neither @workspace/poi-data nor docs/research-data/ carries any image
   field for POIs or dishes, and the app has no backend/image API — so
   there is no real photo to fetch or embed. Embedding a third-party image
   search result would also fail: engines that serve the actual photos
   (Google/Bing Images) send X-Frame-Options/CSP headers that block iframe
   embedding, so there's no reliable way to show the pictures *inside* the
   app without a backend to proxy them.

   The pragmatic no-backend fix: this used to render three gradient tiles
   captioned "Photo 1 of 3" that never corresponded to any real image of
   the place — replaced here with a link that opens a real image search for
   the subject's proper name in a new tab, the same pattern already used
   for the "Open in Maps" link below it. */
const CATEGORY_ICONS: Record<string, string> = {
  heritage: "🏛️", museum: "🏺", nature: "🌿", culture: "🕌",
  food: "🍽️", shopping: "🛍️", park: "🌳", beach: "🏖️",
};

function imageSearchUrl(query: string): string {
  return `https://www.google.com/search?tbm=isch&q=${encodeURIComponent(query)}`;
}

interface PhotoSubject {
  title: string;
  icon: string;
  category?: string;
  searchUrl: string;
  mapUrl?: string;
}

function poiPhotoSubject(t: (k: string) => string, poi: RawPoi): PhotoSubject {
  const title = poiName(t, poi);
  const cityLabel = resolve(t, `trip.city.${poi.city}.title`, poi.city);
  return {
    title,
    icon: CATEGORY_ICONS[poi.category] ?? "📍",
    category: poi.category,
    searchUrl: imageSearchUrl(`${title}, ${cityLabel}, Saudi Arabia`),
    mapUrl: poi.map_url,
  };
}

function dishPhotoSubject(t: (k: string) => string, meal: ItineraryMeal, language: string): PhotoSubject {
  const title = dishName(t, meal.dish);
  const venue = mealVenue(meal, language);
  const area  = mealArea(meal, language);
  const query = [title, venue, area, "Saudi Arabian food"].filter(Boolean).join(", ");
  return {
    title,
    icon: "🍽️",
    searchUrl: imageSearchUrl(query),
  };
}

function PhotoModal({ subject, onClose }: { subject: PhotoSubject; onClose: () => void }) {
  const { t } = useTranslation();
  const dialogLabel = resolve(t, "itin.photos.dialog_label", "Photos of {name}").replace("{name}", subject.title);
  const viewLabel   = resolve(t, "itin.photos.view_button",  "View photos").replace("{name}", subject.title);
  const viewAria    = resolve(t, "itin.photos.view_aria",    "View photos of {name} (opens in a new tab)").replace("{name}", subject.title);
  const hint        = resolve(t, "itin.photos.hint",         "Opens an image search in a new tab");
  const closeLabel  = resolve(t, "itin.photos.close",        "Close photos");
  const hasSubject  = subject.title.trim().length > 0;

  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    function onKey(e: KeyboardEvent) { if (e.key === "Escape") onClose(); }
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = prev;
      window.removeEventListener("keydown", onKey);
    };
  }, [onClose]);

  return (
    <div
      role="dialog" aria-modal="true" aria-label={dialogLabel}
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}
      style={{
        position: "fixed", inset: 0, zIndex: 9100,
        background: "rgba(0,0,0,0.72)", backdropFilter: "blur(5px)",
        display: "flex", alignItems: "center", justifyContent: "center",
        padding: "20px",
      }}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{
          background: "var(--sf-surface)", borderRadius: 16,
          width: "100%", maxWidth: 500,
          maxHeight: "90dvh", overflowY: "auto",
          boxShadow: "0 24px 64px rgba(0,0,0,0.55)",
          display: "flex", flexDirection: "column",
        }}
      >
        {/* Header */}
        <div style={{
          display: "flex", alignItems: "flex-start", justifyContent: "space-between",
          gap: 12, padding: "16px 16px 12px",
          borderBottom: "1px solid var(--sf-border)", flexShrink: 0,
        }}>
          <div>
            <p style={{ fontWeight: 800, fontSize: "1.0625rem", color: "var(--sf-text)", lineHeight: 1.25, marginBottom: 5 }}>
              {subject.title}
            </p>
            {subject.category && <CategoryChip category={subject.category} t={t} />}
          </div>
          <button
            type="button" onClick={onClose} aria-label={closeLabel}
            style={{
              width: 32, height: 32, borderRadius: 8,
              border: "1px solid var(--sf-border)",
              background: "var(--sf-surface-alt)", cursor: "pointer",
              color: "var(--sf-text-muted)", display: "flex",
              alignItems: "center", justifyContent: "center", flexShrink: 0,
            }}
          >
            <X size={15} aria-hidden />
          </button>
        </div>

        {/* Photo action */}
        <div style={{ padding: "16px", display: "flex", flexDirection: "column", gap: 10 }}>
          {hasSubject ? (
            <a
              href={subject.searchUrl}
              target="_blank"
              rel="noopener noreferrer"
              aria-label={viewAria}
              style={{
                borderRadius: 10, aspectRatio: "16/9",
                background: "var(--sf-surface-alt)",
                border: "1.5px solid var(--sf-border)",
                display: "flex", flexDirection: "column",
                alignItems: "center", justifyContent: "center", gap: 10,
                textDecoration: "none", transition: "border-color .15s",
              }}
              onMouseEnter={e => (e.currentTarget.style.borderColor = "var(--sf-indigo)")}
              onMouseLeave={e => (e.currentTarget.style.borderColor = "var(--sf-border)")}
            >
              <span style={{ fontSize: "2.25rem", opacity: 0.88 }} aria-hidden>{subject.icon}</span>
              <span style={{
                display: "inline-flex", alignItems: "center", gap: 6,
                fontSize: "0.9375rem", fontWeight: 700, color: "var(--sf-text)",
              }}>
                <Camera size={14} aria-hidden />
                {viewLabel}
                <ExternalLink size={12} aria-hidden style={{ opacity: 0.7 }} />
              </span>
              <span style={{ fontSize: "0.75rem", color: "var(--sf-text-muted)" }}>{hint}</span>
            </a>
          ) : (
            <p style={{ fontSize: "0.8125rem", color: "var(--sf-text-muted)", textAlign: "center", padding: "24px 0" }}>
              {resolve(t, "itin.photos.none", "No photos available yet")}
            </p>
          )}
        </div>

        {/* Footer — maps link */}
        {subject.mapUrl && (
          <div style={{
            padding: "10px 16px 16px",
            borderTop: "1px solid var(--sf-border)", flexShrink: 0,
          }}>
            <a
              href={subject.mapUrl} target="_blank" rel="noopener noreferrer"
              className="sf-maps-link"
            >
              <MapPin size={12} aria-hidden />
              {t("itin.maps")}
              <ExternalLink size={11} aria-hidden style={{ opacity: 0.7 }} />
            </a>
          </div>
        )}
      </div>
    </div>
  );
}

/* ── Trip enrichment (Events / Transportation / Accommodation agents) ──
 *
 * Every section here is absent-by-default. `undefined` means the enrichment
 * call never ran or didn't finish — which is NOT the same as "there are none",
 * so the section renders nothing at all. Only an empty array (the agent ran and
 * genuinely found nothing) earns an explicit empty state. Telling someone "no
 * events during your trip" because a request timed out would be a confident lie
 * about the real world.
 *
 * The second rule these components exist to enforce: none of this is booked or
 * confirmed. Costs are model estimates rather than quotes, event dates come
 * from a model with no live calendar, and accommodation names areas rather than
 * properties. `uncertain` is load-bearing, not decorative — see engine.ts.
 */

const TRANSPORT_MODE_KEYS: Record<TransportLeg["mode"], string> = {
  flight:      "itin.enrich.mode.flight",
  train:       "itin.enrich.mode.train",
  bus:         "itin.enrich.mode.bus",
  taxi:        "itin.enrich.mode.taxi",
  ride_hail:   "itin.enrich.mode.ride_hail",
  walk:        "itin.enrich.mode.walk",
  car_rental:  "itin.enrich.mode.car_rental",
};

/** Units come from the locale rather than a hardcoded "h"/"m" — not every
 *  language abbreviates duration the same way, and these sit inline in prose. */
function formatDuration(minutes: number, t: (k: string) => string): string {
  if (!Number.isFinite(minutes) || minutes <= 0) return "";
  if (minutes < 60) return `${Math.round(minutes)} ${t("itin.enrich.min")}`;

  const hours = Math.floor(minutes / 60);
  const rest  = Math.round(minutes % 60);
  const hourPart = `${hours} ${t("itin.enrich.hour")}`;
  return rest === 0 ? hourPart : `${hourPart} ${rest} ${t("itin.enrich.min")}`;
}

/** "Don't treat this as confirmed." Shown wherever the model flagged uncertainty. */
function UncertainChip({ t }: { t: (k: string) => string }) {
  return (
    <span style={{
      display:       "inline-flex",
      alignItems:    "center",
      gap:           "4px",
      fontSize:      "0.6875rem",
      fontWeight:    700,
      color:         "var(--sf-warning)",
      background:    "color-mix(in srgb, var(--sf-warning) 12%, var(--sf-surface))",
      padding:       "2px 8px",
      borderRadius:  "999px",
      lineHeight:    1.5,
    }}>
      <AlertTriangle size={11} aria-hidden />
      {t("itin.enrich.unverified")}
    </span>
  );
}

function EnrichSection({
  icon: Icon, title, note, children,
}: {
  icon: typeof MapPin;
  title: string;
  note?: string;
  children: React.ReactNode;
}) {
  return (
    <section style={{
      background:   "var(--sf-surface)",
      border:       "1px solid var(--sf-border)",
      borderRadius: "14px",
      padding:      "20px",
      marginTop:    "20px",
    }}>
      <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: note ? "4px" : "14px" }}>
        <Icon size={16} aria-hidden style={{ color: "var(--sf-indigo)", flexShrink: 0 }} />
        <h2 style={{ fontSize: "0.9375rem", fontWeight: 800, color: "var(--sf-text)" }}>
          {title}
        </h2>
      </div>
      {note && (
        <p style={{ fontSize: "0.75rem", color: "var(--sf-text-muted)", marginBottom: "14px" }}>
          {note}
        </p>
      )}
      {children}
    </section>
  );
}

function TransportLegRow({ leg, t }: { leg: TransportLeg; t: (k: string) => string }) {
  const duration = formatDuration(leg.durationMinutes, t);
  return (
    <li style={{
      display:       "flex",
      flexDirection: "column",
      gap:           "6px",
      padding:       "12px 0",
      borderTop:     "1px solid var(--sf-border)",
    }}>
      <div style={{ display: "flex", alignItems: "center", gap: "8px", flexWrap: "wrap" }}>
        <span style={{
          fontSize:      "0.6875rem",
          fontWeight:    700,
          textTransform: "uppercase",
          letterSpacing: "0.05em",
          color:         "var(--sf-indigo)",
        }}>
          {t(TRANSPORT_MODE_KEYS[leg.mode] ?? "itin.enrich.mode.taxi")}
        </span>
        <span style={{ fontSize: "0.875rem", fontWeight: 600, color: "var(--sf-text)" }}>
          {leg.from} → {leg.to}
        </span>
      </div>

      <div style={{
        display:    "flex",
        alignItems: "center",
        gap:        "10px",
        flexWrap:   "wrap",
        fontSize:   "0.8125rem",
        color:      "var(--sf-text-muted)",
      }}>
        {/* Distance is the one figure here that isn't an estimate — it comes
            from the two stops' real coordinates, so it carries no hedge. */}
        {typeof leg.distanceKm === "number" && (
          <span>{leg.distanceKm} {t("itin.enrich.km")}</span>
        )}
        {duration && <span>{duration}</span>}
        {leg.costSar > 0 && (
          <span>
            ≈ {t("itin.summary.sar")} {Math.round(leg.costSar)}
            <span style={{ opacity: 0.75 }}> ({t("itin.enrich.estimate")})</span>
          </span>
        )}
        {leg.uncertain && <UncertainChip t={t} />}
      </div>

      {leg.notes && (
        <p style={{ fontSize: "0.8125rem", color: "var(--sf-text-muted)", lineHeight: 1.6 }}>
          {leg.notes}
        </p>
      )}
    </li>
  );
}

function EventCard({ event, t }: { event: TripEvent; t: (k: string) => string }) {
  return (
    <li style={{
      padding:   "12px 0",
      borderTop: "1px solid var(--sf-border)",
    }}>
      <div style={{ display: "flex", alignItems: "center", gap: "8px", flexWrap: "wrap", marginBottom: "4px" }}>
        <span style={{ fontSize: "0.875rem", fontWeight: 700, color: "var(--sf-text)" }}>
          {event.nameTranslated || event.name}
        </span>
        {event.overlapsTrip && (
          <span style={{
            fontSize:     "0.6875rem",
            fontWeight:   700,
            color:        "var(--sf-success)",
            background:   "color-mix(in srgb, var(--sf-success) 12%, var(--sf-surface))",
            padding:      "2px 8px",
            borderRadius: "999px",
          }}>
            {t("itin.enrich.events.overlaps")}
          </span>
        )}
        {event.uncertain && <UncertainChip t={t} />}
      </div>

      <p style={{ fontSize: "0.8125rem", color: "var(--sf-text-muted)", lineHeight: 1.6, marginBottom: "6px" }}>
        {event.description}
      </p>

      <div style={{
        display:  "flex",
        gap:      "10px",
        flexWrap: "wrap",
        fontSize: "0.75rem",
        color:    "var(--sf-text-muted)",
      }}>
        <span style={{ fontWeight: 600 }}>{event.dateRange}</span>
        {event.venue && <span>· {event.venue}</span>}
        {event.sourceHint && <span>· {event.sourceHint}</span>}
      </div>
    </li>
  );
}

function StayCard({ option, t }: { option: AccommodationOption; t: (k: string) => string }) {
  return (
    <li style={{
      padding:   "12px 0",
      borderTop: "1px solid var(--sf-border)",
    }}>
      <div style={{ display: "flex", alignItems: "baseline", gap: "8px", flexWrap: "wrap", marginBottom: "4px" }}>
        <span style={{ fontSize: "0.875rem", fontWeight: 700, color: "var(--sf-text)" }}>
          {option.areaTranslated || option.area}
        </span>
        <span style={{
          fontSize:      "0.6875rem",
          fontWeight:    700,
          textTransform: "uppercase",
          letterSpacing: "0.05em",
          color:         "var(--sf-indigo)",
        }}>
          {option.hotelType}
        </span>
      </div>

      <p style={{ fontSize: "0.8125rem", color: "var(--sf-text-muted)", lineHeight: 1.6, marginBottom: "6px" }}>
        {option.whyThisArea}
      </p>

      <div style={{ fontSize: "0.8125rem", color: "var(--sf-text)", fontWeight: 600 }}>
        {t("itin.summary.sar")} {Math.round(option.nightlyCostSarLow)}–{Math.round(option.nightlyCostSarHigh)}
        <span style={{ color: "var(--sf-text-muted)", fontWeight: 400 }}> {t("itin.enrich.night")}</span>
      </div>

      {option.goodFor && (
        <p style={{ fontSize: "0.75rem", color: "var(--sf-text-muted)", marginTop: "4px" }}>
          {t("itin.enrich.goodfor")}: {option.goodFor}
        </p>
      )}
    </li>
  );
}

const ENRICH_LIST_STYLE: React.CSSProperties = { listStyle: "none", margin: 0, padding: 0 };

/* ── Main page ──────────────────────────────────────────────────────── */
export function Itinerary() {
  const [, navigate]    = useLocation();
  const { t, language } = useTranslation();
  usePageMeta("Your Itinerary", "Your AI-crafted day-by-day Saudi travel itinerary.");
  useItinStyles();

  const [result, setResult] = useState<ItineraryResult | null>(null);
  const [trip,   setTrip]   = useState<TripSpec | null>(null);
  const [activeDay, setActiveDay] = useState(0);
  const [photoSubject, setPhotoSubject] = useState<PhotoSubject | null>(null);

  /* Drives the sign-in wall below. Kept in sync with safarly-auth-changed the
     same way the Navbar does it, so signing in from another tab drops the gate
     here without a reload. */
  const [authed, setAuthed] = useState(() => !!getAuth());
  useEffect(() => {
    function sync() { setAuthed(!!getAuth()); }
    window.addEventListener("safarly-auth-changed", sync);
    window.addEventListener("storage", sync);
    return () => {
      window.removeEventListener("safarly-auth-changed", sync);
      window.removeEventListener("storage", sync);
    };
  }, []);

  /* ── Cascade state ──────────────────────────────────────────────── */
  const [cascade, setCascade] = useState<CascadeInfo>({
    phase: "idle", closedPoiId: "", closedPoiName: "",
    replacementPoiId: "", altName1: "", altName2: "",
    newDailyCost: 0, shiftedLunch: "", reorderedCount: 0, feedStep: 0,
  });
  const [showToast,  setShowToast]  = useState(false);
  const [preRestore, setPreRestore] = useState<ItineraryResult | null>(null);
  const toastTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const raw = localStorage.getItem("safarly_itinerary");
    const tripRaw = localStorage.getItem("safarly_trip");
    if (!raw || !tripRaw) { navigate("/planner"); return; }
    try {
      setResult(JSON.parse(raw) as ItineraryResult);
      setTrip(JSON.parse(tripRaw) as TripSpec);
    } catch {
      navigate("/planner");
    }
  }, []);

  /**
   * The POI dataset the engine actually drew from — read off the scheduled
   * stops rather than `trip.city`, because a trip planned with city "ai" (or
   * one of the cities that falls back to another's dataset via CITY_POI_MAP)
   * has a POI city that `trip.city` doesn't name. Anything the Concierge is
   * allowed to add has to come from this same set.
   */
  const cityPois = useMemo<POI[]>(() => {
    const poiCity = result?.days.flatMap(d => d.stops)[0]?.poi.city
      ?? result?.resolvedCity;
    if (!poiCity) return [];
    return ALL_POIS
      .filter(p => p.city === poiCity)
      .map(p => ({ ...p, map_url: p.map_url ?? "" }));
  }, [result]);

  /** The Concierge proposes; the page is what actually persists a change. */
  function handleConciergeChange(next: ItineraryResult) {
    setResult(next);
    localStorage.setItem("safarly_itinerary", JSON.stringify(next));
  }

  function handleRegen() {
    localStorage.removeItem("safarly_itinerary");
    navigate("/generating");
  }

  function handleEdit() {
    navigate("/planner");
  }

  function handleConfirm() {
    if (!result || !trip) return;
    // Push any existing ongoing trip to past trips before overwriting
    try {
      const prevRaw = localStorage.getItem("safarly_ongoing_trip");
      if (prevRaw) {
        const prev = JSON.parse(prevRaw);
        const past = JSON.parse(localStorage.getItem("safarly_past_trips") ?? "[]");
        if (!past.some((p: { confirmedAt: string }) => p.confirmedAt === prev.confirmedAt)) {
          past.push(prev);
          localStorage.setItem("safarly_past_trips", JSON.stringify(past));
        }
      }
    } catch { /* */ }
    const confirmed = { trip, itinerary: result, confirmedAt: new Date().toISOString() };
    localStorage.setItem("safarly_ongoing_trip", JSON.stringify(confirmed));
  }

  /* ── Wrench / cascade handler ───────────────────────────────────── */
  function handleWrench() {
    if (!result || !trip) return;
    if (cascade.phase !== "idle") return; // already running

    const day = result.days[activeDay] ?? result.days[0];

    // Find target: midday+indoor stop, then any midday, then 2nd stop, then 1st
    const target =
      day.stops.find(s => s.slot === "midday" && (s.poi as unknown as RawPoi).indoor) ??
      day.stops.find(s => s.slot === "midday") ??
      day.stops[1] ??
      day.stops[0];

    if (!target) return;

    // IDs already in itinerary (across all days)
    const usedIds = new Set(result.days.flatMap(d => d.stops.map(s => s.poi.id)));

    // Candidate alternatives: same city, unused, same best_slot first
    const sameCityUnused = ALL_POIS.filter(
      p => p.city === trip.city && !usedIds.has(p.id) && p.id !== target.poi.id
    );
    const slotMatch = sameCityUnused.filter(
      p => p.best_slot === (target.poi as unknown as RawPoi).best_slot
    );
    const pool = slotMatch.length >= 2 ? slotMatch : sameCityUnused;
    if (pool.length === 0) return;

    const chosen  = pool[0];
    const altName1 = (pool[0] ? poiName(t, pool[0]) : "");
    const altName2 = (pool[1] ? poiName(t, pool[1]) : altName1);

    // Build replacement stop (same time slot as target)
    const replacementStop: ItineraryStop = {
      poi:            chosen as unknown as ItineraryStop["poi"],
      slot:           target.slot,
      startTime:      target.startTime,
      endTime:        target.endTime,
      prayerGapBefore: target.prayerGapBefore,
    };

    // Remaining stops (excluding closed) + replacement → optimal slot reassignment.
    // optimizeDayStops does a full permutation search and actually changes which
    // POI occupies which time slot (not just array order) — the timeline sorts by
    // startTime for display, so a reorder that only shuffled array position, as
    // this used to do, was never visible. This also picks up the midday-must-be-
    // indoor constraint, which the old pass didn't check.
    const remaining = day.stops.filter(s => s.poi.id !== target.poi.id);
    const allNew    = [...remaining, replacementStop];

    const priorSlotById = new Map(allNew.map(s => [s.poi.id, s.slot]));
    const optimizedDay  = optimizeDayStops(allNew);
    const reordered      = optimizedDay.stops;
    const reorderedCount = reordered.filter(s => priorSlotById.get(s.poi.id) !== s.slot).length;

    // Shift lunch by 30 minutes
    const lunch = day.meals.find(m => m.type === "lunch");
    let shiftedLunch = "";
    if (lunch) {
      const [h, m] = lunch.estimatedTime.split(":").map(Number);
      const total  = h * 60 + m + 30;
      shiftedLunch = `${String(Math.floor(total / 60)).padStart(2, "0")}:${String(total % 60).padStart(2, "0")}`;
    }

    // New cost: subtract closed poi price, add replacement price
    const newDailyCost = Math.max(
      0,
      day.dailyCostSar
        - ((target.poi as unknown as RawPoi).price_range ?? 0)
        + (chosen.price_range ?? 0)
    );

    // Modified day (used when phase → replanned)
    const modifiedMeals = shiftedLunch && lunch
      ? day.meals.map(m => m.type === "lunch" ? { ...m, estimatedTime: shiftedLunch } : m)
      : day.meals;

    const modifiedDay: ItineraryDay = {
      ...day,
      stops:       reordered,
      meals:       modifiedMeals,
      dailyCostSar: newDailyCost,
    };

    const modifiedResult: ItineraryResult = {
      ...result,
      days: result.days.map((d, i) => i === activeDay ? modifiedDay : d),
    };

    // Save pre-cascade for Undo
    setPreRestore(result);

    // Start cascade animation sequence
    const base: Omit<CascadeInfo, "phase" | "feedStep"> = {
      closedPoiId:     target.poi.id,
      closedPoiName:   poiName(t, target.poi),
      replacementPoiId: chosen.id,
      altName1,
      altName2,
      newDailyCost,
      shiftedLunch,
      reorderedCount,
    };

    setCascade({ ...base, phase: "closed",  feedStep: 0 });

    // Feed panel appears after short shake
    setTimeout(() => setCascade(c => ({ ...c, phase: "feeding" })), 800);

    // Reveal each agent step
    const stepDelays = [800, 1800, 3000, 4200, 5400];
    stepDelays.forEach((delay, i) => {
      setTimeout(() => setCascade(c => ({ ...c, feedStep: i + 1 })), delay);
    });

    // Switch to replanned + commit result + show toast
    setTimeout(() => {
      setCascade(c => ({ ...c, phase: "replanned" }));
      setResult(modifiedResult);
      setShowToast(true);
      if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
      toastTimerRef.current = setTimeout(() => setShowToast(false), 5000);
    }, 6600);
  }

  /* ── Undo handler ───────────────────────────────────────────────── */
  function handleUndo() {
    if (!preRestore) return;
    setResult(preRestore);
    setPreRestore(null);
    setCascade(c => ({ ...c, phase: "idle", feedStep: 0 }));
    setShowToast(false);
    if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
  }

  function handleDismissToast() {
    setShowToast(false);
    if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
  }

  /* ── Empty / loading state ──────────────────────────────────────────── */
  if (!result || !trip) {
    return (
      <div style={{
        paddingTop:    "80px",
        paddingBottom: "80px",
        minHeight:     "100dvh",
        background:    "var(--sf-bg)",
        display:       "flex",
        alignItems:    "center",
        justifyContent: "center",
        flexDirection: "column",
        gap:           "16px",
      }}>
        <p style={{ color: "var(--sf-text-muted)", fontSize: "0.9375rem" }}>
          {t("itin.no_data")}
        </p>
        <button
          className="sf-btn-primary"
          onClick={() => navigate("/planner")}
          style={{ width: "auto", padding: "12px 28px" }}
        >
          {t("itin.go_plan")}
        </button>
      </div>
    );
  }

  const currentDay = result.days[activeDay] ?? result.days[0];

  return (
    <div style={{
      paddingTop:    "68px",
      paddingBottom: "88px",
      background:    "var(--sf-bg)",
      minHeight:     "100dvh",
    }}>
      {/* ── Page header ─────────────────────────────────────────────── */}
      <AuroraHero minHeight="auto" className="sf-aurora-band">
        <div style={{
          borderBottom: "1px solid var(--sf-border)",
          padding:      "20px 20px 16px",
        }}>
          <div style={{ maxWidth: "1100px", margin: "0 auto" }}>
            <h1 style={{
              fontSize:      "clamp(1.25rem, 4vw, 1.625rem)",
              fontWeight:    800,
              color:         "var(--sf-text)",
              letterSpacing: "-0.02em",
              marginBottom:  "4px",
            }}>
              {t("page.itinerary.title")}
            </h1>
            <p style={{ color: "var(--sf-text-muted)", fontSize: "0.875rem" }}>
              {t("page.itinerary.desc")}
            </p>
          </div>
        </div>
      </AuroraHero>

      {/* ── Main layout ─────────────────────────────────────────────── */}
      <div style={{ maxWidth: "1100px", margin: "0 auto", padding: "0 16px" }}>
        <div className="sf-itin-layout" style={{ paddingTop: "20px" }}>

          {/* ── Sidebar ───────────────────────────────────────────── */}
          <aside className="sf-itin-sidebar">
            <TripSummary
              result={result}
              trip={trip}
              t={t}
              onRegen={handleRegen}
              onEdit={handleEdit}
              onConfirm={handleConfirm}
              language={language}
            />
          </aside>

          {/* ── Main: tabs + timeline ──────────────────────────────── */}
          <div className="sf-itin-main">

            {/* Day tabs */}
            <div style={{
              display:          "flex",
              gap:              "8px",
              overflowX:        "auto",
              paddingBottom:    "4px",
              paddingInline:    "2px",
              marginBottom:     "20px",
              WebkitOverflowScrolling: "touch",
              scrollbarWidth:   "none",
              msOverflowStyle:  "none",
            }}>
              {result.days.map((day, idx) => {
                const label = t("itin.day").replace("{n}", String(day.dayNumber));
                return (
                  <button
                    key={day.dayNumber}
                    className={`sf-day-tab${idx === activeDay ? " sf-day-tab-active" : ""}`}
                    onClick={() => setActiveDay(idx)}
                    aria-pressed={idx === activeDay}
                  >
                    {label}
                    {day.overBudget && (
                      <span
                        aria-hidden
                        title="Over budget"
                        style={{
                          marginInlineStart: "6px",
                          width:            "6px",
                          height:           "6px",
                          borderRadius:     "50%",
                          background:       idx === activeDay ? "#0A0E16" : "var(--sf-warning)",
                          display:          "inline-block",
                          verticalAlign:    "middle",
                        }}
                      />
                    )}
                  </button>
                );
              })}
            </div>

            {/* Day meta */}
            {currentDay && (
              <div style={{
                display:      "flex",
                alignItems:   "center",
                gap:          "12px",
                marginBottom: "16px",
                flexWrap:     "wrap",
              }}>
                <span style={{ fontSize: "0.875rem", color: "var(--sf-text-muted)", fontWeight: 600 }}>
                  {new Date(currentDay.date + "T00:00:00").toLocaleDateString(
                    localeTag(language),
                    { weekday: "long", day: "numeric", month: "long" }
                  )}
                </span>
                <span style={{
                  fontSize:   "0.75rem",
                  fontWeight: 700,
                  color:      currentDay.overBudget ? "var(--sf-warning)" : "var(--sf-success)",
                  padding:    "2px 8px",
                  borderRadius: "999px",
                  background: currentDay.overBudget
                    ? "color-mix(in srgb, var(--sf-warning) 12%, var(--sf-surface))"
                    : "color-mix(in srgb, var(--sf-success) 12%, var(--sf-surface))",
                }}>
                  {t("itin.summary.sar")} {currentDay.dailyCostSar}
                  {" · "}
                  {currentDay.overBudget ? t("itin.summary.over") : t("itin.summary.ok")}
                </span>
              </div>
            )}

            {/* Timeline */}
            {currentDay && (
              <DayTimeline
                day={currentDay}
                t={t}
                language={language}
                cascadePhase={cascade.phase}
                closedPoiId={cascade.closedPoiId || null}
                closedPoiName={cascade.closedPoiName}
                replacementPoiId={cascade.replacementPoiId || null}
                onPhotoClick={(poi) => setPhotoSubject(poiPhotoSubject(t, poi))}
                onMealPhotoClick={(meal) => setPhotoSubject(dishPhotoSubject(t, meal, language))}
              />
            )}

            {/* Getting around on this day — Transportation agent, per-day legs */}
            {currentDay?.transportLegs && currentDay.transportLegs.length > 0 && (
              <EnrichSection icon={Navigation} title={t("itin.enrich.transport.title")}>
                <ul style={ENRICH_LIST_STYLE}>
                  {currentDay.transportLegs.map((leg, idx) => (
                    <TransportLegRow key={`${leg.from}-${leg.to}-${idx}`} leg={leg} t={t} />
                  ))}
                </ul>
              </EnrichSection>
            )}
          </div>
        </div>

        {/* ── Destination map ──────────────────────────────────────────── */}
        <DestinationMap day={currentDay} city={result.resolvedCity || trip.city} />

        {/* ── Trip-wide enrichment ─────────────────────────────────────── */}

        {/* Getting there — Transportation agent, one-time arrival */}
        {result.arrival && result.arrival.legs.length > 0 && (
          <EnrichSection
            icon={Plane}
            title={t("itin.enrich.arrival.title")}
            note={result.arrival.summary || undefined}
          >
            <ul style={ENRICH_LIST_STYLE}>
              {result.arrival.legs.map((leg, idx) => (
                <TransportLegRow key={`arrival-${idx}`} leg={leg} t={t} />
              ))}
            </ul>
          </EnrichSection>
        )}

        {/* While you're there — Events agent. `undefined` renders nothing at
            all; only a genuinely empty result gets the "none found" line. */}
        {result.events && (
          <EnrichSection icon={CalendarDays} title={t("itin.enrich.events.title")}>
            {result.events.length === 0 ? (
              <p style={{ fontSize: "0.8125rem", color: "var(--sf-text-muted)" }}>
                {t("itin.enrich.events.empty")}
              </p>
            ) : (
              <ul style={ENRICH_LIST_STYLE}>
                {result.events.map((event, idx) => (
                  <EventCard key={`event-${idx}`} event={event} t={t} />
                ))}
              </ul>
            )}
          </EnrichSection>
        )}

        {/* Where to stay — Accommodation agent (areas, never bookings) */}
        {result.accommodation && result.accommodation.length > 0 && (
          <EnrichSection
            icon={BedDouble}
            title={t("itin.enrich.stay.title")}
            note={t("itin.enrich.stay.note")}
          >
            <ul style={ENRICH_LIST_STYLE}>
              {result.accommodation.map((option, idx) => (
                <StayCard key={`stay-${idx}`} option={option} t={t} />
              ))}
            </ul>
          </EnrichSection>
        )}

      </div>

      {/* ── Photo modal ─────────────────────────────────────────────── */}
      {photoSubject && (
        <PhotoModal subject={photoSubject} onClose={() => setPhotoSubject(null)} />
      )}

      {/* ── Fixed wrench ghost button ────────────────────────────────── */}
      <button
        id="demo-closure"
        className="sf-wrench-btn"
        aria-label={t("cascade.wrench_label")}
        onClick={handleWrench}
        style={cascade.phase !== "idle" ? { opacity: 0.35, pointerEvents: "none" } : {}}
      >
        <Wrench size={17} aria-hidden />
      </button>

      {/* ── Personal Concierge ───────────────────────────────────────── */}
      {/* Hidden behind the wall: /api/concierge/chat is session-guarded, so
          offering the panel signed out would only ever produce a 401. */}
      {authed && (
        <ConciergeChat
          itinerary={result}
          trip={trip}
          cityPois={cityPois}
          onItineraryChange={handleConciergeChange}
        />
      )}

      {/* ── Sign-in wall ─────────────────────────────────────────────── */}
      {/* Conversion device, not access control — see ResultsGate's header. */}
      {!authed && <ResultsGate result={result} t={t} />}

      {/* ── Agent feed panel (closed + feeding phases) ───────────────── */}
      {(cascade.phase === "closed" || cascade.phase === "feeding") && (
        <AgentFeedPanel info={cascade} t={t} language={language} />
      )}

      {/* ── Replan toast ─────────────────────────────────────────────── */}
      {showToast && (
        <ReplanToast
          poiName={cascade.closedPoiName}
          t={t}
          language={language}
          onUndo={handleUndo}
          onDismiss={handleDismissToast}
        />
      )}
    </div>
  );
}
