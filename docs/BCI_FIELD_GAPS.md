# BCI Field Gap Tracker

Populated during the V1 pilot as MLG and Neeley discover gaps between the
`bankruptcy.ai` questionnaire data tree and the Best Case 25.1 BCI import
contract.

This file is intentionally a working log — append as gaps are found, not a
formal spec. The validator in [`src/lib/bciValidator.ts`](../src/lib/bciValidator.ts)
is the runtime mirror; update both together.

## How to test BCI export

1. Onboard a test client via **+ New Client** in LegalAdminPortal (Manual Clients tab).
2. Complete the full 17-section questionnaire end-to-end as that client.
3. Back in the firm view: open the client → Documents tab → scroll to **BCI Export Test** → click **Generate BCI Test File**.
4. Review the verification modal:
   - "Populated" count
   - Red list — blocking required gaps (must resolve before final filing)
   - Yellow list — optional warnings (Best Case will accept missing values but the case detail will be sparser)
5. Click **Download .bci File** (or **Download Anyway** if the file is intentionally partial for diagnostics).
6. Open Best Case 25.1 → File → Import Case → select the downloaded `.bci`.
7. Note the result against the test case template below.

## Test cycles

### Test 1

- **Date:** YYYY-MM-DD
- **Firm:** MLG / Neeley
- **Client:** Test Client #1
- **Result:** [PASS | PARTIAL | FAIL]
- **What imported cleanly:**
- **What failed or required manual entry in Best Case:**
- **Validator output captured (populated count + missing required + missing optional):**
- **Action items:**

### Test 2

- _(copy template above for each test)_

## Discovered gaps

### Required for filing (BLOCKING gaps)

Populated as discovered. Add fields here that Best Case refuses or that
filing checklists reject. When added, also update `REQUIRED_FIELDS` in
[`src/lib/bciValidator.ts`](../src/lib/bciValidator.ts).

- _(empty — pending first round of tests)_

### Optional / nice-to-have (NON-BLOCKING gaps)

Populated as discovered. Update `OPTIONAL_FIELDS` in
[`src/lib/bciValidator.ts`](../src/lib/bciValidator.ts) when adding here.

- _(empty — pending first round of tests)_

## Validator change history

When the validator's `REQUIRED_FIELDS` / `OPTIONAL_FIELDS` arrays change,
record the bump here so future testers know which build's gap profile they
are exercising.

- **V1 launch:** 14 required fields (CaseInfo + MeansTest essentials) + 4
  optional (debtor naming details + prior addresses) + 3 schedule presence
  checks (A/B, I, J).
