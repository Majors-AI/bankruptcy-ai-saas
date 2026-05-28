// MAJ-105 — React hook for per-nav-feature firm flags.
//
// The boolean columns live on firm_features rows (added by migration
// 20260528170000). Since every row for the same firm carries the same
// boolean values, we query one row with .limit(1).
//
// isSuperAdmin=true (role 'super_admin_bankruptcy_ai') bypasses all firm-level
// flags — all features appear as ON regardless of what the database holds.
//
// BAN-40 phase 2 will replace the firmId/isSuperAdmin args with values from
// the Supabase auth context. Until then, callers derive them from env vars.

import { useEffect, useState } from 'react';
import { supabase } from './supabase';

export interface NavFlags {
  feature_intake_portal: boolean;
  feature_intake_form: boolean;
  feature_attorney_intake_review: boolean;
  feature_legacy_import: boolean;
  feature_client_registration: boolean;
  feature_attorney_registration: boolean;
  feature_client_portal: boolean;
  feature_signing_review: boolean;
  feature_file_cabinet: boolean;
  feature_trustee_portal: boolean;
  feature_paralegal_review: boolean;
  feature_attorney_review: boolean;
  feature_file_a_case: boolean;
  feature_ecf_notices: boolean;
  feature_creditor_verification: boolean;
  feature_ai_bots: boolean;
  feature_calendar: boolean;
  feature_accounting: boolean;
  feature_messages: boolean;
  feature_tasks: boolean;
  feature_productivity: boolean;
  feature_comms: boolean;
}

const ALL_ON: NavFlags = {
  feature_intake_portal: true,
  feature_intake_form: true,
  feature_attorney_intake_review: true,
  feature_legacy_import: true,
  feature_client_registration: true,
  feature_attorney_registration: true,
  feature_client_portal: true,
  feature_signing_review: true,
  feature_file_cabinet: true,
  feature_trustee_portal: true,
  feature_paralegal_review: true,
  feature_attorney_review: true,
  feature_file_a_case: true,
  feature_ecf_notices: true,
  feature_creditor_verification: true,
  feature_ai_bots: true,
  feature_calendar: true,
  feature_accounting: true,
  feature_messages: true,
  feature_tasks: true,
  feature_productivity: true,
  feature_comms: true,
};

const SELECT_COLS = [
  'feature_intake_portal',
  'feature_intake_form',
  'feature_attorney_intake_review',
  'feature_legacy_import',
  'feature_client_registration',
  'feature_attorney_registration',
  'feature_client_portal',
  'feature_signing_review',
  'feature_file_cabinet',
  'feature_trustee_portal',
  'feature_paralegal_review',
  'feature_attorney_review',
  'feature_file_a_case',
  'feature_ecf_notices',
  'feature_creditor_verification',
  'feature_ai_bots',
  'feature_calendar',
  'feature_accounting',
  'feature_messages',
  'feature_tasks',
  'feature_productivity',
  'feature_comms',
].join(',');

export function useFirmFlags(firmId: string | null, isSuperAdmin: boolean): NavFlags | null {
  const [flags, setFlags] = useState<NavFlags | null>(null);

  useEffect(() => {
    if (isSuperAdmin) {
      setFlags(ALL_ON);
      return;
    }
    if (!firmId) return;

    supabase
      .from('firm_features')
      .select(SELECT_COLS)
      .eq('firm_id', firmId)
      .limit(1)
      .then(({ data, error }) => {
        if (error || !data?.length) {
          console.error('[useFirmFlags] Failed to load nav flags for', firmId, error);
          return;
        }
        setFlags(data[0] as NavFlags);
      });
  }, [firmId, isSuperAdmin]);

  return flags;
}
