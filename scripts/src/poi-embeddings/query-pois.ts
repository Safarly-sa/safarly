/**
 * POI embedding spike — step 2: does retrieval actually work?
 *
 * Two modes:
 *
 *   ad-hoc   pnpm --filter @workspace/scripts run query-pois -- "rainy day with kids"
 *   eval     pnpm --filter @workspace/scripts run query-pois -- --eval
 *
 * The eval mode is the point. Eyeballing top-5 lists is how spikes talk
 * themselves into shipping something that doesn't work, so each probe carries a
 * machine-checkable predicate over the POI row ("is it actually indoor and
 * family friendly?"). The script scores precision@5 against that predicate and
 * prints it next to the corpus base rate — the hit rate you'd get by picking 5
 * POIs at random. If precision@5 doesn't clear the base rate by a wide margin,
 * the embeddings aren't reading our flags and the whole idea is dead.
 *
 * The predicates are a proxy, not ground truth: they check the retrieved place
 * satisfies the *constraint* in the query, not that it's the single best answer.
 * That's the right bar for concierge candidate-shortlisting, which is what this
 * would feed.
 *
 * Probes come in matched English/Arabic pairs over the same predicate, and every
 * probe is scored against every index variant. That produces a language × variant
 * matrix which answers the two open questions at once: does Arabic retrieval work
 * at all, and does it want its own index or a shared bilingual one.
 *
 * Flags:
 *   --index    path to the file written by embed-pois (default ./poi-vectors.json)
 *   --variant  which index variant to search in ad-hoc mode (default en)
 *   --city     restrict to one city key, e.g. riyadh — mirrors how the concierge
 *              always operates inside the trip's city
 *   --k        how many results to show/score (default 5)
 *   --out      write the eval report to JSON
 */

import { readFileSync, writeFileSync } from "node:fs";
import { resolve as resolvePath } from "node:path";
import { fileURLToPath } from "node:url";
import { argv, exit } from "node:process";

import { pois, type Poi } from "@workspace/poi-data";

import { cosine, embedAll } from "./nim";
import { formatCoverage } from "./locales";
import type { TextVariant } from "./poi-text";
import type { PoiVectorIndex, PoiVectorRow } from "./embed-pois";

const SCRIPT_DIR = fileURLToPath(new URL(".", import.meta.url));

const POI_BY_ID = new Map<string, Poi>(pois.map((p) => [p.id, p]));

type Probe = {
  /** Phrased the way a traveller talks to the concierge, not as keywords. */
  query: string;
  lang: "en" | "ar";
  city?: string;
  /** What a correct answer must satisfy. */
  want: (p: Poi) => boolean;
  /** Human label for the predicate, printed in the report. */
  wantLabel: string;
};

/**
 * Ten predicates, each asked twice — once in English, once in Arabic. Keeping
 * the predicate identical across the pair is what makes the two scores
 * comparable; if the Arabic column is worse, it is the language handling and
 * not a harder question.
 *
 * Chosen to cover the three things a keyword search over `pois.json` cannot do
 * today: flag combinations, the heat constraint, and price phrased as intent
 * rather than as a number.
 */
const PROBE_SPECS: Array<{
  en: string;
  ar: string;
  city?: string;
  want: (p: Poi) => boolean;
  wantLabel: string;
}> = [
  {
    en: "somewhere indoors to take the kids when it's too hot outside",
    ar: "مكان مغلق ناخذ فيه الأطفال لما يكون الجو حار برا",
    city: "riyadh",
    want: (p) => p.indoor && p.family_friendly,
    wantLabel: "indoor && family_friendly",
  },
  {
    en: "a quiet spot most tourists don't know about",
    ar: "مكان هادي أغلب السياح ما يعرفونه",
    want: (p) => p.hidden_gem,
    wantLabel: "hidden_gem",
  },
  {
    en: "free things to do, we're on a tight budget",
    ar: "أشياء نسويها مجاناً، ميزانيتنا محدودة",
    want: (p) => p.price_range === 0,
    wantLabel: "price_range === 0",
  },
  {
    en: "old history and traditional architecture",
    ar: "تاريخ قديم وعمارة تراثية",
    want: (p) => p.category === "heritage",
    wantLabel: "category === heritage",
  },
  {
    en: "where can we eat, somewhere with real local food",
    ar: "وين نقدر ناكل أكل شعبي أصلي",
    want: (p) => p.category === "food",
    wantLabel: "category === food",
  },
  {
    en: "my mother uses a wheelchair, what can we visit with her",
    ar: "أمي تستخدم كرسي متحرك، وش نقدر نزور معها",
    want: (p) => p.accessible,
    wantLabel: "accessible",
  },
  {
    en: "something quick, we only have an hour before our flight",
    ar: "شي سريع، عندنا ساعة وحدة بس قبل الطيارة",
    want: (p) => p.duration_hrs <= 1.5,
    wantLabel: "duration_hrs <= 1.5",
  },
  {
    en: "desert landscape and dramatic views for photos",
    ar: "مناظر صحراوية وإطلالات حلوة للتصوير",
    want: (p) => !p.indoor && (p.category === "nature" || p.category === "adventure"),
    wantLabel: "outdoor && (nature || adventure)",
  },
  {
    en: "shopping and modern city life in the evening",
    ar: "تسوق وحياة المدينة الحديثة في المساء",
    want: (p) => p.best_slot === "evening",
    wantLabel: "best_slot === evening",
  },
  {
    en: "a full day out, not a quick stop",
    ar: "يوم كامل بره، مو وقفة سريعة",
    want: (p) => p.duration_hrs >= 4,
    wantLabel: "duration_hrs >= 4",
  },
];

const PROBES: Probe[] = PROBE_SPECS.flatMap((s) => [
  { query: s.en, lang: "en" as const, city: s.city, want: s.want, wantLabel: s.wantLabel },
  { query: s.ar, lang: "ar" as const, city: s.city, want: s.want, wantLabel: s.wantLabel },
]);

function flag(name: string): string | undefined {
  const i = argv.indexOf(name);
  return i >= 0 && argv[i + 1] ? argv[i + 1] : undefined;
}

function loadIndex(): PoiVectorIndex {
  const path = resolvePath(SCRIPT_DIR, flag("--index") ?? "./poi-vectors.json");
  try {
    return JSON.parse(readFileSync(path, "utf8")) as PoiVectorIndex;
  } catch {
    process.stderr.write(
      `could not read ${path}\nrun embed-pois first:\n  pnpm --filter @workspace/scripts run embed-pois\n`,
    );
    exit(2);
  }
}

type Hit = { row: PoiVectorRow; score: number; poi: Poi | undefined };

function search(
  index: PoiVectorIndex,
  queryVec: number[],
  variant: TextVariant,
  k: number,
  city?: string,
): Hit[] {
  const hits: Hit[] = [];
  for (const row of index.rows) {
    if (city && row.city !== city) continue;
    const vec = row.vectors[variant];
    if (!vec) continue;
    hits.push({ row, score: cosine(queryVec, vec), poi: POI_BY_ID.get(row.id) });
  }
  hits.sort((a, b) => b.score - a.score);
  return hits.slice(0, k);
}

/** Share of the (city-filtered) corpus that satisfies `want` — the random-pick baseline. */
function baseRate(want: (p: Poi) => boolean, city?: string): number {
  const pool = city ? pois.filter((p) => p.city === city) : pois;
  if (pool.length === 0) return 0;
  return pool.filter(want).length / pool.length;
}

function formatHit(h: Hit, mark?: string): string {
  const p = h.poi;
  const name = p ? p.name : `${h.row.id} (missing from poi-data!)`;
  const meta = p
    ? `${p.city}/${p.category} ${p.duration_hrs}h price=${p.price_range}` +
      `${p.indoor ? " indoor" : " outdoor"}${p.family_friendly ? " family" : ""}` +
      `${p.hidden_gem ? " gem" : ""}${p.accessible ? " a11y" : ""} ${p.best_slot}` +
      `${h.row.hasArabicName ? "" : " [no-ar-name]"}`
    : "";
  return `    ${mark ?? " "} ${h.score.toFixed(4)}  ${name.padEnd(38)} ${meta}`;
}

type ProbeResult = {
  query: string;
  lang: "en" | "ar";
  variant: TextVariant;
  city?: string;
  wantLabel: string;
  precision: number;
  baseRate: number;
  lift: number;
  /** Share of the top-k that has a real Arabic name — only meaningful for ar. */
  arNameShare: number;
  hits: Array<{ id: string; score: number; ok: boolean; hasArabicName: boolean }>;
};

async function runEval(index: PoiVectorIndex, k: number): Promise<void> {
  process.stderr.write(formatCoverage(index.coverage));

  // Query vectors do not depend on which variant they're scored against, so
  // embed each probe once and reuse it across the whole matrix.
  const { vectors: queryVecs, requests, promptTokens } = await embedAll(
    PROBES.map((p) => p.query),
    "query",
  );

  const results: ProbeResult[] = [];

  for (const variant of index.variants) {
    process.stderr.write(`\n\n########## index variant: ${variant} ##########\n`);

    for (let i = 0; i < PROBES.length; i++) {
      const probe = PROBES[i];
      const hits = search(index, queryVecs[i], variant, k, probe.city);
      const scored = hits.map((h) => ({
        id: h.row.id,
        score: h.score,
        ok: Boolean(h.poi && probe.want(h.poi)),
        hasArabicName: h.row.hasArabicName,
      }));
      const precision = scored.length
        ? scored.filter((h) => h.ok).length / scored.length
        : 0;
      const base = baseRate(probe.want, probe.city);
      const arNameShare = scored.length
        ? scored.filter((h) => h.hasArabicName).length / scored.length
        : 0;

      results.push({
        query: probe.query,
        lang: probe.lang,
        variant,
        city: probe.city,
        wantLabel: probe.wantLabel,
        precision,
        baseRate: base,
        lift: base > 0 ? precision / base : precision > 0 ? Infinity : 0,
        arNameShare,
        hits: scored,
      });

      process.stderr.write(
        `\n[${probe.lang}] "${probe.query}"${probe.city ? `  [city=${probe.city}]` : ""}\n` +
          `  want: ${probe.wantLabel}   p@${k}=${(precision * 100).toFixed(0)}%  ` +
          `base=${(base * 100).toFixed(0)}%\n`,
      );
      for (let j = 0; j < hits.length; j++) {
        process.stderr.write(formatHit(hits[j], scored[j].ok ? "✓" : "·") + "\n");
      }
    }
  }

  console.log("\n" + summarize(results, index, k, requests, promptTokens));

  const out = flag("--out");
  if (out) {
    const outPath = resolvePath(SCRIPT_DIR, out);
    writeFileSync(
      outPath,
      JSON.stringify(
        {
          model: index.model,
          k,
          coverage: index.coverage,
          results,
          summary: summarize(results, index, k, requests, promptTokens),
        },
        null,
        2,
      ),
      "utf8",
    );
    process.stderr.write(`wrote ${outPath}\n`);
  }
}

function mean(xs: number[]): number {
  return xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0;
}

function summarize(
  results: ProbeResult[],
  index: PoiVectorIndex,
  k: number,
  requests: number,
  promptTokens: number,
): string {
  const lines: string[] = [];
  lines.push("=== summary ===");
  lines.push(`model:  ${index.model}   k=${k}`);
  lines.push(`probes: ${PROBE_SPECS.length} predicates × 2 languages × ${index.variants.length} variants`);
  lines.push("");
  lines.push("mean precision@" + k + " — query language (rows) × index variant (columns)");
  lines.push("");
  lines.push(
    "query lang".padEnd(12) +
      index.variants.map((v) => `idx:${v}`.padStart(10)).join("") +
      "base".padStart(10),
  );

  for (const lang of ["en", "ar"] as const) {
    const cells = index.variants.map((v) => {
      const subset = results.filter((r) => r.lang === lang && r.variant === v);
      return `${(mean(subset.map((r) => r.precision)) * 100).toFixed(0)}%`.padStart(10);
    });
    const base = mean(
      results.filter((r) => r.lang === lang && r.variant === index.variants[0]).map((r) => r.baseRate),
    );
    lines.push(lang.padEnd(12) + cells.join("") + `${(base * 100).toFixed(0)}%`.padStart(10));
  }

  lines.push("");

  // The Arabic-name coverage gap: if ar-index results are dominated by rows
  // that fell back to an English name, the Arabic passage is being carried by
  // its attributes alone and the name translations aren't earning their keep.
  const arRows = results.filter((r) => r.lang === "ar" && r.variant === "ar");
  if (arRows.length) {
    const corpusArShare = index.coverage.withName / index.coverage.total;
    lines.push(
      `Arabic-query results with a real Arabic name: ` +
        `${(mean(arRows.map((r) => r.arNameShare)) * 100).toFixed(0)}% ` +
        `(corpus is ${(corpusArShare * 100).toFixed(0)}%)`,
    );
    lines.push("");
  }

  for (const v of index.variants) {
    for (const lang of ["en", "ar"] as const) {
      const subset = results.filter((r) => r.lang === lang && r.variant === v);
      const p = mean(subset.map((r) => r.precision));
      const b = mean(subset.map((r) => r.baseRate));
      lines.push(
        `${lang}→${v}`.padEnd(10) +
          `p@${k}=${(p * 100).toFixed(0)}%`.padEnd(12) +
          `lift=${(p / b).toFixed(2)}×`.padEnd(14) +
          verdict(p, b),
      );
    }
  }

  lines.push("");
  lines.push(`query cost: ${requests} requests, ${promptTokens} prompt tokens`);
  return lines.join("\n");
}

function verdict(precision: number, base: number): string {
  const lift = precision / base;
  if (precision >= 0.7 && lift >= 2)
    return "works — worth taking to pgvector.";
  if (lift >= 1.5) return "real but weak; try nv-rerankqa before deciding.";
  return "no better than guessing; fix poi-text.ts before blaming the model.";
}

async function main(): Promise<void> {
  const index = loadIndex();
  const k = Number(flag("--k") ?? "5");
  const city = flag("--city");

  if (argv.includes("--eval")) {
    await runEval(index, k);
    return;
  }

  const variant = (flag("--variant") ?? "en") as TextVariant;
  if (!index.variants.includes(variant)) {
    process.stderr.write(
      `variant "${variant}" is not in this index (has: ${index.variants.join(", ")})\n`,
    );
    exit(2);
  }

  // Everything that isn't a flag or a flag's value is the ad-hoc query.
  const FLAGS_WITH_VALUES = new Set(["--index", "--k", "--city", "--out", "--variant"]);
  const words: string[] = [];
  for (let i = 2; i < argv.length; i++) {
    if (argv[i].startsWith("--")) {
      if (FLAGS_WITH_VALUES.has(argv[i])) i++;
      continue;
    }
    words.push(argv[i]);
  }
  const query = words.join(" ").trim();

  if (!query) {
    process.stderr.write(
      'usage: query-pois -- "your question"   |   query-pois -- --eval\n',
    );
    exit(2);
  }

  const { vectors } = await embedAll([query], "query");
  const hits = search(index, vectors[0], variant, k, city);
  console.log(`\n"${query}"  [variant=${variant}${city ? `, city=${city}` : ""}]\n`);
  for (const h of hits) console.log(formatHit(h));
  console.log("");
}

main().catch((e) => {
  process.stderr.write(`fatal: ${e instanceof Error ? e.stack : String(e)}\n`);
  exit(1);
});
