# Stom AD Call Coach

A voice trainer for **dental call-center operators**, built for the "Expertise → AI" theme.

- **Trainer:** a human operator calls AI patients (six personas with hidden objections and no-show risks). The AI patient reveals the real reason only to open, empathic questions.
- **Virtual operator:** the other way round. An AI operator calls *you*; you improvise a patient with no script. Every call is reviewed, and the lessons go into a **shared knowledge base** that is injected into the operator's instructions on the next call.
- **Real calls:** pull calls from amoCRM, upload a recording, or paste a transcript, and get the same review.

> Language: the product UI and voices are Russian. This README is in English for the judges.

## Who it is for
Heads of call centers and operators of dental clinics (and any clinic that converts ad leads into booked appointments). The two business metrics it targets are **lead → booking** and **booking → patient actually shows up**.

## How to run

```bash
npm install
cp .env.example .env.local     # add ELEVENLABS_API_KEY, GEMINI_API_KEY, CRM_SESSION_SECRET (openssl rand -hex 32)
npm run create-agent           # creates/updates the ElevenLabs voice agents (writes .agents.json)
npm run dev                    # http://localhost:3000
```

Keys: [ElevenLabs](https://elevenlabs.io/app/settings/api-keys) (permissions: ElevenAgents *Write* and *Speech to Text*), [Google AI Studio](https://aistudio.google.com/apikey).
Text mode works with only `GEMINI_API_KEY`. Voice needs both keys. The amoCRM import is optional.

First useful result for a new user: open the page, press a patient, allow the microphone, talk, press "Finish" (about 3 steps, under 2 minutes).

```bash
npm test                              # unit tests (scoring, checklist, knowledge base, CRM parsing)
BASE_URL=http://localhost:3000 node scripts/benchmark.mjs   # bare model vs our layer (see below)
```

## Expertise: what knowledge is built in and where it comes from
The domain knowledge is how an outbound lead call in a dental call center should go, to **book and make the patient actually come**. It is encoded in files, not in the model:

| File | What it holds |
|---|---|
| `lib/rubric.ts` | A 21-criterion checklist in 4 skills (discovery, objection handling, booking, show-up). Skill scores and the total are computed **in code** from the checklist (`lib/scoring.ts`). |
| `lib/scenarios-private.json`, `lib/scenarios-public.json` | Six patient personas with stated objections, a **hidden objection** and a **no-show risk** each. |
| `lib/clinic.json` | The clinic facts the patients "read" on the website and the evaluator checks the operator against. Anything outside it must be answered with "I'll check with the doctor". |
| `lib/operator.ts` | The virtual operator's playbook: call structure, how to handle refusals, "I never left a request", medical questions, rudeness. |
| `lib/kb.ts` | The shared knowledge base: practices distilled from reviewed calls, deduplicated, confirmed by counts, filtered, capped. |

The checklist, personas and playbook are authored from call-center practice for lead callbacks (the facts in `clinic.json` come from a public clinic website, de-identified). They are not clinical guidance.

## The model and its license
- **Gemma 4** `gemma-4-26b-a4b-it` (open weights, **Apache 2.0**) through the **Gemini API** (`@google/genai`). Model card and license: <https://huggingface.co/google/gemma-4-26B-A4B-it>. Override with `GEMMA_MODEL` (e.g. `gemma-4-31b-it`).
- Gemma does: call evaluation (21-criterion checklist), model conversation scripts, knowledge-base learning, and the text-mode AI patient. Integration: `lib/gemma.ts`.
- **ElevenLabs** (closed, used as the voice layer): Agents for the six AI patients and the virtual operator, Scribe v2 speech-to-text for uploaded and CRM recordings, Voice Library voices.
- The dialogue brain *inside* the ElevenLabs voice agents is `gemini-2.5-flash` (a closed model, configurable with `ELEVENLABS_LLM`). Evaluation, learning and the text fallback do not depend on it.

## Proof that this works better than the same model without our layer
`scripts/benchmark.mjs` runs 6 synthetic, anonymized calls of **known quality** (2 strong, 2 medium, 2 weak; `docs/benchmark-calls.json`) through **bare Gemma 4** ("rate this call 0-100") and through our layer, twice each. Results and honest caveats: [`docs/benchmark.md`](docs/benchmark.md).

## Where it does not work
- Reviews of real calls depend on speech recognition: numbers and names can be misheard (the UI warns and lets you listen to the recording).
- Evaluation is a language model: scores and advice can be noisy, and one evaluation takes 30-60 s.
- Voices are generic library voices; accents and ages are approximate. Without headphones the background noise can leak into the microphone.
- The knowledge base is a single JSON file with no access control. It is filtered and capped, and rules can be deleted manually, but it is not poison-proof.
- The benchmark is small and synthetic. It does not prove accuracy on real calls.

## Security and hygiene
- Keys live only in `.env.local` (git-ignored); `.env.example` has no values. Nothing secret is bundled into client code (private scenario data is imported only by server routes).
- amoCRM tokens are stored only in encrypted, `httpOnly` cookies (AES-256-GCM, `CRM_SESSION_SECRET`), one per connected account, at most 6. Recording URLs come from the CRM server-side, never from the browser; only `amocrm.ru`, `amocrm.com` and `kommo.com` hosts are accepted.
- The product reads text written by others (transcripts, CRM calls). Mitigations against prompt injection: transcripts are passed as untrusted data, model output is validated with Zod, and knowledge-base entries are sanitized (no prices, discounts, links or instructions) and only learned "do" rules from calls without contradicting claims.
- The agents have **no tools** that act on the outside world; the CRM integration is read-only.
- API routes are rate limited per IP; every failure shows a clear message instead of a blank screen.
- Tests and examples use only synthetic, anonymized data. Dependencies are pinned by `package-lock.json`; `npm audit` reports 0 vulnerabilities.
- Disclaimer: this is a training simulator. It does not provide medical, legal or financial advice. Call recordings and transcripts can contain personal data: get the required consents before sending them to third-party APIs.

## Stack
Next.js (App Router), TypeScript, Tailwind v4, `@elevenlabs/react`, `@google/genai`, Zod.

## License
MIT, see [LICENSE](LICENSE).
