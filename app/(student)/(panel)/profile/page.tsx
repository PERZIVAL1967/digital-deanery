import { cookies } from "next/headers";
import { requireRole } from "../../../../lib/guard";
import { studentProfile } from "../../../../lib/dal/cifry";
import { Page, initials } from "../../../../components/ui";
import { Icon } from "../../../../components/icons";
import { ThemeButton } from "../../../../components/client";
import { logout } from "../../../actions";

export const metadata = { title: "Профиль" };

export default async function Profile() {
  const { token } = await requireRole("student");
  const night = (await cookies()).get("theme")?.value === "night";
  const p = await studentProfile(token);
  if (!p) return null;
  const dash = "-";
  const groups: [string, [string, string | number | null][]][] = [
    ["Информация", [["Номер зачётной книжки", p.record_book], ["Учебное подразделение", p.faculty], ["Уровень подготовки", p.study_level],
      ["Направление подготовки", p.programme], ["Направленность (профиль)", p.profile_name], ["Форма обучения", p.study_form],
      ["Год поступления", p.admission_year], ["Курс", p.course_year], ["Группа", p.group_name], ["Статус обучения", p.study_status]]],
    ["Персональная информация", [["Логин", p.login], ["Email для уведомлений", p.email], ["Пароль от почты", "Не отображается"],
      ["Пол", p.gender], ["Дата рождения", p.birth_date]]],
    ["Контактная информация", [["Электронная почта", p.email], ["Мобильный телефон", p.phone], ["Адрес", p.address]]],
  ];
  return <Page title="Профиль">
    <div className="pcover"><i aria-hidden="true">{initials(p.name)}</i><div><strong>{p.name}</strong><small>{p.group_name}, факультет {p.faculty}</small></div></div>
    <div className="field"><span className="flabel" id="theme-l">Тема</span><ThemeButton night={night} variant="seg" /></div>
    <div className="pfs">{groups.map(([h, fields]) => <section key={h}><h3>{h}</h3><dl>{fields.map(([k, v]) =>
      <div key={k}><dt>{k}</dt><dd>{v ?? dash}</dd></div>)}</dl></section>)}</div>
    <form action={logout}><button type="submit" className="btn sec full"><Icon name="log-out" />Выйти</button></form>
    <p className="note" style={{ opacity: .75 }}>Все данные вымышленные. Это концепт для конкурса, не официальный сервис.</p>
  </Page>;
}
