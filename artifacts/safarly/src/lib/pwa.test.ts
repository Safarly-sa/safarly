import { describe, it, expect, beforeEach } from "vitest";

/**
 * Same Map-backed polyfill as favorites.test.ts — the test environment is
 * plain `node` (see vitest.config.ts), so localStorage has to be supplied.
 */
class MemoryStorage {
  private store = new Map<string, string>();
  getItem(key: string): string | null { return this.store.has(key) ? this.store.get(key)! : null; }
  setItem(key: string, value: string): void { this.store.set(key, value); }
  removeItem(key: string): void { this.store.delete(key); }
  clear(): void { this.store.clear(); }
}

beforeEach(() => {
  (globalThis as unknown as { localStorage: MemoryStorage }).localStorage = new MemoryStorage();
});

import {
  INSTALL_SNOOZE_MS,
  dismissInstallPrompt,
  getInstallDismissedAt,
  isIos,
  peekInstallPrompt,
  resolveInstallRoute,
  takeInstallPrompt,
  type BeforeInstallPromptEvent,
  type InstallEligibility,
} from "@/lib/pwa";

/** A browser that can install natively and has never been told to go away. */
const BASE: InstallEligibility = {
  standalone: false,
  hasNativePrompt: true,
  ios: false,
  dismissedAt: null,
  now: 1_700_000_000_000,
};

describe("resolveInstallRoute", () => {
  it("offers the native prompt when one has been captured", () => {
    expect(resolveInstallRoute(BASE)).toBe("native");
  });

  it("falls back to manual instructions on iOS, which has no install API", () => {
    expect(resolveInstallRoute({ ...BASE, hasNativePrompt: false, ios: true })).toBe("ios-manual");
  });

  it("offers nothing to a browser with neither route", () => {
    // Desktop Firefox / Safari: no beforeinstallprompt, no Add to Home Screen.
    expect(resolveInstallRoute({ ...BASE, hasNativePrompt: false, ios: false })).toBe("none");
  });

  it("stays silent when the app is already running installed", () => {
    // The important one: an installed user opening the site in a browser tab
    // still fires beforeinstallprompt on some Chromium versions, and offering
    // them a second copy of an app they already have is the visible bug.
    expect(resolveInstallRoute({ ...BASE, standalone: true })).toBe("none");
    expect(resolveInstallRoute({ ...BASE, standalone: true, ios: true, hasNativePrompt: false }))
      .toBe("none");
  });

  it("suppresses the prompt for the whole snooze window, then offers again", () => {
    const dismissedAt = BASE.now;

    const justAfter = { ...BASE, dismissedAt, now: dismissedAt + 1000 };
    expect(resolveInstallRoute(justAfter)).toBe("none");

    const lastMoment = { ...BASE, dismissedAt, now: dismissedAt + INSTALL_SNOOZE_MS - 1 };
    expect(resolveInstallRoute(lastMoment)).toBe("none");

    const expired = { ...BASE, dismissedAt, now: dismissedAt + INSTALL_SNOOZE_MS };
    expect(resolveInstallRoute(expired)).toBe("native");
  });

  it("does not treat a future dismissal timestamp as an unbounded snooze", () => {
    // A device whose clock was wrong when the dismissal was written, then
    // corrected. `now - dismissedAt` goes negative, which is less than the
    // snooze window — so a naive comparison silently hides the prompt forever.
    const skewed = { ...BASE, dismissedAt: BASE.now + 10 * INSTALL_SNOOZE_MS };
    expect(resolveInstallRoute(skewed)).toBe("native");
  });
});

describe("isIos", () => {
  it("matches iPhone and iPad user agents", () => {
    expect(isIos("Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X)", 5)).toBe(true);
    expect(isIos("Mozilla/5.0 (iPad; CPU OS 16_0 like Mac OS X)", 5)).toBe(true);
  });

  it("matches an iPadOS device masquerading as a Mac", () => {
    // iPadOS 13+ sends a desktop UA by default; touch points are the tell.
    expect(isIos("Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)", 5)).toBe(true);
  });

  it("does not match a real Mac", () => {
    expect(isIos("Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)", 0)).toBe(false);
  });

  it("does not match Android or Windows", () => {
    expect(isIos("Mozilla/5.0 (Linux; Android 14; Pixel 8)", 5)).toBe(false);
    expect(isIos("Mozilla/5.0 (Windows NT 10.0; Win64; x64)", 0)).toBe(false);
  });
});

describe("install dismissal storage", () => {
  it("round-trips the dismissal timestamp", () => {
    expect(getInstallDismissedAt()).toBeNull();
    dismissInstallPrompt(1_700_000_000_000);
    expect(getInstallDismissedAt()).toBe(1_700_000_000_000);
  });

  it("treats a corrupt stored value as no dismissal", () => {
    // Reading garbage as NaN would make every comparison false, which happens
    // to fail open — but only by accident. Pinned so it stays deliberate.
    localStorage.setItem("safarly_pwa_install_dismissed", "not-a-number");
    expect(getInstallDismissedAt()).toBeNull();
  });
});

describe("deferred install prompt stash", () => {
  /** Stands in for the window the inline script in index.html writes to. */
  function stubWindow(stashed: BeforeInstallPromptEvent | null) {
    (globalThis as unknown as { window: unknown }).window = {
      __safarlyInstallPrompt: stashed,
    };
  }

  const fakeEvent = { type: "beforeinstallprompt" } as unknown as BeforeInstallPromptEvent;

  it("reports nothing when the event has not fired", () => {
    stubWindow(null);
    expect(peekInstallPrompt()).toBeNull();
    expect(takeInstallPrompt()).toBeNull();
  });

  it("hands the stashed event over exactly once", () => {
    // The single-use rule is the whole point of `take`: Chromium rejects a
    // second prompt() on the same event, so a second caller must get null
    // rather than a stale event that will throw when used.
    stubWindow(fakeEvent);

    expect(peekInstallPrompt()).toBe(fakeEvent);
    expect(takeInstallPrompt()).toBe(fakeEvent);
    expect(takeInstallPrompt()).toBeNull();
    expect(peekInstallPrompt()).toBeNull();
  });
});
