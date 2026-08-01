/**
 * Seeds the Trip Stories feed with editorial destination guides from a single
 * curator account.
 *
 * WHY THIS EXISTS
 * The feed is empty on a fresh database, and an empty feed makes the whole
 * Stories surface impossible to evaluate — you cannot see ranking, media
 * rendering, or the city/POI anchoring without rows in the table.
 *
 * WHAT IT DELIBERATELY DOES NOT DO
 * It does not invent first-person travel testimony. The Stories header reads
 * "shared by travellers who have been there", so posting fabricated personal
 * trips would be a lie told in the product's own voice. Everything here is
 * written as an official editorial guide and attributed to a clearly-labelled
 * curator account, which is a claim the platform can actually stand behind.
 *
 * It also seeds no TikTok media. A `tiktok` item needs a real video URL, and a
 * fabricated video id renders as a dead embed and poisons the oEmbed cache
 * columns with nulls. Images are used instead — the exact URLs the app already
 * ships in DestinationGallery, each verified to return 200 before insert.
 *
 * CONSEQUENCE: the "top videos" feed stays empty. That feed ranks tiktok media
 * specifically, so it needs real TikTok URLs and this script cannot fill it.
 *
 * Idempotent: re-running updates the curator's existing posts rather than
 * duplicating them, keyed on title.
 */
import { randomBytes } from "crypto";
import { eq, and } from "drizzle-orm";
import { db, usersTable, postsTable, postMediaTable } from "@workspace/db";
import { hashPassword } from "../lib/password";
import { isKnownPoiId } from "@workspace/poi-data";

const CURATOR_EMAIL = "editorial@safarly.sa";
const CURATOR_NAME = "Safarly Editorial";

interface Seed {
  title: string;
  content: string;
  city: string;
  poiIds: string[];
  tags: string[];
  imageUrl: string;
  caption: string;
}

/** Editorial guides — factual descriptions, not invented personal trips. */
const SEEDS: Seed[] = [
  {
    title: "AlUla: where to start in the open-air museum",
    city: "alula",
    poiIds: ["ula_hegra", "ula_elephant", "ula_oldtown"],
    tags: ["heritage", "desert", "unesco"],
    content:
      "Hegra is Saudi Arabia's first UNESCO World Heritage Site — more than 100 tombs cut into sandstone outcrops by the Nabataeans, the same civilisation that built Petra. Go early: the light is better and the heat is survivable.\n\nElephant Rock sits a short drive away and is best at dusk, when the arch is lit and the sand cools enough to sit on. AlUla Old Town fills the gap between them — a mudbrick settlement with a restored market lane.\n\nGive it three days if you can. Two is enough for Hegra and Elephant Rock, but the valley rewards a slower pass.",
    imageUrl: "https://scth.scene7.com/is/image/scth/alula-banner-new?wid=600&fit=constrain&fmt=webp",
    caption: "Nabataean tombs at Hegra, AlUla",
  },
  {
    title: "Riyadh in two days: Diriyah, Masmak and the modern skyline",
    city: "riyadh",
    poiIds: ["ruh_diriyah", "ruh_masmak", "ruh_kingdom"],
    tags: ["city", "heritage", "architecture"],
    content:
      "At-Turaif in Diriyah is the birthplace of the first Saudi state and another UNESCO site — mudbrick palaces along the edge of Wadi Hanifah, best walked in the late afternoon.\n\nMasmak Fortress anchors the older centre of the city and pairs naturally with the surrounding souq. It is small enough to see properly in an hour.\n\nFor contrast, the Kingdom Centre sky bridge gives the clearest view of how far the city has spread. Two days covers all three without rushing.",
    imageUrl: "https://scth.scene7.com/is/image/scth/riyadh-banner-new?wid=600&fit=constrain&fmt=webp",
    caption: "Riyadh skyline",
  },
  {
    title: "Jeddah: Al-Balad, the Corniche and the Red Sea",
    city: "jeddah",
    poiIds: ["jed_balad", "jed_corniche", "jed_fountain"],
    tags: ["coastal", "heritage", "unesco"],
    content:
      "Al-Balad is Jeddah's historic core and a UNESCO World Heritage Site, built from Red Sea coral stone with the tall shuttered rawasheen balconies the city is known for. It comes alive after sunset rather than during the day.\n\nThe Corniche runs for kilometres along the water and is genuinely walkable in the evening. King Fahd's Fountain is visible along most of it.\n\nJeddah is the usual entry point for Red Sea diving, so it works as a base rather than just a stop.",
    imageUrl: "https://scth.scene7.com/is/image/scth/jeddah-corniche?wid=600&fit=constrain&fmt=webp",
    caption: "Jeddah Corniche on the Red Sea",
  },
  {
    title: "Abha and the Aseer highlands",
    city: "abha",
    poiIds: ["abha_jabalsawda", "abha_muftaha_village", "abha_lake_park"],
    tags: ["mountains", "cool-climate", "culture"],
    content:
      "Abha sits above 2,200 metres, which makes it the one Saudi city where summer is the reason to visit rather than the reason to avoid it. Expect mist, green slopes and temperatures far below the coast.\n\nJabal Sawda nearby is the highest point in the country. Al-Muftaha Village is the arts quarter, with studios and galleries built around a small square.\n\nThe drive up from the Tihama plain is a large part of the appeal — budget time for it rather than treating it as transit.",
    imageUrl: "https://scth.scene7.com/is/image/scth/about-abha_hero_banner_desktop-1?wid=600&fit=constrain&fmt=webp",
    caption: "Aseer highlands around Abha",
  },
  {
    title: "Taif: rose farms and the escarpment road",
    city: "taif",
    poiIds: ["taif_rose_fields", "taif_alhada_cablecar", "taif_shubra_palace"],
    tags: ["mountains", "roses", "scenic-drive"],
    content:
      "Taif's rose harvest runs roughly April to May, when the farms distil damask roses into the attar the city is known for. Several farms take visitors during the season.\n\nThe Al-Hada road climbs the escarpment in a long series of switchbacks, and the cable car covers the same drop with a better view. Shubra Palace in town is worth an hour for the architecture.\n\nAt around 1,900 metres Taif stays cooler than Jeddah year-round, which is why it has long been a summer retreat.",
    imageUrl: "https://scth.scene7.com/is/image/scth/Taif-banner-new?wid=600&fit=constrain&fmt=webp",
    caption: "Rose farms near Taif",
  },
];

async function main() {
  // Fail loudly on a bad POI id rather than writing a story that anchors to a
  // place the dataset does not contain — the API enforces this on real
  // submissions and a seed should not be able to bypass it.
  for (const s of SEEDS) {
    for (const id of s.poiIds) {
      if (!isKnownPoiId(id)) throw new Error(`Unknown POI id "${id}" in "${s.title}"`);
    }
  }

  let [curator] = await db.select().from(usersTable).where(eq(usersTable.email, CURATOR_EMAIL)).limit(1);

  if (!curator) {
    /* The curator is an authoring identity, not a login. It gets a real scrypt
       digest of random bytes that are never stored or printed, so the row is
       well-formed for the verifier but no password can ever match it. */
    const unusable = await hashPassword(randomBytes(32).toString("hex"));
    [curator] = await db
      .insert(usersTable)
      .values({ email: CURATOR_EMAIL, name: CURATOR_NAME, passwordHash: unusable })
      .returning();
    console.log(`created curator: ${CURATOR_NAME} <${CURATOR_EMAIL}>`);
  } else {
    console.log(`reusing curator: ${curator.name} <${curator.email}>`);
  }

  for (const s of SEEDS) {
    const [existing] = await db
      .select()
      .from(postsTable)
      .where(and(eq(postsTable.creatorId, curator.id), eq(postsTable.title, s.title)))
      .limit(1);

    let postId: string;
    if (existing) {
      await db
        .update(postsTable)
        .set({ content: s.content, city: s.city, poiIds: s.poiIds, tags: s.tags, updatedAt: new Date() })
        .where(eq(postsTable.id, existing.id));
      postId = existing.id;
      await db.delete(postMediaTable).where(eq(postMediaTable.postId, postId));
      console.log(`updated: ${s.title}`);
    } else {
      const [row] = await db
        .insert(postsTable)
        .values({
          creatorId: curator.id,
          title: s.title,
          content: s.content,
          city: s.city,
          poiIds: s.poiIds,
          tags: s.tags,
        })
        .returning();
      postId = row.id;
      console.log(`created: ${s.title}`);
    }

    await db.insert(postMediaTable).values({
      postId,
      type: "image",
      url: s.imageUrl,
      caption: s.caption,
      sortOrder: 0,
    });
  }

  console.log(`\ndone — ${SEEDS.length} stories under ${CURATOR_EMAIL}`);
  console.log("note: top-videos feed stays empty; it ranks tiktok media, which needs real video URLs.");
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error("seed failed:", err instanceof Error ? err.message : err);
    process.exit(1);
  });
