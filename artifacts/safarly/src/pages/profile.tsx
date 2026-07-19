/**
 * /profile — Flat editable profile form (no wizard step UI).
 * Shows all profile fields in one scrollable page.
 * Saves to safarly_profile on button click.
 */
import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { CheckCircle2, ArrowLeft } from "lucide-react";
import { useTranslation } from "@/providers/translation-context";
import { usePageMeta } from "@/lib/usePageMeta";
import { getAuth, setAuth } from "@/lib/auth";
import {
  Chip,
  NationalityDropdown,
  SectionLabel,
  Toggle,
} from "./profile-setup";

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
    `;
    document.head.appendChild(s);
  }, []);
}

/* ── Helpers ────────────────────────────────────────────────────────── */
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
  interests: string[];
}

function loadProfile(): ProfileData {
  try {
    const raw = localStorage.getItem("safarly_profile");
    if (raw) return { ...emptyProfile(), ...JSON.parse(raw) };
  } catch { /* */ }
  const auth = getAuth();
  return { ...emptyProfile(), name: auth?.name ?? "" };
}

function emptyProfile(): ProfileData {
  return {
    name: "", nationality: "", language: "", ageRange: "",
    dietary: [], allergies: [], accessibility: false, interests: [],
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

  /* Redirect to login if not authenticated */
  useEffect(() => {
    if (!getAuth()) navigate("/login");
  }, [navigate]);

  function patch(p: Partial<ProfileData>) {
    setData((prev) => ({ ...prev, ...p }));
  }

  function handleSave() {
    localStorage.setItem("safarly_profile", JSON.stringify(data));
    /* Keep name in sync with auth */
    const auth = getAuth();
    if (auth && data.name.trim()) setAuth({ ...auth, name: data.name.trim() });
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  }

  const langs = ["العربية", "English", "اردو", "中文", "Русский", "Français"];
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
  const allergyKeys: Record<string, string> = {
    "ob.allergy.nuts": "nuts", "ob.allergy.dairy": "dairy", "ob.allergy.gluten": "gluten",
    "ob.allergy.sesame": "sesame", "ob.allergy.eggs": "eggs", "ob.allergy.shellfish": "shellfish",
  };

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
            onChange={() => patch({ accessibility: !data.accessibility })}
            label={t("ob.accessibility.label")}
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

      </div>
    </div>
  );
}
