// BAN-36 — Script Library client helper.
//
// Looks up an active script by key and interpolates {placeholder} tokens.
// Returns the empty string on miss so callers can chain into existing UI
// without throwing. Logs errors to console for observability.

import { supabase } from './supabase';

export async function getScript(
  scriptKey: string,
  variables: Record<string, string> = {},
): Promise<string> {
  const { data, error } = await supabase
    .from('script_library')
    .select('script_text')
    .eq('script_key', scriptKey)
    .eq('is_active', true)
    .maybeSingle();

  if (error) {
    console.error('[scriptLibrary] error loading', scriptKey, error);
    return '';
  }
  if (!data) {
    console.error('[scriptLibrary] no active script for key', scriptKey);
    return '';
  }

  let text: string = data.script_text;
  for (const [key, value] of Object.entries(variables)) {
    // String.replaceAll requires ES2021 (lib.es2021.string). Node 16+ / modern
    // browsers all support it; the project already targets evergreen via Vite.
    text = text.split(`{${key}}`).join(value);
  }
  return text;
}
