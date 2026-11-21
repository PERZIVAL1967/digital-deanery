import type { ReactNode } from "react";
import { requireRole } from "../../lib/guard";
import { CabinetShell } from "../../components/cabinet";
import { TEACHER_MENU, TEACHER_SECTIONS, teacherHomeData } from "../../lib/cabinet-home";

export const metadata = { title: { default: "Преподаватель", template: "%s - Преподаватель" } };

/** the teacher's cabinet: today's classes and big numbers stay mounted; pages open over it from (panel)/ */
export default async function TeacherLayout({ children }: { children: ReactNode }) {
  const { token, profile } = await requireRole("teacher");
  const h = await teacherHomeData(token, profile.name);
  if (!h) return null;
  return <CabinetShell home="/teacher" h={h} menu={TEACHER_MENU} sections={TEACHER_SECTIONS}>{children}</CabinetShell>;
}
