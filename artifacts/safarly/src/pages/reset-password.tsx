/**
 * /reset-password?token=... — Set a new password from a reset link.
 * On success, redirects to /login so the user signs in with the new password
 * (resetting a password invalidates all existing sessions server-side).
 */
import { useState } from "react";
import { useLocation, useSearchParams, Link } from "wouter";
import { Lock, Eye, EyeOff, ArrowRight, Check, X } from "lucide-react";
import { usePageMeta } from "@/lib/usePageMeta";
import { assessPassword } from "@/lib/validation";
import { resetPassword } from "@/lib/auth-api";
import safarlyLogo from "@assets/safarly-lockup-light_1784459757614.png";

export function ResetPassword() {
  usePageMeta("Reset Password — Safarly", "Set a new password for your Safarly account.");
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
      setError(assessment.firstFailure ?? "Please choose a stronger password.");
      return;
    }

    setSubmitting(true);
    try {
      const result = await resetPassword({ token, password });
      if (!result.ok) { setError(result.error); return; }
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
      <div style={{
        minHeight: "100dvh", background: "var(--sf-bg)",
        display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
        padding: "24px 20px", textAlign: "center",
      }}>
        <div style={{ width: "100%", maxWidth: "400px" }}>
          <img src={safarlyLogo} alt="Safarly" style={{ height: "52px", width: "auto", marginBottom: 20 }} />
          <p style={{ color: "var(--sf-text)", fontSize: "1rem", fontWeight: 700, marginBottom: 8 }}>
            Missing reset link
          </p>
          <p style={{ color: "var(--sf-text-muted)", fontSize: "0.875rem", marginBottom: 20, lineHeight: 1.6 }}>
            This page needs a reset link to work. Request a new one below.
          </p>
          <Link
            href="/forgot-password"
            style={{
              display: "inline-flex", alignItems: "center", gap: 8,
              color: "var(--sf-indigo)", fontWeight: 700, textDecoration: "none", fontSize: "0.9375rem",
            }}
          >
            Request a reset link
            <ArrowRight size={16} className="rtl:hidden" aria-hidden />
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div style={{
      minHeight: "100dvh",
      background: "var(--sf-bg)",
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
            Choose a new password
          </p>
        </div>

        <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
          <div>
            <p style={{
              fontSize: "0.75rem", fontWeight: 700, textTransform: "uppercase",
              letterSpacing: "0.08em", color: "var(--sf-text-muted)", marginBottom: "8px",
            }}>
              New Password
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
                placeholder="At least 10 characters"
                autoComplete="new-password"
                style={inputStyle}
                onFocus={e => (e.currentTarget.style.borderColor = "var(--sf-indigo)")}
                onBlur={e => (e.currentTarget.style.borderColor = "var(--sf-border)")}
              />
              <button
                type="button"
                onClick={() => setShowPassword(s => !s)}
                aria-label={showPassword ? "Hide password" : "Show password"}
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

            {password.length > 0 && (
              <div style={{ marginTop: 12 }}>
                <div
                  style={{ display: "flex", gap: 4, marginBottom: 10 }}
                  role="img"
                  aria-label={`Password strength: ${assessment.score} of 4`}
                >
                  {[0, 1, 2, 3].map(i => (
                    <div
                      key={i}
                      style={{
                        flex: 1, height: 4, borderRadius: 2,
                        background: i < assessment.score
                          ? (assessment.score <= 1 ? "#DC2626"
                            : assessment.score === 2 ? "#F59E0B"
                            : assessment.score === 3 ? "#84CC16" : "var(--sf-accent)")
                          : "var(--sf-border)",
                        transition: "background 200ms ease",
                      }}
                    />
                  ))}
                </div>
                <ul style={{ display: "flex", flexDirection: "column", gap: 5, listStyle: "none", padding: 0, margin: 0 }}>
                  {assessment.rules.map(rule => (
                    <li
                      key={rule.id}
                      style={{
                        display: "flex", alignItems: "center", gap: 7,
                        fontSize: "0.78rem",
                        color: rule.passed ? "var(--sf-accent)" : "var(--sf-text-muted)",
                      }}
                    >
                      {rule.passed
                        ? <Check size={13} aria-hidden style={{ flexShrink: 0 }} />
                        : <X size={13} aria-hidden style={{ flexShrink: 0, opacity: 0.5 }} />}
                      <span>{rule.label}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>

          {error && (
            <p style={{ fontSize: "0.8125rem", color: "var(--sf-error)", fontWeight: 600, margin: 0 }}>
              {error}
            </p>
          )}

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
            {submitting ? "Resetting…" : "Reset password"}
            {!submitting && <ArrowRight size={18} className="rtl:hidden" aria-hidden />}
          </button>
        </form>

        <p style={{ textAlign: "center", marginTop: "24px", fontSize: "0.8125rem", color: "var(--sf-text-muted)" }}>
          <Link href="/login" style={{ color: "var(--sf-indigo)", fontWeight: 700, textDecoration: "none" }}>
            Back to log in
          </Link>
        </p>

      </div>
    </div>
  );
}
