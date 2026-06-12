// 3-column dashboard grid wrapper.
//
// Extracted from IntakeDashboard.tsx (Prompt 54). The wrapper class string
// is verbatim from the Intake host:
//
//   grid grid-cols-1 lg:grid-cols-[300px_minmax(0,1fr)_minmax(0,1.1fr)] gap-4
//
// LEFT (compact, 300px on lg+) — Tasks widget or alternate panel
// MIDDLE (flex)               — Up Next / outreach queue
// RIGHT (1.1× flex)           — Comms / messages
//
// On narrow viewports the columns stack vertically per the host's existing
// responsive behavior. No props beyond the three slots — every dashboard
// (Intake today, Accounting + Legal next) just plugs its widgets in.

import type { ReactNode } from "react";

export interface DashboardGridProps {
  left: ReactNode;
  middle: ReactNode;
  right: ReactNode;
}

export function DashboardGrid({ left, middle, right }: DashboardGridProps) {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-[300px_minmax(0,1fr)_minmax(0,1.1fr)] gap-4">
      {left}
      {middle}
      {right}
    </div>
  );
}
