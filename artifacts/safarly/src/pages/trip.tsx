/**
 * /trip — Plan a Trip (Prompt B rebuild)
 * Order: Travel Context → Destination → Dates (calendar) → Budget → Mood → Goals (multi)
 * Saves as safarly_trip and navigates to /generating.
 */
import { useState, useEffect, useCallback, useMemo } from "react";
import { useLocation } from "wouter";
import { motion } from "framer-motion";
import { ArrowRight, Calendar, Check, ChevronLeft, ChevronRight, Sparkles, X } from "lucide-react";
import { useTranslation } from "@/providers/translation-context";
import { usePageMeta } from "@/lib/usePageMeta";
import { localeTag } from "@/lib/locale-format";
import {
  currencyForNationality, convertFromSAR, formatCurrencyAmount,
  getCurrencyDisplayPref, setCurrencyDisplayPref,
} from "@/lib/currency";
import poisData from "@/data/pois.json";

/**
 * "Famous for" line on each destination card — the single most recognisable
 * real POI per city, so travellers can place an unfamiliar city (Najran,
 * Khamis Mushait) at a glance instead of picking blind. Takes the first POI
 * listed for that city in pois.json, preferring a verified one — every city's
 * data was authored with its single best-known landmark listed first.
 */
const FAMOUS_POI: Record<string, string> = (() => {
  const byCity = new Map<string, { name: string; verified?: boolean }[]>();
  for (const p of poisData as { city: string; name: string; verified?: boolean }[]) {
    const list = byCity.get(p.city) ?? [];
    list.push(p);
    byCity.set(p.city, list);
  }
  const out: Record<string, string> = {};
  for (const [city, list] of byCity) {
    const best = list.find(p => p.verified) ?? list[0];
    if (best) out[city] = best.name;
  }
  return out;
})();

/* ──────────────────────────────────────────────────────────────────────
   Style injection
   ────────────────────────────────────────────────────────────────────── */
function useTripStyles() {
  useEffect(() => {
    const id = "sf-trip-b-styles";
    if (document.getElementById(id)) return;
    const s = document.createElement("style");
    s.id = id;
    s.textContent = `
      /* Range slider */
      .sf-range-input { -webkit-appearance:none; appearance:none; width:100%; height:4px; border-radius:4px; outline:none; cursor:pointer; background:transparent; }
      .sf-range-input::-webkit-slider-thumb { -webkit-appearance:none; appearance:none; width:22px; height:22px; border-radius:50%; background:var(--sf-accent); border:3px solid var(--sf-bg); box-shadow:0 0 0 2px var(--sf-accent); cursor:pointer; margin-top:-9px; }
      .sf-range-input::-moz-range-thumb { width:22px; height:22px; border-radius:50%; background:var(--sf-accent); border:3px solid var(--sf-bg); box-shadow:0 0 0 2px var(--sf-accent); cursor:pointer; }
      .sf-range-input::-webkit-slider-runnable-track { height:4px; border-radius:4px; }
      .sf-range-input::-moz-range-track { height:4px; border-radius:4px; background:var(--sf-surface-alt); }

      /* Calendar day button hover */
      .sf-cal-day:hover:not(:disabled) { background: var(--sf-surface-alt); }
      .sf-cal-day:disabled { cursor:not-allowed; }

      /* Date tabs */
      .sf-date-tab { flex:1; display:flex; align-items:center; justify-content:center; gap:6px; min-height:44px; padding:0 12px; border-radius:10px; border:1.5px solid var(--sf-border); background:var(--sf-surface); color:var(--sf-text-muted); font-weight:700; font-size:0.875rem; cursor:pointer; transition:all .18s; }
      .sf-date-tab.active { border-color:var(--sf-indigo); background:var(--sf-primary-soft); color:var(--sf-text); }
      .sf-date-input { width:100%; box-sizing:border-box; min-height:48px; padding:0 14px 0 40px; border-radius:10px; border:1.5px solid var(--sf-border); background:var(--sf-surface); color:var(--sf-text); font-size:0.9375rem; outline:none; font-family:inherit; transition:border-color .2s; }
      html[dir="rtl"] .sf-date-input { padding:0 40px 0 14px; }
      .sf-date-input:focus { border-color:var(--sf-indigo); }
      .sf-date-input.has-error { border-color:#EF4444; }

      /* Travel context card */
      .sf-ctx-card { display:flex; flex-direction:column; align-items:center; justify-content:center; gap:6px; padding:14px 10px; border-radius:12px; cursor:pointer; border:1.5px solid var(--sf-border); background:var(--sf-surface); transition:border-color .18s, background .18s; min-height:88px; }
      .sf-ctx-card.selected { border-color:var(--sf-indigo); background:var(--sf-primary-soft); }
      .sf-ctx-card:hover:not(.selected) { border-color:color-mix(in srgb, var(--sf-indigo) 50%, var(--sf-border)); }

      /* Compact city card */
      .sf-city-compact { display:flex; flex-direction:column; padding:14px; border-radius:12px; cursor:pointer; border:1.5px solid var(--sf-border); background:var(--sf-surface); transition:all .18s; min-height:96px; text-align:start; }
      .sf-city-compact.selected { border-color:var(--sf-indigo); background:var(--sf-primary-soft); box-shadow:0 0 0 1px var(--sf-indigo); }
      .sf-city-compact:hover:not(.selected) { border-color:color-mix(in srgb, var(--sf-indigo) 50%, var(--sf-border)); }

      /* Goal card disabled (max selected) */
      .sf-goal-card-disabled { opacity:0.4; pointer-events:none; }

      /* Textarea */
      .sf-textarea { background:var(--sf-surface); color:var(--sf-text); border:1.5px solid var(--sf-border); border-radius:10px; padding:12px 14px; font-size:0.9375rem; width:100%; min-height:88px; outline:none; resize:vertical; transition:border-color .2s; font-family:inherit; line-height:1.55; box-sizing:border-box; }
      .sf-textarea:focus { border-color:var(--sf-indigo); }
      .sf-textarea::placeholder { color:var(--sf-text-muted); }
    `;
    document.head.appendChild(s);
  }, []);
}

/* ──────────────────────────────────────────────────────────────────────
   Section header
   ────────────────────────────────────────────────────────────────────── */
function Section({ title, hint, action, children }: { title: string; hint?: string; action?: React.ReactNode; children: React.ReactNode }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12 }}>
        <div>
          <p style={{
            fontSize: "0.75rem", fontWeight: 700,
            textTransform: "uppercase", letterSpacing: "0.08em",
            color: "var(--sf-text-muted)",
          }}>
            {title}
          </p>
          {hint && (
            <p style={{ fontSize: "0.8125rem", color: "var(--sf-text-muted)", marginTop: "4px", fontWeight: 400 }}>
              {hint}
            </p>
          )}
        </div>
        {action}
      </div>
      {children}
    </div>
  );
}

/* ──────────────────────────────────────────────────────────────────────
   Travel context cards
   ────────────────────────────────────────────────────────────────────── */
const CONTEXT_OPTIONS = [
  { key: "solo_woman", icon: "👩", label: "trip.context.solo_woman" },
  { key: "solo_man",   icon: "🧔", label: "trip.context.solo_man"   },
  { key: "couple",     icon: "💑", label: "trip.context.couple"     },
  { key: "family",     icon: "👨‍👩‍👧", label: "trip.context.family"     },
  { key: "friends",    icon: "🙌", label: "trip.context.friends"    },
] as const;

/* ──────────────────────────────────────────────────────────────────────
   City data
   ────────────────────────────────────────────────────────────────────── */

// Featured (with SVG skylines)
function RiyadhSkyline() {
  return (
    <svg viewBox="0 0 300 70" preserveAspectRatio="xMidYMax meet" aria-hidden style={{ width: "100%", height: "56px", display: "block" }}>
      <path d="M0,70 L0,52 L14,52 L14,42 L20,42 L20,32 L28,32 L28,42 L34,42 L34,48 L42,48 L42,10 L44,9 L47,7 L50,9 L52,10 L52,48 L58,48 L58,34 L68,34 L68,48 L74,48 L74,26 L84,26 L84,48 L90,48 L90,40 L100,40 L100,48 L106,48 L106,16 L114,16 L114,48 L120,48 L120,30 L132,30 L132,48 L140,48 L140,38 L152,38 L152,48 L160,48 L160,22 L170,22 L170,48 L178,48 L178,34 L188,34 L188,48 L196,48 L196,42 L206,42 L206,48 L214,48 L214,28 L224,28 L224,48 L232,48 L232,40 L244,40 L244,52 L252,52 L252,44 L262,44 L262,52 L272,52 L272,46 L284,46 L284,52 L292,52 L292,56 L300,56 L300,70 Z" style={{ fill: "var(--sf-surface-alt)", opacity: 0.9 }} />
      <ellipse cx="47" cy="10" rx="4" ry="3" style={{ fill: "var(--sf-surface)", opacity: 0.6 }} />
    </svg>
  );
}
function JeddahSkyline() {
  return (
    <svg viewBox="0 0 300 70" preserveAspectRatio="xMidYMax meet" aria-hidden style={{ width: "100%", height: "56px", display: "block" }}>
      <ellipse cx="55" cy="18" rx="3" ry="15" style={{ fill: "var(--sf-surface-alt)", opacity: 0.5 }} />
      <path d="M0,70 L0,50 L12,50 L12,38 L22,38 L22,50 L28,50 L28,30 L38,30 L38,50 L44,50 L44,42 L58,42 L58,50 L66,50 L66,36 L74,36 L74,50 L82,50 L82,26 L92,26 L92,50 L100,50 L100,40 L110,40 L110,50 L118,50 L118,32 L128,32 L128,50 L136,50 L136,38 L148,38 L148,50 L156,50 L156,30 L166,30 L166,50 L174,50 L174,42 L184,42 L184,50 L192,50 L192,36 L202,36 L202,50 L210,50 L210,40 L222,40 L222,52 L232,52 L232,44 L244,44 L244,52 L254,52 L254,42 L266,42 L266,52 L276,52 L276,48 L288,48 L288,56 L298,56 L298,60 L300,60 L300,70 Z" style={{ fill: "var(--sf-surface-alt)", opacity: 0.9 }} />
      <ellipse cx="77" cy="32" rx="8" ry="6" style={{ fill: "var(--sf-surface-alt)", opacity: 0.9 }} />
    </svg>
  );
}
function AlUlaSkyline() {
  return (
    <svg viewBox="0 0 300 70" preserveAspectRatio="xMidYMax meet" aria-hidden style={{ width: "100%", height: "56px", display: "block" }}>
      <path d="M0,70 L0,58 Q8,55 15,50 Q22,42 30,48 Q38,38 46,46 Q52,32 60,42 Q68,26 76,38 Q84,24 92,36 Q100,18 108,32 Q116,14 124,28 Q132,20 140,32 Q148,10 156,26 Q164,18 172,30 Q180,22 188,36 Q196,28 204,42 Q212,34 220,46 Q228,38 236,50 Q244,44 252,54 Q260,48 268,56 Q276,52 284,58 L300,58 L300,70 Z" style={{ fill: "var(--sf-surface-alt)", opacity: 0.9 }} />
      <path d="M0,70 L0,64 Q15,60 30,58 Q50,54 68,56 Q90,52 110,57 Q130,54 148,60 Q168,56 188,61 Q210,57 232,62 Q255,58 280,64 L300,66 L300,70 Z" style={{ fill: "var(--sf-surface)", opacity: 0.7 }} />
    </svg>
  );
}

type FeaturedCityId = "riyadh" | "jeddah" | "alula";
const SKYLINES: Record<FeaturedCityId, React.ComponentType> = { riyadh: RiyadhSkyline, jeddah: JeddahSkyline, alula: AlUlaSkyline };

function FeaturedCityCard({ id, title, sub, desc, famousFor, selected, onClick }: {
  id: FeaturedCityId; title: string; sub: string; desc: string; famousFor?: string; selected: boolean; onClick: () => void;
}) {
  const Skyline = SKYLINES[id];
  return (
    <motion.button
      type="button" onClick={onClick}
      whileHover={{ y: -2 }} whileTap={{ scale: 0.98 }}
      style={{
        display: "flex", flexDirection: "column", textAlign: "start",
        cursor: "pointer", borderRadius: "12px", overflow: "hidden",
        border: `2px solid ${selected ? "var(--sf-indigo)" : "var(--sf-border)"}`,
        background: "var(--sf-surface)", transition: "border-color .2s, box-shadow .2s",
        boxShadow: selected ? "0 0 0 1px var(--sf-indigo), 0 8px 24px rgba(0,0,0,0.12)" : "0 2px 8px rgba(0,0,0,0.06)",
        minHeight: "180px", flex: 1,
      }}
    >
      <div style={{ padding: "16px 16px 10px", flex: 1 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
          <div>
            <p style={{ fontSize: "1.0625rem", fontWeight: 800, color: "var(--sf-text)", lineHeight: 1.2, marginBottom: "2px" }}>{title}</p>
            <p style={{ fontSize: "0.6875rem", fontWeight: 700, color: "var(--sf-accent)", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: "5px" }}>{sub}</p>
            <p style={{ fontSize: "0.8rem", color: "var(--sf-text-muted)", lineHeight: 1.4, marginBottom: famousFor ? 4 : 0 }}>{desc}</p>
            {famousFor && (
              <p style={{ fontSize: "0.75rem", color: "var(--sf-text-muted)", lineHeight: 1.3, display: "flex", alignItems: "center", gap: 4 }}>
                <span aria-hidden>📍</span><span style={{ fontWeight: 600 }}>{famousFor}</span>
              </p>
            )}
          </div>
          {selected && (
            <div style={{ width: 20, height: 20, borderRadius: "50%", background: "var(--sf-indigo)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, marginInlineStart: 8 }}>
              <svg width="10" height="10" viewBox="0 0 10 10" fill="none"><path d="M2 5l2.5 2.5 4-4" stroke="white" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" /></svg>
            </div>
          )}
        </div>
      </div>
      <div style={{ background: selected ? "var(--sf-primary-soft)" : "var(--sf-bg)", transition: "background .2s" }}>
        <Skyline />
      </div>
    </motion.button>
  );
}

// Compact city data with emoji icon — every city besides the 3 featured ones
const COMPACT_CITIES = [
  { id: "al_khobar",      icon: "🌊", region: "Eastern Province" },
  { id: "abha",           icon: "⛰️", region: "Aseer Region"     },
  { id: "taif",           icon: "🌹", region: "Hejaz Region"     },
  { id: "madinah",        icon: "🕌", region: "Hejaz Region"     },
  { id: "mecca",          icon: "🕋", region: "Makkah Region"    },
  { id: "dammam",         icon: "🌊", region: "Eastern Province" },
  { id: "dhahran",        icon: "🏛️", region: "Eastern Province" },
  { id: "khamis_mushait", icon: "🏔️", region: "Aseer Region"     },
  { id: "jazan",          icon: "🏝️", region: "Jazan Region"     },
  { id: "najran",         icon: "🏜️", region: "Najran Region"    },
  { id: "tabuk",          icon: "🏰", region: "Tabuk Region"     },
  { id: "hail",           icon: "🐫", region: "Hail Region"      },
  { id: "yanbu",          icon: "🐠", region: "Madinah Region"   },
] as const;

function CompactCityCard({ id, icon, title, sub, desc, famousFor, selected, onClick }: {
  id: string; icon: string; title: string; sub: string; desc: string; famousFor?: string; selected: boolean; onClick: () => void;
}) {
  return (
    <button
      type="button" onClick={onClick}
      className={`sf-city-compact${selected ? " selected" : ""}`}
    >
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 6 }}>
        <span style={{ fontSize: "1.5rem", lineHeight: 1 }}>{icon}</span>
        {selected && (
          <div style={{ width: 18, height: 18, borderRadius: "50%", background: "var(--sf-indigo)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
            <svg width="9" height="9" viewBox="0 0 9 9" fill="none"><path d="M1.5 4.5l2 2 4-4" stroke="white" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" /></svg>
          </div>
        )}
      </div>
      <p style={{ fontWeight: 800, color: "var(--sf-text)", fontSize: "0.9375rem", lineHeight: 1.2, marginBottom: 2 }}>{title}</p>
      <p style={{ fontSize: "0.6875rem", fontWeight: 700, color: "var(--sf-accent)", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 4 }}>{sub}</p>
      <p style={{ fontSize: "0.75rem", color: "var(--sf-text-muted)", lineHeight: 1.35, marginBottom: famousFor ? 4 : 0 }}>{desc}</p>
      {famousFor && (
        <p style={{ fontSize: "0.6875rem", color: "var(--sf-text-muted)", lineHeight: 1.3, display: "flex", alignItems: "center", gap: 4 }}>
          <span aria-hidden>📍</span><span style={{ fontWeight: 600 }}>{famousFor}</span>
        </p>
      )}
    </button>
  );
}

// AI Surprise Me card
function AiCityCard({ selected, onClick, t }: { selected: boolean; onClick: () => void; t: (k: string) => string }) {
  return (
    <motion.button
      type="button" onClick={onClick}
      whileTap={{ scale: 0.98 }}
      style={{
        display: "flex", alignItems: "center", gap: 16,
        padding: "20px 24px", borderRadius: "14px", cursor: "pointer",
        border: `2px solid ${selected ? "var(--sf-indigo)" : "var(--sf-border)"}`,
        background: selected
          ? "linear-gradient(135deg, color-mix(in srgb, var(--sf-indigo) 12%, var(--sf-surface)), color-mix(in srgb, #7C3AED 10%, var(--sf-surface)))"
          : "var(--sf-surface)",
        boxShadow: selected ? "0 0 0 1px var(--sf-indigo)" : "none",
        transition: "all .22s", textAlign: "start", width: "100%",
      }}
    >
      <div style={{
        width: 52, height: 52, borderRadius: "12px", flexShrink: 0,
        background: selected
          ? "linear-gradient(135deg, var(--sf-indigo), #7C3AED)"
          : "var(--sf-surface-alt)",
        display: "flex", alignItems: "center", justifyContent: "center",
        transition: "background .22s",
      }}>
        <Sparkles size={24} style={{ color: selected ? "white" : "var(--sf-text-muted)" }} aria-hidden />
      </div>
      <div style={{ flex: 1 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
          <p style={{ fontWeight: 800, color: "var(--sf-text)", fontSize: "1.0625rem", lineHeight: 1.2 }}>
            {t("trip.city.ai.title")}
          </p>
          <span style={{
            fontSize: "0.625rem", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em",
            padding: "2px 7px", borderRadius: "20px",
            background: "linear-gradient(90deg, var(--sf-indigo), #7C3AED)",
            color: "white",
          }}>
            {t("trip.city.ai.sub")}
          </span>
        </div>
        <p style={{ fontSize: "0.8125rem", color: "var(--sf-text-muted)", lineHeight: 1.45 }}>
          {t("trip.city.ai.desc")}
        </p>
      </div>
      {selected && (
        <div style={{ width: 22, height: 22, borderRadius: "50%", background: "var(--sf-indigo)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
          <svg width="10" height="10" viewBox="0 0 10 10" fill="none"><path d="M2 5l2.5 2.5 4-4" stroke="white" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" /></svg>
        </div>
      )}
    </motion.button>
  );
}

/* ──────────────────────────────────────────────────────────────────────
   Date parsing helpers — locale-aware typed input, ISO storage
   ────────────────────────────────────────────────────────────────────── */
function parseISO(s: string): Date { return new Date(s + "T00:00:00"); }
function fmtISO(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
function isValidYMD(y: number, m: number, d: number): boolean {
  if (!Number.isInteger(y) || !Number.isInteger(m) || !Number.isInteger(d)) return false;
  if (m < 1 || m > 12 || d < 1) return false;
  const dt = new Date(y, m - 1, d);
  return dt.getFullYear() === y && dt.getMonth() === m - 1 && dt.getDate() === d;
}

/** Day/month/year order for the locale's numeric date format, read out of Intl
    rather than hardcoded — so typed input can be parsed the way the user expects. */
function localeDateOrder(locale: string): ("d" | "m" | "y")[] {
  try {
    const parts = new Intl.DateTimeFormat(locale).formatToParts(new Date(2030, 0, 2));
    const order = parts
      .filter(p => p.type === "day" || p.type === "month" || p.type === "year")
      .map(p => (p.type === "day" ? "d" : p.type === "month" ? "m" : "y") as "d" | "m" | "y");
    return order.length === 3 ? order : ["d", "m", "y"];
  } catch {
    return ["d", "m", "y"];
  }
}

/** Parses typed input in the locale's common numeric formats (and always
    accepts ISO yyyy-mm-dd, since that's what re-population uses). Returns an
    ISO date string, or null if the text isn't a recognisable date — callers
    must never feed a null result into calendar state. */
function parseTypedDate(raw: string, order: ("d" | "m" | "y")[]): string | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;

  const iso = /^(\d{4})-(\d{1,2})-(\d{1,2})$/.exec(trimmed);
  if (iso) {
    const y = Number(iso[1]), m = Number(iso[2]), d = Number(iso[3]);
    return isValidYMD(y, m, d) ? fmtISO(new Date(y, m - 1, d)) : null;
  }

  const parts = trimmed.split(/[/\-.\s]+/).filter(Boolean);
  if (parts.length !== 3 || parts.some(p => !/^\d{1,4}$/.test(p))) return null;

  let day: number | null = null, month: number | null = null, year: number | null = null;
  const yearIdx = parts.findIndex(p => p.length === 4);

  if (yearIdx !== -1) {
    year = Number(parts[yearIdx]);
    const rest = parts.filter((_, i) => i !== yearIdx).map(Number);
    const restOrder = order.filter(o => o !== "y");
    if (restOrder[0] === "d") { [day, month] = rest; } else { [month, day] = rest; }
  } else {
    const nums = parts.map(Number);
    order.forEach((o, i) => {
      if (o === "d") day = nums[i];
      else if (o === "m") month = nums[i];
      else year = nums[i] < 100 ? 2000 + nums[i] : nums[i];
    });
  }

  if (day == null || month == null || year == null) return null;
  return isValidYMD(year, month, day) ? fmtISO(new Date(year, month - 1, day)) : null;
}

/* ──────────────────────────────────────────────────────────────────────
   Mini calendar — single-date picker, used inside each date tab
   ────────────────────────────────────────────────────────────────────── */
function MiniCalendar({ value, min, onSelect, isRTL, locale }: {
  value: string; min: string; onSelect: (iso: string) => void; isRTL: boolean; locale: string;
}) {
  const anchor = value ? parseISO(value) : parseISO(min);
  const [viewYear, setViewYear]   = useState(anchor.getFullYear());
  const [viewMonth, setViewMonth] = useState(anchor.getMonth());

  // Jump the visible month when the selected value changes externally
  // (typed input commits, or switching tabs to a date that's already set).
  useEffect(() => {
    const d = value ? parseISO(value) : parseISO(min);
    setViewYear(d.getFullYear());
    setViewMonth(d.getMonth());
  }, [value, min]);

  const prevMonth = useCallback(() => {
    if (viewMonth === 0) { setViewMonth(11); setViewYear(y => y - 1); }
    else setViewMonth(m => m - 1);
  }, [viewMonth]);

  const nextMonth = useCallback(() => {
    if (viewMonth === 11) { setViewMonth(0); setViewYear(y => y + 1); }
    else setViewMonth(m => m + 1);
  }, [viewMonth]);

  const firstWeekday = new Date(viewYear, viewMonth, 1).getDay();
  const daysInMonth  = new Date(viewYear, viewMonth + 1, 0).getDate();
  const cells: (number | null)[] = [
    ...Array(firstWeekday).fill(null),
    ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
  ];
  while (cells.length % 7 !== 0) cells.push(null);

  const monthLabel = new Date(viewYear, viewMonth, 1).toLocaleDateString(locale, { month: "long", year: "numeric" });
  // Jan 4 1970 was a Sunday — used as a locale-agnostic anchor to read short
  // weekday names out of Intl rather than hardcoding English abbreviations.
  const weekDayLabels = useMemo(() => {
    const fmt = new Intl.DateTimeFormat(locale, { weekday: "short" });
    return Array.from({ length: 7 }, (_, i) => fmt.format(new Date(1970, 0, 4 + i)));
  }, [locale]);

  const todayISO = fmtISO(new Date());
  const PrevIcon = isRTL ? ChevronRight : ChevronLeft;
  const NextIcon = isRTL ? ChevronLeft  : ChevronRight;

  return (
    <div style={{
      background: "var(--sf-surface)", borderRadius: "14px",
      border: "1.5px solid var(--sf-border)", overflow: "hidden",
    }}>
      <div style={{
        display: "flex", alignItems: "center", justifyContent: "space-between",
        padding: "14px 16px", borderBottom: "1px solid var(--sf-border)",
      }}>
        <button type="button" onClick={prevMonth} aria-label="Previous month" style={{
          width: 36, height: 36, borderRadius: 8, border: "1px solid var(--sf-border)",
          background: "var(--sf-surface-alt)", cursor: "pointer", color: "var(--sf-text)",
          display: "flex", alignItems: "center", justifyContent: "center",
        }}>
          <PrevIcon size={16} aria-hidden />
        </button>
        <span style={{ fontWeight: 700, fontSize: "0.9375rem", color: "var(--sf-text)" }}>
          {monthLabel}
        </span>
        <button type="button" onClick={nextMonth} aria-label="Next month" style={{
          width: 36, height: 36, borderRadius: 8, border: "1px solid var(--sf-border)",
          background: "var(--sf-surface-alt)", cursor: "pointer", color: "var(--sf-text)",
          display: "flex", alignItems: "center", justifyContent: "center",
        }}>
          <NextIcon size={16} aria-hidden />
        </button>
      </div>

      <div style={{ padding: "12px 12px 16px" }}>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: 2, marginBottom: 4 }}>
          {weekDayLabels.map(d => (
            <div key={d} style={{ textAlign: "center", fontSize: "0.6875rem", color: "var(--sf-text-muted)", fontWeight: 700, padding: "4px 0" }}>{d}</div>
          ))}
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: 2 }}>
          {cells.map((day, i) => {
            if (!day) return <div key={i} />;
            const m = String(viewMonth + 1).padStart(2, "0");
            const d = String(day).padStart(2, "0");
            const ds = `${viewYear}-${m}-${d}`;
            const disabled = ds < min;
            const selected = ds === value;
            const isToday  = ds === todayISO;

            return (
              <button
                key={ds} type="button"
                className="sf-cal-day"
                disabled={disabled}
                onClick={() => onSelect(ds)}
                style={{
                  minHeight: 38, borderRadius: 8, border: "none",
                  background: selected ? "var(--sf-indigo)" : "transparent",
                  color: selected ? "white" : disabled ? "var(--sf-border)" : "var(--sf-text)",
                  fontWeight: selected || isToday ? 700 : 400,
                  fontSize: "0.875rem",
                  outline: isToday && !selected ? "2px solid var(--sf-border)" : "none",
                  outlineOffset: -2,
                  transition: "background .12s",
                  cursor: disabled ? "not-allowed" : "pointer",
                }}
                aria-label={`${day} ${monthLabel}`}
                aria-pressed={selected}
              >
                {day}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}

/* ──────────────────────────────────────────────────────────────────────
   Date tabs — arrival / departure, each with typed input + calendar
   ────────────────────────────────────────────────────────────────────── */
interface DateTabsProps {
  startDate: string;
  endDate: string;
  onChange: (start: string, end: string) => void;
  isRTL: boolean;
  locale: string;
  t: (k: string) => string;
}

type DateTab = "arrival" | "departure";

function DateTabsPicker({ startDate, endDate, onChange, isRTL, locale, t }: DateTabsProps) {
  const todayISO = fmtISO(new Date());
  const order = useMemo(() => localeDateOrder(locale), [locale]);
  // Dec 25 2030 — unambiguous day/month, used only to render a "how to type
  // this" example in the locale's own numeric format.
  const exampleText = useMemo(() => new Date(2030, 11, 25).toLocaleDateString(locale), [locale]);

  const [activeTab, setActiveTab] = useState<DateTab>("arrival");
  const [arrivalInput, setArrivalInput]     = useState(startDate ? parseISO(startDate).toLocaleDateString(locale) : "");
  const [departureInput, setDepartureInput] = useState(endDate ? parseISO(endDate).toLocaleDateString(locale) : "");
  const [arrivalError, setArrivalError]     = useState("");
  const [departureError, setDepartureError] = useState("");

  // Re-sync the text fields when the stored date changes from outside typing
  // (calendar picks, the other tab clearing a now-invalid range, Edit Trip prefill).
  useEffect(() => {
    setArrivalInput(startDate ? parseISO(startDate).toLocaleDateString(locale) : "");
  }, [startDate, locale]);
  useEffect(() => {
    setDepartureInput(endDate ? parseISO(endDate).toLocaleDateString(locale) : "");
  }, [endDate, locale]);

  function commitArrival(iso: string | null, raw: string) {
    if (raw.trim() === "") { setArrivalError(""); onChange("", endDate); return; }
    if (!iso) { setArrivalError(t("trip.dates.error.invalid")); return; }
    if (iso < todayISO) { setArrivalError(t("trip.dates.error.past")); return; }
    setArrivalError("");
    const nextEnd = endDate && endDate <= iso ? "" : endDate;
    onChange(iso, nextEnd);
    setActiveTab("departure");
  }

  function commitDeparture(iso: string | null, raw: string) {
    if (raw.trim() === "") { setDepartureError(""); onChange(startDate, ""); return; }
    if (!iso) { setDepartureError(t("trip.dates.error.invalid")); return; }
    if (startDate && iso <= startDate) { setDepartureError(t("trip.dates.error.order")); return; }
    if (!startDate && iso < todayISO) { setDepartureError(t("trip.dates.error.past")); return; }
    setDepartureError("");
    onChange(startDate, iso);
  }

  function handleClear() {
    onChange("", "");
    setArrivalError(""); setDepartureError("");
  }

  const nights = startDate && endDate
    ? Math.round((parseISO(endDate).getTime() - parseISO(startDate).getTime()) / 86400000)
    : 0;
  function fmtDisplay(ds: string) {
    return parseISO(ds).toLocaleDateString(locale, { day: "numeric", month: "short" });
  }

  const isArrival   = activeTab === "arrival";
  const activeValue = isArrival ? arrivalInput : departureInput;
  const activeError = isArrival ? arrivalError : departureError;
  const departureMin = startDate
    ? fmtISO(new Date(parseISO(startDate).getTime() + 86400000))
    : todayISO;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      {/* Tabs */}
      <div role="tablist" style={{ display: "flex", gap: 8 }}>
        <button
          type="button" role="tab" aria-selected={isArrival}
          className={`sf-date-tab${isArrival ? " active" : ""}`}
          onClick={() => setActiveTab("arrival")}
        >
          {startDate && <Check size={14} aria-hidden />}
          {t("trip.dates.tab.arrival")}
        </button>
        <button
          type="button" role="tab" aria-selected={!isArrival}
          className={`sf-date-tab${!isArrival ? " active" : ""}`}
          onClick={() => setActiveTab("departure")}
        >
          {endDate && <Check size={14} aria-hidden />}
          {t("trip.dates.tab.departure")}
        </button>
      </div>

      {/* Typed input for the active tab */}
      <div>
        <div style={{ position: "relative" }}>
          <Calendar size={15} aria-hidden style={{
            position: "absolute", top: "50%", transform: "translateY(-50%)",
            insetInlineStart: 14, color: "var(--sf-text-muted)", pointerEvents: "none",
          }} />
          <input
            type="text" inputMode="numeric" autoComplete="off"
            className={`sf-date-input${activeError ? " has-error" : ""}`}
            value={activeValue}
            placeholder={t("trip.dates.format_hint").replace("{example}", exampleText)}
            aria-label={isArrival ? t("trip.dates.tab.arrival") : t("trip.dates.tab.departure")}
            aria-invalid={!!activeError}
            onChange={e => {
              const v = e.target.value;
              const iso = parseTypedDate(v, order);
              if (isArrival) { setArrivalInput(v); commitArrival(iso, v); }
              else            { setDepartureInput(v); commitDeparture(iso, v); }
            }}
          />
        </div>
        <p style={{ fontSize: "0.75rem", color: "var(--sf-text-muted)", marginTop: 6 }}>
          {t("trip.dates.format_hint").replace("{example}", exampleText)}
        </p>
        {activeError && (
          <p role="alert" style={{ fontSize: "0.8125rem", color: "#EF4444", fontWeight: 600, marginTop: 4 }}>
            {activeError}
          </p>
        )}
      </div>

      {/* Calendar for the active tab */}
      <MiniCalendar
        key={activeTab}
        value={isArrival ? startDate : endDate}
        min={isArrival ? todayISO : departureMin}
        onSelect={ds => isArrival ? commitArrival(ds, ds) : commitDeparture(ds, ds)}
        isRTL={isRTL}
        locale={locale}
      />

      {/* Summary bar */}
      <div style={{
        padding: "10px 16px", borderRadius: 12,
        border: "1px solid var(--sf-border)", background: "var(--sf-surface)",
        display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8,
        minHeight: 48,
      }}>
        {!startDate && (
          <span style={{ fontSize: "0.8125rem", color: "var(--sf-text-muted)" }}>
            {t("trip.dates.select_start")}
          </span>
        )}
        {startDate && !endDate && (
          <span style={{ fontSize: "0.8125rem", color: "var(--sf-text-muted)" }}>
            <span style={{ color: "var(--sf-indigo)", fontWeight: 700 }}>{fmtDisplay(startDate)}</span>
            {" "}→ {t("trip.dates.select_end")}
          </span>
        )}
        {startDate && endDate && (
          <span style={{ fontSize: "0.875rem", color: "var(--sf-text)", fontWeight: 500 }}>
            <span style={{ color: "var(--sf-indigo)", fontWeight: 700 }}>{fmtDisplay(startDate)}</span>
            {" → "}
            <span style={{ color: "var(--sf-indigo)", fontWeight: 700 }}>{fmtDisplay(endDate)}</span>
            <span style={{ color: "var(--sf-text-muted)", marginInlineStart: 8 }}>
              · {t(nights === 1 ? "trip.dates.nights" : "trip.dates.nights_plural").replace("{n}", String(nights))}
            </span>
          </span>
        )}
        {(startDate || endDate) && (
          <button
            type="button"
            onClick={handleClear}
            aria-label={t("trip.dates.clear")}
            style={{
              background: "none", border: "none", cursor: "pointer",
              color: "var(--sf-text-muted)", padding: 4, borderRadius: 4, display: "flex",
            }}
          >
            <X size={14} aria-hidden />
          </button>
        )}
      </div>
    </div>
  );
}

/* ──────────────────────────────────────────────────────────────────────
   Budget slider
   ────────────────────────────────────────────────────────────────────── */
function BudgetSlider({ value, onChange, displayCurrency, locale, t }: {
  value: number; onChange: (v: number) => void;
  displayCurrency: string; locale: string; t: (k: string) => string;
}) {
  // The slider itself always operates in SAR — only these labels convert.
  const min = 500, max = 10000;
  const pct = ((value - min) / (max - min)) * 100;

  function label(amountSAR: number): string {
    if (displayCurrency === "SAR") return `SAR ${amountSAR.toLocaleString(locale)}`;
    return formatCurrencyAmount(convertFromSAR(amountSAR, displayCurrency), displayCurrency, locale);
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <span style={{ color: "var(--sf-text-muted)", fontSize: "0.8125rem" }}><bdi>{label(min)}</bdi></span>
        <div style={{ padding: "4px 14px", borderRadius: "20px", background: "var(--sf-primary-soft)", border: "1.5px solid var(--sf-indigo)", fontWeight: 700, fontSize: "1rem", color: "var(--sf-text)" }}>
          <bdi>{label(value)}</bdi>
        </div>
        <span style={{ color: "var(--sf-text-muted)", fontSize: "0.8125rem" }}><bdi>{label(max)}</bdi></span>
      </div>
      <div style={{ position: "relative", paddingBlock: 10 }}>
        <div style={{ position: "absolute", top: "50%", transform: "translateY(-50%)", insetInlineStart: 0, width: "100%", height: 4, borderRadius: 4, background: "var(--sf-surface-alt)", pointerEvents: "none" }} />
        <div style={{ position: "absolute", top: "50%", transform: "translateY(-50%)", insetInlineStart: 0, width: `${pct}%`, height: 4, borderRadius: 4, background: "var(--sf-accent)", pointerEvents: "none", transition: "width .1s" }} />
        <input type="range" min={min} max={max} step={100} value={value} onChange={e => onChange(Number(e.target.value))} className="sf-range-input" style={{ position: "relative", zIndex: 1 }} />
      </div>
      {displayCurrency !== "SAR" && (
        <p style={{ fontSize: "0.6875rem", color: "var(--sf-text-muted)", textAlign: "center" }}>
          {t("trip.budget.approx")}
        </p>
      )}
    </div>
  );
}

/* ──────────────────────────────────────────────────────────────────────
   Currency toggle — SAR vs. the user's home currency, display-only
   ────────────────────────────────────────────────────────────────────── */
function CurrencyToggle({ options, active, onChange, groupLabel }: {
  options: string[]; active: string; onChange: (code: string) => void; groupLabel: string;
}) {
  return (
    <div
      role="tablist" aria-label={groupLabel}
      style={{
        display: "inline-flex", flexShrink: 0, gap: 2, padding: 2,
        borderRadius: 999, border: "1px solid var(--sf-border)", background: "var(--sf-surface)",
      }}
    >
      {options.map(code => (
        <button
          key={code} type="button" role="tab" aria-selected={active === code}
          onClick={() => onChange(code)}
          style={{
            minHeight: 28, padding: "4px 12px", borderRadius: 999, border: "none",
            fontSize: "0.75rem", fontWeight: 700, cursor: "pointer",
            background: active === code ? "var(--sf-indigo)" : "transparent",
            color: active === code ? "#fff" : "var(--sf-text-muted)",
            transition: "all .15s",
          }}
        >
          {code}
        </button>
      ))}
    </div>
  );
}

/* ──────────────────────────────────────────────────────────────────────
   Chip (mood)
   ────────────────────────────────────────────────────────────────────── */
function Chip({ label, icon, selected, onClick }: { label: string; icon?: string; selected: boolean; onClick: () => void }) {
  return (
    <button type="button" onClick={onClick} style={{
      minHeight: 44, padding: "8px 16px", borderRadius: 10,
      border: `1.5px solid ${selected ? "var(--sf-indigo)" : "var(--sf-border)"}`,
      background: selected ? "var(--sf-primary-soft)" : "var(--sf-surface)",
      color: selected ? "var(--sf-text)" : "var(--sf-text-muted)",
      fontWeight: 500, fontSize: "0.875rem", cursor: "pointer",
      display: "inline-flex", alignItems: "center", gap: 6,
      whiteSpace: "nowrap", transition: "all .18s",
    }}>
      {icon && <span>{icon}</span>}
      {label}
    </button>
  );
}

/* ──────────────────────────────────────────────────────────────────────
   Goal card (multi-select)
   ────────────────────────────────────────────────────────────────────── */
function GoalCard({ icon, title, desc, selected, onClick, disabled }: {
  icon: string; title: string; desc: string; selected: boolean; onClick: () => void; disabled: boolean;
}) {
  return (
    <button
      type="button" onClick={onClick}
      className={disabled && !selected ? "sf-goal-card-disabled" : ""}
      style={{
        display: "flex", alignItems: "flex-start", gap: 12,
        padding: "14px 16px", borderRadius: 10, textAlign: "start",
        border: `1.5px solid ${selected ? "var(--sf-indigo)" : "var(--sf-border)"}`,
        background: selected ? "var(--sf-primary-soft)" : "var(--sf-surface)",
        cursor: disabled && !selected ? "not-allowed" : "pointer",
        transition: "all .18s", minHeight: 64,
        boxShadow: selected ? "0 0 0 1px var(--sf-indigo)" : "none",
        width: "100%",
      }}
    >
      <span style={{ fontSize: "1.25rem", flexShrink: 0, marginTop: 1 }}>{icon}</span>
      <div style={{ flex: 1 }}>
        <p style={{ fontWeight: 700, color: "var(--sf-text)", fontSize: "0.9375rem", lineHeight: 1.3 }}>{title}</p>
        <p style={{ color: "var(--sf-text-muted)", fontSize: "0.8125rem", marginTop: 2, lineHeight: 1.4 }}>{desc}</p>
      </div>
      {selected && (
        <svg width="16" height="16" viewBox="0 0 16 16" fill="none" style={{ flexShrink: 0, marginTop: 2 }}>
          <path d="M3 8l4 4 6-6" stroke="var(--sf-indigo)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      )}
    </button>
  );
}

/* ──────────────────────────────────────────────────────────────────────
   Main page
   ────────────────────────────────────────────────────────────────────── */
const MAX_GOALS = 3;

export function Trip() {
  useTripStyles();
  const { t, language } = useTranslation();
  const isRTL = language === "ar";
  usePageMeta("Plan Your Journey", "Choose your destination, dates, budget and travel goals.");
  const [, navigate] = useLocation();

  /* State */
  const [travelContext, setTravelContext] = useState("");
  const [city, setCity]                   = useState("");
  const [dateStart, setDateStart]         = useState("");
  const [dateEnd, setDateEnd]             = useState("");
  const [budget, setBudget]               = useState(3000);
  const [moods, setMoods]                 = useState<string[]>([]);
  const [goals, setGoals]                 = useState<string[]>([]);

  /* Home currency, derived from the profile's nationality — display only,
     never touches the SAR values stored in trip/budget state. */
  const [userCurrency, setUserCurrency] = useState<string | null>(null);
  useEffect(() => {
    try {
      const profile = JSON.parse(localStorage.getItem("safarly_profile") ?? "null") as { nationality?: string } | null;
      setUserCurrency(currencyForNationality(profile?.nationality));
    } catch { /* no profile yet */ }
  }, []);
  const showCurrencyToggle = !!userCurrency && userCurrency !== "SAR";

  const [displayCurrency, setDisplayCurrency] = useState("SAR");
  useEffect(() => {
    setDisplayCurrency(showCurrencyToggle && getCurrencyDisplayPref() === "home" ? userCurrency! : "SAR");
  }, [showCurrencyToggle, userCurrency]);

  function handleCurrencyToggle(code: string) {
    setDisplayCurrency(code);
    setCurrencyDisplayPref(code === "SAR" ? "sar" : "home");
  }

  /* Prefill from saved trip on mount (Edit Trip flow) */
  useEffect(() => {
    try {
      const raw = localStorage.getItem("safarly_trip");
      if (!raw) return;
      const saved = JSON.parse(raw) as Record<string, unknown>;
      if (typeof saved.travelContext === "string") setTravelContext(saved.travelContext);
      if (typeof saved.city         === "string") setCity(saved.city);
      if (typeof saved.dateStart    === "string") setDateStart(saved.dateStart);
      if (typeof saved.dateEnd      === "string") setDateEnd(saved.dateEnd);
      if (typeof saved.budget       === "number") setBudget(saved.budget);
      if (Array.isArray(saved.moods)) setMoods(saved.moods as string[]);
      if (Array.isArray(saved.goals)) setGoals(saved.goals as string[]);
    } catch { /* ignore parse errors */ }
  }, []);

  function toggleMood(m: string) {
    setMoods(prev => prev.includes(m) ? prev.filter(x => x !== m) : [...prev, m]);
  }
  function toggleGoal(g: string) {
    setGoals(prev => {
      if (prev.includes(g)) return prev.filter(x => x !== g);
      if (prev.length >= MAX_GOALS) return prev; // max reached
      return [...prev, g];
    });
  }

  function handleGenerate() {
    const trip = { city, dateStart, dateEnd, budget, moods, goals, travelContext };
    localStorage.setItem("safarly_trip", JSON.stringify(trip));
    navigate("/generating");
  }

  const featuredCities: FeaturedCityId[] = ["riyadh", "jeddah", "alula"];
  const moodList = [
    { key: "relax", icon: "🌊" }, { key: "adventure", icon: "🧗" },
    { key: "romantic", icon: "🌹" }, { key: "luxury", icon: "✨" },
    { key: "spiritual", icon: "🕌" }, { key: "family", icon: "👨‍👩‍👧" },
    { key: "photography", icon: "📸" }, { key: "food", icon: "🍽️" },
  ];
  const goalList = [
    { key: "culture",   icon: "🏛️" }, { key: "food",     icon: "🍽️" },
    { key: "gems",      icon: "💎" }, { key: "family",   icon: "👨‍👩‍👧‍👦" },
    { key: "budget",    icon: "💰" }, { key: "photo",    icon: "📸" },
    { key: "spiritual", icon: "🕌" },
  ];

  const canGenerate = !!travelContext && !!city && !!dateStart && !!dateEnd;

  return (
    <div style={{ paddingTop: 68, background: "var(--sf-bg)", minHeight: "100dvh" }}>

      {/* Page header */}
      <div style={{ padding: "28px 20px 22px", borderBottom: "1px solid var(--sf-border)" }}>
        <div style={{ maxWidth: 720, margin: "0 auto" }}>
          <h1 style={{ fontSize: "clamp(1.5rem, 4vw, 2rem)", fontWeight: 800, color: "var(--sf-text)", letterSpacing: "-0.02em", marginBottom: 6 }}>
            {t("trip.title")}
          </h1>
          <p style={{ color: "var(--sf-text-muted)", fontSize: "0.9375rem" }}>
            {t("trip.subtitle")}
          </p>
        </div>
      </div>

      <div style={{ maxWidth: 720, margin: "0 auto", padding: "28px 20px 120px" }}>
        <div style={{ display: "flex", flexDirection: "column", gap: 40 }}>

          {/* ── 1. Travel Context ── */}
          <Section title={t("trip.context.label")}>
            <div style={{
              display: "grid",
              gridTemplateColumns: "repeat(5, 1fr)",
              gap: 8,
            }}>
              {CONTEXT_OPTIONS.map(({ key, icon, label }) => (
                <button
                  key={key} type="button"
                  onClick={() => setTravelContext(travelContext === key ? "" : key)}
                  className={`sf-ctx-card${travelContext === key ? " selected" : ""}`}
                >
                  <span style={{ fontSize: "1.625rem", lineHeight: 1 }}>{icon}</span>
                  <span style={{ fontSize: "0.75rem", fontWeight: 600, color: travelContext === key ? "var(--sf-text)" : "var(--sf-text-muted)", textAlign: "center", lineHeight: 1.3 }}>
                    {t(label)}
                  </span>
                </button>
              ))}
            </div>
          </Section>

          {/* ── 2. Destination ── */}
          <Section title={t("trip.city.label")}>
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>

              {/* Featured 3 */}
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 12 }}>
                {featuredCities.map(id => (
                  <FeaturedCityCard
                    key={id} id={id}
                    title={t(`trip.city.${id}.title`)}
                    sub={t(`trip.city.${id}.sub`)}
                    desc={t(`trip.city.${id}.desc`)}
                    famousFor={FAMOUS_POI[id]}
                    selected={city === id}
                    onClick={() => setCity(city === id ? "" : id)}
                  />
                ))}
              </div>

              {/* More destinations label */}
              <p style={{ fontSize: "0.6875rem", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.07em", color: "var(--sf-text-muted)", marginTop: 4 }}>
                {t("trip.city.more")}
              </p>

              {/* Every other city — all 16 Saudi destinations are now selectable */}
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(150px, 1fr))", gap: 10 }}>
                {COMPACT_CITIES.map(({ id, icon }) => (
                  <CompactCityCard
                    key={id} id={id} icon={icon}
                    title={t(`trip.city.${id}.title`)}
                    sub={t(`trip.city.${id}.sub`)}
                    desc={t(`trip.city.${id}.desc`)}
                    famousFor={FAMOUS_POI[id]}
                    selected={city === id}
                    onClick={() => setCity(city === id ? "" : id)}
                  />
                ))}
              </div>

              {/* AI Surprise card */}
              <AiCityCard
                selected={city === "ai"}
                onClick={() => setCity(city === "ai" ? "" : "ai")}
                t={t}
              />
            </div>
          </Section>

          {/* ── 3. Dates ── */}
          <Section title={t("trip.dates.label")}>
            <DateTabsPicker
              startDate={dateStart}
              endDate={dateEnd}
              onChange={(s, e) => { setDateStart(s); setDateEnd(e); }}
              isRTL={isRTL}
              locale={localeTag(language)}
              t={t}
            />
          </Section>

          {/* ── 4. Budget ── */}
          <Section
            title={t("trip.budget.label")}
            action={showCurrencyToggle && (
              <CurrencyToggle
                options={["SAR", userCurrency!]}
                active={displayCurrency}
                onChange={handleCurrencyToggle}
                groupLabel={t("trip.budget.currency_toggle_label")}
              />
            )}
          >
            <BudgetSlider
              value={budget} onChange={setBudget}
              displayCurrency={displayCurrency} locale={localeTag(language)} t={t}
            />
          </Section>

          {/* ── 5. Mood ── */}
          <Section title={t("trip.mood.label")}>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
              {moodList.map(({ key, icon }) => (
                <Chip key={key} label={t(`trip.mood.${key}`)} icon={icon} selected={moods.includes(key)} onClick={() => toggleMood(key)} />
              ))}
            </div>
          </Section>

          {/* ── 6. Goals (multi-select) ── */}
          <Section title={t("trip.goal.label")} hint={t("trip.goal.hint")}>
            {/* Selected count badge */}
            {goals.length > 0 && (
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                {goals.map(g => (
                  <span key={g} style={{
                    display: "inline-flex", alignItems: "center", gap: 5,
                    padding: "4px 10px", borderRadius: 20,
                    background: "var(--sf-primary-soft)", border: "1px solid var(--sf-indigo)",
                    fontSize: "0.75rem", fontWeight: 700, color: "var(--sf-text)",
                  }}>
                    {t(`trip.goal.${g}.title`)}
                    <button type="button" onClick={() => toggleGoal(g)} style={{ background: "none", border: "none", cursor: "pointer", padding: 0, color: "var(--sf-text-muted)", lineHeight: 1 }}>
                      <X size={12} aria-hidden />
                    </button>
                  </span>
                ))}
              </div>
            )}
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {goalList.map(({ key, icon }) => (
                <GoalCard
                  key={key} icon={icon}
                  title={t(`trip.goal.${key}.title`)}
                  desc={t(`trip.goal.${key}.desc`)}
                  selected={goals.includes(key)}
                  disabled={goals.length >= MAX_GOALS && !goals.includes(key)}
                  onClick={() => toggleGoal(key)}
                />
              ))}
            </div>
          </Section>

          {/* ── CTA ── */}
          <motion.button
            type="button" onClick={handleGenerate} disabled={!canGenerate}
            whileTap={canGenerate ? { scale: 0.97 } : {}}
            style={{
              width: "100%", minHeight: 60, borderRadius: 10, border: "none",
              background: canGenerate ? "var(--sf-accent)" : "var(--sf-surface-alt)",
              color: canGenerate ? "#0A0E16" : "var(--sf-text-muted)",
              fontWeight: 700, fontSize: "1.0625rem",
              cursor: canGenerate ? "pointer" : "not-allowed",
              display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
              transition: "background .2s, color .2s",
              boxShadow: canGenerate ? "0 0 24px rgba(0,216,164,0.28)" : "none",
            }}
            onMouseEnter={e => { if (canGenerate) e.currentTarget.style.background = "var(--sf-accent-hover)"; }}
            onMouseLeave={e => { if (canGenerate) e.currentTarget.style.background = "var(--sf-accent)"; }}
          >
            {t("trip.cta")}
            <ArrowRight size={20} className="rtl:hidden" style={{ flexShrink: 0 }} />
          </motion.button>

          {!canGenerate && (
            <p style={{ textAlign: "center", fontSize: "0.8125rem", color: "var(--sf-text-muted)", marginTop: -20 }}>
              {t("trip.hint")}
            </p>
          )}

        </div>
      </div>
    </div>
  );
}
