// The clinic's best administrators this month, for the /call page: the top three by average score, with the
// administrator's own place. The month is the calendar month in Moscow time; only the clinic's counted administrators
// (not the manager or technical accounts) with at least MIN_CALLS evaluated calls this month take part.
import { db } from "./db.ts";
import { COUNTED_TRAINEE } from "./auth.ts";

export const MIN_CALLS = 3;
const MSK = 3 * 3600_000;
const MONTHS = ["января", "февраля", "марта", "апреля", "мая", "июня", "июля", "августа", "сентября", "октября", "ноября", "декабря"];

/** The start of the current month in Moscow, as a timestamp, and its name in the genitive («ноября»). */
export function monthStart(now = Date.now()): { start: number; name: string } {
  const msk = new Date(now + MSK);
  return { start: Date.UTC(msk.getUTCFullYear(), msk.getUTCMonth(), 1) - MSK, name: MONTHS[msk.getUTCMonth()] };
}

type Row = { id: number; firstName: string; lastName: string; calls: number; average: number };

export function monthBoard(clinicId: number, userId: number, now = Date.now()) {
  const { start, name } = monthStart(now);
  const rows = db()
    .prepare(
      `SELECT u.id, u.first_name AS firstName, u.last_name AS lastName, COUNT(t.id) AS calls, AVG(t.total) AS average
       FROM trainings t JOIN users u ON u.id = t.user_id
       WHERE t.clinic_id = ? AND t.started_at >= ? AND u.active = 1 AND ${COUNTED_TRAINEE()}
       GROUP BY u.id`,
    )
    .all(clinicId, start) as Row[];
  // Ties go to whoever made more calls.
  const ranked = rows.filter((r) => r.calls >= MIN_CALLS).sort((a, b) => b.average - a.average || b.calls - a.calls);
  const me = rows.find((r) => r.id === userId);
  const place = ranked.findIndex((r) => r.id === userId);
  // The manager and technical accounts train outside the team's figures, so outside the board too.
  const counted = !!db().prepare(`SELECT 1 FROM users u WHERE u.id = ? AND ${COUNTED_TRAINEE()}`).get(userId);
  return {
    month: name,
    minCalls: MIN_CALLS,
    top: ranked.slice(0, 3).map((r) => ({ name: `${r.lastName} ${r.firstName}`.trim(), average: Math.round(r.average), calls: r.calls, me: r.id === userId })),
    me: { counted, calls: me?.calls ?? 0, average: me ? Math.round(me.average) : null, place: place === -1 ? null : place + 1, of: ranked.length },
  };
}
