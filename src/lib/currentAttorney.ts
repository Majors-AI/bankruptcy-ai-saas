// Current attorney resolver — temporary stub until Supabase Auth is wired
// and every portal surface can read the signed-in user from a shared
// session provider.
//
// ─── HOW THIS WORKS TODAY ───────────────────────────────────────────────────
// The intake-portal login (LegalAdminPortal's PortalLogin) writes the
// logged-in staffer's identity into sessionStorage on successful login and
// clears it on logout. Other portal surfaces (AttorneyIntakeDashboard,
// AttorneyTaskPanel) read the SAME identity via getCurrentAttorneyName()
// so the names match across surfaces.
//
// Resolution order:
//   1. sessionStorage entry (set by LegalAdminPortal's login handler)
//   2. VITE_ATTORNEY_NAME env var override (.env.local)
//   3. Default constant 'Jennifer Smith, Esq.'
//
// The sessionStorage path is what fixes the "Sarah Kim logged in but
// dashboard greets Jennifer Smith" bug — both surfaces now read from the
// same source of truth.
//
// ─── TODO PHASE B — REAL AUTH ───────────────────────────────────────────────
// Once Supabase Auth is wired:
//   - replace sessionStorage with the supabase.auth.getUser() lookup
//   - join through staff_members on auth.users.id to get the display name +
//     intake_portal_role + bar credentials
//   - drive attorney_tasks / attorney_intake_reviews FK writes from
//     staff_members.id, not the display-name string

const SS_KEY = 'bk_current_attorney_name';

// Allow the build to short-circuit reads in non-browser contexts (SSR / tests)
const hasSessionStorage =
  typeof window !== 'undefined' && typeof window.sessionStorage !== 'undefined';

export function getCurrentAttorneyName(): string {
  if (hasSessionStorage) {
    const v = window.sessionStorage.getItem(SS_KEY);
    if (v && v.trim() !== '') return v.trim();
  }
  const envName = import.meta.env.VITE_ATTORNEY_NAME as string | undefined;
  if (envName && envName.trim() !== '') return envName.trim();
  return 'Jennifer Smith, Esq.';
}

/** Persist the logged-in staffer's display name so other portal surfaces
 *  (AttorneyIntakeDashboard greeting, AttorneyTaskPanel task query, etc.)
 *  read the SAME identity. Called by LegalAdminPortal's login handler. */
export function setCurrentAttorneyName(name: string | null | undefined): void {
  if (!hasSessionStorage) return;
  if (!name || name.trim() === '') {
    window.sessionStorage.removeItem(SS_KEY);
    return;
  }
  window.sessionStorage.setItem(SS_KEY, name.trim());
}

/** Clear the persisted attorney name (on logout). */
export function clearCurrentAttorneyName(): void {
  if (!hasSessionStorage) return;
  window.sessionStorage.removeItem(SS_KEY);
}
