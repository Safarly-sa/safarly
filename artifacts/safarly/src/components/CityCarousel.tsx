/**
 * Horizontal city picker for /trip — photo cards in a scroll-snap carousel
 * with prev/next arrows.
 *
 * Replaces the old "3 featured cards + 13 more behind a label" split. Every
 * destination now sits in one row at equal visual weight, which removes the
 * implicit ranking (nothing is buried below a heading) and lets a traveller
 * browse all 16 by swiping instead of scanning a dense grid.
 *
 * Scrolling is a native `overflow-x` + `scroll-snap` container rather than a
 * transform-driven track. That buys touch momentum, trackpad gestures,
 * keyboard scrolling, and screen-reader reachability for free — the arrows are
 * an *additional* affordance for mouse users, not the only way through, so the
 * carousel can never trap content behind a control that didn't render.
 *
 * Photos come from Visit Saudi's own CDN (scth.scene7.com), the same source the
 * homepage hero already uses. All sixteen cities have one — see CITY_IMAGE for
 * which, and for the rule about never borrowing a neighbouring city's photo.
 *
 * The gradient fallback below is still load-bearing even though no city relies
 * on it today: these are hotlinked assets on someone else's CDN, so any slug
 * can start 404ing without warning. A card that loses its photo degrades to the
 * branded tile instead of an empty box.
 */
import { useCallback, useEffect, useRef, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { useReducedMotion } from "framer-motion";
import { useTranslation } from "@/providers/translation-context";

/** Card width + gap, in px — the scroll step for one arrow press. */
const CARD_W = 236;
const GAP = 12;

/**
 * Visit Saudi CDN slugs. All 16 cities now have one.
 *
 * Every slug here was checked by *looking at the image*, not just by seeing
 * bytes come back — Scene7 answers 200 for a missing asset and serves a grey
 * "no image" placeholder, so a slug that merely resolves proves nothing. Two
 * candidates were rejected on sight and are worth naming so nobody re-adds
 * them: `ithra` is a festival poster with Arabic text burned into it, and
 * `eastern-province` is a letterboxed video still of a potter. Both load fine.
 *
 * The rule this file used to state still holds: never caption a city with a
 * neighbour's skyline, which is the same class of error as the "(Ithra)" bug
 * in pois.json. `ithra-2` is Dhahran's by right rather than by borrowing —
 * the King Abdulaziz Center genuinely stands in Dhahran, which is exactly why
 * labelling a *Riyadh* art row "(Ithra)" was wrong.
 */
const CITY_IMAGE: Record<string, string> = {
  riyadh:         "riyadh-banner-new",
  // The Corniche at night, with the city's name lit in the frame. Replaced
  // `jeddah-banner`, a generic Red Sea dive shot that could have been anywhere
  // on the coast and left the card unidentifiable as Jeddah.
  jeddah:         "jeddah-corniche",
  alula:          "alula-banner-new",
  abha:           "about-abha_hero_banner_desktop-1",
  taif:           "Taif-banner-new",
  madinah:        "madinah-banner-promotion",
  mecca:          "New-makkah-view-homepage",
  // The water tower photographed on the corniche. Replaced `dammam-2`, which
  // is a cut-out of the same tower on a white studio background — it read as a
  // white rectangle punched into a dark card rather than as a photo.
  dammam:         "dammam-3",
  al_khobar:      "khobar",
  dhahran:        "ithra-2",
  khamis_mushait: "khamis-mushait",
  jazan:          "about-jazan_hero_banner_desktop-3",
  najran:         "New-Najran-Banner-Image",
  tabuk:          "New-Tabuk_Image-Banner",
  hail:           "hail-hero-banner",
  yanbu:          "yanbu-new-hero-banner",
};

/** Served as WebP at 2x the card width so the art stays crisp on retina. */
function cityImageUrl(id: string): string | undefined {
  const slug = CITY_IMAGE[id];
  return slug
    ? `https://scth.scene7.com/is/image/scth/${slug}?wid=${CARD_W * 2}&fit=constrain&fmt=webp`
    : undefined;
}

export interface CityOption {
  id: string;
  /** Emoji shown only in the no-photo fallback tile, never over a photo. */
  icon: string;
  title: string;
  sub: string;
  famousFor?: string;
}

/* ── Card ───────────────────────────────────────────────────────────── */

function CityCard({ city, selected, onClick }: {
  city: CityOption;
  selected: boolean;
  onClick: () => void;
}) {
  const { t } = useTranslation();
  const [failed, setFailed] = useState(false);
  const src = cityImageUrl(city.id);
  const showPhoto = !!src && !failed;

  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={selected}
      className={`sf-city-card${selected ? " selected" : ""}`}
    >
      <div className="sf-city-card-media">
        {showPhoto ? (
          <img
            src={src}
            alt=""
            loading="lazy"
            decoding="async"
            onError={() => setFailed(true)}
            className="sf-city-card-img"
          />
        ) : (
          /* Fallback: branded gradient + the city's icon. Also what shows while
             a photo is still loading in, so the tile never flashes empty. */
          <div className="sf-city-card-fallback" aria-hidden>
            <span>{city.icon}</span>
          </div>
        )}

        {/* Scrim so the title stays legible over any photo's bright areas. */}
        <div className="sf-city-card-scrim" aria-hidden />

        {/* Selection is signalled by ring + check + label, never colour alone. */}
        {selected && (
          <span className="sf-city-card-check" aria-hidden>
            <svg width="11" height="11" viewBox="0 0 10 10" fill="none">
              <path d="M2 5l2.5 2.5 4-4" stroke="white" strokeWidth="1.9"
                    strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </span>
        )}

        <span className="sf-city-card-name">{city.title}</span>
      </div>

      <div className="sf-city-card-body">
        <span className="sf-city-card-sub">{city.sub}</span>
        {city.famousFor && (
          <span className="sf-city-card-poi">{city.famousFor}</span>
        )}
        {selected && (
          <span className="sf-city-card-selected-label">
            {t("trip.city.selected")}
          </span>
        )}
      </div>
    </button>
  );
}

/* ── Carousel ───────────────────────────────────────────────────────── */

export function CityCarousel({ cities, selectedId, onSelect }: {
  cities: CityOption[];
  selectedId: string;
  onSelect: (id: string) => void;
}) {
  const { t, dir } = useTranslation();
  const reduce = useReducedMotion();
  const trackRef = useRef<HTMLDivElement>(null);
  const [atStart, setAtStart] = useState(true);
  const [atEnd, setAtEnd] = useState(false);

  const isRTL = dir === "rtl";

  /**
   * Works in both directions: per spec, RTL scrollLeft starts at 0 on the right
   * and runs negative, so comparing the ABSOLUTE offset against the max keeps
   * one implementation for both instead of branching on direction.
   */
  const sync = useCallback(() => {
    const el = trackRef.current;
    if (!el) return;
    const max = el.scrollWidth - el.clientWidth;
    const pos = Math.abs(el.scrollLeft);
    setAtStart(pos <= 2);
    setAtEnd(max <= 2 || pos >= max - 2);
  }, []);

  useEffect(() => {
    sync();
    const el = trackRef.current;
    if (!el) return;
    // Re-check on resize: a wider viewport can fit every card, which must
    // disable both arrows rather than leave them looking actionable.
    const ro = new ResizeObserver(sync);
    ro.observe(el);
    return () => ro.disconnect();
  }, [sync, cities.length]);

  function step(direction: 1 | -1) {
    const el = trackRef.current;
    if (!el) return;
    // Advance by whole cards, capped to what's actually visible so a narrow
    // screen doesn't skip past cards the traveller never saw.
    const perPage = Math.max(1, Math.floor(el.clientWidth / (CARD_W + GAP)));
    const delta = (CARD_W + GAP) * perPage * direction * (isRTL ? -1 : 1);
    el.scrollBy({ left: delta, behavior: reduce ? "auto" : "smooth" });
  }

  return (
    <div className="sf-city-carousel">
      <div
        ref={trackRef}
        onScroll={sync}
        className="sf-city-track"
        role="group"
        aria-label={t("trip.city.label")}
      >
        {cities.map((c) => (
          <CityCard
            key={c.id}
            city={c}
            selected={selectedId === c.id}
            onClick={() => onSelect(selectedId === c.id ? "" : c.id)}
          />
        ))}
      </div>

      {/* Arrows sit outside the scroll container so they never overlap a card's
          tap target. Disabled (not hidden) at the ends — a control that
          vanishes mid-interaction is harder to reason about than a dim one. */}
      <button
        type="button"
        onClick={() => step(-1)}
        disabled={atStart}
        aria-label={t("trip.city.prev")}
        className="sf-city-arrow sf-city-arrow-prev"
      >
        {isRTL ? <ChevronRight size={20} aria-hidden /> : <ChevronLeft size={20} aria-hidden />}
      </button>
      <button
        type="button"
        onClick={() => step(1)}
        disabled={atEnd}
        aria-label={t("trip.city.next")}
        className="sf-city-arrow sf-city-arrow-next"
      >
        {isRTL ? <ChevronLeft size={20} aria-hidden /> : <ChevronRight size={20} aria-hidden />}
      </button>
    </div>
  );
}
