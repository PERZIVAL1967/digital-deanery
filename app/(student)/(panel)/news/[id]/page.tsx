import { notFound } from "next/navigation";
import { requireRole, UUID } from "../../../../../lib/guard";
import { news } from "../../../../../lib/dal/cifry";
import { fmtDayMonth, mskDay } from "../../../../../lib/time";
import { Page } from "../../../../../components/ui";
import { Icon } from "../../../../../components/icons";
import { ToastButton } from "../../../../../components/client";

export const metadata = { title: "Новость" };

export default async function Article({ params }: { params: Promise<{ id: string }> }) {
  const { token } = await requireRole("student");
  const { id } = await params;
  if (!UUID.test(id)) notFound();
  const [n] = await news(token, id);
  if (!n) notFound();
  const deadline = /до \d+ (ноября|декабря|января)/.exec(n.body)?.[0];
  return <Page title={n.title} back={{ href: "/news", label: "Назад" }}>
    <span style={{ fontSize: 13, opacity: .7 }}>{fmtDayMonth(mskDay(n.published_at))}, {n.author}</span>
    <p className="note" style={{ fontSize: 16, lineHeight: "24px", whiteSpace: "pre-line" }}>{n.body}</p>
    {deadline && <ToastButton className="btn pri full" text={`Срок «${deadline}» добавлен в календарь.`}><Icon name="calendar-plus" />Добавить срок в календарь</ToastButton>}
  </Page>;
}
