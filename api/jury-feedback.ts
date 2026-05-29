import Anthropic from '@anthropic-ai/sdk'
import { createClient } from '@supabase/supabase-js'
import { checkJuryLimit } from './rateLimit'

// ─── Types ────────────────────────────────────────────────────────────────────

interface JuryFeedbackRequest {
  transcript: string
  question: string
  analysisId?: string
  duration?: number   // seconds the student spoke
}

interface JuryFeedbackResponse {
  whatLanded: string    // specific thing from their answer that actually worked
  theGap: string        // the key architectural argument that was missing
  betterFraming: string // concrete example of how to say it + WHY this framing works
  likelyFollowUp: string // next question the jury will ask based on this answer
}

// ─── Handler ──────────────────────────────────────────────────────────────────

export default async function handler(
  req: { method: string; body: JuryFeedbackRequest },
  res: {
    status: (code: number) => { json: (b: unknown) => void; end: () => void }
    json: (b: unknown) => void
  }
) {
  if (req.method !== 'POST') return res.status(405).end()

  const { transcript, question, analysisId, duration } = req.body ?? {}

  if (!transcript?.trim()) return res.status(400).json({ error: 'transcript required' })
  if (!question?.trim())   return res.status(400).json({ error: 'question required' })

  const anthropicKey  = process.env.ANTHROPIC_API_KEY || ''
  const supabaseUrl   = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || ''
  const serviceKey    = process.env.SUPABASE_SERVICE_ROLE_KEY || ''

  if (!anthropicKey) return res.status(500).json({ error: 'Missing ANTHROPIC_API_KEY' })

  // ── Plan check + jury rate limit ─────────────────────────────────────────────
  if (supabaseUrl && serviceKey) {
    try {
      const sb = createClient(supabaseUrl, serviceKey)

      // Get user plan from analysis (if analysisId provided) or from JWT header
      let userId: string | null = null
      let plan = 'free'

      if (analysisId) {
        const { data: aData } = await sb
          .from('analyses')
          .select('user_id, profiles(plan)')
          .eq('id', analysisId)
          .single()
        if (aData) {
          userId = aData.user_id as string
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          plan = ((aData as any).profiles as { plan?: string } | null)?.plan ?? 'free'
        }
      }

      if (userId) {
        const juryCheck = await checkJuryLimit(userId, plan, sb)
        if (!juryCheck.allowed) {
          return res.status(juryCheck.upgradeRequired ? 403 : 429).json({
            error: 'limit_reached',
            feature: 'jury',
            plan,
            message: juryCheck.upgradeRequired
              ? 'Jury Practice is a Pro feature. Upgrade to unlock unlimited practice sessions.'
              : `You've used ${juryCheck.used} jury sessions today (limit ${juryCheck.limit}).`,
          })
        }
      }
    } catch (e) {
      console.error('[jury-feedback] plan check error:', e)
      // Fail open
    }
  }

  // ── Load project context (optional — enriches feedback significantly) ──────
  let projectContext = ''
  if (analysisId && supabaseUrl && serviceKey) {
    try {
      const sb = createClient(supabaseUrl, serviceKey)
      const { data } = await sb
        .from('analyses')
        .select('concept_score, spatial_score, presentation_score, feedback, projects(name, stage, brief_text)')
        .eq('id', analysisId)
        .eq('status', 'complete')
        .single()

      if (data) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const proj = (data as any).projects as { name: string; stage: string; brief_text?: string | null } | null
        const feedbackTitles = Array.isArray(data.feedback)
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          ? (data.feedback as any[]).map((f: { title: string }) => f.title).join(', ')
          : ''

        projectContext = `
PROJECT CONTEXT:
- Project: "${proj?.name ?? 'Unknown'}"
- Design stage: ${proj?.stage ?? 'unknown'}
- Concept score: ${data.concept_score}/10
- Spatial score: ${data.spatial_score}/10
- Presentation score: ${data.presentation_score}/10
- Known critique points: ${feedbackTitles || 'none'}${proj?.brief_text ? `\n- Course brief: ${proj.brief_text}` : ''}`
      }
    } catch {
      // context load failed — still give feedback without it
    }
  }

  const durationNote = duration
    ? `The student spoke for ${duration} seconds.${duration < 15 ? ' This is too short — a real jury answer needs 30–60 seconds.' : duration > 90 ? ' This is too long — jury answers should be 30–60 seconds.' : ' Good length.'}`
    : ''

  // ── Build prompt ─────────────────────────────────────────────────────────────
  const systemPrompt = `You are an expert architecture presentation coach. You have trained hundreds of students at ETH Zurich, Bartlett, Harvard GSD, and METU on how to present and defend their design work in front of juries.

Your expertise is specifically in HOW to frame architectural arguments — the language, structure, and logic that makes a jury believe in a design. You know that architecture school is partly about design, partly about how you frame and defend what you made.

Your feedback is a coaching response, not a grade. Be direct, specific, and practical. Reference exactly what the student said. Show them a better version and explain WHY that framing works — what it signals to a jury, why it's more convincing.

Respond with ONLY valid JSON — no markdown outside the JSON.`

  const userPrompt = `A student was asked this jury question:
"${question}"

Their answer (transcript):
"${transcript}"

${durationNote}
${projectContext}

Give them coaching feedback. Respond with ONLY this JSON:
{
  "whatLanded": "<1-2 sentences: the specific thing from their actual answer that worked — be precise, quote their words if helpful. If nothing worked, say what showed potential>",
  "theGap": "<1-2 sentences: the key architectural argument, logic, or detail that was missing. What would a strong student have said that this student didn't? Connect to their actual project if context is available>",
  "betterFraming": "<3-5 sentences: show them HOW to say it better. Write it as if coaching them — give a concrete example of the reframed answer. Then explain WHY this framing is more convincing to a jury: what it signals, what it demonstrates about their thinking>",
  "likelyFollowUp": "<1 sentence: the exact follow-up question the jury will ask based on this answer — be specific, not generic>"
}`

  // ── Call Claude ───────────────────────────────────────────────────────────────
  try {
    const anthropic = new Anthropic({ apiKey: anthropicKey })
    const message = await anthropic.messages.create({
      model: 'claude-haiku-4-5',
      max_tokens: 1024,
      system: systemPrompt,
      messages: [{ role: 'user', content: userPrompt }],
    })

    const raw = message.content[0].type === 'text' ? message.content[0].text : ''
    const clean = raw.replace(/^```json\s*/i, '').replace(/^```\s*/i, '').replace(/\s*```$/i, '').trim()
    const result: JuryFeedbackResponse = JSON.parse(clean)

    return res.json(result)
  } catch (err) {
    console.error('[jury-feedback]', err)
    return res.status(500).json({ error: 'Feedback generation failed', detail: String(err) })
  }
}
