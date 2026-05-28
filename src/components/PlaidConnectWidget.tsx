// V1 — Client-facing Plaid Connect widget.
//
// Two distinct consent surfaces — Bank and Payroll. Each opens Plaid Link
// with its own product list and lands the resulting access_token in
// plaid_items via plaid-exchange-token, then immediately triggers
// plaid-fetch-bank-statements (or plaid-fetch-income) to materialize PDFs
// into the client's FileCabinet phase 03-credit-bank.
//
// Loads the Plaid Link JS shim from CDN on demand so the main bundle isn't
// inflated. The shim attaches window.Plaid which we use to launch handlers.

import { useCallback, useEffect, useState } from 'react';
import { Banknote, Briefcase, RefreshCw, CheckCircle2, AlertTriangle, Info } from 'lucide-react';

const MLG_FIRM_ID = '00000000-0000-0000-0000-000000000001';
const PLAID_LINK_CDN = 'https://cdn.plaid.com/link/v2/stable/link-initialize.js';

interface Props {
  clientId: string;
  firmId?: string;
}

interface PlaidHandler {
  open: () => void;
  exit?: (opts?: { force?: boolean }) => void;
  destroy?: () => void;
}

interface PlaidMetadata {
  institution?: { institution_id: string; name: string };
}

declare global {
  interface Window {
    Plaid?: {
      create(config: {
        token: string;
        onSuccess: (publicToken: string, metadata: PlaidMetadata) => void;
        onExit?: (err: unknown, metadata: unknown) => void;
        onEvent?: (eventName: string) => void;
      }): PlaidHandler;
    };
  }
}

export default function PlaidConnectWidget({ clientId, firmId = MLG_FIRM_ID }: Props) {
  const [shimLoaded, setShimLoaded] = useState(false);
  const [bankBusy, setBankBusy] = useState(false);
  const [payrollBusy, setPayrollBusy] = useState(false);
  const [status, setStatus] = useState<{ kind: 'ok' | 'err'; message: string } | null>(null);

  // Load Plaid Link shim on mount.
  useEffect(() => {
    if (window.Plaid) { setShimLoaded(true); return; }
    const existing = document.querySelector(`script[src="${PLAID_LINK_CDN}"]`);
    if (existing) {
      existing.addEventListener('load', () => setShimLoaded(true), { once: true });
      return;
    }
    const s = document.createElement('script');
    s.src = PLAID_LINK_CDN;
    s.async = true;
    s.onload = () => setShimLoaded(true);
    s.onerror = () => setStatus({ kind: 'err', message: 'Failed to load Plaid Link shim.' });
    document.body.appendChild(s);
  }, []);

  const SUPABASE_URL  = import.meta.env.VITE_SUPABASE_URL as string;
  const SUPABASE_ANON = import.meta.env.VITE_SUPABASE_ANON_KEY as string;
  const fnHeaders = useCallback(() => ({
    'Content-Type': 'application/json',
    Authorization: `Bearer ${SUPABASE_ANON}`,
  }), [SUPABASE_ANON]);

  async function startFlow(kind: 'bank' | 'payroll') {
    setStatus(null);
    if (!window.Plaid) {
      setStatus({ kind: 'err', message: 'Plaid Link is still loading — try again in a second.' });
      return;
    }
    const setBusy = kind === 'bank' ? setBankBusy : setPayrollBusy;
    setBusy(true);

    try {
      // 1. Get a link_token for the appropriate product set.
      const linkRes = await fetch(`${SUPABASE_URL}/functions/v1/plaid-link-token`, {
        method: 'POST',
        headers: fnHeaders(),
        body: JSON.stringify({
          client_id: clientId,
          products: kind === 'bank' ? ['transactions'] : ['income'],
        }),
      });
      if (!linkRes.ok) throw new Error(`link token failed: ${await linkRes.text()}`);
      const { link_token } = await linkRes.json() as { link_token: string };

      // 2. Open Plaid Link with that token.
      const handler = window.Plaid.create({
        token: link_token,
        onSuccess: async (publicToken: string, metadata: PlaidMetadata) => {
          try {
            // 3. Exchange public_token → access_token + insert plaid_items row.
            const exchRes = await fetch(`${SUPABASE_URL}/functions/v1/plaid-exchange-token`, {
              method: 'POST',
              headers: fnHeaders(),
              body: JSON.stringify({
                client_id: clientId,
                firm_id: firmId,
                public_token: publicToken,
                product: kind === 'bank' ? 'transactions' : 'income',
                institution: metadata.institution
                  ? { id: metadata.institution.institution_id, name: metadata.institution.name }
                  : undefined,
              }),
            });
            if (!exchRes.ok) throw new Error(`exchange failed: ${await exchRes.text()}`);
            const { item_row_id } = await exchRes.json() as { item_row_id: string };

            // 4. Materialize docs into client_documents.
            const fetchUrl = kind === 'bank'
              ? `${SUPABASE_URL}/functions/v1/plaid-fetch-bank-statements`
              : `${SUPABASE_URL}/functions/v1/plaid-fetch-income`;
            const fetchRes = await fetch(fetchUrl, {
              method: 'POST',
              headers: fnHeaders(),
              body: JSON.stringify({ plaid_item_row_id: item_row_id }),
            });
            if (fetchRes.ok) {
              const data = await fetchRes.json() as { documents_inserted?: number };
              setStatus({
                kind: 'ok',
                message: kind === 'bank'
                  ? `Bank connected. Generated ${data.documents_inserted ?? '?'} statement document(s).`
                  : `Payroll connected. Generated ${data.documents_inserted ?? '?'} income document(s).`,
              });
            } else {
              setStatus({ kind: 'ok', message: 'Connected. Document generation will retry shortly.' });
            }
          } catch (e) {
            const message = e instanceof Error ? e.message : String(e);
            setStatus({ kind: 'err', message });
          } finally {
            setBusy(false);
          }
        },
        onExit: () => {
          setBusy(false);
        },
      });
      handler.open();
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e);
      setStatus({ kind: 'err', message });
      setBusy(false);
    }
  }

  return (
    <div className="bg-slate-900/40 border border-slate-700/60 rounded-2xl p-5 space-y-4">
      <div className="flex items-center gap-3">
        <div className="w-9 h-9 rounded-xl bg-sky-500/15 border border-sky-500/25 flex items-center justify-center flex-shrink-0">
          <Banknote className="w-4 h-4 text-sky-400" />
        </div>
        <div>
          <h3 className="text-sm font-bold text-white">Connect Bank & Payroll</h3>
          <p className="text-[11px] text-slate-500 mt-0.5">
            Plaid pulls statements and paystubs automatically. Bank and payroll are <strong className="text-slate-300">two separate opt-ins</strong>.
          </p>
        </div>
      </div>

      <div className="bg-sky-500/8 border border-sky-500/20 rounded-xl px-3.5 py-2.5 flex items-start gap-2 text-[11px] text-sky-200/90">
        <Info className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" />
        <p>
          Connecting your bank lets bankruptcy.ai pull the last 90 days of transactions and assemble bank
          statements. Connecting your payroll lets it pull recent paystubs and W-2s. You can revoke either
          connection at any time.
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <button
          onClick={() => startFlow('bank')}
          disabled={bankBusy || !shimLoaded}
          className="flex items-center justify-center gap-2 px-4 py-3 text-sm font-bold text-slate-950 bg-amber-500 hover:bg-amber-400 disabled:opacity-50 rounded-xl"
        >
          {bankBusy ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Banknote className="w-4 h-4" />}
          {bankBusy ? 'Connecting…' : 'Connect Bank'}
        </button>
        <button
          onClick={() => startFlow('payroll')}
          disabled={payrollBusy || !shimLoaded}
          className="flex items-center justify-center gap-2 px-4 py-3 text-sm font-bold text-slate-300 bg-slate-800 hover:bg-slate-700 border border-slate-700 disabled:opacity-50 rounded-xl"
        >
          {payrollBusy ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Briefcase className="w-4 h-4" />}
          {payrollBusy ? 'Connecting…' : 'Connect Payroll'}
        </button>
      </div>

      {!shimLoaded && (
        <p className="text-[11px] text-slate-600">Loading secure connection…</p>
      )}
      {status && (
        <div className={`rounded-xl px-3 py-2 text-[11px] flex items-start gap-2 ${
          status.kind === 'ok'
            ? 'bg-emerald-500/8 border border-emerald-500/25 text-emerald-300'
            : 'bg-red-500/8 border border-red-500/25 text-red-300'
        }`}>
          {status.kind === 'ok' ? <CheckCircle2 className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" /> : <AlertTriangle className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" />}
          <p className="break-all">{status.message}</p>
        </div>
      )}
    </div>
  );
}
