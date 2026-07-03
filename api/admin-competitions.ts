import type { VercelRequest, VercelResponse } from '@vercel/node'
import { createClient } from '@supabase/supabase-js'

import { isAdminEmail } from './_lib/auth.js'

const DISCIPLINES = ['architecture', 'interior', 'urban', 'landscape', 'multi']
const LEVELS = ['beginner', 'student', 'professional', 'any']

const FIELDS = [
  'title', 'image_url', 'summary', 'brief_text', 'discipline', 'deadline',
  'registration_deadline', 'prize', 'entry_fee', 'student_eligible', 'level',
  'team_required', 'location', 'organizer_url', 'is_active',
] as const

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function clean(body: Record<string, any>) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const out: Record<string, any> = {}
  for (const f of FIELDS) {
    if (f in body) out[f] = body[f]
  }
  // Normalise empty strings on optional text fields to null
  for (const f of ['image_url', 'summary', 'brief_text', 'registration_deadline', 'prize', 'entry_fee', 'location', 'organizer_url']) {
    if (out[f] === '') out[f] = null
  }
  return out
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || ''
  const serviceKey  = process.env.SUPABASE_SERVICE_ROLE_KEY || ''
  const anonKey     = process.env.VITE_SUPABASE_ANON_KEY || ''
  if (!supabaseUrl || !serviceKey) return res.status(500).json({ error: 'Missing env vars' })

  // Verify admin JWT
  const authHeader = (req.headers['authorization'] as string | undefined) || ''
  const jwt = authHeader.replace('Bearer ', '')
  if (!jwt) return res.status(401).json({ error: 'Unauthorized' })

  const anonClient = createClient(supabaseUrl, anonKey)
  const { data: { user }, error: authErr } = await anonClient.auth.getUser(jwt)
  if (authErr || !user) return res.status(401).json({ error: 'Invalid token' })
  if (!isAdminEmail(user.email)) return res.status(403).json({ error: 'Forbidden' })

  const supabase = createClient(supabaseUrl, serviceKey)

  // ── List all competitions (incl. inactive) ──
  if (req.method === 'GET') {
    const { data, error } = await supabase
      .from('competitions')
      .select('*')
      .order('deadline', { ascending: true })
    if (error) return res.status(500).json({ error: error.message })
    return res.json({ competitions: data ?? [] })
  }

  if (req.method !== 'POST') return res.status(405).end()

  const { action } = req.body as { action: string }

  // ── Create or update ──
  if (action === 'upsert') {
    const { id, competition } = req.body as { id?: string; competition: Record<string, unknown> }
    const payload = clean(competition)

    if (!payload.title || !payload.discipline || !payload.deadline) {
      return res.status(400).json({ error: 'title, discipline and deadline are required' })
    }
    if (!DISCIPLINES.includes(payload.discipline)) return res.status(400).json({ error: 'Invalid discipline' })
    if (payload.level && !LEVELS.includes(payload.level)) return res.status(400).json({ error: 'Invalid level' })

    if (id) {
      const { data, error } = await supabase.from('competitions').update(payload).eq('id', id).select('*').single()
      if (error) return res.status(500).json({ error: error.message })
      return res.json({ competition: data })
    } else {
      const { data, error } = await supabase.from('competitions').insert(payload).select('*').single()
      if (error) return res.status(500).json({ error: error.message })
      return res.json({ competition: data })
    }
  }

  // ── Activate / deactivate ──
  if (action === 'set_active') {
    const { id, is_active } = req.body as { id: string; is_active: boolean }
    if (!id) return res.status(400).json({ error: 'id required' })
    const { error } = await supabase.from('competitions').update({ is_active }).eq('id', id)
    if (error) return res.status(500).json({ error: error.message })
    return res.json({ success: true })
  }

  return res.status(400).json({ error: 'Unknown action' })
}
