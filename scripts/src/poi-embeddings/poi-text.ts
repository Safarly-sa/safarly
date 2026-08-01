/**
 * Turns a POI row into the sentence we actually embed — in English, in Arabic,
 * or both.
 *
 * This is the part of the spike most worth arguing about. The concierge's real
 * questions are not "find Al-Masmak Fortress" — the id lookup already handles
 * that. They are "somewhere indoor for the kids after lunch", "a quiet hidden
 * gem, nothing expensive". Those match on the *boolean flags*, which a raw JSON
 * dump embeds badly: `"family_friendly": true` and `"family_friendly": false`
 * are nearly identical strings and land in nearly the same place in vector
 * space, which is the opposite of what we need.
 *
 * So the flags are rendered as natural-language phrases, and only the ones that
 * are true are emitted — absence carries the negative signal instead of a
 * near-identical "not family friendly" string sitting next to its opposite.
 *
 * ## On the Arabic variant
 *
 * Only 42 of 114 POIs have an Arabic *name* and 21 an Arabic culture note (see
 * `locales.ts`). Every POI's *attributes*, though, can be rendered in Arabic —
 * category, city, time slot, price, duration and the flags all come from
 * enumerable fields, and the app already ships Arabic for the city and category
 * vocabularies.
 *
 * That asymmetry drives the design: the Arabic passage is built for all 114
 * rows, falling back to the English name where no Arabic one exists. An
 * attribute query ("مكان مغلق للأطفال") can therefore reach the whole corpus,
 * while a name query only reaches the translated 42. Dropping the untranslated
 * rows instead would have made twelve cities unreachable in Arabic for *any*
 * query, which is much worse and would have looked like a model failure rather
 * than the data gap it is.
 */
import type { Poi } from "@workspace/poi-data";

import {
  arabicCategory,
  arabicCity,
  arabicCulture,
  arabicName,
} from "./locales";

export type TextVariant = "en" | "ar" | "bi";

export const TEXT_VARIANTS: TextVariant[] = ["en", "ar", "bi"];

// --- English ---------------------------------------------------------------

const PRICE_WORDS = [
  "free to enter, no ticket needed",
  "cheap, budget friendly",
  "moderately priced",
  "expensive, premium priced",
  "very expensive, luxury priced",
];

function priceWords(range: number): string {
  return PRICE_WORDS[Math.max(0, Math.min(PRICE_WORDS.length - 1, range))];
}

function durationWords(hrs: number): string {
  if (hrs <= 1) return "a quick stop, under an hour";
  if (hrs <= 2) return `about ${hrs} hours, a short visit`;
  if (hrs <= 4) return `about ${hrs} hours, a half-day visit`;
  return `about ${hrs} hours, most of a day`;
}

/** Human-readable city name from the dataset's snake_case city key. */
function cityWords(city: string): string {
  return city
    .split("_")
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}

export function poiToText(poi: Poi): string {
  const parts: string[] = [
    `${poi.name}, in ${cityWords(poi.city)}, Saudi Arabia.`,
    `Category: ${poi.category}.`,
    `Best visited in the ${poi.best_slot}.`,
    `${durationWords(poi.duration_hrs)}.`,
    `${priceWords(poi.price_range)}.`,
  ];

  // Positive-only. See the file comment for why the negatives are omitted.
  if (poi.hidden_gem) parts.push("A hidden gem, off the usual tourist trail.");
  if (poi.family_friendly) parts.push("Good for families and children.");
  if (poi.accessible) parts.push("Wheelchair accessible.");
  if (poi.indoor) {
    parts.push("Indoors, sheltered from the heat.");
  } else {
    // The one negative worth stating outright: Saudi summer makes outdoor vs
    // indoor a hard constraint, not a preference. The transport agent already
    // treats Jun–Sep as a distinct regime for the same reason.
    parts.push("Outdoors, exposed to the sun and heat.");
  }

  if (poi.culture_note) parts.push(poi.culture_note);

  return parts.join(" ");
}

// --- Arabic ----------------------------------------------------------------

const AR_PRICE_WORDS = [
  "الدخول مجاني، بدون تذكرة",
  "رخيص ومناسب للميزانية المحدودة",
  "بسعر متوسط",
  "غالي، أسعار مرتفعة",
  "غالي جداً، أسعار فاخرة",
];

/**
 * Time-of-day words are hardcoded here rather than read from `ar.json` — the
 * locale file has no `slot` key family, because the UI renders slots as clock
 * times rather than as words.
 */
const AR_SLOT_WORDS: Record<string, string> = {
  morning: "في الصباح",
  midday: "وقت الظهيرة",
  afternoon: "بعد الظهر",
  evening: "في المساء",
};

function arPriceWords(range: number): string {
  return AR_PRICE_WORDS[Math.max(0, Math.min(AR_PRICE_WORDS.length - 1, range))];
}

function arDurationWords(hrs: number): string {
  if (hrs <= 1) return "زيارة سريعة، أقل من ساعة";
  if (hrs <= 2) return `حوالي ${hrs} ساعة، زيارة قصيرة`;
  if (hrs <= 4) return `حوالي ${hrs} ساعات، نصف يوم`;
  return `حوالي ${hrs} ساعات، معظم اليوم`;
}

/** True when this POI's Arabic passage still carries an English name. */
export function arabicNameIsFallback(poi: Poi): boolean {
  return !arabicName(poi.id);
}

export function poiToArabicText(poi: Poi): string {
  // Falls back to the English name so the row stays reachable by attribute
  // queries. `arabicNameIsFallback` lets the eval separate these rows out.
  const name = arabicName(poi.id) ?? poi.name;

  const parts: string[] = [
    `${name}، في ${arabicCity(poi.city)}، السعودية.`,
    `التصنيف: ${arabicCategory(poi.category)}.`,
    `أفضل وقت للزيارة ${AR_SLOT_WORDS[poi.best_slot] ?? poi.best_slot}.`,
    `${arDurationWords(poi.duration_hrs)}.`,
    `${arPriceWords(poi.price_range)}.`,
  ];

  if (poi.hidden_gem)
    parts.push("جوهرة مخفية، بعيدة عن المسارات السياحية المعتادة.");
  if (poi.family_friendly) parts.push("مناسب للعائلات والأطفال.");
  if (poi.accessible) parts.push("مهيأ لذوي الاحتياجات الخاصة والكراسي المتحركة.");
  parts.push(
    poi.indoor
      ? "مكان مغلق، محمي من حرارة الجو."
      : "مكان مفتوح في الهواء الطلق، معرض للشمس والحرارة.",
  );

  const culture = arabicCulture(poi.id);
  if (culture) parts.push(culture);

  return parts.join(" ");
}

// --- Bilingual -------------------------------------------------------------

/**
 * English passage followed by the Arabic one, embedded as a single vector.
 *
 * The cheap option: one index, one vector per POI, works for queries in either
 * language without having to detect which language the query is in. The risk is
 * dilution — half the vector's budget is spent on the language the query isn't
 * in, which can pull every row toward a common "bilingual travel text" region
 * and flatten the ranking.
 *
 * Whether that risk is real is exactly what the eval measures, which is why all
 * three variants get built rather than one being picked up front.
 */
export function poiToBilingualText(poi: Poi): string {
  return `${poiToText(poi)}\n${poiToArabicText(poi)}`;
}

export function buildText(poi: Poi, variant: TextVariant): string {
  switch (variant) {
    case "en":
      return poiToText(poi);
    case "ar":
      return poiToArabicText(poi);
    case "bi":
      return poiToBilingualText(poi);
  }
}
