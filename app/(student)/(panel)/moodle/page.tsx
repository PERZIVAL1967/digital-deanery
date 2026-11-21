import { requireRole } from "../../../../lib/guard";
import { moodleTasks } from "../../../../lib/dal/cifry";
import { fmtDayMonth, plural } from "../../../../lib/time";
import { Empty, Page, Row, Tag } from "../../../../components/ui";
import { Icon } from "../../../../components/icons";
import { ToastButton } from "../../../../components/client";

export const metadata = { title: "Moodle" };

export default async function Moodle() {
  const { token } = await requireRole("student");
  const tasks = await moodleTasks(token);
  const week = tasks.filter((t) => t.days_left <= 7).length;
  return <Page title="Moodle" fig={{ num: String(week), label: `${plural(week, "задание", "задания", "заданий")} на неделе` }}>
    <div className="box"><span><Tag k="info">Внешняя система</Tag></span>
      <span className="note">Курсы и задания живут в Moodle. Здесь только сроки, а задания открываются на сайте Moodle.</span></div>
    {tasks.length ? <div className="rows">{tasks.map((t) => t.source === "teacher"
      ? <Row key={t.id} href={t.plagiarism ? "/plagiarism" : undefined} cls={t.plagiarism ? undefined : "plain"} t={t.course}
          s={`${t.title}, до ${fmtDayMonth(t.due_on)}. Задание преподавателя${t.plagiarism ? ", сдаётся через Антиплагиат" : ""}`}
          end={<Tag k="info">Задание</Tag>} />
      : <ToastButton key={t.id} className="row" text="В концепте это ссылка на Moodle университета.">
      <span className="lead" /><span className="t">{t.course}</span><span className="end"><Icon name="external-link" /></span>
      <span className="s">{t.title}, до {fmtDayMonth(t.due_on)}</span>
    </ToastButton>)}</div> : <Empty icon="graduation-cap" text="Ближайших сроков в Moodle нет." />}
  </Page>;
}
