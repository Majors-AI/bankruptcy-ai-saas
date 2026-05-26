/*
  # Staff Productivity, Daily Task System, Behavior Tracking & Internal Communications

  ## New Tables

  ### daily_task_templates
  Pre-defined recurring daily tasks by role. These seed each staff member's day.
  - id, role, title, description, default_priority, estimated_minutes, is_active

  ### staff_daily_tasks
  Each staff member's assigned tasks for the day (generated from templates + client triggers).
  - id, staff_id, staff_name, staff_role, task_date, title, description, priority
  - source: template | client_request | manual | system
  - client_id, client_name (if triggered by client contact)
  - status: pending | in_progress | completed | skipped
  - due_time (time of day), completed_at, reminder_sent_at
  - estimated_minutes, actual_minutes, notes

  ### staff_reminders
  Scheduled reminders for staff tasks and events.
  - id, staff_id, staff_name, task_id (nullable), title, message
  - remind_at, channel (in_app | sms | email), sent, sent_at

  ### staff_behavior_notes
  System or superadmin-recorded behavior observations.
  - id, staff_id, staff_name, recorded_by (system | superadmin)
  - behavior_type: late_task | missed_reminder | quick_completion | high_volume | quality_flag | escalation | positive
  - description, severity: info | warning | positive
  - task_id (ref), week_of, created_at

  ### staff_improvement_suggestions
  Weekly AI/superadmin-generated suggestions per staff member.
  - id, staff_id, staff_name, week_of, suggestions (text[]), generated_by
  - acknowledged, acknowledged_at, created_at

  ### staff_messages
  Internal staff-to-staff and staff-to-client messages.
  - id, sender_id, sender_name, sender_role
  - recipient_type: staff | client
  - recipient_id, recipient_name
  - channel: email | sms | phone_note | dm
  - subject, body, attachments (text[])
  - read, read_at, created_at
  - thread_id (groups replies)

  ### staff_productivity_log
  Daily snapshot of each staff member's productivity.
  - id, staff_id, staff_name, log_date
  - tasks_assigned, tasks_completed, tasks_skipped, tasks_overdue
  - total_time_logged_minutes, avg_response_time_minutes
  - client_contacts_handled, notes, created_at
*/

-- ─── daily_task_templates ────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS daily_task_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  role text NOT NULL,
  title text NOT NULL,
  description text,
  default_priority text NOT NULL DEFAULT 'medium' CHECK (default_priority IN ('urgent', 'high', 'medium', 'low')),
  estimated_minutes int NOT NULL DEFAULT 30,
  due_offset_minutes int DEFAULT NULL,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE daily_task_templates ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anon read daily_task_templates" ON daily_task_templates FOR SELECT TO anon USING (true);
CREATE POLICY "Anon insert daily_task_templates" ON daily_task_templates FOR INSERT TO anon WITH CHECK (true);
CREATE POLICY "Anon update daily_task_templates" ON daily_task_templates FOR UPDATE TO anon USING (true) WITH CHECK (true);

-- ─── staff_daily_tasks ────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS staff_daily_tasks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  staff_id text NOT NULL,
  staff_name text NOT NULL,
  staff_role text NOT NULL DEFAULT 'staff',
  task_date date NOT NULL DEFAULT CURRENT_DATE,
  title text NOT NULL,
  description text,
  priority text NOT NULL DEFAULT 'medium' CHECK (priority IN ('urgent', 'high', 'medium', 'low')),
  source text NOT NULL DEFAULT 'manual' CHECK (source IN ('template', 'client_request', 'manual', 'system', 'superadmin')),
  client_id text,
  client_name text,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'in_progress', 'completed', 'skipped')),
  due_time time,
  completed_at timestamptz,
  reminder_sent_at timestamptz,
  estimated_minutes int NOT NULL DEFAULT 30,
  actual_minutes int,
  notes text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE staff_daily_tasks ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anon read staff_daily_tasks" ON staff_daily_tasks FOR SELECT TO anon USING (true);
CREATE POLICY "Anon insert staff_daily_tasks" ON staff_daily_tasks FOR INSERT TO anon WITH CHECK (true);
CREATE POLICY "Anon update staff_daily_tasks" ON staff_daily_tasks FOR UPDATE TO anon USING (true) WITH CHECK (true);

-- ─── staff_reminders ─────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS staff_reminders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  staff_id text NOT NULL,
  staff_name text NOT NULL,
  task_id uuid REFERENCES staff_daily_tasks(id) ON DELETE CASCADE,
  title text NOT NULL,
  message text,
  remind_at timestamptz NOT NULL,
  channel text NOT NULL DEFAULT 'in_app' CHECK (channel IN ('in_app', 'sms', 'email')),
  sent boolean NOT NULL DEFAULT false,
  sent_at timestamptz,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE staff_reminders ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anon read staff_reminders" ON staff_reminders FOR SELECT TO anon USING (true);
CREATE POLICY "Anon insert staff_reminders" ON staff_reminders FOR INSERT TO anon WITH CHECK (true);
CREATE POLICY "Anon update staff_reminders" ON staff_reminders FOR UPDATE TO anon USING (true) WITH CHECK (true);

-- ─── staff_behavior_notes ────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS staff_behavior_notes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  staff_id text NOT NULL,
  staff_name text NOT NULL,
  recorded_by text NOT NULL DEFAULT 'system',
  behavior_type text NOT NULL DEFAULT 'manual' CHECK (behavior_type IN (
    'late_task', 'missed_reminder', 'quick_completion', 'high_volume',
    'quality_flag', 'escalation', 'positive', 'manual', 'client_complaint', 'client_compliment'
  )),
  description text NOT NULL,
  severity text NOT NULL DEFAULT 'info' CHECK (severity IN ('info', 'warning', 'positive')),
  task_id uuid REFERENCES staff_daily_tasks(id) ON DELETE SET NULL,
  week_of date NOT NULL DEFAULT date_trunc('week', CURRENT_DATE)::date,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE staff_behavior_notes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anon read staff_behavior_notes" ON staff_behavior_notes FOR SELECT TO anon USING (true);
CREATE POLICY "Anon insert staff_behavior_notes" ON staff_behavior_notes FOR INSERT TO anon WITH CHECK (true);
CREATE POLICY "Anon update staff_behavior_notes" ON staff_behavior_notes FOR UPDATE TO anon USING (true) WITH CHECK (true);

-- ─── staff_improvement_suggestions ───────────────────────────────────────────

CREATE TABLE IF NOT EXISTS staff_improvement_suggestions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  staff_id text NOT NULL,
  staff_name text NOT NULL,
  week_of date NOT NULL DEFAULT date_trunc('week', CURRENT_DATE)::date,
  suggestions text[] NOT NULL DEFAULT '{}',
  generated_by text NOT NULL DEFAULT 'system',
  acknowledged boolean NOT NULL DEFAULT false,
  acknowledged_at timestamptz,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE staff_improvement_suggestions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anon read staff_improvement_suggestions" ON staff_improvement_suggestions FOR SELECT TO anon USING (true);
CREATE POLICY "Anon insert staff_improvement_suggestions" ON staff_improvement_suggestions FOR INSERT TO anon WITH CHECK (true);
CREATE POLICY "Anon update staff_improvement_suggestions" ON staff_improvement_suggestions FOR UPDATE TO anon USING (true) WITH CHECK (true);

-- ─── staff_messages ──────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS staff_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sender_id text NOT NULL,
  sender_name text NOT NULL,
  sender_role text,
  recipient_type text NOT NULL DEFAULT 'staff' CHECK (recipient_type IN ('staff', 'client', 'broadcast')),
  recipient_id text NOT NULL,
  recipient_name text NOT NULL,
  channel text NOT NULL DEFAULT 'dm' CHECK (channel IN ('email', 'sms', 'phone_note', 'dm')),
  subject text,
  body text NOT NULL,
  attachments text[] DEFAULT '{}',
  read boolean NOT NULL DEFAULT false,
  read_at timestamptz,
  thread_id text,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE staff_messages ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anon read staff_messages" ON staff_messages FOR SELECT TO anon USING (true);
CREATE POLICY "Anon insert staff_messages" ON staff_messages FOR INSERT TO anon WITH CHECK (true);
CREATE POLICY "Anon update staff_messages" ON staff_messages FOR UPDATE TO anon USING (true) WITH CHECK (true);

-- ─── staff_productivity_log ───────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS staff_productivity_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  staff_id text NOT NULL,
  staff_name text NOT NULL,
  log_date date NOT NULL DEFAULT CURRENT_DATE,
  tasks_assigned int NOT NULL DEFAULT 0,
  tasks_completed int NOT NULL DEFAULT 0,
  tasks_skipped int NOT NULL DEFAULT 0,
  tasks_overdue int NOT NULL DEFAULT 0,
  total_time_logged_minutes int NOT NULL DEFAULT 0,
  avg_response_time_minutes int,
  client_contacts_handled int NOT NULL DEFAULT 0,
  notes text,
  created_at timestamptz DEFAULT now(),
  UNIQUE(staff_id, log_date)
);

ALTER TABLE staff_productivity_log ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anon read staff_productivity_log" ON staff_productivity_log FOR SELECT TO anon USING (true);
CREATE POLICY "Anon insert staff_productivity_log" ON staff_productivity_log FOR INSERT TO anon WITH CHECK (true);
CREATE POLICY "Anon update staff_productivity_log" ON staff_productivity_log FOR UPDATE TO anon USING (true) WITH CHECK (true);

-- ─── Seed daily task templates ────────────────────────────────────────────────

INSERT INTO daily_task_templates (role, title, description, default_priority, estimated_minutes, due_offset_minutes) VALUES
  -- Legal Admin
  ('legal_admin', 'Review new intake submissions', 'Check overnight and morning intake form submissions, flag urgent cases', 'high', 30, 60),
  ('legal_admin', 'Process client documents', 'Review uploaded docs, verify completeness, request missing items', 'high', 45, 120),
  ('legal_admin', 'Follow up on outstanding document requests', 'Contact clients who have not submitted required documents', 'medium', 30, 180),
  ('legal_admin', 'Update client status notes', 'Log any status changes or client communications from today', 'medium', 20, 480),
  ('legal_admin', 'End-of-day file review', 'Confirm all pending tasks are actioned or escalated', 'medium', 15, 510),
  -- Paralegal
  ('paralegal', 'Morning case queue review', 'Review assigned cases needing paralegal review today', 'urgent', 30, 30),
  ('paralegal', 'Complete paralegal reviews', 'Finish any open paralegal review sessions in queue', 'high', 90, 180),
  ('paralegal', 'Verify creditor matrix', 'Check creditor addresses and amounts for accuracy on assigned cases', 'high', 45, 240),
  ('paralegal', 'Draft amendment flags', 'Flag any cases needing amendments based on paralegal findings', 'medium', 30, 300),
  ('paralegal', 'Update case workflow status', 'Mark completed paralegal reviews and advance workflow stages', 'medium', 15, 480),
  -- Attorney
  ('attorney', 'Review attorney queue', 'Check cases pending attorney review and sign-off', 'urgent', 15, 30),
  ('attorney', 'Complete attorney reviews', 'Review and approve or flag cases in attorney review queue', 'high', 60, 120),
  ('attorney', 'Check ECF notices', 'Review new ECF filings and deadlines, assign tasks as needed', 'high', 30, 60),
  ('attorney', 'Filing readiness check', 'Confirm pending cases in file-a-case queue meet all requirements', 'high', 20, 180),
  ('attorney', 'Hearing preparation', 'Review client files for upcoming 341 hearings', 'medium', 45, 240),
  -- Accounting Admin
  ('accounting_admin', 'Process payments', 'Apply incoming payments, update trust account balances', 'urgent', 30, 60),
  ('accounting_admin', 'Review autopay schedule', 'Check today autopay runs and flag any issues', 'high', 20, 90),
  ('accounting_admin', 'Reconcile IOLTA trust accounts', 'Verify trust account balances match case records', 'high', 45, 180),
  ('accounting_admin', 'Fee adjustment review', 'Review any pending fee adjustment requests', 'medium', 20, 300),
  ('accounting_admin', 'End-of-day accounting close', 'Reconcile daily transactions and prepare summary', 'medium', 30, 510);

-- ─── Seed example staff daily tasks for today ────────────────────────────────

INSERT INTO staff_daily_tasks (staff_id, staff_name, staff_role, task_date, title, description, priority, source, status, due_time, estimated_minutes)
VALUES
  ('STAFF-001', 'Linda Park', 'paralegal', CURRENT_DATE, 'Morning case queue review', 'Review assigned cases needing paralegal review', 'urgent', 'template', 'in_progress', '09:00', 30),
  ('STAFF-001', 'Linda Park', 'paralegal', CURRENT_DATE, 'Verify creditor matrix — Turner case', 'Check creditor addresses and amounts for Nancy Turner', 'high', 'manual', 'pending', '11:00', 45),
  ('STAFF-002', 'Carlos Reyes', 'legal_admin', CURRENT_DATE, 'Review new intake submissions', 'Check overnight intake form submissions', 'high', 'template', 'completed', '09:00', 30),
  ('STAFF-002', 'Carlos Reyes', 'legal_admin', CURRENT_DATE, 'Follow up with Adams on missing docs', 'Raymond Adams has not submitted pay stubs', 'high', 'client_request', 'pending', '14:00', 30),
  ('STAFF-003', 'Sarah Mitchell', 'attorney', CURRENT_DATE, 'Review attorney queue', 'Cases pending attorney review and sign-off', 'urgent', 'template', 'pending', '09:00', 15),
  ('STAFF-003', 'Sarah Mitchell', 'attorney', CURRENT_DATE, 'Check ECF notices', 'Motion for relief filed on Adams case — respond within 14 days', 'high', 'system', 'pending', '10:00', 30),
  ('STAFF-004', 'David Chen', 'attorney', CURRENT_DATE, 'Filing readiness check', 'Confirm Turner and Adams cases meet filing requirements', 'high', 'template', 'pending', '11:00', 20),
  ('STAFF-005', 'Maria Lopez', 'accounting_admin', CURRENT_DATE, 'Process payments', 'Apply 3 incoming autopay transactions', 'urgent', 'template', 'in_progress', '09:00', 30),
  ('STAFF-005', 'Maria Lopez', 'accounting_admin', CURRENT_DATE, 'Reconcile IOLTA trust accounts', 'Verify trust balances for Mitchell, Turner, and Adams', 'high', 'template', 'pending', '14:00', 45);
