/**
 * /login — Sign Up / Log In toggle.
 * Stores safarly_auth { name, email } in localStorage.
 * Signup  → /profile-setup
 * Login   → /home (/) if profile complete, else /profile-setup
 */
import { useState, useEffect } from "react";
import { useLocation, useSearchParams, Link } from "wouter";
import { AnimatePresence, motion } from "framer-motion";
import { Mail, User, ArrowRight, Lock, Eye, EyeOff, Check, X } from "lucide-react";
import { usePageMeta } from "@/lib/usePageMeta";
import { useTranslation } from "@/providers/translation-context";
import { getAuth, setAuth, isProfileComplete, sanitizeReturnTo } from "@/lib/auth";
import { isValidEmail, assessPassword } from "@/lib/validation";
import { signUp, logIn } from "@/lib/auth-api";
import safarlyLogo from "@assets/safarly-logo-new.png";

export function Login() {
  usePageMeta("Sign In — Safarly", "Log in or create your Safarly account.");
  const { t } = useTranslation();
  const [, navigate] = useLocation();
  const [searchParams] = useSearchParams();
  const returnTo = sanitizeReturnTo(searchParams.get("returnTo"));
  const [mode, setMode] = useState<"signup" | "login">("signup");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  /* Live policy feedback. Signup only — on login the rules are whatever the
     account was created with, so showing today's checklist would be noise. */
  const assessment = assessPassword(password, [email, name]);

  /* Redirect if already authenticated + profile complete */
  useEffect(() => {
    if (getAuth() && isProfileComplete()) navigate(returnTo ?? "/");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [navigate]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    const trimEmail = email.trim();
    const trimName = name.trim();

    if (!trimEmail) { setError("Please enter your email address."); return; }
    if (!isValidEmail(trimEmail)) {
      setError("Please enter a valid email address, like you@example.com.");
      return;
    }
    if (mode === "signup" && !trimName) { setError("Please enter your name."); return; }
    if (!password) { setError("Please enter your password."); return; }
    if (mode === "signup" && !assessment.valid) {
      setError(assessment.firstFailure ?? "Please choose a stronger password.");
      return;
    }

    setSubmitting(true);
    try {
      const result = mode === "signup"
        ? await signUp({ name: trimName, email: trimEmail, password })
        : await logIn({ email: trimEmail, password });

      if (!result.ok) { setError(result.error); return; }

      /* The server owns the account; localStorage keeps only the display copy
         the rest of the app already reads synchronously. */
      setAuth({ name: result.user.name, email: result.user.email });
      const returnToQuery = returnTo ? `?returnTo=${encodeURIComponent(returnTo)}` : "";
      navigate(
        mode === "signup" || !isProfileComplete()
          ? `/profile-setup${returnToQuery}`
          : returnTo ?? "/"
      );
    } finally {
      setSubmitting(false);
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

        {/* Logo */}
        <div style={{ textAlign: "center", marginBottom: "40px" }}>
          <img src={safarlyLogo} alt="Safarly" style={{ height: "52px", width: "auto" }} />
          <p style={{ color: "var(--sf-text-muted)", fontSize: "0.9375rem", marginTop: "10px" }}>
            Your Saudi Journey, Intelligently Crafted
          </p>
        </div>

        {/* Redirect notice — only shown when login was reached via a gated link */}
        {returnTo && (
          <p style={{
            textAlign: "center",
            marginBottom: "20px",
            padding: "10px 14px",
            borderRadius: "10px",
            background: "var(--sf-primary-soft)",
            border: "1px solid var(--sf-indigo)",
            color: "var(--sf-text)",
            fontSize: "0.8125rem",
            fontWeight: 600,
          }}>
            {t("login.returnto.trip_crafting")}
          </p>
        )}

        {/* Mode toggle */}
        <div style={{
          display: "flex",
          background: "var(--sf-surface)",
          border: "1px solid var(--sf-border)",
          borderRadius: "12px",
          padding: "4px",
          marginBottom: "28px",
        }}>
          {(["signup", "login"] as const).map((m) => (
            <button
              key={m}
              type="button"
              onClick={() => { setMode(m); setError(""); }}
              style={{
                flex: 1,
                minHeight: "42px",
                borderRadius: "9px",
                border: "none",
                background: mode === m ? "var(--sf-accent)" : "transparent",
                color: mode === m ? "#0A0E16" : "var(--sf-text-muted)",
                fontWeight: 700,
                fontSize: "0.9375rem",
                cursor: "pointer",
                transition: "background .2s, color .2s",
              }}
            >
              {m === "signup" ? "Sign Up" : "Log In"}
            </button>
          ))}
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: "16px" }}>

          {/* Name field — signup only */}
          <AnimatePresence initial={false}>
            {mode === "signup" && (
              <motion.div
                key="name-field"
                initial={{ opacity: 0, height: 0, marginBottom: 0 }}
                animate={{ opacity: 1, height: "auto" }}
                exit={{ opacity: 0, height: 0 }}
                transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
                style={{ overflow: "hidden" }}
              >
                <FieldLabel>Your Name</FieldLabel>
                <div style={{ position: "relative" }}>
                  <User
                    size={15}
                    style={{
                      position: "absolute", top: "50%",
                      insetInlineStart: "14px",
                      transform: "translateY(-50%)",
                      color: "var(--sf-text-muted)",
                      pointerEvents: "none",
                    }}
                  />
                  <input
                    type="text"
                    value={name}
                    onChange={e => setName(e.target.value)}
                    placeholder="e.g. Sara Al-Ghamdi"
                    autoComplete="given-name"
                    style={inputStyle}
                    onFocus={e => (e.currentTarget.style.borderColor = "var(--sf-indigo)")}
                    onBlur={e => (e.currentTarget.style.borderColor = "var(--sf-border)")}
                  />
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Email field — always shown */}
          <div>
            <FieldLabel>Email Address</FieldLabel>
            <div style={{ position: "relative" }}>
              <Mail
                size={15}
                style={{
                  position: "absolute", top: "50%",
                  insetInlineStart: "14px",
                  transform: "translateY(-50%)",
                  color: "var(--sf-text-muted)",
                  pointerEvents: "none",
                }}
              />
              <input
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                placeholder="you@example.com"
                autoComplete="email"
                style={inputStyle}
                onFocus={e => (e.currentTarget.style.borderColor = "var(--sf-indigo)")}
                onBlur={e => (e.currentTarget.style.borderColor = "var(--sf-border)")}
              />
            </div>
          </div>

          {/* Password field — always shown */}
          <div>
            <FieldLabel>Password</FieldLabel>
            <div style={{ position: "relative" }}>
              <Lock
                size={15}
                style={{
                  position: "absolute", top: "50%",
                  insetInlineStart: "14px",
                  transform: "translateY(-50%)",
                  color: "var(--sf-text-muted)",
                  pointerEvents: "none",
                }}
              />
              <input
                type={showPassword ? "text" : "password"}
                value={password}
                onChange={e => setPassword(e.target.value)}
                placeholder={mode === "signup" ? "At least 10 characters" : "Your password"}
                autoComplete={mode === "signup" ? "new-password" : "current-password"}
                style={{ ...inputStyle, paddingInlineEnd: "46px" }}
                onFocus={e => (e.currentTarget.style.borderColor = "var(--sf-indigo)")}
                onBlur={e => (e.currentTarget.style.borderColor = "var(--sf-border)")}
              />
              <button
                type="button"
                onClick={() => setShowPassword(s => !s)}
                aria-label={showPassword ? "Hide password" : "Show password"}
                aria-pressed={showPassword}
                style={{
                  position: "absolute", top: "50%",
                  insetInlineEnd: "6px",
                  transform: "translateY(-50%)",
                  background: "none", border: "none", cursor: "pointer",
                  color: "var(--sf-text-muted)",
                  padding: 8, display: "flex", alignItems: "center",
                  minWidth: 34, minHeight: 34, justifyContent: "center",
                }}
              >
                {showPassword ? <EyeOff size={16} aria-hidden /> : <Eye size={16} aria-hidden />}
              </button>
            </div>

            {/* Requirement checklist — signup only, and only once typing starts.
                Showing every unmet rule up front reads as a wall of red. */}
            {mode === "signup" && password.length > 0 && (
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

          {/* Forgot password — login only; signup has no password to forget yet */}
          {mode === "login" && (
            <p style={{ textAlign: "end", margin: "-8px 0 0" }}>
              <Link
                href="/forgot-password"
                style={{ color: "var(--sf-indigo)", fontWeight: 600, fontSize: "0.8125rem", textDecoration: "none" }}
              >
                Forgot your password?
              </Link>
            </p>
          )}

          {/* Error */}
          {error && (
            <p style={{ fontSize: "0.8125rem", color: "var(--sf-error)", fontWeight: 600, margin: 0 }}>
              {error}
            </p>
          )}

          {/* Submit */}
          <button
            type="submit"
            disabled={submitting}
            style={{
              minHeight: "52px",
              borderRadius: "10px",
              border: "none",
              background: "var(--sf-accent)",
              color: "#0A0E16",
              fontWeight: 700,
              fontSize: "1rem",
              cursor: submitting ? "not-allowed" : "pointer",
              opacity: submitting ? 0.6 : 1,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: "8px",
              marginTop: "4px",
              transition: "background .18s, opacity .18s",
            }}
            onMouseEnter={e => { if (!submitting) e.currentTarget.style.background = "var(--sf-accent-hover)"; }}
            onMouseLeave={e => (e.currentTarget.style.background = "var(--sf-accent)")}
          >
            {submitting
              ? (mode === "signup" ? "Creating account…" : "Logging in…")
              : (mode === "signup" ? "Create Account" : "Log In")}
            {!submitting && <ArrowRight size={18} className="rtl:hidden" aria-hidden />}
          </button>
        </form>

        {/* Toggle hint */}
        <p style={{
          textAlign: "center",
          marginTop: "24px",
          fontSize: "0.8125rem",
          color: "var(--sf-text-muted)",
        }}>
          {mode === "signup" ? "Already have an account?" : "New to Safarly?"}
          {" "}
          <button
            type="button"
            onClick={() => { setMode(mode === "signup" ? "login" : "signup"); setError(""); }}
            style={{
              background: "none",
              border: "none",
              color: "var(--sf-indigo)",
              fontWeight: 700,
              cursor: "pointer",
              fontSize: "0.8125rem",
              padding: 0,
            }}
          >
            {mode === "signup" ? "Log In" : "Sign Up"}
          </button>
        </p>

      </div>
    </div>
  );
}

function FieldLabel({ children }: { children: React.ReactNode }) {
  return (
    <p style={{
      fontSize: "0.75rem",
      fontWeight: 700,
      textTransform: "uppercase",
      letterSpacing: "0.08em",
      color: "var(--sf-text-muted)",
      marginBottom: "8px",
    }}>
      {children}
    </p>
  );
}
