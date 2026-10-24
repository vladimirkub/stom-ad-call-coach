// Measures what our layer adds over the SAME model (Gemma 4) used bare.
//   Run the app (npm run dev), then: BASE_URL=http://localhost:3000 node scripts/benchmark.mjs
// For each synthetic call (known quality tier) it runs the bare model ("rate 0-100") and our pipeline
// (clinic facts + 20-criteria checklist + deterministic scoring) REPEATS times, then prints a table.
import { readFileSync } from "node:fs";

const BASE = process.env.BASE_URL || "http://localhost:3000";
const REPEATS = Number(process.env.REPEATS || 2);
const { calls } = JSON.parse(readFileSync(new URL("../docs/benchmark-calls.json", import.meta.url), "utf8"));

async function post(path, body) {
  for (let attempt = 0; attempt < 4; attempt++) {
    const res = await fetch(`${BASE}${path}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    if (res.status === 429) { await new Promise((r) => setTimeout(r, 20000)); continue; }
    if (!res.ok) throw new Error(`${path} ${res.status} ${(await res.text()).slice(0, 120)}`);
    return res.json();
  }
  throw new Error(`${path}: rate limited`);
}

const jobs = [];
for (const [id, c] of Object.entries(calls)) {
  for (let i = 0; i < REPEATS; i++) {
    jobs.push(post("/api/baseline", { transcript: c.transcript }).then((r) => ({ id, tier: c.tier, m: "bare", score: r.score })).catch((e) => ({ id, tier: c.tier, m: "bare", error: String(e) })));
    jobs.push(post("/api/evaluate", { scenarioId: "real", transcript: c.transcript }).then((r) => ({ id, tier: c.tier, m: "ours", score: r.total, flags: r.unsupportedClaims.length, booked: r.appointmentBooked })).catch((e) => ({ id, tier: c.tier, m: "ours", error: String(e) })));
  }
}
const results = (await Promise.all(jobs)).flat();
const errors = results.filter((r) => r.error);

const mean = (a) => a.reduce((x, y) => x + y, 0) / a.length;
const rows = {};
for (const m of ["bare", "ours"]) {
  const byCall = {};
  for (const r of results.filter((x) => x.m === m && !x.error)) (byCall[r.id] ??= []).push(r);
  const stats = Object.entries(byCall).map(([id, rs]) => ({ id, tier: rs[0].tier, mean: mean(rs.map((r) => r.score)), spread: Math.max(...rs.map((r) => r.score)) - Math.min(...rs.map((r) => r.score)), flags: mean(rs.map((r) => r.flags ?? 0)) }));
  const tierMean = (t) => mean(stats.filter((s) => s.tier === t).map((s) => s.mean));
  const minOf = (t) => Math.min(...stats.filter((s) => s.tier === t).map((s) => s.mean));
  const maxOf = (t) => Math.max(...stats.filter((s) => s.tier === t).map((s) => s.mean));
  rows[m] = {
    stats,
    strong: tierMean("strong"), medium: tierMean("medium"), weak: tierMean("weak"),
    // tiers separated if every strong call outscores every medium call and every medium outscores every weak one
    separated: minOf("strong") > maxOf("medium") && minOf("medium") > maxOf("weak"),
    avgSpread: mean(stats.map((s) => s.spread)),
    weak1Flags: stats.find((s) => s.id === "weak_1")?.flags,
  };
}
console.log(`Runs per call: ${REPEATS}, errors: ${errors.length}`);
console.log("\ncall      tier     bare(mean, spread)   ours(mean, spread, false-claims flagged)");
for (const s of rows.ours.stats) {
  const b = rows.bare.stats.find((x) => x.id === s.id);
  console.log(`${s.id.padEnd(9)} ${s.tier.padEnd(8)} ${b ? `${b.mean.toFixed(0)} (±${b.spread})`.padEnd(20) : "n/a".padEnd(20)} ${s.mean.toFixed(0)} (±${s.spread}, flags ${s.flags})`);
}
for (const m of ["bare", "ours"]) {
  const r = rows[m];
  console.log(`\n${m}: strong ${r.strong.toFixed(0)} / medium ${r.medium.toFixed(0)} / weak ${r.weak.toFixed(0)} | tiers fully separated: ${r.separated} | avg run-to-run spread: ${r.avgSpread.toFixed(1)}`);
}
if (errors.length) console.log("\nerrors:", errors.slice(0, 3));
