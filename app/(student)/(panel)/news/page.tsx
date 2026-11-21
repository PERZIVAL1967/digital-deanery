import { requireRole } from "../../../../lib/guard";
import { news } from "../../../../lib/dal/cifry";
import { fmtDayMonth, mskDay, plural } from "../../../../lib/time";
import { Empty, Page, Row } from "../../../../components/ui";

export const metadata = { title: "Новости" };

export default async function News() {
  const { token } = await requireRole("student");
  const rows = await news(token);
  const week = rows.filter((n) => Date.now() - n.published_at.getTime() < 7 * 86400000).length;
  return <Page title="Новости" fig={{ num: String(week), label: `${plural(week, "новость", "новости", "новостей")} за неделю` }}>
    {rows.length ? <div className="rows">{rows.map((n) => <Row key={n.id} href={`/news/${n.id}`} t={n.title} s={`${fmtDayMonth(mskDay(n.published_at))}, ${n.author}`} />)}</div>
      : <Empty icon="newspaper" text="Новостей пока нет." />}
  </Page>;
}
