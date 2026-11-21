import type { Notice } from "./dal/cifry";
import { kinds, statuses, type Status } from "./request-types";
import { fmtDayMonth, fmtWhen, loc, mskDay, mskTime } from "./time";

export type Card = { id: string; title: string; when: string; unread: boolean; was?: string; now?: string; wasLabel?: string; nowLabel?: string;
  why?: string; todo: string; href: string; tag?: { k: "ok" | "warn" | "bad" | "info"; text: string } };

const short = (s: string, n = 80) => (s.length > n ? s.slice(0, n - 1) + "…" : s);
const at = (iso: unknown) => (typeof iso === "string" ? new Date(iso) : null);

/** a notification as the mock-up's change card: what, when, было/стало, what to do */
export function toCard(n: Notice): Card {
  const p = n.payload;
  const base = { id: n.id, when: fmtWhen(n.created_at), unread: !n.read_at };
  switch (n.kind) {
    case "class_status": {
      const before = at(p.beforeStart), after = at(p.afterStart);
      const day = before ? mskDay(before) : null;
      const course = String(p.course ?? "Занятие");
      const href = `/timetable?d=${after ? mskDay(after) : day}&c=${n.entity_id}`;
      if (p.status === "cancelled") {
        return { ...base, title: `Отмена: ${course}`, was: before ? `${fmtDayMonth(mskDay(before))}, ${mskTime(before)}` : undefined,
          why: p.reason ? String(p.reason) : undefined, todo: "Новое время пришлём сюда.", href, tag: { k: "bad", text: "Отмена" } };
      }
      const timeChanged = before && after && before.getTime() !== after.getTime();
      const roomChanged = p.beforeRoom && p.room && p.beforeRoom !== p.room;
      const fmt = (d: Date | null, room: unknown) => [d ? (timeChanged && before && after && mskDay(before) !== mskDay(after) ? fmtDayMonth(mskDay(d)) + ", " : "") + mskTime(d) : null, loc(String(room ?? ""))].filter(Boolean).join(", ");
      return { ...base, title: `${timeChanged ? "Перенос" : roomChanged ? "Новая аудитория" : "Изменение"}: ${course}`,
        was: fmt(before, p.beforeRoom), now: fmt(after, p.room), why: p.reason ? String(p.reason) : undefined,
        todo: "Ничего: календарь уже обновлён.", href, tag: { k: "warn", text: timeChanged ? "Перенос" : "Новая ауд." } };
    }
    case "request_status": {
      const name = kinds[n.request_kind ?? ""] ?? "Заявка";
      const after = p.after as Status;
      const title = after === "ready" ? `${name}: готова` : after === "rejected" ? `${name}: отклонена` : `${name}: ${statuses[after]?.toLowerCase() ?? "новый статус"}`;
      const todo = after === "ready" ? "Забрать в деканате, взять студенческий." : after === "needs_info" ? "Ответить деканату в заявке."
        : after === "rejected" ? "Можно подать заново." : "Ничего не нужно.";
      return { ...base, title, now: p.reason ? String(p.reason) : undefined, nowLabel: "что", todo, href: `/requests/${n.entity_id}`,
        tag: { k: after === "ready" ? "ok" : after === "rejected" ? "bad" : "info", text: statuses[after] ?? "Заявка" } };
    }
    case "grade_changed":
      return { ...base, title: `${p.corrected ? "Оценка исправлена" : "Новая оценка"}: ${p.course}`, now: `${p.score} из 100${p.note ? ", " + p.note : ""}`, nowLabel: "что",
        todo: "Ничего не нужно.", href: "/grades", tag: { k: "info", text: "Оценка" } };
    case "announcement":
      return { ...base, title: `Новость: ${p.title}`, now: p.body ? short(String(p.body)) : undefined, nowLabel: "что",
        todo: "Прочитать в Новостях.", href: `/news/${n.entity_id}`, tag: { k: "info", text: "Новость" } };
    case "question_answered":
      return { ...base, title: "Деканат ответил на вопрос", wasLabel: "вопрос", nowLabel: "ответ", was: p.question ? short(String(p.question), 60) : undefined,
        now: p.answer ? short(String(p.answer)) : undefined, todo: "Открыть переписку.", href: "/ask", tag: { k: "ok", text: "Ответ" } };
    case "assignment":
      return { ...base, title: `Новое задание: ${p.course}`, now: `${p.title}, срок ${typeof p.due === "string" ? fmtDayMonth(p.due) : ""}`, nowLabel: "что",
        todo: p.plagiarism ? "Загрузить работу в Антиплагиат до срока." : "Сдать до срока.", href: p.plagiarism ? "/plagiarism" : "/moodle", tag: { k: "info", text: "Задание" } };
    case "group_message":
      return { ...base, title: `Сообщение преподавателя: ${p.course}`, now: p.body ? short(String(p.body), 160) : undefined, nowLabel: String(p.teacher ?? "кто"),
        todo: "Ничего не нужно.", href: "/inbox", tag: { k: "info", text: "Сообщение" } };
    case "record_changed":
      return { ...base, title: `Деканат изменил данные: ${p.field}`, was: p.old ? String(p.old) : "-", now: p.new ? String(p.new) : "-",
        why: p.reason ? String(p.reason) : undefined, todo: "Если это ошибка, напишите в деканат.", href: "/profile", tag: { k: "warn", text: "Данные" } };
    case "resit_assigned": {
      const t = at(p.at);
      return { ...base, title: `Пересдача: ${p.course}`, now: `${t ? `${fmtDayMonth(mskDay(t))}, ${mskTime(t)}` : ""}, ${loc(String(p.room ?? ""))}, ${p.examiner}`, nowLabel: "когда",
        todo: "Прийти с зачётной книжкой.", href: "/grades", tag: { k: "warn", text: "Пересдача" } };
    }
  }
  return { ...base, title: "Уведомление", todo: "Ничего не нужно.", href: "/inbox" };
}
