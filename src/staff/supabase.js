import { createClient } from '@supabase/supabase-js';
import { SUPABASE_URL, SUPABASE_ANON_KEY, apiReady, apiFetch, DEMO } from '../shared/api.js';

export const supabase = apiReady
  ? createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    auth: { persistSession: true, storageKey: 'cs-staff-auth' },
    ...(DEMO ? { global: { fetch: apiFetch } } : {}),
  })
  : null;
