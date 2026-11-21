import { requireRole } from "../../../../lib/guard";
import { mySections } from "../../../../lib/dal/teacher";
import { CabProfile } from "../../../../components/cabinet-pages";

export const metadata = { title: "Профиль" };

export default async function Profile() {
  const { token, profile } = await requireRole("teacher");
  const sections = await mySections(token);
  const courses = [...new Set(sections.map((s) => s.course))];
  return <CabProfile home="/teacher" name={profile.name} sub="Преподаватель"
    rows={[["Роль", "Преподаватель"], ["Курсы", courses.join(", ") || "-"], ["Групп", String(sections.length)]]} />;
}
