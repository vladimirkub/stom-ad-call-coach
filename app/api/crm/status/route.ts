import { NextResponse } from "next/server";
import { listConns } from "@/lib/crm/session";

export async function GET() {
  const all = await listConns().catch(() => []);
  return NextResponse.json({ connections: all.map((c) => ({ id: c.id, name: c.name, subdomain: c.subdomain, domain: c.domain })) });
}
