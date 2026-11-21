import type { ReactNode } from "react";
import { requireRole } from "../../lib/guard";
import { CabinetShell } from "../../components/cabinet";
import { DEAN_MENU, DEAN_SECTIONS, deanHomeData } from "../../lib/cabinet-home";

export const metadata = { title: { default: "Деканат", template: "%s - Деканат" } };

/** the dean's cabinet: the home with four big numbers stays mounted; pages open over it from (panel)/ */
export default async function StaffLayout({ children }: { children: ReactNode }) {
  const { token, profile } = await requireRole("staff");
  const h = await deanHomeData(token, profile.name);
  if (!h) return null;
  return <CabinetShell home="/staff" h={h} menu={DEAN_MENU} sections={DEAN_SECTIONS}>{children}</CabinetShell>;
}
