import { supabase } from './supabase'
import { authHeader } from './authHeader'

// Client helpers for the poster tool. The server endpoint is co-hosted in
// /api/jury-script (action:'poster') until we move to Vercel Pro — the client
// doesn't care, it just posts actions.

export type PosterFormat = 'vertical' | 'horizontal'

export interface PosterResult {
  id: string | null
  url: string | null
  remaining: number
}

/** Upload one input image into the caller's own posters/{uid}/inputs folder.
 *  Returns the storage path to hand to the server. */
export async function uploadPosterInput(userId: string, file: File): Promise<string> {
  const safe = file.name.replace(/[^a-zA-Z0-9._-]/g, '_').slice(-40)
  const path = `${userId}/inputs/${crypto.randomUUID()}-${safe}`
  const { error } = await supabase.storage.from('posters').upload(path, file, {
    cacheControl: '3600', upsert: false, contentType: file.type || 'image/png',
  })
  if (error) throw new Error(error.message)
  return path
}

export async function getPosterCredits(): Promise<{ used: number; limit: number; remaining: number }> {
  const res = await fetch('/api/jury-script', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...(await authHeader()) },
    body: JSON.stringify({ action: 'poster_credits' }),
  })
  if (!res.ok) return { used: 0, limit: 15, remaining: 15 }
  return res.json()
}

export interface GeneratePosterArgs {
  format: PosterFormat
  template: string
  heroPath: string
  planPaths?: string[]
  titleHint?: string
  analysisId?: string | null
}

export async function generatePoster(args: GeneratePosterArgs): Promise<PosterResult & { error?: string; message?: string }> {
  const res = await fetch('/api/jury-script', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...(await authHeader()) },
    body: JSON.stringify({ action: 'poster', heroBucket: 'posters', planBucket: 'posters', ...args }),
  })
  const data = await res.json().catch(() => ({}))
  if (!res.ok) return { id: null, url: null, remaining: 0, error: data?.error, message: data?.message }
  return data
}
