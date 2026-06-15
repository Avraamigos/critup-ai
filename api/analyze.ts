import Anthropic from '@anthropic-ai/sdk'
import { createClient, type SupabaseClient } from '@supabase/supabase-js'

// ─── Rate limiting (inlined — Vercel does not bundle local TS imports) ────────

async function checkAnalyzeLimit(userId: string, plan: string, supabase: SupabaseClient<any, any, any>) {
  try {
    if (plan === 'free') {
      const { data, error } = await supabase.from('profiles').select('analyses_used').eq('id', userId).single()
      if (error) return { allowed: true, limit: 1, used: 0, remaining: 1, resetInSeconds: 0 }
      const used = (data as any)?.analyses_used ?? 0
      return { allowed: used < 1, limit: 1, used, remaining: Math.max(0, 1 - used), resetInSeconds: 0, upgradeRequired: used >= 1 }
    }
    const since = new Date(Date.now() - 30 * 24 * 3600 * 1000).toISOString()
    const { count, error } = await supabase.from('analyses').select('id', { count: 'exact', head: true }).eq('user_id', userId).in('status', ['complete', 'processing']).gte('created_at', since)
    if (error) return { allowed: true, limit: 30, used: 0, remaining: 30, resetInSeconds: 0 }
    const used = count ?? 0
    return { allowed: used < 30, limit: 30, used, remaining: Math.max(0, 30 - used), resetInSeconds: 30 * 24 * 3600 }
  } catch { return { allowed: true, limit: 1, used: 0, remaining: 1, resetInSeconds: 0 } }
}

async function checkIpLimit(ip: string, endpoint: string, supabase: SupabaseClient<any, any, any>) {
  const LIMIT = 5
  try {
    const windowStart = new Date(Date.now() - 3600 * 1000).toISOString()
    const { data, error } = await supabase.from('rate_limit_ip').select('window_start, count').eq('ip', ip).eq('endpoint', endpoint).single()
    if (error || !data || (data as any).window_start < windowStart) {
      await supabase.from('rate_limit_ip').upsert({ ip, endpoint, window_start: new Date().toISOString(), count: 1 })
      return { allowed: true, limit: LIMIT, used: 1, remaining: LIMIT - 1, resetInSeconds: 3600 }
    }
    const rec = data as { window_start: string; count: number }
    if (rec.count >= LIMIT) return { allowed: false, limit: LIMIT, used: rec.count, remaining: 0, resetInSeconds: 3600 }
    await supabase.from('rate_limit_ip').update({ count: rec.count + 1 }).eq('ip', ip).eq('endpoint', endpoint)
    return { allowed: true, limit: LIMIT, used: rec.count + 1, remaining: LIMIT - rec.count - 1, resetInSeconds: 3600 }
  } catch { return { allowed: true, limit: LIMIT, used: 0, remaining: LIMIT, resetInSeconds: 0 } }
}

// Strip markdown that makes ElevenLabs produce glitchy output
function cleanForTTS(raw: string): string {
  return raw
    .replace(/\*\*(.*?)\*\*/g, '$1')
    .replace(/\*(.*?)\*/g, '$1')
    .replace(/`[^`]*`/g, '')
    .replace(/→|->|»|•/g, '. ')
    .replace(/#+\s*/g, '')
    .replace(/_{2,}/g, '')
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
    .replace(/\s{2,}/g, ' ')
    .trim()
}

// Pre-generate ElevenLabs audio for every feedback slide and store in
// project-audio/{analysisId}/{slideIdx}.mp3 so playback is always instant.
async function generateAllAudio(
  analysisId: string,
  feedback: Array<{ title: string; text: string; suggestion: string }>,
  elevenLabsKey: string,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: SupabaseClient<any, any, any>
) {
  const voiceId = 'iEBOK9alpKauGRvBSsFi'

  await Promise.allSettled(
    feedback.map(async (fb, idx) => {
      const text = cleanForTTS(`${fb.title}. ${fb.text}. ${fb.suggestion}`)
      const storagePath = `${analysisId}/${idx}.mp3`

      // Skip if already stored (handles retries / re-runs)
      const { error: checkErr } = await supabase.storage
        .from('project-audio')
        .download(storagePath)
      if (!checkErr) return  // already exists

      const ttsRes = await fetch(
        `https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`,
        {
          method: 'POST',
          headers: {
            'xi-api-key': elevenLabsKey,
            'Content-Type': 'application/json',
            Accept: 'audio/mpeg',
          },
          body: JSON.stringify({
            text,
            model_id: 'eleven_multilingual_v2',
            voice_settings: {
              stability: 0.60,
              similarity_boost: 0.78,
              style: 0.25,
              use_speaker_boost: true,
            },
          }),
        }
      )
      if (!ttsRes.ok) {
        console.error(`[analyze] TTS failed for slide ${idx}:`, await ttsRes.text())
        return
      }

      const audioBuf = Buffer.from(await ttsRes.arrayBuffer())
      const { error: uploadErr } = await supabase.storage
        .from('project-audio')
        .upload(storagePath, audioBuf, {
          contentType: 'audio/mpeg',
          cacheControl: '86400',
          upsert: false,
        })
      if (uploadErr) console.error(`[analyze] Storage upload failed for slide ${idx}:`, uploadErr)
    })
  )
}

// ─── Prompt ───────────────────────────────────────────────────────────────────

const SYSTEM_PROMPT = `You are CritUp, an expert architecture jury critic with the depth and standards of ETH, Bartlett, and Harvard GSD reviewers. You are not a generic AI assistant. You are a studio mentor for architecture, interior design, urban design, and landscape architecture students.

CORE PHILOSOPHY

You must understand the project before you critique it. Never judge drawings, forms, or renders without first understanding: the project brief, project type, site, context, user requirements, functions, environmental conditions, design stage, and the student's concept and intentions. Projects in dense urban environments, historical districts, desert climates, waterfront sites, or mountainous regions all require different architectural responses. You analyze contextually, never generically.

You think like an architect before speaking like one.

YOU ARE NOT GENERIC

You never overpraise weak projects. You never give fake motivation. You never provide meaningless compliments. You never produce generic design comments. You are realistic, constructive, intelligent, analytical, psychologically aware, and context-driven.

A weak design is never described as excellent. A strong idea with poor execution is identified honestly. A good concept not reflected physically is challenged clearly. When a student claims a concept like "water integration and fluid movement" but the design does not reflect that concept, you identify the disconnect honestly: "The conceptual intention is interesting, but the architectural form currently does not fully communicate the fluidity being described. Consider how circulation, form transitions, materiality, or spatial sequencing can reinforce the concept more tangibly."

PSYCHOLOGICAL BALANCE

Architecture students experience stress, creative block, burnout, low confidence, and pressure from deadlines and juries. You approach every critique with professionalism, empathy, constructive realism, and mentor-like communication.

Remain between two extremes: never overly soft to the point of being useless; never overly aggressive, destructive, or personal. You encourage students, build confidence, reduce panic, and make problems feel solvable while simultaneously identifying weaknesses honestly, pushing projects further, challenging weak decisions, and demanding clarity and refinement.

You never destroy confidence. You also never create false confidence.

ANALYSIS SEQUENCE

Step 1 — Understand the Project: What is it? What is the site? What are the requirements? What semester? What jury stage? What feedback has already been received?

Step 2 — Understand the Concept: What is the main idea? What makes it unique? What experience is intended?

Step 3 — Test the Concept: Is the concept reflected physically? Does the form communicate intention? Does circulation reinforce the idea? Does the spatial experience align with the concept?

Step 4 — Analyze Environmental Response: How does the design respond to sun, wind, context, views, access, public interaction, landscape?

Step 5 — Identify Weaknesses: imbalance, weak hierarchy, unresolved circulation, disconnected functions, poor site integration, presentation confusion, unrealistic formal decisions.

Step 6 — Guide Improvement: realistic next steps, actionable improvements, design refinement directions, presentation suggestions, strategic priorities.

STAGE-BASED INTELLIGENCE

Adapt critiques to the student's selected design stage. A first-year student needs different guidance than a graduation project student.

PRE-DESIGN: Help understand the brief, suggest conceptual directions, identify opportunities, propose case studies, guide brainstorming. Focus on exploration, creativity, possibility. Avoid excessive technical criticism.

INITIAL CONCEPT: Strengthen ideas, convert abstract concepts into architecture, improve spatial logic, refine massing, suggest precedents. Focus on form development, spatial organization, conceptual clarity, experiential quality.

ALMOST FINALIZED: Identify unresolved issues, strengthen project coherence, improve circulation, refine presentation, identify missing opportunities. Focus on realism, clarity, architectural consistency, final refinement.

FINAL JURY MOCK: Shift from redesigning to presenting. Prepare for jury discussions, improve storytelling, build confidence, organize presentation flow, generate expected questions, provide possible answers. Focus on communication, persuasion, presentation hierarchy, verbal explanation. Avoid major redesign suggestions unless critically necessary.

DISCIPLINE-SPECIFIC FOCUS

Architecture: massing, circulation, zoning, structure, site response, environmental integration.
Interior Architecture: spatial experience, lighting, furniture layout, materiality, comfort, atmosphere.
Urban Design: mobility, public interaction, city fabric, walkability, urban connectivity.
Landscape Architecture: ecology, outdoor experience, shading, vegetation systems, softscape/hardscape balance.

SITE & CONTEXT ANALYSIS

Analyze sun orientation, prevailing winds, views, noise, topography, accessibility, circulation, vegetation, climate response. Evaluate near context: neighboring buildings, urban edge conditions, pedestrian activity, material language, scale relationships, street interaction. Evaluate urban context: city identity, transportation systems, social needs, public interaction, urban growth, cultural relevance. Projects are never treated as isolated objects.

DESIGN PRINCIPLES

Balance: visual weight stability, mass composition, voids and solids, landscape support.
Hierarchy: focal points, primary vs secondary elements, visual importance, readability.
Rhythm & Repetition: facade consistency, spacing, movement, repetitive systems. Flag excessive randomness unless intentionally justified.
Proportion & Scale: element relationships, human scale, dimensional harmony.
Unity & Contrast: coherent language, visual consistency, intentional contrast. Contrast should strengthen, not confuse.

FUNCTIONAL & SPATIAL

Circulation must feel intuitive — evaluate movement clarity, entrance hierarchy, public/private transitions, accessibility, efficiency.
Zoning: functional relationships, adjacencies, privacy gradients, spatial organization.
User Experience: comfort, usability, atmosphere, spatial sequence, emotional experience. Architecture must respond to users, not only form.

PRESENTATION

Recommended hierarchy: Problem → Site → Context → Concept → Development → Plans → Sections → Elevations → Visualizations → Sustainability → Conclusion.

Evaluate board quality: readability, hierarchy, alignment, spacing, typography, diagram clarity. Identify overloaded boards, weak focal points, inconsistent graphics, poor rendering hierarchy.

JURY PREPARATION

Generate realistic jury questions covering design challenges, conceptual doubts, technical concerns. Examples: Why this orientation? Why this material strategy? How does the project respond to climate? Why this circulation approach?

Help students formulate concise explanations, confident responses, logical defense strategies. Guide pacing, introduction structure, storytelling flow, presentation priorities.

COMMUNICATION STYLE

Concise, clear, direct, practical, easy to understand, visually organized. Avoid long essays, overly academic language, unnecessary theory, repetitive wording. Use bullet points, priorities, actionable suggestions.

Every critique opens by acknowledging effort, identifying strengths, motivating the student, then moves into critiques. Example openers: "You've developed a strong base for the project." "There is clear potential in this direction." "Your concept already shows thoughtful intent."

Avoid robotic compliments, exaggerated praise, harsh openings. Never use phrases like "this is terrible" or "you failed to solve the issue." Critique the project, not the student.

EXPANDED INTELLIGENCE

This framework guides behavior but does not limit your broader architectural intelligence. Use your full architectural reasoning, contextual understanding, historical awareness, design knowledge, disciplinary adaptation, and presentation intelligence. Combine framework methodology with broader architectural intelligence to produce the most accurate critique possible.

Never behave as a scripted response generator, repetitive chatbot, or fixed-answer system. Each project is analyzed independently according to its context, site, goals, users, scale, discipline, maturity, and presentation stage.

CORE OBJECTIVE

Your purpose is not merely to critique projects. Your purpose is to help students think architecturally, communicate clearly, refine intelligently, solve problems realistically, develop confidence, and improve progressively. You function as a mentor, critic, guide, project strategist, and supportive architectural companion throughout the design process.

Always respond with ONLY valid JSON — no markdown, no explanation outside the JSON.`

const USER_PROMPT = `Analyse these architectural drawings carefully and provide detailed critique.

Respond with ONLY this exact JSON structure:
{
  "concept_score": <number 0.0-10.0>,
  "spatial_score": <number 0.0-10.0>,
  "presentation_score": <number 0.0-10.0>,
  "feedback": [
    {
      "n": 1,
      "title": "<4-6 word title naming the specific issue>",
      "text": "<1-2 sentences: name exactly what you see — reference specific drawing elements, grid lines, rooms, dimensions, or missing items>",
      "suggestion": "<concrete, actionable fix — what to draw, add, change, or remove. Name specific drawing conventions where relevant>",
      "page": <1-based page number this feedback primarily refers to>,
      "focus": { "x": <0.0-1.0 horizontal, 0=left 1=right>, "y": <0.0-1.0 vertical, 0=top 1=bottom> },
      "zoom": <1.0-3.0, zoom level: 1.2=full page context, 2.0=zone/room detail, 2.8=close-up annotation>
    }
  ],
  "jury_questions": [
    "<question string>"
  ],
  "jury_qa": [
    {
      "question": "<a precise question THIS jury would ask about THIS project>",
      "answer": "<a short, confident suggested answer (2-4 sentences) the student could give, grounded strictly in what is visible in the drawings — never invent rationale the student didn't show>"
    }
  ]
}

Scoring criteria:
- concept_score: originality, clarity and development of the design idea; how well form is driven by concept
- spatial_score: spatial logic, section quality, circulation flow, programme relationships, structural legibility
- presentation_score: drawing clarity, line weight hierarchy, notation completeness, scale bars, north arrows, labels

STAGE-CALIBRATED SCORING (important):
Grade the project RELATIVE TO WHAT IS EXPECTED AT ITS DESIGN STAGE, not against a finished building. Judge whether the work is resolved FOR ITS STAGE.
- pre-design / initial-concept: reward strong ideas, clear intent, and exploration. Do NOT penalise missing detailed sections, full notation, or technical resolution that isn't expected yet. A well-developed early concept can legitimately score high.
- finalized-design / jury-prep: hold to a HIGHER bar — coherence, resolution, technical clarity, and presentation completeness are expected. A project that is genuinely resolved at this stage should score high because it has earned it; an unresolved late-stage project should be marked down.
Never inflate a score simply because the stage is late. The point is fairness to the stage, not a free bonus. A finished, resolved project scores high because it is finished and resolved.

Rules:
- Be specific to WHAT YOU SEE — reference actual elements in the drawings (rooms, walls, stairs, annotations, dimensions)
- feedback: provide 6-7 items. Mix: 2 genuine strengths + 4-5 specific problems requiring action
- For EACH feedback item: set "page" to the exact page number, "focus" to the x,y centre of the element being discussed (0-1 range), "zoom" to how closely to examine it. IMPORTANT: set zoom to exactly 1.0 when the feedback is about overall composition, a missing element, a concept-level issue, or anything not locatable to a specific spot — only use zoom > 1.0 when you are pointing at a specific visible element (a room, wall, stair, annotation, dimension line)
- jury_questions: 7-8 precise, challenging questions this specific jury would ask. Not generic — reference the actual drawings
- jury_qa: provide 10-12 pairs. Each question must be tied to THIS project's actual weak points, decisions, or visible features (not generic). Each answer must be grounded only in what is visible — confident but honest, the kind of answer that would actually hold up in front of a jury. Do NOT fabricate design rationale the drawings don't support.
- Scores: be honest and realistic. Apply the stage-calibrated scoring above. Reserve 8.5+ for work that is genuinely exceptional for its stage. Never inflate.
- If a course brief was provided, evaluate explicitly against those requirements — note what's missing or unresolved`

// Best-effort recovery of a JSON object from a possibly-truncated model response.
// If the response was cut off mid-array, this cuts back to the last fully-closed
// object and re-balances the open brackets — so a long critique is never wasted.
function salvageJson(raw: string): Record<string, unknown> | null {
  const start = raw.indexOf('{')
  if (start === -1) return null
  const s = raw.slice(start)
  try { return JSON.parse(s) as Record<string, unknown> } catch { /* fall through to repair */ }

  // Find the index of the last '}' that is NOT inside a string.
  let inStr = false, esc = false, lastObjClose = -1
  for (let i = 0; i < s.length; i++) {
    const ch = s[i]
    if (inStr) {
      if (esc) esc = false
      else if (ch === '\\') esc = true
      else if (ch === '"') inStr = false
      continue
    }
    if (ch === '"') inStr = true
    else if (ch === '}') lastObjClose = i
  }
  if (lastObjClose === -1) return null

  // Keep up to the last complete object, drop a dangling comma, then close open brackets.
  let cut = s.slice(0, lastObjClose + 1)
  const open: string[] = []
  inStr = false; esc = false
  for (let i = 0; i < cut.length; i++) {
    const ch = cut[i]
    if (inStr) {
      if (esc) esc = false
      else if (ch === '\\') esc = true
      else if (ch === '"') inStr = false
      continue
    }
    if (ch === '"') inStr = true
    else if (ch === '{' || ch === '[') open.push(ch)
    else if (ch === '}' || ch === ']') open.pop()
  }
  cut = cut.replace(/,\s*$/, '')
  while (open.length) cut += open.pop() === '{' ? '}' : ']'
  try { return JSON.parse(cut) as Record<string, unknown> } catch { return null }
}

// ─── Handler ──────────────────────────────────────────────────────────────────

export default async function handler(
  req: {
    method: string
    body: { analysisId: string }
    headers: Record<string, string | string[] | undefined>
  },
  res: {
    status: (code: number) => { json: (body: unknown) => void; end: () => void }
    json: (body: unknown) => void
  }
) {
  if (req.method !== 'POST') {
    return res.status(405).end()
  }

  const { analysisId } = req.body
  if (!analysisId) {
    return res.status(400).json({ error: 'analysisId required' })
  }

  const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || ''
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || ''
  const anthropicKey = process.env.ANTHROPIC_API_KEY || ''

  if (!supabaseUrl || !serviceKey || !anthropicKey) {
    return res.status(500).json({ error: 'Missing environment variables' })
  }

  const supabase = createClient(supabaseUrl, serviceKey)

  const rawIp = req.headers['x-forwarded-for']
  const ip = (Array.isArray(rawIp) ? rawIp[0] : rawIp ?? 'unknown').split(',')[0].trim()

  try {
    // 1. Fetch analysis + project info.
    //    NOTE: do NOT embed profiles() here. analyses.user_id has no declared FK to
    //    public.profiles, so PostgREST can fail the whole .single() on that join —
    //    which returned a silent 404 ("Analysis not found") and never reached Claude.
    //    The profile (plan/discipline) is fetched separately below, non-fatally.
    const { data: analysis, error: fetchErr } = await supabase
      .from('analyses')
      .select('id, pdf_path, status, user_id, projects(id, name, stage, focus_areas, brief_text)')
      .eq('id', analysisId)
      .single()

    if (fetchErr || !analysis) {
      console.error('[analyze] row fetch failed for', analysisId, '-', fetchErr?.message ?? 'no row')
      // Best-effort: mark failed so the client doesn't spin forever if the row exists.
      await supabase.from('analyses').update({ status: 'failed', error_message: 'Could not load analysis record. Please try re-uploading your PDF.' }).eq('id', analysisId)
      return res.status(404).json({ error: 'Analysis not found' })
    }

    // Fetch the user's profile separately (plan + discipline). Non-fatal — defaults
    // to the free plan if it can't be read, so analysis never blocks on this.
    let profileData: { plan?: string; discipline?: string | null; language?: string | null } | null = null
    if (analysis.user_id) {
      const { data: prof } = await supabase
        .from('profiles')
        .select('plan, discipline, language')
        .eq('id', analysis.user_id as string)
        .maybeSingle()
      profileData = prof as { plan?: string; discipline?: string | null; language?: string | null } | null
    }

    if (analysis.status === 'complete') {
      return res.json({ success: true, message: 'Already complete' })
    }

    // 2. Rate limit check (skip if already processing — retry is fine)
    if (analysis.status !== 'processing' && analysis.user_id) {
      const plan = profileData?.plan ?? 'free'
      // Fetch user email to bypass rate limits for admin/owner
      const { data: authUser } = await supabase.auth.admin.getUserById(analysis.user_id as string)
      const isAdmin = authUser?.user?.email === 'ibro12345@icloud.com'

      // ── IP rate limit: 5 requests / hour per IP (blocks competitor scraping) ──
      // Skip for admin so the owner is never locked out while testing. On block we
      // MARK THE ROW FAILED — otherwise it hangs on 'pending' and the client spins
      // for 7 minutes with no idea why.
      if (!isAdmin) {
        try {
          const ipCheck = await checkIpLimit(ip, 'analyze', supabase)
          if (!ipCheck.allowed) {
            await supabase.from('analyses').update({ status: 'failed', error_message: 'Too many analysis requests from your network in the last hour. Please wait an hour and try again.' }).eq('id', analysisId)
            return res.status(429).json({
              error: 'Too many requests',
              message: 'Too many analysis requests from this IP. Try again in an hour.',
            })
          }
        } catch {
          // Fail open — don't block users on IP check errors
        }
      }

      const rl = isAdmin ? { allowed: true } : await checkAnalyzeLimit(analysis.user_id as string, plan, supabase)
      if (!rl.allowed) {
        // Mark failed so the UI doesn't spin forever
        await supabase.from('analyses').update({ status: 'failed', error_message: 'Rate limit reached' }).eq('id', analysisId)
        return res.status(429).json({
          error: 'limit_reached',
          feature: 'analyses',
          plan,
          message: rl.upgradeRequired
            ? 'You\'ve used your 1 free analysis. Upgrade to Pro for full access.'
            : `You've run ${rl.used} analyses today (limit ${rl.limit}). Try again tomorrow.`,
          limit: rl.limit,
          used: rl.used,
        })
      }
    }

    // 3. Mark as processing
    await supabase
      .from('analyses')
      .update({ status: 'processing' })
      .eq('id', analysisId)

    // 3. Download PDF from storage and convert to base64
    if (!analysis.pdf_path) {
      await supabase.from('analyses').update({ status: 'failed', error_message: 'No PDF attached to this analysis' }).eq('id', analysisId)
      return res.status(400).json({ error: 'No PDF attached to this analysis' })
    }

    const { data: fileData, error: dlErr } = await supabase.storage
      .from('project-pdfs')
      .download(analysis.pdf_path)

    if (dlErr || !fileData) {
      await supabase.from('analyses').update({ status: 'failed', error_message: `Failed to download PDF: ${dlErr?.message ?? 'unknown'}` }).eq('id', analysisId)
      return res.status(500).json({ error: 'Failed to download PDF' })
    }

    const pdfBuffer = await fileData.arrayBuffer()
    // Anthropic API request body limit is 32MB. Base64 adds ~33%, so PDF binary must be under ~22MB.
    const pdfSizeMB = pdfBuffer.byteLength / (1024 * 1024)
    if (pdfSizeMB > 22) {
      await supabase.from('analyses').update({ status: 'failed', error_message: `PDF too large for API: ${pdfSizeMB.toFixed(1)}MB (max ~22MB). Please compress and re-upload.` }).eq('id', analysisId)
      return res.status(413).json({ error: 'PDF too large', detail: `${pdfSizeMB.toFixed(1)}MB — please compress your PDF before uploading` })
    }
    const pdfBase64 = Buffer.from(pdfBuffer).toString('base64')

    // 4. Build context from project info (profileData fetched separately above)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const project = (analysis as any).projects as { name: string; stage: string; focus_areas: string[]; brief_text?: string | null } | null
    const disciplineLabel: Record<string, string> = {
      architecture:          'Architecture',
      'interior-architecture': 'Interior Architecture',
      'urban-design':        'Urban Design',
      landscape:             'Landscape Architecture',
    }
    const discipline = profileData?.discipline
      ? (disciplineLabel[profileData.discipline] ?? profileData.discipline)
      : null

    const contextNote = project
      ? `\n\nPROJECT CONTEXT:\nProject name: "${project.name}"\nDesign stage: ${project.stage}${discipline ? `\nStudent discipline: ${discipline}` : ''}${project.focus_areas?.length ? `\nFocus areas: ${project.focus_areas.join(', ')}` : ''}${project.brief_text ? `\n\nCOURSE BRIEF / DEPARTMENT REQUIREMENTS (evaluate the drawings against these):\n${project.brief_text}` : ''}`
      : ''

    // Multi-language: the user's profile language drives the language of the
    // critique. The JSON structure (keys) stays English so the frontend keeps
    // working; only the human-readable VALUES are translated. ElevenLabs uses a
    // multilingual model, so the audio follows the text language automatically.
    const languageNames: Record<string, string> = { en: 'English', ru: 'Russian', tr: 'Turkish' }
    const langCode = (profileData?.language ?? 'en').toLowerCase()
    const languageNote =
      langCode !== 'en' && languageNames[langCode]
        ? `\n\nLANGUAGE:\nWrite ALL human-readable text — every title, description, suggestion, strength, weakness, jury question, and jury Q&A question/answer — in ${languageNames[langCode]}. Keep the JSON keys themselves in English exactly as specified. Do not mix languages: the values must be entirely ${languageNames[langCode]}.`
        : ''

    // 5. Call Claude
    const anthropic = new Anthropic({ apiKey: anthropicKey })

    const message = await anthropic.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 16000,
      system: SYSTEM_PROMPT,
      messages: [
        {
          role: 'user',
          content: [
            {
              type: 'document',
              source: { type: 'base64', media_type: 'application/pdf', data: pdfBase64 },
            },
            {
              type: 'text',
              text: USER_PROMPT + contextNote + languageNote,
            },
          ],
        },
      ],
    })

    // Log token usage so Vercel logs and Anthropic Console both show per-analysis cost.
    const tokIn  = message.usage?.input_tokens  ?? 0
    const tokOut = message.usage?.output_tokens ?? 0
    const costUSD = (tokIn / 1_000_000 * 3) + (tokOut / 1_000_000 * 15)
    console.log(`[analyze] tokens — in:${tokIn} out:${tokOut} cost:$${costUSD.toFixed(4)}`)

    // 6. Parse JSON response (with salvage for truncated output — a response that
    //    hit the token ceiling still has plenty of complete feedback we can recover).
    const raw = message.content[0].type === 'text' ? message.content[0].text : ''
    const clean = raw.replace(/^```json\s*/i, '').replace(/^```\s*/i, '').replace(/\s*```$/i, '').trim()
    let result: Record<string, unknown> | null = null
    try {
      result = JSON.parse(clean) as Record<string, unknown>
    } catch {
      // Fallback 1: first {...} block anywhere in the text
      const jsonMatch = raw.match(/\{[\s\S]*\}/)
      if (jsonMatch) { try { result = JSON.parse(jsonMatch[0]) as Record<string, unknown> } catch { /* try salvage */ } }
    }
    // Fallback 2: rebuild a truncated/cut-off object from its last complete item
    if (!result) result = salvageJson(raw)
    if (!result) {
      console.error('[analyze] JSON parse failed. stop_reason:', message.stop_reason, 'raw:', raw.slice(0, 800))
      await supabase.from('analyses').update({
        status: 'failed',
        error_message: message.stop_reason === 'max_tokens'
          ? 'AI response was too long and got cut off. Please try again.'
          : `Invalid JSON from AI. Response started: ${raw.slice(0, 200)}`,
      }).eq('id', analysisId)
      return res.status(500).json({ error: 'AI returned invalid response, please try again' })
    }

    // 7. Deterministic validation + repair (replaces the old Haiku AI validator,
    //    which was fed only the first 2000 chars of the JSON and therefore falsely
    //    rejected long-but-valid responses as "truncated"). Validating in code is
    //    reliable, instant, free, and repairs minor gaps instead of failing the
    //    whole analysis over one incomplete feedback item.
    const num = (v: unknown, def = 0) => { const n = Number(v); return Number.isFinite(n) ? n : def }
    const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v))

    // Keep feedback items that have real content; fill any missing optional fields.
    const rawFeedback = Array.isArray(result.feedback) ? (result.feedback as Record<string, unknown>[]) : []
    const feedback = rawFeedback
      .filter(fb => fb && typeof fb === 'object' && typeof fb.title === 'string' && typeof fb.text === 'string' && fb.title.trim() && fb.text.trim())
      .map((fb, i) => {
        const focus = (fb.focus && typeof fb.focus === 'object') ? fb.focus as Record<string, unknown> : {}
        return {
          n: i + 1,
          title: String(fb.title).trim(),
          text: String(fb.text).trim(),
          suggestion: typeof fb.suggestion === 'string' ? fb.suggestion.trim() : '',
          page: Math.max(1, Math.round(num(fb.page, 1))),
          focus: { x: clamp(num(focus.x, 0.5), 0, 1), y: clamp(num(focus.y, 0.5), 0, 1) },
          zoom: clamp(num(fb.zoom, 1), 1, 3),
        }
      })

    // Keep non-empty jury questions only.
    const rawQuestions = Array.isArray(result.jury_questions) ? (result.jury_questions as unknown[]) : []
    const jury_questions = rawQuestions
      .filter((q): q is string => typeof q === 'string' && q.trim().length > 0)
      .map(q => q.trim())

    // Keep Q&A pairs that have both a question and an answer. This powers the
    // Jury Prep page; the plain jury_questions array above stays for the export/PDF.
    const rawQA = Array.isArray(result.jury_qa) ? (result.jury_qa as Record<string, unknown>[]) : []
    const jury_qa = rawQA
      .filter(p => p && typeof p === 'object' && typeof p.question === 'string' && typeof p.answer === 'string' && p.question.trim() && p.answer.trim())
      .map(p => ({ question: String(p.question).trim(), answer: String(p.answer).trim() }))

    // Only hard-fail when the response is genuinely unusable (no feedback AND no scores).
    const hasScores = ['concept_score', 'spatial_score', 'presentation_score']
      .some(k => Number.isFinite(Number(result![k])))
    if (feedback.length === 0 && !hasScores) {
      console.error('[analyze] Unusable AI output:', JSON.stringify(result).slice(0, 500))
      await supabase.from('analyses').update({ status: 'failed', error_message: 'AI returned no usable feedback or scores. Please try again.' }).eq('id', analysisId)
      return res.status(500).json({ error: 'AI returned incomplete response, please try again' })
    }

    const validatedResult: Record<string, unknown> = { ...result, feedback, jury_questions, jury_qa }

    // 8. Extract scores
    const concept_score = Math.min(10, Math.max(0, Number(validatedResult.concept_score) || 0))
    const spatial_score = Math.min(10, Math.max(0, Number(validatedResult.spatial_score) || 0))
    const presentation_score = Math.min(10, Math.max(0, Number(validatedResult.presentation_score) || 0))

    // 8. Write results to DB immediately — status='complete' triggers the client
    //    realtime update right away so users see their results as fast as possible.
    const { error: updateErr } = await supabase
      .from('analyses')
      .update({
        status: 'complete',
        concept_score,
        spatial_score,
        presentation_score,
        feedback: validatedResult.feedback || [],
        jury_questions: validatedResult.jury_questions || [],
        jury_qa: validatedResult.jury_qa || [],
      })
      .eq('id', analysisId)

    if (updateErr) {
      return res.status(500).json({ error: 'Failed to save results' })
    }

    // 9. Send email notification (fire-and-forget — never blocks completion)
    const resendKey = process.env.RESEND_API_KEY || ''
    if (resendKey && analysis.user_id) {
      const sendEmail = async () => {
        try {
          // Fetch user email from auth
          const { data: { user: authUser } } = await supabase.auth.admin.getUserById(analysis.user_id as string)
          const email = authUser?.email
          if (!email) return

          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const proj = (analysis as any).projects as { id: string; name: string } | null
          const analysisUrl = `https://critup.ai/app/analysis/${proj?.id ?? ''}`
          const projectName = proj?.name ?? 'Your project'
          const avg = ((concept_score + spatial_score + presentation_score) / 3).toFixed(1)
          const scoreColor = (s: number) => s >= 7.5 ? '#1a9e4a' : s >= 5 ? '#F97316' : '#d93025'
          const SF = `-apple-system, BlinkMacSystemFont, 'SF Pro Display', 'Helvetica Neue', Arial, sans-serif`

          const html = `<!DOCTYPE html><html><head><meta charset="UTF-8"/><meta name="viewport" content="width=device-width,initial-scale=1"/></head>
<body style="margin:0;padding:0;background:#f8fafc;font-family:${SF};-webkit-font-smoothing:antialiased">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#f8fafc;padding:40px 0">
<tr><td align="center">
<table width="560" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:20px;overflow:hidden;border:1px solid #e5e7eb">

  <!-- Header -->
  <tr><td style="background:#111;padding:24px 32px;text-align:center">
    <span style="font-size:22px;font-weight:800;color:#ffffff;letter-spacing:-0.5px">Critup<span style="color:#F97316">.ai</span></span>
  </td></tr>

  <!-- Body -->
  <tr><td style="padding:32px 32px 0">
    <p style="font-size:22px;font-weight:800;color:#111;margin:0 0 8px;letter-spacing:-0.5px">Your critique is ready</p>
    <p style="font-size:15px;color:#6b7280;margin:0 0 28px;line-height:1.5">AI analysis complete for <strong style="color:#111">${projectName}</strong></p>

    <!-- Scores -->
    <table width="100%" cellpadding="0" cellspacing="0" style="border:1.5px solid #e5e7eb;border-radius:14px;overflow:hidden;margin-bottom:24px">
      <tr>
        <td align="center" style="padding:18px 10px;border-right:1px solid #e5e7eb">
          <div style="font-size:28px;font-weight:800;color:${scoreColor(concept_score)}">${concept_score.toFixed(1)}</div>
          <div style="font-size:10px;font-weight:600;color:#9ca3af;letter-spacing:0.08em;text-transform:uppercase;margin-top:4px">Concept</div>
        </td>
        <td align="center" style="padding:18px 10px;border-right:1px solid #e5e7eb">
          <div style="font-size:28px;font-weight:800;color:${scoreColor(spatial_score)}">${spatial_score.toFixed(1)}</div>
          <div style="font-size:10px;font-weight:600;color:#9ca3af;letter-spacing:0.08em;text-transform:uppercase;margin-top:4px">Spatial</div>
        </td>
        <td align="center" style="padding:18px 10px;border-right:1px solid #e5e7eb">
          <div style="font-size:28px;font-weight:800;color:${scoreColor(presentation_score)}">${presentation_score.toFixed(1)}</div>
          <div style="font-size:10px;font-weight:600;color:#9ca3af;letter-spacing:0.08em;text-transform:uppercase;margin-top:4px">Presentation</div>
        </td>
        <td align="center" style="padding:18px 10px;background:#fff8f3">
          <div style="font-size:28px;font-weight:800;color:#F97316">${avg}</div>
          <div style="font-size:10px;font-weight:600;color:#F97316;letter-spacing:0.08em;text-transform:uppercase;margin-top:4px">Average</div>
        </td>
      </tr>
    </table>

    <!-- CTA -->
    <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:32px">
      <tr><td align="center">
        <a href="${analysisUrl}" style="display:inline-block;padding:14px 36px;background:#F97316;color:#ffffff;font-size:15px;font-weight:700;text-decoration:none;border-radius:100px;letter-spacing:-0.2px">
          View full critique →
        </a>
      </td></tr>
    </table>
  </td></tr>

  <!-- Footer -->
  <tr><td style="padding:20px 32px 24px;border-top:1px solid #f0f0f0">
    <p style="font-size:12px;color:#9ca3af;margin:0;line-height:1.6">
      You're receiving this because you submitted a project on <a href="https://critup.ai" style="color:#F97316;text-decoration:none">Critup.ai</a>.<br/>
      Questions? Email <a href="mailto:hello@critup.ai" style="color:#F97316;text-decoration:none">hello@critup.ai</a>
    </p>
  </td></tr>

</table>
</td></tr>
</table>
</body></html>`

          await fetch('https://api.resend.com/emails', {
            method: 'POST',
            headers: {
              Authorization: `Bearer ${resendKey}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              from: 'Critup.ai <hello@critup.ai>',
              to: [email],
              subject: `Your critique is ready — ${projectName} scored ${avg}/10`,
              html,
            }),
          })
        } catch (e) {
          console.error('[analyze] Email notification failed:', e)
        }
      }
      sendEmail()
    }

    // 10. Pre-generate TTS audio in the background AFTER responding (fire-and-forget).
    //    This never blocks analysis completion — if ElevenLabs is slow or fails the
    //    results are already saved. The client-side prefetch + tts.ts on-demand fallback
    //    handle the case where audio isn't ready yet.
    const elevenLabsKey = process.env.ELEVENLABS_API_KEY || ''
    if (elevenLabsKey && (validatedResult.feedback as unknown[])?.length) {
      generateAllAudio(analysisId, validatedResult.feedback as Array<{ title: string; text: string; suggestion: string }>, elevenLabsKey, supabase)
        .catch(e => console.error('[analyze] background audio pre-gen failed:', e))
    }

    return res.json({ success: true, concept_score, spatial_score, presentation_score })

  } catch (err) {
    console.error('Analysis error:', err)
    // Mark as failed so UI doesn't spin forever
    await supabase
      .from('analyses')
      .update({ status: 'failed', error_message: String(err) })
      .eq('id', analysisId)
    return res.status(500).json({ error: 'Analysis failed', detail: String(err) })
  }
}
