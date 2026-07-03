import type { VercelRequest, VercelResponse } from '@vercel/node'
import { createClient } from '@supabase/supabase-js'
import { createHmac, timingSafeEqual } from 'crypto'

// ─── Supabase admin client ────────────────────────────────────────────────────
function getSupabase() {
  const url = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || ''
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || ''
  return createClient(url, key)
}

// ─── Paddle webhook signature verification ───────────────────────────────────
// Exported for unit tests — the money path deserves a regression net.
export function verifySignature(rawBody: string, signatureHeader: string, secret: string): boolean {
  try {
    const parts = Object.fromEntries(signatureHeader.split(';').map(p => p.split('=')))
    const ts = parts['ts']
    const h1 = parts['h1']
    if (!ts || !h1) return false

    const payload = `${ts}:${rawBody}`
    const expected = createHmac('sha256', secret).update(payload).digest('hex')
    const expectedBuf = Buffer.from(expected, 'hex')
    const receivedBuf = Buffer.from(h1, 'hex')
    if (expectedBuf.length !== receivedBuf.length) return false
    return timingSafeEqual(expectedBuf, receivedBuf)
  } catch {
    return false
  }
}

// ─── Main handler ────────────────────────────────────────────────────────────
export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') return res.status(405).end()

  const webhookSecret = process.env.PADDLE_WEBHOOK_SECRET || ''
  const signatureHeader = (req.headers['paddle-signature'] as string) || ''

  // Read raw body for signature verification
  const rawBody = await new Promise<string>((resolve, reject) => {
    let data = ''
    req.on('data', chunk => (data += chunk))
    req.on('end', () => resolve(data))
    req.on('error', reject)
  })

  // Fail closed: a webhook that can upgrade accounts MUST be signed. If the
  // secret isn't configured, reject every request rather than trusting the
  // body (an unsigned POST could otherwise grant anyone a Pro plan for free).
  if (!webhookSecret) {
    console.error('Paddle webhook: PADDLE_WEBHOOK_SECRET not set — rejecting')
    return res.status(500).json({ error: 'Webhook not configured' })
  }
  if (!verifySignature(rawBody, signatureHeader, webhookSecret)) {
    console.warn('Paddle webhook: invalid signature')
    return res.status(401).json({ error: 'Invalid signature' })
  }

  let event: Record<string, unknown>
  try {
    event = JSON.parse(rawBody)
  } catch {
    return res.status(400).json({ error: 'Invalid JSON' })
  }

  const eventType = event.event_type as string
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const data = event.data as Record<string, any>
  const customData = data?.custom_data as Record<string, string> | null
  const userId = customData?.userId

  console.log('Paddle webhook:', eventType, { userId })

  if (!userId) {
    // No userId — nothing to update
    return res.status(200).json({ ok: true })
  }

  const supabase = getSupabase()

  switch (eventType) {
    // ── Subscription activated or payment succeeded ──
    case 'subscription.activated':
    case 'subscription.updated': {
      const status = data?.status as string
      if (status === 'active' || status === 'trialing') {
        const interval = data?.billing_cycle?.interval as string | undefined
        const plan = interval === 'year' ? 'yearly' : 'monthly'
        await supabase
          .from('profiles')
          .update({ plan })
          .eq('id', userId)
        console.log('Paddle: upgraded user', userId, 'to', plan)

        // Reconciliation link back to Paddle (refunds/disputes/support).
        // SEPARATE update on purpose: if migration 020 hasn't been run yet,
        // this fails alone and can never block the plan flip above.
        const subscriptionId = data?.id as string | undefined
        if (subscriptionId) {
          const { error: subErr } = await supabase
            .from('profiles')
            .update({ paddle_subscription_id: subscriptionId })
            .eq('id', userId)
          if (subErr) console.warn('Paddle: could not store subscription id (run migration 020?):', subErr.message)
        }
      }
      break
    }

    // ── Subscription canceled or payment failed ──
    case 'subscription.canceled':
    case 'subscription.past_due': {
      await supabase
        .from('profiles')
        .update({ plan: 'free' })
        .eq('id', userId)
      console.log('Paddle: downgraded user', userId, 'to free')
      break
    }

    default:
      // Ignore other events
      break
  }

  return res.status(200).json({ ok: true })
}
