import { describe, it, expect } from "vitest";
import { isTikTokUrl, extractTikTokVideoId } from "./tiktok-url";

/**
 * Same class of boundary as cors-origin: an https URL that passes the scheme
 * check but points somewhere else entirely. story-detail renders a tiktok
 * item's url as the embed's "Watch on TikTok" href, so a host that slips
 * through here is a phishing link served inside our own UI — the near-miss
 * cases are the point of the test.
 */
describe("isTikTokUrl", () => {
  it("accepts canonical TikTok video URLs", () => {
    expect(isTikTokUrl("https://www.tiktok.com/@user/video/7212345678901234567")).toBe(true);
    expect(isTikTokUrl("https://tiktok.com/@user/video/7212345678901234567")).toBe(true);
    expect(isTikTokUrl("https://m.tiktok.com/@user/video/7212345678901234567")).toBe(true);
  });

  it("accepts short-link hosts", () => {
    expect(isTikTokUrl("https://vm.tiktok.com/ZMabcdefg/")).toBe(true);
    expect(isTikTokUrl("https://vt.tiktok.com/ZSabcdefg/")).toBe(true);
  });

  it("rejects a host that only ends the same way", () => {
    // The registerable domain here is evil.com, not tiktok.com.
    expect(isTikTokUrl("https://tiktok.com.evil.com/@user/video/7212345678901234567")).toBe(false);
    expect(isTikTokUrl("https://www.tiktok.com.evil.com/video/123")).toBe(false);
  });

  it("rejects a host that only starts the same way", () => {
    expect(isTikTokUrl("https://tiktok.com.co/@user/video/123")).toBe(false);
    expect(isTikTokUrl("https://eviltiktok.com/@user/video/123")).toBe(false);
    expect(isTikTokUrl("https://faketiktok.com/video/123")).toBe(false);
  });

  it("rejects an unrelated host that merely mentions tiktok in the path or query", () => {
    expect(isTikTokUrl("https://evil.example/tiktok.com/video/123")).toBe(false);
    expect(isTikTokUrl("https://evil.example/?next=https://www.tiktok.com/video/123")).toBe(false);
  });

  it("rejects http, which TikTok never serves and which would persist as mixed content", () => {
    expect(isTikTokUrl("http://www.tiktok.com/@user/video/7212345678901234567")).toBe(false);
  });

  it("rejects non-http schemes and malformed input", () => {
    expect(isTikTokUrl("javascript:alert(1)")).toBe(false);
    expect(isTikTokUrl("data:text/html,<script>alert(1)</script>")).toBe(false);
    expect(isTikTokUrl("/@user/video/123")).toBe(false);
    expect(isTikTokUrl("")).toBe(false);
  });

  it("ignores hostname casing", () => {
    expect(isTikTokUrl("https://WWW.TikTok.COM/@user/video/7212345678901234567")).toBe(true);
  });
});

describe("extractTikTokVideoId", () => {
  it("pulls the id out of a canonical URL", () => {
    expect(extractTikTokVideoId("https://www.tiktok.com/@user/video/7212345678901234567")).toBe(
      "7212345678901234567",
    );
  });

  it("survives query strings and trailing segments", () => {
    expect(extractTikTokVideoId("https://www.tiktok.com/@user/video/7212345678901234567?is_from=1")).toBe(
      "7212345678901234567",
    );
  });

  it("returns null for short links, which carry no id until they redirect", () => {
    expect(extractTikTokVideoId("https://vm.tiktok.com/ZMabcdefg/")).toBeNull();
  });

  it("refuses to parse an id out of an untrusted host", () => {
    // A numeric /video/<id> path on someone else's domain is not a TikTok id.
    expect(extractTikTokVideoId("https://evil.example/video/7212345678901234567")).toBeNull();
    expect(extractTikTokVideoId("https://tiktok.com.evil.com/video/7212345678901234567")).toBeNull();
  });
});
