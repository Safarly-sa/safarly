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
import poisRaw from "@/data/pois.json";
import { poiName as poiI18nName } from "@/lib/poi-i18n";
import {
  DEFAULT_COLLECTION_ID,
  getFavoritesState,
  createCollection,
  renameCollection,
  deleteCollection,
  setNote,
  moveToCollection,
  removeItem,
  type FavoriteCollection,
  type FavoriteItem,
} from "@/lib/favorites";

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

/* ── Learned phrases / favourites data ─────────────────────────────────
   `safarly_learned` and the favourites store (lib/favorites.ts) were never
   trip-scoped, so they already persist across trips, and (like the rest of
   the profile) also survive sign-out — see lib/auth.ts's signOut(). */
interface Phrase { id: string; dialect: string; situation: string; arabic: string; transliteration: string; english: string; }
interface Dish { id: string; name: string; name_ar: string; price_sar: number; description: string; common_allergens: string[]; meal_type: string; }
interface POI { id: string; name: string; city: string; category: string; culture_note?: string }

const ALL_PHRASES = phrasesRaw as Phrase[];
const ALL_DISHES  = dishesRaw  as Dish[];
const ALL_POIS    = poisRaw    as POI[];
const PHRASES_MAP = Object.fromEntries(ALL_PHRASES.map(p => [p.id, p]));
const DISHES_MAP  = Object.fromEntries(ALL_DISHES.map(d => [d.id, d]));
const POIS_MAP    = Object.fromEntries(ALL_POIS.map(p => [p.id, p]));

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
  const [collections, setCollections] = useState<FavoriteCollection[]>([]);
  const [favItems, setFavItems] = useState<FavoriteItem[]>([]);
  const [newCollectionName, setNewCollectionName] = useState("");
  const [editingNoteId, setEditingNoteId] = useState<string | null>(null);

  /* Redirect to login if not authenticated */
  useEffect(() => {
    if (!getAuth()) navigate("/login");
  }, [navigate]);

  function reloadFavorites() {
    const state = getFavoritesState();
    setCollections(state.collections);
    setFavItems(state.items);
  }

  useEffect(() => {
    try { setLearnedIds(JSON.parse(localStorage.getItem("safarly_learned") ?? "[]")); } catch { /* */ }
    reloadFavorites();
  }, []);

  const learnedByDialect = useMemo(() => (
    DIALECT_ORDER
      .map(d => ({
        dialect: d,
        phrases: learnedIds.map(id => PHRASES_MAP[id]).filter((p): p is Phrase => !!p && p.dialect === d),
      }))
      .filter(g => g.phrases.length > 0)
  ), [learnedIds]);

  /** Items grouped by collection, each resolved to a dish or POI for display; unresolvable ids (deleted from the dataset) are dropped. */
  const favByCollection = useMemo(() => {
    return collections.map(collection => ({
      collection,
      items: favItems
        .filter(i => i.collectionId === collection.id)
        .map(item => {
          const ref = item.refType === "dish" ? DISHES_MAP[item.refId] : POIS_MAP[item.refId];
          return ref ? { item, ref } : null;
        })
        .filter((x): x is { item: FavoriteItem; ref: Dish | POI } => !!x),
    }));
  }, [collections, favItems]);

  const totalFavCount = favItems.length;

  function handleRemoveFavItem(itemId: string) {
    removeItem(itemId);
    reloadFavorites();
  }

  function handleCreateCollection() {
    if (!newCollectionName.trim()) return;
    createCollection(newCollectionName);
    setNewCollectionName("");
    reloadFavorites();
  }

  function handleDeleteCollection(collectionId: string) {
    deleteCollection(collectionId);
    reloadFavorites();
  }

  function handleMoveItem(itemId: string, collectionId: string) {
    moveToCollection(itemId, collectionId);
    reloadFavorites();
  }

  function handleSaveNote(itemId: string, note: string) {
    setNote(itemId, note);
    setEditingNoteId(null);
    reloadFavorites();
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

        {/* ── Favourites ── */}
        <section className="sf-profile-section" aria-labelledby="section-favorites">
          <h2 id="section-favorites" className="sf-profile-section-title">{t("profile.favorites.title")}</h2>

          {totalFavCount === 0 ? (
            <div style={{ textAlign: "center", padding: "6px 4px 4px" }}>
              <p style={{ color: "var(--sf-text-muted)", fontSize: "0.9375rem", lineHeight: 1.6 }}>
                {t("profile.favorites.empty")}
              </p>
              <Link href="/lens" className="sf-profile-empty-link">
                {t("nav.lens")} <ArrowRight size={14} aria-hidden />
              </Link>
            </div>
          ) : (
            favByCollection.map(({ collection, items }) => {
              if (items.length === 0 && collection.id !== DEFAULT_COLLECTION_ID) return null;
              const isDefault = collection.id === DEFAULT_COLLECTION_ID;
              return (
                <div key={collection.id} style={{ marginBottom: 22 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
                    <p className="sf-profile-group-title">
                      {isDefault ? t("profile.favorites.default_collection") : collection.name} ({items.length})
                    </p>
                    {!isDefault && (
                      <button
                        type="button"
                        onClick={() => handleDeleteCollection(collection.id)}
                        aria-label={t("profile.favorites.delete_collection")}
                        style={{ background: "none", border: "none", cursor: "pointer", color: "var(--sf-text-muted)", fontSize: "0.75rem", fontWeight: 600 }}
                      >
                        {t("profile.favorites.delete_collection")}
                      </button>
                    )}
                  </div>

                  {items.length === 0 ? (
                    <p style={{ fontSize: "0.8125rem", color: "var(--sf-text-muted)" }}>{t("profile.favorites.collection_empty")}</p>
                  ) : items.map(({ item, ref }) => {
                    const dish = item.refType === "dish" ? (ref as Dish) : null;
                    const poi  = item.refType === "poi"  ? (ref as POI)  : null;
                    return (
                      <div key={item.id} className="sf-fav-row" style={{ flexDirection: "column", alignItems: "stretch", gap: 6 }}>
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 8, width: "100%" }}>
                          <div style={{ flex: 1, minWidth: 0 }}>
                            {dish ? (
                              <div style={{ display: "flex", alignItems: "baseline", gap: 8, flexWrap: "wrap" }}>
                                <span style={{ fontSize: "1rem", fontWeight: 700, color: "var(--sf-text)", direction: "rtl" }}>{dish.name_ar}</span>
                                <span style={{ fontSize: "0.8125rem", color: "var(--sf-text-muted)" }}>{dish.name}</span>
                              </div>
                            ) : poi ? (
                              <span style={{ fontSize: "1rem", fontWeight: 700, color: "var(--sf-text)" }}>{poiI18nName(t, poi)}</span>
                            ) : null}
                            <div style={{ fontSize: "0.75rem", color: "var(--sf-text-muted)", marginTop: 2 }}>
                              {dish ? `SAR ${dish.price_sar}` : poi?.city}
                            </div>
                          </div>
                          <div style={{ display: "flex", alignItems: "center", gap: 6, flexShrink: 0 }}>
                            {collections.length > 1 && (
                              <select
                                value={item.collectionId}
                                onChange={e => handleMoveItem(item.id, e.target.value)}
                                aria-label={t("profile.favorites.move_to")}
                                style={{ fontSize: "0.75rem", padding: "4px 6px", borderRadius: 6, border: "1px solid var(--sf-border)", background: "var(--sf-surface)", color: "var(--sf-text)" }}
                              >
                                {collections.map(c => (
                                  <option key={c.id} value={c.id}>
                                    {c.id === DEFAULT_COLLECTION_ID ? t("profile.favorites.default_collection") : c.name}
                                  </option>
                                ))}
                              </select>
                            )}
                            <button
                              onClick={() => handleRemoveFavItem(item.id)}
                              style={{ flexShrink: 0, width: 36, height: 36, borderRadius: "50%", border: "1px solid var(--sf-border)", background: "var(--sf-surface-alt)", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}
                              aria-label={t("dash.food.remove")}
                            >
                              <X size={14} style={{ color: "var(--sf-text-muted)" }} aria-hidden />
                            </button>
                          </div>
                        </div>

                        {editingNoteId === item.id ? (
                          <input
                            autoFocus
                            defaultValue={item.note}
                            onBlur={e => handleSaveNote(item.id, e.target.value)}
                            onKeyDown={e => { if (e.key === "Enter") (e.target as HTMLInputElement).blur(); }}
                            placeholder={t("profile.favorites.note_placeholder")}
                            style={{ fontSize: "0.8125rem", padding: "6px 8px", borderRadius: 6, border: "1px solid var(--sf-border)", background: "var(--sf-surface)", color: "var(--sf-text)", width: "100%" }}
                          />
                        ) : (
                          <button
                            type="button"
                            onClick={() => setEditingNoteId(item.id)}
                            style={{ textAlign: "start", background: "none", border: "none", cursor: "pointer", fontSize: "0.75rem", color: item.note ? "var(--sf-text)" : "var(--sf-text-muted)", padding: 0, fontStyle: item.note ? "normal" : "italic" }}
                          >
                            {item.note || t("profile.favorites.note_placeholder")}
                          </button>
                        )}
                      </div>
                    );
                  })}
                </div>
              );
            })
          )}

          {totalFavCount > 0 && (
            <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
              <input
                value={newCollectionName}
                onChange={e => setNewCollectionName(e.target.value)}
                onKeyDown={e => { if (e.key === "Enter") handleCreateCollection(); }}
                placeholder={t("profile.favorites.new_collection_placeholder")}
                style={{ flex: 1, fontSize: "0.875rem", padding: "8px 10px", borderRadius: 8, border: "1px solid var(--sf-border)", background: "var(--sf-surface)", color: "var(--sf-text)" }}
              />
              <button
                type="button"
                onClick={handleCreateCollection}
                disabled={!newCollectionName.trim()}
                style={{ padding: "8px 16px", borderRadius: 8, border: "1px solid var(--sf-indigo)", background: "var(--sf-surface)", color: "var(--sf-indigo)", fontWeight: 700, fontSize: "0.875rem", cursor: newCollectionName.trim() ? "pointer" : "default", opacity: newCollectionName.trim() ? 1 : 0.5 }}
              >
                {t("profile.favorites.create")}
              </button>
            </div>
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
