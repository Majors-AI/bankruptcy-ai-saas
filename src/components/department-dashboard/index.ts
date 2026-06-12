// Department-dashboard module — shared shell for Intake / Accounting / Legal.
//
// Extracted from IntakeDashboard.tsx during Slice-1 (Prompt 54). The Intake
// host re-imports everything from this barrel; the Accounting + Legal
// dashboards (future) will mount the same primitives with their own data.

export { DashboardGrid } from "./DashboardGrid";
export type { DashboardGridProps } from "./DashboardGrid";

export { AllTasksWidget, LeftModeToggle, TaskScopeToggle } from "./AllTasksWidget";
export type { AllTasksWidgetProps } from "./AllTasksWidget";

export { AttentionBubble, ClockBubble } from "./AttentionBubble";
export type { AttentionBubbleProps } from "./AttentionBubble";

export { TopBubblesRow, OverviewBubble, RetentionBubble } from "./BubblesRow";
export type { TopBubblesRowProps } from "./BubblesRow";

export { ConsolidatedMessagingWidget } from "./ConsolidatedMessagingWidget";
export type {
  ConsolidatedMessagingWidgetProps,
  MsgTab,
} from "./ConsolidatedMessagingWidget";

export {
  Card, CardHeader, CountBadge, EmptyHint, SampleChip, ComingSoonChip,
  ColorTag, ColorDot, DueLine, COLOR_CFG, BubbleCard, CompactStat,
  PlaceholderValue,
} from "./primitives";

export type {
  TaskColor, TaskEntry,
  TimeClockState, TimeClockActions,
  ClientMessageThread, ClientMessage, StaffMessage,
  DeptKey, DeptMetricDef, DeptMetricSet,
} from "./types";

export {
  INTAKE_METRICS, LEGAL_METRICS, ACCOUNTING_METRICS,
} from "./types";

export {
  FIRM_TZ, todayInFirmTz, nextBusinessDay, relativeTime, formatHm, formatDueLabel,
} from "./time";
