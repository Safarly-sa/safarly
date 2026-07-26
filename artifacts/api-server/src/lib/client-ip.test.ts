import { describe, it, expect } from "vitest";
import { resolveClientIp } from "./client-ip";

/**
 * This feeds the login throttle's key, so "which value wins" is a security
 * question: read an attacker-settable header and the throttle can be bypassed
 * with a forged one, read none behind a proxy and every caller shares a
 * bucket.
 */
describe("resolveClientIp", () => {
  const HEADER = "cf-connecting-ip";

  it("falls back to the socket address when no header is configured", () => {
    expect(resolveClientIp({ "cf-connecting-ip": "1.2.3.4" }, "10.0.0.1", undefined)).toBe("10.0.0.1");
  });

  it("prefers the configured header over the socket address", () => {
    expect(resolveClientIp({ "cf-connecting-ip": "1.2.3.4" }, "10.0.0.1", HEADER)).toBe("1.2.3.4");
  });

  it("ignores headers other than the configured one", () => {
    // X-Forwarded-For is client-writable; only the named header is trusted.
    expect(
      resolveClientIp({ "x-forwarded-for": "9.9.9.9" }, "10.0.0.1", HEADER),
    ).toBe("10.0.0.1");
  });

  it("falls back when the configured header is missing or blank", () => {
    expect(resolveClientIp({}, "10.0.0.1", HEADER)).toBe("10.0.0.1");
    expect(resolveClientIp({ "cf-connecting-ip": "   " }, "10.0.0.1", HEADER)).toBe("10.0.0.1");
  });

  it("ignores a repeated header rather than guessing which value is real", () => {
    expect(
      resolveClientIp({ "cf-connecting-ip": ["1.2.3.4", "5.6.7.8"] }, "10.0.0.1", HEADER),
    ).toBe("10.0.0.1");
  });

  it("never returns empty, so the throttle key is always well-formed", () => {
    expect(resolveClientIp({}, undefined, HEADER)).toBe("unknown");
    expect(resolveClientIp({}, undefined, undefined)).toBe("unknown");
  });

  it("gives different callers different keys once the header is configured", () => {
    const a = resolveClientIp({ "cf-connecting-ip": "1.1.1.1" }, "10.0.0.1", HEADER);
    const b = resolveClientIp({ "cf-connecting-ip": "2.2.2.2" }, "10.0.0.1", HEADER);
    expect(a).not.toBe(b);
  });
});
