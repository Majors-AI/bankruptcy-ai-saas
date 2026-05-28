// V1 — BCI (Best Case Import) validator.
//
// Inspects the questionnaire data tree against Best Case 25.1 required and
// optional fields. Returns a structured result the verification modal can
// render — populated count, missing-required (blocking), missing-optional
// (warnings). Used alongside generateBCI(d) in the questionnaire .jsx to
// stop a half-baked .bci from being downloaded by accident.
//
// REQUIRED_FIELDS mirrors the linchpin Best Case BCI fields. As MLG and
// Neeley discover more gaps during the V1 pilot, add to REQUIRED_FIELDS or
// OPTIONAL_FIELDS and note the discovery in docs/BCI_FIELD_GAPS.md.

export interface BciFieldRef {
  field: string;
  schedule: string;
}

export interface BciMissingRequired extends BciFieldRef {
  reason: string;
}

export interface BciValidationResult {
  populated_count: number;
  missing_required: BciMissingRequired[];
  missing_optional: BciFieldRef[];
  blocking: boolean;
}

// Dot-path references into the questionnaire-data tree. The validator's
// getNestedValue() walks each segment safely.
const REQUIRED_FIELDS: BciFieldRef[] = [
  { field: 'CaseInfo.DebtorFirstName',           schedule: 'Form 101' },
  { field: 'CaseInfo.DebtorLastName',            schedule: 'Form 101' },
  { field: 'CaseInfo.DebtorSSN',                 schedule: 'Form 101' },
  { field: 'CaseInfo.DebtorDOB',                 schedule: 'Form 101' },
  { field: 'CaseInfo.ResidentialAddress.Street', schedule: 'Form 101' },
  { field: 'CaseInfo.ResidentialAddress.City',   schedule: 'Form 101' },
  { field: 'CaseInfo.ResidentialAddress.State',  schedule: 'Form 101' },
  { field: 'CaseInfo.ResidentialAddress.Zip',    schedule: 'Form 101' },
  { field: 'CaseInfo.Chapter',                   schedule: 'Form 101' },
  { field: 'CaseInfo.County',                    schedule: 'Form 101' },
  { field: 'CaseInfo.District',                  schedule: 'Form 101' },
  { field: 'MeansTest.HouseholdSize',            schedule: 'Form 122' },
  { field: 'MeansTest.CMI',                      schedule: 'Form 122' },
  { field: 'MeansTest.StateMedianIncome',        schedule: 'Form 122' },
];

const OPTIONAL_FIELDS: BciFieldRef[] = [
  { field: 'CaseInfo.DebtorMiddleName', schedule: 'Form 101' },
  { field: 'CaseInfo.DebtorSuffix',     schedule: 'Form 101' },
  { field: 'CaseInfo.DebtorAltPhone',   schedule: 'Form 101' },
  { field: 'CaseInfo.PriorAddresses',   schedule: 'Form 101' },
];

export function validateBci(d: Record<string, unknown> | null | undefined): BciValidationResult {
  const missing_required: BciMissingRequired[] = [];
  const missing_optional: BciFieldRef[] = [];
  let populated_count = 0;

  const data = d ?? {};

  for (const field of REQUIRED_FIELDS) {
    if (isPopulated(getNestedValue(data, field.field))) {
      populated_count++;
    } else {
      missing_required.push({ ...field, reason: 'Required for Best Case import' });
    }
  }
  for (const field of OPTIONAL_FIELDS) {
    if (isPopulated(getNestedValue(data, field.field))) {
      populated_count++;
    } else {
      missing_optional.push(field);
    }
  }

  if (!hasAnyScheduleAB(data)) {
    missing_required.push({
      field: 'Schedule A/B',
      schedule: 'Schedules A/B',
      reason: 'No real or personal property entries',
    });
  }
  if (!hasAnyIncome(data)) {
    missing_required.push({
      field: 'Schedule I',
      schedule: 'Schedule I',
      reason: 'No income sources listed',
    });
  }
  if (!hasAnyExpenses(data)) {
    missing_required.push({
      field: 'Schedule J',
      schedule: 'Schedule J',
      reason: 'No monthly expenses listed',
    });
  }

  return {
    populated_count,
    missing_required,
    missing_optional,
    blocking: missing_required.length > 0,
  };
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function getNestedValue(obj: Record<string, unknown>, path: string): unknown {
  return path.split('.').reduce<unknown>((acc, key) => {
    if (acc == null || typeof acc !== 'object') return undefined;
    return (acc as Record<string, unknown>)[key];
  }, obj);
}

function isPopulated(value: unknown): boolean {
  if (value === undefined || value === null) return false;
  if (typeof value === 'string') return value.trim() !== '';
  if (Array.isArray(value)) return value.length > 0;
  return true;
}

function hasAnyScheduleAB(d: Record<string, unknown>): boolean {
  const real     = (d.realProperties as unknown[] | undefined) ?? [];
  const personal = (d.personalProperties as unknown[] | undefined) ?? [];
  return real.length > 0 || personal.length > 0 || d.noPropertyAcknowledged === true;
}

function hasAnyIncome(d: Record<string, unknown>): boolean {
  const sources = (d.incomeSources as unknown[] | undefined) ?? [];
  return sources.length > 0;
}

function hasAnyExpenses(d: Record<string, unknown>): boolean {
  const exp = d.expenses as Record<string, unknown> | undefined;
  if (!exp) return false;
  return Object.values(exp).some(v => v !== null && v !== undefined && v !== '');
}
