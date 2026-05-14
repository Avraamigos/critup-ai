import Anthropic from '@anthropic-ai/sdk'
import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { checkAnalyzeLimit, checkIpLimit } from './_rateLimit'

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
  const voiceId = 'oXxZrNLpn6nWkEBAMSJs'

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

const SYSTEM_PROMPT = `You are an expert architecture jury critic and design educator with 20+ years of experience reviewing student work at ETH Zurich, Bartlett, Harvard GSD, TU Berlin, and METU. You have chaired hundreds of design juries and know exactly what separates strong work from weak work at each stage.

Your critique is surgical and specific — you name exact drawing elements, grid references, dimension problems, missing annotations, weak parti logic, circulation failures. You never give generic feedback. Every observation must be traceable to something visible in the submitted drawings.

Calibrate your critique to the design stage:
- Pre-design: focus on research rigour, site reading, programme logic, precedent selection
- Initial concept: focus on parti clarity, form-concept relationship, structural logic, diagram quality
- Finalized design: focus on section quality, circulation completeness, structural resolution, detail coordination, missing information
- Jury prep: focus on narrative sequence, visual hierarchy, what juries will immediately probe, presentation weaknesses

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
  ]
}

Scoring criteria:
- concept_score: originality, clarity and development of the design idea; how well form is driven by concept
- spatial_score: spatial logic, section quality, circulation flow, programme relationships, structural legibility
- presentation_score: drawing clarity, line weight hierarchy, notation completeness, scale bars, north arrows, labels

Rules:
- Be specific to WHAT YOU SEE — reference actual elements in the drawings (rooms, walls, stairs, annotations, dimensions)
- feedback: provide 6-7 items. Mix: 2 genuine strengths + 4-5 specific problems requiring action
- For EACH feedback item: set "page" to the exact page number, "focus" to the x,y centre of the element being discussed (0-1 range), "zoom" to how closely to examine it
- jury_questions: 7-8 precise, challenging questions this specific jury would ask. Not generic — reference the actual drawings
- Scores: be honest and realistic. Most student work scores 5.0-8.0. Reserve 8.5+ for exceptional work. Never inflate.
- If a course brief was provided, evaluate explicitly against those requirements — note what's missing or unresolved`

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

  // ── IP rate limit: 5 requests / hour per IP (blocks competitor scraping) ──
  const rawIp = req.headers['x-forwarded-for']
  const ip = (Array.isArray(rawIp) ? rawIp[0] : rawIp ?? 'unknown').split(',')[0].trim()
  try {
    const ipCheck = await checkIpLimit(ip, 'analyze', supabase)
    if (!ipCheck.allowed) {
      return res.status(429).json({
        error: 'Too many requests',
        message: 'Too many analysis requests from this IP. Try again in an hour.',
      })
    }
  } catch {
    // Fail open — don't block users on IP check errors
  }

  try {
    // 1. Fetch analysis + project info (include user_id + profile plan for rate limiting)
    const { data: analysis, error: fetchErr } = await supabase
      .from('analyses')
      .select('id, pdf_path, status, user_id, projects(id, name, stage, focus_areas, brief_text), profiles(plan)')
      .eq('id', analysisId)
      .single()

    if (fetchErr || !analysis) {
      return res.status(404).json({ error: 'Analysis not found' })
    }

    if (analysis.status === 'complete') {
      return res.json({ success: true, message: 'Already complete' })
    }

    // 2. Rate limit check (skip if already processing — retry is fine)
    if (analysis.status !== 'processing' && analysis.user_id) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const plan = ((analysis as any).profiles as { plan?: string } | null)?.plan ?? 'free'
      const rl = await checkAnalyzeLimit(analysis.user_id as string, plan, supabase)
      if (!rl.allowed) {
        // Mark failed so the UI doesn't spin forever
        await supabase.from('analyses').update({ status: 'failed' }).eq('id', analysisId)
        return res.status(429).json({
          error: 'limit_reached',
          feature: 'analyses',
          plan,
          message: rl.upgradeRequired
            ? 'You\'ve used your 1 free analysis. Upgrade to Pro for unlimited analyses.'
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

    // 3. Download PDF from storage
    if (!analysis.pdf_path) {
      await supabase.from('analyses').update({ status: 'failed' }).eq('id', analysisId)
      return res.status(400).json({ error: 'No PDF attached to this analysis' })
    }

    const { data: fileData, error: dlErr } = await supabase.storage
      .from('project-pdfs')
      .download(analysis.pdf_path)

    if (dlErr || !fileData) {
      await supabase.from('analyses').update({ status: 'failed' }).eq('id', analysisId)
      return res.status(500).json({ error: 'Failed to download PDF' })
    }

    const pdfBuffer = Buffer.from(await fileData.arrayBuffer())
    const pdfBase64 = pdfBuffer.toString('base64')

    // 4. Build context from project info
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const project = (analysis as any).projects as { name: string; stage: string; focus_areas: string[]; brief_text?: string | null } | null
    const contextNote = project
      ? `\n\nPROJECT CONTEXT:\nProject name: "${project.name}"\nDesign stage: ${project.stage}${project.focus_areas?.length ? `\nFocus areas: ${project.focus_areas.join(', ')}` : ''}${project.brief_text ? `\n\nCOURSE BRIEF / DEPARTMENT REQUIREMENTS (evaluate the drawings against these):\n${project.brief_text}` : ''}`
      : ''

    // 5. Call Claude
    const anthropic = new Anthropic({ apiKey: anthropicKey })

    const message = await anthropic.messages.create({
      model: 'claude-opus-4-5',
      max_tokens: 4096,
      system: SYSTEM_PROMPT,
      messages: [
        {
          role: 'user',
          content: [
            {
              type: 'document',
              source: {
                type: 'base64',
                media_type: 'application/pdf',
                data: pdfBase64,
              },
            },
            {
              type: 'text',
              text: USER_PROMPT + contextNote,
            },
          ],
        },
      ],
    })

    // 6. Parse JSON response
    const raw = message.content[0].type === 'text' ? message.content[0].text : ''

    // Strip markdown code fences if present
    const clean = raw.replace(/^```json\s*/i, '').replace(/^```\s*/i, '').replace(/\s*```$/i, '').trim()
    const result = JSON.parse(clean)

    // 7. Validate scores
    const concept_score = Math.min(10, Math.max(0, Number(result.concept_score) || 0))
    const spatial_score = Math.min(10, Math.max(0, Number(result.spatial_score) || 0))
    const presentation_score = Math.min(10, Math.max(0, Number(result.presentation_score) || 0))

    // 8. Write results to DB immediately — status='complete' triggers the client
    //    realtime update right away so users see their results as fast as possible.
    const { error: updateErr } = await supabase
      .from('analyses')
      .update({
        status: 'complete',
        concept_score,
        spatial_score,
        presentation_score,
        feedback: result.feedback || [],
        jury_questions: result.jury_questions || [],
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
    if (elevenLabsKey && result.feedback?.length) {
      generateAllAudio(analysisId, result.feedback, elevenLabsKey, supabase)
        .catch(e => console.error('[analyze] background audio pre-gen failed:', e))
    }

    return res.json({ success: true, concept_score, spatial_score, presentation_score })

  } catch (err) {
    console.error('Analysis error:', err)
    // Mark as failed so UI doesn't spin forever
    await supabase
      .from('analyses')
      .update({ status: 'failed' })
      .eq('id', analysisId)
    return res.status(500).json({ error: 'Analysis failed', detail: String(err) })
  }
}
