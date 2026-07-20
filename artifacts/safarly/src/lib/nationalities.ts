/**
 * Canonical nationality data. ISO 3166-1 alpha-2 is the stored/canonical
 * value (`safarly_profile.nationality`) so it stays stable across UI
 * languages and other features — currently `lib/currency.ts` — can key off
 * it without caring how it's displayed.
 *
 * Display text (the demonym, e.g. "Lebanese") is never hardcoded here — it
 * lives in `nationality.<code>.demonym` in every locales/*.json file, keyed
 * by the lowercased code, following the same `<domain>.<id>.<field>`
 * convention as `dish.<id>.name` and `trip.city.<id>.title`.
 */

export interface NationalityOption {
  /** ISO 3166-1 alpha-2, uppercase. */
  code: string;
}

export const NATIONALITIES: NationalityOption[] = [
  { code: "AF" }, { code: "DZ" }, { code: "AR" }, { code: "AU" }, { code: "AT" }, { code: "AZ" },
  { code: "BD" }, { code: "BE" }, { code: "BR" }, { code: "CA" }, { code: "CN" }, { code: "CZ" },
  { code: "EG" }, { code: "ET" }, { code: "FR" }, { code: "DE" }, { code: "GH" }, { code: "IN" }, { code: "ID" },
  { code: "IR" }, { code: "IQ" }, { code: "IT" }, { code: "JP" }, { code: "JO" }, { code: "KZ" }, { code: "KE" }, { code: "KW" },
  { code: "LB" }, { code: "LY" }, { code: "MY" }, { code: "MX" }, { code: "MA" }, { code: "NP" }, { code: "NL" },
  { code: "NG" }, { code: "NO" }, { code: "OM" }, { code: "PK" }, { code: "PH" }, { code: "PL" }, { code: "PT" },
  { code: "QA" }, { code: "RO" }, { code: "RU" }, { code: "SA" }, { code: "SG" }, { code: "ZA" },
  { code: "KR" }, { code: "ES" }, { code: "LK" }, { code: "SD" }, { code: "SE" }, { code: "CH" },
  { code: "TH" }, { code: "TN" }, { code: "TR" }, { code: "AE" }, { code: "UA" }, { code: "GB" },
  { code: "US" }, { code: "UZ" }, { code: "VN" }, { code: "YE" },
];

const VALID_CODES = new Set(NATIONALITIES.map((n) => n.code));

/** Translation key for a nationality's localized demonym. */
export function demonymKey(code: string): string {
  return `nationality.${code.toLowerCase()}.demonym`;
}

/**
 * The nationality selector used to store the full English country name
 * (e.g. "Lebanon") instead of a code — see git history of profile-setup.tsx
 * and onboarding.tsx. Maps those exact legacy strings to their code so
 * profiles saved before the switch to codes still resolve correctly.
 */
const LEGACY_NAME_TO_CODE: Record<string, string> = {
  "Afghanistan": "AF", "Algeria": "DZ", "Argentina": "AR", "Australia": "AU",
  "Austria": "AT", "Azerbaijan": "AZ", "Bangladesh": "BD", "Belgium": "BE",
  "Brazil": "BR", "Canada": "CA", "China": "CN", "Czech Republic": "CZ",
  "Egypt": "EG", "Ethiopia": "ET", "France": "FR", "Germany": "DE", "Ghana": "GH",
  "India": "IN", "Indonesia": "ID", "Iran": "IR", "Iraq": "IQ", "Italy": "IT",
  "Japan": "JP", "Jordan": "JO", "Kazakhstan": "KZ", "Kenya": "KE", "Kuwait": "KW",
  "Lebanon": "LB", "Libya": "LY", "Malaysia": "MY", "Mexico": "MX", "Morocco": "MA",
  "Nepal": "NP", "Netherlands": "NL", "Nigeria": "NG", "Norway": "NO", "Oman": "OM",
  "Pakistan": "PK", "Philippines": "PH", "Poland": "PL", "Portugal": "PT",
  "Qatar": "QA", "Romania": "RO", "Russia": "RU", "Saudi Arabia": "SA",
  "Singapore": "SG", "South Africa": "ZA", "South Korea": "KR", "Spain": "ES",
  "Sri Lanka": "LK", "Sudan": "SD", "Sweden": "SE", "Switzerland": "CH",
  "Thailand": "TH", "Tunisia": "TN", "Turkey": "TR", "UAE": "AE", "Ukraine": "UA",
  "United Kingdom": "GB", "United States": "US", "Uzbekistan": "UZ",
  "Vietnam": "VN", "Yemen": "YE",
};

/**
 * Normalises a stored nationality value to an ISO code: passes a valid code
 * straight through, migrates a legacy full-name string, and otherwise
 * returns "" — an unset field is safer than silently keeping a bogus value
 * nothing else in the app can resolve.
 */
export function normaliseNationality(raw: unknown): string {
  if (typeof raw !== "string" || !raw) return "";
  const asCode = raw.toUpperCase();
  if (VALID_CODES.has(asCode)) return asCode;
  return LEGACY_NAME_TO_CODE[raw] ?? "";
}
