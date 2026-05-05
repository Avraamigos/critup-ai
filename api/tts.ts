// ElevenLabs text-to-speech endpoint with Supabase Storage persistence.
//
// Flow:
//   1. If analysisId + slideIdx are provided, check Supabase Storage for a
//      cached audio file at project-audio/{analysisId}/{slideIdx}.mp3
//   2. If cached → stream it back immediately (no ElevenLabs charge)
//   3. If not cached → call ElevenLabs, stream to client, upload to Storage
//      in the background so the NEXT request is served from cache

import { createClient } from '@supabase/supabase-js'

export default async function handler(
  req: {
    method: string
    body: { text: string; voiceId?: string; analysisId?: string; slideIdx?: number }
  },
  res: {
    status: (code: number) => { json: (b: unknown) => void; end: () => void }
    json: (b: unknown) => void
    setHeader: (k: string, v: string) => void
    send: (b: Buffer) => void
  }
) {
  if (req.method !== 'POST') return res.status(405).end()

  const { text, voiceId: reqVoiceId, analysisId, slideIdx } = req.body ?? {}
  if (!text) return res.status(400).json({ error: 'text required' })

  const apiKey        = process.env.ELEVENLABS_API_KEY || ''
  const defaultVoice  = process.env.ELEVENLABS_VOICE_ID || 'oXxZrNLpn6nWkEBAMSJs'
  const voiceId       = reqVoiceId || defaultVoice
  const supabaseUrl   = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || ''
  const serviceKey    = process.env.SUPABASE_SERVICE_ROLE_KEY || ''

  if (!apiKey) return res.status(500).json({ error: 'ELEVENLABS_API_KEY not set' })

  // Build the storage path — only persist when caller supplies both IDs
  const storagePath = analysisId != null && slideIdx != null
    ? `${analysisId}/${slideIdx}.mp3`
    : null

  const sb = supabaseUrl && serviceKey
    ? createClient(supabaseUrl, serviceKey)
    : null

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

    if (!response.ok) {
      const err = await response.text()
      return res.status(500).json({ error: 'ElevenLabs error', detail: err })
    }

    const audioBuf = Buffer.from(await response.arrayBuffer())

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
