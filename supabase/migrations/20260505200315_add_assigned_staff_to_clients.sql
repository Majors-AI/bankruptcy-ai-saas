/*
  # Add assigned attorney and paralegal to accounting_clients

  1. Changes
    - Add `assigned_attorney` (text) column — name of the attorney handling the case
    - Add `assigned_paralegal` (text) column — name of the paralegal assigned

  2. Seed
    - Assign real staff names from firm_staff to the existing demo/fake clients
      so the billing time-log display shows meaningful staff data
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'accounting_clients' AND column_name = 'assigned_attorney'
  ) THEN
    ALTER TABLE accounting_clients ADD COLUMN assigned_attorney text;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'accounting_clients' AND column_name = 'assigned_paralegal'
  ) THEN
    ALTER TABLE accounting_clients ADD COLUMN assigned_paralegal text;
  END IF;
END $$;

-- Assign staff to all clients (distribute across available attorneys/paralegals)
UPDATE accounting_clients SET
  assigned_attorney  = 'James Thompson',
  assigned_paralegal = 'Maria Garcia'
WHERE full_name IN ('Sandra Reyes', 'Marcus Webb', 'Derek Okafor', 'Dominic Majors', 'Lisa Demo Client');

UPDATE accounting_clients SET
  assigned_attorney  = 'James Thompson',
  assigned_paralegal = 'Sarah Lee'
WHERE full_name IN ('Patricia Nguyen', 'Patricia A. Nguyen', 'Robert H. Mendez', 'Marcus T. Williams', 'Angela F. Rivera');

UPDATE accounting_clients SET
  assigned_attorney  = 'James Thompson',
  assigned_paralegal = 'Maria Garcia'
WHERE full_name IN ('Janet Morales', 'Sandra J. Patel', 'Thomas B. Chen', 'Lisa M. Thompson');

UPDATE accounting_clients SET
  assigned_attorney  = 'James Thompson',
  assigned_paralegal = 'Sarah Lee'
WHERE full_name IN ('James R. Walker', 'David K. Okafor', 'Maria G. Santos', 'Mickey Mouse (Minnie Mouse – Non-Filing Spouse)');
