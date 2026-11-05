// The one-button page's next patient (/call), per account rather than per browser: the administrator meets every patient
// before any comes round again, whatever device they train on. Attempts are voice calls that started (usage) and text
// trainings (trainings); a voice call ElevenLabs refused does not count.
import { db } from "./db.ts";

type Attempt = { id: string; at: number };

/** The patient tried least often, never the last one when there is a choice; random among equals. */
export function pickNext(ids: string[], attempts: Attempt[], random = Math.random): string {
  const last = attempts.reduce<Attempt | null>((m, a) => (!m || a.at > m.at ? a : m), null)?.id;
  const tries = (id: string) => attempts.filter((a) => a.id === id).length;
  const pool = ids.length > 1 ? ids.filter((id) => id !== last) : ids;
  const least = Math.min(...pool.map(tries));
  const fresh = pool.filter((id) => tries(id) === least);
  return fresh[Math.floor(random() * fresh.length)];
}

/** This administrator's attempts with each patient. */
export function attemptsOf(userId: number): Attempt[] {
  const voice = db()
    .prepare("SELECT scenario_id AS id, started_at AS at FROM usage WHERE user_id = ? AND kind = 'patient' AND scenario_id IS NOT NULL AND (status IS NULL OR status != 'failed')")
    .all(userId) as Attempt[];
  const text = db().prepare("SELECT scenario_id AS id, started_at AS at FROM trainings WHERE user_id = ? AND mode = 'text'").all(userId) as Attempt[];
  return [...voice, ...text];
}
