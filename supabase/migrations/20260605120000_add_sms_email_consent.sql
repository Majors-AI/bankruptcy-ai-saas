/*
  # Add SMS / email consent capture to intake_submissions

  Wording captured at submit time in src/BankruptcyIntake.jsx — TCPA-aligned.
  Form validation prevents submission unless the checkbox is ticked, so a row
  with sms_email_consent = true means the debtor saw and accepted the wording
  on or before sms_email_consent_at.

  The wrapper in src/lib/sendGate.ts gates every send-sms-email call site on
  this column. STOP-keyword inbound handling is a separate follow-up — see
  src/lib/sendGate.ts header comment.
*/

ALTER TABLE intake_submissions
  ADD COLUMN IF NOT EXISTS sms_email_consent     boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS sms_email_consent_at  timestamptz;

-- Backfill: any submission whose form_data already has the camelCase key
-- (from the dual-write path) gets its flat-column twin populated.
UPDATE intake_submissions
SET sms_email_consent     = COALESCE((form_data->>'smsEmailConsent')::boolean, false),
    sms_email_consent_at  = CASE
      WHEN (form_data->>'smsEmailConsent')::boolean THEN submitted_at
      ELSE NULL
    END
WHERE sms_email_consent = false AND form_data ? 'smsEmailConsent';

CREATE INDEX IF NOT EXISTS idx_intake_submissions_sms_email_consent
  ON intake_submissions (sms_email_consent);
