// Reads clinic websites for the legend: the owner's URLs plus a few relevant internal pages found on them.
// The server only ever fetches public addresses (checked again after every redirect), with size and time limits.
import { lookup } from "node:dns/promises";
import { isIP } from "node:net";

const MAX_BYTES = 3_000_000;
const TIMEOUT_MS = 15_000;
const MAX_REDIRECTS = 4;
export const MAX_EXTRA_PAGES = 8;
const PAGE_CHARS = 12_000;
const TOTAL_CHARS = 150_000;

export type Page = { url: string; ok: boolean; error?: string; title?: string; text?: string; extra?: boolean };

/** Loopback, private, link-local (cloud metadata), CGNAT, multicast and other non-public ranges. */
export function isPrivateAddress(ip: string): boolean {
  if (isIP(ip) === 4) {
    const [a, b] = ip.split(".").map(Number);
    return a === 0 || a === 10 || a === 127 || a >= 224 || (a === 100 && b >= 64 && b <= 127) || (a === 169 && b === 254) ||
      (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168) || (a === 198 && (b === 18 || b === 19));
  }
  const v6 = ip.toLowerCase();
  if (v6.startsWith("::ffff:")) return isPrivateAddress(v6.slice(7));
  return v6 === "::" || v6 === "::1" || /^f[cd]/.test(v6) || /^fe[89ab]/.test(v6) || v6.startsWith("ff");
}

/** Throws unless the URL is http(s) on a host that resolves only to public addresses. */
export async function assertPublicUrl(raw: string): Promise<URL> {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    throw new Error("Некорректная ссылка");
  }
  if (url.protocol !== "http:" && url.protocol !== "https:") throw new Error("Нужна ссылка http или https");
  if (url.username || url.password) throw new Error("Ссылка с логином и паролем не поддерживается");
  const host = url.hostname.replace(/^\[|\]$/g, "");
  const addrs = isIP(host) ? [host] : (await lookup(host, { all: true }).catch(() => [])).map((a) => a.address);
  if (addrs.length === 0) throw new Error("Сайт не найден (DNS)");
  if (addrs.some(isPrivateAddress)) throw new Error("Внутренние адреса запрещены");
  return url;
}

function charsetOf(contentType: string | null, head: string): string {
  const m = /charset=["']?([\w-]+)/i.exec(contentType ?? "") ?? /<meta[^>]+charset=["']?([\w-]+)/i.exec(head);
  const cs = (m?.[1] ?? "utf-8").toLowerCase();
  return cs === "cp1251" ? "windows-1251" : cs;
}

/** GET with manual redirects (each target re-checked), a size cap and a timeout. Returns the decoded HTML. */
export async function fetchHtml(raw: string): Promise<{ url: string; html: string }> {
  let url = await assertPublicUrl(raw);
  for (let hop = 0; ; hop++) {
    const res = await fetch(url, {
      redirect: "manual",
      signal: AbortSignal.timeout(TIMEOUT_MS),
      headers: {
        "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 14_0) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36",
        "Accept": "text/html,application/xhtml+xml",
        "Accept-Language": "ru-RU,ru;q=0.9",
      },
    });
    if (res.status >= 300 && res.status < 400 && res.headers.get("location")) {
      if (hop >= MAX_REDIRECTS) throw new Error("Слишком много перенаправлений");
      url = await assertPublicUrl(new URL(res.headers.get("location")!, url).href);
      continue;
    }
    if (!res.ok) throw new Error(`Сайт ответил ошибкой ${res.status}`);
    const type = res.headers.get("content-type") ?? "";
    if (!/html|xml|text\/plain/i.test(type)) throw new Error("Это не веб-страница");
    const chunks: Uint8Array[] = [];
    let size = 0;
    for await (const chunk of res.body as unknown as AsyncIterable<Uint8Array>) {
      size += chunk.length;
      if (size > MAX_BYTES) break;
      chunks.push(chunk);
    }
    const bytes = Buffer.concat(chunks);
    const head = bytes.subarray(0, 4096).toString("latin1");
    let html: string;
    try {
      html = new TextDecoder(charsetOf(type, head)).decode(bytes);
    } catch {
      html = new TextDecoder("utf-8").decode(bytes);
    }
    return { url: url.href, html };
  }
}

const ENTITIES: Record<string, string> = { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: " ", laquo: "«", raquo: "»", mdash: "—", ndash: "–", hellip: "…", rub: "₽", times: "×", deg: "°", minus: "−" };
function decodeEntities(s: string) {
  return s.replace(/&(#x[\da-f]+|#\d+|\w+);/gi, (m, e: string) => {
    if (e[0] === "#") {
      const code = e[1] === "x" || e[1] === "X" ? parseInt(e.slice(2), 16) : parseInt(e.slice(1), 10);
      return Number.isFinite(code) && code > 0 && code < 0x110000 ? String.fromCodePoint(code) : " ";
    }
    return ENTITIES[e.toLowerCase()] ?? m;
  });
}

/** Readable text of a page: title, meta description, then the body without scripts, styles and markup. */
export function htmlToText(html: string): { title: string; text: string } {
  const title = decodeEntities(/<title[^>]*>([\s\S]*?)<\/title>/i.exec(html)?.[1] ?? "").replace(/\s+/g, " ").trim();
  const description = decodeEntities(/<meta[^>]+name=["']description["'][^>]*content=["']([^"']*)/i.exec(html)?.[1] ?? "").trim();
  const body = html
    .replace(/<!--[\s\S]*?-->/g, " ")
    .replace(/<(script|style|noscript|svg|template|iframe|head)\b[\s\S]*?<\/\1>/gi, " ")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/(p|div|li|h[1-6]|tr|section|article|header|footer|ul|ol|table|blockquote)>/gi, "\n")
    .replace(/<(td|th)\b[^>]*>/gi, " | ")
    .replace(/<[^>]+>/g, " ");
  const text = decodeEntities(body)
    .split("\n")
    .map((l) => l.replace(/[ \t |]+/g, " ").replace(/\s+\|\s*$/, "").trim())
    .filter((l, i, arr) => l.length > 1 && l !== arr[i - 1])
    .join("\n");
  return { title, text: [description, text].filter(Boolean).join("\n") };
}

const RELEVANT = /цен|прайс|стоимост|услуг|акци|скидк|спецпредлож|рассроч|кредит|оплат|гаранти|врач|доктор|специалист|команд|контакт|адрес|о-клиник|о клиник|о нас|about|price|uslug|service|akci|promo|sale|doctor|vrach|team|contact|kontakt|garant|rassroch|implant|имплант|протез|брекет|винир|ортодонт|лечени/i;

/** Internal links that look like prices, promotions, payment, guarantees, doctors or contacts, most relevant first. */
export function relevantLinks(html: string, base: string): string[] {
  const baseUrl = new URL(base);
  const found = new Map<string, number>();
  for (const m of html.matchAll(/<a\b[^>]*href=["']([^"'#]+)["'][^>]*>([\s\S]*?)<\/a>/gi)) {
    let href: URL;
    try {
      href = new URL(decodeEntities(m[1]), baseUrl);
    } catch {
      continue;
    }
    if (href.hostname !== baseUrl.hostname || !/^https?:$/.test(href.protocol)) continue;
    if (/\.(pdf|jpe?g|png|webp|gif|svg|zip|docx?|xlsx?|mp4)$/i.test(href.pathname)) continue;
    href.hash = "";
    if (href.href === baseUrl.href || href.pathname === "/") continue;
    const label = decodeEntities(m[2].replace(/<[^>]+>/g, " ")).replace(/\s+/g, " ").trim();
    const hay = `${decodeURIComponent(href.pathname)} ${label}`;
    if (!RELEVANT.test(hay)) continue;
    // Shallow pages first: /prices beats /blog/2021/some-article-about-prices.
    const score = (/цен|прайс|price|стоимост|акци|promo|контакт|contact|врач|doctor/i.test(hay) ? 0 : 10) + href.pathname.split("/").filter(Boolean).length;
    found.set(href.href, Math.min(found.get(href.href) ?? 99, score));
  }
  return [...found.entries()].sort((a, b) => a[1] - b[1]).map(([u]) => u);
}

/** Fetches the owner's pages, then up to MAX_EXTRA_PAGES relevant internal pages linked from them. Never throws. */
export async function readSites(urls: string[], fetchPage = fetchHtml): Promise<Page[]> {
  const pages: Page[] = [];
  const seen = new Set<string>();
  const candidates: string[] = [];
  let budget = TOTAL_CHARS;
  const take = (url: string, html: string, extra: boolean) => {
    const { title, text } = htmlToText(html);
    const clipped = text.slice(0, Math.min(PAGE_CHARS, Math.max(0, budget)));
    budget -= clipped.length;
    pages.push({ url, ok: true, title, text: clipped, extra });
  };

  const own = await Promise.all(urls.map(async (u) => ({ u, r: await fetchPage(u).catch((e: Error) => e) })));
  for (const { u, r } of own) {
    if (r instanceof Error) {
      pages.push({ url: u, ok: false, error: r.message });
      continue;
    }
    seen.add(u).add(r.url);
    take(r.url, r.html, false);
    candidates.push(...relevantLinks(r.html, r.url));
  }
  const extras = [...new Set(candidates)].filter((u) => !seen.has(u)).slice(0, MAX_EXTRA_PAGES);
  const got = await Promise.all(extras.map(async (u) => ({ u, r: await fetchPage(u).catch((e: Error) => e) })));
  for (const { u, r } of got) {
    if (r instanceof Error) pages.push({ url: u, ok: false, error: r.message, extra: true });
    else if (budget > 0) take(r.url, r.html, true);
  }
  return pages;
}
