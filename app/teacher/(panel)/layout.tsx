import type { ReactNode } from "react";
import { PanelShell } from "../../../components/client";

/** pages of the teacher's cabinet: full screen on the phone, the framed side panel on desktop (as for students) */
export default function TeacherPanel({ children }: { children: ReactNode }) {
  return <PanelShell><main>{children}</main></PanelShell>;
}
