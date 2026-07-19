import { useEffect, useRef, useState } from "react";
import { useLocation } from "wouter";
import { Link } from "wouter";
import { useTranslation } from "@/providers/translation-context";
import { useTheme } from "@/providers/ThemeProvider";
import { getAuth } from "@/lib/auth";
import safarlyLogo from "@assets/safarly-lockup-light_1784459757614.png";
import { Sun, Moon, UserCircle, LogIn, Globe, ChevronDown } from "lucide-react";
import clsx from "clsx";
import type { Language } from "@/providers/translation-context";

const LANGS: { code: Language; label: string; flag: string }[] = [
  { code: "en", label: "English",   flag: "🇬🇧" },
  { code: "ar", label: "العربية",   flag: "🇸🇦" },
  { code: "de", label: "Deutsch",   flag: "🇩🇪" },
  { code: "it", label: "Italiano",  flag: "🇮🇹" },
  { code: "fr", label: "Français",  flag: "🇫🇷" },
  { code: "ur", label: "اردو",      flag: "🇵🇰" },
  { code: "zh", label: "中文",      flag: "🇨🇳" },
  { code: "ru", label: "Русский",   flag: "🇷🇺" },
];

export function Navbar() {
  const { t, language, setLanguage } = useTranslation();
  const { theme, toggleTheme } = useTheme();
  const [location] = useLocation();

  /* Auth-aware — re-reads whenever safarly-auth-changed fires */
  const [authed, setAuthed] = useState(() => !!getAuth());
  useEffect(() => {
    function sync() { setAuthed(!!getAuth()); }
    window.addEventListener("safarly-auth-changed", sync);
    window.addEventListener("storage", sync);
    return () => {
      window.removeEventListener("safarly-auth-changed", sync);
      window.removeEventListener("storage", sync);
    };
  }, []);

  /* Language dropdown */
  const [langOpen, setLangOpen] = useState(false);
  const langRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!langOpen) return;
    function close(e: MouseEvent) {
      if (langRef.current && !langRef.current.contains(e.target as Node)) setLangOpen(false);
    }
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, [langOpen]);

  const currentLang = LANGS.find(l => l.code === language) ?? LANGS[0];

  const navLinks = [
    { href: "/",         label: t("nav.plan")      },
    { href: "/lens",     label: t("nav.lens")      },
    { href: "/dialect",  label: t("nav.dialect")   },
    { href: "/dashboard",label: t("nav.dashboard") },
  ];

  const controlBtn: React.CSSProperties = {
    display: "flex", alignItems: "center", justifyContent: "center",
    borderRadius: "10px", border: "1px solid #232C3D",
    padding: "6px 10px", color: "#8A93A6",
    background: "transparent", cursor: "pointer",
    transition: "color .2s, border-color .2s, background .2s",
    fontSize: "0.875rem", fontWeight: 600,
    gap: "6px",
  };

  return (
    <header
      className="fixed top-0 start-0 end-0 z-50 backdrop-blur-xl"
      style={{ height: "68px", backgroundColor: "rgba(10, 14, 22, 0.92)", borderBottom: "1px solid #232C3D" }}
    >
      <div className="max-w-7xl mx-auto px-6 lg:px-8 h-full flex items-center justify-between">

        {/* Brand */}
        <Link href="/" className="flex items-center shrink-0 group" aria-label="Safarly — Home">
          <img src={safarlyLogo} alt="Safarly" style={{ height: "40px", width: "auto", objectFit: "contain" }} />
        </Link>

        {/* Nav links */}
        <nav className="hidden md:flex items-center gap-8">
          {navLinks.map((link) => {
            const isActive = location === link.href;
            return (
              <Link
                key={link.href}
                href={link.href}
                className={clsx(
                  "text-sm font-medium transition-colors duration-200 whitespace-nowrap rounded-sm",
                  isActive ? "border-b-2 pb-px" : "hover:text-white"
                )}
                style={isActive ? { color: "#5C6CFF", borderColor: "#5C6CFF" } : { color: "#8A93A6" }}
              >
                {link.label}
              </Link>
            );
          })}
        </nav>

        {/* Controls */}
        <div className="flex items-center gap-2 shrink-0">

          {/* Theme toggle */}
          <button
            onClick={toggleTheme}
            className="p-2 rounded-full transition-colors duration-200"
            style={{ color: "#8A93A6" }}
            onMouseEnter={(e) => { e.currentTarget.style.color = "#EDEFF3"; e.currentTarget.style.backgroundColor = "#1A2233"; }}
            onMouseLeave={(e) => { e.currentTarget.style.color = "#8A93A6"; e.currentTarget.style.backgroundColor = "transparent"; }}
            aria-label={t("nav.toggle_theme")}
          >
            {theme === "dark" ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
          </button>

          {/* Language dropdown */}
          <div ref={langRef} style={{ position: "relative" }}>
            <button
              onClick={() => setLangOpen(o => !o)}
              style={{ ...controlBtn, gap: 5 }}
              onMouseEnter={(e) => { e.currentTarget.style.color = "#EDEFF3"; e.currentTarget.style.borderColor = "#5C6CFF"; }}
              onMouseLeave={(e) => { e.currentTarget.style.color = "#8A93A6"; e.currentTarget.style.borderColor = "#232C3D"; }}
              aria-label="Select language"
              aria-expanded={langOpen}
            >
              <Globe size={13} aria-hidden />
              <span style={{ maxWidth: 52, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                {currentLang.label}
              </span>
              <ChevronDown size={11} aria-hidden style={{ opacity: 0.6, transition: "transform .15s", transform: langOpen ? "rotate(180deg)" : "none" }} />
            </button>

            {langOpen && (
              <div style={{
                position: "absolute",
                top: "calc(100% + 8px)",
                insetInlineEnd: 0,
                zIndex: 200,
                background: "#111827",
                border: "1px solid #232C3D",
                borderRadius: 12,
                minWidth: 162,
                overflow: "hidden",
                boxShadow: "0 8px 32px rgba(0,0,0,0.45)",
              }}>
                {LANGS.map(l => (
                  <button
                    key={l.code}
                    onClick={() => { setLanguage(l.code); setLangOpen(false); }}
                    style={{
                      display: "flex", alignItems: "center", gap: 10,
                      width: "100%", padding: "10px 14px",
                      background: language === l.code ? "#1A2233" : "transparent",
                      color: language === l.code ? "#EDEFF3" : "#8A93A6",
                      fontSize: "0.875rem",
                      fontWeight: language === l.code ? 700 : 500,
                      cursor: "pointer", border: "none",
                      textAlign: "start",
                      transition: "background .12s, color .12s",
                    }}
                    onMouseEnter={(e) => { if (language !== l.code) e.currentTarget.style.background = "#1A2233"; e.currentTarget.style.color = "#EDEFF3"; }}
                    onMouseLeave={(e) => { if (language !== l.code) { e.currentTarget.style.background = "transparent"; e.currentTarget.style.color = "#8A93A6"; } }}
                  >
                    <span style={{ fontSize: "1.125rem", lineHeight: 1 }}>{l.flag}</span>
                    <span>{l.label}</span>
                    {language === l.code && <span style={{ marginInlineStart: "auto", color: "#5C6CFF", fontSize: "0.75rem" }}>✓</span>}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Auth button */}
          {authed ? (
            <Link
              href="/profile"
              style={{ ...controlBtn, textDecoration: "none" }}
              aria-label="My profile"
              onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.color = "#EDEFF3"; (e.currentTarget as HTMLElement).style.borderColor = "#5C6CFF"; }}
              onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.color = "#8A93A6"; (e.currentTarget as HTMLElement).style.borderColor = "#232C3D"; }}
            >
              <UserCircle size={18} aria-hidden />
              <span className="hidden sm:inline">Profile</span>
            </Link>
          ) : (
            <Link
              href="/login"
              style={{ ...controlBtn, textDecoration: "none" }}
              aria-label="Sign in"
              onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.color = "#EDEFF3"; (e.currentTarget as HTMLElement).style.borderColor = "#5C6CFF"; }}
              onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.color = "#8A93A6"; (e.currentTarget as HTMLElement).style.borderColor = "#232C3D"; }}
            >
              <LogIn size={16} aria-hidden />
              <span className="hidden sm:inline">Sign In</span>
            </Link>
          )}

        </div>
      </div>
    </header>
  );
}
