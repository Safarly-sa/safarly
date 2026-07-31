import { useEffect, useRef, useState } from "react";
import { Globe, ChevronDown } from "lucide-react";
import { useTranslation } from "@/providers/translation-context";
import type { Language } from "@/providers/translation-context";

/**
 * LanguagePicker — the language switcher, shared by the Navbar and the Footer.
 *
 * Two variants because the control appears in two very different places:
 *   - `pill`   the header's bordered button (globe + label + chevron)
 *   - `circle` a 40px round button showing just the language code, used in the
 *              footer on phones where the header has no room to spare
 *
 * The circle variant opens upward: it sits at the bottom of the page, so a
 * downward menu would render off-screen.
 *
 * The trigger shows a language CODE rather than a flag. A flag names a country,
 * not a language — Arabic, Spanish and Portuguese are each spoken well beyond
 * the single flag this list has to pick. The open menu still shows flags, since
 * there they sit beside the language's own name and read as decoration rather
 * than as the identifier.
 */

const LANGS: { code: Language; label: string; flag: string }[] = [
  { code: "en", label: "English",   flag: "🇬🇧" },
  { code: "ar", label: "العربية",   flag: "🇸🇦" },
  { code: "de", label: "Deutsch",   flag: "🇩🇪" },
  { code: "it", label: "Italiano",  flag: "🇮🇹" },
  { code: "fr", label: "Français",  flag: "🇫🇷" },
  { code: "ur", label: "اردو",      flag: "🇵🇰" },
  { code: "zh", label: "中文",      flag: "🇨🇳" },
  { code: "ru", label: "Русский",   flag: "🇷🇺" },
  { code: "tr", label: "Türkçe",    flag: "🇹🇷" },
  { code: "es", label: "Español",   flag: "🇪🇸" },
  { code: "pt", label: "Português", flag: "🇵🇹" },
];

export function LanguagePicker({
  variant = "pill",
  className = "",
}: {
  variant?: "pill" | "circle";
  className?: string;
}) {
  const { language, setLanguage } = useTranslation();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function onPointer(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", onPointer);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onPointer);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const current = LANGS.find(l => l.code === language) ?? LANGS[0];
  const isCircle = variant === "circle";

  const triggerStyle: React.CSSProperties = isCircle
    ? {
        display: "flex", alignItems: "center", justifyContent: "center",
        width: 40, height: 40, borderRadius: "9999px",
        border: "1px solid #232C3D", background: "transparent",
        color: "#8A93A6", cursor: "pointer",
        fontSize: "0.75rem", fontWeight: 700, letterSpacing: "0.03em",
        transition: "color .2s, border-color .2s",
      }
    : {
        display: "flex", alignItems: "center", justifyContent: "center",
        borderRadius: "10px", border: "1px solid #232C3D",
        padding: "6px 10px", color: "#8A93A6",
        background: "transparent", cursor: "pointer",
        transition: "color .2s, border-color .2s, background .2s",
        fontSize: "0.875rem", fontWeight: 600, gap: 5,
      };

  return (
    <div ref={ref} className={className} style={{ position: "relative" }}>
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        style={triggerStyle}
        aria-label="Select language"
        aria-expanded={open}
        onMouseEnter={(e) => { e.currentTarget.style.color = "#EDEFF3"; e.currentTarget.style.borderColor = "#5C6CFF"; }}
        onMouseLeave={(e) => { e.currentTarget.style.color = "#8A93A6"; e.currentTarget.style.borderColor = "#232C3D"; }}
      >
        {isCircle ? (
          <span style={{ textTransform: "uppercase" }}>{current.code}</span>
        ) : (
          <>
            <Globe size={13} aria-hidden />
            <span className="sm:hidden" style={{ textTransform: "uppercase", letterSpacing: "0.03em" }}>
              {current.code}
            </span>
            <span
              className="hidden sm:inline"
              style={{ maxWidth: 52, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}
            >
              {current.label}
            </span>
            <ChevronDown
              size={11}
              aria-hidden
              style={{ opacity: 0.6, transition: "transform .15s", transform: open ? "rotate(180deg)" : "none" }}
            />
          </>
        )}
      </button>

      {open && (
        <div
          style={{
            position: "absolute",
            /* Footer sits at the page bottom, so its menu has to open upward. */
            ...(isCircle
              ? { bottom: "calc(100% + 8px)" }
              : { top: "calc(100% + 8px)" }),
            insetInlineEnd: 0,
            zIndex: 200,
            background: "#111827",
            border: "1px solid #232C3D",
            borderRadius: 12,
            minWidth: 162,
            /* 11 languages would overflow a short viewport in the footer. */
            maxHeight: "min(60vh, 420px)",
            overflowY: "auto",
            boxShadow: "0 8px 32px rgba(0,0,0,0.45)",
          }}
        >
          {LANGS.map(l => (
            <button
              key={l.code}
              type="button"
              onClick={() => { setLanguage(l.code); setOpen(false); }}
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
              {language === l.code && (
                <span style={{ marginInlineStart: "auto", color: "#5C6CFF", fontSize: "0.75rem" }}>✓</span>
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
