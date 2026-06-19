# Schema changes for Canelo — v1 launch batch

Running batch of DB changes required by the v1-launch frontend work
(eight changes, see the v1 prompt). Frontend code is being built against
the agreed shapes below. **Agent does not write or run migrations** —
this doc is the spec for Canelo to apply.

## Conventions (apply to every change below unless overridden)

- **Additive and nullable.** Every new column is nullable with a sensible
  default; no existing rows blocked by a NOT-NULL backfill.
- **Multi-tenant.** Every new table carries `firm_id uuid not null
  references firms(id) on delete cascade` and an RLS policy of
  `firm_id = current_setting('app.current_firm_id')::uuid` (matching the
  existing per-table pattern). Indexes on `(firm_id, ...)` keyed by the
  most common filter.
- **Timestamps.** Every new table has `created_at timestamptz not null
  default now()` and (where mutated) `updated_at timestamptz not null
  default now()` with the standard `update_updated_at` trigger.
- **Enums.** Where an enum is specified, prefer a `text` column with a
  `CHECK (col IN (...))` constraint over a Postgres `ENUM` type (easier
  to extend without `ALTER TYPE`).
- **NULL-tolerant CHECKs.** Every new CHECK constraint added to an
  existing table must permit `NULL` on the new column(s) so historical
  rows do not retroactively fail validation. Pattern:
  `CHECK (col IS NULL OR col IN (...))`. The check fires only when a
  caller writes a value to the new column — old rows remain valid
  forever. Same rule on any cross-column CHECK that gates new behavior
  (e.g. the hard-accept-gate constraints in §6): write them so they only
  apply to new accept decisions and do not retroactively fail existing
  acceptance rows.
- **Frontend posture.** All new columns are read with `?.` and treated
  as optional in TS types until Canelo confirms the migration is live —
  so a pre-migration deploy keeps working. Frontend then drops the
  optionality once each migration lands.

## Quality-gate stance (frontend side)

The typecheck error cap (254) is a **ceiling that should trend DOWN, not a
target to sit at**. No phase of this v1 work is allowed to push the cap
higher. When new TS issues are introduced in the course of a change, fix
them in the same diff; do not "absorb" them into the ceiling. Existing
baseline errors should be drained opportunistically as their files are
touched. Build green + vitest ≥ 90/90 are non-negotiable per change.

## Security posture for anonymous endpoints

Any new SECURITY DEFINER RPC reachable from the anon role (currently:
`consume_questionnaire_email_token` in §5; potentially the
landing-page "Call now" / "Schedule" Lead-creation path in §1 if those
end up reachable pre-auth) **must be designed for hostile use**. The
specific guards Canelo's review must verify on every such RPC:

- **Strict single-use.** Token row carries `used_at`; a second attempt
  on the same token MUST fail. Enforce via the RPC body (atomic check +
  set) plus a unique index where possible.
- **Short expiry.** Token has `expires_at`; default ≤ 14 days for email
  interview links, much shorter for any "live action" tokens.
  Expired tokens MUST fail without a user-distinguishing error message
  (avoid token-existence enumeration).
- **Scoped to one session.** Token resolves to exactly one
  `(session_id, question_id)` pair. The RPC must not be reusable across
  sessions even if the token leaks.
- **Firm-scoped.** RPC reads `firm_id` from the token row, not from any
  caller-supplied input. Every downstream write inherits that
  `firm_id`. No cross-firm leakage even with SECURITY DEFINER bypassing
  RLS for the read.
- **Rate-limited.** Token-consumption attempts (success + failure)
  should be rate-limited per source IP and per token to defeat brute-
  force scanning. Implementation can be a Supabase `pg_throttle`-style
  pattern or a dedicated `auth_attempts` audit table that the RPC
  consults.
- **Audit trail.** Every consumption attempt (success + failure) logs
  to an audit row that Canelo's review can subpoena: timestamp, IP,
  outcome, token hash (not the token itself).

Tight code review by Canelo + Dom required before any of these RPCs go
to a production firm; do not deploy the email-interview path until that
review is signed off.

## RLS verification across the new code

The Phase-1 frontend respects firm_id end-to-end:
- **`src/lib/intakeScheduling.ts`** calls `supabase.rpc("get_open_slots",
  …)` and `supabase.rpc("book_consultation", …)` through the standard
  `supabase` client. That client carries the signed-in user's JWT, which
  in turn supplies `app.current_firm_id` for every RLS check on the
  underlying `staff_availability` + `calendar_events` tables. **The
  adapter does not accept or forward a firm_id parameter** — it cannot
  bypass RLS even by accident. Firms cannot see each other's slots.
- **`src/lib/leadLifecycle.ts`** is pure data with no Supabase access.
- **`src/components/file-timeline/FileTimeline.tsx`** reads from a row
  that the caller fetched (which already passed RLS); the timeline does
  no DB access of its own.

Phase 2+ code that creates leads / writes to `intake_leads` /
`questionnaire_sessions` etc. will follow the same posture: every write
inherits `firm_id` from the user's session, never from a client-
supplied input. The schema-side RLS policies above are the enforcement
layer; the frontend's job is to not even attempt cross-firm reads.

---

## 1. `intake_leads` — additive columns (Change 1, Change 6)

The existing `intake_leads` table already has `status text`, `source
text`, `consultation_date timestamptz`, `assigned_name text`,
`intake_completed bool`, `sent_for_review bool`, `submission_id uuid`,
`claimed_by* (scaffold)`, etc. Add four additive columns:

| Column | Type | Nullable | Default | Notes |
|---|---|---|---|---|
| `channel` | `text` | yes | `null` | One of `call_now`, `live_chat`, `sms`, `scheduled`, `self_serve`, `agent_assisted`. **CHECK constraint.** Records which Change-1 entry option the lead came in through. The existing `source` column may continue to store free-text marketing source (referrer, etc.); `channel` is the structured entry-mode field. |
| `lifecycle_status` | `text` | yes | `'new'` | The normalized lifecycle: `new`, `contacted`, `in_intake`, `qualified`, `converted`, `handoff_to_legal`, `disqualified`, `lost`. **CHECK constraint.** The existing `status text` column stays for backward compat; frontend reads `lifecycle_status` when present, falls back to a mapping from `status` via `src/lib/leadLifecycle.ts` for legacy rows. A one-time backfill is specced below. |
| `questionnaire_completion_pct` | `smallint` | yes | `0` | Integer 0–100; written by the shared questionnaire engine (Change 2) as the client progresses. |
| `matter_progression` | `text` | yes | `null` | The post-conversion progression enum (Change 6): `submitted_to_paralegal`, `in_draft_review`, `submitted_to_attorney`, `attorney_approved`, `options_consult`, `scheduling`, `ready_to_proceed`. **CHECK constraint.** `null` while the lead is pre-conversion. |

**Indexes:**
- `idx_intake_leads_lifecycle_status (firm_id, lifecycle_status)` — drives the Intake board's status filter.
- `idx_intake_leads_matter_progression (firm_id, matter_progression) where matter_progression is not null` — drives the Legal board's progression filter.
- `idx_intake_leads_channel (firm_id, channel) where channel is not null` — for channel-mix reporting.

**One-time backfill — DO NOT default unknown values to `'new'`.** Before writing the migration:

1. Canelo runs `SELECT DISTINCT status, COUNT(*) FROM intake_leads GROUP BY status ORDER BY 2 DESC;` and surfaces the full list of historical `status` values found in the production DB.
2. Dom and Claude review the full list and produce an **explicit mapping for every real value**, including:
   - `'retained'` → `'converted'` (or `'handoff_to_legal'` if the client also got a paralegal review queued at retention time — confirm with Dom whether retained-then-untouched leads should go to `converted` and retained-then-routed-to-legal should go to `handoff_to_legal`)
   - `'no_show'` → `'lost'` (terminal — they didn't proceed)
   - every other value resolved deliberately, not silently
3. The explicit mapping is appended to this doc as a finalized backfill table before Canelo writes the migration. **The codebase's `STATUS_TO_LIFECYCLE_RAW` table in `src/lib/leadLifecycle.ts` is the runtime fallback for legacy rows pre-migration AND a sketch starting point — but the production backfill mapping is reviewed and finalized against the actual DISTINCT result, not assumed from the codebase.**
4. Anything still unresolved after that review escalates to Dom for a decision — **the migration does NOT proceed with an unreviewed fallback to `'new'`**.

After backfill, drop nothing — `status` stays as the audit-friendly legacy field. The frontend will preferentially read `lifecycle_status` once available; the runtime fallback in `leadLifecycle.ts` covers the gap between deploy and migration.

**CHECK constraint values:**
```sql
alter table intake_leads
  add constraint intake_leads_channel_chk check (
    channel is null or channel in (
      'call_now', 'live_chat', 'sms', 'scheduled', 'self_serve', 'agent_assisted'
    )
  ),
  add constraint intake_leads_lifecycle_chk check (
    lifecycle_status in (
      'new', 'contacted', 'in_intake', 'qualified', 'converted',
      'handoff_to_legal', 'disqualified', 'lost'
    )
  ),
  add constraint intake_leads_matter_progression_chk check (
    matter_progression is null or matter_progression in (
      'submitted_to_paralegal', 'in_draft_review', 'submitted_to_attorney',
      'attorney_approved', 'options_consult', 'scheduling', 'ready_to_proceed'
    )
  );
```

**RLS:** unchanged — `intake_leads` already enforces firm scoping; new columns inherit the same policy.

---

## 2. `tasks` table — NEW (Change 4)

A firm-scoped task layer linked to leads / clients / matters. Replaces the per-department in-memory task pools (`legalTasks.ts`, `accountingTasks.ts`) with durable rows so tasks can be assigned, auto-generated from workflow triggers, and carried forward on handoff.

```sql
create table tasks (
  id           uuid primary key default gen_random_uuid(),
  firm_id      uuid not null references firms(id) on delete cascade,

  -- The thing this task is about. Exactly one of these is non-null;
  -- enforced by a CHECK constraint. Per §3 decision (Option A), there is
  -- NO matter_id column — `lead_id` doubles as the matter identifier
  -- post-conversion.
  lead_id      uuid references intake_leads(id) on delete cascade,
  client_id    uuid references clients(id)      on delete cascade,

  title        text not null,
  description  text,

  -- Assignment. Either an individual staffer, a department, or both.
  -- Reuses the existing assignment-engine outputs; this table doesn't
  -- own the routing logic, just the result.
  assignee_user_id   uuid references auth.users(id) on delete set null,
  assignee_department text,    -- 'intake' | 'legal' | 'accounting' | null; CHECK below

  status       text not null default 'open',  -- CHECK: open | in_progress | blocked | done
  priority     text not null default 'normal',  -- CHECK: low | normal | high | urgent
  due_at       timestamptz,
  sla_at       timestamptz,    -- separate from due_at: SLA breach vs. soft deadline

  -- Provenance — which workflow trigger created this task. Useful for
  -- deduping auto-generated tasks and for the workflow-visibility view.
  source       text,           -- e.g. 'auto:lead_created', 'auto:docs_received', 'manual'
  source_ref   text,           -- optional reference (e.g. lead status that triggered it)

  -- Activity timeline — append-only event log per task. Stored as JSONB
  -- so the UI can render it without joining a separate `task_events` table.
  activity     jsonb not null default '[]'::jsonb,

  -- Audit
  created_by   uuid references auth.users(id) on delete set null,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  completed_at timestamptz,

  constraint tasks_one_subject_chk check (
    (lead_id is not null)::int +
    (client_id is not null)::int = 1
  ),
  constraint tasks_status_chk check (status in ('open','in_progress','blocked','done')),
  constraint tasks_priority_chk check (priority in ('low','normal','high','urgent')),
  constraint tasks_department_chk check (
    assignee_department is null or
    assignee_department in ('intake','legal','accounting')
  )
);

-- Updated-at trigger (existing convention).
create trigger trg_tasks_updated_at
  before update on tasks
  for each row execute function update_updated_at_column();

-- Indexes — board queries are (firm_id, department, status) and (firm_id, assignee, status).
create index idx_tasks_firm_dept_status     on tasks (firm_id, assignee_department, status);
create index idx_tasks_firm_assignee_status on tasks (firm_id, assignee_user_id, status);
create index idx_tasks_firm_lead            on tasks (firm_id, lead_id)   where lead_id   is not null;
create index idx_tasks_firm_client          on tasks (firm_id, client_id) where client_id is not null;
create index idx_tasks_firm_due             on tasks (firm_id, due_at)    where due_at    is not null;
-- §3 Option A: no matter_id column on tasks; index dropped accordingly.

-- RLS — standard firm scoping.
alter table tasks enable row level security;

create policy tasks_firm_select on tasks for select
  using (firm_id = current_setting('app.current_firm_id', true)::uuid);

create policy tasks_firm_insert on tasks for insert
  with check (firm_id = current_setting('app.current_firm_id', true)::uuid);

create policy tasks_firm_update on tasks for update
  using (firm_id = current_setting('app.current_firm_id', true)::uuid)
  with check (firm_id = current_setting('app.current_firm_id', true)::uuid);

create policy tasks_firm_delete on tasks for delete
  using (firm_id = current_setting('app.current_firm_id', true)::uuid);
```

**Workflow triggers that auto-insert tasks (Change 4 — implemented frontend-side or via Supabase functions; not part of THIS migration):**

| Trigger event | Task title | Assignee dept |
|---|---|---|
| Lead created (any channel) | "Make first contact — {full_name}" | intake |
| Appointment booked | "Confirm appointment — {full_name}" + reminder task day-of | intake |
| Questionnaire 100% complete | "Review questionnaire answers — {full_name}" | intake |
| Document request sent | "Follow up on missing documents — {full_name}" (recurring) | intake |
| All required docs received | "Ready for case review — {full_name}" | legal |
| Lifecycle → converted | "Open matter / assign attorney — {full_name}" | legal |
| Matter progression → submitted_to_paralegal | "Begin paralegal review — {full_name}" | legal |
| Matter progression → submitted_to_attorney | "Attorney case review — {full_name}" | legal |
| Matter progression → attorney_approved | "Schedule options consultation — {full_name}" | intake |

Recurring follow-up tasks are produced by the frontend on completion of the prior follow-up (or via a scheduled Supabase function; deferred). Idempotency by `(source, source_ref, lead_id)` so duplicate triggers don't fire duplicate tasks.

---

## 3. `matters` table — DECIDED: Option A (promote-in-place)

**DECISION (Dom, 2026-06-19): Option A — no `matters` table for v1.** v1 assumes one matter per client; `intake_leads.id` IS the matter identifier from conversion forward. Consequences applied to the rest of this doc:

- **Drop `tasks.matter_id`** from the §2 migration. Tasks reference either `lead_id` (pre-conversion) or `client_id` (post-conversion) only — the CHECK constraint becomes `(lead_id is not null)::int + (client_id is not null)::int = 1`.
- **`attorney_decisions` fields (§6) reference `intake_leads(id)` directly** via `lead_id` — no `matter_id` column.
- The post-conversion "matter" is identified by `(intake_leads.id, intake_leads.lifecycle_status IN ('converted','handoff_to_legal'), intake_leads.matter_progression IS NOT NULL)`. The frontend's matter-id resolver is the identity function in v1.

If a `matters` table is added later (v2 expansion: multiple matters per client, separate case-number tracking, etc.) it becomes a follow-up migration: introduce `matters.id`, backfill one matter per converted lead, flip the `tasks.lead_id`/`attorney_decisions.lead_id` references to `matters.id`, and the frontend's matter-id resolver picks up the new column without any consumer changes. Until that day, `lead_id` is the matter.

---

## 4. `questionnaire_sessions` table — NEW (Change 2)

Shared questionnaire engine state. One row per (lead, session) — the email interview and the AI live chat resume from this row, so a client who starts on self-serve and switches to email picks up the same session if the same `lead_id` is in play.

```sql
create table questionnaire_sessions (
  id            uuid primary key default gen_random_uuid(),
  firm_id       uuid not null references firms(id) on delete cascade,
  lead_id       uuid not null references intake_leads(id) on delete cascade,
  client_id     uuid references clients(id) on delete set null,

  -- Engine state. The ordered question set + per-question answer JSONB +
  -- the current cursor. Engine version is recorded so a question-set
  -- change doesn't break in-flight sessions (frontend can choose to
  -- continue the old set or migrate).
  engine_version text not null,                 -- e.g. 'v1' / 'v1.1'
  cursor_question_id text,                       -- the current question key
  answers       jsonb not null default '{}'::jsonb,
  -- answers shape: { [questionId]: { value, confirmedAt, confirmedBy, sectionId, ... } }

  -- Per-mode access tokens. Each mode (email, live-chat, self-serve)
  -- can have its own session-scoped token; the email-interview row keeps
  -- a separate per-question token elsewhere (see §5 below).
  mode          text not null default 'self_serve',  -- self_serve | email | live_chat | agent_assisted
                                                      -- CHECK constraint
  status        text not null default 'in_progress', -- in_progress | section_review | confirmed | abandoned
                                                      -- CHECK constraint
  completion_pct smallint not null default 0,        -- 0..100; mirrored to intake_leads.questionnaire_completion_pct

  last_activity_at timestamptz not null default now(),
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),

  constraint questionnaire_sessions_mode_chk check (
    mode in ('self_serve','email','live_chat','agent_assisted')
  ),
  constraint questionnaire_sessions_status_chk check (
    status in ('in_progress','section_review','confirmed','abandoned')
  )
);

create index idx_qs_firm_lead         on questionnaire_sessions (firm_id, lead_id);
create index idx_qs_firm_lastactivity on questionnaire_sessions (firm_id, last_activity_at desc);

create trigger trg_qs_updated_at
  before update on questionnaire_sessions
  for each row execute function update_updated_at_column();

alter table questionnaire_sessions enable row level security;
create policy qs_firm_all on questionnaire_sessions for all
  using (firm_id = current_setting('app.current_firm_id', true)::uuid)
  with check (firm_id = current_setting('app.current_firm_id', true)::uuid);
```

**Tokenized email-interview support:** each outbound email carries a per-question single-use link. The token lives on a separate row keyed to `(session_id, question_id)` (table §5 below). Submitting the answer advances the session cursor and invalidates the token.

---

## 5. `questionnaire_email_tokens` table — NEW (Change 2)

Per-question tokens for the outbound-only email interview. Tokens are secure, single-use, time-bounded.

```sql
create table questionnaire_email_tokens (
  id              uuid primary key default gen_random_uuid(),
  firm_id         uuid not null references firms(id) on delete cascade,
  session_id      uuid not null references questionnaire_sessions(id) on delete cascade,
  question_id     text not null,

  token           text not null unique,           -- random; URL-safe; 32+ chars
  expires_at      timestamptz not null,           -- typical: 14 days
  used_at         timestamptz,                    -- set when consumed; unique enforces single-use semantics

  -- Audit
  sent_to_email   text not null,
  sent_at         timestamptz not null default now(),
  created_by      uuid references auth.users(id) on delete set null
);

create index idx_qet_session  on questionnaire_email_tokens (session_id);
create index idx_qet_token    on questionnaire_email_tokens (token);
create index idx_qet_expires  on questionnaire_email_tokens (expires_at) where used_at is null;

-- RLS — firm-scoped reads (so staff can audit); token consumption goes
-- through a SECURITY DEFINER RPC so an anonymous email-interview link
-- can submit an answer without exposing the table.
alter table questionnaire_email_tokens enable row level security;
create policy qet_firm_read on questionnaire_email_tokens for select
  using (firm_id = current_setting('app.current_firm_id', true)::uuid);
```

**RPC needed (specced; Canelo writes):** `consume_questionnaire_email_token(p_token text, p_answer jsonb) returns jsonb` — validates the token (not expired, not used), records the answer onto `questionnaire_sessions.answers`, advances `cursor_question_id`, marks the token `used_at`, returns the next question payload. SECURITY DEFINER so the anonymous interview link calls it via the anon key.

---

## 6. Attorney decision — DECIDED: extend `acceptances` table (Option A)

**DECISION (Dom, 2026-06-19): Option A — extend the existing `acceptances` table** (per `LegalAdminPortal.tsx:113-137`) with the missing structured-decision fields. No new `attorney_decisions` table. Frontend reads/writes the extended `acceptances` row; the Change-8 attorney case-review surface populates the new columns.

### Columns to ADD to `acceptances`

| Column | Type | Nullable | Default | Notes |
|---|---|---|---|---|
| `limited_scope_on` | `boolean` | yes | `false` | Limited-scope toggle (independent of the bankruptcy decision). |
| `limited_scope_fee` | `numeric(10,2)` | yes | `null` | Flat fee quoted for limited scope. |
| `limited_scope_desc` | `text` | yes | `null` | Description of limited-scope services. |
| `acknowledged_issues` | `jsonb` | yes | `'[]'::jsonb` | Engine-flagged open issues at decision time. Shape: `[{ kind: 'liquidation_issue' \| 'plan_funding_issue', summary, engineValue }]`. Stored as JSONB so the engine's flag output shape can evolve without schema churn. |
| `override_required` | `boolean` | yes | `false` | True when the attorney accepted despite an unresolved engine flag. |
| `override_explanation` | `text` | yes | `null` | Required when `override_required = true` (CHECK below). |
| `override_decided_by` | `uuid` | yes | `null` | `references auth.users(id)`. Who authored the override (may differ from `decided_by`). |
| `override_decided_at` | `timestamptz` | yes | `null` | When the override was authored. |
| `client_advisory` | `text` | yes | `null` | Drafted advisory email body. **Never auto-sends.** Editable; explicit attorney confirmation required to send. |

`acceptances` already has `attorney_name`, `decision`, `chapter`, `attorney_fee`, `court_filing_fee`, `total_fee`, `down_payment`, `plan_months`, `filing_fee_handling`, `limited_scope_desc` (verify name; if missing, included above), `ch13_upfront_amount`, `ch13_plan_portion`, `decision_notes`, `decided_at` — those stay as-is.

### CHECK constraints to ADD — **all NULL-tolerant per the Conventions section**

```sql
alter table acceptances
  -- Existing rows have `chapter` as integer per the LegalAdminPortal Acceptance
  -- interface (chapter: number | null). Confirm the column type before applying
  -- the check; if it's int, use IN (7,13) instead of IN ('7','13').
  add constraint acceptances_chapter_chk check (
    chapter is null or chapter in (7, 13)
  ),

  -- Rolled-into-plan is meaningful only for Ch.13. NULL-tolerant: only
  -- fires when ch13_plan_portion > 0 AND chapter differs from 13.
  add constraint acceptances_rolled_only_ch13_chk check (
    ch13_plan_portion is null
    or ch13_plan_portion = 0
    or chapter = 13
  ),

  -- Override explanation is REQUIRED when override_required = true; not
  -- required (and may be NULL) otherwise. Historical rows have NULL
  -- override_required (column not yet set → falsy) and so pass.
  add constraint acceptances_override_explanation_chk check (
    override_required is null
    or override_required = false
    or (override_explanation is not null and length(trim(override_explanation)) > 0)
  ),

  -- Filing-fee handling enum, NULL-tolerant for historical rows.
  add constraint acceptances_filing_fee_handling_chk check (
    filing_fee_handling is null
    or filing_fee_handling in ('paid_upfront','installments','waiver_application')
  );
```

**Critical:** every one of these CHECK constraints follows the `IS NULL OR …` pattern so they ONLY apply to new accept decisions and DO NOT retroactively fail any existing `acceptances` row. Verify before deploy with `SELECT COUNT(*) FROM acceptances WHERE NOT (<check expression>)` for each — must return 0 against current production data.

### Indexes

The existing `acceptances` table is small (one row per case decision). One additional index pays for the Change-8 attorney-review dashboards:

```sql
create index if not exists idx_acceptances_firm_decided_at
  on acceptances (firm_id, decided_at desc)
  where decided_at is not null;
```

(If `acceptances.firm_id` doesn't exist yet, that's a separate gap to flag.)

### Hard-accept-gate behavior (frontend, no schema impact)

The Change-8 attorney case-review surface refuses to write a row with `decision = 'accept'` until either:
- the engine surfaces zero unresolved issues (Ch.7 non-exempt equity / Ch.13 plan-funding shortfall), in which case `acknowledged_issues` is `[]` and `override_required` is `false`, OR
- the attorney explicitly acknowledges each flagged issue AND, when accepting anyway, supplies an `override_explanation` AND that explanation is captured with `override_decided_by` + `override_decided_at`.

The same gate fires at the signing-review step. Override audit trail is preserved on the row; the existing `decision_notes` column remains free-text for general decision-context.

---

## 7. CCC (Credit Counseling Course) completion tracking — Change 6

Today the credit counseling certificate is tracked as a document (`cc_cert` doc id in `buildRequiredDocs`, `bankruptcy-information-and-document-questionnaire(1).jsx:175`). The frontend can read uploaded-status from `client_documents`. For the **completion date** (drives the § 109(h) 180-day window flag), add a column.

**Add to `client_documents`** (one column):

| Column | Type | Nullable | Default | Notes |
|---|---|---|---|---|
| `cc_course_completed_at` | `timestamptz` | yes | `null` | Set only on rows where `document_type = 'cc_cert'`. Frontend reads this to compute `daysUntil109hExpiry = 180 - (today - cc_course_completed_at)`. |

No CHECK needed (only set on `cc_cert` rows by convention; the frontend enforces). Indexed implicitly by the existing `client_documents` indexes.

The § 109(h) flag is computed on the frontend; no DB function needed.

---

## 8. Net new RPCs (specced)

| RPC | Signature | Used by |
|---|---|---|
| `consume_questionnaire_email_token` | `(p_token text, p_answer jsonb) returns jsonb` | Email-interview anonymous link (§5) |
| `complete_lead_handoff_to_legal` | `(p_lead_id uuid) returns jsonb` | The Convert action (Change 1) — transactionally sets `lifecycle_status='handoff_to_legal'`, creates the legal-side opener tasks via §2, emits an audit row. |
| `record_attorney_decision_override` | `(p_decision_id uuid, p_explanation text) returns jsonb` | The accept-gate override (Change 8). Stamps `override_*` columns on the existing `acceptances` row and writes an audit entry. |

All three are SECURITY DEFINER, scoped by `app.current_firm_id`, idempotent where reasonable.

The existing `get_open_slots` + `book_consultation` RPCs are **reused as-is** (no changes needed for Change 3). Migration drift on those (2026-06-07) is a separate Canelo item.

---

## Phase rollout

This doc is updated as each change lands. Phase 1 (now) needs:
- §1 columns on `intake_leads` (channel, lifecycle_status, questionnaire_completion_pct, matter_progression).
- Decision on §3 (recommendation: Option A — promote-in-place, no `matters` table for v1).

Phase 2+ adds the rest (tasks, questionnaire sessions, email tokens, attorney decisions extensions, CCC column, RPCs) as the corresponding frontend changes land. Each phase's schema additions will be flagged here with its target frontend change number.
