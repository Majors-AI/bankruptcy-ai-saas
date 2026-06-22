// RLS Phase 1 — ambient authenticated session + session-derived firm_id/role.
//
// This provider is the single source of truth for "is the user signed in,
// and if so, who are they and which firm/role do they belong to?". It does
// NOT change any RLS policies; it just stands up the auth context so
// auth.uid() becomes non-null app-wide once a user signs in, which is the
// prerequisite for every later RLS-tightening phase.
//
// Design rules:
//   - ADDITIVE only — with no session, the hooks below fall back to the
//     existing VITE_FIRM_ID constant and the existing client-side operator
//     gate, so nothing about today's anon-key behavior breaks.
//   - One subscription per page-load to supabase.auth.onAuthStateChange.
//     Every consumer reads from React context rather than calling
//     getUser() / getSession() ad hoc (that's how we got the stale
//     authedEmail in App.tsx today).
//   - user_profiles is fetched once per session change. While loading,
//     the hooks return the env fallbacks so the UI doesn't flash an
//     unauthorized state mid-resolution.
//
// Convergence with legacy identity surfaces (currentAttorney.ts,
// LegalAdminPortal PIN login, sessionStorage) is intentionally NOT done
// here — those keep working as-is. A later phase will collapse them.

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import type { Session, User } from "@supabase/supabase-js";
import { supabase } from "./supabase";
import type { PlatformRole } from "./auth";

// ─── Types ─────────────────────────────────────────────────────────────────

/** The minimum shape we resolve from user_profiles per signed-in user.
 *  Mirrors the columns we actually consume — keep narrow so we don't
 *  trip the anon SELECT policy any harder than it already is. */
export interface UserProfile {
  user_id: string;
  firm_id: string | null;
  role: PlatformRole;
  full_name: string | null;
}

export interface AuthContextValue {
  /** Raw Supabase session — null when signed out. */
  session: Session | null;
  /** Raw Supabase user — null when signed out. */
  user: User | null;
  /** Resolved row from public.user_profiles for the signed-in user.
   *  null when (a) signed out, (b) the row hasn't been seeded yet
   *  (see Part 4 seed SQL in the prompt), or (c) the lookup query
   *  failed. The hooks below interpret null as "fall back to env". */
  profile: UserProfile | null;
  /** True while the initial getSession() round-trip is in flight + while
   *  user_profiles is being resolved. Hooks return env fallbacks during
   *  this window so the UI doesn't flash. */
  loading: boolean;
  /** True when the user_profiles lookup ran but returned no row. Used by
   *  the sign-in UI to surface "your account exists but isn't seeded;
   *  contact ops" instead of a generic error. */
  profileMissing: boolean;
  /** Latest profile-lookup error, if any. Doesn't block hooks falling
   *  back to env values. */
  profileError: string | null;

  // Action helpers — wrap the supabase calls so consumers don't have to
  // import the client directly.
  signInWithPassword: (email: string, password: string) => Promise<{ error: string | null }>;
  signOut: () => Promise<void>;
  /** Force-refetch of the user_profiles row without rotating the session.
   *  Useful after operator seeds a row for a user who is already logged in. */
  refreshProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

// ─── Provider ──────────────────────────────────────────────────────────────

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [profileMissing, setProfileMissing] = useState<boolean>(false);
  const [profileError, setProfileError] = useState<string | null>(null);

  // Resolve the user_profiles row for a given user id. Returns null on
  // miss / error so callers can show fallback UI.
  const fetchProfile = useCallback(async (userId: string): Promise<UserProfile | null> => {
    setProfileError(null);
    setProfileMissing(false);
    const { data, error } = await supabase
      .from("user_profiles")
      .select("user_id, firm_id, role, full_name")
      .eq("user_id", userId)
      .maybeSingle();
    if (error) {
      setProfileError(error.message);
      return null;
    }
    if (!data) {
      setProfileMissing(true);
      return null;
    }
    return data as UserProfile;
  }, []);

  // Single subscription per page-load. The initial getSession() call seeds
  // the state; onAuthStateChange takes over from there (sign-in / sign-out
  // / token-refresh all fan through the same handler).
  useEffect(() => {
    let cancelled = false;

    (async () => {
      const { data } = await supabase.auth.getSession();
      if (cancelled) return;
      const initial = data.session;
      setSession(initial);
      if (initial?.user) {
        const p = await fetchProfile(initial.user.id);
        if (!cancelled) setProfile(p);
      }
      if (!cancelled) setLoading(false);
    })();

    const { data: subscription } = supabase.auth.onAuthStateChange((_event, next) => {
      if (cancelled) return;
      setSession(next);
      if (next?.user) {
        // Fire-and-forget — profile state updates when the lookup resolves.
        fetchProfile(next.user.id).then(p => {
          if (!cancelled) setProfile(p);
        });
      } else {
        setProfile(null);
        setProfileMissing(false);
        setProfileError(null);
      }
    });

    return () => {
      cancelled = true;
      subscription.subscription.unsubscribe();
    };
  }, [fetchProfile]);

  const refreshProfile = useCallback(async () => {
    if (!session?.user) return;
    const p = await fetchProfile(session.user.id);
    setProfile(p);
  }, [session, fetchProfile]);

  const signInWithPassword = useCallback(
    async (email: string, password: string): Promise<{ error: string | null }> => {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) return { error: error.message };
      return { error: null };
    },
    [],
  );

  const signOut = useCallback(async () => {
    await supabase.auth.signOut();
  }, []);

  const value: AuthContextValue = useMemo(
    () => ({
      session,
      user: session?.user ?? null,
      profile,
      loading,
      profileMissing,
      profileError,
      signInWithPassword,
      signOut,
      refreshProfile,
    }),
    [
      session, profile, loading, profileMissing, profileError,
      signInWithPassword, signOut, refreshProfile,
    ],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

// ─── Hooks ─────────────────────────────────────────────────────────────────

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error("useAuth() must be used inside <AuthProvider>");
  }
  return ctx;
}

/** Stable env fallback for firm_id — same constant used everywhere
 *  pre-auth. Exported so call sites can prove what the fallback resolves
 *  to without re-reading import.meta.env. */
export const FIRM_ID_ENV_FALLBACK: string =
  (import.meta.env.VITE_FIRM_ID as string | undefined) ??
  "00000000-0000-0000-0000-000000000001";

/** Returns the firm id for the current user.
 *
 *  Resolution order:
 *    1. session user_profiles.firm_id (when signed in + profile seeded)
 *    2. VITE_FIRM_ID env var
 *    3. hardcoded MLG fallback '00000000-0000-0000-0000-000000000001'
 *
 *  Returns the env fallback during the initial loading window so the UI
 *  doesn't flash a different value mid-resolution. */
export function useCurrentFirmId(): string {
  const { profile } = useAuth();
  if (profile?.firm_id) return profile.firm_id;
  return FIRM_ID_ENV_FALLBACK;
}

/** Env fallback for the platform role — derived from the same env vars
 *  App.tsx already uses (VITE_PLATFORM_ROLE first, then a coarse map
 *  from VITE_FIRM_ROLE). Returns null when nothing is set. */
export function envPlatformRoleFallback(): PlatformRole | null {
  const platform = import.meta.env.VITE_PLATFORM_ROLE as string | undefined;
  if (platform === "super_admin_bankruptcy_ai") return "super_admin_bankruptcy_ai";
  const firm = import.meta.env.VITE_FIRM_ROLE as string | undefined;
  // Owner is now a first-class PlatformRole — no longer collapsed to
  // firm_super_admin. Readme §5: owner is ABOVE super admin and sees
  // owner-only revenue/financial reporting + the Owner Portal that
  // super admin doesn't see.
  if (firm === "law_firm_owner")  return "law_firm_owner";
  if (firm === "super_admin")     return "firm_super_admin";
  if (firm === "attorney")        return "attorney";
  return null;
}

/** Returns the platform role for the current user.
 *
 *  Resolution order:
 *    1. session user_profiles.role
 *    2. env-derived fallback (matches today's App.tsx env-only logic)
 *    3. null (unauthenticated, no env override)
 *
 *  IMPORTANT: this is for UI gating ONLY. Server-side authorization is
 *  RLS on the underlying tables — which is what later phases tighten.
 *  Do not treat a non-null value here as a security boundary. */
export function useCurrentRole(): PlatformRole | null {
  const { profile } = useAuth();
  if (profile?.role) return profile.role;
  return envPlatformRoleFallback();
}

/** True iff the resolved role is the platform super-admin. Provided as a
 *  convenience so the operator gate in App.tsx can read a single
 *  boolean instead of comparing strings. */
export function useIsOperator(): boolean {
  const role = useCurrentRole();
  return role === "super_admin_bankruptcy_ai";
}
