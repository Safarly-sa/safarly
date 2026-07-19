import { useState, useRef, useEffect, useCallback } from "react";
import { useLocation } from "wouter";
import { motion, AnimatePresence } from "framer-motion";
import { Check, ChevronLeft, ChevronRight, Search } from "lucide-react";
import { useTranslation } from "@/providers/translation-context";
import { usePageMeta } from "@/lib/usePageMeta";

/* ── Style injection for custom inputs ──────────────────────────────── */
function useFormStyles() {
  useEffect(() => {
    const id = "sf-ob-styles";
    if (document.getElementById(id)) return;
    const s = document.createElement("style");
    s.id = id;
    s.textContent = `
      .sf-toggle { position:relative; display:inline-flex; align-items:center; cursor:pointer; }
      .sf-toggle input { opacity:0; width:0; height:0; position:absolute; }
      .sf-toggle-track {
        width:44px; height:26px; border-radius:13px;
        background:var(--sf-surface-alt); border:1px solid var(--sf-border);
        transition:background .2s, border-color .2s; flex-shrink:0;
      }
      .sf-toggle input:checked + .sf-toggle-track {
        background:var(--sf-accent); border-color:var(--sf-accent);
      }
      .sf-toggle-thumb {
        position:absolute; top:3px; inset-inline-start:3px;
        width:18px; height:18px; border-radius:50%;
        background:var(--sf-text); transition:inset-inline-start .2s;
        pointer-events:none;
      }
      .sf-toggle input:checked ~ .sf-toggle-thumb { inset-inline-start:23px; background:#0A0E16; }
      .sf-nation-list { max-height:200px; overflow-y:auto; }
      .sf-nation-list::-webkit-scrollbar { width:4px; }
      .sf-nation-list::-webkit-scrollbar-thumb { background:var(--sf-border); border-radius:2px; }
    `;
    document.head.appendChild(s);
  }, []);
}

/* ── Countries ──────────────────────────────────────────────────────── */
const COUNTRIES = [
  "Afghanistan","Algeria","Argentina","Australia","Austria","Azerbaijan",
  "Bangladesh","Belgium","Brazil","Canada","China","Czech Republic",
  "Egypt","Ethiopia","France","Germany","Ghana","India","Indonesia",
  "Iran","Iraq","Italy","Japan","Jordan","Kazakhstan","Kenya","Kuwait",
  "Lebanon","Libya","Malaysia","Mexico","Morocco","Nepal","Netherlands",
  "Nigeria","Norway","Oman","Pakistan","Philippines","Poland","Portugal",
  "Qatar","Romania","Russia","Saudi Arabia","Singapore","South Africa",
  "South Korea","Spain","Sri Lanka","Sudan","Sweden","Switzerland",
  "Thailand","Tunisia","Turkey","UAE","Ukraine","United Kingdom",
  "United States","Uzbekistan","Vietnam","Yemen",
];

/* ── Chip ───────────────────────────────────────────────────────────── */
function Chip({
  label, selected, onClick, icon,
}: { label: string; selected: boolean; onClick: () => void; icon?: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        minHeight: "44px",
        borderRadius: "10px",
        padding: "8px 16px",
        border: `1.5px solid ${selected ? "var(--sf-indigo)" : "var(--sf-border)"}`,
        background: selected ? "var(--sf-primary-soft)" : "var(--sf-surface)",
        color: selected ? "var(--sf-text)" : "var(--sf-text-muted)",
        fontWeight: 500,
        fontSize: "0.875rem",
        cursor: "pointer",
        transition: "all .18s",
        display: "inline-flex",
        alignItems: "center",
        gap: "6px",
        whiteSpace: "nowrap",
      }}
    >
      {icon && <span>{icon}</span>}
      {label}
      {selected && (
        <Check
          size={14}
          style={{ color: "var(--sf-indigo)", flexShrink: 0 }}
        />
      )}
    </button>
  );
}

/* ── Searchable nationality dropdown ────────────────────────────────── */
function NationalityDropdown({
  value, onChange, placeholder, noneLabel,
}: { value: string; onChange: (v: string) => void; placeholder: string; noneLabel: string }) {
  const [query, setQuery] = useState(value);
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  const filtered = query.length < 1
    ? COUNTRIES
    : COUNTRIES.filter((c) => c.toLowerCase().includes(query.toLowerCase()));

  useEffect(() => {
    function handler(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  function pick(country: string) {
    onChange(country);
    setQuery(country);
    setOpen(false);
  }

  return (
    <div ref={ref} style={{ position: "relative", width: "100%" }}>
      <div
        style={{
          display: "flex", alignItems: "center", gap: "8px",
          border: `1.5px solid ${open ? "var(--sf-indigo)" : "var(--sf-border)"}`,
          borderRadius: "10px", padding: "0 12px",
          background: "var(--sf-surface)",
          transition: "border-color .2s",
          minHeight: "48px",
        }}
      >
        <Search size={16} style={{ color: "var(--sf-text-muted)", flexShrink: 0 }} />
        <input
          type="text"
          value={query}
          onChange={(e) => { setQuery(e.target.value); setOpen(true); onChange(""); }}
          onFocus={() => setOpen(true)}
          placeholder={placeholder}
          style={{
            flex: 1, border: "none", outline: "none",
            background: "transparent", color: "var(--sf-text)",
            fontSize: "0.9375rem", minHeight: "44px",
          }}
          autoComplete="off"
        />
        {value && (
          <button
            type="button"
            onClick={() => { onChange(""); setQuery(""); setOpen(false); }}
            style={{ background: "none", border: "none", color: "var(--sf-text-muted)", cursor: "pointer", padding: "4px" }}
          >×</button>
        )}
      </div>
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            transition={{ duration: 0.15 }}
            style={{
              position: "absolute", top: "calc(100% + 4px)", insetInlineStart: 0,
              width: "100%", zIndex: 50,
              background: "var(--sf-surface)",
              border: "1.5px solid var(--sf-border)",
              borderRadius: "10px",
              boxShadow: "0 8px 24px rgba(0,0,0,0.18)",
              overflow: "hidden",
            }}
          >
            <div className="sf-nation-list">
              {filtered.length === 0 ? (
                <div style={{ padding: "12px 16px", color: "var(--sf-text-muted)", fontSize: "0.875rem" }}>
                  {noneLabel}
                </div>
              ) : (
                filtered.map((c) => (
                  <button
                    key={c} type="button" onClick={() => pick(c)}
                    style={{
                      width: "100%", textAlign: "start", padding: "11px 16px",
                      border: "none", background: value === c ? "var(--sf-primary-soft)" : "transparent",
                      color: value === c ? "var(--sf-text)" : "var(--sf-text-muted)",
                      cursor: "pointer", fontSize: "0.9375rem",
                      minHeight: "44px", display: "block",
                      transition: "background .12s",
                    }}
                    onMouseEnter={e => (e.currentTarget.style.background = "var(--sf-surface-alt)")}
                    onMouseLeave={e => (e.currentTarget.style.background = value === c ? "var(--sf-primary-soft)" : "transparent")}
                  >
                    {c}
                  </button>
                ))
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

/* ── Section label ──────────────────────────────────────────────────── */
function SectionLabel({ label }: { label: string }) {
  return (
    <p style={{
      fontSize: "0.75rem", fontWeight: 700,
      textTransform: "uppercase", letterSpacing: "0.08em",
      color: "var(--sf-text-muted)", marginBottom: "12px",
    }}>
      {label}
    </p>
  );
}

/* ── Toggle ─────────────────────────────────────────────────────────── */
function Toggle({ checked, onChange, label }: { checked: boolean; onChange: () => void; label: string }) {
  return (
    <label
      style={{
        display: "flex", alignItems: "center", gap: "12px", cursor: "pointer",
        padding: "14px 16px", borderRadius: "10px",
        border: `1.5px solid ${checked ? "var(--sf-indigo)" : "var(--sf-border)"}`,
        background: checked ? "var(--sf-primary-soft)" : "var(--sf-surface)",
        transition: "all .2s", userSelect: "none",
        minHeight: "56px",
      }}
    >
      <span className="sf-toggle" style={{ flexShrink: 0 }}>
        <input type="checkbox" checked={checked} onChange={onChange} />
        <span className="sf-toggle-track" />
        <span className="sf-toggle-thumb" />
      </span>
      <span style={{ color: "var(--sf-text)", fontSize: "0.9375rem", fontWeight: 500 }}>
        {label}
      </span>
    </label>
  );
}

/* ── Step content variants ──────────────────────────────────────────── */
const slideVariants = {
  enter: (dir: number) => ({ x: dir * 48, opacity: 0 }),
  center: { x: 0, opacity: 1, transition: { duration: 0.3, ease: [0.16, 1, 0.3, 1] } },
  exit: (dir: number) => ({ x: dir * -48, opacity: 0, transition: { duration: 0.2, ease: [0.4, 0, 1, 1] } }),
};

/* ── Progress bar ───────────────────────────────────────────────────── */
function ProgressBar({ step, total }: { step: number; total: number }) {
  const pct = ((step + 1) / total) * 100;
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div style={{ display: "flex", gap: "6px" }}>
          {Array.from({ length: total }).map((_, i) => (
            <div
              key={i}
              style={{
                width: i === step ? "24px" : "8px",
                height: "8px",
                borderRadius: "4px",
                background: i <= step ? "var(--sf-accent)" : "var(--sf-border)",
                transition: "all .3s ease",
              }}
            />
          ))}
        </div>
        <span style={{ fontSize: "0.75rem", color: "var(--sf-text-muted)", fontVariantNumeric: "tabular-nums" }}>
          {step + 1} / {total}
        </span>
      </div>
      <div style={{ height: "3px", borderRadius: "2px", background: "var(--sf-border)", overflow: "hidden" }}>
        <div
          style={{
            height: "100%", borderRadius: "2px",
            background: "var(--sf-accent)",
            width: `${pct}%`, transition: "width .35s ease",
          }}
        />
      </div>
    </div>
  );
}

/* ── Onboarding main ────────────────────────────────────────────────── */
export function Onboarding() {
  useFormStyles();
  const { t } = useTranslation();
  usePageMeta("Your Traveller Profile", "Tell us about your travel style, allergies and goals.");
  const [, navigate] = useLocation();
  const [step, setStep] = useState(0);
  const [dir, setDir] = useState(1);

  // Step 1
  const [nationality, setNationality] = useState("");
  const [language, setLanguage] = useState("");
  const [ageRange, setAgeRange] = useState("");
  // Step 2
  const [dietary, setDietary] = useState<string[]>([]);
  const [allergies, setAllergies] = useState<string[]>([]);
  // Step 3
  const [travelType, setTravelType] = useState("");
  const [accessibility, setAccessibility] = useState(false);
  // Step 4
  const [interests, setInterests] = useState<string[]>([]);

  function toggleMulti(arr: string[], setArr: (v: string[]) => void, val: string) {
    setArr(arr.includes(val) ? arr.filter((x) => x !== val) : [...arr, val]);
  }

  function goNext() {
    setDir(1);
    setStep((s) => Math.min(s + 1, 3));
  }
  function goBack() {
    setDir(-1);
    setStep((s) => Math.max(s - 1, 0));
  }
  function finish() {
    const profile = { nationality, language, ageRange, dietary, allergies, travelType, accessibility, interests };
    localStorage.setItem("safarly_profile", JSON.stringify(profile));
    navigate("/trip");
  }

  const langs = ["English", "中文", "Русский", "اردو", "Français"];
  const ages = ["ob.age.18", "ob.age.25", "ob.age.35", "ob.age.45", "ob.age.55"];
  const diets = ["ob.diet.vegetarian", "ob.diet.vegan", "ob.diet.halal", "ob.diet.none"];
  const allergyList = ["ob.allergy.nuts", "ob.allergy.dairy", "ob.allergy.gluten", "ob.allergy.sesame", "ob.allergy.eggs", "ob.allergy.shellfish"];
  const travelTypes = [
    { key: "solo_woman", icon: "👩" }, { key: "solo_man", icon: "👨" },
    { key: "couple", icon: "💑" }, { key: "family", icon: "👨‍👩‍👧‍👦" }, { key: "friends", icon: "🧑‍🤝‍🧑" },
  ];
  const interestList = [
    { key: "history", icon: "🏛️" }, { key: "food", icon: "🍽️" },
    { key: "adventure", icon: "🧗" }, { key: "shopping", icon: "🛍️" },
    { key: "arts", icon: "🎨" }, { key: "nature", icon: "🌿" },
    { key: "photography", icon: "📸" },
  ];

  const stepTitles = ["ob.step1.title", "ob.step2.title", "ob.step3.title", "ob.step4.title"];
  const stepSubs = ["ob.step1.subtitle", "ob.step2.subtitle", "ob.step3.subtitle", "ob.step4.subtitle"];

  const steps = [
    /* Step 1 */ (
      <div style={{ display: "flex", flexDirection: "column", gap: "24px" }}>
        <div>
          <SectionLabel label={t("ob.nationality.label")} />
          <NationalityDropdown
            value={nationality}
            onChange={setNationality}
            placeholder={t("ob.nationality.placeholder")}
            noneLabel={t("ob.nationality.none")}
          />
        </div>
        <div>
          <SectionLabel label={t("ob.language.label")} />
          <div style={{ display: "flex", flexWrap: "wrap", gap: "8px" }}>
            {langs.map((l) => (
              <Chip key={l} label={l} selected={language === l} onClick={() => setLanguage(l === language ? "" : l)} />
            ))}
          </div>
        </div>
        <div>
          <SectionLabel label={t("ob.age.label")} />
          <div style={{ display: "flex", flexWrap: "wrap", gap: "8px" }}>
            {ages.map((a) => (
              <Chip key={a} label={t(a)} selected={ageRange === a} onClick={() => setAgeRange(a === ageRange ? "" : a)} />
            ))}
          </div>
        </div>
      </div>
    ),
    /* Step 2 */ (
      <div style={{ display: "flex", flexDirection: "column", gap: "24px" }}>
        <div>
          <SectionLabel label={t("ob.diet.label")} />
          <div style={{ display: "flex", flexWrap: "wrap", gap: "8px" }}>
            {diets.map((d) => (
              <Chip
                key={d} label={t(d)}
                selected={dietary.includes(d)}
                onClick={() => toggleMulti(dietary, setDietary, d)}
              />
            ))}
          </div>
        </div>
        <div>
          <SectionLabel label={t("ob.allergy.label")} />
          <div style={{ display: "flex", flexWrap: "wrap", gap: "8px" }}>
            {allergyList.map((a) => (
              <Chip
                key={a} label={t(a)}
                selected={allergies.includes(a)}
                onClick={() => toggleMulti(allergies, setAllergies, a)}
              />
            ))}
          </div>
        </div>
      </div>
    ),
    /* Step 3 */ (
      <div style={{ display: "flex", flexDirection: "column", gap: "24px" }}>
        <div>
          <SectionLabel label={t("ob.step3.subtitle")} />
          <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
            {travelTypes.map(({ key, icon }) => (
              <button
                key={key} type="button"
                onClick={() => setTravelType(key === travelType ? "" : key)}
                style={{
                  display: "flex", alignItems: "center", gap: "12px",
                  padding: "14px 16px", borderRadius: "10px",
                  border: `1.5px solid ${travelType === key ? "var(--sf-indigo)" : "var(--sf-border)"}`,
                  background: travelType === key ? "var(--sf-primary-soft)" : "var(--sf-surface)",
                  color: "var(--sf-text)", fontWeight: 500, fontSize: "0.9375rem",
                  cursor: "pointer", textAlign: "start", minHeight: "56px",
                  transition: "all .18s",
                }}
              >
                <span style={{ fontSize: "1.25rem" }}>{icon}</span>
                <span>{t(`ob.travel.${key}`)}</span>
                {travelType === key && (
                  <Check size={16} style={{ color: "var(--sf-indigo)", marginInlineStart: "auto" }} />
                )}
              </button>
            ))}
          </div>
        </div>
        <Toggle
          checked={accessibility}
          onChange={() => setAccessibility(!accessibility)}
          label={t("ob.accessibility.label")}
        />
      </div>
    ),
    /* Step 4 */ (
      <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
        <SectionLabel label={t("ob.step4.subtitle")} />
        <div style={{ display: "flex", flexWrap: "wrap", gap: "10px" }}>
          {interestList.map(({ key, icon }) => (
            <Chip
              key={key}
              label={t(`ob.interest.${key}`)}
              icon={icon}
              selected={interests.includes(key)}
              onClick={() => toggleMulti(interests, setInterests, key)}
            />
          ))}
        </div>
      </div>
    ),
  ];

  return (
    <div style={{
      paddingTop: "68px",
      minHeight: "100dvh",
      display: "flex",
      flexDirection: "column",
      background: "var(--sf-bg)",
    }}>
      {/* Header */}
      <div style={{
        padding: "28px 20px 20px",
        borderBottom: "1px solid var(--sf-border)",
        background: "var(--sf-bg)",
      }}>
        <div style={{ maxWidth: "560px", margin: "0 auto" }}>
          <h1 style={{
            fontSize: "clamp(1.375rem, 4vw, 1.75rem)",
            fontWeight: 800, color: "var(--sf-text)",
            letterSpacing: "-0.02em", marginBottom: "4px",
          }}>
            {t("ob.title")}
          </h1>
          <p style={{ color: "var(--sf-text-muted)", fontSize: "0.9375rem", marginBottom: "20px" }}>
            {t("ob.subtitle")}
          </p>
          <ProgressBar step={step} total={4} />
        </div>
      </div>

      {/* Step content */}
      <div style={{ flex: 1, overflowX: "hidden" }}>
        <div style={{ maxWidth: "560px", margin: "0 auto", padding: "28px 20px" }}>
          <AnimatePresence custom={dir} mode="popLayout">
            <motion.div
              key={step}
              custom={dir}
              variants={slideVariants}
              initial="enter"
              animate="center"
              exit="exit"
            >
              <h2 style={{
                fontSize: "1.25rem", fontWeight: 700,
                color: "var(--sf-text)", marginBottom: "4px",
              }}>
                {t(stepTitles[step])}
              </h2>
              <p style={{ color: "var(--sf-text-muted)", fontSize: "0.875rem", marginBottom: "24px" }}>
                {t(stepSubs[step])}
              </p>
              {steps[step]}
            </motion.div>
          </AnimatePresence>
        </div>
      </div>

      {/* Navigation */}
      <div style={{
        padding: "16px 20px",
        borderTop: "1px solid var(--sf-border)",
        background: "var(--sf-bg)",
        position: "sticky",
        bottom: 0,
        paddingBottom: "calc(16px + env(safe-area-inset-bottom))",
      }}>
        <div style={{
          maxWidth: "560px", margin: "0 auto",
          display: "flex", gap: "12px",
        }}>
          {step > 0 && (
            <button
              type="button"
              onClick={goBack}
              style={{
                minHeight: "52px", padding: "0 20px",
                borderRadius: "10px",
                border: "1.5px solid var(--sf-border)",
                background: "var(--sf-surface)",
                color: "var(--sf-text)", fontWeight: 600, fontSize: "0.9375rem",
                cursor: "pointer", display: "flex", alignItems: "center", gap: "6px",
                transition: "all .18s",
              }}
            >
              <ChevronLeft size={18} className="rtl:hidden" />
              <ChevronRight size={18} className="ltr:hidden" />
              {t("ob.back")}
            </button>
          )}
          <button
            type="button"
            onClick={step === 3 ? finish : goNext}
            style={{
              flex: 1, minHeight: "52px",
              borderRadius: "10px",
              border: "none",
              background: "var(--sf-accent)",
              color: "#0A0E16",
              fontWeight: 700, fontSize: "0.9375rem",
              cursor: "pointer", display: "flex", alignItems: "center",
              justifyContent: "center", gap: "6px",
              transition: "background .18s",
            }}
            onMouseEnter={e => (e.currentTarget.style.background = "var(--sf-accent-hover)")}
            onMouseLeave={e => (e.currentTarget.style.background = "var(--sf-accent)")}
          >
            {step === 3 ? t("ob.finish") : t("ob.next")}
            {step < 3 && (
              <>
                <ChevronRight size={18} className="rtl:hidden" />
                <ChevronLeft size={18} className="ltr:hidden" />
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
