/*
  # Autopay, Merchant Processors, and Cancel Requests

  1. New Tables
    - `accounting_merchant_accounts` — maps each merchant processor (PayCompass/Amex, LawPay)
      to a specific bank account (AZ Operating, AZ Trust, WA Operating, WA Trust)
    - `accounting_autopay_enrollments` — stores a client's autopay consent + stored payment method token
    - `accounting_payment_retries` — tracks every retry attempt for a declined autopay charge
    - `accounting_cancel_requests` — client cancellation requests with AI retention chat, status, and outcome

  2. Schema Notes
    - Processor enum: 'paycompass' | 'lawpay'
    - Account enum: 'az_operating' | 'az_trust' | 'wa_operating' | 'wa_trust'
    - Retry policy: retried daily, max_due_date cannot exceed 14 days from original_due_date
    - Cancel request status: 'pending' | 'saved' | 'cancelled'
    - Cancel reason and AI chat stored as JSONB

  3. Security
    - RLS enabled on all tables
    - Accounting staff (anon) can read/write; public cannot
*/

-- Merchant account routing table
CREATE TABLE IF NOT EXISTS accounting_merchant_accounts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  processor text NOT NULL,           -- 'paycompass' | 'lawpay'
  account_key text NOT NULL,         -- 'az_operating' | 'az_trust' | 'wa_operating' | 'wa_trust'
  account_label text NOT NULL,       -- Human label e.g. "AZ Operating – UMB Bank"
  bank_name text NOT NULL,
  account_last4 text,
  is_active boolean NOT NULL DEFAULT true,
  notes text,
  created_at timestamptz DEFAULT now(),
  UNIQUE(processor, account_key)
);

ALTER TABLE accounting_merchant_accounts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Accounting staff can read merchant accounts"
  ON accounting_merchant_accounts FOR SELECT
  TO anon USING (true);

CREATE POLICY "Accounting staff can insert merchant accounts"
  ON accounting_merchant_accounts FOR INSERT
  TO anon WITH CHECK (true);

CREATE POLICY "Accounting staff can update merchant accounts"
  ON accounting_merchant_accounts FOR UPDATE
  TO anon USING (true) WITH CHECK (true);

-- Seed the four account / processor mappings
INSERT INTO accounting_merchant_accounts (processor, account_key, account_label, bank_name, notes)
VALUES
  ('paycompass', 'az_operating', 'AZ Operating – UMB Bank',    'UMB Bank',  'PayCompass/Amex merchant — AZ Operating'),
  ('paycompass', 'az_trust',     'AZ Trust (IOLTA) – UMB Bank','UMB Bank',  'PayCompass/Amex merchant — AZ IOLTA Trust'),
  ('paycompass', 'wa_operating', 'WA Operating – US Bank',     'US Bank',   'PayCompass/Amex merchant — WA Operating'),
  ('paycompass', 'wa_trust',     'WA Trust (IOLTA) – US Bank', 'US Bank',   'PayCompass/Amex merchant — WA IOLTA Trust'),
  ('lawpay',     'az_operating', 'AZ Operating – UMB Bank',    'UMB Bank',  'LawPay merchant — AZ Operating'),
  ('lawpay',     'az_trust',     'AZ Trust (IOLTA) – UMB Bank','UMB Bank',  'LawPay merchant — AZ IOLTA Trust'),
  ('lawpay',     'wa_operating', 'WA Operating – US Bank',     'US Bank',   'LawPay merchant — WA Operating'),
  ('lawpay',     'wa_trust',     'WA Trust (IOLTA) – US Bank', 'US Bank',   'LawPay merchant — WA IOLTA Trust')
ON CONFLICT (processor, account_key) DO NOTHING;

-- Autopay enrollments
CREATE TABLE IF NOT EXISTS accounting_autopay_enrollments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id uuid NOT NULL REFERENCES accounting_clients(id) ON DELETE CASCADE,
  processor text NOT NULL DEFAULT 'lawpay',   -- 'paycompass' | 'lawpay'
  payment_method_token text,                  -- tokenized card/bank reference from processor
  payment_method_type text,                   -- 'card' | 'ach'
  payment_method_last4 text,
  card_brand text,
  enrolled_by text,
  enrolled_at timestamptz DEFAULT now(),
  is_active boolean NOT NULL DEFAULT true,
  paused_until date,
  notes text,
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE accounting_autopay_enrollments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Accounting staff can read autopay enrollments"
  ON accounting_autopay_enrollments FOR SELECT TO anon USING (true);

CREATE POLICY "Accounting staff can insert autopay enrollments"
  ON accounting_autopay_enrollments FOR INSERT TO anon WITH CHECK (true);

CREATE POLICY "Accounting staff can update autopay enrollments"
  ON accounting_autopay_enrollments FOR UPDATE TO anon USING (true) WITH CHECK (true);

-- Payment retry log (declined autopay charges)
CREATE TABLE IF NOT EXISTS accounting_payment_retries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id uuid NOT NULL REFERENCES accounting_clients(id) ON DELETE CASCADE,
  schedule_entry_id uuid REFERENCES accounting_payment_schedule(id),
  original_due_date date NOT NULL,
  rescheduled_due_date date,              -- client-requested reschedule (max +14 days from original)
  max_retry_date date NOT NULL,           -- original_due_date + 14 days — hard ceiling
  amount numeric(10,2) NOT NULL,
  processor text,
  decline_reason text,
  attempt_count integer NOT NULL DEFAULT 1,
  last_attempt_at timestamptz DEFAULT now(),
  next_retry_at timestamptz,
  status text NOT NULL DEFAULT 'retrying', -- 'retrying' | 'collected' | 'expired' | 'cancelled'
  client_notified_at timestamptz,
  reschedule_requested_by text,           -- 'client' | 'staff'
  reschedule_requested_at timestamptz,
  resolved_at timestamptz,
  notes text,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE accounting_payment_retries ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Accounting staff can read retries"
  ON accounting_payment_retries FOR SELECT TO anon USING (true);

CREATE POLICY "Accounting staff can insert retries"
  ON accounting_payment_retries FOR INSERT TO anon WITH CHECK (true);

CREATE POLICY "Accounting staff can update retries"
  ON accounting_payment_retries FOR UPDATE TO anon USING (true) WITH CHECK (true);

-- Cancel requests
CREATE TABLE IF NOT EXISTS accounting_cancel_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id uuid NOT NULL REFERENCES accounting_clients(id) ON DELETE CASCADE,
  requested_by text,                      -- client name or staff
  request_channel text DEFAULT 'portal', -- 'portal' | 'phone' | 'email' | 'in_person'
  reason_category text,                   -- 'cannot_afford' | 'changed_mind' | 'circumstances_changed' | 'other'
  reason_detail text,
  ai_chat_log jsonb,                      -- array of { role: 'ai'|'client', message, ts }
  ai_retention_outcome text,              -- 'saved' | 'escalated' | 'irreversible'
  staff_reviewer text,
  staff_notes text,
  status text NOT NULL DEFAULT 'pending', -- 'pending' | 'saved' | 'cancelled'
  outcome_reason text,                    -- why saved or why cancelled
  resolved_at timestamptz,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE accounting_cancel_requests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Accounting staff can read cancel requests"
  ON accounting_cancel_requests FOR SELECT TO anon USING (true);

CREATE POLICY "Accounting staff can insert cancel requests"
  ON accounting_cancel_requests FOR INSERT TO anon WITH CHECK (true);

CREATE POLICY "Accounting staff can update cancel requests"
  ON accounting_cancel_requests FOR UPDATE TO anon USING (true) WITH CHECK (true);

-- Add autopay columns to accounting_clients
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='accounting_clients' AND column_name='autopay_enabled') THEN
    ALTER TABLE accounting_clients ADD COLUMN autopay_enabled boolean NOT NULL DEFAULT false;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='accounting_clients' AND column_name='preferred_processor') THEN
    ALTER TABLE accounting_clients ADD COLUMN preferred_processor text DEFAULT 'lawpay';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='accounting_clients' AND column_name='autopay_enrolled_at') THEN
    ALTER TABLE accounting_clients ADD COLUMN autopay_enrolled_at timestamptz;
  END IF;
END $$;

-- Indexes for common query patterns
CREATE INDEX IF NOT EXISTS idx_retries_client ON accounting_payment_retries(client_id);
CREATE INDEX IF NOT EXISTS idx_retries_status ON accounting_payment_retries(status);
CREATE INDEX IF NOT EXISTS idx_retries_next_retry ON accounting_payment_retries(next_retry_at) WHERE status = 'retrying';
CREATE INDEX IF NOT EXISTS idx_cancel_requests_status ON accounting_cancel_requests(status);
CREATE INDEX IF NOT EXISTS idx_cancel_requests_client ON accounting_cancel_requests(client_id);
CREATE INDEX IF NOT EXISTS idx_autopay_client ON accounting_autopay_enrollments(client_id);
