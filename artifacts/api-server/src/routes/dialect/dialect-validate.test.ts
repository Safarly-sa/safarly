import { describe, it, expect } from "vitest";
import { validateEvaluateRequest, validateDialogueRequest } from "./dialect-validate";

/**
 * Validators are the trust boundary for the dialect routes — everything past
 * them assumes a well-formed request. These pin the rejections (bad dialect,
 * empty attempt) and the defaulting (languageName -> English).
 */
describe("validateEvaluateRequest", () => {
  const ok = {
    dialect: "najdi", targetArabic: "يا هلا", targetTransliteration: "ya hala",
    targetEnglish: "Welcome", userAttempt: "ya hala", languageName: "English",
  };

  it("accepts a well-formed request", () => {
    expect(validateEvaluateRequest(ok)).toMatchObject({ dialect: "najdi", userAttempt: "ya hala" });
  });

  it("rejects an unknown dialect", () => {
    expect(validateEvaluateRequest({ ...ok, dialect: "cockney" })).toBeNull();
  });

  it("rejects an empty attempt (nothing to evaluate)", () => {
    expect(validateEvaluateRequest({ ...ok, userAttempt: "   " })).toBeNull();
  });

  it("rejects a missing target phrase", () => {
    expect(validateEvaluateRequest({ ...ok, targetArabic: "" })).toBeNull();
  });

  it("defaults languageName to English when absent", () => {
    const { languageName, ...rest } = ok;
    void languageName;
    expect(validateEvaluateRequest(rest)?.languageName).toBe("English");
  });

  it("rejects non-object bodies", () => {
    expect(validateEvaluateRequest(null)).toBeNull();
    expect(validateEvaluateRequest("nope")).toBeNull();
  });
});

describe("validateDialogueRequest", () => {
  it("accepts a well-formed request", () => {
    expect(validateDialogueRequest({ dialect: "hijazi", situation: "ordering coffee", languageName: "French" }))
      .toMatchObject({ dialect: "hijazi", situation: "ordering coffee", languageName: "French" });
  });

  it("rejects an unknown dialect and an empty situation", () => {
    expect(validateDialogueRequest({ dialect: "klingon", situation: "x", languageName: "English" })).toBeNull();
    expect(validateDialogueRequest({ dialect: "hijazi", situation: "  ", languageName: "English" })).toBeNull();
  });
});
