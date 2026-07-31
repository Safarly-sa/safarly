import { describe, it, expect } from "vitest";
import { parseOEmbedResponse } from "./tiktok-oembed";

/**
 * The parsing half is split from the fetch so these run without a network
 * call. The thumbnail rule is the one with teeth: the value is persisted to
 * `post_media.thumbnail_url` and later rendered as an `<img src>` inside an
 * https page, so an http URL stored here is blocked as mixed content and stays
 * broken long after the request that wrote it — the same persisted-breakage
 * failure `buildMediaUrl` exists to prevent.
 */
describe("parseOEmbedResponse", () => {
  const valid = {
    thumbnail_url: "https://p16.tiktokcdn.com/obj/abc123",
    author_name: "riyadh_eats",
    title: "Best kabsa in Riyadh",
  };

  it("maps a well-formed oEmbed body", () => {
    expect(parseOEmbedResponse(valid)).toEqual({
      thumbnailUrl: "https://p16.tiktokcdn.com/obj/abc123",
      authorName: "riyadh_eats",
      title: "Best kabsa in Riyadh",
    });
  });

  it("drops an http thumbnail rather than persisting mixed content", () => {
    const parsed = parseOEmbedResponse({ ...valid, thumbnail_url: "http://p16.tiktokcdn.com/obj/x" });
    expect(parsed?.thumbnailUrl).toBeNull();
    // The rest of the metadata is still worth keeping.
    expect(parsed?.authorName).toBe("riyadh_eats");
  });

  it("drops a malformed thumbnail URL", () => {
    expect(parseOEmbedResponse({ ...valid, thumbnail_url: "not-a-url" })?.thumbnailUrl).toBeNull();
    expect(parseOEmbedResponse({ ...valid, thumbnail_url: "javascript:alert(1)" })?.thumbnailUrl).toBeNull();
  });

  it("accepts any https CDN host", () => {
    // TikTok rotates thumbnail CDN domains, so an allowlist here would break on
    // their infrastructure changes rather than on an attack.
    const parsed = parseOEmbedResponse({ ...valid, thumbnail_url: "https://p77-sign-va.tiktokcdn.com/x" });
    expect(parsed?.thumbnailUrl).toBe("https://p77-sign-va.tiktokcdn.com/x");
  });

  it("returns null when nothing usable came back", () => {
    // Distinct from "fetch succeeded but the video has no title" — the caller
    // stores nulls either way, but this keeps a row of empty strings from
    // looking like a successful capture.
    expect(parseOEmbedResponse({})).toBeNull();
    expect(parseOEmbedResponse({ thumbnail_url: "", author_name: "  ", title: "" })).toBeNull();
    expect(parseOEmbedResponse({ thumbnail_url: "http://insecure.example/x" })).toBeNull();
  });

  it("rejects non-object bodies", () => {
    expect(parseOEmbedResponse(null)).toBeNull();
    expect(parseOEmbedResponse("string")).toBeNull();
    expect(parseOEmbedResponse(undefined)).toBeNull();
  });

  it("ignores non-string fields instead of coercing them", () => {
    const parsed = parseOEmbedResponse({ ...valid, author_name: 12345, title: { a: 1 } });
    expect(parsed?.authorName).toBeNull();
    expect(parsed?.title).toBeNull();
    expect(parsed?.thumbnailUrl).toBe(valid.thumbnail_url);
  });

  it("caps absurdly long fields", () => {
    const parsed = parseOEmbedResponse({ ...valid, title: "x".repeat(5000) });
    expect(parsed?.title?.length).toBe(300);
  });
});
