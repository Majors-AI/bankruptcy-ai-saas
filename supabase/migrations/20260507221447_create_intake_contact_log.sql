/*
  # Create intake_contact_log table

  Tracks every contact attempt made with a lead during the intake phase.
  Used to display a full communication timeline per lead and to power the
  follow-up queue logic (priority vs. bot queue).

  1. New Tables
    - `intake_contact_log`
      - `id` (uuid, primary key)
      - `lead_id` (uuid, FK → intake_leads) — which lead was contacted
      - `channel` (text) — 'sms' | 'email' | 'phone' | 'in_person' | 'bot_sms' | 'bot_email'
      - `direction` (text) — 'outbound' | 'inbound'
      - `outcome` (text) — 'no_answer' | 'left_voicemail' | 'reached' | 'replied' | 'bounced' | 'scheduled' | 'not_interested' | 'other'
      - `notes` (text) — staff notes about the contact
      - `contacted_by` (text) — staff name or 'bot'
      - `is_bot` (boolean) — true when automated follow-up
      - `follow_up_queue` (text) — 'priority' | 'normal' | null — which queue this contact came from
      - `contacted_at` (timestamptz) — when the contact happened
      - `created_at` (timestamptz)

  2. Security
    - Enable RLS
    - Anon can insert (staff portal uses anon key)
    - Anon can select own lead's contacts (via lead_id)

  3. Index
    - Index on lead_id for fast lookup per lead
    - Index on contacted_at for timeline queries
*/

CREATE TABLE IF NOT EXISTS intake_contact_log (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id       uuid NOT NULL REFERENCES intake_leads(id) ON DELETE CASCADE,
  channel       text NOT NULL CHECK (channel IN ('sms','email','phone','in_person','bot_sms','bot_email')),
  direction     text NOT NULL DEFAULT 'outbound' CHECK (direction IN ('outbound','inbound')),
  outcome       text NOT NULL DEFAULT 'other' CHECK (outcome IN ('no_answer','left_voicemail','reached','replied','bounced','scheduled','not_interested','other')),
  notes         text,
  contacted_by  text NOT NULL DEFAULT 'Staff',
  is_bot        boolean NOT NULL DEFAULT false,
  follow_up_queue text CHECK (follow_up_queue IN ('priority','normal')),
  contacted_at  timestamptz NOT NULL DEFAULT now(),
  created_at    timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE intake_contact_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anon can insert contact log entries"
  ON intake_contact_log FOR INSERT
  TO anon
  WITH CHECK (true);

CREATE POLICY "Anon can read contact log entries"
  ON intake_contact_log FOR SELECT
  TO anon
  USING (true);

CREATE INDEX IF NOT EXISTS idx_intake_contact_log_lead_id    ON intake_contact_log(lead_id);
CREATE INDEX IF NOT EXISTS idx_intake_contact_log_contacted_at ON intake_contact_log(contacted_at DESC);

/*
  Also add a follow_up_queue column to intake_leads so each lead carries its
  current queue assignment for fast filtering.
*/
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'intake_leads' AND column_name = 'follow_up_queue'
  ) THEN
    ALTER TABLE intake_leads ADD COLUMN follow_up_queue text CHECK (follow_up_queue IN ('priority','normal','none'));
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'intake_leads' AND column_name = 'bot_followup_enabled'
  ) THEN
    ALTER TABLE intake_leads ADD COLUMN bot_followup_enabled boolean NOT NULL DEFAULT false;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'intake_leads' AND column_name = 'bot_followup_count'
  ) THEN
    ALTER TABLE intake_leads ADD COLUMN bot_followup_count integer NOT NULL DEFAULT 0;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'intake_leads' AND column_name = 'last_bot_followup_at'
  ) THEN
    ALTER TABLE intake_leads ADD COLUMN last_bot_followup_at timestamptz;
  END IF;
END $$;
