import { describe, it, expect } from "vitest";
import { pois } from "@workspace/poi-data";
import { validateCreateRequest, validateUpdateRequest } from "./posts-validate";

describe("validateCreateRequest", () => {
  const ok = {
    title: "3 Days in AlUla",
    content: "Exploring AlUla was unforgettable...",
    city: "alula",
    poiIds: ["ula_hegra", "ula_hegra", "ula_elephant"],
    tags: ["Heritage", "Desert"],
    media: [{ type: "tiktok", url: "https://www.tiktok.com/@x/video/123", tiktokVideoId: "123" }],
  };

  it("accepts a well-formed request and dedupes poi ids", () => {
    const result = validateCreateRequest(ok);
    expect(result).toMatchObject({ title: ok.title, city: "alula" });
    expect(result?.poiIds).toEqual(["ula_hegra", "ula_elephant"]);
  });

  it("rejects a request with no media", () => {
    expect(validateCreateRequest({ ...ok, media: [] })).toBeNull();
  });

  it("caps an oversized media array at the limit", () => {
    const media = Array.from({ length: 50 }, (_, i) => ({
      type: "image" as const,
      url: `https://example.com/${i}.jpg`,
    }));
    const result = validateCreateRequest({ ...ok, media });
    expect(result?.media.length).toBe(12);
  });

  it("drops media items with an unknown type", () => {
    const result = validateCreateRequest({
      ...ok,
      media: [{ type: "pdf", url: "https://example.com/a.pdf" }, ...ok.media],
    });
    expect(result?.media).toHaveLength(1);
    expect(result?.media[0].type).toBe("tiktok");
  });

  it("caps an oversized poiIds array", () => {
    // Real ids, since unknown ones are now dropped before the cap applies.
    const poiIds = (pois as { id: string }[]).map((p) => p.id);
    expect(poiIds.length).toBeGreaterThan(30);
    const result = validateCreateRequest({ ...ok, poiIds });
    expect(result?.poiIds.length).toBe(30);
  });

  it("drops poi ids that name no real place", () => {
    // The picker only offers real places, but nothing stops a crafted request,
    // and a bogus id would be stored forever and silently vanish at render.
    const result = validateCreateRequest({
      ...ok,
      poiIds: ["ula_hegra", "not_a_real_place", "../../etc/passwd", ""],
    });
    expect(result?.poiIds).toEqual(["ula_hegra"]);
  });

  it("keeps the rest of the story when every poi id is bogus", () => {
    const result = validateCreateRequest({ ...ok, poiIds: ["nope", "also_nope"] });
    expect(result).not.toBeNull();
    expect(result?.poiIds).toEqual([]);
  });

  it("strips script tags from title and content", () => {
    const result = validateCreateRequest({
      ...ok,
      title: "Hello<script>alert(1)</script>World",
      content: "Body<script src=\"evil.js\"></script>text",
    });
    expect(result?.title).toBe("HelloWorld");
    expect(result?.content).toBe("Bodytext");
  });

  it("drops media whose url is not http(s)", () => {
    // story-detail renders a tiktok item's url as an anchor href, so a
    // javascript: URL here is stored XSS on click, not a cosmetic issue.
    const result = validateCreateRequest({
      ...ok,
      media: [
        { type: "tiktok", url: "javascript:alert(1)", tiktokVideoId: "123" },
        { type: "image", url: "data:text/html;base64,PHNjcmlwdD4=" },
        { type: "image", url: "/relative/path.jpg" },
        ...ok.media,
      ],
    });
    expect(result?.media).toHaveLength(1);
    expect(result?.media[0].url).toBe(ok.media[0].url);
  });

  it("rejects a request whose only media has an unsafe url", () => {
    expect(
      validateCreateRequest({
        ...ok,
        media: [{ type: "tiktok", url: "javascript:alert(1)", tiktokVideoId: "1" }],
      }),
    ).toBeNull();
  });

  it("rejects an empty title or content", () => {
    expect(validateCreateRequest({ ...ok, title: "   " })).toBeNull();
    expect(validateCreateRequest({ ...ok, content: "" })).toBeNull();
  });

  it("rejects non-object bodies", () => {
    expect(validateCreateRequest(null)).toBeNull();
    expect(validateCreateRequest("nope")).toBeNull();
  });
});

describe("validateUpdateRequest", () => {
  it("returns an empty patch for an empty body — nothing to change", () => {
    expect(validateUpdateRequest({})).toEqual({});
  });

  it("only includes fields that were supplied", () => {
    const result = validateUpdateRequest({ title: "New Title" });
    expect(result).toEqual({ title: "New Title" });
  });

  it("validates a supplied field by the same rules as create", () => {
    expect(validateUpdateRequest({ title: "   " })).toBeNull();
    expect(validateUpdateRequest({ city: "" })).toBeNull();
  });

  it("rejects a supplied media array that ends up empty after filtering", () => {
    expect(validateUpdateRequest({ media: [{ type: "pdf", url: "https://example.com/a.pdf" }] })).toBeNull();
  });

  it("validates and normalises a supplied media replacement", () => {
    const result = validateUpdateRequest({
      media: [{ type: "image", url: "https://example.com/a.jpg" }],
    });
    expect(result?.media).toHaveLength(1);
    expect(result?.media?.[0].url).toBe("https://example.com/a.jpg");
  });

  it("rejects non-object bodies", () => {
    expect(validateUpdateRequest(null)).toBeNull();
    expect(validateUpdateRequest("nope")).toBeNull();
  });
});
