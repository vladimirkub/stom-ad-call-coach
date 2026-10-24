// Minimal in-memory rate limit (per client IP, per route group) for the public demo.
// Good enough for a single instance; a shared store (Redis) would be needed behind several instances.
type Bucket = { count: number; reset: number };
const buckets = new Map<string, Bucket>();

export function rateLimit(req: Request, group: string, limit: number, windowMs = 60_000): Response | null {
  const ip = (req.headers.get("x-forwarded-for") ?? "local").split(",")[0].trim();
  const key = `${group}:${ip}`;
  const now = Date.now();
  const b = buckets.get(key);
  if (!b || b.reset <= now) {
    buckets.set(key, { count: 1, reset: now + windowMs });
    if (buckets.size > 5000) for (const [k, v] of buckets) if (v.reset <= now) buckets.delete(k);
    return null;
  }
  if (++b.count > limit) {
    const retry = Math.ceil((b.reset - now) / 1000);
    return Response.json({ error: `Слишком много запросов. Повторите через ${retry} с.` }, { status: 429, headers: { "Retry-After": String(retry) } });
  }
  return null;
}
