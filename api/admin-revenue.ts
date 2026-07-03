import type { VercelRequest, VercelResponse } from '@vercel/node'
import { createClient } from '@supabase/supabase-js'

import { isAdminEmail } from './_lib/auth.js'
const PADDLE_API_BASE = 'https://api.paddle.com'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function paddleGetAll(path: string, apiKey: string, params: Record<string, string>): Promise<any[]> {
  const results: unknown[] = []
  let url: string | null = `${PADDLE_API_BASE}${path}?${new URLSearchParams({ per_page: '200', ...params }).toString()}`
  while (url) {
    const r = await fetch(url, { headers: { Authorization: `Bearer ${apiKey}` } })
    if (!r.ok) throw new Error(`Paddle ${path} → ${r.status} ${await r.text()}`)
    const json = await r.json()
    results.push(...(json.data ?? []))
    url = json.meta?.pagination?.has_more ? (json.meta.pagination.next as string) : null
  }
  return results
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET') return res.status(405).end()

  const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || ''
  const anonKey = process.env.VITE_SUPABASE_ANON_KEY || ''
  if (!supabaseUrl || !anonKey) return res.status(500).json({ error: 'Missing env vars' })

  const authHeader = (req.headers['authorization'] as string | undefined) || ''
  const jwt = authHeader.replace('Bearer ', '')
  if (!jwt) return res.status(401).json({ error: 'Unauthorized' })

  const anonClient = createClient(supabaseUrl, anonKey)
  const { data: { user }, error: authErr } = await anonClient.auth.getUser(jwt)
  if (authErr || !user) return res.status(401).json({ error: 'Invalid token' })
  if (!isAdminEmail(user.email)) return res.status(403).json({ error: 'Forbidden' })

  const apiKey = process.env.PADDLE_API_KEY || ''
  if (!apiKey) {
    return res.json({ available: false, reason: 'PADDLE_API_KEY not set in Vercel env' })
  }

  try {
    // ── MRR from active subscriptions ──
    const subscriptions = await paddleGetAll('/subscriptions', apiKey, { status: 'active' })

    let mrrGross = 0
    let currency = 'USD'
    for (const sub of subscriptions) {
      const totals = sub.recurring_transaction_details?.totals
      if (!totals) continue
      currency = totals.currency_code || currency
      const amount = Number(totals.total) / 100
      const interval = sub.billing_cycle?.interval as string | undefined
      const frequency = sub.billing_cycle?.frequency || 1
      const monthly = interval === 'year' ? amount / (12 * frequency) : amount / frequency
      mrrGross += monthly
    }

    // ── Actual collected revenue, last 30 days ──
    const since = new Date(Date.now() - 30 * 24 * 3600 * 1000).toISOString()
    const transactions = await paddleGetAll('/transactions', apiKey, {
      status: 'completed',
      'billed_at[gte]': since,
    })

    let revenue30dGross = 0
    let revenue30dFees = 0
    for (const tx of transactions) {
      const totals = tx.details?.totals
      if (!totals) continue
      currency = totals.currency_code || currency
      revenue30dGross += Number(totals.total) / 100
      revenue30dFees += Number(totals.fee ?? 0) / 100
    }

    // Apply same fee model used for the MRR estimate when no real fee data is available yet
    const feeRate = revenue30dGross > 0 ? revenue30dFees / revenue30dGross : 0.05
    const mrrNet = mrrGross * (1 - feeRate)

    return res.json({
      available: true,
      currency,
      activeSubscriptions: subscriptions.length,
      mrrGross: Math.round(mrrGross * 100) / 100,
      mrrNet: Math.round(mrrNet * 100) / 100,
      revenue30dGross: Math.round(revenue30dGross * 100) / 100,
      revenue30dNet: Math.round((revenue30dGross - revenue30dFees) * 100) / 100,
    })
  } catch (err) {
    return res.status(502).json({ available: false, reason: err instanceof Error ? err.message : 'Paddle API error' })
  }
}
