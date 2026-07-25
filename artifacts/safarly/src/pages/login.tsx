/**
 * /login — Sign Up / Log In toggle.
 * The real session is a server-issued httpOnly cookie (lib/auth-api.ts);
 * lib/auth.ts additionally stores safarly_auth { name, email } in
 * localStorage as a synchronous-read mirror, never the source of truth.
 * Signup  → /profile-setup
 * Login   → /home (/) if profile complete, else /profile-setup
 */
import { useState, useEffect } from "react";
import { useLocation, useSearchParams, Link } from "wouter";
import { AnimatePresence, motion } from "framer-motion";
import { Mail, User, ArrowRight, Lock, Eye, EyeOff, Loader2 } from "lucide-react";
import { usePageMeta } from "@/lib/usePageMeta";
import { useTranslation } from "@/providers/translation-context";
import { getAuth, setAuth, isProfileComplete, sanitizeReturnTo } from "@/lib/auth";
import { isValidEmail, assessPassword, PASSWORD_MIN_LENGTH } from "@/lib/validation";
import { signUp, logIn } from "@/lib/auth-api";
import { authErrorKey } from "@/lib/auth-errors";
import { PasswordStrengthMeter, RULE_KEY } from "@/components/PasswordStrengthMeter";
import safarlyLogo from "@assets/safarly-logo-new.png";

interface FieldErrors {
  name?: string;
  email?: string;
  password?: string;
}

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
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [formError, setFormError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  /* Live policy feedback. Signup only — on login the rules are whatever the
     account was created with, so showing today's checklist would be noise. */
  const assessment = assessPassword(password, [email, name]);

  /* Redirect if already authenticated.
     Deliberately no longer conditional on the profile being complete: signing
     up from the results wall skips profile-setup by design, so "authed with an
     empty profile" is now a normal state, and gating this on it would strand
     those accounts on a sign-in form they have no reason to see. */
  useEffect(() => {
    if (getAuth()) navigate(returnTo ?? "/");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [navigate]);

  function clearErrors() {
    setFieldErrors({});
    setFormError("");
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    clearErrors();
    const trimEmail = email.trim();
    const trimName = name.trim();

    const nextFieldErrors: FieldErrors = {};
    if (mode === "signup" && !trimName) nextFieldErrors.name = t("login.error.name.required");
    if (!trimEmail) nextFieldErrors.email = t("login.error.email.required");
    else if (!isValidEmail(trimEmail)) nextFieldErrors.email = t("login.error.email.invalid");
    if (!password) nextFieldErrors.password = t("login.error.password.required");

    if (Object.keys(nextFieldErrors).length > 0) {
      setFieldErrors(nextFieldErrors);
      return;
    }

    if (mode === "signup" && !assessment.valid) {
      setFormError(
        assessment.firstFailureId
          ? t(RULE_KEY[assessment.firstFailureId]).replace("{min}", String(PASSWORD_MIN_LENGTH))
          : t("password.error.generic")
      );
      return;
    }

    setSubmitting(true);
    try {
      const result = mode === "signup"
        ? await signUp({ name: trimName, email: trimEmail, password })
        : await logIn({ email: trimEmail, password });

      /* Server errors never map to a specific field — the server deliberately
         returns one generic message for both unknown-email and wrong-password
         to avoid account enumeration; field-mapping it here would defeat that. */
      if (!result.ok) { setFormError(t(authErrorKey(result.error))); return; }

      /* The server owns the account; localStorage keeps only the display copy
         the rest of the app already reads synchronously. */
      setAuth({ name: result.user.name, email: result.user.email });

      /* Someone who just hit the wall on a finished itinerary has earned the
         payoff, not a seven-step form. Send them straight to what they built;
         profile-setup is offered on the itinerary itself as an optional way to
         sharpen future recommendations. Every other entry point still collects
         the profile up front, where it costs nothing. */
      const cameFromResultsGate = returnTo === "/itinerary";
      const returnToQuery = returnTo ? `?returnTo=${encodeURIComponent(returnTo)}` : "";
      navigate(
        !cameFromResultsGate && (mode === "signup" || !isProfileComplete())
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

  const fieldErrorStyle: React.CSSProperties = {
    fontSize: "0.75rem",
    color: "var(--sf-error)",
    fontWeight: 600,
    margin: "6px 0 0",
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

        {/* Logo */}
        <div style={{ textAlign: "center", marginBottom: "40px" }}>
          <img src={safarlyLogo} alt="Safarly" style={{ height: "52px", width: "auto" }} />
          <p style={{ color: "var(--sf-text-muted)", fontSize: "0.9375rem", marginTop: "10px" }}>
            {t("login.tagline")}
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
              onClick={() => { setMode(m); clearErrors(); }}
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
              {m === "signup" ? t("login.tab.signup") : t("login.tab.login")}
            </button>
          ))}
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} aria-busy={submitting} style={{ display: "flex", flexDirection: "column", gap: "16px" }}>

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
                <FieldLabel>{t("login.field.name.label")}</FieldLabel>
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
                    onChange={e => { setName(e.target.value); setFieldErrors(f => ({ ...f, name: undefined })); }}
                    placeholder={t("login.field.name.placeholder")}
                    autoComplete="given-name"
                    aria-invalid={Boolean(fieldErrors.name)}
                    aria-describedby={fieldErrors.name ? "login-name-error" : undefined}
                    style={inputStyle}
                    onFocus={e => (e.currentTarget.style.borderColor = "var(--sf-indigo)")}
                    onBlur={e => (e.currentTarget.style.borderColor = "var(--sf-border)")}
                  />
                </div>
                {fieldErrors.name && (
                  <p id="login-name-error" role="alert" style={fieldErrorStyle}>{fieldErrors.name}</p>
                )}
              </motion.div>
            )}
          </AnimatePresence>

          {/* Email field — always shown */}
          <div>
            <FieldLabel>{t("login.field.email.label")}</FieldLabel>
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
                onChange={e => { setEmail(e.target.value); setFieldErrors(f => ({ ...f, email: undefined })); }}
                placeholder={t("login.field.email.placeholder")}
                autoComplete="email"
                aria-invalid={Boolean(fieldErrors.email)}
                aria-describedby={fieldErrors.email ? "login-email-error" : undefined}
                style={inputStyle}
                onFocus={e => (e.currentTarget.style.borderColor = "var(--sf-indigo)")}
                onBlur={e => (e.currentTarget.style.borderColor = "var(--sf-border)")}
              />
            </div>
            {fieldErrors.email && (
              <p id="login-email-error" role="alert" style={fieldErrorStyle}>{fieldErrors.email}</p>
            )}
          </div>

          {/* Password field — always shown */}
          <div>
            <FieldLabel>{t("login.field.password.label")}</FieldLabel>
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
                onChange={e => { setPassword(e.target.value); setFieldErrors(f => ({ ...f, password: undefined })); }}
                placeholder={mode === "signup"
                  ? t("login.field.password.placeholder.signup").replace("{min}", String(PASSWORD_MIN_LENGTH))
                  : t("login.field.password.placeholder.login")}
                autoComplete={mode === "signup" ? "new-password" : "current-password"}
                aria-invalid={Boolean(fieldErrors.password)}
                aria-describedby={[
                  fieldErrors.password ? "login-password-error" : null,
                  mode === "signup" && password.length > 0 ? "login-password-strength" : null,
                ].filter(Boolean).join(" ") || undefined}
                style={{ ...inputStyle, paddingInlineEnd: "46px" }}
                onFocus={e => (e.currentTarget.style.borderColor = "var(--sf-indigo)")}
                onBlur={e => (e.currentTarget.style.borderColor = "var(--sf-border)")}
              />
              <button
                type="button"
                onClick={() => setShowPassword(s => !s)}
                aria-label={showPassword ? t("password.hide") : t("password.show")}
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
            {fieldErrors.password && (
              <p id="login-password-error" role="alert" style={fieldErrorStyle}>{fieldErrors.password}</p>
            )}

            <PasswordStrengthMeter
              id="login-password-strength"
              assessment={assessment}
              visible={mode === "signup" && password.length > 0}
            />
          </div>

          {/* Forgot password — login only; signup has no password to forget yet */}
          {mode === "login" && (
            <p style={{ textAlign: "end", margin: "-8px 0 0" }}>
              <Link
                href="/forgot-password"
                style={{ color: "var(--sf-indigo)", fontWeight: 600, fontSize: "0.8125rem", textDecoration: "none" }}
              >
                {t("login.forgot_link")}
              </Link>
            </p>
          )}

          {/* Form-level error — always mounted so screen readers observe changes */}
          <p
            id="login-form-error"
            role="alert"
            aria-live="assertive"
            style={{ fontSize: "0.8125rem", color: "var(--sf-error)", fontWeight: 600, margin: 0, minHeight: formError ? undefined : 0 }}
          >
            {formError}
          </p>

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
              ? (mode === "signup" ? t("login.submit.signup.pending") : t("login.submit.login.pending"))
              : (mode === "signup" ? t("login.submit.signup") : t("login.submit.login"))}
            {submitting
              ? <Loader2 size={18} className="sf-spin" aria-hidden />
              : <ArrowRight size={18} className="rtl:hidden" aria-hidden />}
          </button>
        </form>

        {/* Toggle hint */}
        <p style={{
          textAlign: "center",
          marginTop: "24px",
          fontSize: "0.8125rem",
          color: "var(--sf-text-muted)",
        }}>
          {mode === "signup" ? t("login.switch.have_account") : t("login.switch.new_here")}
          {" "}
          <button
            type="button"
            onClick={() => { setMode(mode === "signup" ? "login" : "signup"); clearErrors(); }}
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
            {mode === "signup" ? t("login.tab.login") : t("login.tab.signup")}
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
