import { describe, it, expect } from "vitest";
import { buildPreviewPatterns, isOriginAllowed } from "./cors-origin";

/**
 * This is the control that replaced SameSite as CSRF protection once the
 * session cookie went to `SameSite=None` — a hostname that slips through here
 * can make credentialed requests as a signed-in user, so the near-miss cases
 * below matter more than their size suggests.
 */
const ALLOWED = ["https://safarly.pages.dev"];
const PATTERNS = buildPreviewPatterns(ALLOWED);

function allowed(origin: string, allowLocalhost = false) {
  return isOriginAllowed(origin, ALLOWED, PATTERNS, allowLocalhost);
}

describe("isOriginAllowed", () => {
  it("allows the exact production origin", () => {
    expect(allowed("https://safarly.pages.dev")).toBe(true);
  });

  it("allows Cloudflare Pages preview subdomains", () => {
    expect(allowed("https://feat-trip-stories-media-and.safarly.pages.dev")).toBe(true);
    expect(allowed("https://7f6ce6ac.safarly.pages.dev")).toBe(true);
  });

  it("rejects a lookalike host that merely ends the same way", () => {
    // The dot before the project host is part of the pattern, so a prefixed
    // registerable domain must not match.
    expect(allowed("https://evil-safarly.pages.dev")).toBe(false);
  });

  it("rejects a host that only starts the same way", () => {
    // Trailing anchor: an attacker-controlled parent domain must not match.
    expect(allowed("https://safarly.pages.dev.evil.com")).toBe(false);
    expect(allowed("https://safarly.pages.dev.evil.com/")).toBe(false);
  });

  it("rejects another project's previews on the same Pages host", () => {
    expect(allowed("https://preview.someoneelse.pages.dev")).toBe(false);
  });

  it("rejects a nested subdomain, which Pages does not issue", () => {
    expect(allowed("https://a.b.safarly.pages.dev")).toBe(false);
  });

  it("rejects plain http for an otherwise-valid preview host", () => {
    expect(allowed("http://feat-x.safarly.pages.dev")).toBe(false);
  });

  it("rejects unrelated origins", () => {
    expect(allowed("https://evil.com")).toBe(false);
    expect(allowed("null")).toBe(false);
    expect(allowed("")).toBe(false);
  });

  it("allows localhost only when told to", () => {
    expect(allowed("http://localhost:5173", true)).toBe(true);
    expect(allowed("http://localhost:5173", false)).toBe(false);
  });
});

describe("buildPreviewPatterns", () => {
  it("only expands pages.dev entries, never a custom domain", () => {
    const patterns = buildPreviewPatterns(["https://safarly.com", "https://safarly.pages.dev"]);
    expect(patterns).toHaveLength(1);
    expect(
      isOriginAllowed("https://anything.safarly.com", ["https://safarly.com"], patterns, false),
    ).toBe(false);
  });

  it("produces nothing when no origins are configured", () => {
    expect(buildPreviewPatterns([])).toEqual([]);
  });
});
