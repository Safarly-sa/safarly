/**
 * /trip — Plan a Trip (Prompt B rebuild)
 * Order: Travel Context → Destination → Dates (calendar) → Budget → Mood → Goals (multi)
 * Saves as safarly_trip and navigates to /generating.
 */
import { useState, useEffect, useCallback } from "react";
import { useLocation } from "wouter";
import { motion } from "framer-motion";
import { ArrowRight, ChevronLeft, ChevronRight, Sparkles, X } from "lucide-react";
import { useTranslation } from "@/providers/translation-context";
import { usePageMeta } from "@/lib/usePageMeta";

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
function Section({ title, hint, children }: { title: string; hint?: string; children: React.ReactNode }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
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

function FeaturedCityCard({ id, title, sub, desc, selected, onClick }: {
  id: FeaturedCityId; title: string; sub: string; desc: string; selected: boolean; onClick: () => void;
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
            <p style={{ fontSize: "0.8rem", color: "var(--sf-text-muted)", lineHeight: 1.4 }}>{desc}</p>
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

// Compact city data with emoji icon
const COMPACT_CITIES = [
  { id: "al_khobar", icon: "🌊", region: "Eastern Province" },
  { id: "abha",      icon: "⛰️", region: "Aseer Region"     },
  { id: "taif",      icon: "🌹", region: "Hejaz Region"     },
  { id: "madinah",   icon: "🕌", region: "Hejaz Region"     },
] as const;

function CompactCityCard({ id, icon, title, sub, desc, selected, onClick }: {
  id: string; icon: string; title: string; sub: string; desc: string; selected: boolean; onClick: () => void;
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
      <p style={{ fontSize: "0.75rem", color: "var(--sf-text-muted)", lineHeight: 1.35 }}>{desc}</p>
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
   Calendar date-range picker
   ────────────────────────────────────────────────────────────────────── */
interface CalendarProps {
  startDate: string;
  endDate: string;
  onChange: (start: string, end: string) => void;
  isRTL: boolean;
}

function CalendarPicker({ startDate, endDate, onChange, isRTL }: CalendarProps) {
  const todayDate = new Date();
  todayDate.setHours(0, 0, 0, 0);

  const [viewYear, setViewYear]   = useState(todayDate.getFullYear());
  const [viewMonth, setViewMonth] = useState(todayDate.getMonth());
  const [hover, setHover]         = useState("");

  // When a pre-filled startDate arrives (Edit Trip flow), jump the calendar to that month
  useEffect(() => {
    if (!startDate) return;
    const d = new Date(startDate + "T00:00:00");
    setViewYear(d.getFullYear());
    setViewMonth(d.getMonth());
  }, [startDate]);

  function parseD(s: string) { return new Date(s + "T00:00:00"); }
  function fmtD(d: Date) { return d.toISOString().split("T")[0]; }
  function isPast(s: string) { return parseD(s) < todayDate; }

  function handleDay(ds: string) {
    if (isPast(ds)) return;
    if (!startDate || (startDate && endDate)) {
      onChange(ds, "");
    } else {
      const d = parseD(ds), s = parseD(startDate);
      if (d < s)       { onChange(ds, ""); }
      else if (d.getTime() === s.getTime()) { onChange("", ""); }
      else              { onChange(startDate, ds); }
    }
  }

  function isStart(ds: string)  { return ds === startDate; }
  function isEnd(ds: string)    { return ds === endDate; }
  function inRange(ds: string)  {
    if (!startDate) return false;
    const d = parseD(ds);
    const s = parseD(startDate);
    const eStr = endDate || hover;
    if (!eStr) return false;
    const e = parseD(eStr);
    return d > s && d < e;
  }

  const prevMonth = useCallback(() => {
    if (viewMonth === 0) { setViewMonth(11); setViewYear(y => y - 1); }
    else setViewMonth(m => m - 1);
  }, [viewMonth]);

  const nextMonth = useCallback(() => {
    if (viewMonth === 11) { setViewMonth(0); setViewYear(y => y + 1); }
    else setViewMonth(m => m + 1);
  }, [viewMonth]);

  // Build grid
  const firstWeekday = new Date(viewYear, viewMonth, 1).getDay(); // 0=Sun
  const daysInMonth  = new Date(viewYear, viewMonth + 1, 0).getDate();
  const cells: (number | null)[] = [
    ...Array(firstWeekday).fill(null),
    ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
  ];
  while (cells.length % 7 !== 0) cells.push(null);

  const monthLabel = new Date(viewYear, viewMonth, 1).toLocaleDateString("en-US", { month: "long", year: "numeric" });
  const weekDayLabels = ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"];

  const nights = startDate && endDate
    ? Math.round((parseD(endDate).getTime() - parseD(startDate).getTime()) / 86400000)
    : 0;

  function fmtDisplay(ds: string) {
    return parseD(ds).toLocaleDateString("en-GB", { day: "numeric", month: "short" });
  }

  const PrevIcon = isRTL ? ChevronRight : ChevronLeft;
  const NextIcon = isRTL ? ChevronLeft  : ChevronRight;

  return (
    <div style={{
      background: "var(--sf-surface)", borderRadius: "14px",
      border: "1.5px solid var(--sf-border)", overflow: "hidden",
    }}>
      {/* Month navigation */}
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
        {/* Weekday labels */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: 2, marginBottom: 4 }}>
          {weekDayLabels.map(d => (
            <div key={d} style={{ textAlign: "center", fontSize: "0.6875rem", color: "var(--sf-text-muted)", fontWeight: 700, padding: "4px 0" }}>{d}</div>
          ))}
        </div>

        {/* Day grid */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: 2 }}>
          {cells.map((day, i) => {
            if (!day) return <div key={i} />;
            const m = String(viewMonth + 1).padStart(2, "0");
            const d = String(day).padStart(2, "0");
            const ds = `${viewYear}-${m}-${d}`;
            const past = isPast(ds);
            const isS  = isStart(ds);
            const isE  = isEnd(ds);
            const inR  = inRange(ds);
            const isToday = ds === fmtD(todayDate);

            const cellBg = (isS || isE)
              ? "var(--sf-indigo)"
              : inR ? "color-mix(in srgb, var(--sf-indigo) 16%, var(--sf-surface))"
              : "transparent";
            const cellColor = (isS || isE)
              ? "white"
              : past ? "var(--sf-border)"
              : "var(--sf-text)";

            return (
              <button
                key={ds} type="button"
                className="sf-cal-day"
                disabled={past}
                onClick={() => handleDay(ds)}
                onMouseEnter={() => startDate && !endDate && setHover(ds)}
                onMouseLeave={() => setHover("")}
                style={{
                  minHeight: 38, borderRadius: 8, border: "none",
                  background: cellBg, color: cellColor,
                  fontWeight: (isS || isE) ? 700 : isToday ? 700 : 400,
                  fontSize: "0.875rem",
                  outline: isToday && !isS && !isE ? "2px solid var(--sf-border)" : "none",
                  outlineOffset: -2,
                  transition: "background .12s",
                  cursor: past ? "not-allowed" : "pointer",
                  position: "relative",
                }}
                aria-label={`${day} ${monthLabel}${isS ? ", start date" : isE ? ", end date" : ""}`}
                aria-pressed={isS || isE}
              >
                {day}
              </button>
            );
          })}
        </div>
      </div>

      {/* Range summary bar */}
      <div style={{
        padding: "10px 16px",
        borderTop: "1px solid var(--sf-border)",
        background: "var(--sf-bg)",
        display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8,
        minHeight: 48,
      }}>
        {!startDate && (
          <span style={{ fontSize: "0.8125rem", color: "var(--sf-text-muted)" }}>
            Tap a date to set your arrival
          </span>
        )}
        {startDate && !endDate && (
          <span style={{ fontSize: "0.8125rem", color: "var(--sf-text-muted)" }}>
            <span style={{ color: "var(--sf-indigo)", fontWeight: 700 }}>{fmtDisplay(startDate)}</span>
            {" "}→ tap your departure date
          </span>
        )}
        {startDate && endDate && (
          <span style={{ fontSize: "0.875rem", color: "var(--sf-text)", fontWeight: 500 }}>
            <span style={{ color: "var(--sf-indigo)", fontWeight: 700 }}>{fmtDisplay(startDate)}</span>
            {" → "}
            <span style={{ color: "var(--sf-indigo)", fontWeight: 700 }}>{fmtDisplay(endDate)}</span>
            <span style={{ color: "var(--sf-text-muted)", marginInlineStart: 8 }}>
              · {nights} {nights === 1 ? "night" : "nights"}
            </span>
          </span>
        )}
        {(startDate || endDate) && (
          <button
            type="button"
            onClick={() => { onChange("", ""); setHover(""); }}
            aria-label="Clear dates"
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
function BudgetSlider({ value, onChange }: { value: number; onChange: (v: number) => void }) {
  const min = 500, max = 10000;
  const pct = ((value - min) / (max - min)) * 100;
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <span style={{ color: "var(--sf-text-muted)", fontSize: "0.8125rem" }}>SAR {min.toLocaleString()}</span>
        <div style={{ padding: "4px 14px", borderRadius: "20px", background: "var(--sf-primary-soft)", border: "1.5px solid var(--sf-indigo)", fontWeight: 700, fontSize: "1rem", color: "var(--sf-text)" }}>
          SAR {value.toLocaleString()}
        </div>
        <span style={{ color: "var(--sf-text-muted)", fontSize: "0.8125rem" }}>SAR {max.toLocaleString()}</span>
      </div>
      <div style={{ position: "relative", paddingBlock: 10 }}>
        <div style={{ position: "absolute", top: "50%", transform: "translateY(-50%)", insetInlineStart: 0, width: "100%", height: 4, borderRadius: 4, background: "var(--sf-surface-alt)", pointerEvents: "none" }} />
        <div style={{ position: "absolute", top: "50%", transform: "translateY(-50%)", insetInlineStart: 0, width: `${pct}%`, height: 4, borderRadius: 4, background: "var(--sf-accent)", pointerEvents: "none", transition: "width .1s" }} />
        <input type="range" min={min} max={max} step={100} value={value} onChange={e => onChange(Number(e.target.value))} className="sf-range-input" style={{ position: "relative", zIndex: 1 }} />
      </div>
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
                    selected={city === id}
                    onClick={() => setCity(city === id ? "" : id)}
                  />
                ))}
              </div>

              {/* More destinations label */}
              <p style={{ fontSize: "0.6875rem", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.07em", color: "var(--sf-text-muted)", marginTop: 4 }}>
                {t("trip.city.more")}
              </p>

              {/* Compact 4 */}
              <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: 10 }}>
                {COMPACT_CITIES.map(({ id, icon }) => (
                  <CompactCityCard
                    key={id} id={id} icon={icon}
                    title={t(`trip.city.${id}.title`)}
                    sub={t(`trip.city.${id}.sub`)}
                    desc={t(`trip.city.${id}.desc`)}
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
            <CalendarPicker
              startDate={dateStart}
              endDate={dateEnd}
              onChange={(s, e) => { setDateStart(s); setDateEnd(e); }}
              isRTL={isRTL}
            />
          </Section>

          {/* ── 4. Budget ── */}
          <Section title={t("trip.budget.label")}>
            <BudgetSlider value={budget} onChange={setBudget} />
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
