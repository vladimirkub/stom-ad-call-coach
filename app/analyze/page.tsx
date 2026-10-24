"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { formatTurns, parseTranscript, type SpokenTurn } from "@/lib/parse";
import type { CallItem } from "@/lib/crm/amocrm";

type Connection = { id: string; name: string; subdomain: string; domain: string };
type Diarized = { turns: SpokenTurn[]; speakers: string[]; operator: string };

const iso = (d: Date) => d.toISOString().slice(0, 10);
const mmss = (s: number) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;

async function api<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, init);
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(body.error ?? `Ошибка ${res.status}`);
  return body as T;
}

function Card({ n, title, children }: { n: number; title: string; children: React.ReactNode }) {
  return (
    <section className="rounded-2xl border border-white/10 bg-white/5 p-5">
      <h2 className="mb-3 flex items-center gap-2 text-lg font-semibold">
        <span className="flex h-7 w-7 items-center justify-center rounded-full bg-emerald-400 text-sm font-bold text-black">{n}</span>
        {title}
      </h2>
      {children}
    </section>
  );
}

const input = "w-full rounded-lg border border-white/15 bg-white/5 px-3 py-2 text-sm outline-none focus:border-emerald-400";
const btn = "rounded-xl bg-emerald-400 px-4 py-2 text-sm font-semibold text-black disabled:opacity-40";

export default function Analyze() {
  const router = useRouter();
  const fileRef = useRef<HTMLInputElement>(null);

  // CRM
  const [conns, setConns] = useState<Connection[] | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [selected, setSelected] = useState("all");
  const [account, setAccount] = useState("");
  const [token, setToken] = useState("");
  const [connecting, setConnecting] = useState(false);
  const [from, setFrom] = useState(iso(new Date(Date.now() - 7 * 86400_000)));
  const [to, setTo] = useState(iso(new Date()));
  const [minDuration, setMinDuration] = useState(10);
  const [calls, setCalls] = useState<CallItem[] | null>(null);
  const [truncated, setTruncated] = useState(false);
  const [callErrors, setCallErrors] = useState<{ account: string; error: string }[]>([]);
  const [loadingCalls, setLoadingCalls] = useState(false);
  const [crmError, setCrmError] = useState<string | null>(null);

  // Shared transcript
  const [text, setText] = useState("");
  const [diar, setDiar] = useState<Diarized | null>(null);
  const [busyKey, setBusyKey] = useState<string | null>(null); // "file" or a call key
  const [playingKey, setPlayingKey] = useState<string | null>(null);
  const [playError, setPlayError] = useState<string | null>(null);
  const [sourceError, setSourceError] = useState<string | null>(null);
  const [evaluating, setEvaluating] = useState(false);
  const [evalError, setEvalError] = useState<string | null>(null);

  useEffect(() => {
    api<{ connections: Connection[] }>("/api/crm/status").then((r) => setConns(r.connections)).catch(() => setConns([]));
  }, []);

  async function connect() {
    setCrmError(null);
    setConnecting(true);
    try {
      const r = await api<{ connection: Connection }>("/api/crm/connect", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ account, token }) });
      setConns((prev) => [...(prev ?? []).filter((c) => c.id !== r.connection.id), r.connection]);
      setAccount("");
      setToken("");
      setShowForm(false);
    } catch (e) {
      setCrmError(e instanceof Error ? e.message : "Не удалось подключиться");
    } finally {
      setConnecting(false);
    }
  }

  async function disconnect(id: string) {
    await api("/api/crm/disconnect", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id }) }).catch(() => {});
    setConns((prev) => (prev ?? []).filter((c) => c.id !== id));
    if (selected === id) setSelected("all");
    setCalls(null);
  }

  async function loadCalls() {
    setCrmError(null);
    setCallErrors([]);
    setLoadingCalls(true);
    try {
      const r = await api<{ calls: CallItem[]; truncated: boolean; errors: { account: string; error: string }[] }>(
        `/api/crm/calls?connection=${encodeURIComponent(selected)}&from=${from}&to=${to}&minDuration=${minDuration}`,
      );
      setCalls(r.calls);
      setTruncated(r.truncated);
      setCallErrors(r.errors ?? []);
    } catch (e) {
      setCrmError(e instanceof Error ? e.message : "Не удалось получить звонки");
    } finally {
      setLoadingCalls(false);
    }
  }

  function applyTranscription(r: { turns: SpokenTurn[]; speakers: string[] }, direction: "in" | "out") {
    // Outbound: the patient usually answers first ("Алло"), so the operator is the second voice. Inbound: the opposite.
    const operator = direction === "in" ? r.speakers[0] : (r.speakers[1] ?? r.speakers[0]);
    setDiar({ turns: r.turns, speakers: r.speakers, operator });
    setText(formatTurns(r.turns, operator));
  }

  async function transcribeCall(c: CallItem) {
    setSourceError(null);
    setBusyKey(c.key);
    try {
      const r = await api<{ turns: SpokenTurn[]; speakers: string[] }>("/api/crm/transcribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ connection: c.connectionId, entity: c.entity, noteId: c.noteId }),
      });
      applyTranscription(r, c.direction);
      document.getElementById("editor")?.scrollIntoView({ behavior: "smooth" });
    } catch (e) {
      setSourceError(e instanceof Error ? e.message : "Не удалось расшифровать звонок");
    } finally {
      setBusyKey(null);
    }
  }

  async function onFile(file: File | undefined) {
    if (!file) return;
    setSourceError(null);
    if (/\.(txt|md)$/i.test(file.name) || file.type.startsWith("text/")) {
      setDiar(null);
      setText((await file.text()).slice(0, 60000));
      return;
    }
    setBusyKey("file");
    try {
      const form = new FormData();
      form.set("file", file);
      applyTranscription(await api<{ turns: SpokenTurn[]; speakers: string[] }>("/api/transcribe", { method: "POST", body: form }), "out");
    } catch (e) {
      setSourceError(e instanceof Error ? e.message : "Не удалось расшифровать запись");
    } finally {
      setBusyKey(null);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  function changeOperator(operator: string) {
    if (!diar) return;
    setDiar({ ...diar, operator });
    setText(formatTurns(diar.turns, operator));
  }

  const turns = parseTranscript(text);
  const ops = turns.filter((t) => t.role === "user").length;

  async function evaluate() {
    setEvalError(null);
    setEvaluating(true);
    try {
      const result = await api("/api/evaluate", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ scenarioId: "real", transcript: turns }) });
      sessionStorage.setItem("dealbreaker:result", JSON.stringify({ id: crypto.randomUUID(), result, transcript: turns, patient: "Пациент", scenarioId: "real" }));
      router.push("/results");
    } catch (e) {
      setEvalError(e instanceof Error ? e.message : "Не удалось оценить звонок");
      setEvaluating(false);
    }
  }

  return (
    <main className="mx-auto max-w-3xl space-y-5 px-4 py-8">
      <Link href="/" className="text-xs text-slate-500 hover:text-slate-300">← На главную</Link>
      <h1 className="text-2xl font-bold">Оценить реальный звонок</h1>
      <p className="text-sm text-slate-400">Возьмите звонок из CRM, загрузите запись или вставьте готовый транскрипт. Оценка идёт по тому же чек-листу, но без знания скрытой причины пациента.</p>

      <Card n={1} title="Звонки из CRM (amoCRM)">
        {conns === null ? (
          <p className="text-sm text-slate-500">Проверяем подключения…</p>
        ) : (
          <div className="space-y-4">
            {conns.length > 0 && (
              <ul className="divide-y divide-white/10 rounded-xl border border-white/10">
                {conns.map((c) => (
                  <li key={c.id} className="flex items-center justify-between gap-3 px-3 py-2 text-sm">
                    <span className="text-emerald-300">✅ {c.name} <span className="text-slate-500">({c.id})</span></span>
                    <button onClick={() => disconnect(c.id)} className="text-xs text-slate-400 underline hover:text-slate-200">Отключить</button>
                  </li>
                ))}
              </ul>
            )}

            {(conns.length === 0 || showForm) ? (
              <div className="space-y-3 rounded-xl border border-white/10 bg-black/20 p-4">
                <p className="text-sm text-slate-400">
                  Подключение по долгосрочному токену. В amoCRM откройте свою интеграцию → вкладка «Ключи» → «Сгенерировать токен» (срок от 1 дня до 5 лет). Токен хранится только на сервере, в зашифрованной cookie на 8 часов.
                </p>
                <label className="block text-sm">
                  <span className="text-slate-300">Адрес аккаунта</span>
                  <input className={`${input} mt-1`} placeholder="mycompany.amocrm.ru" value={account} onChange={(e) => setAccount(e.target.value)} autoComplete="off" />
                </label>
                <label className="block text-sm">
                  <span className="text-slate-300">Долгосрочный токен</span>
                  <input className={`${input} mt-1`} type="password" placeholder="Вставьте токен" value={token} onChange={(e) => setToken(e.target.value)} autoComplete="off" />
                </label>
                <div className="flex gap-2">
                  <button className={btn} onClick={connect} disabled={connecting || !account.trim() || token.trim().length < 20}>
                    {connecting ? "Подключаемся…" : "Подключиться к CRM"}
                  </button>
                  {conns.length > 0 && (
                    <button className="rounded-xl border border-white/20 px-4 py-2 text-sm" onClick={() => { setShowForm(false); setCrmError(null); }}>Отмена</button>
                  )}
                </div>
              </div>
            ) : (
              <button className="rounded-xl border border-dashed border-emerald-400/50 px-4 py-2 text-sm font-semibold text-emerald-300 hover:bg-emerald-400/10" onClick={() => setShowForm(true)}>
                ＋ Подключить ещё
              </button>
            )}

            {crmError && <p role="alert" className="rounded-lg border border-red-500/40 bg-red-500/10 p-3 text-sm text-red-200">{crmError}</p>}

            {conns.length > 0 && (
              <>
                <div className="grid gap-3 sm:grid-cols-5">
                  {conns.length > 1 && (
                    <label className="text-sm sm:col-span-5">
                      <span className="text-slate-400">CRM</span>
                      <select className={`${input} mt-1`} value={selected} onChange={(e) => { setSelected(e.target.value); setCalls(null); }}>
                        <option value="all">Все подключённые ({conns.length})</option>
                        {conns.map((c) => <option key={c.id} value={c.id}>{c.name} ({c.id})</option>)}
                      </select>
                    </label>
                  )}
                  <label className="text-sm sm:col-span-1"><span className="text-slate-400">С</span><input type="date" className={`${input} mt-1`} value={from} max={to} onChange={(e) => setFrom(e.target.value)} /></label>
                  <label className="text-sm sm:col-span-1"><span className="text-slate-400">По</span><input type="date" className={`${input} mt-1`} value={to} min={from} onChange={(e) => setTo(e.target.value)} /></label>
                  <label className="text-sm sm:col-span-2"><span className="text-slate-400">Дольше, сек</span><input type="number" min={10} className={`${input} mt-1`} value={minDuration} onChange={(e) => setMinDuration(Math.max(10, Number(e.target.value) || 10))} /></label>
                  <button className={`${btn} self-end sm:col-span-1`} onClick={loadCalls} disabled={loadingCalls}>{loadingCalls ? "Ищем…" : "Показать звонки"}</button>
                </div>
                <p className="text-xs text-slate-500">Показываются только звонки длиннее 10 секунд, период не больше 31 дня.</p>
                {callErrors.map((e) => (
                  <p key={e.account} role="alert" className="rounded-lg border border-amber-400/40 bg-amber-400/10 p-2 text-xs text-amber-200">{e.account}: {e.error}</p>
                ))}
                {calls && (calls.length === 0 ? (
                  <p className="text-sm text-slate-400">За этот период звонков не найдено.</p>
                ) : (
                  <ul className="divide-y divide-white/10 rounded-xl border border-white/10">
                    {calls.map((c) => (
                      <li key={c.key} className="p-3 text-sm">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <div>
                            <p className="font-medium">
                              {new Date(c.createdAt * 1000).toLocaleString("ru-RU", { dateStyle: "short", timeStyle: "short" })}
                              <span className={`ml-2 rounded-full px-2 py-0.5 text-xs ${c.direction === "out" ? "bg-sky-500/20 text-sky-300" : "bg-violet-500/20 text-violet-300"}`}>{c.direction === "out" ? "Исходящий" : "Входящий"}</span>
                              {conns.length > 1 && c.account && <span className="ml-2 rounded-full bg-white/10 px-2 py-0.5 text-xs text-slate-300">{c.account}</span>}
                            </p>
                            <p className="text-xs text-slate-400">{mmss(c.duration)} · {c.phone}{c.responsible && ` · ${c.responsible}`}{c.source && ` · ${c.source}`}</p>
                          </div>
                          <div className="flex gap-2">
                            <button
                              className="rounded-xl border border-white/20 px-4 py-2 text-sm font-semibold disabled:opacity-40"
                              disabled={!c.hasRecording}
                              onClick={() => {
                                setPlayError(null);
                                setPlayingKey(playingKey === c.key ? null : c.key);
                              }}
                              title={c.hasRecording ? "" : "У звонка нет записи"}
                            >
                              {playingKey === c.key ? "⏹ Закрыть" : "▶ Прослушать"}
                            </button>
                            <button className={btn} disabled={!c.hasRecording || busyKey !== null} onClick={() => transcribeCall(c)} title={c.hasRecording ? "" : "У звонка нет записи"}>
                              {busyKey === c.key ? "Расшифровываем…" : c.hasRecording ? "Расшифровать" : "Нет записи"}
                            </button>
                          </div>
                        </div>
                        {playingKey === c.key && (
                          <div className="mt-3">
                            {/* The route redirects to the recording URL kept in the CRM note. */}
                            <audio
                              key={c.key}
                              controls
                              autoPlay
                              preload="auto"
                              className="w-full"
                              src={`/api/crm/recording?connection=${encodeURIComponent(c.connectionId ?? "")}&entity=${c.entity}&noteId=${c.noteId}`}
                              onError={() => setPlayError("Не удалось воспроизвести запись: ссылка телефонии могла устареть или требует авторизации.")}
                            />
                            {playError && <p role="alert" className="mt-2 text-xs text-red-300">{playError}</p>}
                          </div>
                        )}
                      </li>
                    ))}
                  </ul>
                ))}
                {truncated && <p className="text-xs text-amber-300">Показаны не все звонки: сузьте период.</p>}
              </>
            )}
          </div>
        )}
      </Card>

      <Card n={2} title="Загрузить диалог">
        <p className="mb-3 text-sm text-slate-400">Аудиозапись звонка (mp3, wav, m4a, ogg, до 50 МБ) будет расшифрована с разделением по голосам. Можно загрузить и готовый текстовый файл (.txt).</p>
        <input ref={fileRef} type="file" accept="audio/*,video/mp4,.mp3,.wav,.m4a,.ogg,.opus,.flac,.aac,.txt,.md" className="hidden" onChange={(e) => onFile(e.target.files?.[0])} />
        <button className={btn} onClick={() => fileRef.current?.click()} disabled={busyKey !== null}>
          {busyKey === "file" ? "Расшифровываем… это займёт до минуты" : "Загрузить диалог"}
        </button>
        {sourceError && <p role="alert" className="mt-3 rounded-lg border border-red-500/40 bg-red-500/10 p-3 text-sm text-red-200">{sourceError}</p>}
      </Card>

      <div id="editor">
        <Card n={3} title="Транскрипт для оценки">
          <p className="mb-2 text-sm text-slate-400">Вставьте расшифровку или проверьте полученную из пунктов 1 и 2. Каждая реплика с новой строки: «Оператор:» или «Пациент:».</p>
          {diar && diar.speakers.length > 1 && (
            <div className="mb-3 flex flex-wrap items-center gap-2 rounded-lg border border-white/10 bg-black/20 p-3 text-sm">
              <span className="text-slate-300">Кто оператор?</span>
              {diar.speakers.map((s, i) => (
                <button key={s} onClick={() => changeOperator(s)} className={`rounded-lg px-3 py-1 ${diar.operator === s ? "bg-emerald-400 font-semibold text-black" : "bg-white/10"}`}>Голос {i + 1}</button>
              ))}
              <span className="text-xs text-slate-500">Роли определены автоматически. Если перепутаны, переключите (текст ниже перезапишется).</span>
            </div>
          )}
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            rows={14}
            placeholder={"Оператор: Добрый день, это Анна, стоматологическая клиника...\nПациент: Да, слушаю.\nОператор: ..."}
            className="w-full rounded-xl border border-white/15 bg-white/5 p-4 text-sm outline-none focus:border-emerald-400"
          />
          <p className="mt-1 text-xs text-slate-500">Распознано реплик: {turns.length} (оператора: {ops})</p>
          {evalError && <div role="alert" className="mt-3 rounded-lg border border-red-500/40 bg-red-500/10 p-3 text-sm text-red-200">{evalError}</div>}
          <button onClick={evaluate} disabled={evaluating || ops < 2} className="mt-4 rounded-xl bg-emerald-400 px-6 py-3 font-semibold text-black disabled:opacity-40">
            {evaluating ? "Оцениваем… 30–60 с" : "Оценить звонок"}
          </button>
        </Card>
      </div>
    </main>
  );
}
