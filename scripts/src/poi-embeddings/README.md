# POI embedding spike (NVIDIA NIM)

Throwaway. Answers one question: **does semantic retrieval over `@workspace/poi-data`
return the right places well enough to shortlist candidates for the Personal
Concierge?** Nothing here is wired into the app.

If the answer is yes, the production shape is pgvector in the existing Postgres
plus a NIM sibling to `artifacts/api-server/src/lib/gemini.ts`. If the answer is
no, delete this directory.

## Why this and not the current approach

The concierge is handed a candidate POI list today, and the server validates
every proposed edit against it (`concierge-tools.ts`). That guard is good and
stays. What's missing is how the candidate list gets *built* — right now nothing
in the stack can answer "somewhere indoor for the kids, nothing expensive"
without the model guessing, because `pois.json` is only reachable by id, city,
and category.

## Setup

Free key, no card, at <https://build.nvidia.com>. Free tier is ~40 requests/min
and 1,000 credits (up to 5,000).

```bash
export NVIDIA_API_KEY=nvapi-...
```

**The free tier is not zero-retention.** Only public POI text is sent here — no
user trips, no story content, no Live Lens images. Keep it that way.

## Run

Review the text shaping before spending credits (no API call):

```bash
pnpm --filter @workspace/scripts run embed-pois -- --dry
```

Build the index — 114 POIs, 4 requests, one file:

```bash
pnpm --filter @workspace/scripts run embed-pois
```

Score it:

```bash
pnpm --filter @workspace/scripts run query-pois -- --eval --out ./eval-report.json
```

Ad-hoc:

```bash
pnpm --filter @workspace/scripts run query-pois -- --city riyadh "quiet place to sit in the evening"
```

## Arabic

Three text variants are built per POI and scored side by side, because "should
the Arabic text be its own vector or share one with English?" has two defensible
answers:

| variant | what it is |
|---|---|
| `en` | English passage only |
| `ar` | Arabic passage only |
| `bi` | both, concatenated into one vector |

`bi` is the cheap option — one index, no query-language detection — but it spends
half the vector's budget on the language the query isn't in, which can flatten
the ranking. The eval prints a query-language × index-variant matrix so the
choice comes from a number rather than a preference.

**Coverage is the thing to check before reading any Arabic result.** `ar.json`
has Arabic names for **42 of 114** POIs and Arabic culture notes for **21**. The
16-city expansion added POIs without Arabic names, so twelve cities are at zero:
abha, taif, madinah, dammam, najran, jazan, tabuk, hail, yanbu, dhahran,
khamis_mushait, mecca. That is a data gap, not a retrieval failure.

The Arabic passage is therefore built for **all 114** rows, falling back to the
English name where no Arabic one exists — every POI's *attributes* (city,
category, slot, price, duration, flags) translate cleanly even when its name
hasn't been. So an Arabic attribute query reaches the whole corpus while an
Arabic name query only reaches the translated 42. Dropping the untranslated rows
instead would have made twelve cities unreachable in Arabic for any query at all.

Rows carrying the English fallback are tagged `[no-ar-name]` in the result
listing, and the summary reports what share of Arabic-query results had a real
Arabic name against the corpus's own 37% — if those two numbers match, the
translations aren't earning their keep; if the retrieved share is much higher,
the names are doing real work and finishing the other 72 is worth it.

The queries are written the way a Gulf traveller actually types — "وين نقدر ناكل
أكل شعبي أصلي", not MSA. Worth knowing when reading a bad score: Saudi dialect is
low-resource for current models, the same caveat the dialect agent already
carries in its own code comment.

## How to read the eval

Ten predicates, each asked twice — once in English, once in Arabic — phrased the
way a traveller talks. Keeping the predicate identical across the pair is what
makes the two scores comparable: if Arabic scores worse, it's the language
handling and not a harder question. The script prints
precision@5 against that predicate next to the **base rate** — the hit rate from
picking 5 POIs at random. Precision alone means nothing: if 60% of the corpus is
family-friendly, a 60% precision score on a family-friendly query is pure noise.

Read the `lift` number. Rough bar:

| lift | read |
|---|---|
| ≥ 2× and p@5 ≥ 70% | works; take it to pgvector |
| 1.5–2× | real but weak — try `nv-rerankqa` on top before deciding |
| < 1.5× | fix `poi-text.ts` before blaming the model |

The predicates are a proxy. They check the result satisfies the *constraint* in
the query, not that it's the single best answer — which is the right bar for
shortlisting, and the wrong bar for anything user-facing.

## Files

| File | What |
|---|---|
| `nim.ts` | Raw-fetch NIM embeddings client. Zero deps on purpose — see its header |
| `locales.ts` | Arabic strings pulled from the app's own `ar.json`, plus coverage stats |
| `poi-text.ts` | POI row → the sentence we embed, in all three variants. The part most worth arguing about |
| `embed-pois.ts` | Builds `poi-vectors.json` (gitignored, regenerate it) |
| `query-pois.ts` | Ad-hoc search + the scored eval |

## Known gaps

- Brute-force cosine over 114 rows in memory. Fine at this size, not a plan.
- 72 POIs have no Arabic name and 93 no Arabic culture note. The Arabic index
  works around it rather than fixing it — filling `ar.json` is separate work,
  and the eval's `arNameShare` number is what says whether it's worth doing.
- Arabic is the only non-English locale covered. There are eleven, and nothing
  here says whether Turkish or Urdu queries land anywhere near the right POIs.
- No reranker. `nv-rerankqa` is the obvious next lever if lift lands in the
  middle band.
- Costs 3× the credits of the English-only build (12 requests instead of 4).
  Once the matrix picks a winner, drop the rest with `--variants`.
