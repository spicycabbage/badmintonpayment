import { createClient } from '@supabase/supabase-js';

// Get credentials from environment variables
const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL || 'https://vplvgsywmqcoruhkopyk.supabase.co';
const SUPABASE_ANON_KEY = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZwbHZnc3l3bXFjb3J1aGtvcHlrIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzAwNDkzMTMsImV4cCI6MjA4NTYyNTMxM30.hfJilJ2YtYkBAzCMBQAMcH7_qNdIoe4IxoHcxdh-wI0';

if (!process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY) {
  console.warn('Warning: Using fallback SUPABASE_ANON_KEY. Please set EXPO_PUBLIC_SUPABASE_ANON_KEY in Vercel environment variables');
}

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
