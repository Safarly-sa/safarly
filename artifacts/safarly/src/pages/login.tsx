/**
 * /login — Sign Up / Log In toggle.
 * Stores safarly_auth { name, email } in localStorage.
 * Signup  → /profile-setup
 * Login   → /home (/) if profile complete, else /profile-setup
 */
import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { AnimatePresence, motion } from "framer-motion";
import { Mail, User, ArrowRight } from "lucide-react";
import { usePageMeta } from "@/lib/usePageMeta";
import { getAuth, setAuth, isProfileComplete } from "@/lib/auth";
import { isValidEmail } from "@/lib/validation";
import safarlyLogo from "@assets/safarly-lockup-light_1784459757614.png";

export function Login() {
  usePageMeta("Sign In — Safarly", "Log in or create your Safarly account.");
  const [, navigate] = useLocation();
  const [mode, setMode] = useState<"signup" | "login">("signup");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [error, setError] = useState("");

  /* Redirect if already authenticated + profile complete */
  useEffect(() => {
    if (getAuth() && isProfileComplete()) navigate("/");
  }, [navigate]);

  function handleSubmit(e: React.FormEvent) {
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

    if (mode === "signup") {
      setAuth({ name: trimName, email: trimEmail });
      navigate("/profile-setup");
    } else {
      /* For login, preserve existing name if auth already present */
      const existing = getAuth();
      setAuth({ name: existing?.name ?? trimName, email: trimEmail });
      navigate(isProfileComplete() ? "/" : "/profile-setup");
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

          {/* Error */}
          {error && (
            <p style={{ fontSize: "0.8125rem", color: "var(--sf-error)", fontWeight: 600, margin: 0 }}>
              {error}
            </p>
          )}

          {/* Submit */}
          <button
            type="submit"
            style={{
              minHeight: "52px",
              borderRadius: "10px",
              border: "none",
              background: "var(--sf-accent)",
              color: "#0A0E16",
              fontWeight: 700,
              fontSize: "1rem",
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: "8px",
              marginTop: "4px",
              transition: "background .18s",
            }}
            onMouseEnter={e => (e.currentTarget.style.background = "var(--sf-accent-hover)")}
            onMouseLeave={e => (e.currentTarget.style.background = "var(--sf-accent)")}
          >
            {mode === "signup" ? "Create Account" : "Log In"}
            <ArrowRight size={18} className="rtl:hidden" aria-hidden />
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
