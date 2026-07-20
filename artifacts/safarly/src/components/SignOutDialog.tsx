/**
 * Confirmation dialog for signing out.
 *
 * Shared by the Navbar and the profile page. `signOut()` only clears the
 * session — trips, favourites, and learned phrases stay on the device — but
 * still confirms first, since re-entering credentials to get back in is real
 * friction even though nothing is lost.
 */
import { useEffect, useRef } from "react";
import { AlertTriangle } from "lucide-react";

export function SignOutDialog({ onConfirm, onCancel, t }: {
  onConfirm: () => void;
  onCancel: () => void;
  t: (k: string) => string;
}) {
  const cancelRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    cancelRef.current?.focus();
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    function onKey(e: KeyboardEvent) { if (e.key === "Escape") onCancel(); }
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = prev;
      window.removeEventListener("keydown", onKey);
    };
  }, [onCancel]);

  return (
    <div
      role="dialog" aria-modal="true" aria-labelledby="signout-title"
      onClick={e => { if (e.target === e.currentTarget) onCancel(); }}
      style={{
        position: "fixed", inset: 0, zIndex: 9200,
        background: "rgba(0,0,0,0.72)", backdropFilter: "blur(5px)",
        display: "flex", alignItems: "center", justifyContent: "center", padding: 20,
      }}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{
          background: "var(--sf-surface)", borderRadius: 16, width: "100%", maxWidth: 420,
          boxShadow: "0 24px 64px rgba(0,0,0,0.55)", padding: "22px 20px",
          display: "flex", flexDirection: "column", gap: 14,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <AlertTriangle size={20} aria-hidden style={{ color: "#F59E0B", flexShrink: 0 }} />
          <h2 id="signout-title" style={{ fontSize: "1.0625rem", fontWeight: 800, color: "var(--sf-text)" }}>
            {t("profile.signout.title")}
          </h2>
        </div>

        <p style={{ fontSize: "0.875rem", lineHeight: 1.65, color: "var(--sf-text-muted)" }}>
          {t("profile.signout.body")}
        </p>

        <div style={{ display: "flex", gap: 10, marginTop: 4 }}>
          <button
            ref={cancelRef}
            type="button"
            onClick={onCancel}
            style={{
              flex: 1, minHeight: 46, borderRadius: 10,
              border: "1px solid var(--sf-border)", background: "var(--sf-surface-alt)",
              color: "var(--sf-text)", fontWeight: 700, fontSize: "0.9375rem", cursor: "pointer",
            }}
          >
            {t("profile.signout.cancel")}
          </button>
          <button
            type="button"
            onClick={onConfirm}
            style={{
              flex: 1, minHeight: 46, borderRadius: 10, border: "none",
              background: "#DC2626", color: "#fff",
              fontWeight: 700, fontSize: "0.9375rem", cursor: "pointer",
            }}
          >
            {t("profile.signout.confirm")}
          </button>
        </div>
      </div>
    </div>
  );
}
