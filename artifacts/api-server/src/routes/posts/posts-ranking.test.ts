import { describe, it, expect } from "vitest";
import { parseRankingQuery, DEFAULT_LIMIT, MAX_LIMIT } from "./posts-ranking";

/**
 * `limit` reaches a LIMIT clause, so the clamp is the point of these — an
 * uncapped value turns one public GET into a full-table read.
 */
describe("parseRankingQuery", () => {
  it("defaults an absent query", () => {
    expect(parseRankingQuery(undefined)).toEqual({ city: null, limit: DEFAULT_LIMIT });
    expect(parseRankingQuery({})).toEqual({ city: null, limit: DEFAULT_LIMIT });
  });

  it("caps limit at the maximum", () => {
    expect(parseRankingQuery({ limit: "5000" }).limit).toBe(MAX_LIMIT);
    expect(parseRankingQuery({ limit: String(MAX_LIMIT + 1) }).limit).toBe(MAX_LIMIT);
  });

  it("falls back to the default rather than rejecting a malformed limit", () => {
    // These reads are public and cheap; a stray query string should not turn
    // into an empty page.
    for (const limit of ["abc", "", "0", "-10", "NaN"]) {
      expect(parseRankingQuery({ limit }).limit).toBe(DEFAULT_LIMIT);
    }
  });

  it("ignores a non-string limit", () => {
    expect(parseRankingQuery({ limit: 25 }).limit).toBe(DEFAULT_LIMIT);
    expect(parseRankingQuery({ limit: ["10"] }).limit).toBe(DEFAULT_LIMIT);
  });

  it("accepts a valid limit", () => {
    expect(parseRankingQuery({ limit: "7" }).limit).toBe(7);
  });

  it("lowercases city to match how posts-validate stores it", () => {
    expect(parseRankingQuery({ city: "Riyadh" }).city).toBe("riyadh");
    expect(parseRankingQuery({ city: "  AL_KHOBAR  " }).city).toBe("al_khobar");
  });

  it("treats a blank city as all cities", () => {
    // Null must mean "no filter", never a city literally named "null".
    expect(parseRankingQuery({ city: "   " }).city).toBeNull();
    expect(parseRankingQuery({ city: "" }).city).toBeNull();
    expect(parseRankingQuery({ city: 42 }).city).toBeNull();
  });

  it("caps an absurdly long city", () => {
    expect(parseRankingQuery({ city: "x".repeat(500) }).city?.length).toBe(80);
  });

  it("passes an unknown city through rather than rejecting it", () => {
    // It simply matches no rows — the same answer as a real city with no
    // stories yet, and it keeps the route free of a second city allowlist that
    // would drift from the engine's.
    expect(parseRankingQuery({ city: "atlantis" }).city).toBe("atlantis");
  });
});
