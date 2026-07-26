import { describe, it, expect } from "vitest";
import { extractTikTokId } from "./tiktok";

describe("extractTikTokId", () => {
  it("extracts the numeric id from a standard TikTok URL", () => {
    expect(extractTikTokId("https://www.tiktok.com/@safari_adventures/video/7123456789012345678"))
      .toBe("7123456789012345678");
  });

  it("returns null for a malformed URL with no /video/ segment", () => {
    expect(extractTikTokId("https://www.tiktok.com/@safari_adventures")).toBeNull();
  });

  it("returns null for a non-numeric video segment", () => {
    expect(extractTikTokId("https://www.tiktok.com/@x/video/abc")).toBeNull();
  });

  it("returns null for an empty string", () => {
    expect(extractTikTokId("")).toBeNull();
  });
});
