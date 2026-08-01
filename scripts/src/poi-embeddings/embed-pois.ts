/**
 * POI embedding spike — step 1: build the vector index.
 *
 * Embeds every POI in `@workspace/poi-data` through NVIDIA NIM and writes the
 * vectors to a JSON file. Deliberately a file, not Postgres: the question this
 * spike answers is "does semantic retrieval over our POI text actually return
 * the right places?", and pgvector is a storage decision that only matters once
 * the answer is yes. Brute-force cosine over 114 rows is instant, and keeping it
 * a file means the spike runs with no DATABASE_URL.
 *
 * Three variants are built per POI — English, Arabic, and both concatenated —
 * because "should the Arabic text be its own vector or share one with English?"
 * has two defensible answers and guessing is how a spike ends up shipping the
 * wrong one. The eval scores them side by side. See `poi-text.ts`.
 *
 * Run:
 *   pnpm --filter @workspace/scripts run embed-pois
 *
 * Flags:
 *   --out        where to write the index (default ./poi-vectors.json)
 *   --variants   comma-separated subset of en,ar,bi (default all three)
 *   --dry        print the built text for a few rows and exit without calling
 *                NIM — use this to review the shaping before spending credits
 */

import { writeFileSync } from "node:fs";
import { resolve as resolvePath } from "node:path";
import { fileURLToPath } from "node:url";
import { argv, exit } from "node:process";

import { pois } from "@workspace/poi-data";

import { NIM_EMBED_MODEL, embedAll } from "./nim";
import { arabicCoverage, formatCoverage } from "./locales";
import {
  TEXT_VARIANTS,
  arabicNameIsFallback,
  buildText,
  type TextVariant,
} from "./poi-text";

const SCRIPT_DIR = fileURLToPath(new URL(".", import.meta.url));

/**
 * The embedding model's context is 512 tokens. Arabic tokenizes to roughly
 * twice as many tokens per character as English, so the bilingual variant is
 * the one at risk of being clipped — and `truncate: "END"` clips silently,
 * which would quietly delete the Arabic half of every long row. Rough char
 * budget, flagged rather than enforced.
 */
const CLIP_WARN_CHARS = 900;

export type PoiVectorRow = {
  id: string;
  city: string;
  /** False when the Arabic passage fell back to the English name. */
  hasArabicName: boolean;
  texts: Partial<Record<TextVariant, string>>;
  vectors: Partial<Record<TextVariant, number[]>>;
};

export type PoiVectorIndex = {
  model: string;
  dims: number;
  builtAt: string;
  variants: TextVariant[];
  rows: PoiVectorRow[];
  coverage: ReturnType<typeof arabicCoverage>;
  stats: Record<string, { promptTokens: number; requests: number; ms: number }>;
};

function flag(name: string): string | undefined {
  const i = argv.indexOf(name);
  return i >= 0 && argv[i + 1] ? argv[i + 1] : undefined;
}

function parseVariants(): TextVariant[] {
  const raw = flag("--variants");
  if (!raw) return TEXT_VARIANTS;
  const picked = raw.split(",").map((v) => v.trim()) as TextVariant[];
  const bad = picked.filter((v) => !TEXT_VARIANTS.includes(v));
  if (bad.length) {
    process.stderr.write(
      `unknown variant(s): ${bad.join(", ")} — pick from ${TEXT_VARIANTS.join(",")}\n`,
    );
    exit(2);
  }
  return picked;
}

async function main(): Promise<void> {
  const outArg = flag("--out") ?? "./poi-vectors.json";
  const dry = argv.includes("--dry");
  const variants = parseVariants();

  const coverage = arabicCoverage();
  process.stderr.write(formatCoverage(coverage));

  const texts: Record<string, string[]> = {};
  for (const v of variants) texts[v] = pois.map((p) => buildText(p, v));

  // Warn before spending credits, not after.
  for (const v of variants) {
    const long = texts[v].filter((t) => t.length > CLIP_WARN_CHARS).length;
    if (long > 0) {
      process.stderr.write(
        `warning: ${long}/${pois.length} "${v}" passages exceed ${CLIP_WARN_CHARS} chars ` +
          `and may be clipped at the 512-token limit\n`,
      );
    }
  }

  if (dry) {
    process.stderr.write(`\n${pois.length} POIs. Sample of the embedded text:\n`);
    for (const i of [0, Math.floor(pois.length / 2), pois.length - 1]) {
      process.stderr.write(`\n--- ${pois[i].id} ---\n`);
      for (const v of variants) {
        process.stderr.write(`[${v}] ${texts[v][i]}\n`);
      }
    }
    process.stderr.write("\n");
    for (const v of variants) {
      const lens = texts[v].map((t) => t.length);
      process.stderr.write(
        `${v}: chars min=${Math.min(...lens)} max=${Math.max(...lens)} ` +
          `mean=${Math.round(lens.reduce((a, b) => a + b, 0) / lens.length)}\n`,
      );
    }
    return;
  }

  const rows: PoiVectorRow[] = pois.map((p) => ({
    id: p.id,
    city: p.city,
    hasArabicName: !arabicNameIsFallback(p),
    texts: {},
    vectors: {},
  }));

  const stats: PoiVectorIndex["stats"] = {};
  let dims = 0;

  for (const v of variants) {
    process.stderr.write(
      `\nembedding ${pois.length} POIs, variant "${v}", via ${NIM_EMBED_MODEL} …\n`,
    );
    const res = await embedAll(texts[v], "passage", (done, total) =>
      process.stderr.write(`  ${done}/${total}\n`),
    );
    for (let i = 0; i < rows.length; i++) {
      rows[i].texts[v] = texts[v][i];
      rows[i].vectors[v] = res.vectors[i];
    }
    dims = res.vectors[0]?.length ?? dims;
    stats[v] = {
      promptTokens: res.promptTokens,
      requests: res.requests,
      ms: res.ms,
    };
  }

  const index: PoiVectorIndex = {
    model: NIM_EMBED_MODEL,
    dims,
    builtAt: new Date().toISOString(),
    variants,
    rows,
    coverage,
    stats,
  };

  const outPath = resolvePath(SCRIPT_DIR, outArg);
  writeFileSync(outPath, JSON.stringify(index), "utf8");

  const totalReq = Object.values(stats).reduce((a, s) => a + s.requests, 0);
  const totalTok = Object.values(stats).reduce((a, s) => a + s.promptTokens, 0);
  const totalMs = Object.values(stats).reduce((a, s) => a + s.ms, 0);

  process.stderr.write(
    `\nwrote ${outPath}\n` +
      `  ${rows.length} POIs × ${variants.length} variants × ${dims} dims\n` +
      `  ${totalReq} requests, ${totalTok} prompt tokens, ${(totalMs / 1000).toFixed(1)}s\n`,
  );
}

main().catch((e) => {
  process.stderr.write(`fatal: ${e instanceof Error ? e.stack : String(e)}\n`);
  exit(1);
});
