import { createClient } from '@supabase/supabase-js'

import { isAdminEmail } from './_lib/auth'

export default async function handler(
  req: {
    method: string
    headers: Record<string, string | string[] | undefined>
    body: { action: string; userId?: string }
  },
  res: {
    status: (code: number) => { json: (body: unknown) => void; end: () => void }
    json: (body: unknown) => void
  }
) {
  if (req.method !== 'POST') return res.status(405).end()

  const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || ''
  const serviceKey  = process.env.SUPABASE_SERVICE_ROLE_KEY || ''
  if (!supabaseUrl || !serviceKey) return res.status(500).json({ error: 'Missing env vars' })

  // Verify admin JWT
  const authHeader = (req.headers['authorization'] as string | undefined) || ''
  const jwt = authHeader.replace('Bearer ', '')
  if (!jwt) return res.status(401).json({ error: 'Unauthorized' })

  const anonKey = process.env.VITE_SUPABASE_ANON_KEY || ''
  const anonClient = createClient(supabaseUrl, anonKey)
  const { data: { user }, error: authErr } = await anonClient.auth.getUser(jwt)
  if (authErr || !user) return res.status(401).json({ error: 'Invalid token' })
  if (!isAdminEmail(user.email)) return res.status(403).json({ error: 'Forbidden' })

  const supabase = createClient(supabaseUrl, serviceKey)
  const { action, userId } = req.body

  // ── Reset free analysis counter ──────────────────────────────────────────────
  if (action === 'reset_analyses') {
    if (!userId) return res.status(400).json({ error: 'userId required' })
    const { error } = await supabase
      .from('profiles')
      .update({ analyses_used: 0 })
      .eq('id', userId)
    if (error) return res.status(500).json({ error: error.message })
    return res.json({ success: true })
  }

  // ── Delete user ───────────────────────────────────────────────────────────────
  if (action === 'delete_user') {
    if (!userId) return res.status(400).json({ error: 'userId required' })

    // Delete in order: analyses → projects → profile → auth user
    // (foreign key cascades may handle some of these, but be explicit)
    await supabase.from('analyses').delete().eq('user_id', userId)
    await supabase.from('projects').delete().eq('user_id', userId)
    await supabase.from('profiles').delete().eq('id', userId)
    const { error } = await supabase.auth.admin.deleteUser(userId)
    if (error) return res.status(500).json({ error: error.message })
    return res.json({ success: true })
  }

  return res.status(400).json({ error: 'Unknown action' })
}
