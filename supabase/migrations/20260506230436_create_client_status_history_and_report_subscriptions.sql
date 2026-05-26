/*
  # Client Status History & Report Subscriptions

  ## Summary
  Creates the infrastructure for tracking every client/lead status change
  and managing configurable daily report subscriptions for super admins.

  ## New Tables

  ### client_status_history
  Immutable append-only log of every status transition for intake leads and
  case workflow stages. One row per transition event.

  Columns:
  - id — primary key
  - record_type — "lead" | "case_workflow" | "attorney_acceptance"
  - record_id — the id of the lead / case_workflow / acceptance row
  - client_name — denormalized for fast reporting
  - client_id — uuid (may be null for leads not yet converted)
  - chapter — 7 or 13 (nullable)
  - state — client's state (nullable)
  - from_status — previous status value (null on first entry)
  - to_status — new status value
  - changed_by — staff name or "system"
  - changed_at — when the transition happened (server time)
  - notes — optional context

  ### report_subscriptions
  Per-admin configuration of which report events they want and how often.

  Columns:
  - id — primary key
  - admin_email — recipient email address
  - admin_name — display name
  - staff_id — FK to staff_members (nullable — allows adding external recipients)
  - is_active — whether this subscription is enabled
  - frequency — "daily" | "weekly" | "immediate"
  - send_hour — UTC hour to send daily digest (0-23, default 8)
  - include_new_clients — include newly-created leads/clients
  - include_status_changes — include status transitions
  - include_cancellations — highlight cancels/declines/no_shows
  - include_holds — highlight on_hold cases
  - include_closures — highlight closed/filed cases
  - filter_chapter — null=all, 7, or 13
  - filter_states — json array of state codes (empty=all)
  - filter_from_date — only include changes on/after this date (null=no limit)
  - last_sent_at — when the last report was emailed
  - created_at, updated_at

  ### report_send_log
  Audit trail of every report email sent.

  Columns:
  - id, subscription_id FK, sent_at, status, event_count, error_message

  ## Security
  - RLS enabled; anon key access for all (consistent with rest of project)
*/

-- ── client_status_history ────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS client_status_history (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  record_type  text NOT NULL DEFAULT 'lead',   -- 'lead' | 'case_workflow' | 'attorney_acceptance'
  record_id    text NOT NULL,
  client_name  text NOT NULL,
  client_id    uuid,
  chapter      integer,
  state        text,
  from_status  text,
  to_status    text NOT NULL,
  changed_by   text NOT NULL DEFAULT 'system',
  changed_at   timestamptz NOT NULL DEFAULT now(),
  notes        text
);

ALTER TABLE client_status_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anon can read status history"
  ON client_status_history FOR SELECT TO anon USING (true);

CREATE POLICY "Anon can insert status history"
  ON client_status_history FOR INSERT TO anon WITH CHECK (true);

CREATE INDEX IF NOT EXISTS idx_status_history_changed_at
  ON client_status_history (changed_at DESC);

CREATE INDEX IF NOT EXISTS idx_status_history_to_status
  ON client_status_history (to_status, changed_at DESC);

CREATE INDEX IF NOT EXISTS idx_status_history_record
  ON client_status_history (record_type, record_id);

-- ── report_subscriptions ─────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS report_subscriptions (
  id                      uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_email             text NOT NULL,
  admin_name              text NOT NULL,
  staff_id                uuid REFERENCES staff_members(id) ON DELETE SET NULL,
  is_active               boolean NOT NULL DEFAULT true,
  frequency               text NOT NULL DEFAULT 'daily',   -- 'daily' | 'weekly' | 'immediate'
  send_hour               integer NOT NULL DEFAULT 8,      -- UTC hour 0-23
  include_new_clients     boolean NOT NULL DEFAULT true,
  include_status_changes  boolean NOT NULL DEFAULT true,
  include_cancellations   boolean NOT NULL DEFAULT true,
  include_holds           boolean NOT NULL DEFAULT true,
  include_closures        boolean NOT NULL DEFAULT true,
  filter_chapter          integer,                         -- null = all
  filter_states           jsonb NOT NULL DEFAULT '[]'::jsonb,
  filter_from_date        date,
  last_sent_at            timestamptz,
  created_at              timestamptz DEFAULT now(),
  updated_at              timestamptz DEFAULT now()
);

ALTER TABLE report_subscriptions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anon can read report subscriptions"
  ON report_subscriptions FOR SELECT TO anon USING (true);

CREATE POLICY "Anon can insert report subscriptions"
  ON report_subscriptions FOR INSERT TO anon WITH CHECK (true);

CREATE POLICY "Anon can update report subscriptions"
  ON report_subscriptions FOR UPDATE TO anon USING (true) WITH CHECK (true);

CREATE POLICY "Anon can delete report subscriptions"
  ON report_subscriptions FOR DELETE TO anon USING (true);

-- ── report_send_log ──────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS report_send_log (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  subscription_id  uuid REFERENCES report_subscriptions(id) ON DELETE CASCADE,
  sent_at          timestamptz DEFAULT now(),
  status           text NOT NULL DEFAULT 'sent',   -- 'sent' | 'failed' | 'skipped'
  event_count      integer NOT NULL DEFAULT 0,
  error_message    text
);

ALTER TABLE report_send_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anon can read send log"
  ON report_send_log FOR SELECT TO anon USING (true);

CREATE POLICY "Anon can insert send log"
  ON report_send_log FOR INSERT TO anon WITH CHECK (true);

-- ── Seed: default subscriptions for super admins ─────────────────────────────
-- (Uses the known super admin seed IDs from the permission migration)

INSERT INTO report_subscriptions
  (admin_email, admin_name, staff_id, frequency, include_new_clients, include_status_changes,
   include_cancellations, include_holds, include_closures)
VALUES
  ('sarah.kim@majorslaw.ai',      'Sarah Kim',      '11111111-0000-0000-0000-000000000005', 'daily', true, true, true, true, true),
  ('jennifer.smith@majorslaw.ai', 'Jennifer Smith', '11111111-0000-0000-0000-000000000001', 'daily', true, true, true, true, true)
ON CONFLICT DO NOTHING;
