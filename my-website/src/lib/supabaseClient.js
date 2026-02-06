import { createClient } from '@supabase/supabase-js';

/** Connects to Supabase using env variables (in .env locally, Vercel Environment Variables in production). */
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || '';
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || '';

if (!supabaseUrl || !supabaseAnonKey) {
  console.warn(
    'Missing Supabase env. Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY (e.g. in Vercel → Settings → Environment Variables).'
  );
}

// Use placeholder so createClient never throws; requests will fail until env is set.
const url = supabaseUrl || 'https://placeholder.supabase.co';
const key = supabaseAnonKey || 'placeholder-anon-key';
export const supabase = createClient(url, key);
