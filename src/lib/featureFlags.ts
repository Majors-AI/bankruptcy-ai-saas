// BAN-41 — Feature flag client.
//
// getFirmFeatures(firmId) returns a map of feature_key → enabled boolean for
// the given firm. The result is cached in-memory keyed by firmId so repeated
// calls within a session don't hammer the database. Call clearFeatureCache()
// on sign-out or firm switch to reset.
//
// No React context yet — the project doesn't have one (verified: no
// src/contexts or src/providers directories). When a single global firm
// context lands as part of BAN-40 phase 2, swap callers to a useFirmFeature
// hook that wraps this module.

import { supabase } from './supabase';

let cachedFlags: Record<string, boolean> | null = null;
let cachedFirmId: string | null = null;
let inFlight: Promise<Record<string, boolean>> | null = null;

export async function getFirmFeatures(firmId: string): Promise<Record<string, boolean>> {
  if (cachedFirmId === firmId && cachedFlags) {
    return cachedFlags;
  }

  // De-dupe concurrent loads for the same firmId.
  if (inFlight && cachedFirmId === firmId) {
    return inFlight;
  }

  const load = (async () => {
    const { data, error } = await supabase
      .from('firm_features')
      .select('feature_key, enabled')
      .eq('firm_id', firmId);

    if (error) {
      console.error('[featureFlags] Failed to load firm features for', firmId, error);
      return {};
    }

    const flags: Record<string, boolean> = {};
    for (const row of (data ?? []) as Array<{ feature_key: string; enabled: boolean }>) {
      flags[row.feature_key] = row.enabled === true;
    }
    cachedFlags = flags;
    cachedFirmId = firmId;
    return flags;
  })();

  cachedFirmId = firmId;
  inFlight = load;
  try {
    return await load;
  } finally {
    inFlight = null;
  }
}

export function isFeatureEnabled(flags: Record<string, boolean>, featureKey: string): boolean {
  return flags[featureKey] === true;
}

export function clearFeatureCache(): void {
  cachedFlags = null;
  cachedFirmId = null;
  inFlight = null;
}
