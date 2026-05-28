/*
  # Reset all staff_members.intake_pin to 7894 (demo)

  Bulk reset of every staff member's intake portal PIN to the shared value
  '7894' so the team can log in as any user on the demo deployment.

  Scope:
    - Every row in staff_members, regardless of is_active or intake_portal_role
    - Plaintext PIN (matches current schema — no hashing yet; see MAJ-* ticket)

  Idempotent: UPDATE sets every row to the same constant, so re-running is a no-op.
  Guarded so it fails loudly if the column has been removed/renamed since this
  was written.

  DO NOT RUN AGAINST PRODUCTION. Demo/staging Supabase project only.
*/

DO $$
DECLARE
  affected integer;
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'staff_members' AND column_name = 'intake_pin'
  ) THEN
    RAISE EXCEPTION 'staff_members.intake_pin column does not exist — refusing to run';
  END IF;

  UPDATE staff_members SET intake_pin = '7894';
  GET DIAGNOSTICS affected = ROW_COUNT;
  RAISE NOTICE 'Reset intake_pin to ''7894'' on % rows in staff_members', affected;
END $$;

-- Verification — run separately after applying:
-- SELECT count(*), intake_pin FROM staff_members GROUP BY intake_pin;
