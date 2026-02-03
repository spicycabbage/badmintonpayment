import { createClient } from '@supabase/supabase-js';

// Get credentials from environment variables
const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL || 'https://vplvgsywmqcoruhkopyk.supabase.co';
const SUPABASE_ANON_KEY = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || 'sb_publishable_7j-u-hyLgYpYKVe-F4ZWgQ_Yy96UmrH';

if (!process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY) {
  console.warn('Warning: Using fallback SUPABASE_ANON_KEY. Please set EXPO_PUBLIC_SUPABASE_ANON_KEY in Vercel environment variables');
}

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
