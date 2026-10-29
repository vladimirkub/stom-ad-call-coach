// Draft subscription plans for clinics after the beta, and which one a clinic's usage points to. Nothing is limited yet:
// the admin only shows the suggestion, so the owner knows which plan to put in each contract.
export const PLANS = [
  { key: "start", label: "Старт", priceRub: 7900, admins: 3, minutes: 150 },
  { key: "clinic", label: "Клиника", priceRub: 14900, admins: 8, minutes: 400 },
  { key: "network", label: "Сеть", priceRub: 29900, admins: Infinity, minutes: 1000 },
] as const;
export type PlanKey = (typeof PLANS)[number]["key"];

/** Voice minutes over the plan, charged on top. */
export const OVERAGE_RUB_PER_MIN = 15;
/** Rough rate for showing dollar costs in roubles (Bank of Russia, late October 2026). */
export const USD_RUB = 80.5;

/** The smallest plan that covers both the clinic's administrators and its voice minutes; extra minutes past "Сеть" are overage. */
export function recommendPlan(admins: number, minutes: number) {
  const plan = PLANS.find((p) => admins <= p.admins && minutes <= p.minutes) ?? PLANS[PLANS.length - 1];
  const extra = Math.max(0, Math.ceil(minutes - plan.minutes));
  return { key: plan.key as PlanKey, label: plan.label, priceRub: plan.priceRub + extra * OVERAGE_RUB_PER_MIN, extraMinutes: extra };
}
