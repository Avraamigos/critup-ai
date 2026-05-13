import { createClient } from '@supabase/supabase-js'

// Verifies the caller is a real authenticated user, then permanently deletes
// them from auth.users. All related rows (profiles, projects, analyses,
// chat_messages) cascade automatically via FK ON DELETE CASCADE.
// Storage files (PDFs, audio) are orphaned but harmless — a scheduled cleanup
// job can remove them later.

export default async function handler(
  req: { method: string; headers: Record<string, string | undefined> },
  res: {
    status: (code: number) => { json: (b: unknown) => void; end: () => void }
    json: (b: unknown) => void
  }
) {
  if (req.method !== 'POST') return res.status(405).end()

  const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || ''
  const serviceKey  = process.env.SUPABASE_SERVICE_ROLE_KEY || ''
  const anonKey     = process.env.VITE_SUPABASE_ANON_KEY || ''

  if (!supabaseUrl || !serviceKey) return res.status(500).json({ error: 'Server misconfigured' })

  // Verify caller identity using their JWT
  const authHeader = req.headers['authorization'] ?? ''
  const token = authHeader.replace('Bearer ', '').trim()
  if (!token) return res.status(401).json({ error: 'Not authenticated' })

  const anonClient = createClient(supabaseUrl, anonKey)
  const { data: { user }, error: authErr } = await anonClient.auth.getUser(token)
  if (authErr || !user) return res.status(401).json({ error: 'Invalid or expired session' })

  // Delete via admin client (bypasses RLS, triggers cascade)
  const admin = createClient(supabaseUrl, serviceKey)
  const { error: deleteErr } = await admin.auth.admin.deleteUser(user.id)
  if (deleteErr) {
    console.error('[delete-account]', deleteErr)
    return res.status(500).json({ error: 'Failed to delete account', detail: deleteErr.message })
  }

  return res.json({ success: true })
}
