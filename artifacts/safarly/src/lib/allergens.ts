/**
 * The one place allergen vocabulary is defined.
 *
 * There were two forms in circulation, written to the same `safarly_profile.allergies`
 * field by different screens:
 *
 *   profile-setup.tsx (onboarding)  ->  ["ob.allergy.nuts"]   translation keys
 *   profile.tsx       (editor)      ->  ["nuts"]              bare tokens
 *
 * Live Lens compares against `dish.common_allergens`, which uses bare tokens, so
 * anyone who set their allergies during onboarding and never re-saved from the
 * profile editor got NO allergy warnings — silently, with the UI showing no
 * prompt to complete setup. That is a safety bug, not a cosmetic one.
 *
 * Canonical form is the bare token. `normaliseAllergens` accepts either form so
 * profiles already saved in the old shape are repaired on read, without needing
 * a migration step.
 */

export const ALLERGEN_TOKENS = [
  "nuts",
  "dairy",
  "gluten",
  "sesame",
  "eggs",
  "shellfish",
] as const;

export type AllergenToken = (typeof ALLERGEN_TOKENS)[number];

/** Token -> i18n key, for rendering a label. */
export const ALLERGEN_LABEL_KEYS: Record<AllergenToken, string> = {
  nuts: "ob.allergy.nuts",
  dairy: "ob.allergy.dairy",
  gluten: "ob.allergy.gluten",
  sesame: "ob.allergy.sesame",
  eggs: "ob.allergy.eggs",
  shellfish: "ob.allergy.shellfish",
};

/** i18n key -> token, the inverse of ALLERGEN_LABEL_KEYS. */
export const ALLERGEN_KEY_TO_TOKEN: Record<string, AllergenToken> = Object.fromEntries(
  ALLERGEN_TOKENS.map((token) => [ALLERGEN_LABEL_KEYS[token], token]),
) as Record<string, AllergenToken>;

const KEY_TO_TOKEN = ALLERGEN_KEY_TO_TOKEN;

function isToken(value: string): value is AllergenToken {
  return (ALLERGEN_TOKENS as readonly string[]).includes(value);
}

/**
 * Coerces a stored allergy list into canonical tokens, accepting both the
 * legacy `ob.allergy.*` keys and bare tokens. Unknown entries are dropped
 * rather than passed through — an unrecognised value can never match a dish,
 * so keeping it would only make the list look longer than it is.
 */
export function normaliseAllergens(raw: unknown): AllergenToken[] {
  if (!Array.isArray(raw)) return [];

  const out: AllergenToken[] = [];
  for (const entry of raw) {
    if (typeof entry !== "string") continue;
    const token = isToken(entry) ? entry : KEY_TO_TOKEN[entry];
    if (token && !out.includes(token)) out.push(token);
  }
  return out;
}

/** Reads the signed-in user's allergies from their stored profile. */
export function readStoredAllergens(): AllergenToken[] {
  try {
    const profile = JSON.parse(localStorage.getItem("safarly_profile") ?? "{}");
    return normaliseAllergens(profile?.allergies);
  } catch {
    return [];
  }
}
