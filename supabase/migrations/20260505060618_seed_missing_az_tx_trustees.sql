/*
  # Add missing AZ and TX bankruptcy trustees

  1. New Records
    - Arizona Ch7: Jill H. Ford, Maureen Gaughan, Trudy A. Nowak
    - Texas Ch7: James W. Cunningham, Harvey L. Morton, Diane G. Reed, Jeffrey H. Mims
    - Updates Lawrence J. Warfield (AZ) to inactive per Nov 2024 UST panel status

  2. Notes
    - Uses DO block to avoid duplicate inserts (checks by name + state + chapter)
    - All new trustees are active panel members as of research date May 2026
    - Warfield remains in DB but flagged inactive — no longer accepting new cases
*/

DO $$
DECLARE
  az_id   uuid := 'ac9ffc0a-f7e7-4c3a-a837-84dbd9b2ce5a';
  tx_id   uuid := '346d4b98-941f-418c-9e1a-0de9ea8a3584';
  ch7_id  uuid := '37eaf11a-180e-44c3-b594-7c495a7b499b';
BEGIN

  -- ── AZ Ch7 missing trustees ─────────────────────────────────────────────────

  IF NOT EXISTS (SELECT 1 FROM trustees WHERE name = 'Jill H. Ford' AND state_id = az_id AND chapter_type_id = ch7_id) THEN
    INSERT INTO trustees (name, phone, email, state_id, chapter_type_id, district, notes, active)
    VALUES ('Jill H. Ford', NULL, NULL, az_id, ch7_id, 'District of Arizona', 'P.O. Box 5845, Carefree, AZ 85377', true);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM trustees WHERE name = 'Maureen Gaughan' AND state_id = az_id AND chapter_type_id = ch7_id) THEN
    INSERT INTO trustees (name, phone, email, state_id, chapter_type_id, district, notes, active)
    VALUES ('Maureen Gaughan', NULL, NULL, az_id, ch7_id, 'District of Arizona', 'P.O. Box 6729, Chandler, AZ 85246', true);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM trustees WHERE name = 'Trudy A. Nowak' AND state_id = az_id AND chapter_type_id = ch7_id) THEN
    INSERT INTO trustees (name, phone, email, state_id, chapter_type_id, district, notes, active)
    VALUES ('Trudy A. Nowak', NULL, NULL, az_id, ch7_id, 'District of Arizona', '8050 N. 19th Avenue, PMB 618, Phoenix, AZ 85021', true);
  END IF;

  -- Mark Warfield inactive (no longer accepting new cases per Nov 2024 UST panel)
  UPDATE trustees SET active = false
  WHERE name = 'Lawrence J. Warfield' AND state_id = az_id AND chapter_type_id = ch7_id;

  -- ── TX Ch7 missing trustees ─────────────────────────────────────────────────

  IF NOT EXISTS (SELECT 1 FROM trustees WHERE name = 'James W. Cunningham' AND state_id = tx_id AND chapter_type_id = ch7_id) THEN
    INSERT INTO trustees (name, phone, email, state_id, chapter_type_id, district, notes, active)
    VALUES ('James W. Cunningham', '(214) 827-9112', NULL, tx_id, ch7_id, 'Northern District of Texas', 'Dallas Division', true);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM trustees WHERE name = 'Harvey L. Morton' AND state_id = tx_id AND chapter_type_id = ch7_id) THEN
    INSERT INTO trustees (name, phone, email, state_id, chapter_type_id, district, notes, active)
    VALUES ('Harvey L. Morton', '(806) 762-0570', NULL, tx_id, ch7_id, 'Northern District of Texas — Lubbock', '3403 73rd Street, Suite 11, Lubbock, TX 79464', true);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM trustees WHERE name = 'Diane G. Reed' AND state_id = tx_id AND chapter_type_id = ch7_id) THEN
    INSERT INTO trustees (name, phone, email, state_id, chapter_type_id, district, notes, active)
    VALUES ('Diane G. Reed', '(972) 938-7334', NULL, tx_id, ch7_id, 'Northern District of Texas', 'Dallas Division', true);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM trustees WHERE name = 'Jeffrey H. Mims' AND state_id = tx_id AND chapter_type_id = ch7_id) THEN
    INSERT INTO trustees (name, phone, email, state_id, chapter_type_id, district, notes, active)
    VALUES ('Jeffrey H. Mims', '(214) 210-2913', 'jmims@mims-law.com', tx_id, ch7_id, 'Northern District of Texas', '900 Jackson Street, Suite 560, Dallas, TX 75202', true);
  END IF;

END $$;
