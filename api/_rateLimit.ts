/**
 * Supabase-backed rate limiting.
 *
 * Free plan limits (lifetime caps — never reset):
 *   • Analyses : 1 ever
 *   • Chat msgs: 10 ever
 *   • Jury      : blocked entirely (upgrade required)
 *
 * Pro plan limits (abuse protection — silent caps, not shown in UI):
 *   • Analyses : 30 / month  (rolling 30-day window)
 *   • Chat msgs: 100 / day
 *   • Jury      : 20 / day
 *
 * IP rate limit (all users, blocks scrapers/competitors):
 *   • Analyse endpoint: 5 requests / hour per IP
 */
import { type SupabaseClient } from '@supabase/supabase-js'

export interface RateLimitResult {
  allowed: boolean
  limit: number
  used: number
  remaining: number
  resetInSeconds: number
  /** Set when free user hits a hard wall — tells the UI which modal to show */
  upgradeRequired?: boolean
}

// ─── Analyses ─────────────────────────────────────────────────────────────────

export async function checkAnalyzeLimit(
  userId: string,
  plan: string,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: SupabaseClient<any, any, any>
): Promise<RateLimitResult> {
  try {
    if (plan === 'free') {
      // Lifetime cap: read the immutable counter from profiles
      const { data, error } = await supabase
        .from('profiles')
        .select('analyses_used')
        .eq('id', userId)
        .single()

      if (error) {
        console.error('[rateLimit] profiles fetch error:', error)
        return { allowed: true, limit: 1, used: 0, remaining: 1, resetInSeconds: 0 }
      }

      const used = (data as { analyses_used: number } | null)?.analyses_used ?? 0
      return {
        allowed: used < 1,
        limit: 1,
        used,
        remaining: Math.max(0, 1 - used),
        resetInSeconds: 0,
        upgradeRequired: used >= 1,
      }
    }

    // Pro: 30 analyses per rolling 30-day window (silent abuse protection — not shown in UI)
    const since = new Date(Date.now() - 30 * 24 * 3600 * 1000).toISOString()
    const { count, error } = await supabase
      .from('analyses')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', userId)
      .in('status', ['complete', 'processing'])
      .gte('created_at', since)

    if (error) {
      console.error('[rateLimit] analyze count error:', error)
      return { allowed: true, limit: 30, used: 0, remaining: 30, resetInSeconds: 0 }
    }

    const used = count ?? 0
    return {
      allowed: used < 30,
      limit: 30,
      used,
      remaining: Math.max(0, 30 - used),
      resetInSeconds: 30 * 24 * 3600,
    }
  } catch (e) {
    console.error('[rateLimit] checkAnalyzeLimit threw:', e)
    return { allowed: true, limit: 1, used: 0, remaining: 1, resetInSeconds: 0 }
  }
}

// ─── Chat ─────────────────────────────────────────────────────────────────────

export async function checkChatLimit(
  userId: string,
  plan: string,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: SupabaseClient<any, any, any>
): Promise<RateLimitResult> {
  try {
    if (plan === 'free') {
      // Lifetime cap: count all chat messages ever sent
      const { count, error } = await supabase
        .from('chat_messages')
        .select('id', { count: 'exact', head: true })
        .eq('user_id', userId)

      if (error) {
        console.error('[rateLimit] chat count error:', error)
        return { allowed: true, limit: 10, used: 0, remaining: 10, resetInSeconds: 0 }
      }

      const used = count ?? 0
      return {
        allowed: used < 10,
        limit: 10,
        used,
        remaining: Math.max(0, 10 - used),
        resetInSeconds: 0,
        upgradeRequired: used >= 10,
      }
    }

    // Pro: 100 messages per 24 h (abuse protection)
    const since = new Date(Date.now() - 24 * 3600 * 1000).toISOString()
    const { count, error } = await supabase
      .from('chat_messages')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', userId)
      .gte('created_at', since)

    if (error) {
      console.error('[rateLimit] chat count error:', error)
      return { allowed: true, limit: 100, used: 0, remaining: 100, resetInSeconds: 0 }
    }

    const used = count ?? 0
    return {
      allowed: used < 100,
      limit: 100,
      used,
      remaining: Math.max(0, 100 - used),
      resetInSeconds: 24 * 3600,
    }
  } catch (e) {
    console.error('[rateLimit] checkChatLimit threw:', e)
    return { allowed: true, limit: 10, used: 0, remaining: 10, resetInSeconds: 0 }
  }
}

// ─── Jury Practice ────────────────────────────────────────────────────────────

export async function checkJuryLimit(
  userId: string,
  plan: string,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: SupabaseClient<any, any, any>
): Promise<RateLimitResult> {
  if (plan === 'free') {
    return { allowed: false, limit: 0, used: 0, remaining: 0, resetInSeconds: 0, upgradeRequired: true }
  }

  try {
    // Pro: 20 jury sessions per 24 h
    const since = new Date(Date.now() - 24 * 3600 * 1000).toISOString()
    const { count, error } = await supabase
      .from('jury_sessions')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', userId)
      .gte('created_at', since)

    if (error) {
      // Table may not exist yet — fail open
      return { allowed: true, limit: 20, used: 0, remaining: 20, resetInSeconds: 24 * 3600 }
    }

    const used = count ?? 0
    return {
      allowed: used < 20,
      limit: 20,
      used,
      remaining: Math.max(0, 20 - used),
      resetInSeconds: 24 * 3600,
    }
  } catch (e) {
    console.error('[rateLimit] checkJuryLimit threw:', e)
    return { allowed: true, limit: 20, used: 0, remaining: 20, resetInSeconds: 0 }
  }
}

// ─── IP rate limit ────────────────────────────────────────────────────────────
// 5 requests per hour per IP on the analyse endpoint.
// Uses the rate_limit_ip table (created in migration 004).

export async function checkIpLimit(
  ip: string,
  endpoint: string,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: SupabaseClient<any, any, any>
): Promise<RateLimitResult> {
  const LIMIT = 5
  const WINDOW_H = 1

  try {
    const windowStart = new Date(Date.now() - WINDOW_H * 3600 * 1000).toISOString()

    const { data, error } = await supabase
      .from('rate_limit_ip')
      .select('window_start, count')
      .eq('ip', ip)
      .eq('endpoint', endpoint)
      .single()

    if (error || !data || (data as { window_start: string }).window_start < windowStart) {
      // No record or expired window — reset
      await supabase
        .from('rate_limit_ip')
        .upsert({ ip, endpoint, window_start: new Date().toISOString(), count: 1 })
      return { allowed: true, limit: LIMIT, used: 1, remaining: LIMIT - 1, resetInSeconds: WINDOW_H * 3600 }
    }

    const rec = data as { window_start: string; count: number }
    if (rec.count >= LIMIT) {
      return { allowed: false, limit: LIMIT, used: rec.count, remaining: 0, resetInSeconds: WINDOW_H * 3600 }
    }

    await supabase
      .from('rate_limit_ip')
      .update({ count: rec.count + 1 })
      .eq('ip', ip)
      .eq('endpoint', endpoint)

    return {
      allowed: true,
      limit: LIMIT,
      used: rec.count + 1,
      remaining: LIMIT - rec.count - 1,
      resetInSeconds: WINDOW_H * 3600,
    }
  } catch (e) {
    console.error('[rateLimit] checkIpLimit threw:', e)
    return { allowed: true, limit: LIMIT, used: 0, remaining: LIMIT, resetInSeconds: 0 }
  }
}

// ─── Helper ───────────────────────────────────────────────────────────────────

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
