import { supabase } from './supabase'

/** Authorization header for calls to our own API routes.
 *  Returns {} when there is no session so callers can spread it safely —
 *  the server responds 401 and the UI's existing error paths handle it. */
export async function authHeader(): Promise<Record<string, string>> {
  const { data: { session } } = await supabase.auth.getSession()
  return session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : {}
}
