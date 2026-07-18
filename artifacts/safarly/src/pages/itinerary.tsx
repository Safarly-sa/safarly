import { useEffect, useMemo, useRef, useState } from "react";
import { useLocation } from "wouter";
import {
  CheckCircle2, ExternalLink, MapPin, Utensils,
  Wrench, RotateCcw, ArrowLeft, Moon, Gem, ArrowRight,
} from "lucide-react";
import { useTranslation } from "@/providers/translation-context";
import { generateItinerary, type ItineraryResult, type ItineraryDay, type ItineraryStop, type ItineraryMeal, type TripSpec, type TravelerProfile, type Objectives } from "@/lib/engine";

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
        color: var(--sf-accent);
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
}: {
  stop: ItineraryStop;
  t: (k: string) => string;
  language: string;
}) {
  const { poi } = stop;

  return (
    <div style={{ display: "flex", gap: "12px", alignItems: "flex-start", paddingBlock: "6px" }}>
      <TimelineNode color={SLOT_NODE_COLOR[stop.slot] ?? "var(--sf-accent)"} />

      <div className="sf-stop-card" style={{ flex: 1, minWidth: 0 }}>
        {/* Time row */}
        <div style={{
          fontSize:    "0.6875rem",
          fontWeight:  600,
          color:       "var(--sf-text-muted)",
          marginBottom: "6px",
          letterSpacing: "0.04em",
        }}>
          {stop.startTime} – {stop.endTime}
        </div>

        {/* Name */}
        <div style={{ marginBottom: "8px" }}>
          <span style={{
            fontSize:    "1rem",
            fontWeight:  700,
            color:       "var(--sf-text)",
            lineHeight:  1.3,
            display:     "block",
          }}>
            {poi.name}
          </span>
        </div>

        {/* Badges row */}
        <div style={{
          display:     "flex",
          flexWrap:    "wrap",
          gap:         "6px",
          marginBottom: "10px",
        }}>
          <CategoryChip category={poi.category} t={t} />
          <VerifiedBadge t={t} />
          {poi.hidden_gem && <HiddenGemPip t={t} />}
        </div>

        {/* Culture note */}
        {poi.culture_note && (
          <p style={{
            fontSize:    "0.8125rem",
            color:       "var(--sf-text-muted)",
            lineHeight:  1.65,
            marginBottom: "12px",
          }}>
            {poi.culture_note}
          </p>
        )}

        {/* Maps link */}
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
    </div>
  );
}

function MealCard({
  meal, t, language,
}: {
  meal: ItineraryMeal;
  t: (k: string) => string;
  language: string;
}) {
  const { dish } = meal;
  const mealLabel = meal.type === "lunch" ? t("itin.lunch") : t("itin.dinner");
  const dishDisplayName = language === "ar" && dish.name_ar ? dish.name_ar : dish.name;

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
          {language === "ar" && dish.name_ar && dish.name_ar !== dish.name && (
            <span style={{ fontWeight: 400, fontSize: "0.8125rem", color: "var(--sf-text-muted)", marginInlineStart: "6px" }}>
              {dish.name}
            </span>
          )}
          {language !== "ar" && dish.name_ar && (
            <span style={{ fontWeight: 400, fontSize: "0.8125rem", color: "var(--sf-text-muted)", marginInlineStart: "6px" }}>
              {dish.name_ar}
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
          {dish.description}
        </p>

        {/* Price */}
        <span style={{
          fontSize:    "0.8125rem",
          fontWeight:  700,
          color:       "var(--sf-text)",
        }}>
          {t("itin.summary.sar")} {dish.price_sar}
        </span>
      </div>
    </div>
  );
}

/* ── Day timeline ───────────────────────────────────────────────────── */
function DayTimeline({
  day, t, language,
}: {
  day: ItineraryDay;
  t: (k: string) => string;
  language: string;
}) {
  // Build interleaved items: prayer markers + stops + meals in time order
  type Item =
    | { kind: "stop"; stop: ItineraryStop; prayer: string | null }
    | { kind: "meal"; meal: ItineraryMeal };

  const items: Item[] = [];

  // Sort stops by their start time
  const sortedStops = [...day.stops].sort((a, b) =>
    a.startTime.localeCompare(b.startTime)
  );

  // Sorted meals
  const sortedMeals = [...day.meals].sort((a, b) =>
    a.estimatedTime.localeCompare(b.estimatedTime)
  );

  // Merge stops and meals in time order
  let mealIdx = 0;
  for (const stop of sortedStops) {
    // Insert meals that come before this stop's startTime
    while (
      mealIdx < sortedMeals.length &&
      sortedMeals[mealIdx].estimatedTime < stop.startTime
    ) {
      items.push({ kind: "meal", meal: sortedMeals[mealIdx] });
      mealIdx++;
    }
    items.push({ kind: "stop", stop, prayer: stop.prayerGapBefore });
  }
  // Remaining meals after last stop
  while (mealIdx < sortedMeals.length) {
    items.push({ kind: "meal", meal: sortedMeals[mealIdx] });
    mealIdx++;
  }

  return (
    <div className="sf-tl-track" style={{ paddingBlock: "8px" }}>
      {items.map((item, idx) => {
        if (item.kind === "stop") {
          return (
            <div key={`stop-${idx}`}>
              {item.prayer && (
                <PrayerMarker time={item.prayer} language={language} />
              )}
              <StopCard stop={item.stop} t={t} language={language} />
            </div>
          );
        }
        return (
          <MealCard key={`meal-${idx}`} meal={item.meal} t={t} language={language} />
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
  result, trip, t, onRegen, onEdit, language,
}: {
  result: ItineraryResult;
  trip: TripSpec;
  t: (k: string) => string;
  onRegen: () => void;
  onEdit: () => void;
  language: string;
}) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    const id = setTimeout(() => setMounted(true), 80);
    return () => clearTimeout(id);
  }, []);

  const totalStops = result.days.reduce((s, d) => s + d.stops.length, 0);
  const gemCount   = Math.round(result.hiddenGemShare * totalStops);
  const overBudget = result.budgetStatus === "over";
  const budgetPct  = Math.min(1, result.estimatedDailyAvg / trip.budget);

  const sortedObj = OBJ_KEYS
    .map(k => ({ key: k, val: result.objectives[k] }))
    .sort((a, b) => b.val - a.val);

  const cityNamesAr: Record<string, string> = {
    riyadh: "الرياض", jeddah: "جدة", alula: "العُلا",
  };
  const cityDisplay = language === "ar"
    ? (cityNamesAr[trip.city] ?? result.cityName)
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

/* ── Main page ──────────────────────────────────────────────────────── */
export function Itinerary() {
  const [, navigate]   = useLocation();
  const { t, language } = useTranslation();
  useItinStyles();

  const [result, setResult] = useState<ItineraryResult | null>(null);
  const [trip,   setTrip]   = useState<TripSpec | null>(null);
  const [activeDay, setActiveDay] = useState(0);

  useEffect(() => {
    const raw = localStorage.getItem("safarly_itinerary");
    const tripRaw = localStorage.getItem("safarly_trip");
    if (!raw || !tripRaw) { navigate("/trip"); return; }
    try {
      setResult(JSON.parse(raw) as ItineraryResult);
      setTrip(JSON.parse(tripRaw) as TripSpec);
    } catch {
      navigate("/trip");
    }
  }, []);

  function handleRegen() {
    localStorage.removeItem("safarly_itinerary");
    navigate("/generating");
  }

  function handleEdit() {
    navigate("/trip");
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
          onClick={() => navigate("/trip")}
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
      <div style={{
        borderBottom: "1px solid var(--sf-border)",
        background:   "var(--sf-bg)",
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
                    language === "ar" ? "ar-SA" : "en-GB",
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
              <DayTimeline day={currentDay} t={t} language={language} />
            )}
          </div>
        </div>
      </div>

      {/* ── Fixed wrench ghost button ────────────────────────────────── */}
      <button
        id="demo-closure"
        className="sf-wrench-btn"
        aria-label="Demo closure (coming soon)"
        onClick={() => {/* Phase 3 */}}
      >
        <Wrench size={17} aria-hidden />
      </button>
    </div>
  );
}
