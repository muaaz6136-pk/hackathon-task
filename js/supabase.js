import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm';
export const SUPABASE_URL = 'https://jzwgaebssxvqiebbcjju.supabase.co';
export const SUPABASE_KEY =  'sb_publishable_nm_7rMJLEwEZVCEh8tGAdQ_8bs6QYSJ';
export const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);
export const tempClient = () => createClient(SUPABASE_URL, SUPABASE_KEY, { auth: { persistSession: false, autoRefreshToken: false } });

