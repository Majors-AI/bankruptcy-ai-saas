// V1 — Magic-link client access.
//
// Generates a 32-char URL-safe token, persists it (plus a 90-day expiry) on
// the clients row, and returns the token so the caller can build a portal
// URL or pass it into the send-client-message script substitution.
//
// validateToken() is used by App.tsx on page load — if the URL has ?token=X
// and the token is not expired, the client_view route opens scoped to that
// client. Validation here is a client-side hint; RLS still enforces the
// real boundary once Supabase auth is wired.

import { supabase } from './supabase';

const TOKEN_BYTES = 24; // → 32 base64url chars after stripping padding
const NINETY_DAYS_MS = 90 * 24 * 60 * 60 * 1000;

export interface PortalClient {
  id: string;
  firm_id: string | null;
  full_name: string | null;
  email: string | null;
  phone: string | null;
  access_token: string | null;
  access_token_expires_at: string | null;
}

// Use the browser's crypto API for the random source; that gives us
// cryptographically strong tokens without pulling in node:crypto in the
// Vite client build.
function randomBase64Url(byteLen: number): string {
  const bytes = new Uint8Array(byteLen);
  crypto.getRandomValues(bytes);
  // base64 → base64url (strip padding, swap +/ → -_)
  const b64 = btoa(String.fromCharCode(...bytes));
  return b64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}

export async function generateAccessToken(clientId: string): Promise<string> {
  const token = randomBase64Url(TOKEN_BYTES);
  const expires = new Date(Date.now() + NINETY_DAYS_MS).toISOString();
  const { error } = await supabase
    .from('clients')
    .update({ access_token: token, access_token_expires_at: expires })
    .eq('id', clientId);
  if (error) {
    console.error('[clientAccess] generateAccessToken failed for', clientId, error);
    throw error;
  }
  return token;
}

export async function validateToken(token: string): Promise<PortalClient | null> {
  if (!token) return null;
  const { data, error } = await supabase
    .from('clients')
    .select('id, firm_id, full_name, email, phone, access_token, access_token_expires_at')
    .eq('access_token', token)
    .maybeSingle();
  if (error) {
    console.error('[clientAccess] validateToken lookup failed', error);
    return null;
  }
  if (!data) return null;
  const row = data as PortalClient & { access_token_expires_at: string | null };
  if (!row.access_token_expires_at) return null;
  if (new Date(row.access_token_expires_at).getTime() < Date.now()) return null;
  return row;
}

export function buildPortalUrl(token: string): string {
  // VITE_APP_URL is the canonical portal origin (Netlify branch deploy in
  // dev, real domain in prod). Falls back to the current origin for
  // localhost-only development.
  const base = (import.meta.env.VITE_APP_URL as string | undefined)
    ?? (typeof window !== 'undefined' ? window.location.origin : '');
  return `${base}/?token=${encodeURIComponent(token)}`;
}
