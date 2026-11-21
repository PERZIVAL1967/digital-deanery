import { requireRole } from "../../../../lib/guard";
import { teacherHomeData } from "../../../../lib/cabinet-home";
import { CabServices } from "../../../../components/cabinet-pages";

export const metadata = { title: "Всё остальное" };

export default async function Services() {
  const { token, profile } = await requireRole("teacher");
  const h = await teacherHomeData(token, profile.name);
  return h ? <CabServices home="/teacher" h={h} /> : null;
}
