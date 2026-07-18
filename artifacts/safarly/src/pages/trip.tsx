import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { motion } from "framer-motion";
import { ArrowRight, Calendar, ChevronRight, ChevronLeft } from "lucide-react";
import { useTranslation } from "@/providers/translation-context";

/* ── Style injection ───────────────────────────────────────────────── */
function useTripStyles() {
  useEffect(() => {
    const id = "sf-trip-styles";
    if (document.getElementById(id)) return;
    const s = document.createElement("style");
    s.id = id;
    s.textContent = `
      .sf-date-input {
        appearance: none; -webkit-appearance: none;
        background: var(--sf-surface); color: var(--sf-text);
        border: 1.5px solid var(--sf-border); border-radius: 10px;
        padding: 12px 14px; font-size: 0.9375rem;
        width: 100%; min-height: 48px; outline: none;
        transition: border-color .2s; font-family: inherit;
        color-scheme: light dark;
      }
      .sf-date-input:focus { border-color: var(--sf-indigo); }
      .sf-date-input::-webkit-calendar-picker-indicator { opacity: 0.5; cursor: pointer; }
      .sf-range-input {
        -webkit-appearance: none; appearance: none;
        width: 100%; height: 4px; border-radius: 4px;
        outline: none; cursor: pointer;
        background: transparent;
      }
      .sf-range-input::-webkit-slider-thumb {
        -webkit-appearance: none; appearance: none;
        width: 22px; height: 22px; border-radius: 50%;
        background: var(--sf-accent);
        border: 3px solid var(--sf-bg);
        box-shadow: 0 0 0 2px var(--sf-accent);
        cursor: pointer; margin-top: -9px;
      }
      .sf-range-input::-moz-range-thumb {
        width: 22px; height: 22px; border-radius: 50%;
        background: var(--sf-accent);
        border: 3px solid var(--sf-bg);
        box-shadow: 0 0 0 2px var(--sf-accent);
        cursor: pointer;
      }
      .sf-range-input::-webkit-slider-runnable-track { height: 4px; border-radius: 4px; }
      .sf-range-input::-moz-range-track { height: 4px; border-radius: 4px; background: var(--sf-surface-alt); }
      .sf-textarea {
        background: var(--sf-surface); color: var(--sf-text);
        border: 1.5px solid var(--sf-border); border-radius: 10px;
        padding: 12px 14px; font-size: 0.9375rem;
        width: 100%; min-height: 96px; outline: none; resize: vertical;
        transition: border-color .2s; font-family: inherit;
        line-height: 1.55;
      }
      .sf-textarea:focus { border-color: var(--sf-indigo); }
      .sf-textarea::placeholder { color: var(--sf-text-muted); }
    `;
    document.head.appendChild(s);
  }, []);
}

/* ── City skyline SVGs ─────────────────────────────────────────────── */
function RiyadhSkyline() {
  return (
    <svg viewBox="0 0 300 90" preserveAspectRatio="xMidYMax meet" aria-hidden="true"
      style={{ width: "100%", height: "70px", display: "block" }}>
      <path
        d="M0,90 L0,68 L14,68 L14,55 L20,55 L20,42 L28,42 L28,55 L34,55 L34,62
           L42,62 L42,14 L44,12 L47,9 L50,12 L52,14 L52,62
           L58,62 L58,45 L68,45 L68,62 L74,62 L74,35 L84,35 L84,62
           L90,62 L90,52 L100,52 L100,62 L106,62 L106,22 L114,22 L114,62
           L120,62 L120,40 L132,40 L132,62 L140,62 L140,50 L152,50 L152,62
           L160,62 L160,30 L170,30 L170,62 L178,62 L178,45 L188,45 L188,62
           L196,62 L196,55 L206,55 L206,62 L214,62 L214,38 L224,38 L224,62
           L232,62 L232,52 L244,52 L244,68 L252,68 L252,58 L262,58 L262,68
           L272,68 L272,60 L284,60 L284,68 L292,68 L292,72 L300,72 L300,90 Z"
        style={{ fill: "var(--sf-surface-alt)", opacity: 0.9 }}
      />
      {/* Arch detail on Kingdom Centre (tallest) */}
      <ellipse cx="47" cy="14" rx="5" ry="4"
        style={{ fill: "var(--sf-surface)", opacity: 0.6 }} />
    </svg>
  );
}

function JeddahSkyline() {
  return (
    <svg viewBox="0 0 300 90" preserveAspectRatio="xMidYMax meet" aria-hidden="true"
      style={{ width: "100%", height: "70px", display: "block" }}>
      {/* Fountain plume */}
      <ellipse cx="55" cy="22" rx="4" ry="20"
        style={{ fill: "var(--sf-surface-alt)", opacity: 0.5 }} />
      <path
        d="M0,90 L0,65 L12,65 L12,50 L22,50 L22,65
           L28,65 L28,40 L38,40 L38,65
           L44,65 L44,55 L58,55 L58,65
           L66,65 L66,48 L68,42 L74,42 L78,42 L84,42 L86,48 L86,65
           L94,65 L94,52 L104,52 L104,65
           L112,65 L112,35 L122,35 L122,65
           L130,65 L130,50 L142,50 L142,65
           L150,65 L150,42 L160,42 L160,65
           L168,65 L168,55 L178,55 L178,65
           L186,65 L186,38 L196,38 L196,65
           L204,65 L204,52 L214,52 L214,68
           L224,68 L224,58 L236,58 L236,68
           L246,68 L246,55 L258,55 L258,68
           L268,68 L268,62 L280,62 L280,70 L292,70 L292,75 L300,75 L300,90 Z"
        style={{ fill: "var(--sf-surface-alt)", opacity: 0.9 }}
      />
      {/* Mosque dome */}
      <ellipse cx="77" cy="42" rx="9" ry="7"
        style={{ fill: "var(--sf-surface-alt)", opacity: 0.9 }} />
    </svg>
  );
}

function AlUlaSkyline() {
  return (
    <svg viewBox="0 0 300 90" preserveAspectRatio="xMidYMax meet" aria-hidden="true"
      style={{ width: "100%", height: "70px", display: "block" }}>
      <path
        d="M0,90 L0,75
           Q8,72 15,65 Q22,55 30,62 Q38,52 46,60 Q52,45 60,55
           Q68,38 76,50 Q84,35 92,48 Q100,30 108,45
           Q116,22 124,38 Q132,28 140,42
           Q148,18 156,35 Q164,25 172,40
           Q180,30 188,48 Q196,38 204,55
           Q212,45 220,60 Q228,52 236,65
           Q244,58 252,68 Q260,62 268,72
           Q276,68 284,75 L300,75 L300,90 Z"
        style={{ fill: "var(--sf-surface-alt)", opacity: 0.9 }}
      />
      {/* Second layer for depth */}
      <path
        d="M0,90 L0,82
           Q15,78 30,75 Q50,70 68,72 Q90,68 110,73
           Q130,70 148,76 Q168,72 188,77
           Q210,73 232,78 Q255,74 280,80 L300,82 L300,90 Z"
        style={{ fill: "var(--sf-surface)", opacity: 0.7 }}
      />
    </svg>
  );
}

/* ── Chip ──────────────────────────────────────────────────────────── */
function Chip({
  label, selected, onClick, icon,
}: { label: string; selected: boolean; onClick: () => void; icon?: string }) {
  return (
    <button
      type="button" onClick={onClick}
      style={{
        minHeight: "44px", padding: "8px 16px",
        borderRadius: "10px",
        border: `1.5px solid ${selected ? "var(--sf-indigo)" : "var(--sf-border)"}`,
        background: selected ? "var(--sf-primary-soft)" : "var(--sf-surface)",
        color: selected ? "var(--sf-text)" : "var(--sf-text-muted)",
        fontWeight: 500, fontSize: "0.875rem",
        cursor: "pointer", display: "inline-flex", alignItems: "center", gap: "6px",
        whiteSpace: "nowrap", transition: "all .18s",
      }}
    >
      {icon && <span>{icon}</span>}
      {label}
    </button>
  );
}

/* ── Section ───────────────────────────────────────────────────────── */
function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
      <p style={{
        fontSize: "0.75rem", fontWeight: 700,
        textTransform: "uppercase", letterSpacing: "0.08em",
        color: "var(--sf-text-muted)",
      }}>
        {title}
      </p>
      {children}
    </div>
  );
}

/* ── City card ─────────────────────────────────────────────────────── */
type CityId = "riyadh" | "jeddah" | "alula";
const SKYLINES: Record<CityId, React.ComponentType> = {
  riyadh: RiyadhSkyline,
  jeddah: JeddahSkyline,
  alula: AlUlaSkyline,
};

function CityCard({
  id, title, sub, desc, selected, onClick,
}: { id: CityId; title: string; sub: string; desc: string; selected: boolean; onClick: () => void }) {
  const Skyline = SKYLINES[id];
  return (
    <motion.button
      type="button" onClick={onClick}
      whileHover={{ y: -3 }} whileTap={{ scale: 0.98 }}
      transition={{ duration: 0.2 }}
      style={{
        display: "flex", flexDirection: "column",
        textAlign: "start", cursor: "pointer",
        borderRadius: "12px", overflow: "hidden",
        border: `2px solid ${selected ? "var(--sf-indigo)" : "var(--sf-border)"}`,
        background: "var(--sf-surface)",
        transition: "border-color .2s, box-shadow .2s",
        boxShadow: selected ? "0 0 0 1px var(--sf-indigo), 0 8px 24px rgba(0,0,0,0.12)" : "0 2px 8px rgba(0,0,0,0.06)",
        minHeight: "180px",
        flex: 1,
      }}
    >
      <div style={{ padding: "18px 18px 12px", flex: 1 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
          <div>
            <p style={{
              fontSize: "1.125rem", fontWeight: 800,
              color: "var(--sf-text)", lineHeight: 1.2, marginBottom: "3px",
            }}>
              {title}
            </p>
            <p style={{
              fontSize: "0.75rem", fontWeight: 600,
              color: "var(--sf-accent)", textTransform: "uppercase",
              letterSpacing: "0.06em", marginBottom: "6px",
            }}>
              {sub}
            </p>
            <p style={{ fontSize: "0.8125rem", color: "var(--sf-text-muted)", lineHeight: 1.4 }}>
              {desc}
            </p>
          </div>
          {selected && (
            <div style={{
              width: "22px", height: "22px", borderRadius: "50%",
              background: "var(--sf-indigo)", display: "flex",
              alignItems: "center", justifyContent: "center", flexShrink: 0,
              marginInlineStart: "8px",
            }}>
              <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                <path d="M2 6l3 3 5-5" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </div>
          )}
        </div>
      </div>
      <div style={{
        background: selected ? "var(--sf-primary-soft)" : "var(--sf-bg)",
        transition: "background .2s",
      }}>
        <Skyline />
      </div>
    </motion.button>
  );
}

/* ── Goal card ─────────────────────────────────────────────────────── */
function GoalCard({
  icon, title, desc, selected, onClick,
}: { icon: string; title: string; desc: string; selected: boolean; onClick: () => void }) {
  return (
    <button
      type="button" onClick={onClick}
      style={{
        display: "flex", alignItems: "flex-start", gap: "12px",
        padding: "14px 16px", borderRadius: "10px", textAlign: "start",
        border: `1.5px solid ${selected ? "var(--sf-indigo)" : "var(--sf-border)"}`,
        background: selected ? "var(--sf-primary-soft)" : "var(--sf-surface)",
        cursor: "pointer", transition: "all .18s", minHeight: "64px",
        boxShadow: selected ? "0 0 0 1px var(--sf-indigo)" : "none",
      }}
    >
      <span style={{ fontSize: "1.25rem", flexShrink: 0, marginTop: "1px" }}>{icon}</span>
      <div style={{ flex: 1 }}>
        <p style={{ fontWeight: 700, color: "var(--sf-text)", fontSize: "0.9375rem", lineHeight: 1.3 }}>
          {title}
        </p>
        <p style={{ color: "var(--sf-text-muted)", fontSize: "0.8125rem", marginTop: "2px", lineHeight: 1.4 }}>
          {desc}
        </p>
      </div>
      {selected && (
        <svg width="16" height="16" viewBox="0 0 16 16" fill="none" style={{ flexShrink: 0, marginTop: "2px" }}>
          <path d="M3 8l4 4 6-6" stroke="var(--sf-indigo)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      )}
    </button>
  );
}

/* ── Budget slider ─────────────────────────────────────────────────── */
function BudgetSlider({ value, onChange }: { value: number; onChange: (v: number) => void }) {
  const min = 500, max = 10000;
  const pct = ((value - min) / (max - min)) * 100;
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <span style={{ color: "var(--sf-text-muted)", fontSize: "0.8125rem" }}>SAR {min.toLocaleString()}</span>
        <div style={{
          padding: "4px 14px", borderRadius: "20px",
          background: "var(--sf-primary-soft)",
          border: "1.5px solid var(--sf-indigo)",
          fontWeight: 700, fontSize: "1rem", color: "var(--sf-text)",
        }}>
          SAR {value.toLocaleString()}
        </div>
        <span style={{ color: "var(--sf-text-muted)", fontSize: "0.8125rem" }}>SAR {max.toLocaleString()}</span>
      </div>
      <div style={{ position: "relative", paddingBlock: "10px" }}>
        {/* Track background */}
        <div style={{
          position: "absolute", top: "50%", transform: "translateY(-50%)",
          insetInlineStart: 0, width: "100%", height: "4px",
          borderRadius: "4px", background: "var(--sf-surface-alt)",
          pointerEvents: "none",
        }} />
        {/* Track fill */}
        <div style={{
          position: "absolute", top: "50%", transform: "translateY(-50%)",
          insetInlineStart: 0, width: `${pct}%`, height: "4px",
          borderRadius: "4px", background: "var(--sf-accent)",
          pointerEvents: "none", transition: "width .1s",
        }} />
        <input
          type="range" min={min} max={max} step={100} value={value}
          onChange={e => onChange(Number(e.target.value))}
          className="sf-range-input"
          style={{ position: "relative", zIndex: 1 }}
        />
      </div>
    </div>
  );
}

/* ── Trip main ─────────────────────────────────────────────────────── */
export function Trip() {
  useTripStyles();
  const { t } = useTranslation();
  const [, navigate] = useLocation();

  const [city, setCity] = useState<CityId | "">("");
  const [dateStart, setDateStart] = useState("");
  const [dateEnd, setDateEnd] = useState("");
  const [budget, setBudget] = useState(3000);
  const [moods, setMoods] = useState<string[]>([]);
  const [goal, setGoal] = useState("");
  const [customGoal, setCustomGoal] = useState("");

  function toggleMood(m: string) {
    setMoods(prev => prev.includes(m) ? prev.filter(x => x !== m) : [...prev, m]);
  }

  function handleGenerate() {
    const trip = { city, dateStart, dateEnd, budget, moods, goal, customGoal };
    localStorage.setItem("safarly_trip", JSON.stringify(trip));
    navigate("/generating");
  }

  const cities: { id: CityId }[] = [{ id: "riyadh" }, { id: "jeddah" }, { id: "alula" }];
  const moodList = [
    { key: "relax", icon: "🌊" }, { key: "adventure", icon: "🧗" },
    { key: "romantic", icon: "🌹" }, { key: "luxury", icon: "✨" },
    { key: "spiritual", icon: "🕌" }, { key: "family", icon: "👨‍👩‍👧" },
    { key: "photography", icon: "📸" }, { key: "food", icon: "🍽️" },
  ];
  const goalList = [
    { key: "culture", icon: "🏛️" }, { key: "food", icon: "🍽️" },
    { key: "gems", icon: "💎" }, { key: "family", icon: "👨‍👩‍👧‍👦" },
    { key: "budget", icon: "💰" }, { key: "photo", icon: "📸" },
    { key: "spiritual", icon: "🕌" },
  ];

  const canGenerate = !!city && !!dateStart && !!dateEnd;

  return (
    <div style={{ paddingTop: "68px", background: "var(--sf-bg)", minHeight: "100dvh" }}>
      {/* Page header */}
      <div style={{
        padding: "28px 20px 24px",
        borderBottom: "1px solid var(--sf-border)",
        background: "var(--sf-bg)",
      }}>
        <div style={{ maxWidth: "680px", margin: "0 auto" }}>
          <h1 style={{
            fontSize: "clamp(1.5rem, 4vw, 2rem)",
            fontWeight: 800, color: "var(--sf-text)",
            letterSpacing: "-0.02em", marginBottom: "6px",
          }}>
            {t("trip.title")}
          </h1>
          <p style={{ color: "var(--sf-text-muted)", fontSize: "0.9375rem" }}>
            {t("trip.subtitle")}
          </p>
        </div>
      </div>

      <div style={{ maxWidth: "680px", margin: "0 auto", padding: "28px 20px 120px" }}>
        <div style={{ display: "flex", flexDirection: "column", gap: "36px" }}>

          {/* 1. City */}
          <Section title={t("trip.city.label")}>
            <div style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
              gap: "12px",
            }}>
              {cities.map(({ id }) => (
                <CityCard
                  key={id} id={id}
                  title={t(`trip.city.${id}.title`)}
                  sub={t(`trip.city.${id}.sub`)}
                  desc={t(`trip.city.${id}.desc`)}
                  selected={city === id}
                  onClick={() => setCity(city === id ? "" : id)}
                />
              ))}
            </div>
          </Section>

          {/* 2. Dates */}
          <Section title={t("trip.dates.label")}>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
              <div>
                <label style={{
                  display: "block", fontSize: "0.8125rem",
                  color: "var(--sf-text-muted)", fontWeight: 500, marginBottom: "6px",
                }}>
                  {t("trip.date.start")}
                </label>
                <input
                  type="date" value={dateStart}
                  onChange={e => setDateStart(e.target.value)}
                  min={new Date().toISOString().split("T")[0]}
                  className="sf-date-input"
                />
              </div>
              <div>
                <label style={{
                  display: "block", fontSize: "0.8125rem",
                  color: "var(--sf-text-muted)", fontWeight: 500, marginBottom: "6px",
                }}>
                  {t("trip.date.end")}
                </label>
                <input
                  type="date" value={dateEnd}
                  onChange={e => setDateEnd(e.target.value)}
                  min={dateStart || new Date().toISOString().split("T")[0]}
                  className="sf-date-input"
                />
              </div>
            </div>
          </Section>

          {/* 3. Budget */}
          <Section title={t("trip.budget.label")}>
            <BudgetSlider value={budget} onChange={setBudget} />
          </Section>

          {/* 4. Mood */}
          <Section title={t("trip.mood.label")}>
            <div style={{ display: "flex", flexWrap: "wrap", gap: "8px" }}>
              {moodList.map(({ key, icon }) => (
                <Chip
                  key={key}
                  label={t(`trip.mood.${key}`)}
                  icon={icon}
                  selected={moods.includes(key)}
                  onClick={() => toggleMood(key)}
                />
              ))}
            </div>
          </Section>

          {/* 5. Goal */}
          <Section title={t("trip.goal.label")}>
            <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
              {goalList.map(({ key, icon }) => (
                <GoalCard
                  key={key} icon={icon}
                  title={t(`trip.goal.${key}.title`)}
                  desc={t(`trip.goal.${key}.desc`)}
                  selected={goal === key}
                  onClick={() => setGoal(goal === key ? "" : key)}
                />
              ))}
            </div>
          </Section>

          {/* 6. Custom goal */}
          <Section title={t("trip.custom_goal.label")}>
            <textarea
              className="sf-textarea"
              placeholder={t("trip.custom_goal.placeholder")}
              value={customGoal}
              onChange={e => setCustomGoal(e.target.value)}
              rows={3}
            />
          </Section>

          {/* 7. CTA */}
          <motion.button
            type="button"
            onClick={handleGenerate}
            disabled={!canGenerate}
            whileTap={canGenerate ? { scale: 0.97 } : {}}
            style={{
              width: "100%", minHeight: "60px",
              borderRadius: "10px", border: "none",
              background: canGenerate ? "var(--sf-accent)" : "var(--sf-surface-alt)",
              color: canGenerate ? "#0A0E16" : "var(--sf-text-muted)",
              fontWeight: 700, fontSize: "1.0625rem",
              cursor: canGenerate ? "pointer" : "not-allowed",
              display: "flex", alignItems: "center", justifyContent: "center", gap: "8px",
              transition: "background .2s, color .2s",
              boxShadow: canGenerate ? "0 0 24px rgba(0,216,164,0.28)" : "none",
            }}
            onMouseEnter={e => { if (canGenerate) e.currentTarget.style.background = "var(--sf-accent-hover)"; }}
            onMouseLeave={e => { if (canGenerate) e.currentTarget.style.background = "var(--sf-accent)"; }}
          >
            {t("trip.cta")}
            <ArrowRight size={20} className="rtl:hidden" style={{ flexShrink: 0 }} />
            <ArrowRight size={20} className="ltr:hidden" style={{ flexShrink: 0, transform: "scaleX(-1)" }} />
          </motion.button>

          {!canGenerate && (
            <p style={{
              textAlign: "center", fontSize: "0.8125rem",
              color: "var(--sf-text-muted)", marginTop: "-20px",
            }}>
              {t("trip.hint")}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
