/**
 * The Safarly Smart Companion's capability roster.
 *
 * The Companion is a heading over existing tools rather than a new agent: Live
 * Lens, the Dialect coach and the Personal Concierge each keep their own route,
 * their own page and their own API client. This file only decides what the
 * Companion hub advertises and in what order.
 *
 * It is a data table on purpose. The roster is still growing, and adding the
 * next capability should be one entry here plus its two locale strings — not a
 * change to the hub's markup.
 *
 * `route` is where the card sends the traveller. Note that the Concierge has no
 * page of its own: it is a floating panel on the itinerary, so its card points
 * at /itinerary and carries a hint saying so. A capability whose home is inside
 * another page is normal here, not a special case.
 */
import { Camera, MessagesSquare, Mic, type LucideIcon } from "lucide-react";

export interface CompanionCapability {
  id: string;
  route: string;
  icon: LucideIcon;
  /** Locale keys, resolved by the hub — never put display text in this file. */
  titleKey: string;
  blurbKey: string;
  /** Optional caveat shown under the blurb, e.g. "opens with your itinerary". */
  hintKey?: string;
}

export const COMPANION_CAPABILITIES: CompanionCapability[] = [
  {
    id: "lens",
    route: "/lens",
    icon: Camera,
    titleKey: "companion.cap.lens.title",
    blurbKey: "companion.cap.lens.blurb",
  },
  {
    id: "dialect",
    route: "/dialect",
    icon: Mic,
    titleKey: "companion.cap.dialect.title",
    blurbKey: "companion.cap.dialect.blurb",
  },
  {
    id: "concierge",
    route: "/itinerary",
    icon: MessagesSquare,
    titleKey: "companion.cap.concierge.title",
    blurbKey: "companion.cap.concierge.blurb",
    hintKey: "companion.cap.concierge.hint",
  },
];
