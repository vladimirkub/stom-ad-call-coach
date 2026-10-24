import test from "node:test";
import assert from "node:assert/strict";
import { parseAccount, parseCallNotes, maskPhone, connectionId, cookieNameFor, MAX_CONNECTIONS } from "../lib/crm/amocrm.ts";
import { seal, unseal } from "../lib/crm/seal.ts";
import { groupBySpeaker, formatTurns } from "../lib/parse.ts";

process.env.CRM_SESSION_SECRET = "test-secret-test-secret-test-secret";

test("parseAccount accepts only known amoCRM/Kommo hosts (no SSRF)", () => {
  assert.deepEqual(parseAccount("mycompany"), { subdomain: "mycompany", domain: "amocrm.ru" });
  assert.deepEqual(parseAccount("https://MyCompany.amocrm.ru/leads/"), { subdomain: "mycompany", domain: "amocrm.ru" });
  assert.deepEqual(parseAccount("acme.kommo.com"), { subdomain: "acme", domain: "kommo.com" });
  assert.equal(parseAccount("evil.com"), null);
  assert.equal(parseAccount("acme.amocrm.ru.evil.com"), null);
  assert.equal(parseAccount("127.0.0.1"), null);
  assert.equal(parseAccount("a@b"), null);
});

test("maskPhone keeps only the last four digits", () => {
  assert.equal(maskPhone("+7 (999) 123-45-67"), "•••• 4567");
  assert.equal(maskPhone(undefined), "—");
});

// Fixture shaped like the official docs: note_type call_in/call_out, params.{uniq,duration,source,link,phone,call_responsible}.
test("parseCallNotes extracts calls and ignores other notes", () => {
  const payload = {
    _embedded: {
      notes: [
        { id: 1, created_at: 1700000000, note_type: "call_out", params: { uniq: "u1", duration: 60, source: "onlinePBX", link: "https://example.com/r.mp3", phone: "+79990001122", call_responsible: "Анна" } },
        { id: 2, created_at: 1700000100, note_type: "call_in", params: { uniq: "u2", duration: "12", phone: "+79990003344" } },
        { id: 3, created_at: 1700000200, note_type: "common", params: { text: "заметка" } },
        { id: 4, created_at: 1700000300, note_type: "call_out", params: { duration: 5, link: "http://insecure.example/r.mp3" } },
      ],
    },
  };
  const calls = parseCallNotes(payload, "contacts");
  assert.equal(calls.length, 3);
  assert.deepEqual([calls[0].direction, calls[0].duration, calls[0].hasRecording, calls[0].phone, calls[0].responsible], ["out", 60, true, "•••• 1122", "Анна"]);
  assert.equal(calls[1].duration, 12);
  assert.equal(calls[1].hasRecording, false);
  assert.equal(calls[2].hasRecording, false); // http:// links are not accepted
  assert.deepEqual(parseCallNotes(null, "leads"), []);
});

test("session seal round-trips and rejects tampering", () => {
  const sealed = seal({ token: "secret-token", exp: 1 });
  assert.ok(!sealed.includes("secret-token"));
  assert.deepEqual(unseal(sealed), { token: "secret-token", exp: 1 });
  assert.equal(unseal(sealed.slice(0, -2) + "AA"), null);
  assert.equal(unseal("garbage"), null);
});

// Fixture shaped like the documented Scribe response: words[] with text/type/speaker_id.
test("groupBySpeaker merges consecutive words and skips non-words", () => {
  const words = [
    { text: "Алло", type: "word", speaker_id: "speaker_1" },
    { text: " ", type: "spacing", speaker_id: "speaker_1" },
    { text: "Добрый", type: "word", speaker_id: "speaker_0" },
    { text: "день", type: "word", speaker_id: "speaker_0" },
    { text: "(смех)", type: "audio_event", speaker_id: "speaker_0" },
    { text: "Слушаю", type: "word", speaker_id: "speaker_1" },
  ];
  const turns = groupBySpeaker(words);
  assert.deepEqual(turns, [
    { speaker: "speaker_1", text: "Алло" },
    { speaker: "speaker_0", text: "Добрый день" },
    { speaker: "speaker_1", text: "Слушаю" },
  ]);
  assert.equal(formatTurns(turns, "speaker_0"), "Пациент: Алло\nОператор: Добрый день\nПациент: Слушаю");
  assert.deepEqual(groupBySpeaker([], "просто текст"), [{ speaker: "speaker_0", text: "просто текст" }]);
});

test("each connection gets a distinct, cookie-safe name", () => {
  const a = connectionId({ subdomain: "clinic-a", domain: "amocrm.ru" });
  const b = connectionId({ subdomain: "clinic-a", domain: "kommo.com" });
  assert.notEqual(a, b);
  assert.equal(cookieNameFor(a), "crm_clinic-a_amocrm_ru");
  assert.match(cookieNameFor(b), /^crm_[a-z0-9_-]+$/);
  assert.notEqual(cookieNameFor(a), "crm_session"); // never collides with the legacy single cookie
  assert.ok(MAX_CONNECTIONS >= 2 && MAX_CONNECTIONS <= 10);
});
