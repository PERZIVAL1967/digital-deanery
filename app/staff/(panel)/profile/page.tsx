import { requireRole } from "../../../../lib/guard";
import { CabProfile } from "../../../../components/cabinet-pages";

export const metadata = { title: "Профиль" };

export default async function Profile() {
  const { profile } = await requireRole("staff");
  return <CabProfile home="/staff" name={profile.name} sub={`Деканат факультета ${profile.faculty ?? ""}`}
    rows={[["Роль", "Сотрудник деканата"], ["Факультет", profile.faculty ?? "-"], ["Доступ", "студенты, заявки и расписание своего факультета"]]} />;
}
