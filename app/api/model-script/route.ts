import { NextResponse } from "next/server";
import { rateLimit } from "@/lib/ratelimit";
import { ModelScriptSchema, ScoresInputSchema, TranscriptSchema } from "@/lib/schemas";
import { gemmaJson } from "@/lib/gemma";
import { SKILLS } from "@/lib/scoring";
import { getScenario } from "@/lib/scenarios";
import clinic from "@/lib/clinic.json";

const SYSTEM = `Ты — опытный тренер колл-центра стоматологической клиники. Ты пишешь ЭТАЛОННЫЙ разговор: как сильный оператор перезванивает пациенту, оставившему заявку, отрабатывает его возражения, записывает на приём и делает так, чтобы пациент пришёл.
Жёсткие правила:
- Используй ТОЛЬКО факты из списка «Факты с сайта клиники». Чего там нет (точный адрес, метро, процент и срок рассрочки, условия гарантии клиники), не выдумывай: оператор честно говорит «уточню у врача» или «пришлю в СМС после записи».
- Не обещай «100% без боли», «гарантию на всё» и подобного. Не давай ложного дефицита.
- Реплики пациента в диалоге должны быть правдоподобными для его профиля: он раскрывает настоящую причину сомнений, только когда оператор задал честный открытый вопрос.
- Эталон включает: представление и вопрос «удобно ли говорить»; подтверждение заявки; открытые вопросы, которые выводят на скрытую причину; ответ на причину по фактам; два конкретных варианта времени с учётом ограничений пациента; фиксацию записи; закрепление явки (повтор даты и времени, как добраться, что мешает прийти, согласие на СМС-напоминание, просьба предупредить о переносе заранее).
- ЗАПРЕЩЕНО давить дефицитом и срочностью («осталось 3 места», «успейте до конца недели»), даже если это написано на сайте. Срок акции можно один раз спокойно упомянуть как информацию, без нажима. Пояснения tip описывают технику общения и не учат манипуляциям.
- Разговор ОБЯЗАН подвести пациента к раскрытию скрытой причины: у оператора минимум два открытых вопроса с сочувствием («что вас беспокоит?», «что останавливало до сих пор?»), и пациент в ответ называет причину СВОИМИ СЛОВАМИ. Только ПОСЛЕ этого оператор отвечает на неё по фактам сайта. Нельзя отвечать на причину, которую пациент ещё не назвал.
- Оператор НЕ принимает расплывчатое «если получится»: уточняет и получает от пациента чёткое «буду».
- Усиль те навыки, где оценка оператора самая низкая.
- К каждой реплике оператора добавь короткое пояснение tip (одно предложение: почему это работает). У реплик пациента tip не нужен.
- В comparisons возьми 2–3 РЕАЛЬНЫЕ слабые фразы оператора из его транскрипта (цитируй дословно в yours), дай улучшенную формулировку better и коротко why. better должна быть строго лучше исходной. Не включай фразы, которые указаны среди «Что у оператора получилось» (хорошие приёмы нельзя «исправлять»), и никогда не заменяй открытый вопрос закрытым. Если не уверен, верни пустой список.
- keyPhrases: 3–6 коротких фраз, которые оператору стоит запомнить.
Всё пиши ПО-РУССКИ. Ответь ТОЛЬКО одним JSON-объектом, без markdown, формы:
{"intro":"1–2 предложения о том, на что обратить внимание","dialogue":[{"role":"operator","text":"...","tip":"..."},{"role":"patient","text":"..."}],"comparisons":[{"yours":"...","better":"...","why":"..."}],"keyPhrases":["..."]}`;

export async function POST(req: Request) {
  const limited = rateLimit(req, "llm", 12);
  if (limited) return limited;
  const body = await req.json().catch(() => null);
  const scenario = getScenario(body?.scenarioId);
  const transcript = TranscriptSchema.safeParse(body?.transcript);
  const scores = ScoresInputSchema.safeParse(body?.scores);
  if (!scenario || !transcript.success || !scores.success) {
    return NextResponse.json({ error: "Некорректный запрос" }, { status: 400 });
  }

  const list = (v: unknown) =>
    Array.isArray(v) ? v.filter((x): x is string => typeof x === "string").slice(0, 5).map((x) => `- ${x.slice(0, 400)}`).join("\n") : "";
  const scoreLines = SKILLS.map((s) => `- ${s.label}: ${scores.data[s.key]}/10`).join("\n");
  const text = transcript.data.map((t) => `${t.role === "user" ? "ОПЕРАТОР" : "ПАЦИЕНТ"}: ${t.text}`).join("\n");
  const prompt = `Пациент: ${scenario.name}, ${scenario.age} лет. ${scenario.lead}
Скрытая причина сомнений: ${scenario.hiddenObjection}
Риск неявки и ограничения: ${scenario.showUpRisk}
Первая реплика пациента, когда он берёт трубку: «${scenario.firstMessage}»

Оценки оператора за его звонок:
${scoreLines}

Что у оператора получилось (это сохраняй и не критикуй):
${list(body?.strengths) || "- нет данных"}
Что тренер советовал улучшить:
${list(body?.improvements) || "- нет данных"}
Раскрыл ли оператор скрытую причину: ${body?.objectionUncovered ? "да" : "нет"}

Факты с сайта клиники:
${clinic.memo.map((m) => `- ${m}`).join("\n")}

<transcript>
${text}
</transcript>`;

  try {
    const script = await gemmaJson({ system: SYSTEM, prompt, schema: ModelScriptSchema, tier: "smart" });
    return NextResponse.json(script);
  } catch (e) {
    console.error("[model-script]", e);
    return NextResponse.json({ error: e instanceof Error ? e.message : "Не удалось составить эталон" }, { status: 502 });
  }
}
