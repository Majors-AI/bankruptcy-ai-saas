// RLS Phase 1 — staff / operator sign-in surface.
//
// Stands up an ambient authenticated session for the whole app, persisted
// to localStorage by the supabase client. Distinct from the registration
// pages (AttorneyRegistration / ClientRegistration), which sign users
// IN but never propagate the session beyond their own page-local state.
//
// What this is for:
//   - Operators (super_admin_bankruptcy_ai) signing in so #21 hits real
//     `firms` / `firm_pricing` rows instead of falling back to the seed.
//   - MLG staff (attorney / firm_super_admin / legal_admin) signing in
//     so RLS-tightened tables in later phases resolve auth.uid().
//
// What this is NOT for:
//   - End clients — they still go through ClientRegistration.tsx.
//   - PIN-portal staff identity — that still flows through
//     sessionStorage + currentAttorney.ts. Convergence is a later phase.

import { useState, type FormEvent } from "react";
import { LogIn, LogOut, AlertTriangle, CheckCircle2, ShieldCheck } from "lucide-react";
import { useAuth, useCurrentRole } from "../lib/AuthProvider";

export default function StaffSignIn() {
  const { user, profile, loading, profileMissing, profileError, signInWithPassword, signOut, refreshProfile } = useAuth();
  const sessionRole = useCurrentRole();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    const { error: signInError } = await signInWithPassword(email.trim(), password);
    setSubmitting(false);
    if (signInError) {
      setError(signInError);
      return;
    }
    // Profile resolution fires through onAuthStateChange in the provider;
    // wipe the password field so it doesn't sit in DOM after success.
    setPassword("");
  }

  // ─── Signed-in surface ───────────────────────────────────────────────
  if (user) {
    return (
      <div className="max-w-md mx-auto mt-12 bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-800 bg-slate-800/40 flex items-center gap-2">
          <ShieldCheck className="w-4 h-4 text-emerald-400" />
          <p className="text-sm font-bold text-white">Signed in</p>
        </div>
        <div className="p-5 space-y-3 text-sm">
          <div>
            <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Email</p>
            <p className="text-white">{user.email}</p>
          </div>
          <div>
            <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">User id (auth.uid)</p>
            <p className="text-white font-mono text-xs">{user.id}</p>
          </div>
          {profile ? (
            <>
              <div>
                <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Platform role</p>
                <p className="text-amber-300 font-semibold">{profile.role}</p>
              </div>
              <div>
                <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Firm id (from user_profiles)</p>
                <p className="text-white font-mono text-xs">{profile.firm_id ?? "—"}</p>
              </div>
              {profile.full_name && (
                <div>
                  <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Full name</p>
                  <p className="text-white">{profile.full_name}</p>
                </div>
              )}
            </>
          ) : profileMissing ? (
            <div className="rounded-lg border border-amber-500/30 bg-amber-500/5 p-3 flex items-start gap-2">
              <AlertTriangle className="w-4 h-4 text-amber-400 flex-shrink-0 mt-0.5" />
              <div className="text-xs text-amber-200 leading-relaxed">
                Signed in, but no <code className="text-amber-300">user_profiles</code> row exists
                for this user yet. Operator must seed it (see RLS Phase 1 report). The app falls
                back to the env-var firm / role until a row lands.
                <button
                  type="button"
                  onClick={refreshProfile}
                  className="ml-2 underline text-amber-300 hover:text-amber-100"
                >
                  Retry lookup
                </button>
              </div>
            </div>
          ) : profileError ? (
            <div className="rounded-lg border border-red-500/30 bg-red-500/5 p-3 text-xs text-red-200">
              Profile lookup failed: {profileError}
              <button
                type="button"
                onClick={refreshProfile}
                className="ml-2 underline text-red-300 hover:text-red-100"
              >
                Retry
              </button>
            </div>
          ) : loading ? (
            <p className="text-xs text-slate-500 italic">Resolving user_profiles…</p>
          ) : null}
          {!profile && sessionRole && (
            <p className="text-[11px] text-slate-500 italic leading-snug border-t border-slate-800 pt-3">
              Falling back to env role: <code className="text-slate-400">{sessionRole}</code>
            </p>
          )}
          <button
            type="button"
            onClick={signOut}
            className="mt-4 w-full inline-flex items-center justify-center gap-2 px-3 py-2 rounded-lg text-sm font-semibold bg-slate-800 text-slate-300 border border-slate-700 hover:bg-slate-700"
          >
            <LogOut className="w-4 h-4" />
            Sign out
          </button>
        </div>
      </div>
    );
  }

  // ─── Signed-out surface ──────────────────────────────────────────────
  return (
    <div className="max-w-md mx-auto mt-12 bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden">
      <div className="px-5 py-4 border-b border-slate-800 bg-slate-800/40 flex items-center gap-2">
        <LogIn className="w-4 h-4 text-amber-400" />
        <p className="text-sm font-bold text-white">Staff / operator sign-in</p>
      </div>
      <div className="p-5">
        <p className="text-xs text-slate-500 mb-4 leading-relaxed">
          Sign in with a Supabase Auth account that has a <code className="text-slate-400">user_profiles</code> row.
          Required for the operator console (#21) and for any RLS-tightened
          tables in later phases. Without a session, the app continues to
          read from <code className="text-slate-400">VITE_FIRM_ID</code>.
        </p>
        <form onSubmit={handleSubmit} className="space-y-3">
          <div>
            <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">
              Email
            </label>
            <input
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              required
              autoComplete="email"
              className="w-full bg-slate-800 border border-slate-700 text-white text-sm rounded-lg px-3 py-2 placeholder:text-slate-600 focus:outline-none focus:border-amber-500/60"
              placeholder="you@firm.example"
            />
          </div>
          <div>
            <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">
              Password
            </label>
            <input
              type="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              required
              autoComplete="current-password"
              className="w-full bg-slate-800 border border-slate-700 text-white text-sm rounded-lg px-3 py-2 placeholder:text-slate-600 focus:outline-none focus:border-amber-500/60"
            />
          </div>
          {error && (
            <div className="rounded-lg border border-red-500/30 bg-red-500/5 p-3 flex items-start gap-2">
              <AlertTriangle className="w-4 h-4 text-red-400 flex-shrink-0 mt-0.5" />
              <p className="text-xs text-red-200 leading-relaxed">{error}</p>
            </div>
          )}
          <button
            type="submit"
            disabled={submitting || !email || !password}
            className="w-full inline-flex items-center justify-center gap-2 px-3 py-2 rounded-lg text-sm font-semibold bg-amber-500 text-slate-950 hover:bg-amber-400 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <CheckCircle2 className="w-4 h-4" />
            {submitting ? "Signing in…" : "Sign in"}
          </button>
        </form>
        <p className="text-[10px] text-slate-600 italic mt-4 leading-snug">
          No registration here — accounts are created via the Attorney /
          Client Registration pages (or the operator seeding SQL).
        </p>
      </div>
    </div>
  );
}
