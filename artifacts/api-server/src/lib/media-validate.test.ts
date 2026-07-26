import { describe, it, expect } from "vitest";
import { isAllowedImageType, MAX_IMAGE_BYTES, buildMediaUrl } from "./media-validate";

describe("isAllowedImageType", () => {
  it("accepts common image content types", () => {
    expect(isAllowedImageType("image/jpeg")).toBe(true);
    expect(isAllowedImageType("image/png")).toBe(true);
    expect(isAllowedImageType("image/webp")).toBe(true);
    expect(isAllowedImageType("image/gif")).toBe(true);
  });

  it("rejects video and other content types", () => {
    expect(isAllowedImageType("video/mp4")).toBe(false);
    expect(isAllowedImageType("text/html")).toBe(false);
    expect(isAllowedImageType("")).toBe(false);
  });
});

/**
 * Regression: production first returned an http:// URL here, because Render
 * terminates TLS at its edge and req.protocol is "http" behind it. The URL is
 * stored in post_media.url and rendered inside an https:// page, so every
 * uploaded image was blocked as mixed content — and the broken URL was
 * already persisted by the time anyone noticed.
 */
describe("buildMediaUrl", () => {
  it("uses https in production, whatever the request scheme was", () => {
    expect(buildMediaUrl("safarly-api.onrender.com", "abc-123", true)).toBe(
      "https://safarly-api.onrender.com/api/media/file/abc-123",
    );
  });

  it("uses http locally, where there is no TLS to terminate", () => {
    expect(buildMediaUrl("localhost:8080", "abc-123", false)).toBe(
      "http://localhost:8080/api/media/file/abc-123",
    );
  });

  it("never emits an http URL in production", () => {
    expect(buildMediaUrl("example.com", "id", true).startsWith("https://")).toBe(true);
  });
});

describe("MAX_IMAGE_BYTES", () => {
  it("is a sane positive cap", () => {
    expect(MAX_IMAGE_BYTES).toBeGreaterThan(0);
    expect(MAX_IMAGE_BYTES).toBeLessThanOrEqual(10 * 1024 * 1024);
  });
});
