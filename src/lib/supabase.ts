import { createClient } from '@supabase/supabase-js'
import type { Database } from './database.types'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string

// Falls back to placeholder so the app boots in dev without credentials.
// Replace with real values in .env before connecting live data.
export const supabase = createClient<Database>(
  supabaseUrl || 'https://placeholder.supabase.co',
  supabaseAnonKey || 'placeholder-anon-key',
  {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
      storageKey: 'critup-auth',
    },
  }
)

export const isSupabaseConfigured =
  !!supabaseUrl &&
  supabaseUrl !== 'your_supabase_project_url' &&
  !!supabaseAnonKey &&
  supabaseAnonKey !== 'your_supabase_anon_key'
