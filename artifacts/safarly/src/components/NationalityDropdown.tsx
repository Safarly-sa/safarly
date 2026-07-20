import { useState, useRef, useEffect } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Search } from "lucide-react";
import { useTranslation } from "@/providers/translation-context";
import { NATIONALITIES, demonymKey } from "@/lib/nationalities";

/**
 * Searchable nationality dropdown. `value`/`onChange` carry the ISO 3166-1
 * alpha-2 code (the canonical, stored form); the list displays and searches
 * the demonym localized for the active language, e.g. "Lebanese" / "لبناني".
 */
export function NationalityDropdown({
  value, onChange, placeholder, noneLabel,
}: { value: string; onChange: (code: string) => void; placeholder: string; noneLabel: string }) {
  const { t, language } = useTranslation();
  const demonymFor = (code: string) => t(demonymKey(code));

  const [query, setQuery] = useState(value ? demonymFor(value) : "");
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  const filtered = query.length < 1
    ? NATIONALITIES
    : NATIONALITIES.filter((n) => demonymFor(n.code).toLowerCase().includes(query.toLowerCase()));

  useEffect(() => {
    function handler(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  // Keep the displayed text in sync when value changes externally (e.g. profile
  // load) or the UI language changes (the demonym text itself changes).
  useEffect(() => { setQuery(value ? demonymFor(value) : ""); }, [value, language]); // eslint-disable-line

  function pick(code: string) {
    onChange(code);
    setQuery(demonymFor(code));
    setOpen(false);
  }

  return (
    <div ref={ref} style={{ position: "relative", width: "100%" }}>
      <div style={{
        display: "flex", alignItems: "center", gap: "8px",
        border: `1.5px solid ${open ? "var(--sf-indigo)" : "var(--sf-border)"}`,
        borderRadius: "10px", padding: "0 12px",
        background: "var(--sf-surface)",
        transition: "border-color .2s",
        minHeight: "48px",
      }}>
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
            initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }} transition={{ duration: 0.15 }}
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
                filtered.map((n) => (
                  <button
                    key={n.code} type="button" onClick={() => pick(n.code)}
                    style={{
                      width: "100%", textAlign: "start", padding: "11px 16px",
                      border: "none", background: value === n.code ? "var(--sf-primary-soft)" : "transparent",
                      color: value === n.code ? "var(--sf-text)" : "var(--sf-text-muted)",
                      cursor: "pointer", fontSize: "0.9375rem",
                      minHeight: "44px", display: "block", transition: "background .12s",
                    }}
                    onMouseEnter={e => (e.currentTarget.style.background = "var(--sf-surface-alt)")}
                    onMouseLeave={e => (e.currentTarget.style.background = value === n.code ? "var(--sf-primary-soft)" : "transparent")}
                  >
                    {demonymFor(n.code)}
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
