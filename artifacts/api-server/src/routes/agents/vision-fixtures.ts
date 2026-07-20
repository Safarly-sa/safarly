/**
 * Canned responses for demo mode. Shape must stay identical to what the real
 * Gemini call returns (see the schemas in vision.ts) — the frontend cannot
 * tell which source it got, by design, so a shape drift here is a shape drift
 * in production too.
 *
 * Two variants per mode, chosen deterministically from the uploaded image
 * rather than randomly, so a demo walkthrough is repeatable: same photo,
 * same result, on every run.
 */
import type { Mode } from "./vision-types";

function pickVariant<T>(imageBase64: string, variants: readonly T[]): T {
  // Cheap, non-cryptographic — this only needs to be stable, not unpredictable.
  let hash = 0;
  const sampleLength = Math.min(imageBase64.length, 256);
  for (let i = 0; i < sampleLength; i++) {
    hash = (hash * 31 + imageBase64.charCodeAt(i)) | 0;
  }
  return variants[Math.abs(hash) % variants.length];
}

const MENU_VARIANTS = [
  {
    dishes: [
      {
        nameOriginal: "كبسة دجاج",
        nameTranslated: "Chicken Kabsa",
        description: "Spiced rice with slow-cooked chicken, dried lime, and toasted nuts.",
        ingredients: ["rice", "chicken", "dried lime", "cashews", "ghee"],
        allergenTokens: ["nuts", "dairy"],
        uncertain: false,
        priceText: "SAR 32",
      },
      {
        nameOriginal: "فتوش",
        nameTranslated: "Fattoush Salad",
        description: "Mixed greens with crisp fried bread, sumac, and pomegranate molasses.",
        ingredients: ["lettuce", "tomato", "fried pita", "sumac", "olive oil"],
        allergenTokens: ["gluten"],
        uncertain: false,
        priceText: "SAR 18",
      },
      {
        nameOriginal: "مطبق روبيان",
        nameTranslated: "Shrimp Mutabbaq",
        description: "Folded pastry stuffed with spiced shrimp and onion, pan-fried.",
        ingredients: ["shrimp", "wheat pastry", "egg", "onion", "spices"],
        allergenTokens: ["shellfish", "gluten", "eggs"],
        uncertain: false,
        priceText: "SAR 26",
      },
      {
        nameOriginal: "عصير تمر هندي",
        nameTranslated: "Tamarind Juice",
        description: "Chilled tamarind drink, lightly sweetened.",
        ingredients: ["tamarind", "sugar", "water"],
        allergenTokens: [],
        uncertain: true,
        priceText: "SAR 10",
      },
    ],
  },
  {
    dishes: [
      {
        nameOriginal: "مندي لحم",
        nameTranslated: "Lamb Mandi",
        description: "Pit-smoked lamb over saffron rice, served with tomato-chili sauce.",
        ingredients: ["lamb", "rice", "saffron", "tomato", "chili"],
        allergenTokens: [],
        uncertain: false,
        priceText: "SAR 45",
      },
      {
        nameOriginal: "حمص بالطحينة",
        nameTranslated: "Hummus with Tahini",
        description: "Blended chickpeas with tahini, lemon, and olive oil.",
        ingredients: ["chickpeas", "tahini (sesame)", "lemon", "olive oil"],
        allergenTokens: ["sesame"],
        uncertain: false,
        priceText: "SAR 14",
      },
      {
        nameOriginal: "كنافة بالجبن",
        nameTranslated: "Cheese Kunafa",
        description: "Crisp shredded pastry over sweet white cheese, soaked in syrup.",
        ingredients: ["kataifi pastry", "white cheese", "sugar syrup", "pistachio"],
        allergenTokens: ["dairy", "gluten", "nuts"],
        uncertain: false,
        priceText: "SAR 22",
      },
    ],
  },
] as const;

const PLACE_VARIANTS = [
  {
    name: "Al-Masmak Fortress",
    nameTranslated: "Al-Masmak Fortress",
    category: "heritage",
    culturalContext:
      "This clay-and-mudbrick fort marks the site of the 1902 raid that began the founding of modern Saudi Arabia. The spearhead still lodged in the main gate is original.",
    visitorTip: "Visit late afternoon — the courtyard is unshaded and midday sun is intense.",
    uncertain: false,
  },
  {
    name: "Elephant Rock, AlUla",
    nameTranslated: "Elephant Rock (Jabal AlFil)",
    category: "nature",
    culturalContext:
      "Wind erosion over millions of years carved this sandstone formation into its distinctive shape. It sits along AlUla's ancient caravan routes.",
    visitorTip: "Best light for photos is just before sunset.",
    uncertain: false,
  },
] as const;

const SIGN_VARIANTS = [
  {
    lines: [
      { original: "ممنوع التدخين", translated: "No smoking" },
      { original: "يرجى الحفاظ على النظافة", translated: "Please keep the area clean" },
    ],
    meaning: "This is a no-smoking zone; visitors are asked to dispose of litter properly.",
    uncertain: false,
  },
  {
    lines: [
      { original: "الطريق مغلق للصيانة", translated: "Road closed for maintenance" },
      { original: "استخدم الطريق البديل", translated: "Use the alternate route" },
    ],
    meaning: "The road ahead is closed; follow the posted detour.",
    uncertain: false,
  },
] as const;

export function fixtureFor(mode: Mode, imageBase64: string): unknown {
  switch (mode) {
    case "menu":
      return pickVariant(imageBase64, MENU_VARIANTS);
    case "place":
      return pickVariant(imageBase64, PLACE_VARIANTS);
    case "sign":
      return pickVariant(imageBase64, SIGN_VARIANTS);
  }
}
