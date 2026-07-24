/**
 * /reset-password?token=... — Set a new password from a reset link.
 * On success, redirects to /login so the user signs in with the new password
 * (resetting a password invalidates all existing sessions server-side).
 */
import { useState } from "react";
import { useLocation, useSearchParams, Link } from "wouter";
import { Lock, Eye, EyeOff, ArrowRight, Loader2 } from "lucide-react";
import { usePageMeta } from "@/lib/usePageMeta";
import { useTranslation } from "@/providers/translation-context";
import { assessPassword, PASSWORD_MIN_LENGTH } from "@/lib/validation";
import { resetPassword } from "@/lib/auth-api";
import { authErrorKey } from "@/lib/auth-errors";
import { PasswordStrengthMeter, RULE_KEY } from "@/components/PasswordStrengthMeter";
import safarlyLogo from "@assets/safarly-logo-new.png";

export function ResetPassword() {
  usePageMeta("Reset Password — Safarly", "Set a new password for your Safarly account.");
  const { t } = useTranslation();
  const [, navigate] = useLocation();
  const [searchParams] = useSearchParams();
  const token = searchParams.get("token") ?? "";

  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const assessment = assessPassword(password);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");

    if (!assessment.valid) {
      setError(
        assessment.firstFailureId
          ? t(RULE_KEY[assessment.firstFailureId]).replace("{min}", String(PASSWORD_MIN_LENGTH))
          : t("password.error.generic")
      );
      return;
    }

    setSubmitting(true);
    try {
      const result = await resetPassword({ token, password });
      if (!result.ok) { setError(t(authErrorKey(result.error))); return; }
      navigate("/login");
    } finally {
      setSubmitting(false);
    }
  }

  const inputStyle: React.CSSProperties = {
    width: "100%",
    boxSizing: "border-box",
    paddingBlock: "12px",
    paddingInlineStart: "42px",
    paddingInlineEnd: "46px",
    borderRadius: "10px",
    border: "1.5px solid var(--sf-border)",
    background: "var(--sf-surface)",
    color: "var(--sf-text)",
    fontSize: "0.9375rem",
    outline: "none",
    fontFamily: "inherit",
    transition: "border-color .2s",
  };

  if (!token) {
    return (
      <div className="sf-auth-glow" style={{
        minHeight: "100dvh",
        display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
        padding: "24px 20px", textAlign: "center",
      }}>
        <div style={{ width: "100%", maxWidth: "400px" }}>
          <img src={safarlyLogo} alt="Safarly" style={{ height: "52px", width: "auto", marginBottom: 20 }} />
          <p style={{ color: "var(--sf-text)", fontSize: "1rem", fontWeight: 700, marginBottom: 8 }}>
            {t("reset.missing.title")}
          </p>
          <p style={{ color: "var(--sf-text-muted)", fontSize: "0.875rem", marginBottom: 20, lineHeight: 1.6 }}>
            {t("reset.missing.body")}
          </p>
          <Link
            href="/forgot-password"
            style={{
              display: "inline-flex", alignItems: "center", gap: 8,
              color: "var(--sf-indigo)", fontWeight: 700, textDecoration: "none", fontSize: "0.9375rem",
            }}
          >
            {t("reset.missing.cta")}
            <ArrowRight size={16} className="rtl:hidden" aria-hidden />
          </Link>
        </div>
      </div>
    );
  }

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
            {t("reset.title")}
          </p>
        </div>

        <form onSubmit={handleSubmit} aria-busy={submitting} style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
          <div>
            <p style={{
              fontSize: "0.75rem", fontWeight: 700, textTransform: "uppercase",
              letterSpacing: "0.08em", color: "var(--sf-text-muted)", marginBottom: "8px",
            }}>
              {t("reset.field.password.label")}
            </p>
            <div style={{ position: "relative" }}>
              <Lock
                size={15}
                style={{
                  position: "absolute", top: "50%", insetInlineStart: "14px",
                  transform: "translateY(-50%)", color: "var(--sf-text-muted)", pointerEvents: "none",
                }}
              />
              <input
                type={showPassword ? "text" : "password"}
                value={password}
                onChange={e => setPassword(e.target.value)}
                placeholder={t("reset.field.password.placeholder").replace("{min}", String(PASSWORD_MIN_LENGTH))}
                autoComplete="new-password"
                aria-describedby={password.length > 0 ? "reset-password-strength" : undefined}
                style={inputStyle}
                onFocus={e => (e.currentTarget.style.borderColor = "var(--sf-indigo)")}
                onBlur={e => (e.currentTarget.style.borderColor = "var(--sf-border)")}
              />
              <button
                type="button"
                onClick={() => setShowPassword(s => !s)}
                aria-label={showPassword ? t("password.hide") : t("password.show")}
                aria-pressed={showPassword}
                style={{
                  position: "absolute", top: "50%", insetInlineEnd: "6px",
                  transform: "translateY(-50%)", background: "none", border: "none", cursor: "pointer",
                  color: "var(--sf-text-muted)", padding: 8, display: "flex", alignItems: "center",
                  minWidth: 34, minHeight: 34, justifyContent: "center",
                }}
              >
                {showPassword ? <EyeOff size={16} aria-hidden /> : <Eye size={16} aria-hidden />}
              </button>
            </div>

            <PasswordStrengthMeter
              id="reset-password-strength"
              assessment={assessment}
              visible={password.length > 0}
            />
          </div>

          <p role="alert" aria-live="assertive" style={{ fontSize: "0.8125rem", color: "var(--sf-error)", fontWeight: 600, margin: 0 }}>
            {error}
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
            {submitting ? t("reset.submit.pending") : t("reset.submit")}
            {submitting
              ? <Loader2 size={18} className="sf-spin" aria-hidden />
              : <ArrowRight size={18} className="rtl:hidden" aria-hidden />}
          </button>
        </form>

        <p style={{ textAlign: "center", marginTop: "24px", fontSize: "0.8125rem", color: "var(--sf-text-muted)" }}>
          <Link href="/login" style={{ color: "var(--sf-indigo)", fontWeight: 700, textDecoration: "none" }}>
            {t("reset.back_to_login")}
          </Link>
        </p>

      </div>
    </div>
  );
}
