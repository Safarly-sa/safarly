/* ── Installed-app surfaces ────────────────────────────────────────────
   Three pieces of UI that only exist because the app is installable:

     1. an offline banner, pinned under the Navbar,
     2. an update prompt, when a new service worker is waiting,
     3. an install prompt, for browsers that can add to the home screen.

   They live in one file because 2 and 3 compete for the same bottom slot and
   the priority between them has to be decided in one place — an update prompt
   outranks an install prompt, since a stale app is the more urgent of the two
   and stacking cards over the BottomNav reads as clutter.

   Eligibility logic is in `lib/pwa.ts`; this file is presentation and browser
   plumbing only.
──────────────────────────────────────────────────────────────────────── */
import { useCallback, useEffect, useState } from "react";
import { useRegisterSW } from "virtual:pwa-register/react";
import { CloudOff, Download, RefreshCw, Share, X } from "lucide-react";

import { useTranslation } from "@/providers/translation-context";
import {
  INSTALL_AVAILABLE_EVENT,
  dismissInstallPrompt,
  getInstallDismissedAt,
  isIos,
  isStandalone,
  peekInstallPrompt,
  resolveInstallRoute,
  takeInstallPrompt,
  type InstallRoute,
} from "@/lib/pwa";

/** How often an open tab re-checks for a new service worker. */
const UPDATE_CHECK_MS = 60 * 60 * 1000; // 1 hour

/**
 * Delay before the install prompt appears.
 *
 * Not zero on purpose. An install card thrown up during first paint is asking
 * someone to commit to an app they have not seen yet, and it lands on top of
 * the hero. Waiting until they are demonstrably reading gets a far better
 * answer, and costs nothing if they leave.
 */
const INSTALL_PROMPT_DELAY_MS = 15_000;

/* ── Shared card shell ──────────────────────────────────────────────── */

interface CardProps {
  icon: React.ReactNode;
  title: string;
  body: string;
  children: React.ReactNode;
  onClose: () => void;
  closeLabel: string;
}

function PWACard({ icon, title, body, children, onClose, closeLabel }: CardProps) {
  return (
    <div
      role="dialog"
      aria-label={title}
      /* Sits above the BottomNav on mobile and in the corner on desktop, where
         BottomNav is md:hidden and the token collapses to its 64px base. */
      className="fixed z-[60] start-4 end-4 bottom-[calc(16px+var(--sf-bottomnav-h))] md:bottom-4 md:end-4 md:start-auto md:max-w-sm"
      style={{
        background: "var(--sf-surface)",
        border: "1px solid var(--sf-border)",
        borderRadius: "14px",
        padding: "16px",
        boxShadow: "0 12px 32px rgba(0,0,0,0.28)",
        display: "flex",
        gap: "12px",
        alignItems: "flex-start",
      }}
    >
      <div
        aria-hidden
        style={{
          flexShrink: 0,
          width: "38px",
          height: "38px",
          borderRadius: "10px",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "color-mix(in srgb, var(--sf-accent) 14%, transparent)",
          color: "var(--sf-text-accent)",
        }}
      >
        {icon}
      </div>

      <div style={{ flex: 1, minWidth: 0 }}>
        <p style={{ fontWeight: 700, fontSize: "0.9375rem", color: "var(--sf-text)" }}>{title}</p>
        <p
          style={{
            marginTop: "4px",
            fontSize: "0.8125rem",
            lineHeight: 1.5,
            color: "var(--sf-text-muted)",
          }}
        >
          {body}
        </p>
        <div style={{ display: "flex", gap: "8px", marginTop: "12px", flexWrap: "wrap" }}>
          {children}
        </div>
      </div>

      <button
        type="button"
        onClick={onClose}
        aria-label={closeLabel}
        style={{
          flexShrink: 0,
          background: "transparent",
          border: "none",
          cursor: "pointer",
          color: "var(--sf-text-muted)",
          padding: "2px",
          // 44px is the minimum comfortable touch target; the icon is 16px.
          minWidth: "28px",
          minHeight: "28px",
        }}
      >
        <X className="w-4 h-4" aria-hidden />
      </button>
    </div>
  );
}

const primaryBtn: React.CSSProperties = {
  padding: "8px 16px",
  borderRadius: "9px",
  border: "none",
  background: "var(--sf-accent)",
  color: "#0A0E16",
  fontWeight: 700,
  fontSize: "0.8125rem",
  cursor: "pointer",
  minHeight: "36px",
};

const ghostBtn: React.CSSProperties = {
  padding: "8px 14px",
  borderRadius: "9px",
  border: "1px solid var(--sf-border)",
  background: "transparent",
  color: "var(--sf-text-muted)",
  fontWeight: 600,
  fontSize: "0.8125rem",
  cursor: "pointer",
  minHeight: "36px",
};

/* ── Offline banner ─────────────────────────────────────────────────── */

function OfflineBanner() {
  const { t } = useTranslation();
  const [offline, setOffline] = useState(
    () => typeof navigator !== "undefined" && navigator.onLine === false,
  );

  useEffect(() => {
    const goOnline = () => setOffline(false);
    const goOffline = () => setOffline(true);
    window.addEventListener("online", goOnline);
    window.addEventListener("offline", goOffline);
    return () => {
      window.removeEventListener("online", goOnline);
      window.removeEventListener("offline", goOffline);
    };
  }, []);

  if (!offline) return null;

  return (
    <div
      role="status"
      aria-live="polite"
      className="fixed z-[55] start-0 end-0 top-[var(--sf-navbar-h)]"
      style={{
        background: "var(--sf-surface-alt)",
        borderBottom: "1px solid var(--sf-border)",
        color: "var(--sf-text)",
        padding: "8px 16px",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        gap: "8px",
        fontSize: "0.8125rem",
      }}
    >
      <CloudOff className="w-4 h-4 shrink-0" aria-hidden style={{ color: "var(--sf-warning)" }} />
      <span style={{ fontWeight: 600 }}>{t("pwa.offline.title")}</span>
      <span style={{ color: "var(--sf-text-muted)" }} className="hidden sm:inline">
        {t("pwa.offline.body")}
      </span>
    </div>
  );
}

/* ── Provider ───────────────────────────────────────────────────────── */

export function PWAProvider() {
  const { t } = useTranslation();

  const {
    needRefresh: [needRefresh, setNeedRefresh],
    updateServiceWorker,
  } = useRegisterSW({
    onRegisteredSW(_url, registration) {
      if (!registration) return;
      // A home-screen app can stay open for days, and it only checks for a new
      // service worker on navigation. Without this poll an installed user can
      // sit on a stale build indefinitely.
      setInterval(() => {
        void registration.update();
      }, UPDATE_CHECK_MS);
    },
  });

  // Seeded from the stash rather than false: by the time React mounts, the
  // event has usually already fired and been caught by the inline script in
  // index.html.
  const [hasNativePrompt, setHasNativePrompt] = useState(() => peekInstallPrompt() !== null);
  const [delayElapsed, setDelayElapsed] = useState(false);
  const [installDismissed, setInstallDismissed] = useState(false);

  useEffect(() => {
    const onAvailable = () => setHasNativePrompt(true);

    // Fires when the install completes through any route, including Chromium's
    // own menu item. Clears the card so it can't linger over an installed app.
    const onInstalled = () => {
      setHasNativePrompt(false);
      setInstallDismissed(true);
    };

    window.addEventListener(INSTALL_AVAILABLE_EVENT, onAvailable);
    window.addEventListener("appinstalled", onInstalled);

    const timer = setTimeout(() => setDelayElapsed(true), INSTALL_PROMPT_DELAY_MS);

    return () => {
      window.removeEventListener(INSTALL_AVAILABLE_EVENT, onAvailable);
      window.removeEventListener("appinstalled", onInstalled);
      clearTimeout(timer);
    };
  }, []);

  const closeInstall = useCallback(() => {
    dismissInstallPrompt();
    setInstallDismissed(true);
  }, []);

  const install = useCallback(async () => {
    // Taking it clears the stash: a deferred prompt cannot be replayed, so it
    // is consumed here whatever the outcome rather than on "accepted" only.
    const prompt = takeInstallPrompt();
    if (!prompt) return;
    setHasNativePrompt(false);

    await prompt.prompt();
    const { outcome } = await prompt.userChoice;
    if (outcome === "dismissed") {
      // Treat declining the OS dialog as the snooze, so the card does not
      // reappear on the next page view asking the same question.
      dismissInstallPrompt();
    }
    setInstallDismissed(true);
  }, []);

  let route: InstallRoute = "none";
  if (!installDismissed && delayElapsed) {
    route = resolveInstallRoute({
      standalone: isStandalone(),
      hasNativePrompt,
      ios: isIos(),
      dismissedAt: getInstallDismissedAt(),
      now: Date.now(),
    });
  }

  return (
    <>
      <OfflineBanner />

      {/* Update outranks install — see the file header. */}
      {needRefresh ? (
        <PWACard
          icon={<RefreshCw className="w-5 h-5" aria-hidden />}
          title={t("pwa.update.title")}
          body={t("pwa.update.body")}
          onClose={() => setNeedRefresh(false)}
          closeLabel={t("pwa.dismiss")}
        >
          <button type="button" style={primaryBtn} onClick={() => void updateServiceWorker(true)}>
            {t("pwa.update.action")}
          </button>
          <button type="button" style={ghostBtn} onClick={() => setNeedRefresh(false)}>
            {t("pwa.update.later")}
          </button>
        </PWACard>
      ) : route === "native" ? (
        <PWACard
          icon={<Download className="w-5 h-5" aria-hidden />}
          title={t("pwa.install.title")}
          body={t("pwa.install.body")}
          onClose={closeInstall}
          closeLabel={t("pwa.dismiss")}
        >
          <button type="button" style={primaryBtn} onClick={() => void install()}>
            {t("pwa.install.action")}
          </button>
          <button type="button" style={ghostBtn} onClick={closeInstall}>
            {t("pwa.install.later")}
          </button>
        </PWACard>
      ) : route === "ios-manual" ? (
        <PWACard
          icon={<Share className="w-5 h-5" aria-hidden />}
          title={t("pwa.install.title")}
          body={t("pwa.install.ios_body")}
          onClose={closeInstall}
          closeLabel={t("pwa.dismiss")}
        >
          <button type="button" style={ghostBtn} onClick={closeInstall}>
            {t("pwa.install.got_it")}
          </button>
        </PWACard>
      ) : null}
    </>
  );
}
