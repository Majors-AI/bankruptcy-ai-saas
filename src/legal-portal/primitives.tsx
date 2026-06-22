// Shared visual primitives for the restyled legal portal.
//
// Extracted from docs/design/legal-portal-reference.jsx (lines 266–286
// for Pill / Eyebrow / NotifyBadge, line 1018–1022 for StageBadge).
// Pure presentational — design tokens from `legalPortalTokens.ts`.
//
// Reused across sub-phases 2 (Queue), 3 (Paralegal workspace), 4
// (Attorney workspace), 5 (Scheduling/FinMgmt/ClientPortal). No data,
// no side effects.

import { Mail, Smartphone } from "lucide-react";
import type { ReactNode } from "react";
import { c, STAGE_BY_KEY, stageTone, type StageKey, type StageTone } from "./legalPortalTokens";

// ── Pill ────────────────────────────────────────────────────────────────

const PILL_TONES: Record<StageTone, { bg: string; fg: string; bd: string }> = {
  ok:      { bg: c.tealSoft,  fg: c.teal,  bd: c.tealLine },
  flag:    { bg: c.amberSoft, fg: c.amber, bd: c.amberLine },
  pending: { bg: c.bgWarm,    fg: c.slate, bd: c.line },
  ink:     { bg: "rgba(255,255,255,0.06)", fg: c.ink, bd: c.line },
};

export function Pill({ tone = "ink", children }: { tone?: StageTone; children: ReactNode }) {
  const t = PILL_TONES[tone] ?? PILL_TONES.ink;
  return (
    <span
      className="inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-semibold"
      style={{ background: t.bg, color: t.fg, border: `1px solid ${t.bd}` }}
    >
      {children}
    </span>
  );
}

// ── Eyebrow ─────────────────────────────────────────────────────────────

export function Eyebrow({ children }: { children: ReactNode }) {
  return (
    <div
      className="text-xs font-bold uppercase"
      style={{ color: c.slateLight, letterSpacing: "0.14em" }}
    >
      {children}
    </div>
  );
}

// ── NotifyBadge ─────────────────────────────────────────────────────────

export function NotifyBadge({ label = "Email + SMS sent" }: { label?: string }) {
  return (
    <span
      className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold"
      style={{ background: c.tealSoft, color: c.teal, border: `1px solid ${c.tealLine}` }}
    >
      <Mail size={12} /> <Smartphone size={12} /> {label}
    </span>
  );
}

// ── StageBadge ──────────────────────────────────────────────────────────
//
// Renders a Pill for a given Pipeline stage key with the canonical icon
// + label + tone. Tone derives from `stageTone()` in legalPortalTokens.

export function StageBadge({ stage }: { stage: StageKey }) {
  const meta = STAGE_BY_KEY[stage];
  if (!meta) return null;
  const Icon = meta.icon;
  return (
    <Pill tone={stageTone(stage)}>
      <Icon size={12} /> {meta.label}
    </Pill>
  );
}

// ── Initials avatar ─────────────────────────────────────────────────────
//
// Small circular monogram used in Queue rows for the assignee.

export function InitialsAvatar({ name, size = 22 }: { name: string; size?: number }) {
  const init = !name || name === "Unassigned" || name === "—"
    ? "–"
    : name.split(/\s+/).filter(Boolean).map(w => w[0]).slice(0, 2).join("");
  return (
    <span
      className="rounded-full flex items-center justify-center font-bold"
      style={{ width: size, height: size, background: "#1e293b", color: c.ink, fontSize: 10 }}
      title={name}
    >
      {init}
    </span>
  );
}
