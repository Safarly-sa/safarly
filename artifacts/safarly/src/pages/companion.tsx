/**
 * Safarly Smart Companion — the hub over the in-trip tools.
 *
 * This page owns no behaviour of its own. Every card routes to a tool that
 * already exists and still works standalone, so /lens and /dialect keep their
 * own URLs, bookmarks and mobile bottom-nav entries. The Companion is a way in,
 * never a gate in front of them.
 *
 * The card list comes from COMPANION_CAPABILITIES rather than being written out
 * here — see that file for why.
 */
import { Link } from "wouter";
import { ArrowRight } from "lucide-react";
import { useTranslation } from "@/providers/translation-context";
import { usePageMeta } from "@/lib/usePageMeta";
import { AuroraHero } from "@/components/AuroraHero";
import { COMPANION_CAPABILITIES, type CompanionCapability } from "@/lib/companion-capabilities";

function CapabilityCard({
  cap,
  t,
  isRtl,
}: {
  cap: CompanionCapability;
  t: (k: string) => string;
  isRtl: boolean;
}) {
  const Icon = cap.icon;

  return (
    <Link
      href={cap.route}
      className="sf-companion-card"
      style={{
        display: "flex",
        flexDirection: "column",
        gap: 10,
        padding: "22px 20px",
        borderRadius: 16,
        border: "1px solid var(--sf-border)",
        background: "var(--sf-surface)",
        textDecoration: "none",
        transition: "border-color .18s, transform .18s",
      }}
    >
      <span
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          width: 44,
          height: 44,
          borderRadius: 12,
          background: "color-mix(in srgb, var(--sf-accent) 14%, transparent)",
          color: "var(--sf-accent)",
        }}
        aria-hidden
      >
        <Icon size={22} />
      </span>

      <h2 style={{ fontSize: "1.0625rem", fontWeight: 700, color: "var(--sf-text)", letterSpacing: "-0.01em" }}>
        {t(cap.titleKey)}
      </h2>

      <p style={{ fontSize: "0.875rem", lineHeight: 1.6, color: "var(--sf-text-muted)", flex: 1 }}>
        {t(cap.blurbKey)}
      </p>

      {cap.hintKey && (
        <p style={{ fontSize: "0.75rem", color: "var(--sf-text-muted)", opacity: 0.75 }}>
          {t(cap.hintKey)}
        </p>
      )}

      <span
        style={{
          display: "inline-flex",
          alignItems: "center",
          gap: 6,
          marginTop: 2,
          fontSize: "0.8125rem",
          fontWeight: 700,
          color: "var(--sf-accent)",
        }}
      >
        {t("companion.cap.open")}
        {/* Flipped under RTL so the arrow always points "onward", not "back". */}
        <ArrowRight size={15} aria-hidden style={isRtl ? { transform: "scaleX(-1)" } : undefined} />
      </span>
    </Link>
  );
}

export function Companion() {
  const { t, dir } = useTranslation();
  usePageMeta(t("page.companion.title"), t("page.companion.desc"));

  return (
    <div style={{ paddingTop: 68, paddingBottom: 88, background: "var(--sf-bg)", minHeight: "100dvh" }}>
      <AuroraHero minHeight="auto" className="sf-aurora-band">
        <div style={{ borderBottom: "1px solid var(--sf-border)", padding: "20px 20px 0" }}>
          <div style={{ maxWidth: 900, margin: "0 auto", paddingBottom: 16 }}>
            <h1 style={{ fontSize: "clamp(1.25rem,4vw,1.625rem)", fontWeight: 800, color: "var(--sf-text)", letterSpacing: "-0.02em", marginBottom: 4 }}>
              {t("page.companion.title")}
            </h1>
            <p style={{ color: "var(--sf-text-muted)", fontSize: "0.9375rem", maxWidth: 560 }}>
              {t("companion.subtitle")}
            </p>
          </div>
        </div>
      </AuroraHero>

      <div style={{ maxWidth: 900, margin: "0 auto", padding: "24px 16px" }}>
        <div
          style={{
            display: "grid",
            gap: 16,
            gridTemplateColumns: "repeat(auto-fit, minmax(248px, 1fr))",
          }}
        >
          {COMPANION_CAPABILITIES.map((cap) => (
            <CapabilityCard key={cap.id} cap={cap} t={t} isRtl={dir === "rtl"} />
          ))}
        </div>
      </div>
    </div>
  );
}
