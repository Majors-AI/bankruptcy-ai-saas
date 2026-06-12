import { createClient } from '@supabase/supabase-js';

// Explicit auth options. The @supabase/supabase-js v2 browser defaults
// already persist to localStorage and auto-refresh, but pinning the
// behavior here makes it deterministic across SSR / tests / future
// cookie-storage migrations and stops the AuthProvider's
// onAuthStateChange subscription from being silently downgraded.
//
// storageKey is left implicit (defaults to `sb-{projectref}-auth-token`)
// so a future deploy with a different Supabase project picks up the
// right key without a code change.
const isBrowser = typeof window !== 'undefined';

export const supabase = createClient(
  import.meta.env.VITE_SUPABASE_URL as string,
  import.meta.env.VITE_SUPABASE_ANON_KEY as string,
  {
    auth: {
      persistSession:   isBrowser,
      autoRefreshToken: isBrowser,
      detectSessionInUrl: isBrowser,
      // On non-browser contexts (vitest / SSR) localStorage is undefined;
      // fall back to an in-memory shim so createClient doesn't throw.
      storage: isBrowser ? window.localStorage : undefined,
    },
  }
);
