// First triage of a toothache by its symptoms, for the administrator: what the complaint may point to and which visit
// to offer. From the clinic's own table (Nov 2026); it guides the consultation and never replaces the doctor's diagnosis.

export const TRIAGE_COLUMNS = ["Кариес (глубокий)", "Пульпит", "Периодонтит"] as const;

export const TRIAGE_ROWS: { sign: string; cells: [string, string, string] }[] = [
  { sign: "Характер боли", cells: ["Кратковременная, только от раздражителей: холодное, сладкое, кислое", "Самопроизвольная, приступами, часто сильнее ночью", "Постоянная, ноющая, пульсирующая"] },
  { sign: "Сколько длится", cells: ["Проходит сразу или почти сразу после раздражителя (секунды)", "Долго не проходит, особенно от горячего", "Длительная, постоянная"] },
  { sign: "Больно накусывать или постучать", cells: ["Чаще нет, иногда при глубоком кариесе слабый дискомфорт", "На ранней стадии нет", "Да, резкая сильная боль от малейшего касания"] },
  { sign: "Ощущение «выросшего» зуба", cells: ["Нет", "Нет", "Да, распирание, зуб будто выше остальных"] },
  { sign: "Холодное и горячее", cells: ["Реакция кратковременная", "Резкая боль, особенно от горячего, долго не утихает", "Слабо или не реагирует: нерв погиб"] },
  { sign: "Что видно", cells: ["Кариес (дырка в зубе)", "Кариес (дырка в зубе)", "Кариес и отёк, воспаление, гной, зуб может шататься"] },
  { sign: "Что предложить", cells: ["Лечение кариеса и пломба", "Лечение каналов и коронка", "Лечение каналов и коронка или удаление"] },
];

/** The table as text, for the judge. */
export function triageText(): string {
  return TRIAGE_ROWS.map((r) => `- ${r.sign}: ${TRIAGE_COLUMNS.map((c, i) => `${c} — ${r.cells[i]}`).join("; ")}`).join("\n");
}
