import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { getCaller, isAdminEmail } from './auth.js'
import { logUsage } from './usage.js'

// ─── Poster / title-slide generator (Tools §1) ───────────────────────────────
// Temporarily dispatched from api/jury-script.ts because Vercel Hobby caps us at
// 12 functions. ALL logic lives here so that, once on Vercel Pro, extraction is a
// 3-line api/poster.ts that imports and calls handlePoster(). See admin note.
//
// Model: GPT Image 2 at MEDIUM quality via the images/edits endpoint, which takes
// the student's building render (+ optional plan cut-outs) as reference images and
// re-composes them into a presentation poster. Critical title text is NOT baked in
// by the model (it misspells names/IDs) — the client overlays it as real text.

const GEN_LIMIT_30D = 15                     // posters per rolling 30 days (Pro)
const OPENAI_MODEL = 'gpt-image-2'
const QUALITY = 'medium'

// Approx $ per medium-quality image by size (used if the API omits usage).
const COST_FALLBACK: Record<string, number> = { vertical: 0.08, horizontal: 0.08 }

type Format = 'vertical' | 'horizontal'
const SIZE: Record<Format, string> = { vertical: '1024x1536', horizontal: '1536x1024' }

// Vibe presets — the prompt scaffolding that makes outputs look intentional.
const TEMPLATES: Record<string, string> = {
  bluehour:
    'Cinematic architectural competition poster, late-evening blue-hour mood: deep blue sky, warm interior glow, subtle reflections. Elegant, restrained, professional.',
  minimal:
    'Minimal Swiss editorial poster: generous negative space, crisp daylight render, thin rules, muted neutral palette, lots of calm air around the building.',
  dramatic:
    'Dramatic hero poster: strong directional light, high contrast, moody atmosphere, the building as a confident centrepiece against a clean gradient sky.',
  warm:
    'Warm golden-hour architectural poster: soft sunset light, long shadows, inviting tones, gentle film-grain texture.',
}

interface PosterReq {
  action?: string
  format?: Format
  template?: string
  analysisId?: string | null
  heroPath?: string          // storage path in 'posters' bucket (client-uploaded) OR 'project-pdfs'
  heroBucket?: string        // defaults to 'posters'
  planPaths?: string[]       // optional plan/illustration cut-outs
  planBucket?: string
  titleHint?: string         // optional: student's project name to inform composition (not baked as text)
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Res = { status: (c: number) => { json: (b: unknown) => void; end: () => void }; json: (b: unknown) => void }

async function countRecent(userId: string, supabase: SupabaseClient<any, any, any>) {
  const since = new Date(Date.now() - 30 * 24 * 3600 * 1000).toISOString()
  const { count } = await supabase
    .from('poster_generations')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', userId)
    .neq('status', 'failed')
    .gte('created_at', since)
  return count ?? 0
}

async function download(supabase: SupabaseClient<any, any, any>, bucket: string, path: string): Promise<Blob | null> {
  const { data, error } = await supabase.storage.from(bucket).download(path)
  if (error || !data) return null
  return data
}

function buildPrompt(format: Format, template: string, hasPlans: boolean, titleHint?: string): string {
  const vibe = TEMPLATES[template] ?? TEMPLATES.bluehour
  const orientation = format === 'vertical' ? 'vertical portrait' : 'horizontal landscape'
  const planLine = hasPlans
    ? 'Integrate the supplied plan/diagram cut-outs cleanly into the upper area as inset technical drawings (treat their white background as transparent); align them tidily, do not distort the building render.'
    : 'Leave a clean, uncluttered band in the upper third as space for a title and inset drawings to be added later.'
  const titleLine = titleHint
    ? `The project is titled "${titleHint}" — compose with room for that title, but do NOT render any text yourself.`
    : 'Do NOT render any text — leave clean space for a title to be overlaid later.'
  return [
    `Create a ${orientation} architecture presentation poster.`,
    'Use the FIRST supplied image as the strict architectural base: preserve its exact geometry, proportions, roof lines, glazing, and materials. Do not redesign or restyle the building.',
    vibe,
    planLine,
    titleLine,
    'Output a single, polished, print-ready composition.',
  ].join('\n')
}

// ─── Public entry (dispatched from an existing function) ─────────────────────
export async function handlePoster(
  req: { headers: Record<string, string | undefined>; body: PosterReq },
  res: Res
) {
  const supabaseUrl  = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || ''
  const serviceKey   = process.env.SUPABASE_SERVICE_ROLE_KEY || ''
  const openaiKey    = process.env.OPENAI_API_KEY || ''
  if (!supabaseUrl || !serviceKey) return res.status(500).json({ error: 'Server misconfigured' })

  const caller = await getCaller(req.headers['authorization'])
  if (!caller) return res.status(401).json({ error: 'Not authenticated' })

  const supabase = createClient(supabaseUrl, serviceKey)

  // Plan gate — poster tool is Pro-only (admin bypasses for testing).
  const { data: prof } = await supabase.from('profiles').select('plan').eq('id', caller.id).maybeSingle()
  const plan = (prof as { plan?: string } | null)?.plan ?? 'free'
  const isPro = plan !== 'free' || isAdminEmail(caller.email)
  if (!isPro) return res.status(403).json({ error: 'limit_reached', message: 'The poster tool is a Pro feature.' })

  // ── action: poster_credits — how many left this cycle ──────────────────────
  const used = await countRecent(caller.id, supabase)
  if (req.body?.action === 'poster_credits') {
    return res.json({ used, limit: GEN_LIMIT_30D, remaining: Math.max(0, GEN_LIMIT_30D - used) })
  }

  // ── action: poster — generate ──────────────────────────────────────────────
  if (!openaiKey) return res.status(500).json({ error: 'OPENAI_API_KEY not set' })
  if (used >= GEN_LIMIT_30D && !isAdminEmail(caller.email)) {
    return res.status(429).json({ error: 'limit_reached', message: `You've used all ${GEN_LIMIT_30D} poster generations this month.` })
  }

  const format: Format = req.body?.format === 'horizontal' ? 'horizontal' : 'vertical'
  const template = req.body?.template && TEMPLATES[req.body.template] ? req.body.template : 'bluehour'
  const heroBucket = req.body?.heroBucket || 'posters'
  const planBucket = req.body?.planBucket || 'posters'
  if (!req.body?.heroPath) return res.status(400).json({ error: 'heroPath required' })

  // Record the attempt up-front so a crash leaves an honest 'processing'→reaper trail.
  const { data: rowIns } = await supabase
    .from('poster_generations')
    .insert({ user_id: caller.id, analysis_id: req.body.analysisId ?? null, format, template, status: 'processing' })
    .select('id')
    .single()
  const rowId = (rowIns as { id: string } | null)?.id ?? null

  const fail = async (msg: string, code = 500) => {
    if (rowId) await supabase.from('poster_generations').update({ status: 'failed', error_message: msg }).eq('id', rowId)
    return res.status(code).json({ error: 'failed', message: msg })
  }

  try {
    // 1. Gather reference images.
    const hero = await download(supabase, heroBucket, req.body.heroPath)
    if (!hero) return fail('Could not read your building image. Please re-upload.')
    const planBlobs: Blob[] = []
    for (const p of (req.body.planPaths ?? []).slice(0, 3)) {
      const b = await download(supabase, planBucket, p)
      if (b) planBlobs.push(b)
    }

    // 2. Build multipart request for the images/edits endpoint.
    const form = new FormData()
    form.append('model', OPENAI_MODEL)
    form.append('prompt', buildPrompt(format, template, planBlobs.length > 0, req.body.titleHint))
    form.append('size', SIZE[format])
    form.append('quality', QUALITY)
    form.append('n', '1')
    form.append('image[]', hero, 'hero.png')
    planBlobs.forEach((b, i) => form.append('image[]', b, `plan-${i}.png`))

    const resp = await fetch('https://api.openai.com/v1/images/edits', {
      method: 'POST',
      headers: { Authorization: `Bearer ${openaiKey}` },
      body: form,
    })
    if (!resp.ok) {
      const detail = await resp.text().catch(() => '')
      console.error('[poster] openai error', resp.status, detail.slice(0, 300))
      return fail('The image service could not generate this poster. Please try again.')
    }
    const json = await resp.json() as {
      data?: Array<{ b64_json?: string }>
      usage?: { input_tokens?: number; output_tokens?: number }
    }
    const b64 = json.data?.[0]?.b64_json
    if (!b64) return fail('The image service returned no image. Please try again.')

    // 3. Store the output.
    const bytes = Buffer.from(b64, 'base64')
    const outPath = `${caller.id}/out/${rowId ?? Date.now()}.png`
    const { error: upErr } = await supabase.storage.from('posters').upload(outPath, bytes, {
      contentType: 'image/png', upsert: true,
    })
    if (upErr) return fail('Generated the poster but could not save it. Please try again.')

    // 4. Cost accounting (measured if the API returned usage, else fallback).
    const inTok = json.usage?.input_tokens ?? 0
    const outTok = json.usage?.output_tokens ?? 0
    const cost = (inTok || outTok)
      ? (inTok / 1_000_000) * 8 + (outTok / 1_000_000) * 30
      : (COST_FALLBACK[format] ?? 0.08)

    if (rowId) await supabase.from('poster_generations').update({ status: 'complete', output_path: outPath, cost_usd: cost }).eq('id', rowId)
    logUsage(supabase, { userId: caller.id, feature: 'poster', model: OPENAI_MODEL, costUsd: cost })

    // 5. Signed URL for the client to display/download.
    const { data: signed } = await supabase.storage.from('posters').createSignedUrl(outPath, 3600)
    return res.json({
      id: rowId,
      url: signed?.signedUrl ?? null,
      remaining: Math.max(0, GEN_LIMIT_30D - (used + 1)),
    })
  } catch (err) {
    console.error('[poster]', err)
    return fail('Something went wrong generating your poster. Please try again.')
  }
}
