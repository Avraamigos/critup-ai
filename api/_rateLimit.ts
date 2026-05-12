/**
 * Supabase-backed rate limiting — no extra services needed.
 *
 * Free plan  → 5 analyses per 24 h, 40 chat messages per hour
 * Pro plan   → unlimited
 */
import { type SupabaseClient } from '@supabase/supabase-js'

export interface RateLimitResult {
  allowed: boolean
  limit: number
  used: number
  remaining: number
  resetInSeconds: number
}

// ─── Analyses ─────────────────────────────────────────────────────────────────

const ANALYZE_LIMITS = { free: 5, pro: 999 } as const
const ANALYZE_WINDOW_H = 24

export async function checkAnalyzeLimit(
  userId: string,
  plan: string,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: SupabaseClient<any, any, any>
): Promise<RateLimitResult> {
  const limit = plan === 'free' ? ANALYZE_LIMITS.free : ANALYZE_LIMITS.pro
  const since = new Date(Date.now() - ANALYZE_WINDOW_H * 3600 * 1000).toISOString()

  const { count, error } = await supabase
    .from('analyses')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', userId)
    .in('status', ['complete', 'processing'])
    .gte('created_at', since)

  if (error) {
    // On DB error, let the request through rather than blocking users
    console.error('[rateLimit] analyze count error:', error)
    return { allowed: true, limit, used: 0, remaining: limit, resetInSeconds: 0 }
  }

  const used = count ?? 0
  return {
    allowed: used < limit,
    limit,
    used,
    remaining: Math.max(0, limit - used),
    resetInSeconds: ANALYZE_WINDOW_H * 3600,
  }
}

// ─── Chat ─────────────────────────────────────────────────────────────────────

const CHAT_LIMITS = { free: 40, pro: 999 } as const
const CHAT_WINDOW_H = 1

export async function checkChatLimit(
  userId: string,
  plan: string,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: SupabaseClient<any, any, any>
): Promise<RateLimitResult> {
  const limit = plan === 'free' ? CHAT_LIMITS.free : CHAT_LIMITS.pro
  const since = new Date(Date.now() - CHAT_WINDOW_H * 3600 * 1000).toISOString()

  const { count, error } = await supabase
    .from('chat_messages')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', userId)
    .gte('created_at', since)

  if (error) {
    // Table might not exist yet — fail open rather than blocking users
    console.error('[rateLimit] chat count error:', error)
    return { allowed: true, limit, used: 0, remaining: limit, resetInSeconds: 0 }
  }

  const used = count ?? 0
  return {
    allowed: used < limit,
    limit,
    used,
    remaining: Math.max(0, limit - used),
    resetInSeconds: CHAT_WINDOW_H * 3600,
  }
}

// ─── Helper: get user + plan from analysis ────────────────────────────────────

export async function getUserFromAnalysis(
  analysisId: string,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: SupabaseClient<any, any, any>
): Promise<{ userId: string; plan: string } | null> {
  const { data, error } = await supabase
    .from('analyses')
    .select('user_id, profiles(plan)')
    .eq('id', analysisId)
    .single()

  if (error || !data) return null

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const profile = (data as any).profiles as { plan?: string } | null
  return {
    userId: data.user_id as string,
    plan: profile?.plan ?? 'free',
  }
}
