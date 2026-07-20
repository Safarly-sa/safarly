/**
 * Nationality → home-currency display for the trip planner's budget slider.
 *
 * The app has no backend and no live FX feed, so conversions are a static
 * approximation for a rough sense of scale only — never for anything
 * transactional. Trip data, the generation engine, and all stored values stay
 * canonical in SAR; this file only affects what the slider *displays*.
 *
 * To refresh the rates: edit RATE_PER_SAR below. Last reviewed: 2026-07.
 */

import { normaliseNationality } from "./nationalities";

// ISO 3166-1 alpha-2 country code (the canonical form of
// safarly_profile.nationality — see lib/nationalities.ts) → ISO 4217
// currency code.
export const COUNTRY_CURRENCY: Record<string, string> = {
  AF: "AFN", DZ: "DZD", AR: "ARS", AU: "AUD",
  AT: "EUR", AZ: "AZN", BD: "BDT", BE: "EUR",
  BR: "BRL", CA: "CAD", CN: "CNY", CZ: "CZK",
  EG: "EGP", ET: "ETB", FR: "EUR", DE: "EUR", GH: "GHS",
  IN: "INR", ID: "IDR", IR: "IRR", IQ: "IQD", IT: "EUR",
  JP: "JPY", JO: "JOD", KZ: "KZT", KE: "KES", KW: "KWD",
  LB: "LBP", LY: "LYD", MY: "MYR", MX: "MXN", MA: "MAD",
  NP: "NPR", NL: "EUR", NG: "NGN", NO: "NOK", OM: "OMR",
  PK: "PKR", PH: "PHP", PL: "PLN", PT: "EUR",
  QA: "QAR", RO: "RON", RU: "RUB", SA: "SAR",
  SG: "SGD", ZA: "ZAR", KR: "KRW", ES: "EUR",
  LK: "LKR", SD: "SDG", SE: "SEK", CH: "CHF",
  TH: "THB", TN: "TND", TR: "TRY", AE: "AED", UA: "UAH",
  GB: "GBP", US: "USD", UZ: "UZS",
  VN: "VND", YE: "YER",
};

/**
 * ── Single place to update exchange rates ──────────────────────────────
 * Approximate units of currency per 1 SAR. This is a static snapshot, not a
 * live feed — update the numbers here (and the "Last reviewed" date in the
 * file header above) to refresh them. Derived from illustrative USD cross
 * rates at review time; some currencies (IRR, YER, LBP, SDG, ARS) trade at
 * multiple real-world rates depending on market/region, so treat all of these
 * as an order-of-magnitude approximation, never an exact quote.
 */
const RATE_PER_SAR: Record<string, number> = {
  SAR: 1,
  AFN: 18.9,    DZD: 35.87,   ARS: 266.7,   AUD: 0.405,   EUR: 0.247,
  AZN: 0.4534,  BDT: 31.2,    BRL: 1.52,    CAD: 0.3654,  CNY: 1.933,
  CZK: 6.213,   EGP: 13.07,   ETB: 32.8,    GHS: 4.13,    INR: 22.2,
  IDR: 4213,    IRR: 11201,   IQD: 349.4,   JPY: 41.3,    JOD: 0.189,
  KZT: 118.7,   KES: 34.4,    KWD: 0.0819,  LBP: 23873,   LYD: 1.293,
  MYR: 1.192,   MXN: 4.53,    MAD: 2.653,   NPR: 35.6,    NGN: 413.4,
  NOK: 2.907,   OMR: 0.1027,  PKR: 74.1,    PHP: 15.66,   PLN: 1.067,
  QAR: 0.971,   RON: 1.227,   RUB: 24.53,   SGD: 0.36,    ZAR: 4.88,
  KRW: 365.4,   LKR: 80.0,    SDG: 160,     SEK: 2.827,   CHF: 0.2347,
  THB: 9.47,    TND: 0.827,   TRY: 8.667,   AED: 0.9794,  UAH: 10.91,
  GBP: 0.2107,  USD: 0.2667,  UZS: 3387,    VND: 6774,    YER: 400,
};

/** Resolves the ISO 4217 currency for a stored nationality, or null if the
    profile has no nationality or the country isn't in the map. Accepts a
    legacy full-name value too — it's normalised to a code first, so callers
    don't need to migrate the profile before reading it. */
export function currencyForNationality(nationality: string | undefined | null): string | null {
  if (!nationality) return null;
  const code = normaliseNationality(nationality);
  return code ? (COUNTRY_CURRENCY[code] ?? null) : null;
}

/** Converts a canonical SAR amount to the given currency. Approximate — see
    the file header. Falls back to the SAR amount unchanged for an unknown code. */
export function convertFromSAR(amountSAR: number, currency: string): number {
  const rate = RATE_PER_SAR[currency];
  return rate ? amountSAR * rate : amountSAR;
}

/** Locale-formatted currency string, e.g. "SAR 3,000" / "L£71,600". */
export function formatCurrencyAmount(amount: number, currency: string, locale: string): string {
  try {
    return new Intl.NumberFormat(locale, {
      style: "currency",
      currency,
      maximumFractionDigits: 0,
    }).format(Math.round(amount));
  } catch {
    return `${currency} ${Math.round(amount).toLocaleString(locale)}`;
  }
}

const DISPLAY_PREF_KEY = "safarly-currency-display";

/**
 * Device-scoped display preference — "home" shows the user's home currency
 * when one is available, anything else (including absent) shows SAR. This
 * mirrors safarly-theme / safarly-lang: a device preference, not account
 * data, so it is deliberately excluded from auth.ts's ACCOUNT_KEYS and
 * survives sign-out.
 */
export function getCurrencyDisplayPref(): "home" | "sar" {
  return localStorage.getItem(DISPLAY_PREF_KEY) === "home" ? "home" : "sar";
}

export function setCurrencyDisplayPref(pref: "home" | "sar"): void {
  localStorage.setItem(DISPLAY_PREF_KEY, pref);
}
