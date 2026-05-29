import { createClient } from '@supabase/supabase-js'

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

  const authHeader = (req.headers['authorization'] as string | undefined) || ''
  const jwt = authHeader.replace('Bearer ', '')
  if (!jwt) return res.status(401).json({ error: 'Unauthorized' })

  const anonKey = process.env.VITE_SUPABASE_ANON_KEY || ''
  const anonClient = createClient(supabaseUrl, anonKey)
  const { data: { user }, error: authErr } = await anonClient.auth.getUser(jwt)
  if (authErr || !user) return res.status(401).json({ error: 'Invalid token' })
  if (!ADMIN_EMAILS.includes(user.email ?? '')) return res.status(403).json({ error: 'Forbidden' })

  const supabase = createClient(supabaseUrl, serviceKey)

  const now = new Date()
  const last7  = new Date(now.getTime() - 7  * 24 * 3600 * 1000).toISOString()
  const last30 = new Date(now.getTime() - 30 * 24 * 3600 * 1000).toISOString()

  const [
    { count: totalUsers },
    { count: proUsers },
    { count: totalAnalyses },
    { count: failedAnalyses },
    { count: analyses7d },
    { count: analyses30d },
    { count: newUsers7d },
    { count: newUsers30d },
    { data: recentAnalysesRaw },
    { data: profilesRaw },
    { data: planBreakdown },
    { data: disciplineBreakdown },
    { data: signups30dRaw },
    { data: analyses30dRaw },
  ] = await Promise.all([
    supabase.from('profiles').select('id', { count: 'exact', head: true }),
    supabase.from('profiles').select('id', { count: 'exact', head: true }).neq('plan', 'free'),
    supabase.from('analyses').select('id', { count: 'exact', head: true }).eq('status', 'complete'),
    supabase.from('analyses').select('id', { count: 'exact', head: true }).eq('status', 'failed'),
    supabase.from('analyses').select('id', { count: 'exact', head: true }).eq('status', 'complete').gte('created_at', last7),
    supabase.from('analyses').select('id', { count: 'exact', head: true }).eq('status', 'complete').gte('created_at', last30),
    supabase.from('profiles').select('id', { count: 'exact', head: true }).gte('created_at', last7),
    supabase.from('profiles').select('id', { count: 'exact', head: true }).gte('created_at', last30),
    supabase.from('analyses')
      .select('id, status, created_at, concept_score, spatial_score, presentation_score, user_id, projects(name)')
      .eq('status', 'complete')
      .order('created_at', { ascending: false })
      .limit(20),
    // failed analyses for error log (fetched separately below)
    supabase.from('profiles')
      .select('id, plan, discipline, full_name, created_at')
      .order('created_at', { ascending: false })
      .limit(50),
    supabase.from('profiles').select('plan'),
    supabase.from('profiles').select('discipline'),
    // Daily signups for chart
    supabase.from('profiles').select('created_at').gte('created_at', last30),
    // Daily analyses for chart
    supabase.from('analyses').select('created_at').eq('status', 'complete').gte('created_at', last30),
  ])

  // Fetch emails for all profiles via auth.admin API
  const profileList = (profilesRaw ?? []) as { id: string; plan: string; discipline: string | null; full_name: string | null; created_at: string }[]
  const analysisRows = (recentAnalysesRaw ?? []) as { id: string; created_at: string; concept_score: number | null; spatial_score: number | null; presentation_score: number | null; user_id: string; projects: { name: string } | null }[]

  // Get unique user IDs from both sets
  const userIds = [...new Set([
    ...profileList.map(p => p.id),
    ...analysisRows.map(a => a.user_id),
  ])]

  // Fetch emails in bulk (service role can read auth.users)
  const emailMap: Record<string, string> = {}
  await Promise.all(
    userIds.map(async (uid) => {
      try {
        const { data } = await supabase.auth.admin.getUserById(uid)
        if (data?.user?.email) emailMap[uid] = data.user.email
      } catch { /* skip */ }
    })
  )

  // Fetch failed analyses separately (small set, full details)
  const { data: failedAnalysesRaw } = await supabase
    .from('analyses')
    .select('id, created_at, user_id, projects(name)')
    .eq('status', 'failed')
    .order('created_at', { ascending: false })
    .limit(20)

  const failedRows = (failedAnalysesRaw ?? []) as { id: string; created_at: string; user_id: string; projects: { name: string } | null }[]

  // Fetch emails for failed analysis users if not already in emailMap
  await Promise.all(
    failedRows
      .filter(a => !emailMap[a.user_id])
      .map(async (a) => {
        try {
          const { data } = await supabase.auth.admin.getUserById(a.user_id)
          if (data?.user?.email) emailMap[a.user_id] = data.user.email
        } catch { /* skip */ }
      })
  )

  const failedAnalyses = failedRows.map(a => ({
    ...a,
    email: emailMap[a.user_id] ?? null,
  }))

  // Plan distribution
  const planCounts: Record<string, number> = {}
  for (const row of (planBreakdown ?? []) as { plan: string }[]) {
    const p = row.plan || 'free'
    planCounts[p] = (planCounts[p] || 0) + 1
  }

  // Discipline distribution
  const discCounts: Record<string, number> = {}
  for (const row of (disciplineBreakdown ?? []) as { discipline: string | null }[]) {
    const d = row.discipline || 'unknown'
    discCounts[d] = (discCounts[d] || 0) + 1
  }

  const recentSignups = profileList.map(p => ({
    ...p,
    email: emailMap[p.id] ?? null,
  }))

  const recentAnalyses = analysisRows.map(a => ({
    ...a,
    email: emailMap[a.user_id] ?? null,
    avg_score: a.concept_score && a.spatial_score && a.presentation_score
      ? ((a.concept_score + a.spatial_score + a.presentation_score) / 3).toFixed(1)
      : null,
  }))

  // Build last-30-days chart data — one entry per day
  const dayMap = (rows: { created_at: string }[]) => {
    const counts: Record<string, number> = {}
    for (let i = 29; i >= 0; i--) {
      const d = new Date(now.getTime() - i * 24 * 3600 * 1000)
      counts[d.toISOString().slice(0, 10)] = 0
    }
    for (const r of rows) {
      const day = r.created_at.slice(0, 10)
      if (counts[day] !== undefined) counts[day]++
    }
    return Object.entries(counts).map(([date, count]) => ({ date, count }))
  }

  const signupsChart   = dayMap((signups30dRaw   ?? []) as { created_at: string }[])
  const analysesChart  = dayMap((analyses30dRaw  ?? []) as { created_at: string }[])

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
      failed: failedAnalyses ?? 0,
      last7d: analyses7d ?? 0,
      last30d: analyses30d ?? 0,
    },
    planBreakdown: planCounts,
    disciplineBreakdown: discCounts,
    recentAnalyses,
    failedAnalyses,
    recentSignups,
    signupsChart,
    analysesChart,
  })
}
