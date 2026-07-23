import { describe, it, expect } from "vitest";
import { validateChatRequest } from "./chat-validate";

/**
 * The concierge chat validator bounds history and message length and drops
 * malformed turns/days rather than rejecting the whole request over one bad
 * entry — a long conversation with one corrupt turn should still go through.
 */
describe("validateChatRequest", () => {
  const ok = {
    message: "make day 2 lighter", history: [], languageName: "English",
    cityDisplayName: "Riyadh", dateStart: "2026-08-10", dateEnd: "2026-08-13",
    days: [{ dayNumber: 1, stops: [{ id: "a", name: "A", category: "heritage", durationHrs: 1, hiddenGem: false }] }],
    candidatePois: [{ id: "x", name: "X", category: "heritage", durationHrs: 1, hiddenGem: false }],
  };

  it("accepts a well-formed request", () => {
    expect(validateChatRequest(ok)).toMatchObject({ message: "make day 2 lighter", cityDisplayName: "Riyadh" });
  });

  it("rejects an empty message", () => {
    expect(validateChatRequest({ ...ok, message: "   " })).toBeNull();
  });

  it("rejects when days or candidatePois isn't an array", () => {
    expect(validateChatRequest({ ...ok, days: "nope" })).toBeNull();
    expect(validateChatRequest({ ...ok, candidatePois: null })).toBeNull();
  });

  it("keeps only well-formed history turns", () => {
    const parsed = validateChatRequest({
      ...ok,
      history: [
        { role: "user", text: "hi" },
        { role: "captain", text: "bad role" },
        { role: "model", text: "hello" },
      ],
    });
    expect(parsed!.history).toHaveLength(2);
  });

  it("truncates history to a bounded number of turns", () => {
    const many = Array.from({ length: 60 }, () => ({ role: "user" as const, text: "hi" }));
    expect(validateChatRequest({ ...ok, history: many })!.history.length).toBeLessThanOrEqual(30);
  });

  it("clamps an over-long message", () => {
    expect(validateChatRequest({ ...ok, message: "x".repeat(5000) })!.message.length).toBeLessThanOrEqual(1000);
  });
});
