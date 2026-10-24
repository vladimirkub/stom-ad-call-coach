# Benchmark: our layer vs the same model used bare

**Question:** is the product better than Gemma 4 alone, and how did we check?

**Setup.** Six **synthetic, anonymized** calls of known quality, written by us (`docs/benchmark-calls.json`; no real people or data):

- `strong_*`: introduces itself, asks open questions, answers by facts, offers two slots, repeats the booking, asks about obstacles, gets a clear "I'll come".
- `medium_1`: books, but with no discovery and no show-up work. `medium_2`: good discovery, but **no booking** ("I'll think about it").
- `weak_*`: `weak_1` pushes with fake scarcity, invented price and "painless, lifetime guarantee on everything"; `weak_2` ignores the patient's price question.

Each call was run **twice** through two methods, same model (`gemma-4-26b-a4b-it` through the Gemini API, default settings):

- **bare:** "Rate this operator's call 0-100" (`app/api/baseline`).
- **ours:** `POST /api/evaluate`: clinic facts + a 20-criterion checklist, validated JSON, scores computed in code (`lib/rubric.ts`, `lib/scoring.ts`).

Reproduce: `BASE_URL=http://localhost:3000 node scripts/benchmark.mjs`.

## Results (24 requests, 0 errors)

| call | tier | bare scores (mean) | ours scores (mean) | ours: false claims flagged per run | ours: appointment booked |
|---|---|---|---|---|---|
| strong_1 | strong | 100, 100 (100) | 95, 95 (95) | 0, 0 | yes |
| strong_2 | strong | 98, 98 (98) | 89, 89 (89) | 0, 0 | yes |
| medium_1 | medium | 45, 60 (53) | 32, 32 (32) | 0, 0 | yes |
| medium_2 | medium | 75, 75 (**75**) | 37, 37 (**37**) | 0, 0 | **no** |
| weak_1 | weak | 20, 15 (18) | 0, 0 (0) | **4, 3** | no |
| weak_2 | weak | 5, 10 (8) | 0, 0 (0) | 3, 0 | no |

| | strong / medium / weak (mean) | tiers fully separated | avg run-to-run spread | strong-vs-weak gap |
|---|---|---|---|---|
| bare Gemma 4 | 99 / 64 / 13 | yes | 4.2 points | 87 |
| **ours** | 92 / 35 / 0 | yes | **0.0 points** | 92 |

## What this does and does not show

**Honest reading.**
- **Bare Gemma already separates obvious good from obvious bad.** We do not claim our layer is needed for that.
- **The difference is calibration to the business outcome.** Bare Gemma gave `medium_2`, a call where **no appointment was booked**, **75/100**, higher than `medium_1` which booked (53). Our layer scored it 37 and reported "appointment not booked", because booking and show-up are explicit checklist items.
- **Consistency.** Bare scores moved by up to 15 points between identical runs (`medium_1`: 45 vs 60); ours were identical across both runs for all six calls.
- **Fact-checking.** Our layer checks the operator's claims against the clinic facts: it flagged the invented price, fake scarcity and "lifetime guarantee on everything" in `weak_1` in 4 and 3 claims per run. The bare model has no facts to check against.
- **Explainability.** Ours returns which of the 20 criteria were missed and why, tied to turns; the bare model returns a number and a sentence.
- Bare scores saturate at 98-100 for strong calls; there is little headroom to tell a good call from a perfect one.

**Limitations (please read).**
- **n is tiny:** 6 calls, 2 runs each. The 0.0 spread is a measurement on 2 runs, not a guarantee.
- The calls are **synthetic** and the "tier" labels are known only by how we wrote them. This is not evidence of accuracy on real calls, and not a proof that our scores agree with an expert's.
- Our scores are lower in absolute terms (stricter checklist). We have not validated the 20 criteria against an independent human expert panel.
- During this benchmark we found and fixed two real bugs: an evaluation crash when a very weak call has no strengths, and Gemini rate-limit (429) backoff.
