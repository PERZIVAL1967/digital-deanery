import { kinds, type Status } from "./request-types";

/** the mock-up's short catalogue, mapped onto Codex's request kinds */
export const CATALOG: [string, [string, string, string][]][] = [
  ["Справки", [["certificate", "Справка об обучении", "2 рабочих дня"], ["military_certificate", "Справка в военкомат", "2 рабочих дня"],
    ["stipend_amount", "Справка о стипендии", "3 рабочих дня"], ["certificate_english", "Справка на английском", "3 рабочих дня"]]],
  ["Заявления", [["leave", "Заявление об отсутствии", "до занятия"], ["transfer_credits", "Перезачёт предметов", "решает комиссия"],
    ["programme_profile", "Смена профиля программы", "до 1 декабря"], ["family_leave", "Академический отпуск", "решает декан"]]],
];
const SHORT = Object.fromEntries(CATALOG.flatMap(([, items]) => items.map(([k, name]) => [k, name])));
export const requestName = (kind: string) => SHORT[kind] ?? kinds[kind] ?? "Заявка";
export const isCertificate = (kind: string) => /^(Справка|Выписка)/.test(kinds[kind] ?? "");
export const DAYS: Record<string, string> = Object.fromEntries(CATALOG.flatMap(([, items]) => items.map(([k, , d]) => [k, d])));

export const STEPS = ["Подана", "В работе", "Готова", "Выдана"];
export const stepOf = (s: Status) => ({ submitted: 0, in_review: 1, needs_info: 1, ready: 2, issued: 3, rejected: -1, withdrawn: -1 }[s]);
export const STATUS_TAG: Record<Status, ["ok" | "warn" | "bad" | "info", string]> = {
  submitted: ["info", "Подана"], in_review: ["warn", "В работе"], needs_info: ["warn", "Нужно уточнение"],
  ready: ["ok", "Готова"], issued: ["info", "Выдана"], rejected: ["bad", "Отклонена"], withdrawn: ["info", "Отозвана"],
};

/** request.message is stored by our form as «Ключ: значение» lines */
export function parseMessage(message: string) {
  const pairs: [string, string][] = [];
  const free: string[] = [];
  for (const line of message.split("\n")) {
    const m = line.match(/^(Куда|Экземпляров|Язык|Комментарий): (.*)$/);
    if (m) pairs.push([m[1], m[2]]); else if (line.trim()) free.push(line.trim());
  }
  if (free.length) pairs.push(["Комментарий", free.join(" ")]);
  return pairs;
}
