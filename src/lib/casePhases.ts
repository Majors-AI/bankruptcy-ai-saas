// BAN-30 — Case file phase taxonomy and classifier.
//
// Mirror of the case_file_phase Postgres enum + the backfill UPDATE in
// 20260528040000_client_file_phases.sql. Keep both in sync.
//
// Phase ordering is encoded in the labels themselves (01- through 10-) so
// alphabetical sorts give the correct chronological order.

export type CaseFilePhase =
  | '01-intake'
  | '02-registration'
  | '03-credit-bank'
  | '04-questionnaire'
  | '05-attorney-review'
  | '06-pacer'
  | '07-trustee'
  | '08-court'
  | '09-correspondence'
  | '10-discharge';

export const CASE_FILE_PHASES: CaseFilePhase[] = [
  '01-intake',
  '02-registration',
  '03-credit-bank',
  '04-questionnaire',
  '05-attorney-review',
  '06-pacer',
  '07-trustee',
  '08-court',
  '09-correspondence',
  '10-discharge',
];

export const PHASE_LABELS: Record<CaseFilePhase, string> = {
  '01-intake':          'Intake',
  '02-registration':    'Registration',
  '03-credit-bank':     'Credit & Bank',
  '04-questionnaire':   'Questionnaire',
  '05-attorney-review': 'Attorney Review',
  '06-pacer':           'PACER / ECF',
  '07-trustee':         'Trustee',
  '08-court':           'Court',
  '09-correspondence':  'Correspondence',
  '10-discharge':       'Discharge',
};

export const PHASE_DESCRIPTIONS: Record<CaseFilePhase, string> = {
  '01-intake':          'Initial intake form and pre-retention verification',
  '02-registration':    'Client agreement, retainer, and consent acknowledgements',
  '03-credit-bank':     'Credit reports, bank statements, financial connection data',
  '04-questionnaire':   '17-section questionnaire schedules, means test inputs, tax returns',
  '05-attorney-review': 'Attorney clarification questions and the client responses',
  '06-pacer':           'PACER / ECF notices and court correspondence',
  '07-trustee':         '341 meeting documents and trustee submissions',
  '08-court':           'Court filings, hearing notices, motions, orders',
  '09-correspondence':  'General client correspondence not tied to another phase',
  '10-discharge':       'Discharge order and case-closing documents',
};

// Mirror of the SQL backfill in 20260528040000_client_file_phases.sql so the
// client agrees with the server on phase classification when no explicit phase
// is provided at insert time. Returns null when the doc type / category does
// not match any known pattern — caller may then leave phase NULL for manual
// review in the super-admin file cabinet.
export function phaseFromDocType(
  docType: string | null | undefined,
  docCategory?: string | null,
): CaseFilePhase | null {
  const t = docType ?? '';
  const c = docCategory ?? '';
  if (!t && !c) return null;

  if (c === 'petition_identity')                                              return '01-intake';
  if (t.startsWith('debtor1_') || t.startsWith('debtor2_'))                   return '01-intake';

  if (c.includes('credit') || t.startsWith('credit_report_') || t.startsWith('isoftpull_'))
                                                                              return '03-credit-bank';
  if (t.startsWith('bank_stmt_') || t.startsWith('bank_bal_') || c.includes('bank'))
                                                                              return '03-credit-bank';

  if (c.startsWith('schedule_') || t.startsWith('sched_'))                    return '04-questionnaire';
  if (c === 'means_test' || t.startsWith('means_'))                           return '04-questionnaire';
  if (c === 'tax_returns' || t.startsWith('tax_return_'))                    return '04-questionnaire';
  if (t.startsWith('retirement_'))                                           return '04-questionnaire';

  if (c.includes('pacer'))                                                   return '06-pacer';
  if (c.includes('341') || c.includes('trustee'))                            return '07-trustee';
  if (c.includes('court'))                                                   return '08-court';
  if (c.includes('discharge'))                                               return '10-discharge';

  return null;
}
