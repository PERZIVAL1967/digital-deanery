import { requireRole } from "../../../../../lib/guard";
import { serviceCategories } from "../../../../../lib/request-services";
import { CATALOG } from "../../../../../lib/request-ui";
import { Page, Row } from "../../../../../components/ui";
import { Icon } from "../../../../../components/icons";

export const metadata = { title: "Подать заявку" };

export default async function Catalog() {
  await requireRole("student");
  return <Page title="Подать заявку" back={{ href: "/requests", label: "Назад" }}>
    {CATALOG.map(([group, items]) => <div key={group} className="grp"><b>{group}</b>
      <div className="rows">{items.map(([kind, name, days]) => <Row key={kind} href={`/requests/new/${kind}`} t={name} s={days} />)}</div>
    </div>)}
    <details className="more"><summary><Icon name="chevron-down" />Все услуги деканата</summary>
      <div className="stack">{serviceCategories.map((c) => <div key={c.title} className="grp"><b>{c.title}</b>
        <div className="rows">{Object.entries(c.services).map(([kind, name]) => <Row key={kind} href={`/requests/new/${kind}`} t={name} />)}</div>
      </div>)}</div>
    </details>
  </Page>;
}
