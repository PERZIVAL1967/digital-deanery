// Dates and times are shown in Moscow time. Day strings are YYYY-MM-DD.
const TZ = "Europe/Moscow";
const dayFmt = new Intl.DateTimeFormat("en-CA", { timeZone: TZ, year: "numeric", month: "2-digit", day: "2-digit" });
const timeFmt = new Intl.DateTimeFormat("ru-RU", { timeZone: TZ, hour: "2-digit", minute: "2-digit", hourCycle: "h23" });
const longFmt = new Intl.DateTimeFormat("ru-RU", { weekday: "long", day: "numeric", month: "long", timeZone: "UTC" });
const dmFmt = new Intl.DateTimeFormat("ru-RU", { day: "numeric", month: "long", timeZone: "UTC" });
const shortFmt = new Intl.DateTimeFormat("ru-RU", { day: "numeric", month: "short", timeZone: "UTC" });

export const WEEKDAYS = ["пн", "вт", "ср", "чт", "пт", "сб", "вс"];
export const SLOT_TIMES = ["09:00-10:20", "10:35-11:55", "12:55-14:15", "14:30-15:50", "16:00-17:20", "17:30-18:50"];
export const CYCLE_START = "2026-11-16"; // Monday of week 1

export const isDay = (value: unknown): value is string =>
  typeof value === "string" && /^20\d{2}-\d{2}-\d{2}$/.test(value) &&
  !Number.isNaN(Date.parse(value + "T12:00:00Z")) && new Date(value + "T12:00:00Z").toISOString().startsWith(value);

export const mskDay = (date: Date) => dayFmt.format(date);
export const mskTime = (date: Date) => timeFmt.format(date);
export const today = () => mskDay(new Date());

const noon = (day: string) => Date.parse(day + "T12:00:00Z");
export const shiftDay = (day: string, n: number) => new Date(noon(day) + n * 86400000).toISOString().slice(0, 10);
export const weekday = (day: string) => (new Date(noon(day)).getUTCDay() + 6) % 7; // 0 = Monday
export const monday = (day: string) => shiftDay(day, -weekday(day));
export const dayNumber = (day: string) => new Date(noon(day)).getUTCDate();
export const daysBetween = (from: string, to: string) => Math.round((noon(to) - noon(from)) / 86400000);
export const cycleWeek = (day: string) => {
  const cycle = ((daysBetween(CYCLE_START, day) % 14) + 14) % 14;
  return cycle < 7 ? 1 : 2;
};

export const fmtLong = (day: string) => longFmt.format(new Date(noon(day)));
export const fmtDayMonth = (day: string) => dmFmt.format(new Date(noon(day)));
export const fmtShort = (day: string) => shortFmt.format(new Date(noon(day))).replace(".", "");

// Moscow is UTC+3 all year, so a day's range is fixed.
export const dayStart = (day: string) => `${day} 00:00+03`;

/** «сегодня 09:12», «вчера 18:40», «19 ноября 16:05» */
export function fmtWhen(date: Date, now = new Date()) {
  const day = mskDay(date);
  const diff = daysBetween(day, mskDay(now));
  const time = mskTime(date);
  if (diff === 0) return `сегодня ${time}`;
  if (diff === 1) return `вчера ${time}`;
  return `${fmtDayMonth(day)} ${time}`;
}

/** «сегодня», «завтра», «в понедельник, 23 ноября» */
export function fmtRelativeDay(day: string, now = today()) {
  const diff = daysBetween(now, day);
  if (diff === 0) return "сегодня";
  if (diff === 1) return "завтра";
  return fmtLong(day);
}

export function plural(n: number, one: string, few: string, many: string) {
  const m10 = n % 10, m100 = n % 100;
  if (m10 === 1 && m100 !== 11) return one;
  if (m10 >= 2 && m10 <= 4 && (m100 < 12 || m100 > 14)) return few;
  return many;
}

/** room name as shown: «ауд. 3049», «зал 4», «онлайн» */
export const loc = (room: string | null | undefined) =>
  !room ? "" : room === "онлайн" || room.startsWith("зал") ? room : "ауд. " + room;
