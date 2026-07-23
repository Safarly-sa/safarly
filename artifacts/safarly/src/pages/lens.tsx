import { useEffect, useRef, useState } from "react";
import { Link } from "wouter";
import { Camera, CheckCircle2, AlertTriangle, X, Plus, ScanLine, RotateCcw, ChevronRight, MapPin, ExternalLink, Copy, Check, Sparkles } from "lucide-react";
import { useTranslation } from "@/providers/translation-context";
import { usePageMeta } from "@/lib/usePageMeta";
import { AuroraHero } from "@/components/AuroraHero";
import { getAuth } from "@/lib/auth";
import { ALLERGEN_LABEL_KEYS, readStoredAllergens } from "@/lib/allergens";
import { prepareImageForUpload } from "@/lib/image";
import { LANGUAGE_NAMES } from "@/lib/language-names";
import {
  scanMenuImage, scanPlaceImage, scanSignImage,
  type VisionDish, type VisionPlace, type VisionSign, type VisionErrorCode,
} from "@/lib/vision-api";
import dishesRaw from "@/data/dishes.json";

/* ── Types ──────────────────────────────────────────────────────────── */
type LensMode = "menu" | "place" | "signage";

interface Dish {
  id: string; name: string; name_ar: string;
  meal_type: string; price_sar: number;
  common_allergens: string[]; food_weight: number; description: string;
}

/**
 * Unified shape both the curated demo path (local dataset) and the real
 * vision-agent path (photographed menu) render through. The two sources carry
 * genuinely different guarantees — see `favoriteId` and `uncertain` below —
 * so DishCard/DishModal must not assume every field is present.
 */
interface DisplayDish {
  key: string;
  primary: string;      // shown large — demo: Arabic dataset name; live: exactly as printed
  secondary: string;     // shown small — demo: English name; live: translated
  primaryIsArabic: boolean;
  description: string;
  allergenTokens: string[];
  priceText?: string;
  originStory?: string;  // demo only — hand-written, doesn't exist for a photographed dish
  uncertain?: boolean;    // live only — the model flagged the read as unreliable
  /**
   * Only demo dishes have one: favorites are stored as dataset ids
   * (`safarly_favorites`) and looked up later via DISHES_MAP on the
   * dashboard. A live-scanned dish has no such id — "favoriting" it would
   * silently do nothing on the dashboard, so the button is hidden instead of
   * built to look like it works.
   */
  favoriteId?: string;
}

interface DisplayPlace {
  primary: string;
  category: string;
  note: string;
  tip?: string;
  mapUrl: string;
  uncertain: boolean;
}

interface DisplaySign {
  lines: { original: string; translated: string }[];
  meaning: string;
  uncertain: boolean;
}

interface ScanError {
  code: VisionErrorCode;
  retryAfterSeconds?: number;
}

/* ── Static data (demo path only) ──────────────────────────────────── */
const ALL_DISHES = dishesRaw as Dish[];
const DISHES_BY_ID = Object.fromEntries(ALL_DISHES.map(d => [d.id, d]));

// filename-substring → dish ID list. Curated so the "try a demo menu" buttons
// give an instant, reliable result without spending real vision-agent quota.
const DEMO_LOOKUP: Record<string, string[]> = {
  "menu-riyadh": ["kabsa_chicken","kabsa_lamb","jareesh","mandi_lamb","madfoon","ouzi"],
  "menu-jeddah": ["saleeg","machboos_rubyan","sayadiya","mutabbaq","fish_mandi","kunafa"],
  "menu-alula":  ["thareed","harees","maraq","lahm_basal","mathbi_chicken","kabsa_dinner"],
};

const DEMO_MENUS = [
  { key: "menu-riyadh", label: "Riyadh · النجد" },
  { key: "menu-jeddah", label: "Jeddah · الحجاز" },
  { key: "menu-alula",  label: "AlUla · التراث"  },
];

const ORIGIN_STORIES: Record<string, string> = {
  kabsa_chicken:    "Kabsa is Saudi Arabia's national dish, born in the Najd heartland. Traditionally cooked in a large deg (pot) over open flame for communal gatherings, its saffron-and-spice profile has been refined across generations.",
  kabsa_lamb:       "The lamb version of Kabsa is reserved for honored guests. The complex baharat spice blend — blending black lime, turmeric, and rose water — traces its origins to Bedouin trade routes across the Arabian interior.",
  jareesh:          "Jareesh is a Najdi highland staple made by stone-grinding wheat before slow-cooking it with lamb for hours. Once the meal of mountain settlements, it's now experiencing a culinary renaissance in Riyadh.",
  saleeg:           "Saleeg originates in the Hejaz around Jeddah and Mecca. The milk-broth technique reflects the region's cosmopolitan history, absorbing Persian and East African influences through centuries of Red Sea trade.",
  machboos_rubyan:  "Machboos Rubyan is the crown jewel of Gulf coastal cooking. Dried limes (loomi) traveled from Oman across the Arabian coast, giving this dish its distinct citrus depth.",
  sayadiya:         "Sayadiya means 'fisher's dish'. It arrived in the Hejaz via Levantine fishermen who settled the Red Sea coast — the caramelised onion gravy is their distinctive fingerprint.",
  thareed:          "Thareed is one of the oldest recorded Arabian dishes, praised in Hadith literature. Its layered construction — thin bread under rich stew — was designed to feed desert caravans efficiently.",
  harees:           "Harees has been made in Arabia for over 1,000 years and spread to South Asia via trade routes. Its Ramadan association comes from its ability to provide sustained energy for those fasting.",
  maraq:            "Maraq lamb broth is the ancestral opening course of every Saudi feast. In Bedouin tradition, the broth was served first to children and elders as a gesture of respect and care.",
  lahm_basal:       "Lahm bil Basal reflects the essential Najdi cooking philosophy: few ingredients, slow heat, profound depth. The caramelisation of onions is the critical and most jealously guarded skill.",
  mandi_lamb:       "Mandi originates in Yemen and spread with nomadic tribes across the Peninsula. The underground pit smoking technique — called tandoor — produces an unmistakable smoky fragrance impossible to replicate.",
  madfoon:          "Madfoon (buried lamb) is the pinnacle of Najdi culinary tradition. Hot coals are buried with the seasoned lamb overnight in a sand pit — a technique yielding impossibly tender meat without added water.",
  ouzi:             "Ouzi is the celebration dish of the Arabian Peninsula. A whole roasted lamb on spiced rice signals a wedding, a new business, or the welcoming of an honored guest.",
  mathbi_chicken:   "Mathbi means 'pressed on stones'. The spatchcocked bird is cooked between two flat stones heated over open coals — an ancient desert technique that chars the skin while keeping the interior moist.",
  mutabbaq:         "Mutabbaq means 'folded'. It likely arrived in Jeddah via Indian Ocean trade routes — versions exist from Jeddah to Java. The Al-Balad district version is considered the definitive Saudi form.",
  kabsa_dinner:     "The dinner-edition Kabsa adds dried apricots and a smokier spice profile, reflecting the Najdi tradition of evening feasts where richer, darker flavors were favored after a day of fasting.",
  fish_mandi:       "Jeddah's Fish Mandi represents the fusion of the Mandi smoking technique with the Red Sea's abundant harvest. Turmeric-scented rice absorbs fish oils and wood-smoke — a coastal masterpiece.",
  shish_tawook:     "Shish Tawook arrived from the Levant and became a Saudi grill staple. The garlic toum served alongside is distinctly Hejazi — bright, creamy, and intensely aromatic.",
  kunafa:           "Kunafa bil Jibneh traveled from the Levant to the Hejaz with Hajj pilgrims. Jeddah's version uses local white cheese and is served warm with rose-water syrup — a beloved iftar treat.",
};

// Re-exported name kept so the render code below reads unchanged; the
// vocabulary itself lives in lib/allergens.ts.
const ALLERGEN_KEYS: Record<string, string> = ALLERGEN_LABEL_KEYS;

const ARABIC_RE = /[؀-ۿ]/;

/* ── Demo-path lookup (curated, no API call) ───────────────────────── */
function demoScanMenu(filename: string): Dish[] {
  const lower = filename.toLowerCase();
  const key = Object.keys(DEMO_LOOKUP).find(k => lower.includes(k));
  if (key) return DEMO_LOOKUP[key].map(id => DISHES_BY_ID[id]).filter(Boolean) as Dish[];
  return [...ALL_DISHES].sort(() => Math.random() - 0.5).slice(0, 6);
}

/* ── Adapters: source-specific shape → DisplayDish ─────────────────── */
function demoDishToDisplay(d: Dish): DisplayDish {
  return {
    key: d.id,
    primary: d.name_ar,
    secondary: d.name,
    primaryIsArabic: true,
    description: d.description,
    allergenTokens: d.common_allergens,
    priceText: `SAR ${d.price_sar}`,
    originStory: ORIGIN_STORIES[d.id],
    favoriteId: d.id,
  };
}

function visionDishToDisplay(d: VisionDish, index: number): DisplayDish {
  return {
    key: `live-${index}`,
    primary: d.nameOriginal,
    secondary: d.nameTranslated,
    primaryIsArabic: ARABIC_RE.test(d.nameOriginal),
    description: d.description,
    allergenTokens: d.allergenTokens,
    priceText: d.priceText?.trim() || undefined,
    uncertain: d.uncertain,
  };
}

function visionPlaceToDisplay(p: VisionPlace): DisplayPlace {
  return {
    primary: p.nameTranslated,
    category: p.category,
    note: p.culturalContext,
    tip: p.visitorTip,
    mapUrl: `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(p.name + " Saudi Arabia")}`,
    uncertain: p.uncertain,
  };
}

/* ── Style injection ────────────────────────────────────────────────── */
function useLensStyles() {
  useEffect(() => {
    const id = "sf-lens-styles";
    if (document.getElementById(id)) return;
    const s = document.createElement("style");
    s.id = id;
    s.textContent = `
      @keyframes sf-sweep {
        0%   { top: 0%;   opacity: 0.9; }
        90%  { top: 90%;  opacity: 0.9; }
        100% { top: 100%; opacity: 0;   }
      }
      .sf-scan-sweep {
        position: absolute; left: 0; right: 0;
        height: 3px;
        background: linear-gradient(90deg, transparent 0%, var(--sf-accent) 30%, var(--sf-accent) 70%, transparent 100%);
        box-shadow: 0 0 14px 4px color-mix(in srgb, var(--sf-accent) 60%, transparent);
        animation: sf-sweep 2.0s ease-in-out infinite;
        border-radius: 2px;
      }
      @keyframes sf-corner-pulse {
        0%,100% { opacity: 1; } 50% { opacity: 0.5; }
      }
      .sf-drop-active .sf-vf-corner { animation: sf-corner-pulse 0.6s ease infinite; }
      .sf-dish-card {
        background: var(--sf-surface);
        border: 1px solid var(--sf-border);
        border-radius: 12px;
        padding: 14px 16px;
        cursor: pointer;
        transition: box-shadow 0.15s, border-color 0.15s;
      }
      .sf-dish-card:hover {
        border-color: var(--sf-accent);
        box-shadow: 0 4px 20px color-mix(in srgb, var(--sf-accent) 10%, transparent);
      }
      .sf-modal-backdrop {
        position: fixed; inset: 0;
        background: rgba(0,0,0,0.65);
        z-index: 200;
        display: flex; align-items: flex-end;
        backdrop-filter: blur(4px);
      }
      @media (min-width: 600px) {
        .sf-modal-backdrop { align-items: center; justify-content: center; }
        .sf-modal-card { border-radius: 16px !important; max-width: 520px !important; max-height: 80dvh; }
      }
      .sf-modal-card {
        background: var(--sf-surface);
        border-radius: 16px 16px 0 0;
        width: 100%; max-height: 90dvh;
        overflow-y: auto; padding: 24px 20px;
        position: relative;
      }
      .sf-add-btn {
        display: flex; align-items: center; gap: 8px;
        padding: 13px 20px; border-radius: 10px;
        border: none; cursor: pointer;
        font-size: 0.9rem; font-weight: 700;
        width: 100%; justify-content: center;
        min-height: 48px; transition: opacity 0.15s;
      }
      .sf-add-btn:hover { opacity: 0.85; }
      .sf-demo-btn {
        padding: 9px 14px; border-radius: 999px;
        border: 1px solid var(--sf-border);
        background: var(--sf-surface);
        color: var(--sf-text-muted);
        font-size: 0.8125rem; font-weight: 600;
        cursor: pointer; white-space: nowrap;
        min-height: 40px; transition: border-color 0.15s, color 0.15s;
      }
      .sf-demo-btn:hover { border-color: var(--sf-accent); color: var(--sf-accent); }
      .sf-upload-zone {
        border: 2px dashed var(--sf-border);
        border-radius: 16px;
        background: var(--sf-surface);
        position: relative; overflow: hidden;
        transition: border-color 0.15s;
        cursor: pointer;
      }
      .sf-upload-zone:hover, .sf-drop-active .sf-upload-zone {
        border-color: var(--sf-accent);
      }
      .sf-vf-corner {
        position: absolute;
        width: 20px; height: 20px;
        border-color: var(--sf-accent);
        border-style: solid;
      }
      /* mode tabs */
      .sf-lens-tab {
        padding: 8px 20px; border-radius: 8px; font-size: 0.875rem;
        font-weight: 700; cursor: pointer; border: 1.5px solid transparent;
        transition: all .18s; white-space: nowrap;
        background: transparent; color: var(--sf-text-muted);
      }
      .sf-lens-tab.active {
        background: var(--sf-surface); color: var(--sf-text);
        border-color: var(--sf-border);
        box-shadow: 0 2px 8px rgba(0,0,0,0.12);
      }
      .sf-lens-tab:not(.active):hover { color: var(--sf-text); }
      /* place card */
      .sf-place-card {
        background: var(--sf-surface); border: 1px solid var(--sf-border);
        border-radius: 14px; padding: 24px; display: flex; flex-direction: column; gap: 16px;
      }
      /* sign row */
      .sf-sign-row {
        display: flex; align-items: flex-start; gap: 12px;
        padding: 14px 16px; border-radius: 12px;
        background: var(--sf-surface); border: 1px solid var(--sf-border);
        transition: border-color .15s;
      }
      .sf-sign-row:hover { border-color: color-mix(in srgb, var(--sf-accent) 40%, var(--sf-border)); }
      .sf-copy-btn {
        display: inline-flex; align-items: center; gap: 7px;
        padding: 10px 18px; border-radius: 999px; border: 1.5px solid var(--sf-border);
        background: var(--sf-surface); color: var(--sf-text-muted);
        font-size: 0.8125rem; font-weight: 600; cursor: pointer;
        transition: border-color .15s, color .15s;
      }
      .sf-copy-btn:hover { border-color: var(--sf-accent); color: var(--sf-accent); }
      .sf-copy-btn.copied { border-color: var(--sf-success); color: var(--sf-success); }
      .sf-uncertain-badge {
        display: inline-flex; align-items: center; gap: 5px;
        padding: 3px 8px; border-radius: 999px;
        background: color-mix(in srgb, #F59E0B 12%, var(--sf-surface));
        border: 1px solid color-mix(in srgb, #F59E0B 35%, transparent);
        color: #B45309; font-size: 0.6875rem; font-weight: 700;
      }
      .sf-error-card {
        background: var(--sf-surface); border: 1px solid var(--sf-border);
        border-radius: 14px; padding: 28px 24px; text-align: center;
        display: flex; flex-direction: column; align-items: center; gap: 14px;
      }
    `;
    document.head.appendChild(s);
  }, []);
}

/* ── Corner brackets ────────────────────────────────────────────────── */
function ViewfinderCorners() {
  const base: React.CSSProperties = { position: "absolute", width: 22, height: 22, borderColor: "var(--sf-accent)", borderStyle: "solid" };
  return (
    <>
      <div className="sf-vf-corner" style={{ ...base, top: 14, left: 14,  borderWidth: "3px 0 0 3px" }} />
      <div className="sf-vf-corner" style={{ ...base, top: 14, right: 14, borderWidth: "3px 3px 0 0" }} />
      <div className="sf-vf-corner" style={{ ...base, bottom: 14, left: 14,  borderWidth: "0 0 3px 3px" }} />
      <div className="sf-vf-corner" style={{ ...base, bottom: 14, right: 14, borderWidth: "0 3px 3px 0" }} />
    </>
  );
}

/* ── Allergen warning chip ──────────────────────────────────────────── */
function AllergenChip({ allergen, t }: { allergen: string; t: (k: string) => string }) {
  const label = t(ALLERGEN_KEYS[allergen] ?? allergen);
  const warn  = t("lens.allergy_warn").replace("{allergen}", label);
  return (
    <span style={{
      display: "inline-flex", alignItems: "center", gap: 4,
      padding: "3px 8px", borderRadius: 999,
      background: "color-mix(in srgb, var(--sf-error) 10%, var(--sf-surface))",
      border: "1px solid color-mix(in srgb, var(--sf-error) 30%, transparent)",
      color: "var(--sf-error)", fontSize: "0.6875rem", fontWeight: 700,
      flexShrink: 0,
    }}>
      <AlertTriangle size={11} aria-hidden />
      {warn}
    </span>
  );
}

function UncertainBadge({ t }: { t: (k: string) => string }) {
  return (
    <span className="sf-uncertain-badge" title={t("lens.uncertain")}>
      <Sparkles size={10} aria-hidden />
      {t("lens.uncertain")}
    </span>
  );
}

/* ── Dish card ──────────────────────────────────────────────────────── */
function DishCard({ dish, userAllergens, t, onClick }: {
  dish: DisplayDish; userAllergens: string[]; t: (k: string) => string;
  onClick: () => void;
}) {
  const warnings = dish.allergenTokens.filter(a => userAllergens.includes(a));
  return (
    <div className="sf-dish-card" onClick={onClick} role="button" tabIndex={0}
      onKeyDown={e => e.key === "Enter" && onClick()}
      aria-label={`${dish.secondary || dish.primary} — ${t("lens.modal.details")}`}
    >
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 8, marginBottom: 6 }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{
            fontSize: "1.25rem", fontWeight: 700, color: "var(--sf-text)", lineHeight: 1.2,
            direction: dish.primaryIsArabic ? "rtl" : "ltr", textAlign: dish.primaryIsArabic ? "end" : "start",
          }}>
            {dish.primary}
          </div>
          {dish.secondary && (
            <div style={{ fontSize: "0.875rem", fontWeight: 600, color: "var(--sf-text-muted)", marginTop: 3 }}>
              {dish.secondary}
            </div>
          )}
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 4, flexShrink: 0 }}>
          <span style={{ fontSize: "0.9375rem", fontWeight: 800, color: "var(--sf-text)" }}>
            {dish.priceText ?? t("lens.price.unknown")}
          </span>
          <ChevronRight size={14} style={{ color: "var(--sf-text-muted)" }} aria-hidden />
        </div>
      </div>

      <p style={{ fontSize: "0.8125rem", color: "var(--sf-text-muted)", lineHeight: 1.55, marginBottom: (warnings.length || dish.uncertain) ? 10 : 0 }}>
        {dish.description}
      </p>

      {(warnings.length > 0 || dish.uncertain) && (
        <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginTop: 8 }}>
          {warnings.map(a => <AllergenChip key={a} allergen={a} t={t} />)}
          {dish.uncertain && <UncertainBadge t={t} />}
        </div>
      )}
    </div>
  );
}

/* ── Dish modal ─────────────────────────────────────────────────────── */
function DishModal({ dish, userAllergens, isFav, t, onClose, onAddFav }: {
  dish: DisplayDish; userAllergens: string[]; isFav: boolean;
  t: (k: string) => string;
  onClose: () => void; onAddFav: () => void;
}) {
  const warnings = dish.allergenTokens.filter(a => userAllergens.includes(a));

  return (
    <div className="sf-modal-backdrop" onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="sf-modal-card">
        <button onClick={onClose} style={{
          position: "absolute", top: 16, insetInlineEnd: 16,
          background: "var(--sf-surface-alt)", border: "none", borderRadius: "50%",
          width: 36, height: 36, display: "flex", alignItems: "center",
          justifyContent: "center", cursor: "pointer",
        }} aria-label={t("lens.modal.close")}>
          <X size={16} style={{ color: "var(--sf-text-muted)" }} />
        </button>

        <div style={{
          fontSize: "2rem", fontWeight: 800, color: "var(--sf-text)",
          direction: dish.primaryIsArabic ? "rtl" : "ltr", textAlign: dish.primaryIsArabic ? "end" : "start",
          marginBottom: 4, paddingInlineEnd: 40,
        }}>
          {dish.primary}
        </div>
        {dish.secondary && (
          <div style={{ fontSize: "1rem", color: "var(--sf-text-muted)", fontWeight: 600, marginBottom: 16 }}>
            {dish.secondary}
          </div>
        )}

        <div style={{ marginBottom: 20, display: "flex", gap: 8, flexWrap: "wrap" }}>
          <span style={{
            display: "inline-block", padding: "4px 12px", borderRadius: 999,
            background: "color-mix(in srgb, var(--sf-accent) 12%, var(--sf-surface))",
            color: "var(--sf-text-accent)", fontWeight: 800, fontSize: "0.9375rem",
          }}>
            {dish.priceText ?? t("lens.price.unknown")}
          </span>
          {dish.uncertain && <UncertainBadge t={t} />}
        </div>

        <p style={{ fontSize: "0.9375rem", color: "var(--sf-text)", lineHeight: 1.7, marginBottom: 20 }}>
          {dish.description}
        </p>

        {dish.originStory && (
          <div style={{ marginBottom: 20 }}>
            <h3 style={{ fontSize: "0.75rem", fontWeight: 700, color: "var(--sf-text-muted)", letterSpacing: "0.06em", textTransform: "uppercase", marginBottom: 8 }}>
              {t("lens.modal.origin")}
            </h3>
            <p style={{ fontSize: "0.875rem", color: "var(--sf-text-muted)", lineHeight: 1.7 }}>
              {dish.originStory}
            </p>
          </div>
        )}

        <div style={{ marginBottom: 24 }}>
          <h3 style={{ fontSize: "0.75rem", fontWeight: 700, color: "var(--sf-text-muted)", letterSpacing: "0.06em", textTransform: "uppercase", marginBottom: 8 }}>
            {t("lens.modal.allergens")}
          </h3>
          {dish.allergenTokens.length === 0 ? (
            <span style={{ fontSize: "0.875rem", color: "var(--sf-success)", fontWeight: 600 }}>
              {t("lens.modal.none")}
            </span>
          ) : (
            <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
              {dish.allergenTokens.map(a => (
                <span key={a} style={{
                  padding: "3px 10px", borderRadius: 999,
                  background: warnings.includes(a)
                    ? "color-mix(in srgb, var(--sf-error) 12%, var(--sf-surface))"
                    : "var(--sf-surface-alt)",
                  color: warnings.includes(a) ? "var(--sf-error)" : "var(--sf-text-muted)",
                  fontSize: "0.8125rem", fontWeight: 600,
                  border: `1px solid ${warnings.includes(a) ? "color-mix(in srgb, var(--sf-error) 30%, transparent)" : "var(--sf-border)"}`,
                }}>
                  {t(ALLERGEN_KEYS[a] ?? a)}
                  {warnings.includes(a) && " ⚠"}
                </span>
              ))}
            </div>
          )}
        </div>

        {/* Favorite only offered for demo dishes — see DisplayDish.favoriteId */}
        {dish.favoriteId && (
          <button
            className="sf-add-btn"
            onClick={onAddFav}
            style={{
              background: isFav ? "var(--sf-surface-alt)" : "var(--sf-accent)",
              color: isFav ? "var(--sf-success)" : "#0A0E16",
            }}
          >
            {isFav ? <CheckCircle2 size={16} aria-hidden /> : <Plus size={16} aria-hidden />}
            {isFav ? t("lens.added") : t("lens.add_fav")}
          </button>
        )}
      </div>
    </div>
  );
}

/* ── Mode tab bar ───────────────────────────────────────────────────── */
function ModeTabs({ mode, onSwitch, t }: {
  mode: LensMode; onSwitch: (m: LensMode) => void; t: (k: string) => string;
}) {
  const tabs: { key: LensMode; icon: string; label: string }[] = [
    { key: "menu",    icon: "🍽️", label: t("lens.tab.menu")    },
    { key: "place",   icon: "📍", label: t("lens.tab.place")   },
    { key: "signage", icon: "🪧", label: t("lens.tab.signage") },
  ];
  return (
    <div style={{ display: "flex", gap: 6, overflowX: "auto", paddingBottom: 2 }}>
      {tabs.map(({ key, icon, label }) => (
        <button
          key={key} type="button"
          className={`sf-lens-tab${mode === key ? " active" : ""}`}
          onClick={() => onSwitch(key)}
        >
          <span style={{ marginInlineEnd: 6 }}>{icon}</span>
          {label}
        </button>
      ))}
    </div>
  );
}

/* ── Place result card ──────────────────────────────────────────────── */
function PlaceCard({ result, t, onReset }: {
  result: DisplayPlace; t: (k: string) => string; onReset: () => void;
}) {
  const CAT_ICONS: Record<string, string> = {
    heritage: "🏛️", museum: "🏺", nature: "🌿", culture: "🕌",
    food: "🍽️", shopping: "🛍️", park: "🌳", beach: "🏖️",
    modern: "🏙️", entertainment: "🎡", art: "🎨", adventure: "🧗", religion: "☪️",
  };
  const icon = CAT_ICONS[result.category.toLowerCase()] ?? "📍";

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <h2 style={{ fontSize: "1.0625rem", fontWeight: 800, color: "var(--sf-text)" }}>
          {t("lens.place.title")}
        </h2>
        <button
          onClick={onReset}
          style={{ display: "flex", alignItems: "center", gap: 6, padding: "9px 16px", borderRadius: 999, minHeight: 40, border: "1px solid var(--sf-border)", background: "var(--sf-surface)", color: "var(--sf-text-muted)", fontSize: "0.8125rem", fontWeight: 600, cursor: "pointer" }}
        >
          <RotateCcw size={13} aria-hidden /> {t("lens.place.rescan")}
        </button>
      </div>

      <div className="sf-place-card">
        <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
          <div style={{
            width: 64, height: 64, borderRadius: 14, flexShrink: 0,
            background: "color-mix(in srgb, var(--sf-accent) 12%, var(--sf-surface))",
            border: "1px solid var(--sf-border)",
            display: "flex", alignItems: "center", justifyContent: "center",
            fontSize: "1.875rem",
          }}>
            {icon}
          </div>
          <div>
            <h3 style={{ fontWeight: 800, color: "var(--sf-text)", fontSize: "1.125rem", lineHeight: 1.25, marginBottom: 6 }}>
              {result.primary}
            </h3>
            <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
              <span style={{
                display: "inline-block", fontSize: "0.6875rem", fontWeight: 700,
                textTransform: "uppercase", letterSpacing: "0.07em",
                padding: "3px 10px", borderRadius: 20,
                background: "var(--sf-surface-alt)", color: "var(--sf-text-muted)",
              }}>
                {result.category}
              </span>
              {result.uncertain && <UncertainBadge t={t} />}
            </div>
          </div>
        </div>

        <div>
          <p style={{ fontSize: "0.6875rem", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.07em", color: "var(--sf-text-muted)", marginBottom: 8 }}>
            {t("lens.place.culture")}
          </p>
          <p style={{ fontSize: "0.9375rem", color: "var(--sf-text)", lineHeight: 1.7 }}>
            {result.note}
          </p>
        </div>

        {result.tip && (
          <div>
            <p style={{ fontSize: "0.6875rem", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.07em", color: "var(--sf-text-muted)", marginBottom: 8 }}>
              {t("lens.place.tip")}
            </p>
            <p style={{ fontSize: "0.9375rem", color: "var(--sf-text)", lineHeight: 1.7 }}>
              {result.tip}
            </p>
          </div>
        )}

        <a
          href={result.mapUrl} target="_blank" rel="noopener noreferrer"
          style={{
            display: "inline-flex", alignItems: "center", gap: 7, alignSelf: "flex-start",
            padding: "10px 18px", borderRadius: 999,
            border: "1.5px solid var(--sf-indigo)",
            background: "color-mix(in srgb, var(--sf-indigo) 8%, var(--sf-surface))",
            color: "var(--sf-indigo)", fontWeight: 700, fontSize: "0.875rem",
            textDecoration: "none",
          }}
        >
          <MapPin size={14} aria-hidden />
          {t("lens.place.maps")}
          <ExternalLink size={12} aria-hidden style={{ opacity: 0.7 }} />
        </a>
      </div>
    </div>
  );
}

/* ── Signage result ─────────────────────────────────────────────────── */
function SignResults({ result, t, onReset }: {
  result: DisplaySign; t: (k: string) => string; onReset: () => void;
}) {
  const [copied, setCopied] = useState(false);

  function copyAll() {
    const text = result.lines.map(l => `${l.original} — ${l.translated}`).join("\n") + `\n\n${result.meaning}`;
    navigator.clipboard.writeText(text).catch(() => { /* silent */ });
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 10 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <h2 style={{ fontSize: "1.0625rem", fontWeight: 800, color: "var(--sf-text)" }}>
            {t("lens.sign.title")}
          </h2>
          {result.uncertain && <UncertainBadge t={t} />}
        </div>
        <button
          onClick={onReset}
          style={{ display: "flex", alignItems: "center", gap: 6, padding: "9px 16px", borderRadius: 999, minHeight: 40, border: "1px solid var(--sf-border)", background: "var(--sf-surface)", color: "var(--sf-text-muted)", fontSize: "0.8125rem", fontWeight: 600, cursor: "pointer" }}
        >
          <RotateCcw size={13} aria-hidden /> {t("lens.sign.rescan")}
        </button>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {result.lines.map((line, i) => (
          <div key={i} className="sf-sign-row">
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{
                fontWeight: 800, color: "var(--sf-text)", fontSize: "1.0625rem", lineHeight: 1.3,
                direction: ARABIC_RE.test(line.original) ? "rtl" : "ltr",
                textAlign: ARABIC_RE.test(line.original) ? "end" : "start",
              }}>
                {line.original}
              </div>
              <div style={{ fontSize: "0.8125rem", color: "var(--sf-text-muted)", marginTop: 4 }}>
                {line.translated}
              </div>
            </div>
          </div>
        ))}
      </div>

      {result.meaning && (
        <div className="sf-place-card" style={{ padding: "16px 18px" }}>
          <p style={{ fontSize: "0.6875rem", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.07em", color: "var(--sf-text-muted)", marginBottom: 6 }}>
            {t("lens.sign.meaning")}
          </p>
          <p style={{ fontSize: "0.9375rem", color: "var(--sf-text)", lineHeight: 1.6 }}>
            {result.meaning}
          </p>
        </div>
      )}

      <div style={{ display: "flex", justifyContent: "center", marginTop: 4 }}>
        <button
          type="button" onClick={copyAll}
          className={`sf-copy-btn${copied ? " copied" : ""}`}
        >
          {copied
            ? <><Check size={14} aria-hidden /> {t("lens.sign.copied")}</>
            : <><Copy size={14} aria-hidden /> {t("lens.sign.copy")}</>
          }
        </button>
      </div>
    </div>
  );
}

/* ── Error card ─────────────────────────────────────────────────────── */
function ErrorCard({ error, t, onRetry }: {
  error: ScanError; t: (k: string) => string; onRetry: () => void;
}) {
  const messageKey: Record<VisionErrorCode, string> = {
    "not-signed-in": "lens.error.signin",
    "rate-limited": "lens.error.ratelimited",
    "not-configured": "lens.error.notconfigured",
    "bad-image": "lens.error.badimage",
    "offline": "lens.error.offline",
    "unknown": "lens.error.unknown",
  };

  return (
    <div className="sf-error-card">
      <AlertTriangle size={28} style={{ color: "#F59E0B" }} aria-hidden />
      <div>
        <p style={{ fontWeight: 800, color: "var(--sf-text)", fontSize: "1.0625rem", marginBottom: 6 }}>
          {t("lens.error.title")}
        </p>
        <p style={{ color: "var(--sf-text-muted)", fontSize: "0.875rem", lineHeight: 1.6 }}>
          {t(messageKey[error.code])}
        </p>
        {typeof error.retryAfterSeconds === "number" && error.retryAfterSeconds > 0 && (
          <p style={{ color: "var(--sf-text-muted)", fontSize: "0.75rem", marginTop: 6 }}>
            ~{error.retryAfterSeconds}s
          </p>
        )}
      </div>

      {error.code === "not-signed-in" ? (
        <Link
          href="/login"
          style={{
            display: "inline-flex", alignItems: "center", padding: "11px 22px",
            borderRadius: 999, background: "var(--sf-accent)", color: "#0A0E16",
            fontWeight: 700, fontSize: "0.875rem", textDecoration: "none",
          }}
        >
          {t("lens.error.signin.cta")}
        </Link>
      ) : (
        <button
          type="button" onClick={onRetry}
          style={{
            display: "inline-flex", alignItems: "center", gap: 6, padding: "11px 22px",
            borderRadius: 999, border: "1.5px solid var(--sf-border)", background: "var(--sf-surface)",
            color: "var(--sf-text)", fontWeight: 700, fontSize: "0.875rem", cursor: "pointer",
          }}
        >
          <RotateCcw size={14} aria-hidden /> {t("lens.error.retry")}
        </button>
      )}
    </div>
  );
}

/* ── Main Lens page ─────────────────────────────────────────────────── */
type Phase = "upload" | "scanning" | "results";

export function Lens() {
  const { t, language } = useTranslation();
  usePageMeta("Live Lens", "Scan restaurant menus and spot allergens instantly with AI.");
  useLensStyles();

  const [mode,        setMode]        = useState<LensMode>("menu");
  const [phase,       setPhase]       = useState<Phase>("upload");
  const [imageUrl,    setImageUrl]    = useState<string | null>(null);
  const [scanError,   setScanError]   = useState<ScanError | null>(null);
  // Menu-mode state
  const [displayDishes, setDisplayDishes] = useState<DisplayDish[]>([]);
  const [selected,    setSelected]    = useState<DisplayDish | null>(null);
  const [favorites,   setFavorites]   = useState<string[]>(() => {
    try { return JSON.parse(localStorage.getItem("safarly_favorites") ?? "[]"); } catch { return []; }
  });
  // Place-mode state
  const [displayPlace, setDisplayPlace] = useState<DisplayPlace | null>(null);
  // Signage-mode state
  const [displaySign, setDisplaySign] = useState<DisplaySign | null>(null);
  const [userAllergens, setAllergens] = useState<string[]>([]);
  const [isDragging,  setIsDragging]  = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const objectUrlRef = useRef<string | null>(null);
  const lastActionRef = useRef<(() => void) | null>(null);

  useEffect(() => {
    // Via the normaliser: profiles saved by the onboarding wizard stored
    // "ob.allergy.*" keys, which never matched dish allergen tokens.
    setAllergens(readStoredAllergens());
    return () => { if (objectUrlRef.current) URL.revokeObjectURL(objectUrlRef.current); };
  }, []);

  function clearResults() {
    setScanError(null);
    setDisplayDishes([]);
    setSelected(null);
    setDisplayPlace(null);
    setDisplaySign(null);
  }

  async function runDemoScan(filename: string) {
    setPhase("scanning");
    await new Promise(r => setTimeout(r, 1100));
    setDisplayDishes(demoScanMenu(filename).map(demoDishToDisplay));
    setPhase("results");
  }

  async function runLiveScan(file: File, targetMode: LensMode) {
    setPhase("scanning");

    if (!getAuth()) {
      setScanError({ code: "not-signed-in" });
      setPhase("results");
      return;
    }

    try {
      const prepared = await prepareImageForUpload(file);
      const languageName = LANGUAGE_NAMES[language] ?? "English";

      if (targetMode === "menu") {
        const r = await scanMenuImage(prepared.base64, prepared.mimeType, languageName);
        if (!r.ok) { setScanError(r); } else { setDisplayDishes(r.data.dishes.map(visionDishToDisplay)); }
      } else if (targetMode === "place") {
        const r = await scanPlaceImage(prepared.base64, prepared.mimeType, languageName);
        if (!r.ok) { setScanError(r); } else { setDisplayPlace(visionPlaceToDisplay(r.data)); }
      } else {
        const r = await scanSignImage(prepared.base64, prepared.mimeType, languageName);
        if (!r.ok) { setScanError(r); } else { setDisplaySign(r.data); }
      }
    } catch {
      setScanError({ code: "unknown" });
    }
    setPhase("results");
  }

  function handleFile(file: File) {
    if (objectUrlRef.current) URL.revokeObjectURL(objectUrlRef.current);
    const url = URL.createObjectURL(file);
    objectUrlRef.current = url;
    setImageUrl(url);
    clearResults();
    const targetMode = mode;
    lastActionRef.current = () => { void runLiveScan(file, targetMode); };
    void runLiveScan(file, targetMode);
  }

  function tryDemo(key: string) {
    const base = import.meta.env.BASE_URL.replace(/\/$/, "");
    const url = `${base}/demo-menus/${key}.svg`;
    if (objectUrlRef.current) { URL.revokeObjectURL(objectUrlRef.current); objectUrlRef.current = null; }
    setImageUrl(url);
    clearResults();
    lastActionRef.current = () => { void runDemoScan(`${key}.svg`); };
    void runDemoScan(`${key}.svg`);
  }

  function addFavorite(dishId: string) {
    const next = [...new Set([...favorites, dishId])];
    setFavorites(next);
    localStorage.setItem("safarly_favorites", JSON.stringify(next));
  }

  function reset() {
    setPhase("upload");
    setImageUrl(null);
    clearResults();
    lastActionRef.current = null;
    if (objectUrlRef.current) { URL.revokeObjectURL(objectUrlRef.current); objectUrlRef.current = null; }
  }

  function switchMode(m: LensMode) {
    setMode(m);
    reset();
  }

  function retryLastAction() {
    setScanError(null);
    lastActionRef.current?.();
  }

  /* ── Render ── */
  return (
    <div style={{ paddingTop: 68, paddingBottom: 88, background: "var(--sf-bg)", minHeight: "100dvh" }}>
      {/* Header */}
      <AuroraHero minHeight="auto" className="sf-aurora-band">
        <div style={{ borderBottom: "1px solid var(--sf-border)", padding: "20px 20px 0" }}>
          <div style={{ maxWidth: 680, margin: "0 auto" }}>
            <h1 style={{ fontSize: "clamp(1.25rem,4vw,1.625rem)", fontWeight: 800, color: "var(--sf-text)", letterSpacing: "-0.02em", marginBottom: 4 }}>
              {t("page.lens.title")}
            </h1>
            <p style={{ color: "var(--sf-text-muted)", fontSize: "0.875rem", marginBottom: 16 }}>{t("lens.subtitle")}</p>
            <ModeTabs mode={mode} onSwitch={switchMode} t={t} />
          </div>
        </div>
      </AuroraHero>

      <div style={{ maxWidth: 680, margin: "0 auto", padding: "24px 16px" }}>

        {/* ── Upload phase ── */}
        {phase === "upload" && (
          <>
            <div
              className={isDragging ? "sf-drop-active" : ""}
              onDragOver={e => { e.preventDefault(); setIsDragging(true); }}
              onDragLeave={() => setIsDragging(false)}
              onDrop={e => { e.preventDefault(); setIsDragging(false); const f = e.dataTransfer.files[0]; if (f) handleFile(f); }}
            >
              <div
                className="sf-upload-zone"
                onClick={() => fileRef.current?.click()}
                role="button" tabIndex={0}
                onKeyDown={e => e.key === "Enter" && fileRef.current?.click()}
                style={{ padding: "52px 24px", textAlign: "center", minHeight: 240 }}
              >
                <ViewfinderCorners />
                <Camera size={40} style={{ color: "var(--sf-accent)", margin: "0 auto 16px" }} aria-hidden />
                <p style={{ fontSize: "1.0625rem", fontWeight: 700, color: "var(--sf-text)", marginBottom: 8 }}>
                  {isDragging
                    ? t("lens.drag_here")
                    : t(mode === "place" ? "lens.upload.title.place" : mode === "signage" ? "lens.upload.title.signage" : "lens.upload.title")}
                </p>
                <p style={{ fontSize: "0.875rem", color: "var(--sf-text-muted)", marginBottom: 16 }}>
                  {t(mode === "place" ? "lens.upload.desc.place" : mode === "signage" ? "lens.upload.desc.signage" : "lens.upload.desc")}
                </p>
                <span style={{
                  display: "inline-block", padding: "10px 22px", borderRadius: 999,
                  background: "var(--sf-accent)", color: "#0A0E16",
                  fontWeight: 700, fontSize: "0.875rem", pointerEvents: "none",
                }}>
                  {t(mode === "place" ? "lens.upload.tap.place" : mode === "signage" ? "lens.upload.tap.signage" : "lens.upload.tap")}
                </span>
                <p style={{ fontSize: "0.75rem", color: "var(--sf-text-muted)", marginTop: 12 }}>
                  {t("lens.upload.hint")}
                </p>
              </div>
            </div>

            <input
              ref={fileRef} type="file" accept="image/*"
              style={{ display: "none" }}
              onChange={e => { const f = e.target.files?.[0]; if (f) handleFile(f); e.target.value = ""; }}
            />

            {userAllergens.length === 0 && (
              <p style={{ fontSize: "0.8125rem", color: "var(--sf-text-muted)", textAlign: "center", marginTop: 16, lineHeight: 1.6 }}>
                {t("lens.no_profile")}
              </p>
            )}

            {/* Demo menu buttons — Menu mode only. These use curated, hand-picked
                data (no vision-agent call), so they stay instant and don't touch
                the per-user quota. Place/Signage never had a demo path — every
                scan there used to be fake data pretending to be real, which is
                why those two modes go straight to the real agent now. */}
            {mode === "menu" && (
              <div style={{ marginTop: 28 }}>
                <p style={{ fontSize: "0.75rem", fontWeight: 700, color: "var(--sf-text-muted)", letterSpacing: "0.06em", textTransform: "uppercase", marginBottom: 12, textAlign: "center" }}>
                  {t("lens.demo_hint")}
                </p>
                <div style={{ display: "flex", gap: 8, justifyContent: "center", flexWrap: "wrap" }}>
                  {DEMO_MENUS.map(m => (
                    <button key={m.key} className="sf-demo-btn" onClick={() => tryDemo(m.key)}>
                      <ScanLine size={13} style={{ display: "inline", marginInlineEnd: 5 }} aria-hidden />
                      {m.label}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </>
        )}

        {/* ── Scanning phase ── */}
        {phase === "scanning" && (
          <div style={{ borderRadius: 16, overflow: "hidden", border: "1px solid var(--sf-border)", position: "relative" }}>
            {imageUrl && (
              <img src={imageUrl} alt="" style={{ width: "100%", display: "block", maxHeight: 420, objectFit: "cover" }} />
            )}
            <div style={{ position: "absolute", inset: 0, background: "rgba(0,0,0,0.35)", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 16 }}>
              <div className="sf-scan-sweep" />
              <p style={{ color: "#fff", fontWeight: 700, fontSize: "1.0625rem", textShadow: "0 2px 8px rgba(0,0,0,0.5)" }}>
                {t(mode === "place" ? "lens.scanning.place" : mode === "signage" ? "lens.scanning.signage" : "lens.scanning.menu")}
              </p>
            </div>
          </div>
        )}

        {/* ── Results phase ── */}
        {phase === "results" && (
          <>
            {scanError ? (
              <ErrorCard error={scanError} t={t} onRetry={retryLastAction} />
            ) : (
              <>
                {mode === "menu" && (
                  <>
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 20, flexWrap: "wrap", gap: 10 }}>
                      <div>
                        <h2 style={{ fontSize: "1.0625rem", fontWeight: 800, color: "var(--sf-text)", marginBottom: 2 }}>
                          {t("lens.results.title")}
                        </h2>
                        <p style={{ fontSize: "0.8125rem", color: "var(--sf-text-muted)" }}>
                          {t("lens.results.count").replace("{n}", String(displayDishes.length))}
                        </p>
                      </div>
                      <button
                        onClick={reset}
                        style={{
                          display: "flex", alignItems: "center", gap: 6,
                          padding: "9px 16px", borderRadius: 999, minHeight: 40,
                          border: "1px solid var(--sf-border)", background: "var(--sf-surface)",
                          color: "var(--sf-text-muted)", fontSize: "0.8125rem", fontWeight: 600, cursor: "pointer",
                        }}
                      >
                        <RotateCcw size={13} aria-hidden /> {t("lens.rescan")}
                      </button>
                    </div>
                    <div style={{ display: "flex", flexDirection: "column", gap: 10, marginBottom: 16 }}>
                      {displayDishes.map(d => (
                        <DishCard key={d.key} dish={d} userAllergens={userAllergens}
                          t={t} onClick={() => setSelected(d)} />
                      ))}
                    </div>
                    <p style={{ fontSize: "0.75rem", color: "var(--sf-text-muted)", textAlign: "center", lineHeight: 1.6 }}>
                      ⚠ {t("lens.results.disclaimer")}
                    </p>
                  </>
                )}

                {mode === "place" && displayPlace && (
                  <PlaceCard result={displayPlace} t={t} onReset={reset} />
                )}

                {mode === "signage" && displaySign && (
                  <SignResults result={displaySign} t={t} onReset={reset} />
                )}
              </>
            )}
          </>
        )}
      </div>

      {/* ── Modal ── */}
      {selected && (
        <DishModal
          dish={selected} userAllergens={userAllergens}
          isFav={!!selected.favoriteId && favorites.includes(selected.favoriteId)}
          t={t}
          onClose={() => setSelected(null)}
          onAddFav={() => { if (selected.favoriteId) addFavorite(selected.favoriteId); }}
        />
      )}
    </div>
  );
}
