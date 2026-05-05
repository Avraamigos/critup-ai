// ElevenLabs text-to-speech endpoint
// Add ELEVENLABS_API_KEY and ELEVENLABS_VOICE_ID to Vercel env vars

export default async function handler(
  req: { method: string; body: { text: string; voiceId?: string } },
  res: {
    status: (code: number) => { json: (b: unknown) => void; end: () => void }
    json: (b: unknown) => void
    setHeader: (k: string, v: string) => void
    send: (b: Buffer) => void
  }
) {
  if (req.method !== 'POST') return res.status(405).end()

  const apiKey = process.env.ELEVENLABS_API_KEY || ''
  const defaultVoiceId = process.env.ELEVENLABS_VOICE_ID || 'oXxZrNLpn6nWkEBAMSJs'
  const voiceId = req.body?.voiceId || defaultVoiceId

  if (!apiKey) return res.status(500).json({ error: 'ELEVENLABS_API_KEY not set' })

  const text = req.body?.text
  if (!text) return res.status(400).json({ error: 'text required' })

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

    const audio = Buffer.from(await response.arrayBuffer())
    res.setHeader('Content-Type', 'audio/mpeg')
    res.setHeader('Cache-Control', 'public, max-age=300')
    res.send(audio)
  } catch (err) {
    return res.status(500).json({ error: 'TTS failed', detail: String(err) })
  }
}
