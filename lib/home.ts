// The home screen's three big numbers and the service tiles, computed from the database.
import { cache } from "react";
import * as dal from "./dal/cifry";
import { daysBetween, dayStart, fmtRelativeDay, loc, mskDay, mskTime, plural, shiftDay, today } from "./time";
import type { TileData } from "../components/client";
import type { Fig } from "../components/ui";
import type { IconName } from "../components/icons";
import { SECTIONS } from "./sections";

export const shortCourse = (name: string) => ({
  "Учет во внешнеэкономической деятельности и отчетность": "Учет во ВЭД",
  "Экономика Европейского Союза и Великобритании": "Экономика ЕС",
  "Теория международных экономических отношений": "Теория МЭО",
} as Record<string, string>)[name] ?? name;

export type BigNumber = { lab: string; fig: Fig; det: string; detNode?: { course: string; when: string; was: string | null; now: string };
  chip: { icon: IconName; label: string; href: string }; hl: string };

export const homeData = cache(async (token: string) => {
  const day = today();
  const [profile, unread, next, works, grades, todays, requests, docs, news, exams] = await Promise.all([
    dal.studentProfile(token), dal.unreadCount(token), dal.nextClass(token), dal.plagiarismWorks(token),
    dal.grades(token), dal.classesBetween(token, dayStart(day), dayStart(shiftDay(day, 1))),
    dal.requestList(token, "student"), dal.documents(token), dal.news(token), dal.exams(token),
  ]);

  // 1. time until the next class
  let first: BigNumber;
  if (next) {
    const minutes = Math.max(0, Math.round((next.starts_at.getTime() - Date.now()) / 60000));
    const classDay = mskDay(next.starts_at);
    const days = daysBetween(day, classDay);
    const fig: Fig = minutes < 60 ? { num: String(minutes), unit: "мин", label: "" }
      : minutes < 24 * 60 ? { num: `${Math.floor(minutes / 60)}:${String(minutes % 60).padStart(2, "0")}`, unit: "ч", label: "" }
      : { num: String(days), unit: plural(days, "день", "дня", "дней"), label: "" };
    const moved = next.original_room && next.original_room !== next.room;
    const when = mskTime(next.starts_at) + (days === 0 ? "" : ", " + fmtRelativeDay(classDay, day));
    first = {
      lab: "до следующей пары", fig, hl: SECTIONS.timetable.hl,
      det: `${next.course}, ${when}. ` + (moved ? `Новая аудитория: ${next.original_room} -> ${next.room}.` : `${loc(next.room)[0].toUpperCase()}${loc(next.room).slice(1)}.`),
      detNode: { course: next.course, when, was: moved ? next.original_room : null, now: moved ? next.room! : loc(next.room) },
      chip: { icon: "calendar-days", label: "Расписание", href: `/timetable?d=${classDay}` },
    };
  } else {
    first = { lab: "занятий впереди нет", fig: { num: "0", label: "" }, hl: SECTIONS.timetable.hl, det: "В расписании больше нет занятий.",
      chip: { icon: "calendar-days", label: "Расписание", href: "/timetable" } };
  }

  // 2. the nearest plagiarism deadline
  const waiting = works.filter((w) => w.status === "waiting" && w.days_left >= 0).sort((a, b) => a.days_left - b.days_left);
  let second: BigNumber;
  if (waiting.length) {
    const w = waiting[0];
    const essay = /^эссе/i.test(w.title);
    second = {
      lab: `${plural(w.days_left, "день", "дня", "дней")} до загрузки ${essay ? "эссе" : "работы"}`,
      fig: { num: String(w.days_left), label: "" }, hl: SECTIONS.plagiarism.hl,
      det: `Антиплагиат, порог ${w.threshold} %. ${w.title} ещё не ${essay ? "загружено" : "загружена"}.`,
      chip: { icon: "upload", label: "Загрузить", href: "/plagiarism" },
    };
  } else {
    const last = works.filter((w) => w.originality !== null)[0];
    second = { lab: "оригинальность последней работы", fig: { num: String(last?.originality ?? 0), unit: "%", label: "" }, hl: SECTIONS.plagiarism.hl,
      det: "Все работы загружены в Антиплагиат.", chip: { icon: "upload", label: "Антиплагиат", href: "/plagiarism" } };
  }

  // 3. average score
  const avg = grades.length ? Math.round(grades.reduce((s, g) => s + g.score, 0) / grades.length) : 0;
  const debts = grades.filter((g) => g.score < 50);
  const weakest = [...grades].sort((a, b) => a.score - b.score)[0];
  const third: BigNumber = {
    lab: "средний балл из 100", fig: { num: String(avg), label: "" }, hl: SECTIONS.grades.hl,
    det: (debts.length ? `${debts.length === 1 ? "Один долг" : `Долгов: ${debts.length}`}: ${debts.map((d) => shortCourse(d.course)).join(", ")}.` : "Долгов нет.") +
      (weakest ? ` Слабее всего ${shortCourse(weakest.course)}: ${weakest.score}.` : ""),
    chip: { icon: "trending-up", label: "Все предметы", href: "/grades" },
  };

  const liveToday = todays.filter((c) => c.status !== "cancelled");
  const ready = requests.filter((r) => r.status === "ready").length;
  const inWork = requests.filter((r) => ["submitted", "in_review", "needs_info"].includes(r.status)).length;
  const firstExam = exams[0];
  const plagWaiting = works.filter((w) => w.status === "waiting").length;

  const tiles: TileData[] = [
    { key: "week", label: "Расписание", sub: liveToday.length ? `${liveToday.length} ${plural(liveToday.length, "занятие", "занятия", "занятий")}` : "сегодня свободно", icon: "calendar-days", color: SECTIONS.timetable.badge, href: "/timetable" },
    { key: "grades", label: "Успеваемость", sub: `${avg} ${plural(avg, "балл", "балла", "баллов")}`, icon: "trending-up", color: SECTIONS.grades.badge, href: "/grades" },
    { key: "plag", label: "Антиплагиат", sub: plagWaiting ? `${plagWaiting} ${plural(plagWaiting, "ждёт", "ждут", "ждут")}` : "всё загружено", icon: "shield-check", color: SECTIONS.plagiarism.badge, href: "/plagiarism" },
    { key: "moodle", label: "Moodle", sub: "внешняя", icon: "graduation-cap", color: SECTIONS.moodle.badge, href: "/moodle" },
    { key: "exams", label: "Сессия", sub: firstExam ? `с ${new Intl.DateTimeFormat("ru-RU", { day: "numeric", month: "short", timeZone: "Europe/Moscow" }).format(firstExam.starts_at).replace(".", "")}` : "нет", icon: "calendar-check", color: SECTIONS.exams.badge, href: "/exams" },
    { key: "requests", label: "Заявки", sub: ready ? `${ready} ${plural(ready, "готова", "готовы", "готовы")}` : inWork ? `${inWork} в работе` : "подать", icon: "file-text", color: SECTIONS.requests.badge, href: "/requests" },
    { key: "docs", label: "Документы", sub: `${docs.length} PDF`, icon: "files", color: SECTIONS.documents.badge, href: "/documents" },
    { key: "ask", label: "Вопрос", sub: "в деканат", icon: "message-circle", color: SECTIONS.ask.badge, href: "/ask" },
    { key: "news", label: "Новости", sub: `${news.length} ${plural(news.length, "новость", "новости", "новостей")}`, icon: "newspaper", color: SECTIONS.news.badge, href: "/news" },
    { key: "ebs", label: "Библиотека", sub: "ЭБС, внешняя", icon: "book-open", color: "#5C6BC0", toast: "В концепте это ссылка на ЭБС университета." },
    { key: "profile", label: "Профиль", sub: profile?.group_name ?? "", icon: "user", color: SECTIONS.profile.badge, href: "/profile" },
  ];

  return { day, profile, unread, nums: [first, second, third], todays, tiles };
});
