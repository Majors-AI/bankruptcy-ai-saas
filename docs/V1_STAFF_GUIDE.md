# bankruptcy.ai V1 — Staff Quick-Start Guide

V1 is the **information gathering + document collection** layer that feeds Best Case. Best Case stays source of truth for filing documents, signing logistics, and the 341 deadline calendar until V2.

Two pilot firms are live:

- **Majors Law Group** (firm_id `00000000-0000-0000-0000-000000000001`)
- **Neeley Law Firm**  (firm_id `00000000-0000-0000-0000-000000000002`)

Both firms are comped during V1 and have the same V1 feature-flag profile (see [Feature flags in V1](#feature-flags-in-v1)).

---

## What V1 does

1. **Onboard already-accepted clients in ~90 seconds.** Attorney fills the **+ New Client** modal in the Intake Portal (Manual Clients tab). System generates a magic-link portal URL and sends it via email + SMS.
2. **Client completes the 17-section questionnaire** at their own pace through the magic-link portal. Save-and-return supported.
3. **Client connects bank + payroll via Plaid**, or manually uploads statements / paystubs / W-2s. Documents land in the FileCabinet's `03-credit-bank` phase.
4. **Firm staff manages trustees** and runs **manual trustee submissions** with selected documents from phase `07-trustee`.
5. **Firm staff generates a `.bci` test file** for any client, reviews the validation result, then imports it into Best Case 25.1.
6. **Firm staff downloads the full client file** as a phase-organized ZIP for trustee delivery, backup, or external review (24-hour signed link).

---

## What V1 does NOT do

- **No AI intake bot.** Leads must already be accepted; V1 starts at "+ New Client".
- **No iSoftpull credit pulls.** Dropped from V1. Manual credit report upload only.
- **No in-platform fee-agreement signing.** Firms collect the fee and sign retainers in their existing workflow before opening the bankruptcy.ai client.
- **No in-platform final document generation.** Petition, schedules, etc. are generated in Best Case from the imported BCI.
- **No in-platform signing scheduling.** Use Best Case calendar or your existing scheduling system.
- **No 341 deadline auto-calendaring.** Use Best Case's calendar — BAN-33 is deferred to Phase 5.
- **No billing engine.** Both firms are comped during V1; subscription billing is V1.1+.
- **No cloud sync** to Google Drive or Dropbox — V1.1.
- **No PDF fillable forms** in-platform — V1.1.

---

## 90-second client onboarding

1. Intake Portal → **Manual Clients** tab → **+ New Client**.
2. Section A — Case Basics: chapter (7/13), state (AZ default), county, filing type (individual / joint / individual_nfs).
3. Section B — Fee Paid: total fee paid in dollars, bifurcated checkbox (Ch.7 only).
4. Section C — Client Contact: first / last name, email, phone (all required).
5. Section D — Spouse Contact (shown only for joint / NFS).
6. Section E — Attorney Assignment: pick from the active attorneys in `staff_members`.
7. Click **Onboard Client + Send Link**. The system:
   - Inserts the `clients` row with `onboarding_source='manual'`, `status='registered'`, `case_status='accepted_fee_quoted'`.
   - Inserts the matching `case_acceptances` row (chapter + fee + bifurcated flag + accepted_by + decided_at).
   - Generates a 90-day magic-link token via `generateAccessToken()`.
   - Calls the `send-client-message` edge function once for the email (`v1_manual_onboarding_welcome` script) and once for the SMS (`v1_manual_onboarding_welcome_sms`).
   - Shows the final portal URL with a one-click **Copy** button.

If something goes wrong mid-onboard (e.g. case_acceptances insert fails), the client row is rolled back so the firm never has an orphan record.

---

## What clients see

When a client opens the magic-link URL:

1. **App.tsx** reads `?token=…`, calls `validateToken()`, and if valid + unexpired routes them to the `client_view` scoped to their client_id.
2. The **ClientDashboard** opens (the always-on portal landing page) with stage tracker, payment summary, and action cards.
3. **Plaid Connect** widget mounted above the credit-report import accordion offers two separate buttons:
   - **Connect Bank** — Plaid Link with `transactions` product, materializes a PDF statement per account into phase `03-credit-bank`.
   - **Connect Payroll** — Plaid Link with `income` product, materializes a per-employer income summary PDF into the same phase.
4. **Continue Questionnaire** button launches the 17-section questionnaire. Each completed section persists; the client can leave and return any time within the 90-day token window.
5. **My Documents** panel shows their registration / disclosure consents. **Update My Information** lets them report changes.

Invalid or expired tokens land on a small "Portal link unavailable" page; the URL param is cleared on consume so a refresh doesn't replay.

---

## BCI export — testing protocol

This is the linchpin of V1 acceptance. Every test cycle should be logged in [`docs/BCI_FIELD_GAPS.md`](BCI_FIELD_GAPS.md).

1. Open the client in the File Cabinet → **Documents** tab.
2. Scroll to **BCI Export Test** → **Generate BCI Test File**.
3. The validator modal shows:
   - **Populated count** (numerator vs. the V1 catalogue of 14 required + 4 optional fields + 3 schedule presence checks).
   - **Red list — blocking required gaps.** These will cause the Best Case import to fail or generate an incomplete case. Resolve in the questionnaire before final filing.
   - **Yellow list — optional warnings.** Best Case will accept missing values but the case detail will be sparser.
4. **Download .bci File** is enabled when there are zero blocking gaps. **Download Anyway** is the diagnostic override that lets you capture an incomplete file for testing.
5. The download:
   - Builds the BCI XML envelope.
   - Uploads to `bci-exports/{firm_id}/{client_id}/{ISO timestamp}.bci`.
   - Inserts a `bci_verification_logs` row (with the populated count + missing field arrays + file size).
   - Triggers a browser download.
6. Import the `.bci` into Best Case 25.1 (File → Import Case → select file).
7. Record the result in `docs/BCI_FIELD_GAPS.md` using the per-test template.

When gaps are discovered, add the field to either `REQUIRED_FIELDS` or `OPTIONAL_FIELDS` in [`src/lib/bciValidator.ts`](../src/lib/bciValidator.ts) and bump the validator change history note at the bottom of `BCI_FIELD_GAPS.md`.

---

## ZIP download — full client file

For trustee submissions, client file copies, or external review:

1. Open the client → **Documents** tab → **Download Full File**.
2. Generation takes 30–60 seconds. The button shows a spinner.
3. Browser download starts automatically when the ZIP is ready. Toast shows "ZIP exported. Available for 24 hours."
4. The ZIP layout:
   ```
   {client_name}_ch{chapter}_{YYYY-MM-DD}/
   ├── 01-intake/
   ├── 02-registration/
   ├── 03-credit-bank/
   ├── 04-questionnaire/
   ├── 05-attorney-review/
   ├── 06-pacer/
   ├── 07-trustee/
   ├── 08-court/
   ├── 09-correspondence/
   ├── 10-discharge/
   ├── bci-export.xml         (most recent .bci)
   ├── manifest.csv           (phase, document_type, filename, size, uploaded_at)
   └── README.txt             (summary + expiry note)
   ```
5. The signed URL expires 24 hours after generation; re-run **Download Full File** to issue a new one.
6. The `zip-export-cleanup-cron` edge function runs daily and removes ZIP objects whose `expires_at` has passed (the audit row stays; storage_path is nulled).

---

## Plaid consent flow

Bank and payroll are **two separate opt-ins**. The widget on the client portal makes this explicit. Each click:

1. POSTs to `plaid-link-token` with the appropriate `products` array (`['transactions']` or `['income']`).
2. Opens Plaid Link with the returned `link_token`.
3. On Plaid success → POSTs to `plaid-exchange-token` with the `public_token`, which stores the long-lived `access_token` in `plaid_items`.
4. Immediately POSTs to `plaid-fetch-bank-statements` (or `plaid-fetch-income`) to materialize PDFs into `client_documents` with `phase='03-credit-bank'`.

The PDF generator in V1 is intentionally minimal — single-page, Courier font, transaction list or paystub summary. V1.1 will swap in a formatted statement with running balance and a proper table.

Plaid env vars (set via `supabase secrets set …`):

- `PLAID_CLIENT_ID`
- `PLAID_SECRET` (sandbox initially; switch to production after Plaid approval)
- `PLAID_ENV` (`sandbox` | `development` | `production`)
- `PLAID_PRODUCTS` (informational; individual functions accept per-call products)

---

## Trustee management + manual submission

**Firm trustees are firm-managed.** Nothing is pre-seeded — even MLG starts with zero rows in `firm_trustees`.

### Adding a trustee

1. Trustee Document Portal → **Firm Trustees** tab → **+ Add Trustee**.
2. Fill: trustee name, district, division, submission method (email / portal_manual / portal_api / mail), and the method-specific field (email address or portal URL).
3. Optional: file naming convention + notes.

### Submitting documents

1. Open the client → **Documents** tab.
2. The **Trustee Submission** widget appears whenever the client has any documents in phase `07-trustee`.
3. Pick a trustee from the dropdown (only active trustees show).
4. All `07-trustee` documents are auto-selected; deselect any you don't want to include.
5. Optionally paste a confirmation receipt URL + notes.
6. **Mark as Submitted** writes to `trustee_submission_log` with the chosen trustee, method, timestamp, and the selected document UUIDs.

The submission history list under the widget shows every prior submission with status badges (submitted / acknowledged / rejected).

---

## Feature flags in V1

Both pilot firms have the same V1 profile after `20260528160000_v1_feature_flags.sql` runs.

### Enabled
- `client_portal`
- `questionnaire_full`
- `credit_report_manual_upload`
- `bank_statement_manual_upload`
- `bank_link_plaid`
- `payroll_link_plaid`
- `trustee_doc_portal`
- `pacer_email_ingestion`
- `best_case_export`

### Disabled (deferred to V2)
- `intake_bot` — drives the **Leads** tab visibility in LegalAdminPortal; hidden in V1.
- `intake_short_verification`
- `credit_report_isoftpull` — DROPPED, replaced by manual upload + Plaid.
- `liaison_agent`, `ai_petition_drafting`
- `attorney_metrics_dashboard`, `firm_metrics_dashboard`
- `cloud_sync_google_drive`, `cloud_sync_dropbox`
- `white_label_branding`, `chapter_11_subv`, `multi_state_practice`
- `trustee_auto_submission`
- `calendar_auto_assignment`, `calendar_sync` (BAN-33 deferred to Phase 5)
- `boldsign_esign` — fee agreements are signed in your existing process before the client enters bankruptcy.ai

Override a flag for a single firm by editing `firm_features.enabled` directly via the SuperAdminPage Features tab (Phase 2 stub view) or a SQL update. Every edit writes a `firm_features_history` row automatically.

---

## Reporting issues / feedback

- **Field gaps in BCI export** → append to [`docs/BCI_FIELD_GAPS.md`](BCI_FIELD_GAPS.md) with test details.
- **Bugs / behavior issues** → log under the BAN-54 epic in Linear.
- **Plaid connection errors** → check `plaid_items.last_sync_error` for the affected row; common cases are sandbox-credential mismatches and a brand-new Plaid item that hasn't run its first transaction sync yet.
- **Magic-link token issues** → tokens expire after 90 days; regenerate with `generateAccessToken(client.id)` and re-send via the **+ New Client** modal flow (or a manual call to `send-client-message`).

V1 is a pilot. The goal is to find every gap between bankruptcy.ai's questionnaire shape and what Best Case actually needs. Capture gaps loudly; the validator + the field-gap log are the source of truth for what V1.1 builds next.
