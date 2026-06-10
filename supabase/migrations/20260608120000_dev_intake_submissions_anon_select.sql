/*
  # DEV RLS patch — intake_submissions SELECT (anon + authenticated)

  ⚠  DEV-ONLY — replace with per-firm / per-user predicate before launch  ⚠

  ─── Why this migration exists ─────────────────────────────────────────────
  The original `intake_submissions` table migration
  (20260503213501_create_intake_submissions_table.sql) granted ONLY a
  permissive INSERT policy to the `anon` role. The inline comment there
  reads "Staff access is handled via service role key — no authenticated
  user policy needed here" — which turned out to be wrong: the live
  front-end uses the ANON key, not the service role, so SELECT against
  `intake_submissions` returns zero rows even when the data is present.

  This drift was caught in production-ish behavior:
    • Lead-detail "Review Intake" + the consolidated attorney-review
      "All Answers" tab both rendered "No questionnaire submission found"
      even when a row existed.
    • The Eligibility / Summary tab's Assets / Income / Expenses panel
      read $0 across the board (form_data never reached the client).
    • The § 707(b) means-test BUSINESS-DEBT EXCEPTION never fired —
      calcDebtComposition() was called with an empty fd, so business
      debt computed as 0% and the recommender fell back to Chapter 13
      for above-median cases that were actually primarily-business-debt.

  A loose dev policy was applied via the Supabase dashboard while
  debugging. This migration brings the same policy into source control
  so the next environment build doesn't reproduce the drift.

  ─── Why dev-open (no firm scope) ──────────────────────────────────────────
  intake_submissions has NO firm_id column today; only `clients` and
  `client_registrations` carry firm_id. The V1 default firm UUID
  '00000000-0000-0000-0000-000000000001' referenced in
  LegalAdminPortal.V1_DEFAULT_FIRM_ID is NOT on this row, so a
  firm-scoped predicate is not yet possible here without a schema
  change. Until that lands, the policy is intentionally wide open.

  ─── ⚠ BEFORE LAUNCH — REPLACE THIS POLICY ⚠ ──────────────────────────────
  This grants every anon/authenticated session read access to EVERY
  intake_submissions row in the database. Acceptable for the dev pilot
  with one firm and seed-only data. NOT acceptable once real client
  submissions land. Replacement options, in increasing order of work:

    1.  Add `firm_id uuid REFERENCES firms(id)` to intake_submissions and
        backfill from the linked lead's firm_id. Then change the policy
        USING clause to
          (firm_id = current_setting('app.firm_id', true)::uuid)
        OR equivalent JWT-claim lookup, and have the front-end set
        app.firm_id per session.

    2.  Join through `intake_leads` (which can be firm-scoped) — for
        authenticated users only:
          USING (
            lead_id IN (
              SELECT id FROM intake_leads
              WHERE firm_id = (auth.jwt() ->> 'firm_id')::uuid
            )
          )

    3.  Restrict to authenticated staff_members rows (when staff_members
        gets a firm_id column wired):
          USING (
            EXISTS (
              SELECT 1 FROM staff_members s
              WHERE s.id = auth.uid()
                AND s.firm_id = (
                  SELECT firm_id FROM intake_leads WHERE id = lead_id
                )
            )
          )

  ─── Scope ─────────────────────────────────────────────────────────────────
  SELECT only. INSERT / UPDATE / DELETE policies on intake_submissions
  are intentionally untouched here. The pre-existing
  "Anyone can submit an intake form" INSERT policy from
  20260503213501_create_intake_submissions_table.sql continues to govern
  writes; no policy currently exists for UPDATE or DELETE so anon cannot
  mutate, which is correct for the public-form scenario.
*/

-- Defense-in-depth: ensure RLS is on. The creating migration already
-- enabled it; idempotent so re-running this migration is safe.
ALTER TABLE intake_submissions ENABLE ROW LEVEL SECURITY;

-- ─── DEV anon SELECT ────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "DEV anon select intake_submissions" ON intake_submissions;
CREATE POLICY "DEV anon select intake_submissions"
  ON intake_submissions
  FOR SELECT
  TO anon
  USING (true);

-- ─── DEV authenticated SELECT ──────────────────────────────────────────────
-- Same coverage for the `authenticated` role so the policy keeps working
-- after Supabase Auth is wired and the front-end stops using the anon key.
DROP POLICY IF EXISTS "DEV authenticated select intake_submissions" ON intake_submissions;
CREATE POLICY "DEV authenticated select intake_submissions"
  ON intake_submissions
  FOR SELECT
  TO authenticated
  USING (true);
