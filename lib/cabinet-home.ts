// The big numbers, hero list and tiles of the dean's and teacher's homes, computed from the database.
import { cache } from "react";
import type { CabHome } from "../components/cabinet";
import type { MenuItem } from "../components/client";
import { deanHome, SLA_DAYS } from "./dal/staff";
import { myClasses, teacherHomeCounts } from "./dal/teacher";
import { requestName } from "./request-ui";
import { SECTIONS } from "./sections";
import { dayStart, fmtWhen, loc, mskTime, plural, shiftDay, today } from "./time";

const ago = (d: Date) => {
  const h = Math.max(0, Math.round((Date.now() - d.getTime()) / 3600000));
  return h < 24 ? `${h} ч` : `${Math.floor(h / 24)} дн.`;
};

export const DEAN_MENU: MenuItem[] = [
  ["/staff", "Главная", "house", "#FFFFFF"], ["/staff/requests", "Заявки", "clipboard", SECTIONS.requests.hl],
  ["/staff/students", "Студенты", "users", SECTIONS.students.hl], ["/staff/timetable", "Расписание", "calendar-days", SECTIONS.timetable.hl],
  ["/staff/services", "Всё остальное", "folder", SECTIONS.services.hl], ["/staff/profile", "Профиль", "user", SECTIONS.profile.hl],
];
export const DEAN_SECTIONS: Record<string, string> = {
  requests: "/staff/requests", questions: "/staff/requests", students: "/staff/students",
  timetable: "/staff/timetable", news: "/staff/services",
  inbox: "/staff/services", services: "/staff/services", profile: "/staff/profile",
};
export const TEACHER_MENU: MenuItem[] = [
  ["/teacher", "Главная", "house", "#FFFFFF"], ["/teacher/classes", "Занятия", "calendar-days", SECTIONS.classes.hl],
  ["/teacher/journal", "Журнал", "table", SECTIONS.journal.hl], ["/teacher/inbox", "Уведомления", "bell", SECTIONS.inbox.hl],
  ["/teacher/services", "Всё остальное", "folder", SECTIONS.services.hl], ["/teacher/profile", "Профиль", "user", SECTIONS.profile.hl],
];
export const TEACHER_SECTIONS: Record<string, string> = {
  classes: "/teacher/classes", journal: "/teacher/journal", inbox: "/teacher/inbox", services: "/teacher/services", profile: "/teacher/profile",
};

export const deanHomeData = cache(async (token: string, name: string): Promise<CabHome | null> => {
  const d = await deanHome(token);
  if (!d) return null;
  const waitingQ = d.oldestQuestion ? ago(d.oldestQuestion) : null;
  return {
    who: { name, sub: `${name}, деканат` }, unread: d.unread,
    first: {
      lab: `${plural(d.waiting, "заявка ждёт", "заявки ждут", "заявок ждут")} решения`, fig: { num: String(d.waiting), label: "" }, hl: SECTIONS.requests.hl,
      det: `${d.overdue ? `Просрочены (дольше ${SLA_DAYS} дней): ${d.overdue}.` : "Просроченных нет."}`,
      chip: { icon: "clipboard", label: "Очередь", href: "/staff/requests" },
    },
    list: {
      title: "Дольше всех ждут", empty: "Все заявки разобраны.",
      items: d.oldest.map((r) => ({ key: r.id, href: `/staff/requests/${r.id}`, lead: ago(r.created_at), title: requestName(r.kind),
        sub: `${r.name}, ${r.group_name}`, cls: Date.now() - r.created_at.getTime() > SLA_DAYS * 86400000 ? "moved" : undefined })),
    },
    rest: [
      { lab: `${plural(d.questions, "вопрос", "вопроса", "вопросов")} без ответа`, fig: { num: String(d.questions), label: "" }, hl: SECTIONS.questions.hl,
        det: waitingQ ? `Самый старый ждёт ${waitingQ.replace(/\.$/, "")}.` : "Ответили на все вопросы.", chip: { icon: "message-circle", label: "Ответить", href: "/staff/questions" } },
      { lab: "изменений расписания сегодня", fig: { num: String(d.changesToday), label: "" }, hl: SECTIONS.timetable.hl,
        det: d.changesToday ? `Студентов уведомлено: ${d.notifiedToday}.` : "Сегодня занятия не переносили.",
        chip: { icon: "calendar-days", label: "Расписание", href: "/staff/timetable" } },
      { lab: `${plural(d.ready, "справка", "справки", "справок")} к выдаче`, fig: { num: String(d.ready), label: "" }, hl: SECTIONS.documents.hl,
        det: "Готовы, студенты ещё не забрали.", chip: { icon: "files", label: "Выдать", href: "/staff/requests?status=ready" } },
    ],
    tiles: [
      { key: "req", label: "Заявки", sub: `${d.waiting} ждут`, icon: "clipboard", color: SECTIONS.requests.badge, href: "/staff/requests" },
      { key: "q", label: "Вопросы", sub: d.questions ? `${d.questions} без ответа` : "все отвечены", icon: "message-circle", color: SECTIONS.questions.badge, href: "/staff/questions" },
      { key: "st", label: "Студенты", sub: `${d.students} в базе`, icon: "users", color: SECTIONS.students.badge, href: "/staff/students" },
      { key: "tt", label: "Расписание", sub: "переносы", icon: "calendar-days", color: SECTIONS.timetable.badge, href: "/staff/timetable" },
      { key: "nw", label: "Новости", sub: "адресно", icon: "megaphone", color: SECTIONS.news.badge, href: "/staff/news" },
      { key: "pr", label: "Профиль", sub: "тема, выход", icon: "user", color: SECTIONS.profile.badge, href: "/staff/profile" },
    ],
  };
});

export const teacherHomeData = cache(async (token: string, name: string): Promise<CabHome | null> => {
  const day = today();
  const [counts, todays, week] = await Promise.all([teacherHomeCounts(token), myClasses(token, dayStart(day), dayStart(shiftDay(day, 1))),
    myClasses(token, dayStart(shiftDay(day, 1)), dayStart(shiftDay(day, 8)))]);
  if (!counts) return null;
  const live = todays.filter((c) => c.status !== "cancelled");
  const next = week.find((c) => c.status !== "cancelled");
  const now = Date.now();
  return {
    who: { name, sub: `${name}, преподаватель` }, unread: counts.unread,
    first: {
      lab: `${plural(live.length, "пара", "пары", "пар")} сегодня`, fig: { num: String(live.length), label: "" }, hl: SECTIONS.classes.hl,
      det: live.length ? `Первая в ${mskTime(live[0].starts_at)}, ${loc(live[0].room)}. Посещаемость отмечается одним касанием.`
        : next ? `Следующая: ${next.course}, ${fmtWhen(next.starts_at)}.` : "Занятий на неделе нет.",
      chip: { icon: "calendar-days", label: "Мои занятия", href: "/teacher/classes" },
    },
    list: {
      title: live.length ? "Сегодня" : "Ближайшие занятия", empty: "Занятий нет.",
      items: (live.length ? todays : week.slice(0, 4)).map((c) => {
        const going = c.status !== "cancelled" && c.starts_at.getTime() <= now && c.ends_at.getTime() > now;
        const moved = c.original_room && c.original_room !== c.room;
        return { key: c.id, href: `/teacher/classes/${c.id}`, lead: live.length ? mskTime(c.starts_at) : fmtWhen(c.starts_at).replace(/ \d\d:\d\d$/, ""),
          title: `${c.course}`, cls: c.status === "cancelled" ? "cancel" : going ? "now" : moved ? "moved" : undefined,
          sub: `${c.section}, ${loc(c.room)}${moved ? ", новая" : ""}${c.status === "cancelled" ? ", отмена" : ""}${c.marked ? `, отмечено ${c.marked}/${c.students}` : ""}` };
      }),
    },
    rest: [
      { lab: `${plural(counts.to_mark, "работа ждёт", "работы ждут", "работ ждут")} оценки`, fig: { num: String(counts.to_mark), label: "" }, hl: SECTIONS.assignments.hl,
        det: counts.to_mark ? "Загружены студентами в Антиплагиат, баллов в журнале ещё нет." : "Все загруженные работы оценены.",
        chip: { icon: "table", label: "Журнал", href: "/teacher/journal" } },
      { lab: `${plural(counts.absent_today, "пропуск", "пропуска", "пропусков")} сегодня`, fig: { num: String(counts.absent_today), label: "" }, hl: SECTIONS.messages.hl,
        det: "Отмеченные на сегодняшних парах. Деканат видит итог и может признать пропуск уважительным.",
        chip: { icon: "user-check", label: "Отметить", href: "/teacher/classes" } },
    ],
    tiles: [
      { key: "cl", label: "Занятия", sub: `${live.length} сегодня`, icon: "calendar-days", color: SECTIONS.classes.badge, href: "/teacher/classes" },
      { key: "jr", label: "Журнал", sub: `${counts.sections} ${plural(counts.sections, "группа", "группы", "групп")}`, icon: "table", color: SECTIONS.journal.badge, href: "/teacher/journal" },
      { key: "in", label: "Уведомления", sub: counts.unread ? `${counts.unread} новых` : "новых нет", icon: "bell", color: SECTIONS.inbox.badge, href: "/teacher/inbox" },
      { key: "pr", label: "Профиль", sub: "тема, выход", icon: "user", color: SECTIONS.profile.badge, href: "/teacher/profile" },
    ],
  };
});
