import Anthropic from '@anthropic-ai/sdk'
import { createClient, type SupabaseClient } from '@supabase/supabase-js'

// ─── Jury Prep — presentation script generation (Pro-only, heavy) ─────────────
// This is the ONE expensive jury call. It re-reads the full stored PDF plus the
// stored critique + Q&A, and writes a per-slide presentation script. Results are
// cached in jury_scripts per (analysis, language_level) so re-opening the page or
// switching levels never re-charges. Forcing a fresh generation is rate-limited
// via jury_script_events.

const LEVELS = ['simple', 'natural', 'academic'] as const
type Level = typeof LEVELS[number]

// Regenerations per rolling 30 days per user. Cache hits do NOT count.
const REGEN_LIMIT = 15

const levelGuidance: Record<Level, string> = {
  simple:
    'SIMPLE ENGLISH register: short, clear sentences. Easy, common vocabulary. No long subordinate clauses. Written for a nervous or less-fluent speaker who needs to say it out loud without stumbling. Still confident and correct — just plain.',
  natural:
    'NATURAL register: confident, conversational spoken English. The way a well-prepared student actually talks to a jury — relaxed but articulate, not stiff, not slangy.',
  academic:
    'ACADEMIC register: formal architectural language, theory-aware where the project supports it. Precise terminology (parti, datum, threshold, poché, etc.) used correctly — never as decoration.',
}

const languageNames: Record<string, string> = { en: 'English', ru: 'Russian', tr: 'Turkish' }

interface ScriptRequest {
  analysisId: string
  languageLevel: Level
  regenerate?: boolean
}

async function countRecentRegens(userId: string, supabase: SupabaseClient<any, any, any>) {
  const since = new Date(Date.now() - 30 * 24 * 3600 * 1000).toISOString()
  const { count } = await supabase
    .from('jury_script_events')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', userId)
    .gte('created_at', since)
  return count ?? 0
}

export default async function handler(
  req: { method: string; body: ScriptRequest },
  res: {
    status: (code: number) => { json: (b: unknown) => void; end: () => void }
    json: (b: unknown) => void
  }
) {
  if (req.method !== 'POST') return res.status(405).end()

  const { analysisId, languageLevel, regenerate } = req.body ?? ({} as ScriptRequest)
  if (!analysisId) return res.status(400).json({ error: 'analysisId required' })
  const level: Level = LEVELS.includes(languageLevel) ? languageLevel : 'natural'

  const supabaseUrl  = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || ''
  const serviceKey   = process.env.SUPABASE_SERVICE_ROLE_KEY || ''
  const anthropicKey = process.env.ANTHROPIC_API_KEY || ''

  if (!supabaseUrl || !serviceKey || !anthropicKey) {
    return res.status(500).json({ error: 'Missing environment variables' })
  }

  const supabase = createClient(supabaseUrl, serviceKey)

  try {
    // 1. Load the analysis + its project + the stored grounding material.
    //    Don't embed profiles() (no FK) — fetch the plan/language separately.
    const { data: analysis, error: fetchErr } = await supabase
      .from('analyses')
      .select('id, user_id, pdf_path, status, feedback, jury_qa, concept_score, spatial_score, presentation_score, projects(name, stage, brief_text)')
      .eq('id', analysisId)
      .single()

    if (fetchErr || !analysis) return res.status(404).json({ error: 'Analysis not found' })
    if (analysis.status !== 'complete') return res.status(400).json({ error: 'Analysis is not complete yet' })

    const userId = analysis.user_id as string | null
    if (!userId) return res.status(400).json({ error: 'Analysis has no owner' })

    // 2. Plan + language from the profile.
    const { data: prof } = await supabase
      .from('profiles')
      .select('plan, language')
      .eq('id', userId)
      .maybeSingle()
    const plan = (prof as { plan?: string } | null)?.plan ?? 'free'
    const langCode = ((prof as { language?: string | null } | null)?.language ?? 'en').toLowerCase()

    // Owner email — admin bypasses the Pro gate and the rate limit (for testing).
    const { data: authUser } = await supabase.auth.admin.getUserById(userId)
    const isAdmin = authUser?.user?.email === 'ibro12345@icloud.com'

    if (plan === 'free' && !isAdmin) {
      return res.status(403).json({
        error: 'limit_reached',
        feature: 'jury_script',
        plan,
        message: 'Generating a presentation script is a Pro feature. Upgrade to unlock it.',
      })
    }

    // 3. Cache check — return the stored script unless a regenerate was requested.
    if (!regenerate) {
      const { data: cached } = await supabase
        .from('jury_scripts')
        .select('slides')
        .eq('analysis_id', analysisId)
        .eq('language_level', level)
        .maybeSingle()
      if (cached && Array.isArray((cached as { slides?: unknown }).slides) && (cached as { slides: unknown[] }).slides.length) {
        return res.json({ slides: (cached as { slides: unknown[] }).slides, cached: true })
      }
    }

    // 4. Regeneration rate limit (a real Claude call is about to happen).
    if (!isAdmin) {
      const used = await countRecentRegens(userId, supabase)
      if (used >= REGEN_LIMIT) {
        return res.status(429).json({
          error: 'limit_reached',
          feature: 'jury_script',
          message: `You've generated ${used} scripts this month (limit ${REGEN_LIMIT}). Previously generated scripts are still available instantly.`,
        })
      }
    }

    // 5. Download the stored PDF (full re-read, per the product decision).
    if (!analysis.pdf_path) return res.status(400).json({ error: 'No PDF attached to this analysis' })
    const { data: fileData, error: dlErr } = await supabase.storage
      .from('project-pdfs')
      .download(analysis.pdf_path as string)
    if (dlErr || !fileData) return res.status(500).json({ error: 'Failed to download PDF' })

    const pdfBuffer = await fileData.arrayBuffer()
    const pdfSizeMB = pdfBuffer.byteLength / (1024 * 1024)
    if (pdfSizeMB > 22) return res.status(413).json({ error: 'PDF too large for API' })
    const pdfBase64 = Buffer.from(pdfBuffer).toString('base64')

    // 6. Build grounding context from the stored critique + Q&A.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const project = (analysis as any).projects as { name: string; stage: string; brief_text?: string | null } | null
    const feedbackArr = Array.isArray(analysis.feedback) ? (analysis.feedback as Array<{ title?: string; text?: string; suggestion?: string }>) : []
    const qaArr = Array.isArray(analysis.jury_qa) ? (analysis.jury_qa as Array<{ question?: string; answer?: string }>) : []

    const feedbackText = feedbackArr
      .map((f, i) => `${i + 1}. ${f.title ?? ''} — ${f.text ?? ''}${f.suggestion ? ` (suggested: ${f.suggestion})` : ''}`)
      .join('\n')
    const qaText = qaArr
      .map((p, i) => `Q${i + 1}: ${p.question ?? ''}\nA: ${p.answer ?? ''}`)
      .join('\n')

    const groundingContext = `PROJECT: "${project?.name ?? 'Untitled'}"
DESIGN STAGE: ${project?.stage ?? 'unknown'}
SCORES — concept ${analysis.concept_score ?? '?'}/10, spatial ${analysis.spatial_score ?? '?'}/10, presentation ${analysis.presentation_score ?? '?'}/10
${project?.brief_text ? `COURSE BRIEF:\n${project.brief_text}\n` : ''}
CRITIQUE ALREADY GIVEN ON THIS PROJECT:
${feedbackText || '(none)'}

LIKELY JURY QUESTIONS + SUGGESTED ANSWERS:
${qaText || '(none)'}`

    const languageNote =
      langCode !== 'en' && languageNames[langCode]
        ? `\n\nWrite the ENTIRE script — slideTitle, script, and why — in ${languageNames[langCode]}. Keep the JSON keys in English. The register/level guidance still applies, expressed in ${languageNames[langCode]}.`
        : ''

    const systemPrompt = `You are an expert architecture presentation coach who has prepared hundreds of students at ETH, Bartlett, Harvard GSD and METU to present and defend their projects in front of juries.

You write a per-slide presentation SCRIPT: what the student should actually SAY on each board/section of their presentation.

ABSOLUTE ACCURACY RULES — these matter more than fluency:
- Ground every line strictly in what is VISIBLE in the uploaded project and in the critique provided. Walk the actual sequence of the boards/slides in the PDF.
- NEVER invent design rationale, concepts, data, or intentions the student did not show. If you suggest a framing the student could adopt, mark it clearly as a suggestion to adapt — e.g. "You can frame your atrium as a daylighting response — adjust this to match your real intent." Do NOT present inferred intent as fact for them to recite blindly.
- If a board is weak (per the critique), coach them on how to present it honestly and turn the weakness into a controlled, confident moment — not how to hide it.

For EACH slide, also include a short PSYCHOLOGICAL explanation of WHY to frame it that way — what it does to the jury's perception. The reasoning is part of the value: it teaches persuasion and perception, not just words. Example: "Say it this way because a jury forms its first impression in the first 10 seconds, like clients — leading with the problem shows you understand purpose before form."

LANGUAGE LEVEL FOR THE SCRIPT TEXT:
${levelGuidance[level]}${languageNote}

Respond with ONLY valid JSON — no markdown, no text outside the JSON.`

    const userPrompt = `Here is the student's project PDF and everything already known about it.

${groundingContext}

Walk through the presentation slide by slide (follow the actual order of boards in the PDF) and write the script.

Respond with ONLY this JSON:
{
  "slides": [
    {
      "slideTitle": "<which board/section this is, e.g. 'Title & Concept', 'Site Analysis', 'Ground Floor Plan', 'Sections', 'Conclusion'>",
      "script": "<what the student should say on this slide — grounded in what is visible. Use the chosen language level. Mark any inferred intent as an adaptable suggestion, not fact.>",
      "why": "<1-2 sentences: the psychological/persuasion reason to frame this slide this way — what it signals to the jury>"
    }
  ]
}

Cover the real sequence of the project's boards. Aim for one entry per meaningful slide/section.`

    // 7. Call Claude with the PDF.
    const anthropic = new Anthropic({ apiKey: anthropicKey })
    const message = await anthropic.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 8000,
      system: systemPrompt,
      messages: [
        {
          role: 'user',
          content: [
            { type: 'document', source: { type: 'base64', media_type: 'application/pdf', data: pdfBase64 } },
            { type: 'text', text: userPrompt },
          ],
        },
      ],
    })

    const tokIn  = message.usage?.input_tokens  ?? 0
    const tokOut = message.usage?.output_tokens ?? 0
    const costUSD = (tokIn / 1_000_000 * 3) + (tokOut / 1_000_000 * 15)
    console.log(`[jury-script] level:${level} tokens — in:${tokIn} out:${tokOut} cost:$${costUSD.toFixed(4)}`)

    const raw = message.content[0].type === 'text' ? message.content[0].text : ''
    const clean = raw.replace(/^```json\s*/i, '').replace(/^```\s*/i, '').replace(/\s*```$/i, '').trim()
    let parsed: { slides?: unknown } | null = null
    try { parsed = JSON.parse(clean) } catch {
      const m = raw.match(/\{[\s\S]*\}/)
      if (m) { try { parsed = JSON.parse(m[0]) } catch { /* fall through */ } }
    }

    const slidesRaw = parsed && Array.isArray(parsed.slides) ? (parsed.slides as Record<string, unknown>[]) : []
    const slides = slidesRaw
      .filter(s => s && typeof s === 'object' && typeof s.script === 'string' && (s.script as string).trim())
      .map(s => ({
        slideTitle: typeof s.slideTitle === 'string' ? s.slideTitle.trim() : '',
        script: String(s.script).trim(),
        why: typeof s.why === 'string' ? s.why.trim() : '',
      }))

    if (slides.length === 0) {
      console.error('[jury-script] no usable slides. stop_reason:', message.stop_reason, 'raw:', raw.slice(0, 400))
      return res.status(500).json({ error: 'Could not generate a script, please try again' })
    }

    // 8. Cache the result (upsert per analysis × level) and log the regen event.
    await supabase
      .from('jury_scripts')
      .upsert(
        { analysis_id: analysisId, user_id: userId, language_level: level, slides, updated_at: new Date().toISOString() },
        { onConflict: 'analysis_id,language_level' }
      )
    await supabase.from('jury_script_events').insert({ user_id: userId })

    return res.json({ slides, cached: false })
  } catch (err) {
    console.error('[jury-script]', err)
    return res.status(500).json({ error: 'Script generation failed', detail: String(err) })
  }
}
