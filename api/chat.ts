import Anthropic from '@anthropic-ai/sdk'
import { createClient, type SupabaseClient } from '@supabase/supabase-js'

// ─── Rate limiting (inlined — Vercel does not bundle local TS imports) ────────

async function checkChatLimit(userId: string, plan: string, supabase: SupabaseClient<any, any, any>) {
  try {
    if (plan === 'free') {
      const { count, error } = await supabase.from('chat_messages').select('id', { count: 'exact', head: true }).eq('user_id', userId)
      if (error) return { allowed: true, limit: 10, used: 0, remaining: 10, resetInSeconds: 0 }
      const used = count ?? 0
      return { allowed: used < 10, limit: 10, used, remaining: Math.max(0, 10 - used), resetInSeconds: 0, upgradeRequired: used >= 10 }
    }
    const since = new Date(Date.now() - 24 * 3600 * 1000).toISOString()
    const { count, error } = await supabase.from('chat_messages').select('id', { count: 'exact', head: true }).eq('user_id', userId).gte('created_at', since)
    if (error) return { allowed: true, limit: 100, used: 0, remaining: 100, resetInSeconds: 0 }
    const used = count ?? 0
    return { allowed: used < 100, limit: 100, used, remaining: Math.max(0, 100 - used), resetInSeconds: 24 * 3600 }
  } catch { return { allowed: true, limit: 10, used: 0, remaining: 10, resetInSeconds: 0 } }
}

// ─── Types ────────────────────────────────────────────────────────────────────

interface ChatMessage {
  role: 'user' | 'assistant'
  content: string
}

// ─── System prompt builder ─────────────────────────────────────────────────────

function buildSystemPrompt(context: {
  projectName: string
  stage: string
  focusAreas: string[]
  briefText?: string | null
  conceptScore: number
  spatialScore: number
  presentationScore: number
  feedback: Array<{ title: string; text: string; suggestion: string }>
  juryQuestions: string[]
} | null): string {
  const base = `You are an expert architecture jury critic and design coach integrated into Critup.ai. You have 20+ years of experience advising students at ETH Zurich, Bartlett, Harvard GSD, TU Berlin, and METU.

Your role is to:
- Give honest, specific, actionable advice based on the student's actual critique data
- Help students prepare for jury presentations
- Explain score breakdowns and improvement strategies
- Answer questions about architectural design, drawing standards, and presentation techniques
- Be encouraging but brutally honest — like a trusted mentor, not a yes-man

Keep responses concise and practical (2-4 short paragraphs max unless more detail is needed). Use plain language. No excessive formatting.`

  if (!context) {
    return base + `\n\nThe student hasn't analysed a project yet. Guide them to upload their drawings to get a full critique.`
  }

  const overallScore = ((context.conceptScore + context.spatialScore + context.presentationScore) / 3).toFixed(1)
  const weakest = [
    { name: 'Concept', score: context.conceptScore },
    { name: 'Spatial', score: context.spatialScore },
    { name: 'Presentation', score: context.presentationScore },
  ].sort((a, b) => a.score - b.score)[0]

  const feedbackSummary = context.feedback
    .map((f, i) => `${i + 1}. **${f.title}**: ${f.text} → ${f.suggestion}`)
    .join('\n')

  const jurySummary = context.juryQuestions.map((q, i) => `${i + 1}. ${q}`).join('\n')

  return `${base}

---
PROJECT CONTEXT (use this to give specific, relevant answers):

Project: "${context.projectName}"
Stage: ${context.stage}${context.focusAreas?.length ? `\nFocus areas: ${context.focusAreas.join(', ')}` : ''}${context.briefText ? `\n\nCOURSE BRIEF / DEPARTMENT REQUIREMENTS:\n${context.briefText}` : ''}

SCORES:
- Concept: ${context.conceptScore}/10
- Spatial: ${context.spatialScore}/10
- Presentation: ${context.presentationScore}/10
- Overall: ${overallScore}/10
- Weakest area: ${weakest.name} (${weakest.score}/10) — prioritise advice here

CRITIQUE FEEDBACK:
${feedbackSummary}

PREDICTED JURY QUESTIONS:
${jurySummary}

---
When students ask "what's my weakest area", refer to ${weakest.name} score specifically. When they ask about jury questions, refer to the predicted questions above. Always ground your advice in this specific project data.`
}

// ─── Handler ──────────────────────────────────────────────────────────────────

export default async function handler(
  req: { method: string; body: { messages: ChatMessage[]; analysisId?: string } },
  res: {
    status: (code: number) => { json: (body: unknown) => void; end: () => void }
    json: (body: unknown) => void
    setHeader: (key: string, value: string) => void
    write: (chunk: string) => void
    end: (data?: string) => void
    flushHeaders: () => void
  }
) {
  if (req.method !== 'POST') {
    return res.status(405).end()
  }

  const { messages, analysisId } = req.body
  if (!messages || !Array.isArray(messages) || messages.length === 0) {
    return res.status(400).json({ error: 'messages array required' })
  }

  const anthropicKey = process.env.ANTHROPIC_API_KEY || ''
  if (!anthropicKey) {
    return res.status(500).json({ error: 'Missing ANTHROPIC_API_KEY' })
  }

  const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || ''
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || ''

  // ── Optionally load analysis context + run rate limit ──────────────────────
  let analysisContext = null
  let rateLimitUserId: string | null = null
  let rateLimitPlan = 'free'

  if (supabaseUrl && serviceKey) {
    const supabase = createClient(supabaseUrl, serviceKey)

    if (analysisId) {
      try {
        const { data } = await supabase
          .from('analyses')
          .select('user_id, concept_score, spatial_score, presentation_score, feedback, jury_questions, projects(name, stage, focus_areas, brief_text), profiles(plan)')
          .eq('id', analysisId)
          .eq('status', 'complete')
          .single()

        if (data) {
          rateLimitUserId = data.user_id as string
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          rateLimitPlan = ((data as any).profiles as { plan?: string } | null)?.plan ?? 'free'
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const project = (data as any).projects as { name: string; stage: string; focus_areas: string[]; brief_text?: string | null } | null
          analysisContext = {
            projectName: project?.name ?? 'Untitled Project',
            stage: project?.stage ?? 'Unknown',
            focusAreas: project?.focus_areas ?? [],
            briefText: project?.brief_text ?? null,
            conceptScore: Number(data.concept_score) || 0,
            spatialScore: Number(data.spatial_score) || 0,
            presentationScore: Number(data.presentation_score) || 0,
            feedback: (data.feedback as Array<{ title: string; text: string; suggestion: string }>) || [],
            juryQuestions: (data.jury_questions as string[]) || [],
          }
        }
      } catch (e) {
        console.error('[chat] Failed to load analysis context:', e)
      }
    }

    // Rate limit: only enforce when we have a userId
    if (rateLimitUserId) {
      try {
        const rl = await checkChatLimit(rateLimitUserId, rateLimitPlan, supabase)
        if (!rl.allowed) {
          return res.status(429).json({
            error: 'limit_reached',
            feature: 'chat',
            plan: rateLimitPlan,
            message: rl.upgradeRequired
              ? "You've used your 10 free messages. Upgrade to Pro for unlimited chat."
              : `You've sent ${rl.used} messages today (limit ${rl.limit}). Try again tomorrow.`,
            limit: rl.limit,
            used: rl.used,
          })
        }

        // Log this message for rate tracking (fire-and-forget)
        supabase.from('chat_messages')
          .insert({ user_id: rateLimitUserId, analysis_id: analysisId ?? null })
          .then(() => {})
          .catch(() => {})
      } catch (e) {
        console.error('[chat] Rate limit check error:', e)
        // Fail open — don't block users on rate limit errors
      }
    }
  }

  // ── Call Claude ──────────────────────────────────────────────────────────────
  try {
    const anthropic = new Anthropic({ apiKey: anthropicKey })

    // Use claude-haiku for fast, cheap chat responses
    const response = await anthropic.messages.create({
      model: 'claude-haiku-4-5',
      max_tokens: 1024,
      system: buildSystemPrompt(analysisContext),
      messages: messages.map(m => ({
        role: m.role,
        content: m.content,
      })),
    })

    const text = response.content[0].type === 'text' ? response.content[0].text : ''
    return res.json({ reply: text })
  } catch (err) {
    console.error('[chat] Claude error:', err)
    return res.status(500).json({ error: 'Chat failed', detail: String(err) })
  }
}
