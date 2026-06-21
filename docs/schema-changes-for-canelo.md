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

## 1.5. `firm_branding` — additive columns (Change 1)

The public "Get Help" entry (Change 1) needs the firm's phone number for the **Call now** option's `tel:` link and the displayed contact string. Today `firm_branding` carries `display_name`, `short_name`, `logo_url`, `primary_color`, `accent_color`, `client_portal_welcome_message`, `client_portal_footer_message` — no phone. Add two columns:

| Column | Type | Nullable | Default | Notes |
|---|---|---|---|---|
| `firm_phone` | `text` | yes | `null` | Display-formatted phone number, e.g. `(480) 555-0100`. Surfaced as the human-readable string on the Get-Help page and in transactional emails. |
| `firm_phone_e164` | `text` | yes | `null` | E.164-formatted phone, e.g. `+14805550100`. Used as the `tel:` link target so `tel:` works correctly on mobile dialers. **CHECK** that it matches `^\+\d{10,15}$` so it's always dialable. |

```sql
alter table firm_branding
  add column firm_phone text,
  add column firm_phone_e164 text,
  add constraint firm_branding_phone_e164_chk check (
    firm_phone_e164 is null or firm_phone_e164 ~ '^\+\d{10,15}$'
  );
```

No new index — `firm_branding` is one row per firm, looked up by `firm_id` which already has a unique key. RLS unchanged.

**Frontend fallback until migration lands:** `src/components/get-help/GetHelpEntry.tsx` falls back to the `VITE_FIRM_PHONE` env var when the column is null/missing.

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
| `create_public_lead` | `(p_firm_slug text, p_channel text, p_full_name text, p_email text, p_phone text, p_notes text, p_captcha_token text) returns jsonb` | The anonymous "Get Help" entry from a public visitor (Change 1). See §9 for the full security spec — this is the locked-down replacement for the open anon-INSERT on `intake_leads` that today's frontend uses. |

All four are SECURITY DEFINER, scoped to a firm via either `app.current_firm_id` (authenticated) or a resolved `firm_slug` (anonymous, see §9), idempotent where reasonable.

The existing `get_open_slots` + `book_consultation` RPCs are **reused as-is** (no changes needed for Change 3). Migration drift on those (2026-06-07) is a separate Canelo item.

---

## 9. `create_public_lead` RPC + anonymous `intake_leads` lockdown (Change 1)

The public "Get Help" entry (Change 1) needs to drop a row into `intake_leads` from an anonymous visitor — no Supabase session, no JWT. Today the frontend uses the anon-INSERT policy on `intake_leads` that's already in place for `NewLeadInline` / `ClientRegistration`. **That open anon-INSERT must be locked down before the public Get Help page is exposed to a real domain.**

### Lockdown

Replace the open anon-INSERT policy with a **deny-all-anon** policy on `intake_leads` and route the public path through `create_public_lead` instead:

```sql
-- Drop any existing anon-INSERT policy on intake_leads.
-- Confirm policy name in production before drop:
--   SELECT polname FROM pg_policy WHERE polrelid = 'intake_leads'::regclass;
-- Replace `<existing_anon_insert_policy>` with the actual name.
drop policy if exists <existing_anon_insert_policy> on intake_leads;

-- Anon role gets NO direct table access — INSERT/SELECT/UPDATE all denied.
-- The only path for anonymous lead creation is the RPC below.
revoke insert, select, update, delete on intake_leads from anon;
```

Existing authenticated paths (`NewLeadInline`, attorney/intake staff inserts) keep their existing policies — only the anon path closes.

### The RPC

```sql
create or replace function create_public_lead(
  p_firm_slug      text,
  p_channel        text,
  p_full_name      text default null,
  p_email          text default null,
  p_phone          text default null,
  p_notes          text default null,
  p_captcha_token  text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_firm_id uuid;
  v_lead_id uuid;
  v_ip      text := current_setting('request.headers', true)::jsonb ->> 'x-forwarded-for';
  v_attempt_count int;
begin
  -- (1) Captcha verification — Canelo wires the actual provider (Turnstile /
  -- hCaptcha) here. Fail closed: a null / invalid token returns generic error
  -- so the response is indistinguishable from a rate-limit miss.
  if p_captcha_token is null or not verify_captcha(p_captcha_token) then
    raise exception 'lead_create_failed' using errcode = 'P0001';
  end if;

  -- (2) Rate-limit by source IP — 5 attempts per 10 minutes per IP.
  -- Reuses an `auth_attempts`-style counter table OR a pg_throttle hook.
  -- Spec the implementation as Canelo prefers; the contract is: a 6th
  -- attempt within the window raises the same generic exception.
  select count(*) into v_attempt_count
    from public_lead_attempts
    where source_ip = v_ip
      and attempted_at > now() - interval '10 minutes';
  if v_attempt_count >= 5 then
    raise exception 'lead_create_failed' using errcode = 'P0001';
  end if;

  insert into public_lead_attempts (source_ip, firm_slug, channel, attempted_at, outcome)
    values (v_ip, p_firm_slug, p_channel, now(), 'attempt');

  -- (3) Resolve firm_id from the slug server-side. The slug is the only
  -- firm identifier the caller can pass; never accept firm_id directly.
  -- An unknown slug returns the same generic error.
  select id into v_firm_id from firms where public_slug = p_firm_slug;
  if v_firm_id is null then
    raise exception 'lead_create_failed' using errcode = 'P0001';
  end if;

  -- (4) Channel validation — must be one of the §1 channel values.
  if p_channel not in ('call_now','live_chat','sms','scheduled','self_serve','agent_assisted') then
    raise exception 'lead_create_failed' using errcode = 'P0001';
  end if;

  -- (5) Insert the lead. firm_id is the SERVER-resolved value, never
  -- the caller's input. New §1 columns set inline.
  insert into intake_leads (
    firm_id, full_name, email, phone, source, status, follow_up_queue,
    notes, first_contact_at,
    channel, lifecycle_status, questionnaire_completion_pct
  ) values (
    v_firm_id, p_full_name, p_email, p_phone, p_channel,
    case when p_channel = 'call_now' then 'contacted' else 'new' end,
    case when p_channel = 'call_now' then 'priority'  else 'normal' end,
    p_notes, now(),
    p_channel,
    case when p_channel = 'call_now' then 'contacted' else 'new' end,
    0
  )
  returning id into v_lead_id;

  -- (6) Mark the attempt success so the counter stays honest.
  update public_lead_attempts
    set outcome = 'success', lead_id = v_lead_id
    where source_ip = v_ip and attempted_at >= now() - interval '1 minute'
    and lead_id is null;

  return jsonb_build_object('ok', true, 'lead_id', v_lead_id);
end;
$$;

revoke all on function create_public_lead(text,text,text,text,text,text,text) from public;
grant execute on function create_public_lead(text,text,text,text,text,text,text) to anon;
```

**Tight-review checklist for Canelo** (same posture as §5):

- ✅ **SECURITY DEFINER, INSERT-only effect.** The function only inserts into `intake_leads` + `public_lead_attempts`. No reads, no updates, no other writes.
- ✅ **`firm_id` resolved server-side from `p_firm_slug`.** Caller cannot supply `firm_id`. Unknown slug → generic error (no enumeration of valid slugs).
- ✅ **Channel value validated against the §1 whitelist.** Any other value → generic error.
- ✅ **Rate-limited per source IP** via `public_lead_attempts` (5 attempts per 10-minute window). Failed attempts (captcha, rate, slug, channel) all increment the counter and log to the same table.
- ✅ **Captcha required.** Turnstile / hCaptcha token verified server-side via `verify_captcha()` (Canelo writes the wrapper — typically a `pg_net` call out to the provider's verify endpoint).
- ✅ **Generic error message.** Every failure path raises the same `'lead_create_failed'` exception so the caller can't distinguish captcha failure from rate-limit failure from unknown slug.
- ✅ **No SELECT/UPDATE on intake_leads granted to anon.** The anon role can ONLY call this function; cannot read leads back, cannot update them.

### `public_lead_attempts` table (NEW, supports the RPC)

```sql
create table public_lead_attempts (
  id           bigserial primary key,
  source_ip    text,
  firm_slug    text,
  channel      text,
  outcome      text not null,         -- 'attempt' | 'success' | 'captcha_fail' | 'ratelimit' | 'invalid_slug' | 'invalid_channel'
  lead_id      uuid,                  -- set on success
  attempted_at timestamptz not null default now()
);
create index idx_pla_ip_attempted on public_lead_attempts (source_ip, attempted_at desc);
create index idx_pla_attempted    on public_lead_attempts (attempted_at desc);
-- No RLS — anon never sees this table directly; only the RPC writes.
revoke all on public_lead_attempts from anon;
```

### `firms.public_slug` (NEW column)

The RPC resolves `firm_id` via `firms.public_slug`. Today `firms` has no `public_slug` column. Add one:

```sql
alter table firms
  add column public_slug text,
  add constraint firms_public_slug_format check (public_slug is null or public_slug ~ '^[a-z0-9-]{2,40}$'),
  add constraint firms_public_slug_unique unique (public_slug);
```

The slug is the firm's URL identifier — e.g., `majorslawgroup` resolves to MLG. For the MLG pilot, set `update firms set public_slug = 'majorslawgroup' where id = '<MLG firm id>'`. Future pilots set their own slug.

### Frontend posture once §9 lands

`src/lib/createLead.ts` flips from `supabase.from("intake_leads").insert(...)` to `supabase.rpc("create_public_lead", { p_firm_slug, p_channel, ... })`. The frontend resolves `firm_slug` from one of:

1. The URL subdomain (`majorslawgroup.bankruptcy.ai`),
2. A path segment (`/firm/majorslawgroup/get-help`),
3. For the MLG-only pilot today: the `VITE_FIRM_SLUG` env var.

**Heads-up on the current `VITE_FIRM_ID` pattern (Phase 2 of v1):** the current `createLead.ts` reads `firm_id` from the `VITE_FIRM_ID` build-env var. That's fine for the MLG-only deployment but **does not serve multiple firms from a single build**. Multi-firm pilot requires the slug-from-URL resolution above. Flagged for the pilot phase: when a second firm onboards, swap the build-env scoping for slug-from-URL before deploying.

---

## 10. Deferred Change-1 items — scheduled, not lost

Phase 2 shipped the public Get-Help entry + lead-creation helper + lifecycle enum + scheduling adapter, but Change 1 has three more pieces explicitly deferred to a later phase. **Tracked here so they're not lost.**

| Item | What it is | Target phase |
|---|---|---|
| **Lifecycle-status filter on Intake dashboard** | The existing `IntakeDashboard.tsx` lead board needs a filter chip set keyed to the new `lifecycle_status` enum (with backward-compat read from legacy `status` via `resolveLifecycle` from `leadLifecycle.ts`). Assignment column reuses the existing assignment engine. | Phase 5 (Intake dashboard refinement) — after Change 2 ships so the questionnaire-completion % flows in. |
| **Per-lead detail view** | The lead-detail surface needs to surface channel, consultation, questionnaire-progress %, and the generated document checklist. Today's detail UI is partial; this is its v1 completion. | Phase 5. |
| **Convert action → handoff to Legal** | A "Convert" button on the lead detail that promotes `lifecycle_status` → `'converted'` then `'handoff_to_legal'` via `complete_lead_handoff_to_legal` (this section §8). Routes through the existing assignment engine; creates the matching legal-side opener tasks via §2. **Core Change 1 functionality — do not lose.** | Phase 5, paired with Phase 4's tasks consumer landing so the handoff actually creates the legal-side tasks. |

When Phase 5 lands, this section is removed from the doc — every item gets a checkmark and the schema spec for the supporting work goes inline above.

---

## 12. Matter-spine alignment — Option A end-to-end

**Why this exists.** §3 settled the Option-A decision: no `matters` table — `intake_leads.id` IS the matter id. But the existing schema has three id streams that never got reconciled:

- **Stream A:** `intake_leads.id` (the matter spine)
- **Stream B:** `intake_submissions.id`, joined to A via `intake_submissions.lead_id`
- **Stream C:** `clients.id`, joined to B via `clients.intake_id` → `intake_submissions.id`

Downstream case-bearing tables (`signing_reviews`, `paralegal_reviews`, `client_documents`, `ecf_tasks`, `ecf_inbox`, `calendar_events`, `accounting_filed_case_registry`) all key off `client_id text` or a Stream-C FK. **No enforced path from any of them back to Stream A** — a 3-hop join is required (and not all hops have non-null data).

The frontend audit (see `docs/design/legal-portal-function-mapping.md` and the matter-spine recon turn) found:
- `signing_reviews.client_id` is documented in `src/components/legal/legalTasks.ts:37–40` as "NOT necessarily an `intake_leads.id`" — different code paths populate different id types.
- `intake_submissions.client_id` is read by `SigningReview` (`src/components/SigningReview.tsx:336`) but **NOT populated by the canonical `BankruptcyIntake.jsx` insert path** — only `lead_id` is set. The seeded Mickey Rourke and Dixon Cider test fixtures (`scripts/seed_*.mjs`) also leave `client_id` null, which means SigningReview reads return ZERO rows for any seeded case as a lawyer.
- `calendar_events` has NO id link to a case at all — only `client_name text` + `case_number text` (string-matching gymnastics required to filter by case).
- `client_documents.client_id` is set to `clients.id` (Stream C), but `FileCabinet.tsx:1488–1489` is inconsistent within itself — it queries `client_documents?client_id=eq.${clientId}` AND `intake_submissions?lead_id=eq.${clientId}` against the SAME variable, which only works when `clients.id === intake_leads.id` (which it doesn't).

§12 is the schema delta to close the gap.

### Goal

Every case-bearing row in the schema reaches `intake_leads.id` (the matter spine) by either (a) holding it directly, or (b) at most ONE documented join. The current 3-hop traversal is collapsed.

### Conventions for this section

- **Additive + nullable**: every change adds a new column or RPC. No existing column is renamed or dropped. No existing data invalidated.
- **NULL-tolerant**: new `lead_id` columns are nullable. Rows that pre-date this section's landing stay valid; backfills are best-effort and can run after the column is added.
- **No CHECK constraints** that would retroactively fail historical rows. Indexes are added for query cost but not enforced as FKs in this phase (FK enforcement is a Phase B item once backfill completes and orphan rows are addressed).
- **Convention until §S7 RPC lands**: callers can two-step from any id to the leadId client-side (the `src/legal-portal/caseIdentity.ts` module mirrors what the RPC will do, so frontend code reads the same way before and after the RPC ships).

### S1 — `signing_reviews.lead_id` (uuid, nullable)

Add `lead_id uuid` column. Index `(lead_id)`. NULL-tolerant — no CHECK.

**Why**: `client_id text` is opaque (per `legalTasks.ts:37–40`). Adding `lead_id` lets the queue and case workspace key by the matter spine directly.

**Backfill (best-effort, separate one-shot)**:
```
UPDATE signing_reviews sr SET lead_id = s.lead_id
  FROM intake_submissions s, clients c
  WHERE c.id::text = sr.client_id
    AND c.intake_id = s.id
    AND sr.lead_id IS NULL;

-- And: where client_id happens to already be a leadId
UPDATE signing_reviews sr SET lead_id = sr.client_id::uuid
  WHERE sr.lead_id IS NULL
    AND EXISTS (SELECT 1 FROM intake_leads l WHERE l.id::text = sr.client_id);
```

Rows with no resolvable path stay NULL — frontend treats null `lead_id` as "legacy row, fall back to `client_id` lookup".

### S2 — `paralegal_reviews.lead_id` (uuid, nullable)

Same shape and rationale as S1. Add column, index, NULL-tolerant. Same backfill pattern.

### S3 — `client_documents.lead_id` (uuid, nullable)

Add `lead_id uuid` column. Index `(lead_id)`. NULL-tolerant.

**Why**: documents currently key off `clients.id`; reaching them from `intake_leads.id` is a 3-hop. With `lead_id` on `client_documents`, the case workspace's "open this case's documents" becomes a single-column read.

**Backfill (best-effort)**:
```
UPDATE client_documents cd SET lead_id = s.lead_id
  FROM clients c, intake_submissions s
  WHERE cd.client_id = c.id
    AND c.intake_id = s.id
    AND cd.lead_id IS NULL;
```

### S4 — `ecf_tasks.lead_id` (uuid, nullable)

Add `lead_id uuid` column. Index `(lead_id)`. NULL-tolerant. Same backfill path as S3 (through `clients.intake_id`).

**Why**: ECF tasks are case-bearing but key off ambiguous `client_id`. Today's queue can't reliably show a client name for an ECF task row (falls back to truncated id).

### S5 — `ecf_inbox.lead_id` (uuid, nullable)

Add `lead_id uuid` column. Index `(lead_id)`. NULL-tolerant. Same backfill.

**Why**: inbound PACER notices need to join to the matter spine so the queue's comms-widget can label them with the case name and the "today's hearings" footer can match by `lead_id` instead of by `client_name` string equality.

### S6 — `calendar_events.lead_id` (uuid, nullable)

Add `lead_id uuid` column. Index `(lead_id)`. NULL-tolerant. **Keep existing `client_name` and `case_number` text columns** — calendar events also serve non-matter purposes (court deadlines that pre-exist a lead, firm-internal events without a case context), so `lead_id` is additive, not a replacement.

**Why**: today's-hearings footer (Slice L-7) currently matches by `client_name` string equality. Fragile across renames, joint cases, suffix variations.

**Backfill (best-effort, manual review recommended)**:
```
UPDATE calendar_events ce SET lead_id = l.id
  FROM intake_leads l
  WHERE ce.client_name = l.full_name
    AND ce.lead_id IS NULL
    AND (SELECT count(*) FROM intake_leads l2 WHERE l2.full_name = ce.client_name) = 1;
```
Only updates where the name match is unique. Ambiguous matches (multiple leads with the same name) stay NULL and require a human pass.

### S7 — `resolve_lead_id(p_any_id uuid) → uuid` RPC

Document `intake_submissions.lead_id` as the canonical case id for that table. Flag `intake_submissions.client_id` for deprecation (do not drop yet — legacy SigningReview path reads it; deprecation lands when F3 frontend cutover completes).

**New RPC**:
```
resolve_lead_id(p_any_id uuid) → uuid
  -- Tries each path in order, returns first match:
  --   1. intake_leads WHERE id = p_any_id
  --   2. intake_submissions WHERE id = p_any_id → lead_id
  --   3. clients WHERE id = p_any_id → intake_id → intake_submissions.lead_id
  --   4. NULL (no path found)
  -- SECURITY DEFINER, firm-scoped via RLS context. Read-only.
```

**Why**: single normalizer for legacy data still keyed on ambiguous text columns. Frontend `caseIdentity.ts` module mirrors the same logic client-side until the RPC ships; both produce the same answer.

### S8 — `accounting_filed_case_registry.lead_id` (uuid, nullable)

Add `lead_id uuid` column. Index `(lead_id)`. NULL-tolerant. Keep existing FK to `accounting_clients` intact — this is additive, not a replacement of accounting's data model.

**Why**: cross-portal read in `LegalDashboard` (Slice L-8) currently has no path to the matter spine for the "Filed" caseload count. Without `lead_id`, the bubble can only count filed cases globally — it cannot dedupe against the same lead being counted in two surfaces or attribute filed cases back to a specific matter.

**Backfill (best-effort, one-shot)**:
```
UPDATE accounting_filed_case_registry r SET lead_id = s.lead_id
  FROM accounting_clients ac, clients c, intake_submissions s
  WHERE r.client_id = ac.client_id
    AND ac.client_id = c.id
    AND c.intake_id = s.id
    AND r.lead_id IS NULL;
```

### S9 — `v_matter_spine` view (NEW)

Materializes one row per `intake_leads.id` joined to the latest `intake_submissions.id`, the linked `clients.id` (if any), and current `lifecycle_status` / `matter_progression` from §1.

**Shape (recommended)**:
```
CREATE VIEW v_matter_spine AS
SELECT
  l.id                              AS lead_id,
  l.firm_id                         AS firm_id,
  l.full_name                       AS client_name,
  l.lifecycle_status                AS lifecycle_status,
  l.matter_progression              AS matter_progression,
  (SELECT s.id FROM intake_submissions s
     WHERE s.lead_id = l.id ORDER BY s.submitted_at DESC LIMIT 1) AS submission_id,
  (SELECT c.id FROM clients c
     INNER JOIN intake_submissions s ON c.intake_id = s.id
     WHERE s.lead_id = l.id LIMIT 1) AS client_id,
  l.created_at,
  l.retained_at
FROM intake_leads l;
```

**Why**: single read for every UI that needs to ask "what does this matter look like across all entity streams" — replaces the 3-hop ad-hoc joins scattered across LegalDashboard / FileCabinet / SigningReview. RLS-scoped via `intake_leads.firm_id` already.

### Phase ordering (for Canelo's PR)

S1–S6 can land in any order — they're all additive columns + indexes, no inter-dependency. S7 (RPC) and S9 (view) can land at the same time or after. S8 is the only cross-portal touch (accounting_filed_case_registry) so it may want its own PR for review hygiene.

Frontend already tolerates the absence of all of these via the `caseIdentity.ts` normalize-on-read module (Phase 1 of the matter-spine vertical slice, this turn). When S1–S9 land, the frontend's two-step normalization collapses to a single-column read with no behavior change.

### Out of §12 scope

- No reach into accounting's data model beyond S8's additive column.
- No deletion of `client_id` columns. Stays until every consumer is cut over and the deprecation flag (S7 docs) escalates to a removal.
- No FK enforcement of new `lead_id` columns. Phase B item once backfill is complete and orphan rows are addressed.
- No new `matters` table. Option A holds.

---

## 13. `v_legal_client_payments` — Legal-side read-only payment view (companion to functional readme §15)

**Why this exists.** Functional readme §15 ("Payment View & BK Forms") requires the Legal client file to display, next to the client name: *amount paid · third-party name (if applicable) · paid-in-full date · filing fee Y/N · process stage*. The same view feeds Disclosure of Compensation (Form 2030) and SOFA (incl. payment dates). Per readme §2, Legal does NOT access the Accounting portal — Legal gets these fields via this **read-only derived view** (the "payment-data exception" to the accounting wall).

The frontend ships in D1 against a typed interface (`src/lib/legalClientPayments.ts` + `<PaymentDataStrip>`); today it renders honest empty / "Not yet connected" states. When this view lands, swap the implementation in that one module — UI doesn't change.

### Goal

One read-only view, lead-scoped (matter spine per §3 / §12), aggregating accounting data the Legal department needs. Legal can SELECT for leads in their firm. Accounting retains exclusive write authority on the underlying tables. The view never exposes fields outside the §15 inventory (no installment schedules, no IOLTA balances, no autopay-card detail).

### Conventions

- Additive: no changes to existing accounting tables (one exception flagged in S15.3 below — adding `is_third_party` + `payer_name` to `accounting_payments` is required to surface per-payment third-party attribution; today only `autopay_enrollments` carries third-party info and that's recurring-only).
- RLS: SELECT-only for Legal-tier roles (`legal_admin` / `attorney` / `attorney_super_admin` / `firm_super_admin` / `law_firm_owner` / `super_admin_bankruptcy_ai`). NO mutation rights through the view.
- Firm-scoped: every row carries `firm_id`; RLS predicate joins to viewer's firm.

### S13.1 — View columns

```sql
CREATE VIEW v_legal_client_payments AS
SELECT
  l.id                                                       AS lead_id,
  l.firm_id                                                  AS firm_id,
  l.full_name                                                AS client_name,

  -- amount paid: SUM of recorded, non-voided payments applied to the
  -- attorney fee (excludes refunds, disbursements, cancellations).
  COALESCE(SUM(p.amount) FILTER (
    WHERE p.voided = false
      AND p.payment_type IN ('attorney_fee', 'retainer')
  ), 0)::numeric                                             AS amount_paid_attorney_fee,

  -- date paid in full: latest payment_date when cumulative payments
  -- ≥ fee_structure.attorney_fee. NULL until that threshold is reached.
  -- See helper note S13.2 — express as a window subquery so the view
  -- stays a single SELECT.
  (SELECT MAX(p2.payment_date) FROM accounting_payments p2
    WHERE p2.client_id = ac.client_id
      AND p2.voided = false
      AND p2.payment_type IN ('attorney_fee', 'retainer')
      AND (SELECT SUM(p3.amount) FROM accounting_payments p3
           WHERE p3.client_id = ac.client_id
             AND p3.voided = false
             AND p3.payment_type IN ('attorney_fee', 'retainer')
             AND p3.payment_date <= p2.payment_date)
          >= fs.attorney_fee
  )                                                          AS paid_in_full_at,

  -- filing fee paid? Y/N — direct read from the fee structure flag set
  -- by accounting when CFF is recorded. Boolean; never derive from sums
  -- (sums can race with CFF allocation logic).
  COALESCE(fs.cff_paid, false)                               AS filing_fee_paid,
  fs.cff_paid_at                                             AS filing_fee_paid_at,

  -- third-party payer: presence + name when a payment was made by
  -- someone other than the debtor. See S13.3 — requires per-payment
  -- `is_third_party` + `payer_name` columns on accounting_payments;
  -- until those land, the view returns the autopay-enrollment fallback
  -- for recurring-payer cases, NULL otherwise.
  (
    SELECT p4.payer_name FROM accounting_payments p4
    WHERE p4.client_id = ac.client_id
      AND p4.voided = false
      AND p4.is_third_party = true
    ORDER BY p4.payment_date DESC
    LIMIT 1
  )                                                          AS third_party_payer_name,
  EXISTS (
    SELECT 1 FROM accounting_payments p5
    WHERE p5.client_id = ac.client_id
      AND p5.voided = false
      AND p5.is_third_party = true
  )                                                          AS has_third_party_payer,

  -- Process stage — sourced from intake_leads' lifecycle/matter columns
  -- (§1 additive columns). The Legal client file's "process stage" tile
  -- consumes this without re-deriving.
  l.lifecycle_status                                         AS lifecycle_status,
  l.matter_progression                                       AS matter_progression,

  -- Fee structure for the legal client file's Disclosure of Comp /
  -- SOFA Q.16 surface (read-only context). Not for accounting reuse.
  fs.attorney_fee                                            AS attorney_fee_agreed,
  fs.court_filing_fee                                        AS court_filing_fee_agreed,
  fs.total_fee                                               AS total_fee_agreed

FROM intake_leads l
LEFT JOIN intake_submissions s
  ON s.lead_id = l.id
LEFT JOIN clients c
  ON c.intake_id = s.id
LEFT JOIN accounting_clients ac
  ON ac.client_id = c.id
LEFT JOIN accounting_fee_structures fs
  ON fs.client_id = ac.client_id
LEFT JOIN accounting_payments p
  ON p.client_id = ac.client_id
    AND p.voided = false
    AND p.payment_type IN ('attorney_fee', 'retainer')
GROUP BY
  l.id, l.firm_id, l.full_name, l.lifecycle_status,
  l.matter_progression, ac.client_id,
  fs.cff_paid, fs.cff_paid_at,
  fs.attorney_fee, fs.court_filing_fee, fs.total_fee;
```

(Pseudocode — Canelo writes the production SQL. The fields and intent are the spec; the
exact aggregate form may need tuning when run against real data volumes.)

### S13.2 — Performance helper

The `paid_in_full_at` subquery is the heaviest read. Recommend a helper function
`fn_payment_paid_in_full_at(p_client_id uuid, p_threshold numeric) → timestamptz` that
the view calls, OR an indexed materialized aggregate. Canelo's call. The frontend
contract is the column shape; the implementation is internal.

### S13.3 — `accounting_payments` columns to add (additive, nullable)

Per readme §15: "if a third party paid, name them." Today's `accounting_payments` carries
no per-payment third-party signal. `autopay_enrollments.is_third_party` covers recurring
charges only — one-off payments by friends/family aren't captured.

Add to `accounting_payments`:
- `is_third_party boolean NOT NULL DEFAULT false`
- `payer_name text NULL` (free-form; only populated when `is_third_party = true`)

Both columns are additive + NULL/default-safe. Backfill: best-effort from `autopay_enrollments` for currently active third-party enrollments; manual review for historical one-off payments.

### S13.4 — RLS posture

The view's RLS predicate is firm-scoped (rows where `l.firm_id = current_firm_id()`).

Grant SELECT to: `legal_admin`, `attorney`, `attorney_super_admin`, `firm_super_admin`,
`law_firm_owner`, `super_admin_bankruptcy_ai`.

Explicitly NOT granted: `intake`, `accounting` (accounting has direct access to source tables;
no need to read the view), `client`, `paralegal` (paralegals read the same view per
post-petition workflow needs but their gate is per-row matter assignment — Phase B).

UPDATE / INSERT / DELETE: never granted. The view is read-only by design.

### S13.5 — Form 2030 / SOFA wiring (UI work — separate slice)

The Disclosure of Compensation (Form 2030) and SOFA Question 16 surfaces consume the same
view to auto-populate fee/payment fields. That UI wiring is deferred from D1 (the spec lives
here; the consumer ships in D1.5 / D2). UI today reads `accounting_fee_structures` directly
inside FileCabinet — that read path stays until D1.5 cuts it over to the view.

### S13.6 — Out of scope for this section

- IOLTA balances, trust-account state, autopay enrollment detail.
- Payment-method tokens, processor confirmations.
- Anything tied to fee disputes / refunds / reversals beyond the `voided=false` filter.
- Schedules — the view returns aggregates, not installment timelines.

### Phase ordering hint

Land S13.1 (the view) + S13.4 (RLS) first; S13.2 (perf helper) when load profiles call for
it; S13.3 (`accounting_payments` columns) before D1.5 ships so the third-party fields are
non-empty. Frontend tolerates absence via the typed interface's `unwired` / `empty` states.

---

## 14. Seed three regular-role TEST users — single-department wall verification

**Purpose.** Stand up three TEST accounts in the dev firm so the new single-department wall
(functional-readme §2, `src/lib/portalAccess.ts`) can be exercised end-to-end without
real-staff data. Each user verifies one regular-role wall: paralegal → Legal Department
only, `legal_admin` → Intake only, `accounting` → Accounting only. No admin/supervisor
bypass, no cross-portal switching, reporting scope resolves to `'self'`.

These are **TEST accounts** — not real personnel. Domain `@majorslawgroup.test` is the
RFC 2606 reserved `.test` TLD; SMTP cannot deliver to it, which is the point. Do **not**
seed in production.

### S14.1 — `auth.users` entries (via Supabase Studio or service-role API)

Create the three Supabase auth users (Studio → Authentication → Users → Add user):

| Email                                       | Password   | Email confirm |
| ------------------------------------------- | ---------- | ------------- |
| `cardi.burdette@majorslawgroup.test`        | (set + share via 1Password) | yes |
| `carmelo.anthony@majorslawgroup.test`       | (set + share via 1Password) | yes |
| `justin.timberlake@majorslawgroup.test`     | (set + share via 1Password) | yes |

### S14.2 — `user_profiles` rows

Insert one row per user. `<firm_id>` = the dev firm id (`VITE_FIRM_ID` default
`00000000-0000-0000-0000-000000000001`). `<auth_user_id_*>` = the UUID from §S14.1.

```sql
INSERT INTO public.user_profiles (user_id, firm_id, role, full_name)
VALUES
  ('<auth_user_id_cardi>',   '<firm_id>', 'paralegal',   'Cardi Burdette [TEST]'),
  ('<auth_user_id_carmelo>', '<firm_id>', 'legal_admin', 'Carmelo Anthony [TEST]'),
  ('<auth_user_id_justin>',  '<firm_id>', 'accounting',  'Justin Timberlake [TEST]');
```

The `role` column is the `platform_role` Postgres enum from
`20260527020000_firms_and_user_profiles.sql`. **`'paralegal'` is a new enum value** — see
§S14.3.

### S14.3 — Add `'paralegal'` to `platform_role` enum

```sql
ALTER TYPE public.platform_role ADD VALUE IF NOT EXISTS 'paralegal';
```

Run before §S14.2 (Postgres won't accept the insert otherwise). Matches the frontend
PlatformRole union in `src/lib/auth.ts` after this slice.

### S14.4 — Optional: `staff_members` rows for PIN-gate sign-in

The Legal Department portal (`LegalDepartmentPortal`) and Intake portal
(`LegalAdminPortal`) layer a per-portal PIN gate on top of the Supabase auth session. If
you want Cardi / Carmelo to sign into the inner portal too (not just hit App.tsx), seed
matching `staff_members` rows with `intake_portal_role` = `'paralegal'` (Cardi) or
`'legal_admin'` (Carmelo). Justin doesn't need one — Accounting has no PIN gate.

```sql
-- Adjust columns to your staff_members schema (DM + email + intake_portal_role).
INSERT INTO public.staff_members (firm_id, full_name, email, intake_portal_role)
VALUES
  ('<firm_id>', 'Cardi Burdette [TEST]',   'cardi.burdette@majorslawgroup.test',   'paralegal'),
  ('<firm_id>', 'Carmelo Anthony [TEST]',  'carmelo.anthony@majorslawgroup.test',  'legal_admin');
```

### S14.5 — Verification checklist (after seeds land)

Sign in as each user and confirm:

1. **Landing portal** matches the role:
   - Cardi → `view='legal_dept_portal'` (Legal Department)
   - Carmelo → `view='legal_admin'` (Intake)
   - Justin → `view='accounting'`
2. **PortalToggle (bottom bar)** shows ONLY the entries for that user's department.
   No firm Settings, no platform admin, no Productivity, no cross-portal entries.
3. **Manual URL nav** to a blocked view (e.g., Cardi → `?view=accounting`) redirects
   back to home portal + surfaces the "restricted to a different department" toast.
4. **Reporting access** (when D7 lands): `reportingScopeFor(role)` returns `'self'` for
   all three; no department/firm reporting surface visible.

### S14.6 — Out of scope

- Real account-creation UI (FirmDirectory's "Add employee" modal is in-memory only).
  Building the Supabase auth user + user_profiles row from the UI is a separate slice.
- Department supervisor seeding — these three users are explicitly REGULAR (non-admin,
  non-supervisor). Supervisor wiring lives behind `staff_members.is_department_supervisor`
  or similar and is not exercised here.

---

## 15. Promote `law_firm_owner` to a first-class `platform_role` enum value

**Purpose.** Developer-readme §5 lists `law_firm_owner` as a first-class PlatformRole
above `firm_super_admin`. The frontend has been updated to match — `PlatformRole` now
includes `'law_firm_owner'`, `homePortalFor('law_firm_owner')` returns the new
`owner_portal` PortalKey (Portal #20), and the Owner Portal is reachable only by the
owner (super admin is BLOCKED there per readme §5). The DB enum needs the matching
value before any `user_profiles` row can use it.

### S15.1 — ALTER TYPE

```sql
ALTER TYPE public.platform_role ADD VALUE IF NOT EXISTS 'law_firm_owner';
```

Same pattern as `'paralegal'` in §S14.3. Run BEFORE any owner `user_profiles` insert.
Postgres requires `ADD VALUE` to be committed before the value can be used in subsequent
DML in the same transaction — keep this on its own migration step.

### S15.2 — Reconciliation note (no SQL — informational)

The frontend previously derived "is law firm owner" from `VITE_FIRM_ROLE='law_firm_owner'`
and conflated it with `isSuperAdmin` (so platform ops could test owner-side surfaces).
After this slice:

- `isLawFirmOwner` is **decoupled** from `isSuperAdmin`. Super admins are blocked from the
  Owner Portal per readme §5.
- Real-auth path: `user_profiles.role = 'law_firm_owner'` → `useCurrentRole()` returns
  `'law_firm_owner'` → `isLawFirmOwner=true` and `isSuperAdmin=false` (unless they ALSO
  hold a super-admin role, which they shouldn't).
- Dev/unauthed path: `VITE_FIRM_ROLE='law_firm_owner'` → `envPlatformRoleFallback()`
  returns `'law_firm_owner'` (previously returned `'firm_super_admin'`). Same effective
  routing.

No DB change beyond §S15.1; the rest is frontend.

### S15.3 — Seed a TEST owner row (optional, for end-to-end verification)

Same pattern as §S14 — TEST account on the `.test` TLD. Append the owner row to S14.2
or run separately:

```sql
INSERT INTO public.user_profiles (user_id, firm_id, role, full_name)
VALUES
  ('<auth_user_id_owner>', '<firm_id>', 'law_firm_owner', 'Owner [TEST]');
```

Suggested email: `owner@majorslawgroup.test`. After login, the user should land at
`view='law_firm_owner_portal'` (the Owner Portal), see the full PortalToggle including
the Owner Portal entry, and have unrestricted cross-department access.

---

## Phase rollout

This doc is updated as each change lands. Phase 1 (now) needs:
- §1 columns on `intake_leads` (channel, lifecycle_status, questionnaire_completion_pct, matter_progression).
- Decision on §3 (recommendation: Option A — promote-in-place, no `matters` table for v1).

Phase 2+ adds the rest (tasks, questionnaire sessions, email tokens, attorney decisions extensions, CCC column, RPCs) as the corresponding frontend changes land. Each phase's schema additions will be flagged here with its target frontend change number.
