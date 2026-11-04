import { z } from "zod";
import type { ChecklistItem, Scores } from "./scoring";

const skill = z.number().int().min(0).max(10).nullable();

export const EvaluationSchema = z.object({
  // Compact: ids of passed criteria + short notes for missed ones (keeps the response small and fast).
  passed: z.array(z.string()),
  missed: z.array(z.object({ id: z.string(), note: z.string() })).default([]),
  moments: z
    .array(z.object({ turn: z.number().int().min(1), kind: z.enum(["good", "miss"]), comment: z.string().min(1) }))
    .max(8)
    .default([]),
  appointmentBooked: z.boolean(),
  // The patient's turn where they agreed to the booking; 0 when they did not.
  agreedTurn: z.number().int().min(0).default(0),
  // Danger signs after treatment: the operator put the patient through to a doctor or sent them to urgent care at once.
  urgentRouted: z.boolean().default(false),
  objectionUncovered: z.boolean(),
  objectionEvidence: z.string().default(""),
  unsupportedClaims: z.array(z.string()).max(5).default([]),
  summary: z.string().min(1),
  // A very weak call may genuinely have no strengths.
  strengths: z.array(z.string().min(1)).max(5).default([]),
  improvements: z.array(z.string().min(1)).min(1).max(5),
  // The clinic's wishes for training (lib/legend.ts), checked one topic at a time; empty when the clinic has none.
  wishes: z.array(z.object({ topic: z.string().min(1), done: z.boolean(), note: z.string().default("") })).max(6).default([]),
});
export type Evaluation = z.infer<typeof EvaluationSchema>;

export const TurnSchema = z.object({
  role: z.enum(["user", "agent"]),
  text: z.string().min(1).max(2000),
});
export const TranscriptSchema = z.array(TurnSchema).min(1).max(100);
export type Turn = z.infer<typeof TurnSchema>;

export type Moment = { turn: number; kind: "good" | "miss"; comment: string };

export type EvaluationResult = Omit<Evaluation, "passed" | "missed" | "moments"> & {
  scores: Scores;
  checklist: ChecklistItem[];
  moments: Moment[];
  total: number;
  // Empty for real-call analysis (no known hidden objection).
  hiddenObjection: string;
  showUpRisk: string;
};

export const ModelScriptSchema = z.object({
  intro: z.string().min(1),
  dialogue: z
    .array(
      z.object({
        role: z.enum(["operator", "patient"]),
        text: z.string().min(1),
        // Why this operator line works. Only for operator lines.
        tip: z.string().optional(),
      }),
    )
    .min(8)
    .max(30),
  comparisons: z
    .array(z.object({ yours: z.string().min(1), better: z.string().min(1), why: z.string().min(1) }))
    .max(4)
    .default([]),
  keyPhrases: z.array(z.string().min(1)).min(3).max(8),
});
export type ModelScript = z.infer<typeof ModelScriptSchema>;

export const ScoresInputSchema = z.object({
  discovery: skill,
  objectionHandling: skill,
  booking: skill,
  showUp: skill,
});
