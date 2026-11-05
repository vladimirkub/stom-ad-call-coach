import test from "node:test";
import assert from "node:assert/strict";

process.env.DB_PATH = ":memory:";
const { formerDoctorFor, fillFormer, DEFAULT_FORMER_DOCTORS } = await import("../lib/former-doctors.ts");
const { cleanFormerDoctors } = await import("../lib/legend.ts");

test("each call variant names one former doctor; without the clinic's list the fictional ones", () => {
  const own = { formerDoctors: ["Залесская Снежана Денисовна", "Орлов Игорь Петрович"] };
  assert.deepEqual(formerDoctorFor(own, "d1"), { full: "Залесская Снежана Денисовна", name: "Снежана Денисовна" });
  assert.deepEqual(formerDoctorFor(own, "d2"), { full: "Орлов Игорь Петрович", name: "Игорь Петрович" });
  assert.equal(formerDoctorFor(own, "d3").full, "Залесская Снежана Денисовна");
  assert.equal(formerDoctorFor({ formerDoctors: [] }, "d2").full, DEFAULT_FORMER_DOCTORS[1]);
  assert.equal(formerDoctorFor({ formerDoctors: ["доктор Анна"] }, "d1").name, "доктор Анна");
  assert.equal(fillFormer("а {{former}} у вас ещё принимает? {{former_name}}", own, "d2"), "а Орлов Игорь Петрович у вас ещё принимает? Игорь Петрович");
});

test("the brief keeps at most three trimmed names", () => {
  assert.deepEqual(cleanFormerDoctors(["  Иванова  Мария Петровна ", "", "Б", "В", "Г"]), ["Иванова Мария Петровна", "Б", "В"]);
  assert.deepEqual(cleanFormerDoctors(undefined), []);
  assert.throws(() => cleanFormerDoctors("Иванова"));
});
