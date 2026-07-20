/** Shared between vision.ts (real calls) and vision-fixtures.ts (demo mode). */
export const MODES = ["menu", "place", "sign"] as const;
export type Mode = (typeof MODES)[number];
