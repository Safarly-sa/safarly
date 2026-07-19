import { useEffect } from "react";
import { Link } from "wouter";
import safarlyLogo from "@assets/safarly-transparent_1784408718766.png";
import { usePageMeta } from "@/lib/usePageMeta";

export default function NotFound() {
  usePageMeta("Page Not Found", "This road leads nowhere — let's replan your journey.");

  return (
    <div
      style={{
        minHeight:      "100dvh",
        display:        "flex",
        flexDirection:  "column",
        alignItems:     "center",
        justifyContent: "center",
        background:     "var(--sf-bg)",
        padding:        "40px 24px",
        textAlign:      "center",
        gap:            "0",
      }}
    >
      {/* Logo mark */}
      <img
        src={safarlyLogo}
        alt="Safarly"
        style={{
          height: "80px",
          width:  "auto",
          marginBottom: "32px",
          filter: "drop-shadow(0 0 18px rgba(0,216,164,0.4)) drop-shadow(0 0 40px rgba(92,108,255,0.18))",
        }}
      />

      {/* 404 */}
      <p
        style={{
          fontSize:      "clamp(5rem, 18vw, 9rem)",
          fontWeight:    800,
          lineHeight:    1,
          letterSpacing: "-0.04em",
          background:    "linear-gradient(90deg, #00D8A4, #5C6CFF)",
          WebkitBackgroundClip: "text",
          WebkitTextFillColor:  "transparent",
          backgroundClip: "text",
          marginBottom:  "16px",
        }}
      >
        404
      </p>

      {/* Headline */}
      <h1
        style={{
          fontSize:    "clamp(1.25rem, 4vw, 1.75rem)",
          fontWeight:  700,
          color:       "var(--sf-text)",
          marginBottom:"12px",
          maxWidth:    "480px",
          lineHeight:  1.3,
        }}
      >
        This road leads nowhere — let's replan.
      </h1>

      {/* Subtext */}
      <p
        style={{
          fontSize:    "0.9375rem",
          color:       "var(--sf-text-muted)",
          marginBottom:"36px",
          maxWidth:    "360px",
          lineHeight:  1.6,
        }}
      >
        The page you're looking for doesn't exist or has been moved.
      </p>

      {/* CTA */}
      <Link
        href="/"
        style={{
          display:       "inline-flex",
          alignItems:    "center",
          gap:           "8px",
          padding:       "14px 32px",
          borderRadius:  "12px",
          background:    "var(--sf-accent)",
          color:         "#0A0E16",
          fontWeight:    700,
          fontSize:      "1rem",
          textDecoration:"none",
          transition:    "opacity 0.15s, box-shadow 0.15s",
          boxShadow:     "0 0 24px rgba(0,216,164,0.30)",
          minHeight:     "48px",
        }}
        onMouseEnter={e => (e.currentTarget.style.opacity = "0.85")}
        onMouseLeave={e => (e.currentTarget.style.opacity = "1")}
      >
        ← Back to Home
      </Link>

      {/* Subtle star dots decoration */}
      <div
        aria-hidden
        style={{
          position:     "fixed",
          inset:        0,
          pointerEvents:"none",
          zIndex:       -1,
          backgroundImage: "radial-gradient(circle, var(--sf-border) 1px, transparent 1px)",
          backgroundSize:  "28px 28px",
          opacity:      0.45,
        }}
      />
    </div>
  );
}
