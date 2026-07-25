/**
 * The sign-in wall over a freshly built itinerary.
 *
 * Anyone can plan a trip: engine.ts runs entirely in the browser over a curated
 * POI dataset, costing nothing and needing no session. What needs an account is
 * everything past that — the enrichment agents (POST /api/trip/generate and
 * friends) are billable Gemini calls, and every one of those routes is already
 * behind requireSession server-side.
 *
 * So this is a CONVERSION DEVICE, NOT AN ACCESS CONTROL. The itinerary behind
 * it is already in localStorage and the blur is one devtools toggle away from
 * gone. That is fine, and deliberate: nothing here is secret, and the part that
 * actually costs money is guarded on the server where it belongs. Do not add
 * anything sensitive behind this component on the assumption that it hides it.
 *
 * The teaser is the point. A wall with nothing behind it converts far worse
 * than one that shows the traveller what they have already earned, so the real
 * city, day count, stop count and day one's stop names are all named here.
 */
import { Link } from "wouter";
import { Lock } from "lucide-react";
import type { ItineraryResult } from "@/lib/engine";

const MAX_TEASER_STOPS = 4;

export function ResultsGate({
  result,
  t,
}: {
  result: ItineraryResult;
  t: (k: string) => string;
}) {
  const dayCount  = result.days.length;
  const stopCount = result.days.reduce((n, d) => n + d.stops.length, 0);

  const firstDayStops = (result.days[0]?.stops ?? [])
    .slice(0, MAX_TEASER_STOPS)
    .map((s) => s.poi.name);

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 60,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "20px",
        background: "color-mix(in srgb, var(--sf-bg) 72%, transparent)",
        backdropFilter: "blur(10px)",
        WebkitBackdropFilter: "blur(10px)",
      }}
      role="dialog"
      aria-modal="true"
      aria-labelledby="sf-gate-title"
    >
      <div
        style={{
          width: "100%",
          maxWidth: 460,
          maxHeight: "calc(100dvh - 40px)",
          overflowY: "auto",
          borderRadius: 20,
          border: "1px solid var(--sf-border)",
          background: "var(--sf-surface)",
          padding: "28px 24px",
          boxShadow: "0 24px 64px rgba(0,0,0,0.45)",
          textAlign: "center",
        }}
      >
        <span
          style={{
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            width: 46,
            height: 46,
            borderRadius: 14,
            marginBottom: 16,
            background: "color-mix(in srgb, var(--sf-accent) 14%, transparent)",
            color: "var(--sf-accent)",
          }}
          aria-hidden
        >
          <Lock size={22} />
        </span>

        <h2
          id="sf-gate-title"
          style={{ fontSize: "1.375rem", fontWeight: 800, color: "var(--sf-text)", letterSpacing: "-0.02em", marginBottom: 8 }}
        >
          {t("gate.title").replace("{city}", result.cityName)}
        </h2>

        <p style={{ fontSize: "0.9375rem", lineHeight: 1.6, color: "var(--sf-text-muted)", marginBottom: 20 }}>
          {t("gate.subtitle")}
        </p>

        {/* What they already built — the reason to finish signing up. */}
        <div
          style={{
            display: "flex",
            justifyContent: "center",
            gap: 12,
            marginBottom: 18,
          }}
        >
          <Stat value={dayCount}  label={t("gate.stat.days")} />
          <Stat value={stopCount} label={t("gate.stat.stops")} />
        </div>

        {firstDayStops.length > 0 && (
          <p
            style={{
              fontSize: "0.8125rem",
              lineHeight: 1.7,
              color: "var(--sf-text-muted)",
              marginBottom: 22,
              padding: "12px 14px",
              borderRadius: 12,
              background: "var(--sf-surface-alt)",
              textAlign: "start",
            }}
          >
            <strong style={{ color: "var(--sf-text)", fontWeight: 700 }}>{t("gate.day_one")}</strong>
            <br />
            {firstDayStops.join(" · ")}
            {(result.days[0]?.stops.length ?? 0) > MAX_TEASER_STOPS && " …"}
          </p>
        )}

        <Link
          href={`/login?returnTo=${encodeURIComponent("/itinerary")}`}
          style={{
            display: "block",
            padding: "13px 24px",
            borderRadius: 12,
            background: "var(--sf-accent)",
            color: "#0A0E16",
            fontWeight: 700,
            fontSize: "0.9375rem",
            textDecoration: "none",
            marginBottom: 12,
          }}
        >
          {t("gate.cta")}
        </Link>

        <p style={{ fontSize: "0.75rem", color: "var(--sf-text-muted)", opacity: 0.85 }}>
          {t("gate.reassure")}
        </p>
      </div>
    </div>
  );
}

function Stat({ value, label }: { value: number; label: string }) {
  return (
    <div
      style={{
        flex: "0 1 132px",
        padding: "12px 10px",
        borderRadius: 12,
        border: "1px solid var(--sf-border)",
      }}
    >
      <div style={{ fontSize: "1.5rem", fontWeight: 800, color: "var(--sf-accent)", lineHeight: 1.1 }}>
        {value}
      </div>
      <div style={{ fontSize: "0.75rem", color: "var(--sf-text-muted)", marginTop: 2 }}>
        {label}
      </div>
    </div>
  );
}
