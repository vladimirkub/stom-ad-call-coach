import { test } from "node:test";
import assert from "node:assert/strict";
import { closingMinutes, clinicHours, fillHours } from "../lib/clinic-hours.ts";
import { clinicContext } from "../lib/clinic-context.ts";

const ctx = (texts) => ({ ...clinicContext(null), facts: texts.map((text) => ({ section: "contacts", text })) });

test("closing time is the latest evening end in the clinic's hours", () => {
  assert.equal(closingMinutes("Пн–Пт 9:00–21:00, Сб 10:00–18:00"), 21 * 60);
  assert.equal(closingMinutes("Работает ежедневно с 10:00 до 20:00."), 20 * 60);
  assert.equal(closingMinutes("Телефон +7 999 000-00-00"), null);
});

test("the late slot is 40 minutes before closing, 21:00 when the legend has no hours", () => {
  assert.deepEqual(clinicHours(ctx(["Пн–Сб 9:00–21:00"])), { close: "21:00", slot: "20:20", late: "20:25" });
  assert.deepEqual(clinicHours(ctx(["Ежедневно с 10:00 до 20:30"])), { close: "20:30", slot: "19:50", late: "19:55" });
  assert.equal(clinicHours(ctx(["Работаем круглосуточно"])).slot, "20:20");
  assert.equal(clinicHours(ctx(["Колл-центр клиники работает ежедневно с 08:00 до 22:00 по телефону +7 (495) 106-81-81."])).close, "21:00");
  assert.equal(clinicHours(clinicContext(null)).close, "20:00");
  assert.equal(fillHours("до {{close}}, окно {{slot}}, опоздание {{late}}", ctx(["9:00-21:00"])), "до 21:00, окно 20:20, опоздание 20:25");
});
