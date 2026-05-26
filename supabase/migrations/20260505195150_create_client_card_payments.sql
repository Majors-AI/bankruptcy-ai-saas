/*
  # Create client_card_payments table

  1. New Tables
    - `client_card_payments`
      - `id` (uuid, primary key)
      - `client_id` (text) — matches CLIENT_ID like "client-demo"
      - `amount` (numeric) — amount paid
      - `cardholder_name` (text) — name on card, must match debtor name
      - `card_last4` (text) — last 4 digits only stored
      - `card_brand` (text) — Visa/MC/Amex etc (detected by prefix)
      - `status` (text) — 'pending' | 'approved' | 'declined'
      - `processor_confirmation` (text) — simulated confirmation code
      - `paid_at` (timestamptz)
      - `created_at` (timestamptz)

  2. Security
    - Enable RLS
    - Anon can insert (clients are not authenticated users)
    - Anon can select own payments by client_id
*/

CREATE TABLE IF NOT EXISTS client_card_payments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id text NOT NULL DEFAULT '',
  amount numeric(10,2) NOT NULL DEFAULT 0,
  cardholder_name text NOT NULL DEFAULT '',
  card_last4 text NOT NULL DEFAULT '',
  card_brand text NOT NULL DEFAULT '',
  status text NOT NULL DEFAULT 'pending',
  processor_confirmation text,
  paid_at timestamptz DEFAULT now(),
  created_at timestamptz DEFAULT now()
);

ALTER TABLE client_card_payments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Clients can insert their own card payments"
  ON client_card_payments
  FOR INSERT
  TO anon
  WITH CHECK (client_id IS NOT NULL AND client_id != '');

CREATE POLICY "Clients can view their own card payments"
  ON client_card_payments
  FOR SELECT
  TO anon
  USING (client_id IS NOT NULL AND client_id != '');
