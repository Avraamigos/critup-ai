import Anthropic from '@anthropic-ai/sdk'
import { createClient } from '@supabase/supabase-js'

// ─── Jury Prep — shorten one slide's script (cheap, Haiku) ────────────────────
// Paraphrases a single slide's presentation script to roughly half length while
// keeping the point and the chosen register. Pro-gated via the analysis owner,
// same as the rest of Jury Prep. This is a tiny call (a few hundred tokens).

const LEVELS = ['simple', 'natural', 'academic'] as const
type Level = typeof LEVELS[number]

const levelGuidance: Record<Level, string> = {
  simple: 'short, clear sentences with easy, common words',
  natural: 'confident, conversational spoken English',
  academic: 'formal architectural language, precise terminology',
}

const languageNames: Record<string, string> = { en: 'English', ru: 'Russian', tr: 'Turkish' }

export default async function handler(
  req: { method: string; body: { analysisId?: string; text?: string; languageLevel?: string } },
  res: {
    status: (code: number) => { json: (b: unknown) => void; end: () => void }
    json: (b: unknown) => void
  }
) {
  if (req.method !== 'POST') return res.status(405).end()

  const { analysisId, text, languageLevel } = req.body ?? {}
  if (!text?.trim()) return res.status(400).json({ error: 'text required' })
  const level: Level = LEVELS.includes(languageLevel as Level) ? (languageLevel as Level) : 'natural'

  const anthropicKey = process.env.ANTHROPIC_API_KEY || ''
  const supabaseUrl  = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || ''
  const serviceKey   = process.env.SUPABASE_SERVICE_ROLE_KEY || ''
  if (!anthropicKey) return res.status(500).json({ error: 'Missing ANTHROPIC_API_KEY' })

  // Pro gate + language, derived from the analysis owner (same pattern as jury-script).
  let langCode = 'en'
  if (analysisId && supabaseUrl && serviceKey) {
    try {
      const sb = createClient(supabaseUrl, serviceKey)
      const { data: a } = await sb.from('analyses').select('user_id').eq('id', analysisId).maybeSingle()
      const userId = (a as { user_id?: string } | null)?.user_id
      if (userId) {
        const { data: prof } = await sb.from('profiles').select('plan, language').eq('id', userId).maybeSingle()
        const plan = (prof as { plan?: string } | null)?.plan ?? 'free'
        langCode = ((prof as { language?: string | null } | null)?.language ?? 'en').toLowerCase()
        const { data: authUser } = await sb.auth.admin.getUserById(userId)
        const isAdmin = authUser?.user?.email === 'ibro12345@icloud.com'
        if (plan === 'free' && !isAdmin) {
          return res.status(403).json({ error: 'limit_reached', message: 'Jury Prep is a Pro feature.' })
        }
      }
    } catch {
      // fail open on the gate — the worst case is a free user shortening text, which is trivial cost
    }
  }

  const langNote = langCode !== 'en' && languageNames[langCode] ? ` Write the result in ${languageNames[langCode]}.` : ''

  try {
    const anthropic = new Anthropic({ apiKey: anthropicKey })
    const msg = await anthropic.messages.create({
      model: 'claude-haiku-4-5',
      max_tokens: 700,
      system: `You shorten a presentation-script passage that an architecture student will say out loud to a jury. Keep the key point and a ${levelGuidance[level]} register. Cut filler and repetition; keep it natural to speak aloud. Do not add new claims. Return ONLY the shortened passage — no preamble, no quotes, no explanation.${langNote}`,
      messages: [{ role: 'user', content: `Shorten this to roughly half its length, keeping what matters most:\n\n${text}` }],
    })
    const out = msg.content[0].type === 'text' ? msg.content[0].text.trim() : ''
    if (!out) return res.status(500).json({ error: 'failed', message: 'Could not shorten this slide. Please try again.' })
    return res.json({ text: out })
  } catch (err) {
    console.error('[jury-script-shorten]', err)
    return res.status(500).json({ error: 'failed', message: 'Could not shorten this slide. Please try again.' })
  }
}
