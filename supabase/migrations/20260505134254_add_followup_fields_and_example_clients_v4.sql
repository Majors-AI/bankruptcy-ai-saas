/*
  # Add follow-up tracking fields and seed example clients (v4)

  Fixes: aligns item status to existing constraint (needed/uploaded/approved/waived/rejected)
  and request status to open/in_review/complete/closed.
*/

-- ── Fix request status constraint ───────────────────────────────────────────

ALTER TABLE trustee_document_requests
  DROP CONSTRAINT IF EXISTS trustee_document_requests_status_check;

ALTER TABLE trustee_document_requests
  ADD CONSTRAINT trustee_document_requests_status_check
  CHECK (status IN ('open','in_review','complete','closed'));

UPDATE trustee_document_requests SET status = 'open'      WHERE status = 'pending';
UPDATE trustee_document_requests SET status = 'in_review' WHERE status = 'in_progress';
UPDATE trustee_document_requests SET status = 'complete'  WHERE status IN ('approved','submitted');
UPDATE trustee_document_requests SET status = 'closed'    WHERE status = 'rejected';

-- ── Add columns to requests ──────────────────────────────────────────────────

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='trustee_document_requests' AND column_name='hearing_341_date') THEN
    ALTER TABLE trustee_document_requests ADD COLUMN hearing_341_date date;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='trustee_document_requests' AND column_name='doc_due_date') THEN
    ALTER TABLE trustee_document_requests ADD COLUMN doc_due_date date;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='trustee_document_requests' AND column_name='last_followup_at') THEN
    ALTER TABLE trustee_document_requests ADD COLUMN last_followup_at timestamptz;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='trustee_document_requests' AND column_name='last_followup_type') THEN
    ALTER TABLE trustee_document_requests ADD COLUMN last_followup_type text;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='trustee_document_requests' AND column_name='followup_count') THEN
    ALTER TABLE trustee_document_requests ADD COLUMN followup_count integer DEFAULT 0;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='trustee_document_requests' AND column_name='submitted_at') THEN
    ALTER TABLE trustee_document_requests ADD COLUMN submitted_at timestamptz;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='trustee_document_requests' AND column_name='client_email') THEN
    ALTER TABLE trustee_document_requests ADD COLUMN client_email text;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='trustee_document_requests' AND column_name='client_phone') THEN
    ALTER TABLE trustee_document_requests ADD COLUMN client_phone text;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='trustee_document_requests' AND column_name='auto_followup_enabled') THEN
    ALTER TABLE trustee_document_requests ADD COLUMN auto_followup_enabled boolean DEFAULT true;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='trustee_request_items' AND column_name='submitted_at') THEN
    ALTER TABLE trustee_request_items ADD COLUMN submitted_at timestamptz;
  END IF;
END $$;

-- ── Follow-up log ────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS trustee_followup_log (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  request_id     uuid NOT NULL REFERENCES trustee_document_requests(id) ON DELETE CASCADE,
  sent_at        timestamptz NOT NULL DEFAULT now(),
  followup_type  text NOT NULL DEFAULT 'manual',
  method         text NOT NULL DEFAULT 'email',
  message        text,
  sent_by        text,
  created_at     timestamptz DEFAULT now()
);

ALTER TABLE trustee_followup_log ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='trustee_followup_log' AND policyname='Anon users can read followup log') THEN
    EXECUTE 'CREATE POLICY "Anon users can read followup log" ON trustee_followup_log FOR SELECT TO anon USING (true)';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='trustee_followup_log' AND policyname='Authenticated users can insert followup log') THEN
    EXECUTE 'CREATE POLICY "Authenticated users can insert followup log" ON trustee_followup_log FOR INSERT TO authenticated WITH CHECK (true)';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='trustee_followup_log' AND policyname='Authenticated users can read followup log') THEN
    EXECUTE 'CREATE POLICY "Authenticated users can read followup log" ON trustee_followup_log FOR SELECT TO authenticated USING (true)';
  END IF;
END $$;

-- ── Seed clients (item status: needed/uploaded/approved/waived/rejected) ────

DO $$
DECLARE
  az_ch7_birdsell uuid := '5055951d-9230-4295-9e8f-d2d1f08a77da';
  az_ch13_brown   uuid := 'fd3eda85-c095-4538-80df-853f78c01ec3';
  wa_ch7_ellis    uuid := '9915ff3a-0cad-40b9-8006-6c2c4abb0457';
  wa_ch13_wilson  uuid := '4e49bf4e-430c-4c0b-b35a-fa77acea2ddf';
  r1 uuid; r2 uuid; r3 uuid; r4 uuid;
  r5 uuid; r6 uuid; r7 uuid; r8 uuid;
BEGIN

  -- AZ Ch7 — Margaret Torres (in_review, 2 docs needed, hearing +12d)
  INSERT INTO trustee_document_requests
    (trustee_id,client_id,client_name,client_email,client_phone,case_number,status,
     hearing_341_date,doc_due_date,submitted_at,last_followup_at,last_followup_type,
     followup_count,auto_followup_enabled,notes)
  VALUES (az_ch7_birdsell,gen_random_uuid(),'Margaret Torres',
    'margaret.torres@email.com','(602) 555-0142','2:26-bk-04821-DRB','in_review',
    (CURRENT_DATE+12),(CURRENT_DATE+2),(CURRENT_DATE-5)::timestamptz,
    (CURRENT_DATE-2)::timestamptz,'auto',3,true,
    'Client responsive. 2 docs still needed.')
  RETURNING id INTO r1;
  INSERT INTO trustee_request_items (request_id,document_name,required,status,submitted_at) VALUES
    (r1,'Last 2 years tax returns',true,'approved',(CURRENT_DATE-5)::timestamptz),
    (r1,'Last 6 months bank statements',true,'approved',(CURRENT_DATE-5)::timestamptz),
    (r1,'Most recent pay stubs (60 days)',true,'uploaded',(CURRENT_DATE-3)::timestamptz),
    (r1,'Photo ID / Driver''s License',true,'approved',(CURRENT_DATE-5)::timestamptz),
    (r1,'Social Security card or proof of SSN',true,'needed',null),
    (r1,'Vehicle title(s)',false,'needed',null),
    (r1,'Mortgage statement or lease agreement',true,'approved',(CURRENT_DATE-5)::timestamptz);
  INSERT INTO trustee_followup_log (request_id,sent_at,followup_type,method,message,sent_by) VALUES
    (r1,(CURRENT_DATE-8)::timestamptz,'auto','email','Automated reminder: 341 hearing in 20 days. Please upload remaining documents.','System'),
    (r1,(CURRENT_DATE-5)::timestamptz,'auto','email','Automated reminder: 341 hearing in 17 days. 5 of 7 documents received.','System'),
    (r1,(CURRENT_DATE-2)::timestamptz,'manual','phone','Spoke with client — will upload SSN card tomorrow. Vehicle title waived by trustee.','Sarah K.');

  -- AZ Ch7 — Robert Chen (open/overdue, not responding, hearing +6d)
  INSERT INTO trustee_document_requests
    (trustee_id,client_id,client_name,client_email,client_phone,case_number,status,
     hearing_341_date,doc_due_date,last_followup_at,last_followup_type,
     followup_count,auto_followup_enabled,notes)
  VALUES (az_ch7_birdsell,gen_random_uuid(),'Robert Chen',
    'r.chen.bk@gmail.com','(480) 555-0287','2:26-bk-03994-DRB','open',
    (CURRENT_DATE+6),(CURRENT_DATE-4),
    (CURRENT_DATE-1)::timestamptz,'auto',5,true,
    'URGENT: Docs overdue 4 days. Client not responding.')
  RETURNING id INTO r2;
  INSERT INTO trustee_request_items (request_id,document_name,required,status) VALUES
    (r2,'Last 2 years tax returns',true,'needed'),
    (r2,'Last 6 months bank statements',true,'uploaded'),
    (r2,'Most recent pay stubs (60 days)',true,'needed'),
    (r2,'Photo ID / Driver''s License',true,'uploaded'),
    (r2,'Social Security card or proof of SSN',true,'needed'),
    (r2,'Vehicle title(s)',false,'needed'),
    (r2,'Mortgage statement or lease agreement',true,'needed');
  INSERT INTO trustee_followup_log (request_id,sent_at,followup_type,method,message,sent_by) VALUES
    (r2,(CURRENT_DATE-14)::timestamptz,'auto','email','Automated: 341 hearing in 20 days. Upload documents via client portal.','System'),
    (r2,(CURRENT_DATE-10)::timestamptz,'auto','email','Automated: 341 hearing in 16 days. Documents still needed.','System'),
    (r2,(CURRENT_DATE-7)::timestamptz,'manual','email','Manual outreach: hearing in 13 days. Please provide all documents or call the office.','James M.'),
    (r2,(CURRENT_DATE-4)::timestamptz,'auto','email','URGENT: Documents due today. Please upload immediately.','System'),
    (r2,(CURRENT_DATE-1)::timestamptz,'auto','email','OVERDUE: Documents past due. 341 hearing in 7 days.','System');

  -- AZ Ch13 — Sandra Williams (complete, hearing +21d)
  INSERT INTO trustee_document_requests
    (trustee_id,client_id,client_name,client_email,client_phone,case_number,status,
     hearing_341_date,doc_due_date,submitted_at,last_followup_at,last_followup_type,
     followup_count,auto_followup_enabled,notes)
  VALUES (az_ch13_brown,gen_random_uuid(),'Sandra Williams',
    'sandraw@email.com','(623) 555-0341','2:26-bk-02187-RB','complete',
    (CURRENT_DATE+21),(CURRENT_DATE+11),(CURRENT_DATE-3)::timestamptz,
    (CURRENT_DATE-9)::timestamptz,'auto',1,true,
    'All documents received and reviewed. Ready for 341.')
  RETURNING id INTO r3;
  INSERT INTO trustee_request_items (request_id,document_name,required,status,submitted_at) VALUES
    (r3,'Last 4 years tax returns',true,'approved',(CURRENT_DATE-12)::timestamptz),
    (r3,'Last 6 months bank statements (all accounts)',true,'approved',(CURRENT_DATE-10)::timestamptz),
    (r3,'Last 60 days pay stubs',true,'approved',(CURRENT_DATE-10)::timestamptz),
    (r3,'Photo ID',true,'approved',(CURRENT_DATE-12)::timestamptz),
    (r3,'Social Security card',true,'approved',(CURRENT_DATE-12)::timestamptz),
    (r3,'Proof of current income (all sources)',true,'approved',(CURRENT_DATE-8)::timestamptz),
    (r3,'Monthly expense documentation',true,'approved',(CURRENT_DATE-8)::timestamptz),
    (r3,'Mortgage statements / lease',true,'approved',(CURRENT_DATE-10)::timestamptz);
  INSERT INTO trustee_followup_log (request_id,sent_at,followup_type,method,message,sent_by) VALUES
    (r3,(CURRENT_DATE-9)::timestamptz,'auto','email','Automated reminder: 341 hearing in 30 days. Documents needed.','System');

  -- AZ Ch13 — James Kowalski (open, self-employed, hearing +18d)
  INSERT INTO trustee_document_requests
    (trustee_id,client_id,client_name,client_email,client_phone,case_number,status,
     hearing_341_date,doc_due_date,last_followup_at,last_followup_type,
     followup_count,auto_followup_enabled,notes)
  VALUES (az_ch13_brown,gen_random_uuid(),'James Kowalski',
    'jkowalski@email.com','(602) 555-0419','2:26-bk-05560-RB','open',
    (CURRENT_DATE+18),(CURRENT_DATE+8),
    (CURRENT_DATE-3)::timestamptz,'auto',2,true,
    'Missing income docs. Client self-employed — needs P&L statement.')
  RETURNING id INTO r4;
  INSERT INTO trustee_request_items (request_id,document_name,required,status,submitted_at) VALUES
    (r4,'Last 4 years tax returns',true,'uploaded',(CURRENT_DATE-4)::timestamptz),
    (r4,'Last 6 months bank statements (all accounts)',true,'approved',(CURRENT_DATE-6)::timestamptz),
    (r4,'Last 60 days pay stubs',true,'needed',null),
    (r4,'Photo ID',true,'approved',(CURRENT_DATE-6)::timestamptz),
    (r4,'Social Security card',true,'approved',(CURRENT_DATE-6)::timestamptz),
    (r4,'Proof of current income (all sources)',true,'needed',null),
    (r4,'Monthly expense documentation',true,'needed',null),
    (r4,'Profit & Loss statement (self-employed)',true,'needed',null);
  INSERT INTO trustee_followup_log (request_id,sent_at,followup_type,method,message,sent_by) VALUES
    (r4,(CURRENT_DATE-10)::timestamptz,'auto','email','Automated: 341 in 28 days. Please upload all required documents.','System'),
    (r4,(CURRENT_DATE-3)::timestamptz,'auto','email','Automated: 341 in 21 days. 3 of 8 docs received — income documentation still needed.','System');

  -- WA Ch7 — Patricia Nguyen (in_review, vehicle title missing, hearing +9d)
  INSERT INTO trustee_document_requests
    (trustee_id,client_id,client_name,client_email,client_phone,case_number,status,
     hearing_341_date,doc_due_date,submitted_at,last_followup_at,last_followup_type,
     followup_count,auto_followup_enabled,notes)
  VALUES (wa_ch7_ellis,gen_random_uuid(),'Patricia Nguyen',
    'pat.nguyen@email.com','(206) 555-0173','2:26-bk-07134-KAE','in_review',
    (CURRENT_DATE+9),(CURRENT_DATE-1),(CURRENT_DATE-4)::timestamptz,
    (CURRENT_DATE-1)::timestamptz,'manual',4,true,
    'Missing vehicle title. Trustee may waive if no equity.')
  RETURNING id INTO r5;
  INSERT INTO trustee_request_items (request_id,document_name,required,status,submitted_at) VALUES
    (r5,'Last 2 years federal tax returns',true,'approved',(CURRENT_DATE-7)::timestamptz),
    (r5,'Last 6 months bank statements',true,'approved',(CURRENT_DATE-5)::timestamptz),
    (r5,'Last 60 days pay stubs',true,'approved',(CURRENT_DATE-5)::timestamptz),
    (r5,'Government-issued photo ID',true,'approved',(CURRENT_DATE-7)::timestamptz),
    (r5,'Social Security card',true,'approved',(CURRENT_DATE-7)::timestamptz),
    (r5,'Vehicle title(s)',true,'needed',null),
    (r5,'Real property deed / mortgage statement',true,'uploaded',(CURRENT_DATE-4)::timestamptz);
  INSERT INTO trustee_followup_log (request_id,sent_at,followup_type,method,message,sent_by) VALUES
    (r5,(CURRENT_DATE-12)::timestamptz,'auto','email','Automated: 341 hearing in 21 days. Submit documents through client portal.','System'),
    (r5,(CURRENT_DATE-8)::timestamptz,'auto','email','Automated: 341 hearing in 17 days. 5 of 7 documents received.','System'),
    (r5,(CURRENT_DATE-4)::timestamptz,'auto','email','URGENT: Documents due in 3 days. Vehicle title still missing.','System'),
    (r5,(CURRENT_DATE-1)::timestamptz,'manual','phone','Called client. Searching for title — will bring to hearing if not found sooner.','Lisa R.');

  -- WA Ch7 — David Okonkwo (new filing, hearing +35d)
  INSERT INTO trustee_document_requests
    (trustee_id,client_id,client_name,client_email,client_phone,case_number,status,
     hearing_341_date,doc_due_date,last_followup_at,last_followup_type,
     followup_count,auto_followup_enabled,notes)
  VALUES (wa_ch7_ellis,gen_random_uuid(),'David Okonkwo',
    'd.okonkwo@email.com','(425) 555-0261','2:26-bk-08902-KAE','open',
    (CURRENT_DATE+35),(CURRENT_DATE+25),
    (CURRENT_DATE-1)::timestamptz,'auto',1,true,
    'New filing. Initial intake docs checklist sent.')
  RETURNING id INTO r6;
  INSERT INTO trustee_request_items (request_id,document_name,required,status) VALUES
    (r6,'Last 2 years federal tax returns',true,'needed'),
    (r6,'Last 6 months bank statements',true,'needed'),
    (r6,'Last 60 days pay stubs',true,'needed'),
    (r6,'Government-issued photo ID',true,'needed'),
    (r6,'Social Security card',true,'needed'),
    (r6,'Vehicle title(s)',false,'needed'),
    (r6,'Real property deed / mortgage statement',false,'needed');
  INSERT INTO trustee_followup_log (request_id,sent_at,followup_type,method,message,sent_by) VALUES
    (r6,(CURRENT_DATE-1)::timestamptz,'auto','email','Welcome email: 341 hearing scheduled. Document checklist sent to client portal.','System');

  -- WA Ch13 — Maria Santos (complete, hearing +14d)
  INSERT INTO trustee_document_requests
    (trustee_id,client_id,client_name,client_email,client_phone,case_number,status,
     hearing_341_date,doc_due_date,submitted_at,last_followup_at,last_followup_type,
     followup_count,auto_followup_enabled,notes)
  VALUES (wa_ch13_wilson,gen_random_uuid(),'Maria Santos',
    'maria.santos@email.com','(253) 555-0388','2:26-bk-06215-JWA','complete',
    (CURRENT_DATE+14),(CURRENT_DATE+4),(CURRENT_DATE-6)::timestamptz,
    (CURRENT_DATE-8)::timestamptz,'auto',2,false,
    'All documents approved. Auto follow-ups disabled.')
  RETURNING id INTO r7;
  INSERT INTO trustee_request_items (request_id,document_name,required,status,submitted_at) VALUES
    (r7,'Last 4 years tax returns',true,'approved',(CURRENT_DATE-14)::timestamptz),
    (r7,'Last 6 months bank statements',true,'approved',(CURRENT_DATE-12)::timestamptz),
    (r7,'Pay stubs — all employers (60 days)',true,'approved',(CURRENT_DATE-10)::timestamptz),
    (r7,'Photo ID',true,'approved',(CURRENT_DATE-14)::timestamptz),
    (r7,'Social Security card',true,'approved',(CURRENT_DATE-14)::timestamptz),
    (r7,'Proof of all income sources',true,'approved',(CURRENT_DATE-8)::timestamptz),
    (r7,'Monthly budget / expense schedule',true,'approved',(CURRENT_DATE-8)::timestamptz);
  INSERT INTO trustee_followup_log (request_id,sent_at,followup_type,method,message,sent_by) VALUES
    (r7,(CURRENT_DATE-16)::timestamptz,'auto','email','Automated: 341 in 30 days. Document checklist sent.','System'),
    (r7,(CURRENT_DATE-8)::timestamptz,'auto','email','Automated: 341 in 22 days. 4 of 7 docs received — please complete submission.','System');

  -- WA Ch13 — Kevin Park (open, rejected doc, hearing +16d)
  INSERT INTO trustee_document_requests
    (trustee_id,client_id,client_name,client_email,client_phone,case_number,status,
     hearing_341_date,doc_due_date,last_followup_at,last_followup_type,
     followup_count,auto_followup_enabled,notes)
  VALUES (wa_ch13_wilson,gen_random_uuid(),'Kevin Park',
    'kevin.park@email.com','(206) 555-0522','2:26-bk-05877-JWA','open',
    (CURRENT_DATE+16),(CURRENT_DATE+6),
    (CURRENT_DATE-2)::timestamptz,'manual',3,true,
    'Tax return rejected — illegible scan. Client resubmitting. Pay stubs missing.')
  RETURNING id INTO r8;
  INSERT INTO trustee_request_items (request_id,document_name,required,status,submitted_at) VALUES
    (r8,'Last 4 years tax returns',true,'rejected',(CURRENT_DATE-6)::timestamptz),
    (r8,'Last 6 months bank statements',true,'approved',(CURRENT_DATE-8)::timestamptz),
    (r8,'Pay stubs — all employers (60 days)',true,'needed',null),
    (r8,'Photo ID',true,'approved',(CURRENT_DATE-8)::timestamptz),
    (r8,'Social Security card',true,'approved',(CURRENT_DATE-8)::timestamptz),
    (r8,'Proof of all income sources',true,'needed',null),
    (r8,'Monthly budget / expense schedule',true,'uploaded',(CURRENT_DATE-3)::timestamptz);
  INSERT INTO trustee_followup_log (request_id,sent_at,followup_type,method,message,sent_by) VALUES
    (r8,(CURRENT_DATE-12)::timestamptz,'auto','email','Automated: 341 in 28 days. Document checklist sent to portal.','System'),
    (r8,(CURRENT_DATE-6)::timestamptz,'auto','email','Automated: 341 in 22 days. 2 of 7 docs received.','System'),
    (r8,(CURRENT_DATE-2)::timestamptz,'manual','email','Manual: Tax return rejected (illegible). Please resubmit clear scan. Pay stubs urgent.','James M.');

END $$;
