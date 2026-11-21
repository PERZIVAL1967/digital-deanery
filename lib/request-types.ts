export { kinds } from "./request-services";
export const statuses = {
  submitted: "Подано", in_review: "На рассмотрении", needs_info: "Нужно уточнение",
  ready: "Готово", issued: "Выдано", rejected: "Отклонено", withdrawn: "Отозвано",
};
export type Status = keyof typeof statuses;
export type Mode = "student" | "staff";

export const transitions: Record<Mode, Partial<Record<Status, Status[]>>> = {
  student: { submitted: ["withdrawn"], needs_info: ["in_review"] },
  staff: { submitted: ["in_review"], in_review: ["needs_info", "ready", "rejected"], ready: ["issued"] },
};
