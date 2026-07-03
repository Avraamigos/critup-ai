import { createClient } from '@supabase/supabase-js'

import { isAdminEmail } from './_lib/auth'

export default async function handler(
  req: {
    method: string
    headers: Record<string, string | string[] | undefined>
    body: { userId: string; plan: string }
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

  const authHeader = (req.headers['authorization'] as string | undefined) || ''
  const jwt = authHeader.replace('Bearer ', '')
  if (!jwt) return res.status(401).json({ error: 'Unauthorized' })

  const anonKey = process.env.VITE_SUPABASE_ANON_KEY || ''
  const anonClient = createClient(supabaseUrl, anonKey)
  const { data: { user }, error: authErr } = await anonClient.auth.getUser(jwt)
  if (authErr || !user) return res.status(401).json({ error: 'Invalid token' })
  if (!isAdminEmail(user.email)) return res.status(403).json({ error: 'Forbidden' })

  const { userId, plan } = req.body
  if (!userId || !plan) return res.status(400).json({ error: 'userId and plan required' })
  if (!['free', 'monthly', 'yearly'].includes(plan)) return res.status(400).json({ error: 'Invalid plan' })

  const supabase = createClient(supabaseUrl, serviceKey)
  const { error } = await supabase.from('profiles').update({ plan }).eq('id', userId)
  if (error) return res.status(500).json({ error: error.message })

  return res.json({ success: true })
}
