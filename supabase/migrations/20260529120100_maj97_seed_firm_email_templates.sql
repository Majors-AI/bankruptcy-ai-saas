-- 20260529120100_maj97_seed_firm_email_templates.sql
-- Seeds the 10 V1.1 default templates for MLG + Neeley.
-- Idempotent: re-running will not duplicate or overwrite firm edits.

WITH target_firms AS (
  -- VERIFY: confirm these are the actual slugs in your firms table.
  SELECT id, slug FROM firms WHERE slug IN ('mlg', 'neeley')
),
defaults AS (
  SELECT * FROM (VALUES
    ('welcome_onboarding',
     'Welcome to {{firm_name}}',
     '<p>Hi {{client_first_name}},</p><p>Your case file with {{firm_name}} is now set up. You can access your secure portal here: <a href="{{portal_url}}">{{portal_url}}</a>.</p><p>We''ll let you know each time there''s a document to upload or a next step to complete.</p><p>— {{firm_name}}</p>',
     'Hi {{client_first_name}}, your case file with {{firm_name}} is set up. Access your secure portal: {{portal_url}}. We''ll notify you about documents and next steps. — {{firm_name}}'),

    ('welcome_onboarding_sms',
     'Welcome to {{firm_name}}',
     '{{firm_name}}: Hi {{client_first_name}}, your case portal is ready: {{portal_url}}',
     '{{firm_name}}: Hi {{client_first_name}}, your case portal is ready: {{portal_url}}'),

    ('doc_reminder_initial',
     'Documents needed for your case',
     '<p>Hi {{client_first_name}},</p><p>A few documents are still needed to keep your case moving:</p>{{document_list}}<p>You can upload them in your portal: <a href="{{portal_url}}">{{portal_url}}</a>.</p><p>— {{firm_name}}</p>',
     'Hi {{client_first_name}}, a few documents are still needed: {{document_list}}. Upload them here: {{portal_url}}. — {{firm_name}}'),

    ('doc_reminder_followup',
     'Reminder: documents still needed',
     '<p>Hi {{client_first_name}},</p><p>Following up — these documents are still outstanding:</p>{{document_list}}<p>Please upload them when you can: <a href="{{portal_url}}">{{portal_url}}</a>.</p><p>— {{firm_name}}</p>',
     'Hi {{client_first_name}}, following up on outstanding documents: {{document_list}}. Upload: {{portal_url}}. — {{firm_name}}'),

    ('doc_reminder_urgent',
     'Action needed: documents due {{deadline_date}}',
     '<p>Hi {{client_first_name}},</p><p>The following documents are needed by {{deadline_date}}:</p>{{document_list}}<p>Please upload them as soon as possible: <a href="{{portal_url}}">{{portal_url}}</a>. If you have any trouble, reply to this email and our team will help.</p><p>— {{firm_name}}</p>',
     'Hi {{client_first_name}}, documents are needed by {{deadline_date}}: {{document_list}}. Upload ASAP: {{portal_url}}. — {{firm_name}}'),

    ('doc_reminder_sms',
     'Document reminder',
     '{{firm_name}}: Hi {{client_first_name}}, you have documents still needed for your case. Upload: {{portal_url}}',
     '{{firm_name}}: Hi {{client_first_name}}, you have documents still needed for your case. Upload: {{portal_url}}'),

    ('questionnaire_incomplete',
     'Finish your questionnaire when you''re ready',
     '<p>Hi {{client_first_name}},</p><p>It looks like your questionnaire was started but not finished. You can pick up right where you left off here: <a href="{{portal_url}}">{{portal_url}}</a>.</p><p>— {{firm_name}}</p>',
     'Hi {{client_first_name}}, your questionnaire is unfinished. Pick up where you left off: {{portal_url}}. — {{firm_name}}'),

    ('plaid_connection_failed',
     'Your bank connection didn''t complete',
     '<p>Hi {{client_first_name}},</p><p>The connection to your bank or payroll didn''t finish. You can try again from your portal: <a href="{{portal_url}}">{{portal_url}}</a>. If it keeps failing, reply here and we''ll help you upload the documents manually instead.</p><p>— {{firm_name}}</p>',
     'Hi {{client_first_name}}, your bank/payroll connection didn''t complete. Try again: {{portal_url}}, or reply for help. — {{firm_name}}'),

    ('case_status_update',
     'Update on your case',
     '<p>Hi {{client_first_name}},</p><p>Here''s the latest on your case: {{case_status}}</p><p>You can view details anytime in your portal: <a href="{{portal_url}}">{{portal_url}}</a>.</p><p>— {{firm_name}}</p>',
     'Hi {{client_first_name}}, update on your case: {{case_status}}. Details: {{portal_url}}. — {{firm_name}}'),

    ('trustee_submission_confirmation',
     'Your documents have been submitted',
     '<p>Hi {{client_first_name}},</p><p>Your documents have been submitted to the trustee{{trustee_name}}. No action is needed from you right now — we''ll be in touch with any next steps.</p><p>— {{firm_name}}</p>',
     'Hi {{client_first_name}}, your documents have been submitted to the trustee. No action needed right now. — {{firm_name}}')
  ) AS t(template_key, subject, body_html, body_text)
)
INSERT INTO firm_email_templates (firm_id, template_key, subject, body_html, body_text, is_active)
SELECT f.id, d.template_key, d.subject, d.body_html, d.body_text, true
FROM target_firms f
CROSS JOIN defaults d
ON CONFLICT (firm_id, template_key) DO NOTHING;
