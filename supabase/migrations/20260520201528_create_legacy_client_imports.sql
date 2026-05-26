/*
  # Legacy Client Import System

  ## Purpose
  Supports importing existing clients from a prior case management system (BCI format)
  into the BankruptcyDocs.ai platform, along with their associated documents.

  ## New Tables

  ### legacy_client_imports
  Master record for each imported legacy client. Stores all core case data entered
  manually or parsed from a BCI CSV row, plus document attachment metadata.

  Columns:
  - id: primary key
  - import_batch_id: groups clients imported in the same session (text, e.g. "BATCH-2026-05-20")
  - imported_by: staff name who performed the import
  - source_system: name of the old system (e.g. "BCI", "CasePacer", "MyCase")
  - legacy_client_id: ID from the old system if known
  - full_name: client full name
  - email / phone: contact info
  - address, city, state, zip: address
  - dob: date of birth
  - ssn_last4: last 4 digits of SSN only (never full SSN)
  - chapter: 7 or 13
  - case_type: ch7_regular, ch7_bifurcated, ch13_flat_fee, limited_scope
  - case_number: court case number if already filed
  - filed_date: filing date if already filed
  - discharge_date: discharge date if case closed
  - attorney_fee / court_filing_fee: fee structure
  - assigned_attorney / assigned_paralegal: staff assignment
  - status: pending_review | active | closed | on_hold
  - notes: free-form import notes
  - bci_raw_data: full raw CSV row stored as JSON for audit
  - accounting_client_id: UUID of the accounting_clients row once promoted
  - intake_lead_id: UUID of the intake_leads row once promoted
  - promoted_at: when this record was promoted to active client
  - created_at / updated_at

  ### legacy_import_documents
  Tracks documents attached to a legacy client import — either uploaded files
  or notes about physical documents that need to be scanned/organized.

  Columns:
  - id: primary key
  - import_id: FK to legacy_client_imports
  - doc_category: petition | schedules | means_test | paystubs | bank_statements |
                  tax_returns | creditor_matrix | court_notices | retainer | other
  - doc_label: human-readable label
  - file_name: original filename if uploaded
  - file_path: storage path in Supabase Storage (null if not uploaded yet)
  - status: pending | uploaded | needs_scan | organized | missing
  - notes: notes about this document
  - created_at

  ## Security
  - RLS enabled on both tables
  - Staff (anon for now, to be locked down when auth is wired) can insert/select/update
*/

CREATE TABLE IF NOT EXISTS legacy_client_imports (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  import_batch_id       text NOT NULL DEFAULT '',
  imported_by           text NOT NULL DEFAULT '',
  source_system         text NOT NULL DEFAULT 'BCI',
  legacy_client_id      text,
  full_name             text NOT NULL DEFAULT '',
  email                 text,
  phone                 text,
  address               text,
  city                  text,
  state                 char(2),
  zip                   text,
  dob                   date,
  ssn_last4             char(4),
  chapter               smallint NOT NULL DEFAULT 7,
  case_type             text NOT NULL DEFAULT 'ch7_regular',
  case_number           text,
  filed_date            date,
  discharge_date        date,
  attorney_fee          numeric(10,2),
  court_filing_fee      numeric(10,2),
  assigned_attorney     text,
  assigned_paralegal    text,
  status                text NOT NULL DEFAULT 'pending_review',
  notes                 text,
  bci_raw_data          jsonb,
  accounting_client_id  uuid,
  intake_lead_id        uuid,
  promoted_at           timestamptz,
  created_at            timestamptz NOT NULL DEFAULT now(),
  updated_at            timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS legacy_import_documents (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  import_id     uuid NOT NULL REFERENCES legacy_client_imports(id) ON DELETE CASCADE,
  doc_category  text NOT NULL DEFAULT 'other',
  doc_label     text NOT NULL DEFAULT '',
  file_name     text,
  file_path     text,
  status        text NOT NULL DEFAULT 'pending',
  notes         text,
  created_at    timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_legacy_imports_batch ON legacy_client_imports(import_batch_id);
CREATE INDEX IF NOT EXISTS idx_legacy_imports_status ON legacy_client_imports(status);
CREATE INDEX IF NOT EXISTS idx_legacy_import_docs_import ON legacy_import_documents(import_id);

ALTER TABLE legacy_client_imports ENABLE ROW LEVEL SECURITY;
ALTER TABLE legacy_import_documents ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Staff can select legacy imports"
  ON legacy_client_imports FOR SELECT
  TO anon USING (true);

CREATE POLICY "Staff can insert legacy imports"
  ON legacy_client_imports FOR INSERT
  TO anon WITH CHECK (true);

CREATE POLICY "Staff can update legacy imports"
  ON legacy_client_imports FOR UPDATE
  TO anon USING (true) WITH CHECK (true);

CREATE POLICY "Staff can select legacy import docs"
  ON legacy_import_documents FOR SELECT
  TO anon USING (true);

CREATE POLICY "Staff can insert legacy import docs"
  ON legacy_import_documents FOR INSERT
  TO anon WITH CHECK (true);

CREATE POLICY "Staff can update legacy import docs"
  ON legacy_import_documents FOR UPDATE
  TO anon USING (true) WITH CHECK (true);
