/*
  ╔══════════════════════════════════════════════════════════════════════════╗
  ║  DEV-ONLY RLS PATCH — intake_submissions SELECT                          ║
  ║  ⚠  DO NOT SHIP TO PROD AS-IS  ⚠                                          ║
  ╚══════════════════════════════════════════════════════════════════════════╝

  Run path: paste into Supabase Dashboard → SQL Editor → Run.

  ─── Why this exists ───────────────────────────────────────────────────────
  The original `intake_submissions` table migration
  (20260503213501_create_intake_submissions_table.sql) granted ONLY a
  permissive INSERT policy to the `anon` role with the inline comment
  "Staff access is handled via service role key — no authenticated user
  policy needed here." The live front-end uses the ANON key (not service
  role), so SELECT against `intake_submissions` returns zero rows for the
  app even when the data is present — RLS doesn't raise an error on read,
  it just hides rows.

  Downstream impact when SELECT is blocked:
    • Lead-detail "Review Intake" + the consolidated attorney-review
      "All Answers" tab both show "No questionnaire submission found" even
      when a row exists.
    • The Eligibility / Summary tab's Assets / Income / Expenses panel
      reads $0 across the board (form_data never reaches the client).
    • The § 707(b) means-test BUSINESS-DEBT EXCEPTION never fires —
      calcDebtComposition(fd, …) is called with an empty fd, so business
      debt computes as 0% and the recommender falls back to Chapter 13
      for above-median cases that are actually primarily-business-debt
      (Mickey Rourke seed reproduces this exactly).

  `intake_leads` is fine — that table already has an anon SELECT policy
  applied elsewhere, which is why CMI / median / status / timestamps load
  but form_data does not. This patch closes the drift.

  ─── Schema decision: dev-open, NOT firm-scoped ────────────────────────────
  I checked the `intake_submissions` schema across every migration in
  supabase/migrations/. It does NOT have a `firm_id` column (only
  `clients` and `client_registrations` carry firm_id today). So this
  policy is intentionally a wide-open dev SELECT — there is no firm-scope
  predicate available without a schema change. The V1 default firm UUID
  '00000000-0000-0000-0000-000000000001' is referenced in the front-end
  (LegalAdminPortal.V1_DEFAULT_FIRM_ID) but NOT on this row, so we can't
  filter on it here.

  ─── DEV-ONLY policy ───────────────────────────────────────────────────────
  Scope: SELECT only. Roles: anon + authenticated (the latter is included
  so the policy keeps working once Supabase Auth is wired and the
  front-end migrates off the anon key).

  Policy name is intentionally prefixed "DEV " so it stands out in
  Supabase Dashboard → Authentication → Policies. The policy is idempotent
  (DROP IF EXISTS + CREATE) so re-running the script is safe.

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
              WHERE firm_id = auth.jwt() ->> 'firm_id'
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

  Until ONE of those lands, this DEV policy stays open.

  TODO BEFORE LAUNCH — replace the two `CREATE POLICY` statements below
  with a per-firm / per-user predicate. The DROP statements at the top
  will idempotently uninstall the dev policy when the prod policy goes
  in under a different name.

  ─── What this patch does NOT touch ────────────────────────────────────────
  This file is SELECT-only. INSERT / UPDATE / DELETE policies on
  intake_submissions are intentionally unchanged. The pre-existing
  "Anyone can submit an intake form" INSERT policy (created by
  20260503213501) continues to govern writes; no policy currently exists
  for UPDATE or DELETE (which means anon cannot mutate, which is correct
  for the public-form scenario).
*/

-- Defense-in-depth: ensure RLS is on. The creating migration already
-- enabled it; this is idempotent so re-running is safe.
ALTER TABLE intake_submissions ENABLE ROW LEVEL SECURITY;

-- ─── DEV anon SELECT ────────────────────────────────────────────────────────
-- Drops the policy first so re-running this script picks up any edits.
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

-- Quick verification — paste-after-run sanity check.
-- Returns the two new policies + whatever was already there (you should
-- see "Anyone can submit an intake form" for INSERT and the two new DEV
-- SELECT entries above).
SELECT polname, polcmd, polroles::regrole[] AS roles
FROM   pg_policy
WHERE  polrelid = 'intake_submissions'::regclass
ORDER  BY polname;
