/**
 * /profile — Flat editable profile form (no wizard step UI).
 * Shows all profile fields in one scrollable page.
 * Saves to safarly_profile on button click.
 */
import { useState, useEffect, useMemo } from "react";
import { useLocation, Link } from "wouter";
import { CheckCircle2, ArrowLeft, ArrowRight, LogOut, X } from "lucide-react";
import { useTranslation } from "@/providers/translation-context";
import { usePageMeta } from "@/lib/usePageMeta";
import { getAuth, setAuth, signOut } from "@/lib/auth";
import { ALLERGEN_KEY_TO_TOKEN, normaliseAllergens } from "@/lib/allergens";
import { normaliseNationality } from "@/lib/nationalities";
import { SignOutDialog } from "@/components/SignOutDialog";
import { NationalityDropdown } from "@/components/NationalityDropdown";
import {
  Chip,
  SectionLabel,
  Toggle,
  AccessibilityNotesField,
} from "./profile-setup";
import phrasesRaw from "@/data/phrases.json";
import dishesRaw from "@/data/dishes.json";

/* ── Style injection ────────────────────────────────────────────────── */
function useProfileStyles() {
  useEffect(() => {
    const id = "sf-profile-styles";
    if (document.getElementById(id)) return;
    const s = document.createElement("style");
    s.id = id;
    s.textContent = `
      .sf-profile-section {
        background: var(--sf-surface);
        border: 1px solid var(--sf-border);
        border-radius: 14px;
        padding: 20px;
        display: flex;
        flex-direction: column;
        gap: 20px;
      }
      .sf-profile-section-title {
        font-size: 0.6875rem;
        font-weight: 700;
        letter-spacing: 0.07em;
        text-transform: uppercase;
        color: var(--sf-text-muted);
        margin-bottom: 4px;
      }
      .sf-profile-input {
        width: 100%;
        box-sizing: border-box;
        padding: 12px 14px;
        border-radius: 10px;
        border: 1.5px solid var(--sf-border);
        background: var(--sf-surface-alt);
        color: var(--sf-text);
        font-size: 0.9375rem;
        outline: none;
        font-family: inherit;
        transition: border-color .2s;
      }
      .sf-profile-input:focus { border-color: var(--sf-indigo); }
      .sf-saved-flash {
        display: flex; align-items: center; gap: 6px;
        font-size: 0.8125rem; color: var(--sf-success); font-weight: 700;
        animation: sf-fade-in-up 0.3s ease;
      }
      @keyframes sf-fade-in-up {
        from { opacity: 0; transform: translateY(-4px); }
        to   { opacity: 1; transform: none; }
      }
      .sf-phrase-row {
        display: flex; align-items: center; gap: 10px;
        padding: 12px 0; border-bottom: 1px solid var(--sf-border);
      }
      .sf-phrase-row:last-child { border-bottom: none; }
      .sf-fav-row {
        display: flex; align-items: center; gap: 10px;
        padding: 12px 0; border-bottom: 1px solid var(--sf-border);
      }
      .sf-fav-row:last-child { border-bottom: none; }
      .sf-profile-group-title {
        font-size: 0.75rem; font-weight: 700; color: var(--sf-indigo);
        margin: 4px 0 -6px;
      }
      .sf-profile-empty-link {
        display: inline-flex; align-items: center; gap: 6px;
        margin-top: 14px; padding: 9px 16px; border-radius: 999px;
        border: 1px solid var(--sf-indigo); color: var(--sf-indigo);
        background: color-mix(in srgb, var(--sf-indigo) 8%, var(--sf-surface));
        font-weight: 700; font-size: 0.8125rem; text-decoration: none;
        transition: background .15s;
      }
      .sf-profile-empty-link:hover { background: color-mix(in srgb, var(--sf-indigo) 16%, var(--sf-surface)); }
    `;
    document.head.appendChild(s);
  }, []);
}

/* ── Learned phrases / food list data ─────────────────────────────────
   Both `safarly_learned` and `safarly_favorites` are account-scoped keys
   (see ACCOUNT_KEYS in lib/auth.ts) — they were never trip-scoped, so they
   already persist across trips and clear on sign-out with no migration
   needed. */
interface Phrase { id: string; dialect: string; situation: string; arabic: string; transliteration: string; english: string; }
interface Dish { id: string; name: string; name_ar: string; price_sar: number; description: string; common_allergens: string[]; meal_type: string; }

const ALL_PHRASES = phrasesRaw as Phrase[];
const ALL_DISHES  = dishesRaw  as Dish[];
const PHRASES_MAP = Object.fromEntries(ALL_PHRASES.map(p => [p.id, p]));
const DISHES_MAP  = Object.fromEntries(ALL_DISHES.map(d => [d.id, d]));

const DIALECT_ORDER = ["najdi", "hijazi", "janubi", "shamali", "sharqi"] as const;
const DIALECT_NAME_KEY: Record<string, string> = {
  najdi: "dialect.najdi_name", hijazi: "dialect.hijazi_name", janubi: "dialect.janubi_name",
  shamali: "dialect.shamali_name", sharqi: "dialect.sharqi_name",
};

/* ── Helpers ────────────────────────────────────────────────────────── */
/* ── Sign-out confirmation ──────────────────────────────────────────── */
/**
 * Sign-out deletes trips, saved dishes and learned phrases with no server copy,
 * so it is confirmed rather than fired on a single tap. Focus lands on Cancel,
 * so Enter dismisses instead of destroying.
 */
function toggleArr<T>(arr: T[], val: T): T[] {
  return arr.includes(val) ? arr.filter((x) => x !== val) : [...arr, val];
}

interface ProfileData {
  name: string;
  nationality: string;
  language: string;
  ageRange: string;
  dietary: string[];
  allergies: string[];
  accessibility: boolean;
  accessibilityNotes: string;
  interests: string[];
}

function loadProfile(): ProfileData {
  try {
    const raw = localStorage.getItem("safarly_profile");
    if (raw) {
      const parsed = JSON.parse(raw);
      // Normalised on read so a profile saved by the old onboarding wizard
      // (which stored "ob.allergy.*" keys, and a full country name like
      // "Lebanon" instead of an ISO code) is repaired the next time it's saved.
      return {
        ...emptyProfile(),
        ...parsed,
        allergies: normaliseAllergens(parsed?.allergies),
        nationality: normaliseNationality(parsed?.nationality),
      };
    }
  } catch { /* */ }
  const auth = getAuth();
  return { ...emptyProfile(), name: auth?.name ?? "" };
}

function emptyProfile(): ProfileData {
  return {
    name: "", nationality: "", language: "", ageRange: "",
    dietary: [], allergies: [], accessibility: false, accessibilityNotes: "", interests: [],
  };
}

/* ── Profile page ───────────────────────────────────────────────────── */
export function Profile() {
  useProfileStyles();
  usePageMeta("My Profile", "Edit your travel preferences and personal details.");
  const { t } = useTranslation();
  const [, navigate] = useLocation();

  const [data, setData] = useState<ProfileData>(loadProfile);
  const [saved, setSaved] = useState(false);
  const [confirmSignOut, setConfirmSignOut] = useState(false);

  const [learnedIds, setLearnedIds] = useState<string[]>([]);
  const [favorites, setFavorites] = useState<string[]>([]);

  /* Redirect to login if not authenticated */
  useEffect(() => {
    if (!getAuth()) navigate("/login");
  }, [navigate]);

  useEffect(() => {
    try { setLearnedIds(JSON.parse(localStorage.getItem("safarly_learned") ?? "[]")); } catch { /* */ }
    try { setFavorites(JSON.parse(localStorage.getItem("safarly_favorites") ?? "[]")); } catch { /* */ }
  }, []);

  const learnedByDialect = useMemo(() => (
    DIALECT_ORDER
      .map(d => ({
        dialect: d,
        phrases: learnedIds.map(id => PHRASES_MAP[id]).filter((p): p is Phrase => !!p && p.dialect === d),
      }))
      .filter(g => g.phrases.length > 0)
  ), [learnedIds]);

  const favDishes = useMemo(
    () => favorites.map(id => DISHES_MAP[id]).filter(Boolean) as Dish[],
    [favorites]
  );

  function removeFav(id: string) {
    const next = favorites.filter(f => f !== id);
    setFavorites(next);
    localStorage.setItem("safarly_favorites", JSON.stringify(next));
  }

  function handleSignOut() {
    signOut();
    setConfirmSignOut(false);
    navigate("/");
  }

  function patch(p: Partial<ProfileData>) {
    setData((prev) => ({ ...prev, ...p }));
  }

  function toggleAccessibility() {
    setData((prev) => ({
      ...prev,
      accessibility: !prev.accessibility,
      accessibilityNotes: prev.accessibility ? "" : prev.accessibilityNotes,
    }));
  }

  function handleSave() {
    localStorage.setItem("safarly_profile", JSON.stringify(data));
    /* Keep name in sync with auth */
    const auth = getAuth();
    if (auth && data.name.trim()) setAuth({ ...auth, name: data.name.trim() });
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  }

  const langs = ["العربية", "English", "اردو", "中文", "Русский", "Français", "Türkçe", "Español", "Português"];
  const ages  = ["ob.age.18", "ob.age.25", "ob.age.35", "ob.age.45", "ob.age.55"];
  const diets = ["ob.diet.vegetarian", "ob.diet.vegan", "ob.diet.halal", "ob.diet.none"];
  const allergyList = [
    "ob.allergy.nuts", "ob.allergy.dairy", "ob.allergy.gluten",
    "ob.allergy.sesame", "ob.allergy.eggs", "ob.allergy.shellfish",
  ];
  const interestList = [
    { key: "history",     icon: "🏛️" }, { key: "food",        icon: "🍽️" },
    { key: "adventure",   icon: "🧗" }, { key: "shopping",    icon: "🛍️" },
    { key: "arts",        icon: "🎨" }, { key: "nature",      icon: "🌿" },
    { key: "photography", icon: "📸" },
  ];
  const allergyKeys: Record<string, string> = ALLERGEN_KEY_TO_TOKEN;

  return (
    <div style={{
      paddingTop: "68px",
      paddingBottom: "40px",
      background: "var(--sf-bg)",
      minHeight: "100dvh",
    }}>

      {/* Page header */}
      <div style={{
        padding: "20px 20px 16px",
        borderBottom: "1px solid var(--sf-border)",
        background: "var(--sf-bg)",
      }}>
        <div style={{ maxWidth: "620px", margin: "0 auto" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "12px", marginBottom: "6px" }}>
            <button
              type="button"
              onClick={() => navigate("/dashboard")}
              style={{
                display: "flex", alignItems: "center", gap: "6px",
                background: "none", border: "none",
                color: "var(--sf-text-muted)", cursor: "pointer",
                fontSize: "0.875rem", fontWeight: 600, padding: "4px 0",
              }}
              onMouseEnter={e => (e.currentTarget.style.color = "var(--sf-text)")}
              onMouseLeave={e => (e.currentTarget.style.color = "var(--sf-text-muted)")}
            >
              <ArrowLeft size={16} className="rtl:hidden" aria-hidden />
              Dashboard
            </button>
          </div>
          <h1 style={{
            fontSize: "clamp(1.25rem, 4vw, 1.625rem)", fontWeight: 800,
            color: "var(--sf-text)", letterSpacing: "-0.02em",
          }}>
            My Profile
          </h1>
          <p style={{ color: "var(--sf-text-muted)", fontSize: "0.9375rem", marginTop: "4px" }}>
            Update your travel preferences — changes apply to your next trip plan.
          </p>
        </div>
      </div>

      {/* Form */}
      <div style={{ maxWidth: "620px", margin: "0 auto", padding: "24px 20px", display: "flex", flexDirection: "column", gap: "16px" }}>

        {/* ── About you ── */}
        <section className="sf-profile-section" aria-labelledby="section-about">
          <h2 id="section-about" className="sf-profile-section-title">About You</h2>

          <div>
            <SectionLabel label="Display name" />
            <input
              type="text"
              className="sf-profile-input"
              value={data.name}
              onChange={e => patch({ name: e.target.value })}
              placeholder="Your name"
              autoComplete="given-name"
            />
          </div>

          <div>
            <SectionLabel label={t("ob.nationality.label")} />
            <NationalityDropdown
              value={data.nationality}
              onChange={v => patch({ nationality: v })}
              placeholder={t("ob.nationality.placeholder")}
              noneLabel={t("ob.nationality.none")}
            />
          </div>

          <div>
            <SectionLabel label={t("ob.language.label")} />
            <div style={{ display: "flex", flexWrap: "wrap", gap: "8px" }}>
              {langs.map((l) => (
                <Chip
                  key={l} label={l}
                  selected={data.language === l}
                  onClick={() => patch({ language: data.language === l ? "" : l })}
                />
              ))}
            </div>
          </div>

          <div>
            <SectionLabel label={t("ob.age.label")} />
            <div style={{ display: "flex", flexWrap: "wrap", gap: "8px" }}>
              {ages.map((a) => (
                <Chip
                  key={a} label={t(a)}
                  selected={data.ageRange === a}
                  onClick={() => patch({ ageRange: data.ageRange === a ? "" : a })}
                />
              ))}
            </div>
          </div>
        </section>

        {/* ── Food & health ── */}
        <section className="sf-profile-section" aria-labelledby="section-food">
          <h2 id="section-food" className="sf-profile-section-title">Food &amp; Health</h2>

          <div>
            <SectionLabel label={t("ob.diet.label")} />
            <div style={{ display: "flex", flexWrap: "wrap", gap: "8px" }}>
              {diets.map((d) => (
                <Chip
                  key={d} label={t(d)}
                  selected={data.dietary.includes(d)}
                  onClick={() => patch({ dietary: toggleArr(data.dietary, d) })}
                />
              ))}
            </div>
          </div>

          <div>
            <SectionLabel label={t("ob.allergy.label")} />
            <div style={{ display: "flex", flexWrap: "wrap", gap: "8px" }}>
              {allergyList.map((a) => {
                const val = allergyKeys[a] ?? a;
                return (
                  <Chip
                    key={a} label={t(a)}
                    selected={data.allergies.includes(val)}
                    onClick={() => patch({ allergies: toggleArr(data.allergies, val) })}
                  />
                );
              })}
            </div>
          </div>
        </section>

        {/* ── Accessibility ── */}
        <section className="sf-profile-section" aria-labelledby="section-access">
          <h2 id="section-access" className="sf-profile-section-title">Accessibility</h2>
          <Toggle
            checked={data.accessibility}
            onChange={toggleAccessibility}
            label={t("ob.accessibility.label")}
          />
          <AccessibilityNotesField
            show={data.accessibility}
            value={data.accessibilityNotes}
            onChange={v => patch({ accessibilityNotes: v })}
            t={t}
          />
        </section>

        {/* ── Interests ── */}
        <section className="sf-profile-section" aria-labelledby="section-interests">
          <h2 id="section-interests" className="sf-profile-section-title">Interests</h2>
          <div style={{ display: "flex", flexWrap: "wrap", gap: "10px" }}>
            {interestList.map(({ key, icon }) => (
              <Chip
                key={key}
                label={t(`ob.interest.${key}`)}
                icon={icon}
                selected={data.interests.includes(key)}
                onClick={() => patch({ interests: toggleArr(data.interests, key) })}
              />
            ))}
          </div>
        </section>

        {/* ── Save button ── */}
        <div style={{ display: "flex", alignItems: "center", gap: "16px", marginTop: "8px" }}>
          <button
            type="button"
            onClick={handleSave}
            style={{
              minHeight: "52px", flex: 1,
              borderRadius: "10px", border: "none",
              background: "var(--sf-accent)", color: "#0A0E16",
              fontWeight: 700, fontSize: "1rem",
              cursor: "pointer", transition: "background .18s",
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

        {/* ── Learned Phrases ── */}
        <section className="sf-profile-section" aria-labelledby="section-phrases">
          <h2 id="section-phrases" className="sf-profile-section-title">{t("dash.phrases.title")}</h2>
          {learnedByDialect.length === 0 ? (
            <div style={{ textAlign: "center", padding: "6px 4px 4px" }}>
              <p style={{ color: "var(--sf-text-muted)", fontSize: "0.9375rem", lineHeight: 1.6 }}>
                {t("dash.phrases.empty")}
              </p>
              <Link href="/dialect" className="sf-profile-empty-link">
                {t("nav.dialect")} <ArrowRight size={14} aria-hidden />
              </Link>
            </div>
          ) : (
            learnedByDialect.map(({ dialect, phrases }) => (
              <div key={dialect}>
                <p className="sf-profile-group-title">{t(DIALECT_NAME_KEY[dialect])}</p>
                {phrases.map(p => (
                  <div key={p.id} className="sf-phrase-row">
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: "1.0625rem", fontWeight: 700, color: "var(--sf-text)", direction: "rtl", textAlign: "end", lineHeight: 1.3 }}>{p.arabic}</div>
                      <div style={{ fontSize: "0.8125rem", color: "var(--sf-text-muted)", marginTop: 2 }}>{p.transliteration} · {p.english}</div>
                    </div>
                  </div>
                ))}
              </div>
            ))
          )}
        </section>

        {/* ── Food List ── */}
        <section className="sf-profile-section" aria-labelledby="section-food-list">
          <h2 id="section-food-list" className="sf-profile-section-title">{t("dash.food.title")}</h2>
          {favDishes.length === 0 ? (
            <div style={{ textAlign: "center", padding: "6px 4px 4px" }}>
              <p style={{ color: "var(--sf-text-muted)", fontSize: "0.9375rem", lineHeight: 1.6 }}>
                {t("dash.food.empty")}
              </p>
              <Link href="/lens" className="sf-profile-empty-link">
                {t("nav.lens")} <ArrowRight size={14} aria-hidden />
              </Link>
            </div>
          ) : (
            favDishes.map(d => (
              <div key={d.id} className="sf-fav-row">
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: "flex", alignItems: "baseline", gap: 8, flexWrap: "wrap" }}>
                    <span style={{ fontSize: "1rem", fontWeight: 700, color: "var(--sf-text)", direction: "rtl" }}>{d.name_ar}</span>
                    <span style={{ fontSize: "0.8125rem", color: "var(--sf-text-muted)" }}>{d.name}</span>
                  </div>
                  <div style={{ fontSize: "0.75rem", color: "var(--sf-text-muted)", marginTop: 2 }}>SAR {d.price_sar}</div>
                </div>
                <button onClick={() => removeFav(d.id)} style={{ flexShrink: 0, width: 36, height: 36, borderRadius: "50%", border: "1px solid var(--sf-border)", background: "var(--sf-surface-alt)", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }} aria-label={t("dash.food.remove")}>
                  <X size={14} style={{ color: "var(--sf-text-muted)" }} aria-hidden />
                </button>
              </div>
            ))
          )}
        </section>

        {/* ── Sign out ── */}
        <section style={{ marginTop: 34, paddingTop: 22, borderTop: "1px solid var(--sf-border)" }}>
          <h2 className="sf-profile-section-title">{t("profile.account.title")}</h2>
          <p style={{ fontSize: "0.8125rem", lineHeight: 1.6, color: "var(--sf-text-muted)", marginBottom: 14 }}>
            {t("profile.signout.hint")}
          </p>
          <button
            type="button"
            onClick={() => setConfirmSignOut(true)}
            style={{
              display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 8,
              minHeight: 48, padding: "0 22px", borderRadius: 10,
              border: "1px solid #DC2626", background: "transparent",
              color: "#DC2626", fontWeight: 700, fontSize: "0.9375rem", cursor: "pointer",
            }}
          >
            <LogOut size={16} aria-hidden />
            {t("profile.signout.button")}
          </button>
        </section>

      </div>

      {confirmSignOut && (
        <SignOutDialog
          t={t}
          onCancel={() => setConfirmSignOut(false)}
          onConfirm={handleSignOut}
        />
      )}
    </div>
  );
}
