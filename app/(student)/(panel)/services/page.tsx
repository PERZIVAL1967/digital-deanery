import Link from "next/link";
import { requireRole } from "../../../../lib/guard";
import { homeData } from "../../../../lib/home";
import { Page } from "../../../../components/ui";
import { TileView } from "../../../../components/client";

export const metadata = { title: "Всё остальное" };

export default async function Services() {
  const { token } = await requireRole("student");
  const { tiles } = await homeData(token);
  return <Page title="Всё остальное" fig={{ num: String(tiles.length), label: "сервисов" }}>
    <div className="tiles">{tiles.map((t, i) => <TileView key={t.key} t={t} i={i} />)}</div>
    <Link className="btn sec full" href="/inbox">Уведомления</Link>
  </Page>;
}
