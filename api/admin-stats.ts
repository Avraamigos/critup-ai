import { createClient } from '@supabase/supabase-js'
import Anthropic from '@anthropic-ai/sdk'

const ADMIN_EMAILS = ['ibro12345@icloud.com']

export default async function handler(
  req: {
    method: string
    headers: Record<string, string | string[] | undefined>
  },
  res: {
    status: (code: number) => { json: (body: unknown) => void; end: () => void }
    json: (body: unknown) => void
  }
) {
  if (req.method !== 'GET') return res.status(405).end()

  const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || ''
  const serviceKey  = process.env.SUPABASE_SERVICE_ROLE_KEY || ''
  if (!supabaseUrl || !serviceKey) return res.status(500).json({ error: 'Missing env vars' })

  // Verify caller is an admin by checking their JWT
  const authHeader = (req.headers['authorization'] as string | undefined) || ''
  const jwt = authHeader.replace('Bearer ', '')
  if (!jwt) return res.status(401).json({ error: 'Unauthorized' })

  // Use anon key to verify the JWT (safe — just reads the token)
  const anonKey = process.env.VITE_SUPABASE_ANON_KEY || ''
  const anonClient = createClient(supabaseUrl, anonKey)
  const { data: { user }, error: authErr } = await anonClient.auth.getUser(jwt)
  if (authErr || !user) return res.status(401).json({ error: 'Invalid token' })
  if (!ADMIN_EMAILS.includes(user.email ?? '')) return res.status(403).json({ error: 'Forbidden' })

  // Admin verified — use service role for full DB access
  const supabase = createClient(supabaseUrl, serviceKey)

  const now = new Date()
  const last7  = new Date(now.getTime() - 7  * 24 * 3600 * 1000).toISOString()
  const last30 = new Date(now.getTime() - 30 * 24 * 3600 * 1000).toISOString()

  const [
    { count: totalUsers },
    { count: proUsers },
    { count: totalAnalyses },
    { count: analyses7d },
    { count: analyses30d },
    { count: newUsers7d },
    { count: newUsers30d },
    { data: recentAnalyses },
    { data: recentSignups },
    { data: planBreakdown },
    { data: disciplineBreakdown },
  ] = await Promise.all([
    supabase.from('profiles').select('id', { count: 'exact', head: true }),
    supabase.from('profiles').select('id', { count: 'exact', head: true }).neq('plan', 'free'),
    supabase.from('analyses').select('id', { count: 'exact', head: true }).eq('status', 'complete'),
    supabase.from('analyses').select('id', { count: 'exact', head: true }).eq('status', 'complete').gte('created_at', last7),
    supabase.from('analyses').select('id', { count: 'exact', head: true }).eq('status', 'complete').gte('created_at', last30),
    supabase.from('profiles').select('id', { count: 'exact', head: true }).gte('created_at', last7),
    supabase.from('profiles').select('id', { count: 'exact', head: true }).gte('created_at', last30),
    supabase.from('analyses')
      .select('id, status, created_at, projects(name), profiles(id)')
      .eq('status', 'complete')
      .order('created_at', { ascending: false })
      .limit(10),
    supabase.from('profiles')
      .select('id, plan, discipline, created_at')
      .order('created_at', { ascending: false })
      .limit(10),
    supabase.from('profiles')
      .select('plan'),
    supabase.from('profiles')
      .select('discipline'),
  ])

  // Tally plan distribution
  const planCounts: Record<string, number> = {}
  for (const row of (planBreakdown ?? []) as { plan: string }[]) {
    const p = row.plan || 'free'
    planCounts[p] = (planCounts[p] || 0) + 1
  }

  // Tally discipline distribution
  const discCounts: Record<string, number> = {}
  for (const row of (disciplineBreakdown ?? []) as { discipline: string | null }[]) {
    const d = row.discipline || 'unknown'
    discCounts[d] = (discCounts[d] || 0) + 1
  }

  return res.json({
    users: {
      total: totalUsers ?? 0,
      pro: proUsers ?? 0,
      free: (totalUsers ?? 0) - (proUsers ?? 0),
      new7d: newUsers7d ?? 0,
      new30d: newUsers30d ?? 0,
    },
    analyses: {
      total: totalAnalyses ?? 0,
      last7d: analyses7d ?? 0,
      last30d: analyses30d ?? 0,
    },
    planBreakdown: planCounts,
    disciplineBreakdown: discCounts,
    recentAnalyses: recentAnalyses ?? [],
    recentSignups: recentSignups ?? [],
  })
}
