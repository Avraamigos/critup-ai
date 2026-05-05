import Anthropic from '@anthropic-ai/sdk'
import { createClient } from '@supabase/supabase-js'

// Pre-generate ElevenLabs audio for every feedback slide and store in
// project-audio/{analysisId}/{slideIdx}.mp3 so playback is always instant.
async function generateAllAudio(
  analysisId: string,
  feedback: Array<{ title: string; text: string; suggestion: string }>,
  elevenLabsKey: string,
  supabase: ReturnType<typeof createClient>
) {
  const voiceId = 'oXxZrNLpn6nWkEBAMSJs'

  await Promise.allSettled(
    feedback.map(async (fb, idx) => {
      const text = `${fb.title}. ${fb.text}. ${fb.suggestion}`
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
              stability: 0.45,
              similarity_boost: 0.75,
              style: 0.3,
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

const SYSTEM_PROMPT = `You are an expert architecture jury critic with 20+ years of experience reviewing student design work at top architecture schools (ETH Zurich, Bartlett, Harvard GSD, TU Berlin, METU). You give honest, specific, actionable critique — not generic feedback.

You understand all design stages: pre-design research, initial concept, finalized design, and jury preparation. Your critique is calibrated to the student's stage.

Always respond with ONLY valid JSON — no markdown, no explanation outside the JSON.`

const USER_PROMPT = `Analyze these architectural drawings carefully and provide detailed critique.

Respond with ONLY this exact JSON structure:
{
  "concept_score": <number 0.0-10.0>,
  "spatial_score": <number 0.0-10.0>,
  "presentation_score": <number 0.0-10.0>,
  "feedback": [
    {
      "n": 1,
      "title": "<short title>",
      "text": "<1-2 sentence observation>",
      "suggestion": "<specific actionable suggestion>",
      "page": <1-based page number this feedback primarily refers to>,
      "focus": { "x": <0.0-1.0 horizontal, 0=left 1=right>, "y": <0.0-1.0 vertical, 0=top 1=bottom> },
      "zoom": <1.0-3.0, zoom level: 1=full page view, 2=medium detail, 3=close-up>
    }
  ],
  "jury_questions": [
    "<question string>"
  ]
}

Scoring criteria:
- concept_score: originality, clarity and development of the design idea/narrative
- spatial_score: spatial logic, circulation flow, program relationships, section quality
- presentation_score: drawing clarity, line weight hierarchy, notation, overall communication

Rules:
- Be specific to WHAT YOU SEE in the drawings, not generic
- feedback: provide 5-7 items covering both strengths and areas to improve
- For EACH feedback item: set "page" to the exact page it refers to, "focus" to the approximate x,y position (0-1) of the detail on that page, and "zoom" to how close to zoom in (whole-page comment = zoom 1.2, specific detail = zoom 2.5-3.0)
- jury_questions: 6-8 challenging questions a real jury would ask based on these specific drawings
- Scores should be realistic — most student work is 5.5-8.5 range`

// ─── Handler ──────────────────────────────────────────────────────────────────

export default async function handler(
  req: { method: string; body: { analysisId: string } },
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

  try {
    // 1. Fetch analysis + project info
    const { data: analysis, error: fetchErr } = await supabase
      .from('analyses')
      .select('id, pdf_path, status, projects(name, stage, focus_areas)')
      .eq('id', analysisId)
      .single()

    if (fetchErr || !analysis) {
      return res.status(404).json({ error: 'Analysis not found' })
    }

    if (analysis.status === 'complete') {
      return res.json({ success: true, message: 'Already complete' })
    }

    // 2. Mark as processing
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
    const project = (analysis as any).projects as { name: string; stage: string; focus_areas: string[] } | null
    const contextNote = project
      ? `\n\nProject context: "${project.name}" — Stage: ${project.stage}${project.focus_areas?.length ? `. Focus areas: ${project.focus_areas.join(', ')}` : ''}.`
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

    // 8. Pre-generate TTS audio for all feedback slides (stored in project-audio bucket).
    //    We do this BEFORE marking status='complete' so the client always finds
    //    audio ready the moment the analysis page loads. allSettled = TTS failures
    //    never block the analysis from completing.
    const elevenLabsKey = process.env.ELEVENLABS_API_KEY || ''
    if (elevenLabsKey && result.feedback?.length) {
      await generateAllAudio(analysisId, result.feedback, elevenLabsKey, supabase)
    }

    // 9. Write results back to DB (status → complete triggers client realtime update)
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
