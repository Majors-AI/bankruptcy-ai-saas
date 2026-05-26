/*
  # Trust Transfer Hub — Batch Transfer Requests & IOLTA Balance Log

  1. New Tables

    - `accounting_batch_transfer_requests`
        Represents a single batch submission of one or more clients whose
        filing fees are ready to move from IOLTA trust to operating.
        A super-admin attorney must approve or reject the batch.
        Fields:
          - id, state (AZ|WA|TX), iolta_account_id, operating_account_id
          - total_amount, client_count
          - status: 'pending_approval' | 'approved' | 'rejected' | 'executed'
          - submitted_by, submitted_at
          - approved_by (attorney), approved_at, approval_notes
          - executed_at, executed_by
          - rejection_reason, created_at, updated_at

    - `accounting_batch_transfer_items`
        One row per client/registry entry within a batch request.
        Fields:
          - id, batch_id → accounting_batch_transfer_requests
          - registry_id → accounting_filed_case_registry
          - client_id → accounting_clients
          - iolta_amount (amount being transferred for this client)
          - included (boolean — attorney can deselect individual items)
          - notes

    - `accounting_iolta_balance_log`
        Immutable audit ledger: every time a trust account balance changes
        (transfer in, transfer out, manual adjustment) a row is appended.
        Fields:
          - id, trust_account_id → accounting_trust_accounts
          - state, account_type
          - event_type: 'transfer_in' | 'transfer_out' | 'adjustment' | 'snapshot'
          - amount (positive = credit, negative = debit)
          - balance_after
          - related_batch_id, related_registry_id, related_client_id
          - description, recorded_by, recorded_at

  2. Security
    - RLS enabled on all three tables
    - Anon (accounting staff) can read/insert/update — consistent with rest of portal

  3. Notes
    - Batch items are soft-deleted by setting included=false, not hard-deleted
    - Once a batch is 'executed', fund_transfers rows are created for each item
      and trust account balances are updated
*/

-- ── Batch transfer requests ───────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS accounting_batch_transfer_requests (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  state               text NOT NULL,
  iolta_account_id    uuid REFERENCES accounting_trust_accounts(id),
  operating_account_id uuid REFERENCES accounting_trust_accounts(id),
  total_amount        numeric(12,2) NOT NULL DEFAULT 0,
  client_count        integer NOT NULL DEFAULT 0,
  status              text NOT NULL DEFAULT 'pending_approval',
  submitted_by        text NOT NULL,
  submitted_at        timestamptz DEFAULT now(),
  approved_by         text,
  approved_at         timestamptz,
  approval_notes      text,
  executed_at         timestamptz,
  executed_by         text,
  rejection_reason    text,
  created_at          timestamptz DEFAULT now(),
  updated_at          timestamptz DEFAULT now()
);

ALTER TABLE accounting_batch_transfer_requests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Accounting staff can read batch transfer requests"
  ON accounting_batch_transfer_requests FOR SELECT TO anon USING (true);

CREATE POLICY "Accounting staff can insert batch transfer requests"
  ON accounting_batch_transfer_requests FOR INSERT TO anon WITH CHECK (true);

CREATE POLICY "Accounting staff can update batch transfer requests"
  ON accounting_batch_transfer_requests FOR UPDATE TO anon USING (true) WITH CHECK (true);

-- ── Batch transfer items ──────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS accounting_batch_transfer_items (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  batch_id        uuid NOT NULL REFERENCES accounting_batch_transfer_requests(id) ON DELETE CASCADE,
  registry_id     uuid REFERENCES accounting_filed_case_registry(id),
  client_id       uuid NOT NULL REFERENCES accounting_clients(id),
  iolta_amount    numeric(12,2) NOT NULL,
  included        boolean NOT NULL DEFAULT true,
  notes           text,
  created_at      timestamptz DEFAULT now()
);

ALTER TABLE accounting_batch_transfer_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Accounting staff can read batch items"
  ON accounting_batch_transfer_items FOR SELECT TO anon USING (true);

CREATE POLICY "Accounting staff can insert batch items"
  ON accounting_batch_transfer_items FOR INSERT TO anon WITH CHECK (true);

CREATE POLICY "Accounting staff can update batch items"
  ON accounting_batch_transfer_items FOR UPDATE TO anon USING (true) WITH CHECK (true);

-- ── IOLTA balance log ─────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS accounting_iolta_balance_log (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  trust_account_id      uuid NOT NULL REFERENCES accounting_trust_accounts(id),
  state                 text NOT NULL,
  account_type          text NOT NULL DEFAULT 'iolta',
  event_type            text NOT NULL,   -- 'transfer_in' | 'transfer_out' | 'adjustment' | 'snapshot'
  amount                numeric(12,2) NOT NULL,   -- positive = credit, negative = debit
  balance_after         numeric(12,2) NOT NULL,
  related_batch_id      uuid REFERENCES accounting_batch_transfer_requests(id),
  related_registry_id   uuid REFERENCES accounting_filed_case_registry(id),
  related_client_id     uuid REFERENCES accounting_clients(id),
  description           text,
  recorded_by           text,
  recorded_at           timestamptz DEFAULT now()
);

ALTER TABLE accounting_iolta_balance_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Accounting staff can read IOLTA log"
  ON accounting_iolta_balance_log FOR SELECT TO anon USING (true);

CREATE POLICY "Accounting staff can insert IOLTA log"
  ON accounting_iolta_balance_log FOR INSERT TO anon WITH CHECK (true);

-- Log is immutable — no updates allowed

-- Indexes
CREATE INDEX IF NOT EXISTS idx_batch_items_batch     ON accounting_batch_transfer_items(batch_id);
CREATE INDEX IF NOT EXISTS idx_batch_items_client    ON accounting_batch_transfer_items(client_id);
CREATE INDEX IF NOT EXISTS idx_batch_items_registry  ON accounting_batch_transfer_items(registry_id);
CREATE INDEX IF NOT EXISTS idx_batch_requests_state  ON accounting_batch_transfer_requests(state);
CREATE INDEX IF NOT EXISTS idx_batch_requests_status ON accounting_batch_transfer_requests(status);
CREATE INDEX IF NOT EXISTS idx_iolta_log_account     ON accounting_iolta_balance_log(trust_account_id);
CREATE INDEX IF NOT EXISTS idx_iolta_log_state       ON accounting_iolta_balance_log(state);
CREATE INDEX IF NOT EXISTS idx_iolta_log_recorded    ON accounting_iolta_balance_log(recorded_at DESC);
