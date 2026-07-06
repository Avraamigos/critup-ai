import type { SupabaseClient } from '@supabase/supabase-js'

// ── Per-call AI cost logging (usage_events, migration 021) ───────────────────
// Fire-and-forget by design: cost tracking must never break or slow a feature.
// If the table doesn't exist yet (migration not run), the insert fails silently
// and everything else behaves exactly as before.

// $ per million tokens.
const PRICING: Record<string, { in: number; out: number }> = {
  'claude-sonnet-4-6': { in: 3, out: 15 },
  'claude-haiku-4-5':  { in: 1, out: 5 },
}
// ElevenLabs Starter overage: $0.08 per 1k characters (worst-case estimate —
// chars inside the plan's included quota actually cost $0).
const TTS_PER_1K_CHARS = 0.08

export function claudeCostUsd(model: string, inputTokens: number, outputTokens: number): number {
  const p = PRICING[model]
  if (!p) return 0
  return (inputTokens / 1_000_000) * p.in + (outputTokens / 1_000_000) * p.out
}

export function ttsCostUsd(chars: number): number {
  return (chars / 1000) * TTS_PER_1K_CHARS
}

export interface UsageEvent {
  userId: string | null
  feature: 'analysis' | 'chat' | 'jury_script' | 'jury_shorten' | 'tts'
  model: string
  inputTokens?: number
  outputTokens?: number
  chars?: number
  costUsd: number
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function logUsage(supabase: SupabaseClient<any, any, any>, e: UsageEvent): void {
  supabase
    .from('usage_events')
    .insert({
      user_id: e.userId,
      feature: e.feature,
      model: e.model,
      input_tokens: e.inputTokens ?? null,
      output_tokens: e.outputTokens ?? null,
      chars: e.chars ?? null,
      cost_usd: Math.round(e.costUsd * 1_000_000) / 1_000_000,
    })
    .then(
      ({ error }) => { if (error) console.warn('[usage] insert failed (migration 021 run?):', error.message) },
      () => {}
    )
}
