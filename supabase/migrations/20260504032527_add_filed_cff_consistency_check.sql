/*
  # Add filed case CFF consistency enforcement

  ## Problem
  A client can have status = 'filed' in accounting_clients but cff_paid = false
  in accounting_fee_structures. This is logically impossible — a case cannot be
  filed without the court filing fee being paid.

  ## Changes
  - Adds a trigger on accounting_clients that automatically marks cff_paid = true
    and approved_for_signing = true whenever a client's status is set to 'filed'
  - This ensures data consistency going forward and prevents the UI from showing
    contradictory states

  ## Notes
  - Safe: only fires on UPDATE when status transitions TO 'filed'
  - Does not affect existing rows (already fixed via direct update)
*/

CREATE OR REPLACE FUNCTION sync_filed_cff()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.status = 'filed' AND (OLD.status IS DISTINCT FROM 'filed') THEN
    UPDATE accounting_fee_structures
    SET
      cff_paid            = true,
      cff_paid_at         = COALESCE(cff_paid_at, now()),
      approved_for_signing = true,
      updated_at          = now()
    WHERE client_id = NEW.id
      AND (cff_paid = false OR approved_for_signing = false);
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_filed_cff_sync ON accounting_clients;

CREATE TRIGGER trg_filed_cff_sync
AFTER UPDATE OF status ON accounting_clients
FOR EACH ROW
EXECUTE FUNCTION sync_filed_cff();
