import { useCallback, useEffect, useRef, useState } from "react";
import { Camera, CheckCircle2, AlertTriangle, X, Plus, ScanLine, RotateCcw, ChevronRight } from "lucide-react";
import { useTranslation } from "@/providers/translation-context";
import { usePageMeta } from "@/lib/usePageMeta";
import dishesRaw from "@/data/dishes.json";

/* ── Types ──────────────────────────────────────────────────────────── */
interface Dish {
  id: string; name: string; name_ar: string;
  meal_type: string; price_sar: number;
  common_allergens: string[]; food_weight: number; description: string;
}

/* ── Static data ────────────────────────────────────────────────────── */
const ALL_DISHES = dishesRaw as Dish[];
const DISHES_BY_ID = Object.fromEntries(ALL_DISHES.map(d => [d.id, d]));

// filename-substring → dish ID list (swap scanMenu() body for real vision API)
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

const ALLERGEN_KEYS: Record<string, string> = {
  nuts: "ob.allergy.nuts", dairy: "ob.allergy.dairy",
  gluten: "ob.allergy.gluten", sesame: "ob.allergy.sesame",
  eggs: "ob.allergy.eggs", shellfish: "ob.allergy.shellfish",
};

/* ── Scan function — swap body to call real vision API in Phase 3 ──── */
function scanMenu(filename: string): Dish[] {
  const lower = filename.toLowerCase();
  const key   = Object.keys(DEMO_LOOKUP).find(k => lower.includes(k));
  if (key) return DEMO_LOOKUP[key].map(id => DISHES_BY_ID[id]).filter(Boolean) as Dish[];
  // Fallback: 6 random dishes (menu not recognized)
  return [...ALL_DISHES].sort(() => Math.random() - 0.5).slice(0, 6);
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
        animation: sf-sweep 2.0s ease-in-out forwards;
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

/* ── Dish card ──────────────────────────────────────────────────────── */
function DishCard({ dish, userAllergens, t, language, onClick }: {
  dish: Dish; userAllergens: string[]; t: (k: string) => string;
  language: string; onClick: () => void;
}) {
  const warnings = dish.common_allergens.filter(a => userAllergens.includes(a));
  return (
    <div className="sf-dish-card" onClick={onClick} role="button" tabIndex={0}
      onKeyDown={e => e.key === "Enter" && onClick()}
      aria-label={`${dish.name} — ${t("lens.modal.details")}`}
    >
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 8, marginBottom: 6 }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: "1.25rem", fontWeight: 700, color: "var(--sf-text)", lineHeight: 1.2, direction: "rtl", textAlign: "end" }}>
            {dish.name_ar}
          </div>
          <div style={{ fontSize: "0.875rem", fontWeight: 600, color: "var(--sf-text-muted)", marginTop: 3 }}>
            {language === "ar" ? dish.name : dish.name}
          </div>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 4, flexShrink: 0 }}>
          <span style={{ fontSize: "0.9375rem", fontWeight: 800, color: "var(--sf-text)" }}>
            {t("itin.summary.sar")} {dish.price_sar}
          </span>
          <ChevronRight size={14} style={{ color: "var(--sf-text-muted)" }} aria-hidden />
        </div>
      </div>

      <p style={{ fontSize: "0.8125rem", color: "var(--sf-text-muted)", lineHeight: 1.55, marginBottom: warnings.length ? 10 : 0 }}>
        {dish.description}
      </p>

      {warnings.length > 0 && (
        <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginTop: 8 }}>
          {warnings.map(a => <AllergenChip key={a} allergen={a} t={t} />)}
        </div>
      )}
    </div>
  );
}

/* ── Dish modal ─────────────────────────────────────────────────────── */
function DishModal({ dish, userAllergens, isFav, t, language, onClose, onAddFav }: {
  dish: Dish; userAllergens: string[]; isFav: boolean;
  t: (k: string) => string; language: string;
  onClose: () => void; onAddFav: () => void;
}) {
  const warnings = dish.common_allergens.filter(a => userAllergens.includes(a));
  const origin   = ORIGIN_STORIES[dish.id] ?? "";

  return (
    <div className="sf-modal-backdrop" onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="sf-modal-card">
        {/* close */}
        <button onClick={onClose} style={{
          position: "absolute", top: 16, insetInlineEnd: 16,
          background: "var(--sf-surface-alt)", border: "none", borderRadius: "50%",
          width: 36, height: 36, display: "flex", alignItems: "center",
          justifyContent: "center", cursor: "pointer",
        }} aria-label={t("lens.modal.close")}>
          <X size={16} style={{ color: "var(--sf-text-muted)" }} />
        </button>

        {/* Arabic name */}
        <div style={{ fontSize: "2rem", fontWeight: 800, color: "var(--sf-text)", direction: "rtl", textAlign: "end", marginBottom: 4, paddingInlineEnd: 40 }}>
          {dish.name_ar}
        </div>
        <div style={{ fontSize: "1rem", color: "var(--sf-text-muted)", fontWeight: 600, marginBottom: 16 }}>
          {dish.name}
        </div>

        {/* Price chip */}
        <div style={{ marginBottom: 20 }}>
          <span style={{
            display: "inline-block", padding: "4px 12px", borderRadius: 999,
            background: "color-mix(in srgb, var(--sf-accent) 12%, var(--sf-surface))",
            color: "var(--sf-text-accent)", fontWeight: 800, fontSize: "0.9375rem",
          }}>
            {t("itin.summary.sar")} {dish.price_sar}
          </span>
        </div>

        {/* Description */}
        <p style={{ fontSize: "0.9375rem", color: "var(--sf-text)", lineHeight: 1.7, marginBottom: 20 }}>
          {dish.description}
        </p>

        {/* Origin story */}
        {origin && (
          <div style={{ marginBottom: 20 }}>
            <h3 style={{ fontSize: "0.75rem", fontWeight: 700, color: "var(--sf-text-muted)", letterSpacing: "0.06em", textTransform: "uppercase", marginBottom: 8 }}>
              {t("lens.modal.origin")}
            </h3>
            <p style={{ fontSize: "0.875rem", color: "var(--sf-text-muted)", lineHeight: 1.7 }}>
              {origin}
            </p>
          </div>
        )}

        {/* Allergens */}
        <div style={{ marginBottom: 24 }}>
          <h3 style={{ fontSize: "0.75rem", fontWeight: 700, color: "var(--sf-text-muted)", letterSpacing: "0.06em", textTransform: "uppercase", marginBottom: 8 }}>
            {t("lens.modal.allergens")}
          </h3>
          {dish.common_allergens.length === 0 ? (
            <span style={{ fontSize: "0.875rem", color: "var(--sf-success)", fontWeight: 600 }}>
              {t("lens.modal.none")}
            </span>
          ) : (
            <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
              {dish.common_allergens.map(a => (
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

        {/* Add button */}
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
      </div>
    </div>
  );
}

/* ── Main Lens page ─────────────────────────────────────────────────── */
type Phase = "upload" | "scanning" | "results";

export function Lens() {
  const { t, language } = useTranslation();
  usePageMeta("Live Lens", "Scan restaurant menus and spot allergens instantly with AI.");
  useLensStyles();

  const [phase,       setPhase]       = useState<Phase>("upload");
  const [imageUrl,    setImageUrl]    = useState<string | null>(null);
  const [scanFilename,setScanFilename]= useState("");
  const [dishes,      setDishes]      = useState<Dish[]>([]);
  const [selected,    setSelected]    = useState<Dish | null>(null);
  const [favorites,   setFavorites]   = useState<string[]>(() => {
    try { return JSON.parse(localStorage.getItem("safarly_favorites") ?? "[]"); } catch { return []; }
  });
  const [userAllergens, setAllergens] = useState<string[]>([]);
  const [isDragging,  setIsDragging]  = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const objectUrlRef = useRef<string | null>(null);

  useEffect(() => {
    try {
      const p = JSON.parse(localStorage.getItem("safarly_profile") ?? "{}");
      setAllergens(Array.isArray(p.allergies) ? p.allergies : []);
    } catch { /* no profile */ }
    return () => { if (objectUrlRef.current) URL.revokeObjectURL(objectUrlRef.current); };
  }, []);

  function startScan(filename: string, imgUrl: string) {
    setScanFilename(filename);
    setImageUrl(imgUrl);
    setPhase("scanning");
    setTimeout(() => {
      setDishes(scanMenu(filename));
      setPhase("results");
    }, 2200);
  }

  function handleFile(file: File) {
    if (objectUrlRef.current) URL.revokeObjectURL(objectUrlRef.current);
    const url = URL.createObjectURL(file);
    objectUrlRef.current = url;
    startScan(file.name, url);
  }

  async function tryDemo(key: string) {
    const base = import.meta.env.BASE_URL.replace(/\/$/, "");
    startScan(`${key}.svg`, `${base}/demo-menus/${key}.svg`);
  }

  function addFavorite(dishId: string) {
    const next = [...new Set([...favorites, dishId])];
    setFavorites(next);
    localStorage.setItem("safarly_favorites", JSON.stringify(next));
  }

  function reset() {
    setPhase("upload");
    setImageUrl(null);
    setDishes([]);
    setSelected(null);
    if (objectUrlRef.current) { URL.revokeObjectURL(objectUrlRef.current); objectUrlRef.current = null; }
  }

  /* ── Render ── */
  return (
    <div style={{ paddingTop: 68, paddingBottom: 88, background: "var(--sf-bg)", minHeight: "100dvh" }}>
      {/* Header */}
      <div style={{ borderBottom: "1px solid var(--sf-border)", padding: "20px 20px 16px" }}>
        <div style={{ maxWidth: 680, margin: "0 auto" }}>
          <h1 style={{ fontSize: "clamp(1.25rem,4vw,1.625rem)", fontWeight: 800, color: "var(--sf-text)", letterSpacing: "-0.02em", marginBottom: 4 }}>
            {t("page.lens.title")}
          </h1>
          <p style={{ color: "var(--sf-text-muted)", fontSize: "0.875rem" }}>{t("lens.subtitle")}</p>
        </div>
      </div>

      <div style={{ maxWidth: 680, margin: "0 auto", padding: "24px 16px" }}>

        {/* ── Upload phase ── */}
        {phase === "upload" && (
          <>
            {/* Drag-drop zone */}
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
                  {isDragging ? t("lens.drag_here") : t("lens.upload.title")}
                </p>
                <p style={{ fontSize: "0.875rem", color: "var(--sf-text-muted)", marginBottom: 16 }}>
                  {t("lens.upload.desc")}
                </p>
                <span style={{
                  display: "inline-block", padding: "10px 22px", borderRadius: 999,
                  background: "var(--sf-accent)", color: "#0A0E16",
                  fontWeight: 700, fontSize: "0.875rem", pointerEvents: "none",
                }}>
                  {t("lens.upload.tap")}
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

            {/* No-profile notice */}
            {userAllergens.length === 0 && (
              <p style={{ fontSize: "0.8125rem", color: "var(--sf-text-muted)", textAlign: "center", marginTop: 16, lineHeight: 1.6 }}>
                {t("lens.no_profile")}
              </p>
            )}

            {/* Demo menu buttons */}
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
          </>
        )}

        {/* ── Scanning phase ── */}
        {phase === "scanning" && imageUrl && (
          <div style={{ borderRadius: 16, overflow: "hidden", border: "1px solid var(--sf-border)", position: "relative" }}>
            <img src={imageUrl} alt="menu" style={{ width: "100%", display: "block", maxHeight: 420, objectFit: "cover" }} />
            <div style={{ position: "absolute", inset: 0, background: "rgba(0,0,0,0.35)", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 16 }}>
              <div className="sf-scan-sweep" />
              <p style={{ color: "#fff", fontWeight: 700, fontSize: "1.0625rem", textShadow: "0 2px 8px rgba(0,0,0,0.5)" }}>
                {t("lens.scanning")}
              </p>
            </div>
          </div>
        )}

        {/* ── Results phase ── */}
        {phase === "results" && (
          <>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 20, flexWrap: "wrap", gap: 10 }}>
              <div>
                <h2 style={{ fontSize: "1.0625rem", fontWeight: 800, color: "var(--sf-text)", marginBottom: 2 }}>
                  {t("lens.results.title")}
                </h2>
                <p style={{ fontSize: "0.8125rem", color: "var(--sf-text-muted)" }}>
                  {t("lens.results.count").replace("{n}", String(dishes.length))}
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
              {dishes.map(d => (
                <DishCard key={d.id} dish={d} userAllergens={userAllergens}
                  t={t} language={language} onClick={() => setSelected(d)} />
              ))}
            </div>

            <p style={{ fontSize: "0.75rem", color: "var(--sf-text-muted)", textAlign: "center", lineHeight: 1.6 }}>
              ⚠ {t("lens.results.disclaimer")}
            </p>
          </>
        )}
      </div>

      {/* ── Modal ── */}
      {selected && (
        <DishModal
          dish={selected} userAllergens={userAllergens}
          isFav={favorites.includes(selected.id)}
          t={t} language={language}
          onClose={() => setSelected(null)}
          onAddFav={() => { addFavorite(selected.id); }}
        />
      )}
    </div>
  );
}
