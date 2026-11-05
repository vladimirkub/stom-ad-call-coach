import { NextResponse } from "next/server";
import { requireManager } from "@/lib/session";
import { applyDraft, isAutonomous, rollbackTo, saveSetup, setupState, startRebuild } from "@/lib/clinic-setup";
import { DIRECTIONS } from "@/lib/directions";
import { discardDraft, expireStaleAnalyses, SECTIONS } from "@/lib/legend";

// The clinic manager's own setup (lib/clinic-setup.ts). GET the state; POST { action: "save", ...fields } saves the
// fields, "rebuild" saves them and starts a rebuild, "apply" (facts?) applies the reviewed draft, "discard" drops it,
// "rollback" { version } returns to an older version. A clinic that is not autonomous gets { autonomous: false } and
// keeps the proposals page.
function state(clinicId: number) {
  expireStaleAnalyses();
  return { autonomous: true, sections: SECTIONS, options: DIRECTIONS.map(({ key, label, hint }) => ({ key, label, hint })), ...setupState(clinicId) };
}

export async function GET() {
  const gate = await requireManager();
  if ("denied" in gate) return gate.denied;
  const clinicId = gate.manager.clinic.id;
  if (!isAutonomous(clinicId)) return NextResponse.json({ autonomous: false });
  return NextResponse.json(state(clinicId));
}

export async function POST(req: Request) {
  const gate = await requireManager();
  if ("denied" in gate) return gate.denied;
  const { manager } = gate;
  const clinicId = manager.clinic.id;
  if (!isAutonomous(clinicId)) return NextResponse.json({ error: "Настройки клиники меняются через Stom AD" }, { status: 403 });
  const body = await req.json().catch(() => null);
  const author = `${manager.firstName} ${manager.lastName}`.trim() || manager.login;
  try {
    switch (body?.action) {
      case "save":
        saveSetup(clinicId, body);
        break;
      case "rebuild":
        saveSetup(clinicId, body);
        startRebuild(clinicId, author);
        break;
      case "apply":
        applyDraft(clinicId, author, body.facts);
        break;
      case "discard":
        discardDraft(clinicId);
        break;
      case "rollback":
        rollbackTo(clinicId, Number(body.version), author);
        break;
      default:
        return NextResponse.json({ error: "Неизвестное действие" }, { status: 400 });
    }
    return NextResponse.json(state(clinicId));
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Не удалось выполнить" }, { status: 400 });
  }
}
