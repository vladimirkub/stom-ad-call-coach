import { cookies } from "next/headers";
import { seal, unseal } from "./seal.ts";
import { CrmError, MAX_CONNECTIONS, connectionId, cookieNameFor, type Conn } from "./amocrm.ts";

const MAX_AGE = 60 * 60 * 8;

type Saved = Conn & { name: string; exp: number };
export type StoredConn = Conn & { id: string; name: string };

/** All valid connections of this browser (one sealed cookie each; the old single-cookie format is read too). */
export async function listConns(): Promise<StoredConn[]> {
  const out = new Map<string, StoredConn>();
  for (const c of (await cookies()).getAll()) {
    if (!c.name.startsWith("crm_")) continue;
    const saved = unseal<Saved>(c.value);
    if (!saved || saved.exp <= Date.now()) continue;
    const id = connectionId(saved);
    if (!out.has(id)) out.set(id, { ...saved, id });
  }
  return [...out.values()];
}

/** The requested connection, or the only one if none is named. */
export async function getConn(id?: string | null): Promise<StoredConn | null> {
  const all = await listConns();
  if (id) return all.find((c) => c.id === id) ?? null;
  return all.length === 1 ? all[0] : null;
}

export async function saveConn(conn: Conn, name: string): Promise<StoredConn> {
  const id = connectionId(conn);
  const existing = await listConns();
  if (!existing.some((c) => c.id === id) && existing.length >= MAX_CONNECTIONS) {
    throw new CrmError(`Можно подключить не больше ${MAX_CONNECTIONS} CRM. Отключите ненужную и повторите.`, 409);
  }
  (await cookies()).set(cookieNameFor(id), seal({ ...conn, name, exp: Date.now() + MAX_AGE * 1000 } satisfies Saved), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: MAX_AGE,
  });
  return { ...conn, id, name };
}

export async function clearConn(id: string) {
  const jar = await cookies();
  for (const c of jar.getAll()) {
    if (!c.name.startsWith("crm_")) continue;
    const saved = unseal<Saved>(c.value);
    if (saved && connectionId(saved) === id) jar.delete(c.name);
  }
}
