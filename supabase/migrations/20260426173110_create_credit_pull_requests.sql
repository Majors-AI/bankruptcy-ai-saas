/*
  # Credit Pull & Document Assistance Requests

  Tracks client elections for data assistance at the start of the questionnaire.
  Clients can choose to:
    1. Enter everything manually
    2. Have the system pull their credit (all 3 bureaus) and/or retrieve financial documents
    3. Upload a PDF credit report from annualcreditreport.com

  ## New Table: `credit_pull_requests`
  - `id` — uuid primary key
  - `client_id` — client identifier
  - `client_name` — display name
  - `filing_type` — 'individual' | 'joint' (determines price: $60 vs $120)
  - `service_elected` — jsonb: { creditPull: bool, docRetrieval: bool, pdfUpload: bool, manualOnly: bool }
  - `status` — 'pending_choice' | 'awaiting_invoice' | 'invoice_sent' | 'paid' | 'processing' | 'complete' | 'manual'
  - `invoice_amount` — e.g. 60 or 120
  - `invoice_sent_at` — when invoice was dispatched
  - `invoice_paid_at` — when payment confirmed
  - `pdf_uploaded` — true when client uploaded a credit report PDF
  - `pdf_path` — storage path of uploaded PDF
  - `pdf_verified` — true when PDF was parsed and validated
  - `pdf_error` — any parse error message
  - `credit_pulled_at` — when the system completed the credit pull
  - `docs_retrieved_at` — when financial docs were retrieved
  - `notes` — internal notes
  - `created_at`, `updated_at`

  ## Security
  - RLS enabled
  - Public anon insert/select/update (no auth in current app, filtered by client_id in app layer)
*/

CREATE TABLE IF NOT EXISTS credit_pull_requests (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id         text NOT NULL DEFAULT '',
  client_name       text NOT NULL DEFAULT '',
  filing_type       text NOT NULL DEFAULT 'individual',
  service_elected   jsonb DEFAULT '{}'::jsonb,
  status            text NOT NULL DEFAULT 'pending_choice',
  invoice_amount    numeric(8,2),
  invoice_sent_at   timestamptz,
  invoice_paid_at   timestamptz,
  pdf_uploaded      boolean DEFAULT false,
  pdf_path          text,
  pdf_verified      boolean DEFAULT false,
  pdf_error         text,
  credit_pulled_at  timestamptz,
  docs_retrieved_at timestamptz,
  notes             text,
  created_at        timestamptz DEFAULT now(),
  updated_at        timestamptz DEFAULT now()
);

ALTER TABLE credit_pull_requests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can insert credit pull requests"
  ON credit_pull_requests FOR INSERT TO anon WITH CHECK (true);

CREATE POLICY "Anyone can select credit pull requests"
  ON credit_pull_requests FOR SELECT TO anon USING (true);

CREATE POLICY "Anyone can update credit pull requests"
  ON credit_pull_requests FOR UPDATE TO anon USING (true) WITH CHECK (true);

CREATE INDEX IF NOT EXISTS idx_credit_pull_requests_client_id ON credit_pull_requests(client_id);
CREATE INDEX IF NOT EXISTS idx_credit_pull_requests_status ON credit_pull_requests(status);
