import Link from "next/link";
import { notFound } from "next/navigation";
import { requireRole, UUID } from "../../../../../../lib/guard";
import { requestList } from "../../../../../../lib/dal/cifry";
import { DAYS, requestName } from "../../../../../../lib/request-ui";
import { Page } from "../../../../../../components/ui";

export const metadata = { title: "Заявка принята" };

export default async function Done({ params }: { params: Promise<{ id: string }> }) {
  const { token } = await requireRole("student");
  const { id } = await params;
  if (!UUID.test(id)) notFound();
  const [r] = await requestList(token, "student", id);
  if (!r) notFound();
  return <Page title="Заявка принята" back={{ href: "/requests", label: "Назад" }}>
    <div className="bigstamp">Принято</div>
    <p className="note"><b>{requestName(r.kind)}</b>. Срок: {DAYS[r.kind] ?? "до 3 рабочих дней"}. Когда заявка будет готова, придёт уведомление.</p>
    <Link className="btn pri full" href="/requests">К моим заявкам</Link>
    <Link className="btn sec full" href={`/requests/${r.id}`}>Открыть заявку</Link>
  </Page>;
}
