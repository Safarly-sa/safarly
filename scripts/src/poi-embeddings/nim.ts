/**
 * Minimal NVIDIA NIM embeddings client for the POI retrieval spike.
 *
 * Deliberately zero-dependency raw `fetch` rather than the `openai` SDK:
 *
 *  - `pnpm-workspace.yaml` sets `minimumReleaseAge: 1440`, so pulling a new
 *    dependency into the workspace for a throwaway spike is friction we don't
 *    need to buy yet.
 *  - NIM's embedding models take an `input_type` field ("query" vs "passage")
 *    that is *not* part of the OpenAI embeddings schema. Through the SDK it has
 *    to be smuggled in as `extra_body`; over raw fetch it is just a field. That
 *    field is not optional — asymmetric embedding models score noticeably worse
 *    when both sides are embedded as the same type.
 *
 * If this spike graduates, the production version belongs next to
 * `artifacts/api-server/src/lib/gemini.ts` as a sibling provider, and the key
 * stays server-side for the same reason Gemini's does.
 */

const NIM_BASE_URL = "https://integrate.api.nvidia.com/v1";

/**
 * 2048-dim, asymmetric (separate query/passage encoders), 512-token window.
 * Chosen over `nv-embedqa-e5-v5` because the POI text we build is short and
 * this one is the current NeMo Retriever default on build.nvidia.com.
 */
export const NIM_EMBED_MODEL = "nvidia/llama-3.2-nv-embedqa-1b-v2";

/**
 * The free tier is 40 requests/min. 114 POIs at this batch size is 4 requests,
 * so the whole corpus fits inside one minute's budget with room to spare.
 * Raise it and NIM starts rejecting the payload, not just throttling.
 */
export const EMBED_BATCH_SIZE = 32;

export class NimNotConfiguredError extends Error {
  constructor() {
    super(
      "NVIDIA_API_KEY is not set. Get a free key at https://build.nvidia.com (no card required).",
    );
    this.name = "NimNotConfiguredError";
  }
}

type EmbeddingsResponse = {
  data: Array<{ index: number; embedding: number[] }>;
  usage?: { prompt_tokens: number; total_tokens: number };
};

export type EmbedResult = {
  vectors: number[][];
  promptTokens: number;
  requests: number;
  ms: number;
};

function requireKey(): string {
  const key = process.env.NVIDIA_API_KEY;
  if (!key) throw new NimNotConfiguredError();
  return key;
}

async function embedBatch(
  texts: string[],
  inputType: "query" | "passage",
): Promise<EmbeddingsResponse> {
  const res = await fetch(`${NIM_BASE_URL}/embeddings`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${requireKey()}`,
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: JSON.stringify({
      model: NIM_EMBED_MODEL,
      input: texts,
      input_type: inputType,
      // Without this a single over-length POI blurb fails the whole batch
      // rather than being clipped.
      truncate: "END",
      encoding_format: "float",
    }),
    signal: AbortSignal.timeout(60_000),
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`NIM ${res.status}: ${body.slice(0, 400)}`);
  }

  const json = (await res.json()) as EmbeddingsResponse;
  // NIM does not promise the response preserves input order — it returns an
  // explicit `index` per row, so sort by it rather than trusting arrival order.
  json.data.sort((a, b) => a.index - b.index);
  return json;
}

/** Embeds `texts` in batches, preserving input order. */
export async function embedAll(
  texts: string[],
  inputType: "query" | "passage",
  onProgress?: (done: number, total: number) => void,
): Promise<EmbedResult> {
  const start = performance.now();
  const vectors: number[][] = [];
  let promptTokens = 0;
  let requests = 0;

  for (let i = 0; i < texts.length; i += EMBED_BATCH_SIZE) {
    const batch = texts.slice(i, i + EMBED_BATCH_SIZE);
    const res = await embedBatch(batch, inputType);
    if (res.data.length !== batch.length) {
      throw new Error(
        `NIM returned ${res.data.length} vectors for ${batch.length} inputs`,
      );
    }
    for (const row of res.data) vectors.push(normalize(row.embedding));
    promptTokens += res.usage?.prompt_tokens ?? 0;
    requests += 1;
    onProgress?.(Math.min(i + batch.length, texts.length), texts.length);
  }

  return { vectors, promptTokens, requests, ms: performance.now() - start };
}

/**
 * L2-normalize so `cosine()` is a plain dot product. NIM's embeddings arrive
 * near-normalized but the API does not guarantee it, and an un-normalized
 * outlier would quietly win every ranking on magnitude alone.
 */
export function normalize(v: number[]): number[] {
  let sum = 0;
  for (const x of v) sum += x * x;
  const mag = Math.sqrt(sum);
  if (mag === 0) return v;
  return v.map((x) => x / mag);
}

/** Assumes both inputs are already normalized. */
export function cosine(a: number[], b: number[]): number {
  let dot = 0;
  for (let i = 0; i < a.length; i++) dot += a[i] * b[i];
  return dot;
}
