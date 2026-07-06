// ElevenLabs text-to-speech endpoint with Supabase Storage persistence.
//
// Flow:
//   1. If analysisId + slideIdx are provided, check Supabase Storage for a
//      cached audio file at project-audio/{analysisId}/{slideIdx}.mp3
//   2. If cached → stream it back immediately (no ElevenLabs charge)
//   3. If not cached → call ElevenLabs, stream to client, upload to Storage
//      in the background so the NEXT request is served from cache

import { createClient } from '@supabase/supabase-js'
import { getCaller, isAdminEmail } from './_lib/auth.js'
import { logUsage, ttsCostUsd } from './_lib/usage.js'

// Strip markdown/special characters that cause ElevenLabs to glitch.
// Exported for unit tests (the notation fixes regressed once already).
export function cleanForTTS(raw: string): string {
  return raw
    .replace(/\*\*(.*?)\*\*/g, '$1')   // **bold** → bold
    .replace(/\*(.*?)\*/g, '$1')       // *italic* → italic
    .replace(/`[^`]*`/g, '')           // `code` → remove
    .replace(/→|->|»|•/g, '. ')       // arrows/bullets → pause
    .replace(/#+\s*/g, '')             // ## headers
    .replace(/_{2,}/g, '')             // __underline__
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')  // [link](url) → link text
    // Spoken-form fixes for architecture notation ElevenLabs otherwise garbles:
    .replace(/(\d)\s*[/:]\s*(\d)/g, '$1 to $2')   // scales/ratios "1/20", "1:100" → "1 to 20"
    .replace(/(\d)\s*m²/g, '$1 square meters')
    .replace(/(\d)\s*m2\b/g, '$1 square meters')
    .replace(/(\d)\s*m³/g, '$1 cubic meters')
    .replace(/km²/g, ' square kilometers')
    .replace(/²/g, ' squared').replace(/³/g, ' cubed')
    .replace(/(\d)\s*[x×]\s*(\d)/g, '$1 by $2')   // "6x6 grid" → "6 by 6"
    .replace(/(\d)\s*°/g, '$1 degrees')
    .replace(/%/g, ' percent').replace(/&/g, ' and ')
    .replace(/\s*\/\s*/g, ' ')          // any remaining slash → pause, not "slash"
    .replace(/\s{2,}/g, ' ')           // collapse whitespace
    .trim()
}

// Longest legit slide text (title + critique + suggestion) is well under this.
const MAX_TTS_CHARS = 5000

export default async function handler(
  req: {
    method: string
    headers: Record<string, string | undefined>
    body: { text: string; analysisId?: string; slideIdx?: number }
  },
  res: {
    status: (code: number) => { json: (b: unknown) => void; end: () => void }
    json: (b: unknown) => void
    setHeader: (k: string, v: string) => void
    send: (b: Buffer) => void
  }
) {
  if (req.method !== 'POST') return res.status(405).end()

  const { text: rawText, analysisId, slideIdx } = req.body ?? {}
  if (!rawText) return res.status(400).json({ error: 'text required' })
  if (rawText.length > MAX_TTS_CHARS) return res.status(400).json({ error: 'text too long' })
  const text = cleanForTTS(rawText)

  const apiKey  = process.env.ELEVENLABS_API_KEY || ''
  // Voice ID is fixed server-side. It is deliberately NOT taken from the
  // request body (any voice on the account) or the ELEVENLABS_VOICE_ID env
  // var (a stale Vercel var once overrode it).
  const voiceId = 'iEBOK9alpKauGRvBSsFi'
  const supabaseUrl   = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || ''
  const serviceKey    = process.env.SUPABASE_SERVICE_ROLE_KEY || ''

  if (!apiKey) return res.status(500).json({ error: 'ELEVENLABS_API_KEY not set' })

  // TTS costs real money per character — login required.
  const caller = await getCaller(req.headers['authorization'])
  if (!caller) return res.status(401).json({ error: 'Not authenticated' })

  const sb = supabaseUrl && serviceKey
    ? createClient(supabaseUrl, serviceKey)
    : null

  // Cache path is only honoured when the caller OWNS the analysis. Analysis ids
  // are public (community post URLs), and the cache is first-write-wins — an
  // unchecked id would let a stranger pre-seed the audio the owner later hears.
  let storagePath: string | null = null
  if (analysisId != null && slideIdx != null && sb) {
    const { data: a } = await sb.from('analyses').select('user_id').eq('id', analysisId).maybeSingle()
    const ownerId = (a as { user_id?: string } | null)?.user_id
    if (ownerId === caller.id || isAdminEmail(caller.email)) {
      storagePath = `${analysisId}/${slideIdx}.mp3`
    }
  }

  // ── 1. Try Storage cache ─────────────────────────────────────────────────
  if (storagePath && sb) {
    const { data: cached, error: cacheErr } = await sb.storage
      .from('project-audio')
      .download(storagePath)

    if (!cacheErr && cached) {
      const buf = Buffer.from(await cached.arrayBuffer())
      res.setHeader('Content-Type', 'audio/mpeg')
      res.setHeader('Cache-Control', 'public, max-age=86400')
      res.setHeader('X-Audio-Cache', 'HIT')
      return res.send(buf)
    }
  }

  // ── 2. Generate from ElevenLabs ──────────────────────────────────────────
  try {
    const response = await fetch(
      `https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`,
      {
        method: 'POST',
        headers: {
          'xi-api-key': apiKey,
          'Content-Type': 'application/json',
          Accept: 'audio/mpeg',
        },
        body: JSON.stringify({
          text,
          model_id: 'eleven_turbo_v2_5',
          voice_settings: {
            stability: 0.60,          // higher = fewer glitches / "aaaaa" artifacts
            similarity_boost: 0.78,
            style: 0.25,
            use_speaker_boost: true,
          },
        }),
      }
    )

    if (!response.ok) {
      const err = await response.text()
      return res.status(500).json({ error: 'ElevenLabs error', detail: err })
    }

    const audioBuf = Buffer.from(await response.arrayBuffer())

    // Character-billed cost (only real generations — cache hits above are free).
    if (sb) logUsage(sb, { userId: caller.id, feature: 'tts', model: 'elevenlabs', chars: text.length, costUsd: ttsCostUsd(text.length) })

    // ── 3. Persist to Storage (fire-and-forget) ──────────────────────────
    if (storagePath && sb) {
      sb.storage
        .from('project-audio')
        .upload(storagePath, audioBuf, {
          contentType: 'audio/mpeg',
          cacheControl: '86400',
          upsert: false,
        })
        .catch(e => console.error('[tts] storage upload failed:', e))
    }

    res.setHeader('Content-Type', 'audio/mpeg')
    res.setHeader('Cache-Control', 'public, max-age=86400')
    res.setHeader('X-Audio-Cache', 'MISS')
    return res.send(audioBuf)

  } catch (err) {
    return res.status(500).json({ error: 'TTS failed', detail: String(err) })
  }
}
