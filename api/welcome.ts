import { getCaller } from './_lib/auth.js'

// ─── Welcome email ──────────────────────────────────────────────────────────
// Fired once, fire-and-forget, after a user completes onboarding. Sends a
// branded Resend email matching the critique-ready email style.

export default async function handler(
  req: { method: string; headers: Record<string, string | undefined> },
  res: {
    status: (code: number) => { json: (b: unknown) => void; end: () => void }
    json: (b: unknown) => void
  }
) {
  if (req.method !== 'POST') return res.status(405).end()

  const resendKey   = process.env.RESEND_API_KEY || ''
  const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || ''
  const serviceKey  = process.env.SUPABASE_SERVICE_ROLE_KEY || ''

  if (!resendKey)   return res.status(500).json({ error: 'Missing RESEND_API_KEY' })
  if (!supabaseUrl || !serviceKey) return res.status(500).json({ error: 'Missing Supabase config' })

  // Identity comes from the caller's JWT, never the body — user ids are
  // discoverable (public analyses rows expose user_id), so a body param
  // would let anyone spam welcome emails to real users from our domain.
  const caller = await getCaller(req.headers['authorization'])
  if (!caller) return res.status(401).json({ error: 'Not authenticated' })

  try {
    const email = caller.email
    if (!email) return res.status(404).json({ error: 'User email not found' })

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
    <p style="font-size:22px;font-weight:800;color:#111;margin:0 0 8px;letter-spacing:-0.5px">Welcome to Critup.ai 👋</p>
    <p style="font-size:15px;color:#6b7280;margin:0 0 24px;line-height:1.6">You're all set. Critup is your AI architecture jury — upload your drawings and get an honest, specific critique in minutes, the kind you'd hear at ETH, the Bartlett, or the GSD.</p>

    <!-- Steps -->
    <table width="100%" cellpadding="0" cellspacing="0" style="border:1.5px solid #e5e7eb;border-radius:14px;overflow:hidden;margin-bottom:24px">
      <tr><td style="padding:18px 20px;border-bottom:1px solid #f0f0f0">
        <span style="font-size:14px;font-weight:700;color:#F97316">1.</span>
        <span style="font-size:14px;font-weight:600;color:#111;margin-left:8px">Upload your project PDF</span>
        <div style="font-size:13px;color:#6b7280;margin-top:4px;margin-left:22px;line-height:1.5">Plans, sections, renders — whatever you'd pin up for a review.</div>
      </td></tr>
      <tr><td style="padding:18px 20px;border-bottom:1px solid #f0f0f0">
        <span style="font-size:14px;font-weight:700;color:#F97316">2.</span>
        <span style="font-size:14px;font-weight:600;color:#111;margin-left:8px">Get scored on concept, spatial &amp; presentation</span>
        <div style="font-size:13px;color:#6b7280;margin-top:4px;margin-left:22px;line-height:1.5">With specific feedback and the questions a jury will actually ask.</div>
      </td></tr>
      <tr><td style="padding:18px 20px">
        <span style="font-size:14px;font-weight:700;color:#F97316">3.</span>
        <span style="font-size:14px;font-weight:600;color:#111;margin-left:8px">Practice your defense</span>
        <div style="font-size:13px;color:#6b7280;margin-top:4px;margin-left:22px;line-height:1.5">Rehearse answers out loud and get coaching before the real thing.</div>
      </td></tr>
    </table>

    <!-- CTA -->
    <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:32px">
      <tr><td align="center">
        <a href="https://critup.ai/projects/new" style="display:inline-block;padding:14px 36px;background:#F97316;color:#ffffff;font-size:15px;font-weight:700;text-decoration:none;border-radius:100px;letter-spacing:-0.2px">
          Upload your first project →
        </a>
      </td></tr>
    </table>
  </td></tr>

  <!-- Footer -->
  <tr><td style="padding:20px 32px 24px;border-top:1px solid #f0f0f0">
    <p style="font-size:12px;color:#9ca3af;margin:0;line-height:1.6">
      You're receiving this because you created an account on <a href="https://critup.ai" style="color:#F97316;text-decoration:none">Critup.ai</a>.<br/>
      Questions? Just reply, or email <a href="mailto:hello@critup.ai" style="color:#F97316;text-decoration:none">hello@critup.ai</a>
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
        subject: 'Welcome to Critup.ai — your AI architecture jury',
        html,
      }),
    })

    return res.json({ ok: true })
  } catch (err) {
    console.error('[welcome]', err)
    return res.status(500).json({ error: 'Welcome email failed', detail: String(err) })
  }
}
