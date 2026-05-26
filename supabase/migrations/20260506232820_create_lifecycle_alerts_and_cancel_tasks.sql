/*
  # Client Lifecycle Alerts, Cancel Request Tasks & Disengagement Tracking

  ## Overview
  This migration supports:

  1. **Paid-in-Full 60-Day Warning System**
     - `client_lifecycle_alerts` table tracks alerts per client including:
       - paid_in_full_warning: sent after 6 months of being paid in full if not in paralegal review
       - drop_warning: sent when billable hours exceed the flat fee
       - drop_notice_task: task for accounting super admin to send drop/withdrawal letter

  2. **Cancel Request Task Workflow**
     - When a cancel request is created, tasks are auto-logged:
       - Accounting: pause payments
       - Attorney Super Admin: reach out to client, attempt save
     - `cancel_request_tasks` table links tasks to cancel requests

  3. **Disengagement Notices**
     - `disengagement_notices` table tracks formal disengagement emails sent to clients
       when cancellation is confirmed — includes unearned fee refund tracking

  ## New Tables
  - `client_lifecycle_alerts` — tracks 60-day and drop warning alerts per client
  - `cancel_request_tasks` — links staff_tasks to cancel requests for audit
  - `disengagement_notices` — formal disengagement letter records with refund tracking

  ## Security
  - RLS enabled on all new tables with anon SELECT/INSERT/UPDATE (consistent with project)
*/

-- ─── 1. client_lifecycle_alerts ───────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS client_lifecycle_alerts (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id             uuid NOT NULL,
  client_name           text NOT NULL DEFAULT '',
  alert_type            text NOT NULL
    CHECK (alert_type IN (
      'paid_in_full_60day_warning',
      'billable_hours_exceed_fee',
      'drop_notice_task',
      'paralegal_overdue'
    )),
  -- When was the alert triggered
  triggered_at          timestamptz NOT NULL DEFAULT now(),
  -- Optional: date the paid_in_full status was reached
  paid_full_date        date DEFAULT NULL,
  -- Billable hours vs fee context
  total_billable_hours  numeric(8,2) DEFAULT NULL,
  billable_amount       numeric(10,2) DEFAULT NULL,
  total_fee             numeric(10,2) DEFAULT NULL,
  -- Who was notified / what was sent
  email_sent_to         text DEFAULT NULL,
  email_sent_at         timestamptz DEFAULT NULL,
  task_created_for      text DEFAULT NULL,  -- staff role targeted
  task_id               uuid DEFAULT NULL,  -- references staff_tasks.id
  -- Resolution
  status                text NOT NULL DEFAULT 'open'
    CHECK (status IN ('open', 'acknowledged', 'resolved', 'dismissed')),
  resolved_by           text DEFAULT NULL,
  resolved_at           timestamptz DEFAULT NULL,
  notes                 text DEFAULT NULL,
  created_at            timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE client_lifecycle_alerts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "anon can read lifecycle alerts"
  ON client_lifecycle_alerts FOR SELECT TO anon USING (true);
CREATE POLICY "anon can insert lifecycle alerts"
  ON client_lifecycle_alerts FOR INSERT TO anon WITH CHECK (true);
CREATE POLICY "anon can update lifecycle alerts"
  ON client_lifecycle_alerts FOR UPDATE TO anon USING (true) WITH CHECK (true);

CREATE INDEX IF NOT EXISTS idx_lifecycle_alerts_client_id
  ON client_lifecycle_alerts (client_id);
CREATE INDEX IF NOT EXISTS idx_lifecycle_alerts_type_status
  ON client_lifecycle_alerts (alert_type, status);

-- ─── 2. cancel_request_tasks ──────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS cancel_request_tasks (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  cancel_request_id   uuid NOT NULL REFERENCES accounting_cancel_requests(id) ON DELETE CASCADE,
  client_id           uuid NOT NULL,
  task_type           text NOT NULL
    CHECK (task_type IN ('pause_payments', 'attorney_outreach', 'refund_unearned', 'send_disengagement', 'other')),
  assigned_role       text NOT NULL DEFAULT '',   -- 'accounting_super_admin' | 'attorney_super_admin'
  assigned_to_id      uuid DEFAULT NULL,          -- optional specific staff_member.id
  assigned_to_name    text DEFAULT NULL,
  title               text NOT NULL DEFAULT '',
  description         text DEFAULT NULL,
  status              text NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'in_progress', 'completed', 'dismissed')),
  completed_by        text DEFAULT NULL,
  completed_at        timestamptz DEFAULT NULL,
  created_at          timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE cancel_request_tasks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "anon can read cancel request tasks"
  ON cancel_request_tasks FOR SELECT TO anon USING (true);
CREATE POLICY "anon can insert cancel request tasks"
  ON cancel_request_tasks FOR INSERT TO anon WITH CHECK (true);
CREATE POLICY "anon can update cancel request tasks"
  ON cancel_request_tasks FOR UPDATE TO anon USING (true) WITH CHECK (true);

CREATE INDEX IF NOT EXISTS idx_cancel_request_tasks_cancel_id
  ON cancel_request_tasks (cancel_request_id);
CREATE INDEX IF NOT EXISTS idx_cancel_request_tasks_client_id
  ON cancel_request_tasks (client_id);
CREATE INDEX IF NOT EXISTS idx_cancel_request_tasks_status
  ON cancel_request_tasks (status) WHERE status = 'pending';

-- ─── 3. disengagement_notices ─────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS disengagement_notices (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id             uuid NOT NULL,
  client_name           text NOT NULL DEFAULT '',
  client_email          text DEFAULT NULL,
  cancel_request_id     uuid DEFAULT NULL REFERENCES accounting_cancel_requests(id) ON DELETE SET NULL,
  -- Email details
  email_sent_at         timestamptz DEFAULT NULL,
  email_sent_by         text DEFAULT NULL,
  email_subject         text DEFAULT NULL,
  email_body            text DEFAULT NULL,
  -- Refund tracking
  total_paid            numeric(10,2) DEFAULT 0,
  earned_fees           numeric(10,2) DEFAULT 0,
  unearned_fees         numeric(10,2) DEFAULT 0,  -- total_paid - earned_fees
  refund_amount         numeric(10,2) DEFAULT 0,
  refund_status         text NOT NULL DEFAULT 'pending'
    CHECK (refund_status IN ('pending', 'calculated', 'approved', 'issued', 'not_applicable')),
  refund_authorized_by  text DEFAULT NULL,
  refund_authorized_at  timestamptz DEFAULT NULL,
  refund_issued_by      text DEFAULT NULL,
  refund_issued_at      timestamptz DEFAULT NULL,
  refund_method         text DEFAULT NULL,
  refund_notes          text DEFAULT NULL,
  -- Accounting super admin task
  accounting_task_id    uuid DEFAULT NULL,
  -- Status
  status                text NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'sent', 'refund_pending', 'refund_issued', 'closed')),
  created_at            timestamptz NOT NULL DEFAULT now(),
  updated_at            timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE disengagement_notices ENABLE ROW LEVEL SECURITY;

CREATE POLICY "anon can read disengagement notices"
  ON disengagement_notices FOR SELECT TO anon USING (true);
CREATE POLICY "anon can insert disengagement notices"
  ON disengagement_notices FOR INSERT TO anon WITH CHECK (true);
CREATE POLICY "anon can update disengagement notices"
  ON disengagement_notices FOR UPDATE TO anon USING (true) WITH CHECK (true);

CREATE INDEX IF NOT EXISTS idx_disengagement_notices_client_id
  ON disengagement_notices (client_id);
CREATE INDEX IF NOT EXISTS idx_disengagement_notices_cancel_id
  ON disengagement_notices (cancel_request_id);

-- ─── 4. Add cancel_submitted_at & cancel_email_sent columns to accounting_cancel_requests ─
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'accounting_cancel_requests' AND column_name = 'cancel_email_sent_at'
  ) THEN
    ALTER TABLE accounting_cancel_requests
      ADD COLUMN cancel_email_sent_at timestamptz DEFAULT NULL,
      ADD COLUMN payment_paused_at timestamptz DEFAULT NULL,
      ADD COLUMN payment_paused_by text DEFAULT NULL,
      ADD COLUMN attorney_outreach_task_id uuid DEFAULT NULL,
      ADD COLUMN accounting_pause_task_id uuid DEFAULT NULL;
  END IF;
END $$;
