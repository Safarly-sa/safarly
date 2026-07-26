/* ── Install-prompt eligibility ────────────────────────────────────────
   The decision of whether to offer "install this app" is split out of the
   component because it is the fiddly part: two entirely different browser
   contracts, plus a snooze, plus several ways to already be installed.

   The two contracts:
     - Chromium fires `beforeinstallprompt`, which is a real deferred prompt
       the page can replay later. If it fired, we have a one-tap install.
     - WebKit fires nothing and exposes no install API at all. On iOS the only
       route is the user finding Share → Add to Home Screen themselves, so the
       best the app can do is show them where it is.

   Everything here is pure apart from the two localStorage helpers, so the
   eligibility rules can be tested without a DOM. Key:
     safarly_pwa_install_dismissed   epoch ms of the last dismissal
──────────────────────────────────────────────────────────────────────── */

const DISMISSED_KEY = "safarly_pwa_install_dismissed";

/**
 * The `beforeinstallprompt` event. Not in TypeScript's lib.dom because it is a
 * Chromium extension rather than a standard — the same reason
 * types/speech-recognition.d.ts exists for the Web Speech API.
 */
export interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

/**
 * Name of the event the inline stash in index.html re-broadcasts.
 *
 * The stash exists because Chromium fires `beforeinstallprompt` well before a
 * module script finishes parsing, so React can only ever learn about it second
 * hand. Mirrors the `safarly-auth-changed` convention in lib/auth.ts.
 */
export const INSTALL_AVAILABLE_EVENT = "safarly-install-available";

interface InstallPromptWindow extends Window {
  __safarlyInstallPrompt?: BeforeInstallPromptEvent | null;
}

/** Reads the event index.html stashed, if it has fired yet. */
export function peekInstallPrompt(): BeforeInstallPromptEvent | null {
  if (typeof window === "undefined") return null;
  return (window as InstallPromptWindow).__safarlyInstallPrompt ?? null;
}

/**
 * Takes the stashed event, clearing it.
 *
 * A deferred prompt is strictly single-use — Chromium rejects a second
 * `prompt()` on the same event — so the caller must own it exclusively rather
 * than leaving it on `window` for a later render to replay.
 */
export function takeInstallPrompt(): BeforeInstallPromptEvent | null {
  const stashed = peekInstallPrompt();
  if (typeof window !== "undefined") {
    (window as InstallPromptWindow).__safarlyInstallPrompt = null;
  }
  return stashed;
}

/**
 * How long a dismissal suppresses the prompt.
 *
 * A snooze rather than a permanent opt-out: the prompt is most useful to
 * someone mid-planning who waved it away in month one and is now about to fly.
 * Long enough not to nag, short enough to catch the next trip.
 */
export const INSTALL_SNOOZE_MS = 30 * 24 * 60 * 60 * 1000; // 30 days

/** How the current browser can install, if at all. */
export type InstallRoute = "native" | "ios-manual" | "none";

/**
 * True when the app is running as an installed app rather than a browser tab.
 *
 * Two checks because the standards split: `display-mode: standalone` is the
 * spec'd media query that Chromium honours, and `navigator.standalone` is
 * Safari's non-standard predecessor, still the only signal on iOS.
 */
export function isStandalone(): boolean {
  if (typeof window === "undefined") return false;

  const displayMode =
    typeof window.matchMedia === "function" &&
    (window.matchMedia("(display-mode: standalone)").matches ||
      // Installs launched from the manifest's `shortcuts` report these instead.
      window.matchMedia("(display-mode: minimal-ui)").matches ||
      window.matchMedia("(display-mode: fullscreen)").matches);

  const iosStandalone =
    (navigator as Navigator & { standalone?: boolean }).standalone === true;

  return displayMode || iosStandalone;
}

/**
 * Detects iOS, including the iPad case that does not say "iPad".
 *
 * iPadOS 13 and later report a desktop Macintosh user agent by default. The
 * touch-point check is the usual way to tell an iPad apart from a real Mac,
 * since no Mac reports touch points — a Mac with a touchscreen does not exist,
 * and a trackpad is not a touch point.
 */
export function isIos(
  userAgent: string = typeof navigator === "undefined" ? "" : navigator.userAgent,
  maxTouchPoints: number = typeof navigator === "undefined" ? 0 : navigator.maxTouchPoints,
): boolean {
  if (/iPhone|iPad|iPod/i.test(userAgent)) return true;
  return /Macintosh/i.test(userAgent) && maxTouchPoints > 1;
}

/** Reads the stored dismissal timestamp; treats anything unparseable as absent. */
export function getInstallDismissedAt(): number | null {
  try {
    const raw = localStorage.getItem(DISMISSED_KEY);
    if (!raw) return null;
    const parsed = Number(raw);
    return Number.isFinite(parsed) ? parsed : null;
  } catch {
    // Safari in private mode throws on localStorage rather than returning null.
    return null;
  }
}

export function dismissInstallPrompt(now: number = Date.now()): void {
  try {
    localStorage.setItem(DISMISSED_KEY, String(now));
  } catch {
    // Not being able to remember the dismissal is better than crashing the
    // page over it; the prompt reappears next session at worst.
  }
}

export interface InstallEligibility {
  /** Whether the app is already running installed. */
  standalone: boolean;
  /** Whether `beforeinstallprompt` has fired and been captured. */
  hasNativePrompt: boolean;
  /** Whether this is an iOS device (see `isIos`). */
  ios: boolean;
  /** Stored dismissal timestamp, or null. */
  dismissedAt: number | null;
  now: number;
}

/**
 * The single rule for what — if anything — to offer.
 *
 * Order matters. Being installed already wins over everything: an installed
 * user opening the app in a browser tab does not need a second copy. A live
 * native prompt beats the iOS instructions, because a Chromium browser running
 * on an iPad (which `isIos` deliberately matches) can genuinely install.
 */
export function resolveInstallRoute(input: InstallEligibility): InstallRoute {
  if (input.standalone) return "none";

  if (input.dismissedAt !== null) {
    const elapsed = input.now - input.dismissedAt;
    // The `elapsed >= 0` half is what stops a clock-skewed dismissal from
    // snoozing forever: a timestamp written while the device clock was ahead
    // leaves `elapsed` negative, which is trivially under the window. Treat a
    // dismissal from the future as no dismissal at all.
    if (elapsed >= 0 && elapsed < INSTALL_SNOOZE_MS) return "none";
  }

  if (input.hasNativePrompt) return "native";
  if (input.ios) return "ios-manual";

  // Desktop Firefox and Safari land here: no install support, nothing to say.
  return "none";
}
