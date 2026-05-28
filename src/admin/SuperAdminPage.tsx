// BAN-40 — bankruptcy.ai platform-level Super Admin page (stub).
//
// Distinct from `src/SuperAdminPortal.tsx`, which is the firm-level
// super-admin tooling (staff productivity, etc.). This page is gated to
// platform_role = 'super_admin_bankruptcy_ai' — cross-firm tenant management,
// billing oversight, system-wide controls.
//
// Full implementation pending BAN-40. The auth gate here is a placeholder:
// once Supabase auth + user_profiles is the source of truth, replace the
// TODO with a real lookup against user_profiles and a redirect on mismatch.

import { Shield, AlertTriangle } from 'lucide-react';
import type { PlatformRole } from '../lib/auth';
import { isBankruptcyAISuperAdmin } from '../lib/auth';

interface Props {
  // Current user's platform role. Passed in by the host router/app shell.
  // When null/undefined we treat as unauthenticated and refuse to render.
  currentUserRole?: PlatformRole | null;
}

export default function SuperAdminPage({ currentUserRole }: Props) {
  // TODO BAN-40: replace this client-side gate with a server-side check via
  // user_profiles + RLS. The current client gate is informational only.
  if (!isBankruptcyAISuperAdmin(currentUserRole)) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center p-8">
        <div className="max-w-md text-center">
          <div className="w-14 h-14 mx-auto mb-4 rounded-full bg-red-500/10 border border-red-500/30 flex items-center justify-center">
            <AlertTriangle className="w-7 h-7 text-red-400" />
          </div>
          <h1 className="text-xl font-bold text-white mb-2" style={{ fontFamily: "'Georgia', serif" }}>
            Access Denied
          </h1>
          <p className="text-slate-400 text-sm leading-relaxed">
            This area is reserved for bankruptcy.ai platform administrators.
            If you believe you should have access, contact your platform owner.
          </p>
          <p className="text-xs text-slate-600 mt-4">
            Required role: <code className="text-slate-400">super_admin_bankruptcy_ai</code>
            <br />
            Current role: <code className="text-slate-400">{currentUserRole ?? 'unauthenticated'}</code>
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-950 text-white p-8">
      <div className="max-w-5xl mx-auto">
        <div className="flex items-center gap-3 mb-6">
          <div className="w-10 h-10 rounded-xl bg-amber-500/15 border border-amber-500/30 flex items-center justify-center">
            <Shield className="w-5 h-5 text-amber-400" />
          </div>
          <div>
            <h1 className="text-2xl font-bold" style={{ fontFamily: "'Georgia', serif" }}>
              bankruptcy<span className="text-amber-400">.ai</span> Super Admin
            </h1>
            <p className="text-xs text-slate-500 mt-0.5">
              Platform-level controls — multi-firm tenant management
            </p>
          </div>
        </div>

        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6">
          <div className="flex items-start gap-3">
            <AlertTriangle className="w-5 h-5 text-amber-400 flex-shrink-0 mt-0.5" />
            <div>
              <h2 className="text-sm font-bold text-amber-300 mb-1">
                Placeholder — BAN-40 full implementation pending
              </h2>
              <p className="text-xs text-slate-400 leading-relaxed">
                Planned features: firms list + lifecycle status (lead → trial → active → suspended →
                churned), per-firm billing oversight, cross-firm metrics, platform-level audit log,
                tenant impersonation, and AWS storage prefix management.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
