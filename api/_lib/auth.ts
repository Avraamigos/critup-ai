import { createClient } from '@supabase/supabase-js'
import type { User } from '@supabase/supabase-js'

// Shared caller verification for API routes. Files/dirs in api/ that start
// with an underscore are NOT deployed as serverless functions by Vercel —
// this stays a plain module (and keeps us under the 12-function limit).

/** Resolve the authenticated user from an Authorization: Bearer <jwt> header.
 *  Returns null when the header is missing/invalid — callers decide the status. */
export async function getCaller(authHeader: string | undefined): Promise<User | null> {
  const jwt = (authHeader ?? '').replace('Bearer ', '').trim()
  if (!jwt) return null
  const url = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || ''
  const anonKey = process.env.VITE_SUPABASE_ANON_KEY || ''
  if (!url || !anonKey) return null
  const anon = createClient(url, anonKey)
  const { data: { user }, error } = await anon.auth.getUser(jwt)
  if (error || !user) return null
  return user
}

/** Single source of truth for admin identity. Override via ADMIN_EMAILS env
 *  (comma-separated); falls back to the founder address so existing deploys
 *  keep working without new env vars. */
const ADMIN_EMAILS: string[] = (process.env.ADMIN_EMAILS ?? 'ibro12345@icloud.com')
  .split(',')
  .map(s => s.trim().toLowerCase())
  .filter(Boolean)

export function isAdminEmail(email: string | null | undefined): boolean {
  return !!email && ADMIN_EMAILS.includes(email.toLowerCase())
}
