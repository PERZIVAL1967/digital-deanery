import { requireRole } from "../../../../lib/guard";
import { deanHomeData } from "../../../../lib/cabinet-home";
import { CabServices } from "../../../../components/cabinet-pages";

export const metadata = { title: "Всё остальное" };

export default async function Services() {
  const { token, profile } = await requireRole("staff");
  const h = await deanHomeData(token, profile.name);
  return h ? <CabServices home="/staff" h={h} /> : null;
}
