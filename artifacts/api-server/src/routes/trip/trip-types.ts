/**
 * Mirrors the matching exported interfaces in artifacts/safarly/src/lib/engine.ts
 * (TransportLeg, ArrivalTransport, TripEvent, AccommodationOption). Kept in
 * sync by convention and cross-reference comment, not by import — the two
 * packages don't share a types package for this domain, the same situation
 * vision.ts's ALLERGEN_TOKENS is already in with lens.tsx's ALLERGEN_KEYS.
 * Change one side, change the other.
 */
import { Type } from "@google/genai";

export interface TransportLeg {
  from: string;
  to: string;
  mode: "flight" | "train" | "bus" | "taxi" | "ride_hail" | "walk" | "car_rental";
  durationMinutes: number;
  costSar: number;
  notes?: string;
  uncertain: boolean;
}

export interface ArrivalTransport {
  legs: TransportLeg[];
  summary: string;
}

export interface DayTransport {
  dayNumber: number;
  legs: TransportLeg[];
}

export interface TripEvent {
  name: string;
  nameTranslated?: string;
  description: string;
  category: string;
  dateRange: string;
  venue?: string;
  overlapsTrip: boolean;
  uncertain: boolean;
  sourceHint?: string;
}

export interface AccommodationOption {
  area: string;
  areaTranslated?: string;
  whyThisArea: string;
  hotelType: string;
  nightlyCostSarLow: number;
  nightlyCostSarHigh: number;
  goodFor: string;
}

/** POST /api/trip/generate request body. */
export interface TripGenerateRequest {
  cityDisplayName: string;
  cityDisplayNameAr?: string;
  dateStart: string;
  dateEnd: string;
  budgetSarPerDay: number;
  travelType: string;
  languageName: string;
  days: { dayNumber: number; stopNames: string[] }[];
  poiAreas: string[];
}

export interface TripGenerateResult {
  events: TripEvent[];
  arrival: ArrivalTransport;
  dayTransport: DayTransport[];
  accommodation: AccommodationOption[];
}

/**
 * Each sub-agent returns this rather than throwing, so one agent's failure
 * (a Gemini timeout, a malformed response) never takes down the other two —
 * trip generation degrading to "2 of 3 enrichments landed" beats the whole
 * request failing because one call had a bad day.
 */
export type AgentOutcome<T> = { ok: true; data: T } | { ok: false; error: string };

const transportLegSchema = {
  type: Type.OBJECT,
  properties: {
    from: { type: Type.STRING },
    to: { type: Type.STRING },
    mode: {
      type: Type.STRING,
      enum: ["flight", "train", "bus", "taxi", "ride_hail", "walk", "car_rental"],
    },
    durationMinutes: { type: Type.NUMBER },
    costSar: { type: Type.NUMBER },
    notes: { type: Type.STRING },
    uncertain: { type: Type.BOOLEAN },
  },
  required: ["from", "to", "mode", "durationMinutes", "costSar", "uncertain"],
};

export const arrivalSchema = {
  type: Type.OBJECT,
  properties: {
    legs: { type: Type.ARRAY, items: transportLegSchema },
    summary: { type: Type.STRING, description: "One sentence overall arrival recommendation" },
  },
  required: ["legs", "summary"],
};

export const dayTransportSchema = {
  type: Type.OBJECT,
  properties: {
    days: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          dayNumber: { type: Type.NUMBER },
          legs: { type: Type.ARRAY, items: transportLegSchema },
        },
        required: ["dayNumber", "legs"],
      },
    },
  },
  required: ["days"],
};

export const eventsSchema = {
  type: Type.OBJECT,
  properties: {
    events: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          name: { type: Type.STRING },
          nameTranslated: { type: Type.STRING },
          description: { type: Type.STRING },
          category: {
            type: Type.STRING,
            description: "e.g. festival, exhibition, concert, sports, seasonal, religious",
          },
          dateRange: { type: Type.STRING, description: "Human-readable, e.g. 'Oct - Mar' or 'check official dates'" },
          venue: { type: Type.STRING },
          overlapsTrip: { type: Type.BOOLEAN },
          uncertain: {
            type: Type.BOOLEAN,
            description: "True unless you are confident this runs on these exact dates. Default to true — you have no live calendar access.",
          },
          sourceHint: { type: Type.STRING, description: "The official program name, if any, so the traveller can search for it" },
        },
        required: ["name", "description", "category", "dateRange", "overlapsTrip", "uncertain"],
      },
    },
  },
  required: ["events"],
};

export const accommodationSchema = {
  type: Type.OBJECT,
  properties: {
    accommodation: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          area: { type: Type.STRING },
          areaTranslated: { type: Type.STRING },
          whyThisArea: { type: Type.STRING, description: "Tie explicitly to the traveller's actual itinerary stops" },
          hotelType: { type: Type.STRING, description: "e.g. budget, mid-range, luxury, boutique, family-friendly" },
          nightlyCostSarLow: { type: Type.NUMBER },
          nightlyCostSarHigh: { type: Type.NUMBER },
          goodFor: { type: Type.STRING },
        },
        required: [
          "area",
          "whyThisArea",
          "hotelType",
          "nightlyCostSarLow",
          "nightlyCostSarHigh",
          "goodFor",
        ],
      },
    },
  },
  required: ["accommodation"],
};
