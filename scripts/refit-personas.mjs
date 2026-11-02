// Re-fits every clinic's patients to its approved legend (after the fitting rules change). A patient whose fit fails
// keeps its previous version. Run on the server: set -a && . ./.env.local && set +a && node scripts/refit-personas.mjs
import { db } from "../lib/db.ts";
import { fitPersona } from "../lib/persona-fit.ts";
import { assignDirections, getDirections } from "../lib/directions.ts";
import { getWishes } from "../lib/legend.ts";
import pub from "../lib/scenarios-public.json" with { type: "json" };

const legends = db().prepare("SELECT id, clinic_id AS clinicId, facts, personas FROM legends WHERE status = 'approved'").all();
for (const l of legends) {
  const facts = JSON.parse(l.facts);
  const plan = assignDirections(getDirections(l.clinicId));
  const personas = JSON.parse(l.personas);
  const results = await Promise.allSettled(pub.map(async (s) => [s.id, await fitPersona(s.id, facts, plan[s.id], getWishes(l.clinicId))]));
  let ok = 0;
  for (const r of results) if (r.status === "fulfilled") (personas[r.value[0]] = r.value[1]), ok++;
  db().prepare("UPDATE legends SET personas = ?, personas_status = 'ready', personas_error = NULL WHERE id = ?").run(JSON.stringify(personas), l.id);
  console.log(`clinic ${l.clinicId}: re-fitted ${ok}/${pub.length}`);
}
