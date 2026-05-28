/*
  # BAN-30 — Phase-based client file structure

  Adds an enumerated `phase` column to client_documents so the file cabinet
  can group documents by case phase. Phase ordering is encoded in the enum
  labels themselves (01- through 10-) so a simple ORDER BY phase sorts
  correctly without a separate ordinal column.

    01-intake          (intake form + verification)
    02-registration    (client agreement + consents)
    03-credit-bank     (credit reports + bank statements)
    04-questionnaire   (full 17-section questionnaire docs)
    05-attorney-review (attorney clarification responses)
    06-pacer           (PACER notices, ECF correspondence)
    07-trustee         (341 docs, trustee submissions)
    08-court           (court filings, hearing notices)
    09-correspondence  (general client correspondence)
    10-discharge       (discharge order, closing docs)

  Phase is nullable so legacy rows can be backfilled selectively; the
  best-effort UPDATE below maps common existing document_category prefixes
  to a phase. Rows that don't match are left NULL for manual review via the
  super-admin file-cabinet view.

  Depends on:
    - client_documents (from 20260425013756_create_client_documents_storage.sql)
*/

DO $$ BEGIN
  CREATE TYPE case_file_phase AS ENUM (
    '01-intake',
    '02-registration',
    '03-credit-bank',
    '04-questionnaire',
    '05-attorney-review',
    '06-pacer',
    '07-trustee',
    '08-court',
    '09-correspondence',
    '10-discharge'
  );
EXCEPTION WHEN duplicate_object THEN null; END $$;

ALTER TABLE client_documents
  ADD COLUMN IF NOT EXISTS phase case_file_phase;

CREATE INDEX IF NOT EXISTS idx_client_documents_phase
  ON client_documents(client_id, phase);

-- Best-effort backfill from existing document_category / document_type values.
-- Looks at both columns since the BKDOC_SECTIONS in FileCabinet.tsx classifies
-- by document_type while document_category is sometimes set independently.
UPDATE client_documents
SET phase = CASE
  WHEN document_category = 'petition_identity'                                 THEN '01-intake'::case_file_phase
  WHEN document_type LIKE 'debtor1\_%' OR document_type LIKE 'debtor2\_%'      THEN '01-intake'::case_file_phase
  WHEN document_category LIKE '%credit%' OR document_type LIKE 'credit\_report\_%' OR document_type LIKE 'isoftpull\_%'
                                                                               THEN '03-credit-bank'::case_file_phase
  WHEN document_type LIKE 'bank\_stmt\_%' OR document_type LIKE 'bank\_bal\_%' OR document_category LIKE '%bank%'
                                                                               THEN '03-credit-bank'::case_file_phase
  WHEN document_category LIKE 'schedule\_%' OR document_type LIKE 'sched\_%'   THEN '04-questionnaire'::case_file_phase
  WHEN document_category = 'means_test' OR document_type LIKE 'means\_%'       THEN '04-questionnaire'::case_file_phase
  WHEN document_category = 'tax_returns' OR document_type LIKE 'tax\_return\_%' THEN '04-questionnaire'::case_file_phase
  WHEN document_type LIKE 'retirement\_%'                                      THEN '04-questionnaire'::case_file_phase
  WHEN document_category LIKE '%pacer%'                                        THEN '06-pacer'::case_file_phase
  WHEN document_category LIKE '%341%' OR document_category LIKE '%trustee%'    THEN '07-trustee'::case_file_phase
  WHEN document_category LIKE '%court%'                                        THEN '08-court'::case_file_phase
  WHEN document_category LIKE '%discharge%'                                    THEN '10-discharge'::case_file_phase
  ELSE NULL
END
WHERE phase IS NULL;
