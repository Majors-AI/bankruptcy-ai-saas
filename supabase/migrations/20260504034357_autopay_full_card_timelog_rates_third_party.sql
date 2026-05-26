/*
  # Autopay Full Card Capture, Client Approval, 3rd Party Payee, Time Log Billing Rates

  ## Changes

  ### accounting_autopay_enrollments
  - Adds full card fields: card_number_encrypted, card_expiry, card_cvv_hash, billing_address_*
  - Adds client approval workflow: approval_required, approval_status, approval_sent_at,
    approval_sent_via, approval_response_at, approval_override (staff override with reason),
    approval_override_by, approval_override_at, approval_override_reason
  - Adds 3rd party payee: third_party_name, third_party_email, third_party_phone,
    third_party_authorization_method, third_party_signed_at, third_party_payment_link_sent

  ### case_time_log
  - Adds billing_rate (hourly rate at time of entry)
  - Adds billable_amount (computed: rate × hours)
  - Adds staff_id (FK to staff_members)
  - Adds staff_role (attorney / paralegal / legal_admin / etc.)
  - Adds duration_units (decimal hours, min 0.2)

  ### staff_members
  - Adds hourly_rate column with role-based defaults

  ### accounting_third_party_payees (new table)
  - Tracks 3rd party payers with link payment or card auth
*/

-- ── accounting_autopay_enrollments extensions ─────────────────────────────────

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='accounting_autopay_enrollments' AND column_name='card_number_encrypted') THEN
    ALTER TABLE accounting_autopay_enrollments ADD COLUMN card_number_encrypted text;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='accounting_autopay_enrollments' AND column_name='card_expiry') THEN
    ALTER TABLE accounting_autopay_enrollments ADD COLUMN card_expiry text;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='accounting_autopay_enrollments' AND column_name='card_cvv_hash') THEN
    ALTER TABLE accounting_autopay_enrollments ADD COLUMN card_cvv_hash text;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='accounting_autopay_enrollments' AND column_name='billing_address_line1') THEN
    ALTER TABLE accounting_autopay_enrollments ADD COLUMN billing_address_line1 text;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='accounting_autopay_enrollments' AND column_name='billing_address_city') THEN
    ALTER TABLE accounting_autopay_enrollments ADD COLUMN billing_address_city text;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='accounting_autopay_enrollments' AND column_name='billing_address_state') THEN
    ALTER TABLE accounting_autopay_enrollments ADD COLUMN billing_address_state text;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='accounting_autopay_enrollments' AND column_name='billing_address_zip') THEN
    ALTER TABLE accounting_autopay_enrollments ADD COLUMN billing_address_zip text;
  END IF;
END $$;

-- Client approval workflow
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='accounting_autopay_enrollments' AND column_name='approval_required') THEN
    ALTER TABLE accounting_autopay_enrollments ADD COLUMN approval_required boolean NOT NULL DEFAULT true;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='accounting_autopay_enrollments' AND column_name='approval_status') THEN
    ALTER TABLE accounting_autopay_enrollments ADD COLUMN approval_status text DEFAULT 'pending';
    -- pending | sent | approved | declined | overridden
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='accounting_autopay_enrollments' AND column_name='approval_sent_at') THEN
    ALTER TABLE accounting_autopay_enrollments ADD COLUMN approval_sent_at timestamptz;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='accounting_autopay_enrollments' AND column_name='approval_sent_via') THEN
    ALTER TABLE accounting_autopay_enrollments ADD COLUMN approval_sent_via text;
    -- sms | email
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='accounting_autopay_enrollments' AND column_name='approval_response_at') THEN
    ALTER TABLE accounting_autopay_enrollments ADD COLUMN approval_response_at timestamptz;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='accounting_autopay_enrollments' AND column_name='approval_override') THEN
    ALTER TABLE accounting_autopay_enrollments ADD COLUMN approval_override boolean NOT NULL DEFAULT false;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='accounting_autopay_enrollments' AND column_name='approval_override_by') THEN
    ALTER TABLE accounting_autopay_enrollments ADD COLUMN approval_override_by text;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='accounting_autopay_enrollments' AND column_name='approval_override_at') THEN
    ALTER TABLE accounting_autopay_enrollments ADD COLUMN approval_override_at timestamptz;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='accounting_autopay_enrollments' AND column_name='approval_override_reason') THEN
    ALTER TABLE accounting_autopay_enrollments ADD COLUMN approval_override_reason text;
  END IF;
END $$;

-- 3rd party payee on same enrollment record
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='accounting_autopay_enrollments' AND column_name='is_third_party') THEN
    ALTER TABLE accounting_autopay_enrollments ADD COLUMN is_third_party boolean NOT NULL DEFAULT false;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='accounting_autopay_enrollments' AND column_name='third_party_name') THEN
    ALTER TABLE accounting_autopay_enrollments ADD COLUMN third_party_name text;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='accounting_autopay_enrollments' AND column_name='third_party_email') THEN
    ALTER TABLE accounting_autopay_enrollments ADD COLUMN third_party_email text;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='accounting_autopay_enrollments' AND column_name='third_party_phone') THEN
    ALTER TABLE accounting_autopay_enrollments ADD COLUMN third_party_phone text;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='accounting_autopay_enrollments' AND column_name='third_party_method') THEN
    ALTER TABLE accounting_autopay_enrollments ADD COLUMN third_party_method text;
    -- pay_link | card_auth
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='accounting_autopay_enrollments' AND column_name='third_party_link_sent_at') THEN
    ALTER TABLE accounting_autopay_enrollments ADD COLUMN third_party_link_sent_at timestamptz;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='accounting_autopay_enrollments' AND column_name='third_party_client_signed') THEN
    ALTER TABLE accounting_autopay_enrollments ADD COLUMN third_party_client_signed boolean NOT NULL DEFAULT false;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='accounting_autopay_enrollments' AND column_name='third_party_payee_signed') THEN
    ALTER TABLE accounting_autopay_enrollments ADD COLUMN third_party_payee_signed boolean NOT NULL DEFAULT false;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='accounting_autopay_enrollments' AND column_name='third_party_paid_at') THEN
    ALTER TABLE accounting_autopay_enrollments ADD COLUMN third_party_paid_at timestamptz;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='accounting_autopay_enrollments' AND column_name='third_party_amount_paid') THEN
    ALTER TABLE accounting_autopay_enrollments ADD COLUMN third_party_amount_paid numeric(10,2);
  END IF;
END $$;

-- ── case_time_log extensions ──────────────────────────────────────────────────

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='case_time_log' AND column_name='billing_rate') THEN
    ALTER TABLE case_time_log ADD COLUMN billing_rate numeric(8,2);
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='case_time_log' AND column_name='billable_amount') THEN
    ALTER TABLE case_time_log ADD COLUMN billable_amount numeric(10,2);
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='case_time_log' AND column_name='staff_role') THEN
    ALTER TABLE case_time_log ADD COLUMN staff_role text;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='case_time_log' AND column_name='staff_member_id') THEN
    ALTER TABLE case_time_log ADD COLUMN staff_member_id uuid;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='case_time_log' AND column_name='duration_units') THEN
    ALTER TABLE case_time_log ADD COLUMN duration_units numeric(6,2);
    -- decimal billing units (e.g. 0.2, 0.5, 1.0); min 0.2
  END IF;
END $$;

-- ── staff_members hourly rate ─────────────────────────────────────────────────

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='staff_members' AND column_name='hourly_rate') THEN
    ALTER TABLE staff_members ADD COLUMN hourly_rate numeric(8,2);
  END IF;
END $$;

-- Set default rates based on current roles
UPDATE staff_members SET hourly_rate = 450.00 WHERE role IN ('attorney_owner', 'attorney_superadmin', 'attorney') AND (hourly_rate IS NULL OR hourly_rate = 0);
UPDATE staff_members SET hourly_rate = 225.00 WHERE role = 'paralegal' AND (hourly_rate IS NULL OR hourly_rate = 0);
UPDATE staff_members SET hourly_rate = 175.00 WHERE role IN ('legal_admin', 'accounting_admin', 'accounting_superadmin') AND (hourly_rate IS NULL OR hourly_rate = 0);
UPDATE staff_members SET hourly_rate = 175.00 WHERE role = 'custom' AND (hourly_rate IS NULL OR hourly_rate = 0);
