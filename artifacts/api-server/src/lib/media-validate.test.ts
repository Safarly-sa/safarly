import { describe, it, expect } from "vitest";
import { isAllowedImageType, MAX_IMAGE_BYTES } from "./media-validate";

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

describe("MAX_IMAGE_BYTES", () => {
  it("is a sane positive cap", () => {
    expect(MAX_IMAGE_BYTES).toBeGreaterThan(0);
    expect(MAX_IMAGE_BYTES).toBeLessThanOrEqual(10 * 1024 * 1024);
  });
});
