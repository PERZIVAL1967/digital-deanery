import type { ReactNode } from "react";
import { PanelShell } from "../../../components/client";

/**
 * Pages: full screen on the phone; on desktop a framed panel over the «Плакат дня» home.
 * No data here: the home is in (student)/layout and is not refetched when moving between pages.
 * Each page checks the role itself (requireRole), layouts are not re-run on client navigation.
 */
export default function PanelLayout({ children }: { children: ReactNode }) {
  return <PanelShell><main>{children}</main></PanelShell>;
}
