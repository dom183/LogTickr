import { createClient } from "@supabase/supabase-js";

const supabaseUrl = "https://qdbbyjgfnmljlnozkysv.supabase.co";
const supabaseAnonKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFkYmJ5amdmbm1samxub3preXN2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTcyNzczNjgsImV4cCI6MjA3Mjg1MzM2OH0.Q5qVBf7XigMaMN6Ji4r7wa02zVlyK33qhJT7JBU3YKw"; // from Supabase dashboard

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    storage: typeof window !== 'undefined' ? window.localStorage : undefined,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false
  }
});