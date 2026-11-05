// Doctors who have left the clinic (the brief's «Врачи, которые уволились», lib/legend.ts). Patient 25 asks for one of
// them: the call variant ("d1".."d3", picked at random on the call page) says which. Without the clinic's own list the
// fictional ones below are used. "{{former}}" in the patient's texts becomes the full name, "{{former_name}}" the name
// and patronymic he calls the doctor by.
import type { ClinicContext } from "./clinic-context.ts";

export const DEFAULT_FORMER_DOCTORS = ["Лаврова Алина Денисовна", "Громов Артём Викторович", "Ефимова Ольга Сергеевна"];

/** The former doctors the trainings use: the clinic's list, or the fictional ones. */
export function formerDoctors(ctx: Pick<ClinicContext, "formerDoctors">): string[] {
  return ctx.formerDoctors.length ? ctx.formerDoctors : DEFAULT_FORMER_DOCTORS;
}

/** The doctor of this call variant ("d2" is the second); a short list repeats from the start. */
export function formerDoctorFor(ctx: Pick<ClinicContext, "formerDoctors">, variantId: string): { full: string; name: string } {
  const list = formerDoctors(ctx);
  const n = Math.max(0, Number(variantId.replace(/\D/g, "")) - 1 || 0);
  const full = list[n % list.length];
  // «Фамилия Имя Отчество» → «Имя Отчество»; any other spelling is used as it is.
  const parts = full.split(" ");
  return { full, name: parts.length === 3 && /(вна|вич|чна|ична|кызы|оглы)$/.test(parts[2]) ? `${parts[1]} ${parts[2]}` : full };
}

export function fillFormer(text: string, ctx: Pick<ClinicContext, "formerDoctors">, variantId: string): string {
  if (!text.includes("{{former")) return text;
  const d = formerDoctorFor(ctx, variantId);
  return text.replaceAll("{{former_name}}", d.name).replaceAll("{{former}}", d.full);
}
