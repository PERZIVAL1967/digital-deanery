import type { ClassRow } from "./dal/cifry";
import { fmtDayMonth, loc, mskDay, mskTime } from "./time";

/** how a class changed, for tags and «было/стало» */
export function classChange(c: Pick<ClassRow, "status" | "room" | "original_room" | "starts_at" | "original_start">) {
  if (c.status === "cancelled") return { kind: "cancel" as const, tag: "Отмена", was: null as string | null, now: null as string | null };
  if (c.status !== "moved") return null;
  const roomChanged = !!c.original_room && c.original_room !== c.room;
  const timeChanged = !!c.original_start && c.original_start.getTime() !== c.starts_at.getTime();
  const at = (d: Date, base: Date | null) => (base && mskDay(d) !== mskDay(base) ? fmtDayMonth(mskDay(d)) + ", " : "") + mskTime(d);
  const was = [timeChanged ? at(c.original_start!, c.starts_at) : null, roomChanged ? loc(c.original_room) : null].filter(Boolean).join(", ");
  const now = [timeChanged ? at(c.starts_at, c.original_start) : null, roomChanged ? loc(c.room) : null].filter(Boolean).join(", ");
  return { kind: timeChanged ? "moved-time" as const : "moved-room" as const, tag: timeChanged ? "Перенос" : "Новая ауд.", was: was || null, now: now || null };
}
