/**
 * /dashboard — 3-tab layout
 * Tab 1 · Profile   — inline editable profile form
 * Tab 2 · Trips     — past / completed trips list
 * Tab 3 · Ongoing   — current confirmed trip: full timeline + spend breakdown
 */
import { useEffect, useState } from "react";
import { useLocation, Link } from "wouter";
import {
  X, UserCircle, ArrowRight,
  CheckCircle2, MapPin, ExternalLink, Camera, Gem,
} from "lucide-react";
import { useTranslation } from "@/providers/translation-context";
import type { Language } from "@/providers/translation-context";
import { usePageMeta } from "@/lib/usePageMeta";
import { AuroraHero } from "@/components/AuroraHero";
import { getAuth, setAuth } from "@/lib/auth";
import { poiName, poiCulture } from "@/lib/poi-i18n";
import { dishName, mealVenue, mealArea } from "@/lib/dish-i18n";
import { localeTag } from "@/lib/locale-format";
import { normaliseNationality } from "@/lib/nationalities";
import { NationalityDropdown } from "@/components/NationalityDropdown";
import {
  Chip, SectionLabel, Toggle, AccessibilityNotesField,
} from "./profile-setup";
import { CITY_NAMES_EN, CITY_NAMES_AR } from "@/lib/engine";
import type { ItineraryResult, ItineraryDay, ItineraryStop, ItineraryMeal, TripSpec, Objectives } from "@/lib/engine";

/* ── Types ──────────────────────────────────────────────────────────── */
interface ProfileData { name: string; nationality: string; language: string; ageRange: string; dietary: string[]; allergies: string[]; accessibility: boolean; accessibilityNotes: string; interests: string[]; }
interface ConfirmedTrip { trip: TripSpec; itinerary: ItineraryResult; confirmedAt: string; }

const ALLERGY_KEY: Record<string, string>  = { nuts: "ob.allergy.nuts", dairy: "ob.allergy.dairy", gluten: "ob.allergy.gluten", sesame: "ob.allergy.sesame", eggs: "ob.allergy.eggs", shellfish: "ob.allergy.shellfish" };
const INTEREST_KEY: Record<string, string> = { history: "ob.interest.history", food: "ob.interest.food", adventure: "ob.interest.adventure", shopping: "ob.interest.shopping", arts: "ob.interest.arts", nature: "ob.interest.nature", photography: "ob.interest.photography" };

const OBJ_KEYS: (keyof Objectives)[] = ["culture", "hiddenGems", "food", "photography", "family", "budget"];
const OBJ_LABEL_EN: Record<string, string> = { culture: "Culture", hiddenGems: "Hidden Gems", food: "Food", photography: "Photography", family: "Family", budget: "Budget" };

/* ── Style injection ────────────────────────────────────────────────── */
function useDashStyles() {
  useEffect(() => {
    const id = "sf-dash-v2-styles";
    if (document.getElementById(id)) return;
    const s = document.createElement("style");
    s.id = id;
    s.textContent = `
      .sf-dash-tab-pill {
        padding: 8px 18px; border-radius: 8px; font-size: 0.875rem;
        font-weight: 700; cursor: pointer; border: 1.5px solid transparent;
        transition: all .18s; white-space: nowrap;
        background: transparent; color: var(--sf-text-muted);
      }
      .sf-dash-tab-pill.active {
        background: var(--sf-surface); color: var(--sf-text);
        border-color: var(--sf-border);
        box-shadow: 0 2px 8px rgba(0,0,0,0.1);
      }
      .sf-dash-tab-pill:not(.active):hover { color: var(--sf-text); }
      .sf-dash-card {
        background: var(--sf-surface); border: 1px solid var(--sf-border);
        border-radius: 14px; padding: 20px;
      }
      .sf-profile-section {
        background: var(--sf-surface); border: 1px solid var(--sf-border);
        border-radius: 14px; padding: 20px;
        display: flex; flex-direction: column; gap: 18px;
      }
      .sf-profile-section-title {
        font-size: 0.6875rem; font-weight: 700; letter-spacing: 0.07em;
        text-transform: uppercase; color: var(--sf-text-muted); margin-bottom: 4px;
      }
      .sf-profile-input {
        width: 100%; box-sizing: border-box; padding: 12px 14px;
        border-radius: 10px; border: 1.5px solid var(--sf-border);
        background: var(--sf-surface-alt); color: var(--sf-text);
        font-size: 0.9375rem; outline: none; font-family: inherit;
        transition: border-color .2s;
      }
      .sf-profile-input:focus { border-color: var(--sf-indigo); }
      .sf-saved-flash {
        display: flex; align-items: center; gap: 6px;
        font-size: 0.8125rem; color: var(--sf-success); font-weight: 700;
        animation: sf-dash-fade 0.3s ease;
      }
      @keyframes sf-dash-fade {
        from { opacity: 0; transform: translateY(-4px); }
        to   { opacity: 1; transform: none; }
      }
      .sf-trip-card {
        background: var(--sf-surface); border: 1.5px solid var(--sf-border);
        border-radius: 14px; overflow: hidden; transition: border-color .18s;
      }
      .sf-trip-card:hover { border-color: color-mix(in srgb, var(--sf-indigo) 40%, var(--sf-border)); }
      .sf-chip-toggle {
        padding: 7px 14px; border-radius: 999px; font-size: 0.8125rem;
        font-weight: 600; cursor: pointer; min-height: 40px; border: 1px solid;
        transition: background .12s, color .12s, border-color .12s;
      }
      .sf-stat-tile {
        background: var(--sf-surface-alt); border-radius: 10px;
        padding: 14px; text-align: center; flex: 1;
      }
      /* Stop card in ongoing timeline */
      .sf-dash-stop {
        display: flex; gap: 12px; align-items: flex-start;
        padding: 14px 0; border-bottom: 1px solid var(--sf-border);
      }
      .sf-dash-stop:last-child { border-bottom: none; }
      .sf-dash-maps-link {
        display: inline-flex; align-items: center; gap: 5px;
        font-size: 0.8rem; font-weight: 600; color: var(--sf-text-muted);
        text-decoration: none; border-radius: 7px; padding: 4px 10px;
        border: 1px solid var(--sf-border); background: var(--sf-surface-alt);
        transition: color .15s, border-color .15s;
      }
      .sf-dash-maps-link:hover { color: var(--sf-text); border-color: var(--sf-indigo); }
      .sf-dash-photos-btn {
        display: inline-flex; align-items: center; gap: 5px;
        font-size: 0.8rem; font-weight: 600; color: var(--sf-text-muted);
        cursor: pointer; border-radius: 7px; padding: 4px 10px;
        border: 1px solid var(--sf-border); background: var(--sf-surface-alt);
        transition: color .15s, border-color .15s;
      }
      .sf-dash-photos-btn:hover { color: var(--sf-text); border-color: var(--sf-indigo); }
      /* obj bar */
      .sf-obj-bar-track {
        height: 5px; border-radius: 3px; background: var(--sf-surface-alt);
        overflow: hidden; flex: 1;
      }
    `;
    document.head.appendChild(s);
  }, []);
}

/* ── Shared helpers ─────────────────────────────────────────────────── */
function CardTitle({ children }: { children: React.ReactNode }) {
  return (
    <h2 style={{ fontSize: "0.6875rem", fontWeight: 700, letterSpacing: "0.07em", textTransform: "uppercase", color: "var(--sf-text-muted)", marginBottom: 14 }}>
      {children}
    </h2>
  );
}

function TabPill({ label, active, badge, onClick }: { label: string; active: boolean; badge?: number; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`sf-dash-tab-pill${active ? " active" : ""}`}
    >
      {label}
      {badge != null && badge > 0 && (
        <span style={{
          marginInlineStart: 6,
          display: "inline-flex", alignItems: "center", justifyContent: "center",
          width: 18, height: 18, borderRadius: "50%",
          background: active ? "var(--sf-indigo)" : "var(--sf-surface-alt)",
          color: active ? "white" : "var(--sf-text-muted)",
          fontSize: "0.625rem", fontWeight: 800,
        }}>
          {badge}
        </span>
      )}
    </button>
  );
}

function toggleArr<T>(arr: T[], val: T): T[] {
  return arr.includes(val) ? arr.filter(x => x !== val) : [...arr, val];
}

function emptyProfile(): ProfileData {
  return { name: "", nationality: "", language: "", ageRange: "", dietary: [], allergies: [], accessibility: false, accessibilityNotes: "", interests: [] };
}

function loadProfile(): ProfileData {
  try {
    const raw = localStorage.getItem("safarly_profile");
    if (raw) {
      const parsed = JSON.parse(raw);
      // A profile saved before the nationality field switched from a full
      // country name (e.g. "Lebanon") to an ISO code is repaired on read.
      return { ...emptyProfile(), ...parsed, nationality: normaliseNationality(parsed?.nationality) };
    }
  } catch { /* */ }
  const auth = getAuth();
  return { ...emptyProfile(), name: auth?.name ?? "" };
}

/* ──────────────────────────────────────────────────────────────────────
   TAB 1 · Profile
   ────────────────────────────────────────────────────────────────────── */
function ProfileTab({ t }: { t: (k: string) => string }) {
  const [data, setData]   = useState<ProfileData>(loadProfile);
  const [saved, setSaved] = useState(false);

  function patch(p: Partial<ProfileData>) { setData(prev => ({ ...prev, ...p })); }

  function toggleAccessibility() {
    setData(prev => ({
      ...prev,
      accessibility: !prev.accessibility,
      accessibilityNotes: prev.accessibility ? "" : prev.accessibilityNotes,
    }));
  }

  function handleSave() {
    localStorage.setItem("safarly_profile", JSON.stringify(data));
    const auth = getAuth();
    if (auth && data.name.trim()) setAuth({ ...auth, name: data.name.trim() });
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  }

  const langs       = ["العربية", "English", "اردو", "中文", "Русский", "Français", "Türkçe", "Español", "Português"];
  const ages        = ["ob.age.18", "ob.age.25", "ob.age.35", "ob.age.45", "ob.age.55"];
  const diets       = ["ob.diet.vegetarian", "ob.diet.vegan", "ob.diet.halal", "ob.diet.none"];
  const allergyList = ["ob.allergy.nuts", "ob.allergy.dairy", "ob.allergy.gluten", "ob.allergy.sesame", "ob.allergy.eggs", "ob.allergy.shellfish"];
  const allergyKeys: Record<string, string> = { "ob.allergy.nuts": "nuts", "ob.allergy.dairy": "dairy", "ob.allergy.gluten": "gluten", "ob.allergy.sesame": "sesame", "ob.allergy.eggs": "eggs", "ob.allergy.shellfish": "shellfish" };
  const interestList = [
    { key: "history", icon: "🏛️" }, { key: "food", icon: "🍽️" },
    { key: "adventure", icon: "🧗" }, { key: "shopping", icon: "🛍️" },
    { key: "arts", icon: "🎨" }, { key: "nature", icon: "🌿" },
    { key: "photography", icon: "📸" },
  ];

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16, maxWidth: 620 }}>

      {/* About you */}
      <section className="sf-profile-section" aria-labelledby="sp-about">
        <h2 id="sp-about" className="sf-profile-section-title">About You</h2>

        <div>
          <SectionLabel label="Display name" />
          <input type="text" className="sf-profile-input" value={data.name}
            onChange={e => patch({ name: e.target.value })} placeholder="Your name" autoComplete="given-name" />
        </div>

        <div>
          <SectionLabel label={t("ob.nationality.label")} />
          <NationalityDropdown value={data.nationality} onChange={v => patch({ nationality: v })}
            placeholder={t("ob.nationality.placeholder")} noneLabel={t("ob.nationality.none")} />
        </div>

        <div>
          <SectionLabel label={t("ob.language.label")} />
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
            {langs.map(l => (
              <Chip key={l} label={l} selected={data.language === l}
                onClick={() => patch({ language: data.language === l ? "" : l })} />
            ))}
          </div>
        </div>

        <div>
          <SectionLabel label={t("ob.age.label")} />
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
            {ages.map(a => (
              <Chip key={a} label={t(a)} selected={data.ageRange === a}
                onClick={() => patch({ ageRange: data.ageRange === a ? "" : a })} />
            ))}
          </div>
        </div>
      </section>

      {/* Food & health */}
      <section className="sf-profile-section" aria-labelledby="sp-food">
        <h2 id="sp-food" className="sf-profile-section-title">Food &amp; Health</h2>

        <div>
          <SectionLabel label={t("ob.diet.label")} />
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
            {diets.map(d => (
              <Chip key={d} label={t(d)} selected={data.dietary.includes(d)}
                onClick={() => patch({ dietary: toggleArr(data.dietary, d) })} />
            ))}
          </div>
        </div>

        <div>
          <SectionLabel label={t("ob.allergy.label")} />
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
            {allergyList.map(a => {
              const val = allergyKeys[a] ?? a;
              return (
                <Chip key={a} label={t(a)} selected={data.allergies.includes(val)}
                  onClick={() => patch({ allergies: toggleArr(data.allergies, val) })} />
              );
            })}
          </div>
        </div>
      </section>

      {/* Accessibility */}
      <section className="sf-profile-section" aria-labelledby="sp-access">
        <h2 id="sp-access" className="sf-profile-section-title">Accessibility</h2>
        <Toggle checked={data.accessibility} onChange={toggleAccessibility}
          label={t("ob.accessibility.label")} />
        <AccessibilityNotesField
          show={data.accessibility}
          value={data.accessibilityNotes}
          onChange={v => patch({ accessibilityNotes: v })}
          t={t}
        />
      </section>

      {/* Interests */}
      <section className="sf-profile-section" aria-labelledby="sp-interests">
        <h2 id="sp-interests" className="sf-profile-section-title">Interests</h2>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 10 }}>
          {interestList.map(({ key, icon }) => (
            <Chip key={key} label={t(`ob.interest.${key}`)} icon={icon}
              selected={data.interests.includes(key)}
              onClick={() => patch({ interests: toggleArr(data.interests, key) })} />
          ))}
        </div>
      </section>

      {/* Save */}
      <div style={{ display: "flex", alignItems: "center", gap: 16, paddingTop: 4 }}>
        <button
          type="button" onClick={handleSave}
          style={{
            flex: 1, minHeight: 52, borderRadius: 10, border: "none",
            background: "var(--sf-accent)", color: "#0A0E16",
            fontWeight: 700, fontSize: "1rem", cursor: "pointer", transition: "background .18s",
          }}
          onMouseEnter={e => (e.currentTarget.style.background = "var(--sf-accent-hover)")}
          onMouseLeave={e => (e.currentTarget.style.background = "var(--sf-accent)")}
        >
          Save Profile
        </button>
        {saved && (
          <span className="sf-saved-flash">
            <CheckCircle2 size={16} aria-hidden />
            Saved
          </span>
        )}
      </div>
    </div>
  );
}

/* ──────────────────────────────────────────────────────────────────────
   TAB 2 · Trips (past / completed)
   ────────────────────────────────────────────────────────────────────── */
// `resolvedCity` lives on ItineraryResult, not TripSpec — an "ai" trip only
// learns its real city once the engine has run, so the itinerary must be passed
// in. Reading it off `trip` silently fell back to "riyadh" for every AI trip.
function cityName(trip: TripSpec, itinerary: ItineraryResult | undefined, language: string) {
  const key = trip.city === "ai" ? (itinerary?.resolvedCity ?? "riyadh") : (trip.city ?? "");
  return language === "ar" ? (CITY_NAMES_AR[key] ?? key) : (CITY_NAMES_EN[key] ?? key);
}

function fmtDate(ds: string, locale: string) {
  return new Date(ds + "T00:00:00").toLocaleDateString(locale, { day: "numeric", month: "short", year: "numeric" });
}

function nightsBetween(a: string, b: string) {
  return Math.round((new Date(b + "T00:00:00").getTime() - new Date(a + "T00:00:00").getTime()) / 86400000);
}

function PastTripCard({ confirmed, language, t }: {
  confirmed: ConfirmedTrip; language: Language;
  t: (k: string) => string;
}) {
  const [open, setOpen] = useState(false);
  const { trip, itinerary } = confirmed;
  const locale = localeTag(language);

  const totalStops = itinerary.days.reduce((s, d) => s + d.stops.length, 0);
  const gemCount   = Math.round((itinerary.hiddenGemShare ?? 0) * totalStops);
  const nights     = trip.dateStart && trip.dateEnd ? nightsBetween(trip.dateStart, trip.dateEnd) : 0;
  const cn         = cityName(trip, itinerary, language);

  return (
    <div className="sf-trip-card">
      <button
        type="button" onClick={() => setOpen(o => !o)}
        style={{
          width: "100%", padding: "16px 18px", textAlign: "start",
          background: "none", border: "none", cursor: "pointer",
          display: "flex", alignItems: "center", gap: 14,
        }}
      >
        {/* City avatar */}
        <div style={{
          width: 44, height: 44, borderRadius: 10, flexShrink: 0,
          background: "var(--sf-primary-soft)", border: "1px solid var(--sf-indigo)",
          display: "flex", alignItems: "center", justifyContent: "center",
          fontSize: "1.25rem",
        }}>
          🌍
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <p style={{ fontWeight: 800, color: "var(--sf-text)", fontSize: "1rem", lineHeight: 1.2 }}>{cn}</p>
          {trip.dateStart && trip.dateEnd && (
            <p style={{ fontSize: "0.8125rem", color: "var(--sf-text-muted)", marginTop: 2 }}>
              {fmtDate(trip.dateStart, locale)} → {fmtDate(trip.dateEnd, locale)}
            </p>
          )}
        </div>
        <div style={{ display: "flex", gap: 8, flexShrink: 0, alignItems: "center" }}>
          {nights > 0 && (
            <span style={{
              fontSize: "0.75rem", fontWeight: 700, color: "var(--sf-text-muted)",
              padding: "3px 8px", borderRadius: 20, background: "var(--sf-surface-alt)",
            }}>
              {t("dash.trips.nights").replace("{n}", String(nights))}
            </span>
          )}
          <span style={{ color: "var(--sf-text-muted)", fontSize: "1.1rem", transform: open ? "rotate(90deg)" : "none", transition: "transform .2s" }}>›</span>
        </div>
      </button>

      {open && (
        <div style={{ padding: "0 18px 18px", borderTop: "1px solid var(--sf-border)" }}>
          {/* Stats row */}
          <div style={{ display: "flex", flexWrap: "wrap", gap: 10, paddingTop: 16, marginBottom: 18 }}>
            {[
              { val: totalStops, label: t("dash.trips.stops").replace("{n}", String(totalStops)) },
              { val: gemCount,   label: t("dash.trips.gems").replace("{n}", String(gemCount)) },
              { val: itinerary.days.length, label: `${itinerary.days.length} day${itinerary.days.length !== 1 ? "s" : ""}` },
            ].map(({ label }) => (
              <div key={label} className="sf-stat-tile" style={{ minWidth: "calc(33% - 8px)" }}>
                <div style={{ fontSize: "0.75rem", color: "var(--sf-text-muted)", fontWeight: 600 }}>{label}</div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function TripsTab({ pastTrips, language, t }: {
  pastTrips: ConfirmedTrip[]; language: Language;
  t: (k: string) => string;
}) {
  const [, navigate] = useLocation();

  if (pastTrips.length === 0) {
    return (
      <div style={{ textAlign: "center", padding: "60px 24px", maxWidth: 400, margin: "0 auto" }}>
        <div style={{ fontSize: "3rem", marginBottom: 16 }}>🗺️</div>
        <h2 style={{ fontSize: "1.125rem", fontWeight: 800, color: "var(--sf-text)", marginBottom: 8 }}>
          {t("dash.trips.empty.title")}
        </h2>
        <p style={{ color: "var(--sf-text-muted)", fontSize: "0.9375rem", lineHeight: 1.6, marginBottom: 24 }}>
          {t("dash.trips.empty.desc")}
        </p>
        <button
          onClick={() => navigate("/planner")}
          style={{ background: "var(--sf-accent)", color: "#0A0E16", border: "none", borderRadius: 10, padding: "13px 28px", fontWeight: 700, fontSize: "0.9375rem", cursor: "pointer" }}
        >
          {t("dash.ongoing.empty.cta")}
        </button>
      </div>
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      {[...pastTrips].reverse().map((ct, i) => (
        <PastTripCard key={ct.confirmedAt ?? i} confirmed={ct} language={language} t={t} />
      ))}
    </div>
  );
}

/* ──────────────────────────────────────────────────────────────────────
   TAB 3 · Ongoing Trip — POI photo modal
   ────────────────────────────────────────────────────────────────────── */
interface ModalPoi { id: string; name: string; category: string; map_url?: string; }

function poiGradient(category: string, slot: number): string {
  const sets: Record<string, string[]> = {
    heritage: ["135deg,#92400E,#C17900", "90deg,#B45309,#D97706", "45deg,#78350F,#A16207"],
    museum:   ["135deg,#0F766E,#14B8A6", "90deg,#0D9488,#2DD4BF", "45deg,#134E4A,#0F766E"],
    nature:   ["135deg,#14532D,#16A34A", "90deg,#166534,#4ADE80", "45deg,#052E16,#166534"],
    culture:  ["135deg,#3730A3,#6D28D9", "90deg,#4338CA,#7C3AED", "45deg,#312E81,#5B21B6"],
    food:     ["135deg,#991B1B,#C2410C", "90deg,#B91C1C,#EA580C", "45deg,#7F1D1D,#9A3412"],
    shopping: ["135deg,#065F46,#059669", "90deg,#047857,#10B981", "45deg,#064E3B,#047857"],
  };
  const slots = sets[category] ?? ["135deg,#334155,#475569", "90deg,#475569,#64748B", "45deg,#1E293B,#334155"];
  return `linear-gradient(${slots[slot % 3]})`;
}
const CAT_ICONS: Record<string, string> = { heritage: "🏛️", museum: "🏺", nature: "🌿", culture: "🕌", food: "🍽️", shopping: "🛍️", park: "🌳", beach: "🏖️" };

function DashPhotoModal({ poi, onClose }: { poi: ModalPoi; onClose: () => void }) {
  const { t } = useTranslation();
  const icon = CAT_ICONS[poi.category] ?? "📍";
  const name = poiName(t, poi);
  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    function onKey(e: KeyboardEvent) { if (e.key === "Escape") onClose(); }
    window.addEventListener("keydown", onKey);
    return () => { document.body.style.overflow = prev; window.removeEventListener("keydown", onKey); };
  }, [onClose]);

  return (
    <div
      role="dialog" aria-modal="true" aria-label={`${t("dash.photos.of")} ${name}`}
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}
      style={{ position: "fixed", inset: 0, zIndex: 9100, background: "rgba(0,0,0,0.72)", backdropFilter: "blur(5px)", display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}
    >
      <div onClick={e => e.stopPropagation()} style={{ background: "var(--sf-surface)", borderRadius: 16, width: "100%", maxWidth: 500, maxHeight: "90dvh", overflowY: "auto", boxShadow: "0 24px 64px rgba(0,0,0,0.55)", display: "flex", flexDirection: "column" }}>
        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12, padding: "16px 16px 12px", borderBottom: "1px solid var(--sf-border)", flexShrink: 0 }}>
          <div>
            <p style={{ fontWeight: 800, fontSize: "1.0625rem", color: "var(--sf-text)", lineHeight: 1.25, marginBottom: 5 }}>{name}</p>
            <span style={{ display: "inline-block", fontSize: "0.6875rem", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.07em", padding: "2px 8px", borderRadius: 20, background: "var(--sf-surface-alt)", color: "var(--sf-text-muted)" }}>{poi.category}</span>
          </div>
          <button type="button" onClick={onClose} aria-label="Close" style={{ width: 32, height: 32, borderRadius: 8, border: "1px solid var(--sf-border)", background: "var(--sf-surface-alt)", cursor: "pointer", color: "var(--sf-text-muted)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
            <X size={15} aria-hidden />
          </button>
        </div>
        <div style={{ padding: "14px 16px", display: "flex", flexDirection: "column", gap: 10 }}>
          {[0, 1, 2].map(slot => (
            <div key={slot} style={{ borderRadius: 10, overflow: "hidden", aspectRatio: "16/9", background: poiGradient(poi.category, slot), display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 10 }}>
              <span style={{ fontSize: "2.25rem", opacity: 0.88 }}>{icon}</span>
              <div style={{ textAlign: "center", padding: "0 16px" }}>
                <p style={{ fontSize: "0.8125rem", fontWeight: 700, color: "rgba(255,255,255,0.95)", lineHeight: 1.3, marginBottom: 2 }}>{name}</p>
                <p style={{ fontSize: "0.6875rem", color: "rgba(255,255,255,0.6)" }}>{t("dash.photos.counter").replace("{n}", String(slot + 1))}</p>
              </div>
            </div>
          ))}
        </div>
        <div style={{ padding: "10px 16px 16px", borderTop: "1px solid var(--sf-border)", flexShrink: 0 }}>
          {poi.map_url ? (
            <a href={poi.map_url} target="_blank" rel="noopener noreferrer" className="sf-dash-maps-link">
              <MapPin size={12} aria-hidden />Open in Google Maps<ExternalLink size={11} aria-hidden style={{ opacity: 0.7 }} />
            </a>
          ) : (
            <p style={{ fontSize: "0.8125rem", color: "var(--sf-text-muted)" }}>No maps link available.</p>
          )}
        </div>
      </div>
    </div>
  );
}

/* ── Ongoing: stop card ─────────────────────────────────────────────── */
function DashStopCard({ stop, onPhotoClick }: { stop: ItineraryStop; onPhotoClick: () => void }) {
  const { t } = useTranslation();
  const poi = stop.poi as unknown as ModalPoi & { culture_note?: string; hidden_gem?: boolean };
  return (
    <div className="sf-dash-stop">
      {/* Timeline dot */}
      <div style={{ width: 8, height: 8, borderRadius: "50%", background: "var(--sf-accent)", marginTop: 7, flexShrink: 0 }} />
      <div style={{ flex: 1, minWidth: 0 }}>
        {/* Time */}
        <div style={{ fontSize: "0.6875rem", color: "var(--sf-text-muted)", fontWeight: 600, marginBottom: 4 }}>
          {stop.startTime} – {stop.endTime}
        </div>
        {/* Name */}
        <div style={{ fontWeight: 700, color: "var(--sf-text)", fontSize: "0.9375rem", marginBottom: 6, lineHeight: 1.3 }}>
          {poiName(t, poi)}
        </div>
        {/* Badges */}
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: poi.culture_note ? 8 : 10 }}>
          <span style={{
            fontSize: "0.6875rem", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em",
            padding: "2px 8px", borderRadius: 20,
            background: "var(--sf-surface-alt)", color: "var(--sf-text-muted)",
          }}>
            {poi.category}
          </span>
          {poi.hidden_gem && (
            <span style={{ display: "inline-flex", alignItems: "center", gap: 3, fontSize: "0.6875rem", fontWeight: 700, color: "var(--sf-accent)", padding: "2px 8px", borderRadius: 20, background: "color-mix(in srgb, var(--sf-accent) 12%, var(--sf-surface))" }}>
              <Gem size={10} aria-hidden />
              Hidden gem
            </span>
          )}
        </div>
        {/* Culture note */}
        {poi.culture_note && (
          <p style={{ fontSize: "0.8125rem", color: "var(--sf-text-muted)", lineHeight: 1.6, marginBottom: 10 }}>
            {poiCulture(t, poi)}
          </p>
        )}
        {/* Actions */}
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <button type="button" className="sf-dash-photos-btn" onClick={onPhotoClick}>
            <Camera size={11} aria-hidden />Photos
          </button>
          {(poi as unknown as { map_url?: string }).map_url && (
            <a href={(poi as unknown as { map_url: string }).map_url} target="_blank" rel="noopener noreferrer" className="sf-dash-maps-link">
              <MapPin size={11} aria-hidden />Maps<ExternalLink size={10} aria-hidden style={{ opacity: 0.7 }} />
            </a>
          )}
        </div>
      </div>
    </div>
  );
}

/* ── Ongoing: meal row ──────────────────────────────────────────────── */
function DashMealRow({ meal, language }: { meal: ItineraryMeal; language: string }) {
  const { t } = useTranslation();
  const d = meal.dish;
  const name = dishName(t, d);
  const type = meal.type === "lunch" ? t("itin.lunch") : t("itin.dinner");
  const venueText = mealVenue(meal, language);
  const areaText  = mealArea(meal, language);
  return (
    <div style={{ display: "flex", gap: 12, alignItems: "flex-start", padding: "12px 0", borderBottom: "1px solid var(--sf-border)" }}>
      <div style={{ width: 8, height: 8, borderRadius: "50%", background: "color-mix(in srgb, var(--sf-warning) 80%, transparent)", marginTop: 6, flexShrink: 0 }} />
      <div style={{ flex: 1 }}>
        <div style={{ fontSize: "0.6875rem", color: "var(--sf-text-muted)", fontWeight: 600, marginBottom: 4 }}>
          {meal.estimatedTime} · {type}
        </div>
        <div style={{ fontWeight: 700, color: "var(--sf-text)", fontSize: "0.9375rem", lineHeight: 1.3 }}>{name}</div>
        {venueText && areaText ? (
          <div style={{ fontSize: "0.75rem", color: "var(--sf-text-muted)", marginTop: 2 }}>{venueText} · {areaText}</div>
        ) : (
          <div style={{ fontSize: "0.75rem", color: "var(--sf-text-muted)", marginTop: 2, fontStyle: "italic" }}>
            {t("itin.meal.venue_pending")}
          </div>
        )}
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 4, flexWrap: "wrap" }}>
          <span style={{ fontSize: "0.75rem", color: "var(--sf-text-muted)" }}>SAR {d.price_sar}</span>
          {meal.mapUrl && (
            <a href={meal.mapUrl} target="_blank" rel="noopener noreferrer" className="sf-dash-maps-link">
              <MapPin size={11} aria-hidden />{t("itin.maps")}<ExternalLink size={10} aria-hidden style={{ opacity: 0.7 }} />
            </a>
          )}
        </div>
      </div>
    </div>
  );
}

/* ── Ongoing: spend breakdown panel ────────────────────────────────── */
function ObjBar({ label, value, mounted }: { label: string; value: number; mounted: boolean }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 10 }}>
      <span style={{ minWidth: 96, fontSize: "0.8125rem", color: "var(--sf-text-muted)", fontWeight: 500 }}>{label}</span>
      <div className="sf-obj-bar-track">
        <div style={{ height: "100%", borderRadius: 3, background: "var(--sf-accent)", width: mounted ? `${Math.round(value * 100)}%` : "0%", transition: "width 0.7s cubic-bezier(0.25,1,0.5,1)" }} />
      </div>
      <span style={{ fontSize: "0.75rem", fontWeight: 700, color: "var(--sf-text)", minWidth: 30, textAlign: "end" }}>{Math.round(value * 100)}%</span>
    </div>
  );
}

function SpendPanel({ itin, trip, t }: { itin: ItineraryResult; trip: TripSpec; t: (k: string) => string }) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => { const id = setTimeout(() => setMounted(true), 80); return () => clearTimeout(id); }, []);

  const totalStops = itin.days.reduce((s, d) => s + d.stops.length, 0);
  const gemCount   = Math.round((itin.hiddenGemShare ?? 0) * totalStops);
  const overBudget = itin.budgetStatus === "over";
  const budgetPct  = trip.budget ? Math.min(1, itin.estimatedDailyAvg / trip.budget) : 0;

  const sortedObj = OBJ_KEYS
    .map(k => ({ key: k, val: itin.objectives[k] ?? 0 }))
    .sort((a, b) => b.val - a.val);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>

      {/* Cost bar */}
      <div className="sf-dash-card">
        <CardTitle>{t("dash.ongoing.spend")}</CardTitle>
        {trip.budget && itin.totalCostSar ? (
          <>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8, flexWrap: "wrap", gap: 8 }}>
              <span style={{ fontSize: "0.8125rem", color: "var(--sf-text-muted)", fontWeight: 600 }}>
                {t("dash.budget.est")}
              </span>
              <span style={{ fontWeight: 800, color: overBudget ? "var(--sf-warning)" : "var(--sf-success)" }}>
                SAR {Math.round(itin.totalCostSar).toLocaleString()}
              </span>
            </div>
            <div style={{ height: 8, background: "var(--sf-surface-alt)", borderRadius: 8, overflow: "hidden" }}>
              <div style={{ height: "100%", borderRadius: 8, background: overBudget ? "var(--sf-warning)" : "var(--sf-success)", width: mounted ? `${Math.round(budgetPct * 100)}%` : "0%", transition: "width 0.75s cubic-bezier(0.25,1,0.5,1)" }} />
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", marginTop: 6, fontSize: "0.75rem", color: "var(--sf-text-muted)" }}>
              <span>~SAR {Math.round(itin.estimatedDailyAvg)}/day</span>
              <span>{t("dash.budget.of")} SAR {trip.budget}/day</span>
            </div>
            {overBudget && <p style={{ fontSize: "0.75rem", color: "var(--sf-warning)", fontWeight: 700, marginTop: 4, textAlign: "end" }}>{t("dash.budget.over")}</p>}
          </>
        ) : (
          <p style={{ color: "var(--sf-text-muted)", fontSize: "0.875rem" }}>No budget data.</p>
        )}
      </div>

      {/* Stats tiles */}
      <div className="sf-dash-card">
        <CardTitle>{t("dash.stats.title")}</CardTitle>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: 10 }}>
          {[
            { val: totalStops, label: t("dash.stats.stops") },
            { val: gemCount,   label: t("dash.stats.gems") },
            { val: itin.verifiedCount ?? 0, label: t("dash.stats.verified") },
            { val: itin.days.length, label: "Days" },
          ].map(({ val, label }) => (
            <div key={label} className="sf-stat-tile">
              <div style={{ fontSize: "1.5rem", fontWeight: 800, color: "var(--sf-text)" }}>{val}</div>
              <div style={{ fontSize: "0.6875rem", color: "var(--sf-text-muted)", fontWeight: 600, marginTop: 2 }}>{label}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Objective bars */}
      <div className="sf-dash-card">
        <CardTitle>{t("dash.ongoing.objectives")}</CardTitle>
        {sortedObj.map(({ key, val }) => (
          <ObjBar key={key} label={OBJ_LABEL_EN[key] ?? key} value={val} mounted={mounted} />
        ))}
      </div>
    </div>
  );
}

/* ── Ongoing: day timeline ──────────────────────────────────────────── */
function DashDayTimeline({ day, language, onPhotoClick }: {
  day: ItineraryDay; language: string; onPhotoClick: (poi: ModalPoi) => void;
}) {
  // Merge stops and meals sorted by time
  type Item = { kind: "stop"; stop: ItineraryStop; } | { kind: "meal"; meal: ItineraryMeal };
  const items: Item[] = [];
  const stops  = [...day.stops].sort((a, b) => a.startTime.localeCompare(b.startTime));
  const meals  = [...day.meals].sort((a, b) => a.estimatedTime.localeCompare(b.estimatedTime));
  let mi = 0;
  for (const stop of stops) {
    while (mi < meals.length && meals[mi].estimatedTime < stop.startTime) {
      items.push({ kind: "meal", meal: meals[mi] });
      mi++;
    }
    items.push({ kind: "stop", stop });
  }
  while (mi < meals.length) { items.push({ kind: "meal", meal: meals[mi] }); mi++; }

  return (
    <div>
      {items.map((item, i) => {
        if (item.kind === "stop") {
          return (
            <DashStopCard
              key={`stop-${item.stop.poi.id}-${i}`}
              stop={item.stop}
              onPhotoClick={() => onPhotoClick(item.stop.poi as unknown as ModalPoi)}
            />
          );
        }
        return <DashMealRow key={`meal-${i}`} meal={item.meal} language={language} />;
      })}
    </div>
  );
}

/* ── Ongoing Trip tab ───────────────────────────────────────────────── */
function OngoingTripTab({ confirmed, language, t }: {
  confirmed: ConfirmedTrip | null; language: Language;
  t: (k: string) => string;
}) {
  const [, navigate]    = useLocation();
  const [activeDay, setActiveDay] = useState(0);
  const [modalPoi, setModalPoi]   = useState<ModalPoi | null>(null);

  if (!confirmed) {
    return (
      <div style={{ textAlign: "center", padding: "60px 24px", maxWidth: 400, margin: "0 auto" }}>
        <div style={{ fontSize: "3rem", marginBottom: 16 }}>✈️</div>
        <h2 style={{ fontSize: "1.125rem", fontWeight: 800, color: "var(--sf-text)", marginBottom: 8 }}>
          {t("dash.ongoing.empty.title")}
        </h2>
        <p style={{ color: "var(--sf-text-muted)", fontSize: "0.9375rem", lineHeight: 1.6, marginBottom: 24 }}>
          {t("dash.ongoing.empty.desc")}
        </p>
        <button
          onClick={() => navigate("/planner")}
          style={{ background: "var(--sf-accent)", color: "#0A0E16", border: "none", borderRadius: 10, padding: "13px 28px", fontWeight: 700, fontSize: "0.9375rem", cursor: "pointer" }}
        >
          {t("dash.ongoing.empty.cta")}
        </button>
      </div>
    );
  }

  const { trip, itinerary } = confirmed;
  const locale = localeTag(language);
  const cn     = cityName(trip, itinerary, language);
  const currentDay = itinerary.days[activeDay] ?? itinerary.days[0];

  return (
    <>
      {/* Trip header */}
      <div style={{ marginBottom: 24 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 6 }}>
          <span style={{ fontSize: "1.75rem" }}>✈️</span>
          <div>
            <h2 style={{ fontWeight: 800, color: "var(--sf-text)", fontSize: "1.25rem", lineHeight: 1.2 }}>{cn}</h2>
            {trip.dateStart && trip.dateEnd && (
              <p style={{ fontSize: "0.875rem", color: "var(--sf-text-muted)", marginTop: 2 }}>
                {fmtDate(trip.dateStart, locale)} → {fmtDate(trip.dateEnd, locale)}
                {" · "}{nightsBetween(trip.dateStart, trip.dateEnd)} nights
              </p>
            )}
          </div>
          <Link href="/itinerary" style={{
            marginInlineStart: "auto", display: "inline-flex", alignItems: "center", gap: 6,
            padding: "8px 16px", borderRadius: 8,
            border: "1.5px solid var(--sf-indigo)",
            background: "color-mix(in srgb, var(--sf-indigo) 10%, var(--sf-surface))",
            color: "var(--sf-indigo)", fontWeight: 700,
            fontSize: "0.8125rem", textDecoration: "none", flexShrink: 0,
          }}>
            Open Itinerary <ArrowRight size={13} aria-hidden />
          </Link>
        </div>
      </div>

      {/* Two-column layout on wider screens */}
      <div style={{ display: "grid", gridTemplateColumns: "minmax(0,1fr)", gap: 20 }}>

        {/* Spend breakdown — full width */}
        <SpendPanel itin={itinerary} trip={trip} t={t} />

        {/* Day timeline */}
        <div className="sf-dash-card" style={{ padding: 0, overflow: "hidden" }}>
          {/* Day tabs */}
          <div style={{ display: "flex", gap: 0, overflowX: "auto", borderBottom: "1px solid var(--sf-border)" }}>
            {itinerary.days.map((_, i) => (
              <button
                key={i} type="button"
                onClick={() => setActiveDay(i)}
                style={{
                  padding: "12px 18px", fontWeight: 700, fontSize: "0.875rem", cursor: "pointer",
                  border: "none", background: "none", whiteSpace: "nowrap",
                  color: activeDay === i ? "var(--sf-text)" : "var(--sf-text-muted)",
                  borderBottom: `2px solid ${activeDay === i ? "var(--sf-accent)" : "transparent"}`,
                  transition: "color .15s",
                }}
              >
                {t("dash.ongoing.day").replace("{n}", String(i + 1))}
              </button>
            ))}
          </div>

          {currentDay && (
            <div style={{ padding: "16px 18px" }}>
              {/* Daily cost */}
              {currentDay.dailyCostSar > 0 && (
                <div style={{
                  display: "flex", justifyContent: "space-between", alignItems: "center",
                  padding: "8px 12px", borderRadius: 8, background: "var(--sf-surface-alt)",
                  marginBottom: 14, fontSize: "0.8125rem",
                }}>
                  <span style={{ color: "var(--sf-text-muted)", fontWeight: 600 }}>Daily total</span>
                  <span style={{ fontWeight: 800, color: currentDay.overBudget ? "var(--sf-warning)" : "var(--sf-success)" }}>
                    SAR {currentDay.dailyCostSar.toLocaleString()}
                    {currentDay.overBudget && " · Over budget"}
                  </span>
                </div>
              )}
              <DashDayTimeline day={currentDay} language={language} onPhotoClick={setModalPoi} />
            </div>
          )}
        </div>

      </div>

      {/* Photo modal */}
      {modalPoi && <DashPhotoModal poi={modalPoi} onClose={() => setModalPoi(null)} />}
    </>
  );
}

/* ──────────────────────────────────────────────────────────────────────
   Main Dashboard
   ────────────────────────────────────────────────────────────────────── */
type TabKey = "profile" | "trips" | "ongoing";

export function Dashboard() {
  const { t, language } = useTranslation();
  usePageMeta("My Journey", "Your trip overview, learned phrases, food list and travel stats.");
  const [, navigate] = useLocation();
  useDashStyles();

  /* Load all data */
  const [profile,      setProfile]      = useState<ProfileData | null>(null);
  const [ongoingTrip,  setOngoingTrip]  = useState<ConfirmedTrip | null>(null);
  const [pastTrips,    setPastTrips]    = useState<ConfirmedTrip[]>([]);
  const [tab,          setTab]          = useState<TabKey>("ongoing");

  useEffect(() => {
    try { setProfile(JSON.parse(localStorage.getItem("safarly_profile") ?? "null")); } catch { /* */ }
    try { setOngoingTrip(JSON.parse(localStorage.getItem("safarly_ongoing_trip") ?? "null")); } catch { /* */ }
    try { setPastTrips(JSON.parse(localStorage.getItem("safarly_past_trips") ?? "[]")); } catch { /* */ }
  }, []);

  const auth = getAuth();
  const cn = ongoingTrip ? cityName(ongoingTrip.trip, ongoingTrip.itinerary, language) : "";

  /* If truly nothing at all — no auth, no data */
  const hasAnyData = !!(auth || profile || ongoingTrip || pastTrips.length);
  if (!hasAnyData) {
    return (
      <div style={{ paddingTop: 68, paddingBottom: 88, background: "var(--sf-bg)", minHeight: "100dvh", display: "flex", alignItems: "center", justifyContent: "center" }}>
        <div style={{ textAlign: "center", padding: "40px 24px", maxWidth: 400 }}>
          <div style={{ fontSize: "3rem", marginBottom: 16 }}>🗺️</div>
          <h2 style={{ fontSize: "1.25rem", fontWeight: 800, color: "var(--sf-text)", marginBottom: 8 }}>
            {t("dash.empty.title")}
          </h2>
          <p style={{ color: "var(--sf-text-muted)", fontSize: "0.9375rem", marginBottom: 24, lineHeight: 1.6 }}>
            {t("page.itinerary.desc")}
          </p>
          <button onClick={() => navigate("/login")} style={{ background: "var(--sf-accent)", color: "#0A0E16", border: "none", borderRadius: 10, padding: "13px 28px", fontSize: "0.9375rem", fontWeight: 700, cursor: "pointer", minHeight: 48 }}>
            {t("dash.empty.cta")}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div style={{ paddingTop: 68, paddingBottom: 88, background: "var(--sf-bg)", minHeight: "100dvh" }}>

      {/* Page header */}
      <AuroraHero minHeight="auto" className="sf-aurora-band">
        <div style={{ borderBottom: "1px solid var(--sf-border)", padding: "20px 20px 0" }}>
          <div style={{ maxWidth: 900, margin: "0 auto" }}>
            <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12, marginBottom: 16 }}>
              <div>
                <h1 style={{ fontSize: "clamp(1.25rem,4vw,1.625rem)", fontWeight: 800, color: "var(--sf-text)", letterSpacing: "-0.02em", marginBottom: 4 }}>
                  {t("page.dashboard.title")}
                </h1>
                <p style={{ color: "var(--sf-text-muted)", fontSize: "0.9375rem" }}>
                  {t("dash.welcome")}{auth?.name ? `, ${auth.name}` : ""}
                  {cn && ` — ${t("dash.city").replace("{city}", cn)}`}
                </p>
              </div>
            </div>

            {/* Tab bar */}
            <div style={{ display: "flex", gap: 4, overflowX: "auto", paddingBottom: 1 }}>
              <TabPill label={t("dash.tab.ongoing")} active={tab === "ongoing"} badge={ongoingTrip ? 1 : 0} onClick={() => setTab("ongoing")} />
              <TabPill label={t("dash.tab.trips")}   active={tab === "trips"}   badge={pastTrips.length} onClick={() => setTab("trips")} />
              <TabPill label={t("dash.tab.profile")} active={tab === "profile"} onClick={() => setTab("profile")} />
            </div>
          </div>
        </div>
      </AuroraHero>

      {/* Tab content */}
      <div style={{ maxWidth: 900, margin: "0 auto", padding: "24px 16px" }}>
        {tab === "profile" && (
          <ProfileTab t={t} />
        )}
        {tab === "trips" && (
          <TripsTab pastTrips={pastTrips} language={language} t={t} />
        )}
        {tab === "ongoing" && (
          <OngoingTripTab confirmed={ongoingTrip} language={language} t={t} />
        )}
      </div>
    </div>
  );
}
