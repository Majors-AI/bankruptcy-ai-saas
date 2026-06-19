// Legal Portal — design tokens + stage metadata
//
// Extracted from docs/design/legal-portal-reference.jsx for the restyle.
// MAPPING-DOC ANCHOR: §11 sub-phase 1 scope.
//
// What lives here:
//   • The `c` palette (light theme — paper / ink / teal / amber / slate).
//   • The `mono` font-family constant.
//   • STAGES (14 pipeline stages × 4 phases) — pure structural metadata,
//     no client data, no mock answers.
//   • STAGE_BY_KEY index for O(1) lookup.
//   • PHASES — pure copy strings.
//   • NEXT_STEP — stage → "next step" label (copy only).
//   • Helpers (stageTone / needsAction / initials).
//
// What is intentionally NOT here (per §10.2 mapping-doc audit — zero
// mock-data dependencies):
//   - CASE / DOCS / FORMS / FIELD_MAP / SCHED_VALUES / CASES /
//     AZ_EXEMPTIONS / ALL_SLOTS / LOCAL_FORMS / PREVIEW_IMG
//   These reference arrays are MOCK DATA used by the .jsx demo only.
//   The restyle wires real DB sources, never the mock arrays.
//
// Six post-petition stages (m341_docs / m341_submitted / m341_concluded /
// finmgmt / discharge / closed) are flagged STUBBED — they render
// inactive in the Pipeline bar until the schema columns from
// docs/schema-changes-for-canelo.md §1 / §10 land. See `STUBBED_STAGES`.

import type { LucideIcon } from "lucide-react";
import {
  ClipboardCheck, Video, RefreshCw, Scale, FileCheck2,
  CalendarClock, PenLine, Gavel, FileText, Upload,
  CheckCircle2, GraduationCap, Award, Archive,
} from "lucide-react";

// ── Color palette (light theme) ─────────────────────────────────────────

export const c = {
  ink:        "#16233A",
  inkSoft:    "#27364F",
  paper:      "#FFFFFF",
  bg:         "#EEF1F6",
  bgWarm:     "#F6F8FB",
  line:       "#DDE3EC",
  teal:       "#0E9C7A",
  tealSoft:   "#E4F4EF",
  tealLine:   "#A9DECD",
  amber:      "#C2680F",
  amberSoft:  "#FBEFDF",
  amberLine:  "#EAC79B",
  red:        "#B23B3B",
  redSoft:    "#F8E9E9",
  slate:      "#5B6677",
  slateLight: "#8A95A6",
} as const;

export const mono = "ui-monospace, SFMono-Regular, Menlo, monospace";

// ── Pipeline stages (14 × 4 phases) ─────────────────────────────────────

export type StageKey =
  | "submitted" | "paralegal" | "fixes" | "attorney" | "approved"
  | "schedule" | "sign_done" | "filed"
  | "m341_docs" | "m341_submitted" | "m341_concluded" | "finmgmt"
  | "discharge" | "closed";

export type Phase = "Prepare" | "Sign & file" | "Administration" | "Discharge";

export interface StageMeta {
  key:   StageKey;
  label: string;
  phase: Phase;
  icon:  LucideIcon;
}

export const STAGES: readonly StageMeta[] = [
  { key: "submitted",      label: "Submitted",             phase: "Prepare",        icon: ClipboardCheck },
  { key: "paralegal",      label: "Paralegal review",      phase: "Prepare",        icon: Video },
  { key: "fixes",          label: "Client fixes",          phase: "Prepare",        icon: RefreshCw },
  { key: "attorney",       label: "Attorney review",       phase: "Prepare",        icon: Scale },
  { key: "approved",       label: "Approved for signing",  phase: "Prepare",        icon: FileCheck2 },
  { key: "schedule",       label: "Schedule signing",      phase: "Sign & file",    icon: CalendarClock },
  { key: "sign_done",      label: "Signing completed",     phase: "Sign & file",    icon: PenLine },
  { key: "filed",          label: "Filed",                 phase: "Sign & file",    icon: Gavel },
  { key: "m341_docs",      label: "341 — docs needed",     phase: "Administration", icon: FileText },
  { key: "m341_submitted", label: "341 — trustee docs in", phase: "Administration", icon: Upload },
  { key: "m341_concluded", label: "341 concluded",         phase: "Administration", icon: CheckCircle2 },
  { key: "finmgmt",        label: "Financial mgmt course", phase: "Administration", icon: GraduationCap },
  { key: "discharge",      label: "Discharge notice",      phase: "Discharge",      icon: Award },
  { key: "closed",         label: "Case closed",           phase: "Discharge",      icon: Archive },
] as const;

export const STAGE_BY_KEY: Readonly<Record<StageKey, StageMeta>> =
  STAGES.reduce<Record<StageKey, StageMeta>>((acc, s) => {
    acc[s.key] = s;
    return acc;
  }, {} as Record<StageKey, StageMeta>);

export const PHASES: readonly Phase[] = ["Prepare", "Sign & file", "Administration", "Discharge"];

export const SCHEDULE_IDX = STAGES.findIndex((s) => s.key === "schedule");

// Six post-petition stages with no current signal source. Render inactive
// in the Pipeline bar until docs/schema-changes-for-canelo.md §1 / §10
// post-petition columns land. Hover tooltip: "not yet wired".
//
// `finmgmt` is included because the firm-files-Form-423 workflow that
// drives the stage transition is not yet built; schema §7 covers the
// upstream `client_documents.cc_course_completed_at` column.
export const STUBBED_STAGES: ReadonlySet<StageKey> = new Set<StageKey>([
  "m341_docs",
  "m341_submitted",
  "m341_concluded",
  "finmgmt",
  "discharge",
  "closed",
]);

// ── "Next step" copy (label only; no data) ──────────────────────────────

export const NEXT_STEP: Readonly<Record<StageKey, string>> = {
  submitted:      "Assign paralegal & start review",
  paralegal:      "Verify schedule values & documents",
  fixes:          "Waiting on client to resubmit",
  attorney:       "Apply exemptions & approve for signing",
  approved:       "Approved — client finishing fee & counseling",
  schedule:       "Pick a signing time from client's availability",
  sign_done:      "Signing completed — ready to file",
  filed:          "Filed — awaiting 341 meeting",
  m341_docs:      "Send trustee the requested documents",
  m341_submitted: "Trustee docs submitted — awaiting 341",
  m341_concluded: "341 concluded — financial mgmt course next",
  finmgmt:        "Client course done — firm files certificate",
  discharge:      "Discharge entered",
  closed:         "Case closed",
};

// ── Helpers (pure) ──────────────────────────────────────────────────────

export type StageTone = "ok" | "flag" | "ink" | "pending";

export function stageTone(stage: StageKey): StageTone {
  if (stage === "filed" || stage === "m341_concluded" || stage === "discharge" || stage === "closed") return "ok";
  if (stage === "fixes" || stage === "approved") return "flag";
  if (
    stage === "submitted"      || stage === "paralegal"  || stage === "attorney" ||
    stage === "schedule"       || stage === "sign_done"  ||
    stage === "m341_docs"      || stage === "m341_submitted" ||
    stage === "finmgmt"
  ) return "ink";
  return "pending";
}

export type LegalRole = "paralegal" | "attorney" | "client";

export function needsAction(role: LegalRole, stage: StageKey): boolean {
  if (role === "paralegal") return stage === "submitted" || stage === "paralegal" || stage === "m341_docs" || stage === "finmgmt";
  if (role === "attorney")  return stage === "attorney"  || stage === "schedule";
  return false;
}

export function initials(name: string): string {
  if (!name || name === "Unassigned" || name === "—") return "–";
  return name.split(/\s+/).filter(Boolean).map((w) => w[0]).slice(0, 2).join("");
}
