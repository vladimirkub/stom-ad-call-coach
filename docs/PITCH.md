# Pitch kit (3–5 min + judges' questions)

## One-liner
**Stom AD Call Coach**: a voice trainer for dental call-center operators. AI patients with hidden objections train human operators; a virtual operator calls *you*, and everything it learns is saved to a shared knowledge base that is injected into its next call.

## 4-minute script (live demo)

| Time | What to say / show |
|---|---|
| 0:00 | **Problem.** Clinics pay for ads, leads leave a request, an operator calls back, and a large share of patients never book or never show up. Operators are trained on theory, not on live objections. |
| 0:30 | **Demo 1, trainer.** Open the home page, pick *Svetlana* ("I need to ask my husband"). Call by voice. The AI patient hides the real reason and reveals it only to open, empathic questions. Finish the call. |
| 1:30 | **Result page.** Show the checklist (21 criteria, 4 skills), key moments tied to transcript turns, the revealed hidden objection, and the "do this next time" phrases. Scores are computed in code from the checklist, not invented by the model. |
| 2:15 | **Demo 2, reverse.** Open *Virtual operator*. You are the patient, with no script: improvise. Show the operator adapting; hang up. |
| 3:15 | **Knowledge base.** Open *Knowledge base*: practices extracted from the review, each with a confirmation counter. Start another call and point at "the operator uses N practices from the knowledge base". |
| 3:45 | **Open source.** Gemma 4 (Apache 2.0) does evaluation, learning and the text fallback; ElevenLabs does voices, speech recognition and agents. MIT repo. |

## The three questions every team gets

### 1. How is your product better than the same model without your layer, and how did you check?
See `docs/benchmark.md`: 6 synthetic, anonymized calls of known quality (2 strong, 2 medium, 2 weak), each run twice through **bare Gemma 4** ("rate this call 0-100") and through **our layer** (clinic facts + 20-criteria checklist + deterministic scoring). Report the table from that file: tier separation, run-to-run spread, and whether invented/contradicting claims were flagged. Be explicit that n is small and the calls are synthetic.

### 2. Where does it not work?
- Evaluation of real calls depends on speech recognition: numbers and names can be misheard, which can look like a "false claim". The UI warns about this and offers listening to the recording.
- The evaluator is a language model: scores and advice can be wrong or noisy; one evaluation takes 30–60 s.
- Voices are generic library voices; ages and emotions are approximate. Background noise can leak into the microphone without headphones.
- The knowledge base is one shared JSON file with no access control and no real validation of "truth": a malicious caller could try to poison it (mitigated by filters and manual deletion, not eliminated).
- It covers outbound lead calls for a dental clinic; it does not give medical advice.
- Our synthetic benchmark is small and does not prove accuracy on real calls.

### 3. How many steps does a new user need to get value?
Open the link, press **"Start"** on a patient, allow the microphone, talk. About 3 steps and under 2 minutes to the first scored breakdown. (Self-hosting is `npm install`, copy `.env.example`, `npm run create-agent`, `npm run dev`.)

## Files judges may ask for
- Where the expertise lives: `lib/rubric.ts` (21-criterion checklist), `lib/scenarios-private.json` + `lib/clinic.json` (patients, hidden objections, clinic facts), `lib/operator.ts` (operator playbook), `lib/kb.ts` (knowledge base).
- Where the model is called: `lib/gemma.ts` (Gemma 4 through the Gemini API), used by `app/api/evaluate`, `chat`, `model-script`, `knowledge/learn`.
- Where ElevenLabs is called: `scripts/create-agent.mjs` (agents), `app/api/signed-url` and `app/api/operator/start` (sessions), `lib/stt.ts` (Scribe v2).
