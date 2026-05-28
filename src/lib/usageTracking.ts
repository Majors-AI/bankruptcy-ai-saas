/**
 * MAJ-89 — Per-firm usage event logger (Phase A).
 *
 * Call logUsageEvent() from anywhere in the app to record a billable/trackable
 * action. Failures are swallowed silently so a logging error never breaks UX.
 *
 * Usage:
 *   import { logUsageEvent } from '../lib/usageTracking';
 *
 *   await logUsageEvent({
 *     firmId: FIRM_ID,
 *     eventType: 'zip_export_generated',
 *     clientId: client.id,         // optional
 *     vendorCostCents: 0,          // optional, default 0
 *     metadata: { fileCount: 12 }, // optional
 *   });
 */

import { supabase } from './supabase';

export type UsageEventType =
  | 'client_created'
  | 'plaid_bank_connected'
  | 'plaid_income_connected'
  | 'plaid_bank_statement_generated'
  | 'plaid_income_doc_generated'
  | 'document_uploaded'
  | 'bci_export_generated'
  | 'zip_export_generated'
  | 'sms_sent'
  | 'email_sent';

export interface LogUsageEventParams {
  firmId: string;
  eventType: UsageEventType;
  clientId?: string | null;
  vendorCostCents?: number;
  metadata?: Record<string, unknown>;
}

export async function logUsageEvent(params: LogUsageEventParams): Promise<void> {
  try {
    const { error } = await supabase.from('firm_usage_events').insert({
      firm_id:           params.firmId,
      client_id:         params.clientId ?? null,
      event_type:        params.eventType,
      vendor_cost_cents: params.vendorCostCents ?? 0,
      event_metadata:    params.metadata ?? {},
    });
    if (error) {
      console.warn('[usageTracking] logUsageEvent failed silently:', error.message);
    }
  } catch (err) {
    console.warn('[usageTracking] logUsageEvent threw silently:', err);
  }
}

/** Convenience wrappers for common event types. */

export const usageEvents = {
  clientCreated:    (firmId: string, clientId?: string) =>
    logUsageEvent({ firmId, eventType: 'client_created', clientId }),

  plaidBankConnected: (firmId: string, clientId?: string, vendorCostCents = 0) =>
    logUsageEvent({ firmId, eventType: 'plaid_bank_connected', clientId, vendorCostCents }),

  plaidIncomeConnected: (firmId: string, clientId?: string, vendorCostCents = 0) =>
    logUsageEvent({ firmId, eventType: 'plaid_income_connected', clientId, vendorCostCents }),

  plaidBankStatementGenerated: (firmId: string, clientId?: string, vendorCostCents = 0) =>
    logUsageEvent({ firmId, eventType: 'plaid_bank_statement_generated', clientId, vendorCostCents }),

  plaidIncomeDocGenerated: (firmId: string, clientId?: string, vendorCostCents = 0) =>
    logUsageEvent({ firmId, eventType: 'plaid_income_doc_generated', clientId, vendorCostCents }),

  documentUploaded: (firmId: string, clientId?: string) =>
    logUsageEvent({ firmId, eventType: 'document_uploaded', clientId }),

  bciExportGenerated: (firmId: string, clientId?: string) =>
    logUsageEvent({ firmId, eventType: 'bci_export_generated', clientId }),

  zipExportGenerated: (firmId: string, clientId?: string) =>
    logUsageEvent({ firmId, eventType: 'zip_export_generated', clientId }),

  smsSent: (firmId: string, vendorCostCents = 0) =>
    logUsageEvent({ firmId, eventType: 'sms_sent', vendorCostCents }),

  emailSent: (firmId: string, vendorCostCents = 0) =>
    logUsageEvent({ firmId, eventType: 'email_sent', vendorCostCents }),
};
