/**
 * /forgot-password — Request a password reset link.
 *
 * No email provider is configured yet (see CLAUDE.md / api-server/.env.example),
 * so the server hands the reset token straight back instead of emailing it.
 * This page shows the resulting link on screen rather than saying
 * "check your email" — genuinely working end to end beats a flow that looks
 * right but silently goes nowhere. Swap this for a real email send before
 * this app holds anything worth protecting.
 */
import { useState } from "react";
import { Link } from "wouter";
import { Mail, ArrowRight, Copy, Check, Loader2 } from "lucide-react";
import { usePageMeta } from "@/lib/usePageMeta";
import { useTranslation } from "@/providers/translation-context";
import { isValidEmail } from "@/lib/validation";
import { forgotPassword } from "@/lib/auth-api";
import { authErrorKey } from "@/lib/auth-errors";
import safarlyLogo from "@assets/safarly-logo-new.png";

export function ForgotPassword() {
  usePageMeta("Forgot Password — Safarly", "Request a password reset link for your Safarly account.");
  const { t } = useTranslation();
  const [email, setEmail] = useState("");
  const [fieldError, setFieldError] = useState("");
  const [formError, setFormError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [resetUrl, setResetUrl] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setFieldError("");
    setFormError("");
    const trimEmail = email.trim();

    if (!trimEmail) { setFieldError(t("login.error.email.required")); return; }
    if (!isValidEmail(trimEmail)) {
      setFieldError(t("login.error.email.invalid"));
      return;
    }

    setSubmitting(true);
    try {
      const result = await forgotPassword(trimEmail);
      if (!result.ok) { setFormError(t(authErrorKey(result.error))); return; }
      const url = new URL("/reset-password", window.location.origin);
      url.searchParams.set("token", result.resetToken);
      setResetUrl(url.toString());
    } finally {
      setSubmitting(false);
    }
  }

  async function copyLink() {
    if (!resetUrl) return;
    try {
      await navigator.clipboard.writeText(resetUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      /* Clipboard API unavailable — the link is still visible and clickable. */
    }
  }

  const inputStyle: React.CSSProperties = {
    width: "100%",
    boxSizing: "border-box",
    paddingBlock: "12px",
    paddingInlineStart: "42px",
    paddingInlineEnd: "14px",
    borderRadius: "10px",
    border: "1.5px solid var(--sf-border)",
    background: "var(--sf-surface)",
    color: "var(--sf-text)",
    fontSize: "0.9375rem",
    outline: "none",
    fontFamily: "inherit",
    transition: "border-color .2s",
  };

  return (
    <div className="sf-auth-glow" style={{
      minHeight: "100dvh",
      display: "flex",
      flexDirection: "column",
      alignItems: "center",
      justifyContent: "center",
      padding: "24px 20px",
    }}>
      <div style={{ width: "100%", maxWidth: "400px" }}>

        <div style={{ textAlign: "center", marginBottom: "40px" }}>
          <img src={safarlyLogo} alt="Safarly" style={{ height: "52px", width: "auto" }} />
          <p style={{ color: "var(--sf-text-muted)", fontSize: "0.9375rem", marginTop: "10px" }}>
            {t("forgot.title")}
          </p>
        </div>

        {resetUrl ? (
          <div style={{
            borderRadius: "12px",
            border: "1px solid var(--sf-indigo)",
            background: "var(--sf-primary-soft)",
            padding: "20px",
          }}>
            <p style={{ fontSize: "0.875rem", color: "var(--sf-text)", lineHeight: 1.6, marginBottom: 14 }}>
              {t("forgot.result.notice")}
            </p>
            <div style={{
              display: "flex", alignItems: "center", gap: 8,
              padding: "10px 12px", borderRadius: "8px",
              background: "var(--sf-surface)", border: "1px solid var(--sf-border)",
              marginBottom: 14, overflow: "hidden",
            }}>
              <span style={{
                flex: 1, fontSize: "0.8125rem", color: "var(--sf-text)",
                overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
              }}>
                {resetUrl}
              </span>
              <button
                type="button"
                onClick={copyLink}
                aria-label={t("forgot.result.copy")}
                style={{
                  background: "none", border: "none", cursor: "pointer",
                  color: "var(--sf-text-muted)", padding: 4, display: "flex", flexShrink: 0,
                }}
              >
                {copied ? <Check size={16} aria-hidden style={{ color: "var(--sf-accent)" }} /> : <Copy size={16} aria-hidden />}
              </button>
              {copied && (
                <span className="sf-sr-only" role="status">{t("forgot.result.copied")}</span>
              )}
            </div>
            <Link
              href={resetUrl.replace(window.location.origin, "")}
              style={{
                display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
                minHeight: "48px", borderRadius: "10px", border: "none",
                background: "var(--sf-accent)", color: "#0A0E16",
                fontWeight: 700, fontSize: "0.9375rem", textDecoration: "none",
              }}
            >
              {t("forgot.result.continue")}
              <ArrowRight size={16} className="rtl:hidden" aria-hidden />
            </Link>
          </div>
        ) : (
          <form onSubmit={handleSubmit} aria-busy={submitting} style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
            <p style={{ fontSize: "0.875rem", color: "var(--sf-text-muted)", lineHeight: 1.6, margin: 0 }}>
              {t("forgot.intro")}
            </p>

            <div>
              <p style={{
                fontSize: "0.75rem", fontWeight: 700, textTransform: "uppercase",
                letterSpacing: "0.08em", color: "var(--sf-text-muted)", marginBottom: "8px",
              }}>
                {t("login.field.email.label")}
              </p>
              <div style={{ position: "relative" }}>
                <Mail
                  size={15}
                  style={{
                    position: "absolute", top: "50%", insetInlineStart: "14px",
                    transform: "translateY(-50%)", color: "var(--sf-text-muted)", pointerEvents: "none",
                  }}
                />
                <input
                  type="email"
                  value={email}
                  onChange={e => { setEmail(e.target.value); setFieldError(""); }}
                  placeholder={t("login.field.email.placeholder")}
                  autoComplete="email"
                  aria-invalid={Boolean(fieldError)}
                  aria-describedby={fieldError ? "forgot-email-error" : undefined}
                  style={inputStyle}
                  onFocus={e => (e.currentTarget.style.borderColor = "var(--sf-indigo)")}
                  onBlur={e => (e.currentTarget.style.borderColor = "var(--sf-border)")}
                />
              </div>
              {fieldError && (
                <p id="forgot-email-error" role="alert" style={{ fontSize: "0.75rem", color: "var(--sf-error)", fontWeight: 600, margin: "6px 0 0" }}>
                  {fieldError}
                </p>
              )}
            </div>

            <p role="alert" aria-live="assertive" style={{ fontSize: "0.8125rem", color: "var(--sf-error)", fontWeight: 600, margin: 0 }}>
              {formError}
            </p>

            <button
              type="submit"
              disabled={submitting}
              style={{
                minHeight: "52px", borderRadius: "10px", border: "none",
                background: "var(--sf-accent)", color: "#0A0E16",
                fontWeight: 700, fontSize: "1rem",
                cursor: submitting ? "not-allowed" : "pointer",
                opacity: submitting ? 0.6 : 1,
                display: "flex", alignItems: "center", justifyContent: "center", gap: "8px",
                marginTop: "4px", transition: "background .18s, opacity .18s",
              }}
              onMouseEnter={e => { if (!submitting) e.currentTarget.style.background = "var(--sf-accent-hover)"; }}
              onMouseLeave={e => (e.currentTarget.style.background = "var(--sf-accent)")}
            >
              {submitting ? t("forgot.submit.pending") : t("forgot.submit")}
              {submitting
                ? <Loader2 size={18} className="sf-spin" aria-hidden />
                : <ArrowRight size={18} className="rtl:hidden" aria-hidden />}
            </button>
          </form>
        )}

        <p style={{ textAlign: "center", marginTop: "24px", fontSize: "0.8125rem", color: "var(--sf-text-muted)" }}>
          <Link href="/login" style={{ color: "var(--sf-indigo)", fontWeight: 700, textDecoration: "none" }}>
            {t("forgot.back_to_login")}
          </Link>
        </p>

      </div>
    </div>
  );
}
