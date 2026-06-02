import { useState, useEffect, useRef, useCallback } from 'react'
import { useParams, useNavigate } from '@tanstack/react-router'
import { ChevronLeft, Play, Pause, Download, Loader2, AlertCircle, Plus, Volume2, VolumeX, Upload, X, FileText, Link, Check, Users, Globe } from 'lucide-react'
import { ScoreRing } from '@/components/ScoreRing'
import { PDFViewer } from '@/components/PDFViewer'
import { useTheme, useColors } from '@/lib/theme'
import { useAuth } from '@/lib/auth'
import { supabase } from '@/lib/supabase'
import type { Json } from '@/lib/database.types'
import { track } from '@/lib/analytics'
import { renderPdfToJpegBlobs } from '@/lib/pdfSlides'

// ─── Types ───────────────────────────────────────────────────────────────────

type FeedbackItem = {
  n: number
  title: string
  text: string
  suggestion: string
  page?: number
  focus?: { x: number; y: number }
  zoom?: number
}

type AnalysisData = {
  id: string
  status: string
  concept_score: number | null
  spatial_score: number | null
  presentation_score: number | null
  feedback: Json | null
  jury_questions: Json | null
  pdf_path: string | null
  is_public: boolean | null
  caption: string | null
  error_message: string | null
  created_at: string
}

type ProjectData = {
  id: string
  name: string
  stage: string
  discipline: string | null
  analyses: AnalysisData[]
}

const STAGE_META: Record<string, { label: string; color: string }> = {
  'pre-design':       { label: 'Pre-Design',       color: '#6366f1' },
  'initial-concept':  { label: 'Initial Concept',  color: '#F97316' },
  'finalized-design': { label: 'Finalized Design', color: 'oklch(0.72 0.17 145)' },
  'jury-prep':        { label: 'Jury Prep',         color: 'oklch(0.65 0.18 25)' },
}

// ─── Module-level audio cache ─────────────────────────────────────────────────
// Keyed by `${projectId}-${slideIdx}`. Persists across component unmounts within
// the same browser session — so navigating to dashboard and back won't re-bill ElevenLabs.
const globalAudioCache = new Map<string, Blob>()

// Strip markdown so the text matches what the TTS API sends to ElevenLabs
function cleanForTTS(raw: string): string {
  return raw
    .replace(/\*\*(.*?)\*\*/g, '$1')
    .replace(/\*(.*?)\*/g, '$1')
    .replace(/`[^`]*`/g, '')
    .replace(/→|->|»|•/g, '. ')
    .replace(/#+\s*/g, '')
    .replace(/_{2,}/g, '')
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
    .replace(/\s{2,}/g, ' ')
    .trim()
}

// ─── Main ─────────────────────────────────────────────────────────────────────

export function AnalysisPage() {
  const { theme } = useTheme()
  const c = useColors(theme)
  const params   = useParams({ from: '/app/analysis/$projectId' })
  const navigate = useNavigate()
  const { user, profile } = useAuth()
  const isPro = !!profile && profile.plan !== 'free'
  const FONT = "-apple-system, BlinkMacSystemFont, 'SF Pro Display', 'Helvetica Neue', 'Inter', sans-serif"

  const [isMobile,   setIsMobile]   = useState(() => window.innerWidth < 768)
  const [project,    setProject]   = useState<ProjectData | null>(null)
  const [loading,    setLoading]   = useState(true)
  const [error,      setError]     = useState<string | null>(null)
  const [slideIdx,      setSlideIdx]     = useState(0)
  const [isPlaying,     setIsPlaying]    = useState(false)
  const [voiceOn,       setVoiceOn]      = useState(false)  // set true for pro users once profile loads
  const [pdfUrl,        setPdfUrl]       = useState<string | null>(null)
  const [speaking,      setSpeaking]     = useState(false)
  const [captionWords,  setCaptionWords] = useState<string[]>([])
  const [audioReady,    setAudioReady]   = useState(false)   // true once slide 0 is in cache

  // ── Analysis progress bar state ──
  // Lazy init from localStorage so a page reload resumes at the correct position
  // instead of flashing from 0 and showing "Receiving your drawings…" again.
  const [progress, setProgress] = useState(() => {
    const stored = localStorage.getItem(`critup_analysis_start_${params.projectId}`)
    if (!stored) return 0
    const elapsed = (Date.now() - parseInt(stored, 10)) / 1000
    return Math.min(85, (elapsed / 240) * 97)
  })

  // ── Share / post state ──
  const [sharing,     setSharing]     = useState(false)  // in-flight for post/unpublish
  const [linkCopied,  setLinkCopied]  = useState(false)  // "Copied!" on the Copy-link button
  const [showPostModal, setShowPostModal] = useState(false)
  const [showUnpublishModal, setShowUnpublishModal] = useState(false)
  const [postCaption, setPostCaption] = useState('')
  const [slideProgress, setSlideProgress] = useState<{ done: number; total: number } | null>(null)

  // ── Re-upload (new version) state ──
  const [showReupload,    setShowReupload]    = useState(false)
  const [reuploadFile,    setReuploadFile]    = useState<File | null>(null)
  const [reuploadDrag,    setReuploadDrag]    = useState(false)
  const [reuploadSaving,  setReuploadSaving]  = useState(false)
  const [reuploadError,   setReuploadError]   = useState<string | null>(null)
  const [retryKey,        setRetryKey]        = useState(0)

  // ── Refs so callbacks always see current values ──
  const abortRef      = useRef<AbortController | null>(null)
  const audioRef      = useRef<HTMLAudioElement | null>(null)
  const playTimerRef  = useRef<ReturnType<typeof setTimeout> | null>(null)
  const wordTimerRef  = useRef<ReturnType<typeof setInterval> | null>(null)
  const isPlayingRef  = useRef(false)
  const voiceOnRef    = useRef(true)
  const feedbackRef   = useRef<FeedbackItem[]>([])
  const totalRef      = useRef(1)
  // Tracks whether audio is mid-playback but paused (not stopped)
  const pausedRef     = useRef(false)
  // Tracks which word the caption timer was at when audio was paused,
  // so resume can continue from the same word rather than restarting.
  const captionIdxRef = useRef(0)
  // Stable ref to the analysis ID — needed inside speakSlide callback without
  // re-creating it every time latestAnalysis changes reference
  const analysisIdRef = useRef<string | null>(null)

  useEffect(() => {
    const onResize = () => setIsMobile(window.innerWidth < 768)
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [])

  // ── Progress bar: exponential fill, survives page reloads via localStorage ──
  useEffect(() => {
    // Don't touch the start-time key while data is still loading — `project` is
    // null during the initial fetch on every reload, and clearing it here would
    // wipe the start time and reset the bar to zero before we know the real status.
    if (!project) return
    const isPending = project.analyses?.some(a => a.status === 'pending' || a.status === 'processing')
    if (!isPending) {
      localStorage.removeItem(`critup_analysis_start_${params.projectId}`)
      return
    }
    // Restore start time from localStorage so reloads resume progress correctly
    const key = `critup_analysis_start_${params.projectId}`
    const stored = localStorage.getItem(key)
    const startTime = stored ? parseInt(stored, 10) : Date.now()
    if (!stored) localStorage.setItem(key, String(startTime))

    // Calculate initial progress based on elapsed time (analysis takes ~4 min)
    const elapsed = (Date.now() - startTime) / 1000
    const initialProgress = Math.min(94, elapsed / 240 * 97)
    setProgress(initialProgress)

    const tick = setInterval(() => {
      setProgress(p => p + Math.max(0.05, (97 - p) * 0.009))
    }, 400)
    return () => clearInterval(tick)
  }, [project?.analyses?.map(a => a.status).join(), params.projectId])

  // Keep refs in sync with state (order matters — these run before the main effect)
  useEffect(() => { isPlayingRef.current = isPlaying }, [isPlaying])
  useEffect(() => { voiceOnRef.current   = voiceOn   }, [voiceOn])

  // Enable voice by default once we confirm the user is Pro
  useEffect(() => { if (isPro) setVoiceOn(true) }, [isPro])

  // ── Load data with polling ──
  useEffect(() => {
    let pollTimer: ReturnType<typeof setTimeout> | null = null
    let timeoutTimer: ReturnType<typeof setTimeout> | null = null
    const load = async () => {
      const { data, error: err } = await supabase
        .from('projects')
        .select('id, name, stage, discipline, analyses(id, status, concept_score, spatial_score, presentation_score, feedback, jury_questions, pdf_path, is_public, caption, error_message, created_at)')
        .eq('id', params.projectId)
        .single()
      if (err || !data) { setError('Project not found.'); setLoading(false); return }
      const proj = data as unknown as ProjectData
      setProject(proj)
      setLoading(false)

      // If the server marked the latest attempt as failed, surface its real reason
      // immediately instead of letting the client spin until the 7-min timeout.
      const hasComplete = proj.analyses?.some(a => a.status === 'complete')
      const failed = proj.analyses
        ?.filter(a => a.status === 'failed')
        .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())[0]
      if (failed && !hasComplete) {
        if (pollTimer) clearTimeout(pollTimer)
        if (timeoutTimer) clearTimeout(timeoutTimer)
        localStorage.removeItem(`critup_analysis_start_${params.projectId}`)
        setError(failed.error_message || 'Analysis failed. Please try re-uploading your PDF.')
        return
      }

      const stillPending = proj.analyses?.some(a => a.status === 'pending' || a.status === 'processing')
      if (stillPending) {
        pollTimer = setTimeout(load, 4000)
        // Give up 7 min after the analysis actually STARTED (persisted in localStorage),
        // not 7 min after this effect mounted — so navigating away/back doesn't reset the clock.
        if (!timeoutTimer) {
          const startKey = `critup_analysis_start_${params.projectId}`
          const startedAt = parseInt(localStorage.getItem(startKey) ?? '', 10) || Date.now()
          const remaining = Math.max(10_000, 7 * 60 * 1000 - (Date.now() - startedAt))
          timeoutTimer = setTimeout(() => {
            if (pollTimer) clearTimeout(pollTimer)
            setError('Analysis is taking longer than expected. Please try re-uploading your PDF.')
          }, remaining)
        }
      } else {
        if (timeoutTimer) clearTimeout(timeoutTimer)
      }
    }
    setLoading(true); setError(null); load()
    const sub = supabase.channel(`analysis-${params.projectId}`)
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'analyses', filter: `project_id=eq.${params.projectId}` }, load)
      .subscribe()
    return () => { if (pollTimer) clearTimeout(pollTimer); if (timeoutTimer) clearTimeout(timeoutTimer); supabase.removeChannel(sub) }
  }, [params.projectId, retryKey])

  const sortedComplete = project?.analyses
    ?.filter(a => a.status === 'complete')
    .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()) ?? []

  const latestAnalysis   = sortedComplete[0]
  const previousAnalysis = sortedComplete[1] ?? null   // second-most-recent, for score delta

  // ── Remember last-visited project + analysis for sidebar nav and AI chat ──
  // Two distinct keys, two distinct meanings:
  //   critup_last_project_id  → PROJECT id, for the sidebar "Analysis" nav link
  //   critup_last_analysis_id → ANALYSIS ROW id, which chat.ts / jury.tsx look up
  // Storing the project id under the analysis key (the old bug) made Crit chat
  // unable to find the critique → "upload your drawings".
  useEffect(() => {
    localStorage.setItem('critup_last_project_id', params.projectId)
    if (latestAnalysis?.id) localStorage.setItem('critup_last_analysis_id', latestAnalysis.id)
    if (project?.name) localStorage.setItem('critup_last_project_name', project.name)
  }, [params.projectId, latestAnalysis?.id, project?.name])

  const latestFailed = !latestAnalysis && project?.analyses?.some(a => a.status === 'failed')

  // Keep analysisId ref in sync so speakSlide can read it without re-creating
  useEffect(() => { analysisIdRef.current = latestAnalysis?.id ?? null }, [latestAnalysis?.id])

  // ── Re-upload handler ──
  const handleReupload = useCallback(async () => {
    if (!reuploadFile || !user || reuploadSaving) return
    setReuploadSaving(true)
    setReuploadError(null)
    try {
      // 1. Upload new PDF to storage
      const pdfPath = `${user.id}/${params.projectId}/${Date.now()}_${reuploadFile.name}`
      const { error: uploadErr } = await supabase.storage
        .from('project-pdfs')
        .upload(pdfPath, reuploadFile, { cacheControl: '3600', upsert: false })
      if (uploadErr) throw new Error(uploadErr.message)

      // 2. Create new analysis row under same project
      const { data: newAnalysis, error: rowErr } = await supabase
        .from('analyses')
        .insert({ project_id: params.projectId, user_id: user.id, status: 'pending', pdf_path: pdfPath })
        .select('id')
        .single()
      if (rowErr || !newAnalysis) throw new Error(rowErr?.message ?? 'Failed to create analysis row')

      const newId = (newAnalysis as { id: string }).id

      // 3. Reset timeout clock so the 7-min window starts fresh for this attempt
      const startKey = `critup_analysis_start_${params.projectId}`
      localStorage.removeItem(startKey)
      localStorage.setItem(startKey, String(Date.now()))

      // 4. Trigger analysis (fire-and-forget — polling handles the rest)
      fetch('/api/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ analysisId: newId }),
      }).catch(console.error)

      // 5. Update active project context for Crit chat
      localStorage.setItem('critup_last_analysis_id', newId)

      // 5. Close modal — existing realtime subscription picks up status changes automatically
      setShowReupload(false)
      setReuploadFile(null)
      setSlideIdx(0)
    } catch (err) {
      setReuploadError(err instanceof Error ? err.message : 'Upload failed. Please try again.')
    } finally {
      setReuploadSaving(false)
    }
  }, [reuploadFile, user, reuploadSaving, params.projectId])

  // ── Get signed PDF URL ──
  useEffect(() => {
    if (!latestAnalysis?.pdf_path) return
    supabase.storage.from('project-pdfs').createSignedUrl(latestAnalysis.pdf_path, 7200)
      .then(({ data }) => { if (data?.signedUrl) setPdfUrl(data.signedUrl) })
  }, [latestAnalysis?.pdf_path])

  const isPending = project?.analyses?.some(a => a.status === 'pending' || a.status === 'processing')
  const stage     = project ? (STAGE_META[project.stage] ?? { label: project.stage, color: '#F97316' }) : null

  const feedbackItems: FeedbackItem[] = Array.isArray(latestAnalysis?.feedback)
    ? latestAnalysis.feedback as unknown as FeedbackItem[]
    : []
  const juryQuestions: string[] = Array.isArray(latestAnalysis?.jury_questions)
    ? latestAnalysis.jury_questions as unknown as string[]
    : []

  useEffect(() => { feedbackRef.current = feedbackItems }, [feedbackItems])
  useEffect(() => { totalRef.current = feedbackItems.length + 1 }, [feedbackItems.length])

  // ── Prefetch audio into memory so first "Play" is instant ──
  // Fetches slide 0 and 1 as soon as analysis data lands, and prefetches
  // slide idx+1 whenever the user navigates. Cache is module-level so it
  // survives navigation within the same session.
  const prefetchSlide = useCallback((idx: number, onReady?: () => void) => {
    if (idx < 0 || idx >= feedbackRef.current.length) return
    const cacheKey = `${params.projectId}-${idx}`
    if (globalAudioCache.has(cacheKey)) { onReady?.(); return }
    const fb = feedbackRef.current[idx]
    if (!fb) return
    const text = cleanForTTS(`${fb.title}. ${fb.text}. ${fb.suggestion}`)
    const aId = analysisIdRef.current
    fetch('/api/tts', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text, analysisId: aId, slideIdx: idx }),
    })
      .then(r => r.ok ? r.blob() : null)
      .then(blob => {
        if (blob) {
          globalAudioCache.set(cacheKey, blob)
          onReady?.()
        }
      })
      .catch(() => {})
  }, [params.projectId])

  // Prefetch first 2 slides when feedback data arrives; mark slide 0 ready when done
  useEffect(() => {
    if (feedbackItems.length === 0 || !voiceOn) return
    setAudioReady(globalAudioCache.has(`${params.projectId}-0`))
    prefetchSlide(0, () => setAudioReady(true))
    prefetchSlide(1)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [feedbackItems.length, latestAnalysis?.id, voiceOn])

  // When slide changes: check if the new slide's audio is already ready
  useEffect(() => {
    const key = `${params.projectId}-${slideIdx}`
    setAudioReady(!voiceOn || globalAudioCache.has(key))
    if (voiceOn) prefetchSlide(slideIdx, () => setAudioReady(true))
    if (voiceOn) prefetchSlide(slideIdx + 1)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [slideIdx, voiceOn])

  // ── Kill all audio, pending fetch, timers ──
  const killAudio = useCallback(() => {
    pausedRef.current = false
    if (playTimerRef.current) { clearTimeout(playTimerRef.current); playTimerRef.current = null }
    if (wordTimerRef.current) { clearInterval(wordTimerRef.current); wordTimerRef.current = null }
    abortRef.current?.abort()
    abortRef.current = null
    if (audioRef.current) {
      audioRef.current.onended = null
      audioRef.current.onerror = null
      audioRef.current.pause()
      audioRef.current = null
    }
    setSpeaking(false)
  }, [])

  // ── Rolling caption ──
  // startFrom lets resume continue from the paused word index instead of 0.
  const startCaption = useCallback((text: string, startFrom = 0) => {
    if (wordTimerRef.current) clearInterval(wordTimerRef.current)
    const words = text.split(/\s+/).filter(Boolean)
    let idx = startFrom
    // On fresh start clear captions; on resume keep current words visible
    if (startFrom === 0) {
      setCaptionWords([])
      captionIdxRef.current = 0
    }
    wordTimerRef.current = setInterval(() => {
      idx++
      captionIdxRef.current = idx
      setCaptionWords(words.slice(Math.max(0, idx - 10), idx))
      if (idx >= words.length) {
        clearInterval(wordTimerRef.current!)
        wordTimerRef.current = null
      }
    }, 400)
  }, [])

  // ── Play a blob with caption ──
  const playBlob = useCallback((blob: Blob, text: string, onDone?: () => void) => {
    const url = URL.createObjectURL(blob)
    const audio = new Audio(url)
    audioRef.current = audio
    setSpeaking(true)
    startCaption(text)
    const finish = () => {
      setSpeaking(false)
      URL.revokeObjectURL(url)
      if (audioRef.current === audio) audioRef.current = null
      if (wordTimerRef.current) { clearInterval(wordTimerRef.current); wordTimerRef.current = null }
      onDone?.()
    }
    audio.onended = finish
    audio.onerror = finish
    audio.play().catch(finish)
  }, [startCaption])

  // ── Speak a slide — uses module-level cache so ElevenLabs is only billed once ──
  const speakSlide = useCallback((idx: number, onDone?: () => void) => {
    killAudio()
    const fb = feedbackRef.current[idx]
    if (!fb) { onDone?.(); return }
    const text = cleanForTTS(`${fb.title}. ${fb.text}. ${fb.suggestion}`)
    const cacheKey = `${params.projectId}-${idx}`

    const cached = globalAudioCache.get(cacheKey)
    if (cached) { playBlob(cached, text, onDone); return }

    const ctrl = new AbortController()
    abortRef.current = ctrl

    fetch('/api/tts', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        text,
        analysisId: analysisIdRef.current,
        slideIdx: idx,
      }),
      signal: ctrl.signal,
    })
      .then(res => {
        if (!res.ok || ctrl.signal.aborted) throw new Error('tts-fail')
        return res.blob()
      })
      .then(blob => {
        if (ctrl.signal.aborted) return
        globalAudioCache.set(cacheKey, blob)
        playBlob(blob, text, onDone)
      })
      .catch(e => {
        if ((e as DOMException).name !== 'AbortError') {
          setSpeaking(false)
          onDone?.()
        }
      })
  }, [killAudio, playBlob, params.projectId])

  // ── Start audio for a slide (call when fresh playback begins for idx) ──
  const startSlideAudio = useCallback((idx: number) => {
    const fb = feedbackRef.current[idx]
    const isLast = idx >= totalRef.current - 1
    const advance = () => {
      if (!isPlayingRef.current) return
      setSlideIdx(s => {
        if (s >= totalRef.current - 1) { setIsPlaying(false); return s }
        return s + 1
      })
    }
    if (voiceOnRef.current && fb) {
      speakSlide(idx, advance)
    } else if (!isLast) {
      playTimerRef.current = setTimeout(advance, 5000)
    } else {
      setIsPlaying(false)
    }
  }, [speakSlide])

  // ── Effect: runs when slide or voice changes (NOT isPlaying) ──
  // isPlaying is intentionally excluded from deps — we manage play/pause imperatively.
  useEffect(() => {
    killAudio()
    setCaptionWords([])
    captionIdxRef.current = 0
    // If already playing (e.g., slide changed mid-playback), restart audio for new slide
    if (isPlayingRef.current) {
      startSlideAudio(slideIdx)
    }
    return killAudio
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [slideIdx, voiceOn])

  // ── Stop audio on unmount ──
  useEffect(() => killAudio, [killAudio])

  // ── Play / Pause handler ──
  // • First press  → fresh start (audio begins from word 1)
  // • While playing → pauses mid-audio, keeps seek position
  // • While paused  → resumes from exact pause point
  const handlePlayPause = useCallback(() => {
    if (isPlaying) {
      // Pause: suspend audio, keep position
      if (audioRef.current && !audioRef.current.paused) {
        audioRef.current.pause()
        pausedRef.current = true
      }
      if (playTimerRef.current) { clearTimeout(playTimerRef.current); playTimerRef.current = null }
      if (wordTimerRef.current) { clearInterval(wordTimerRef.current); wordTimerRef.current = null }
      isPlayingRef.current = false
      setIsPlaying(false)
    } else if (pausedRef.current && audioRef.current) {
      // Resume: continue audio and captions from exact paused position
      pausedRef.current = false
      isPlayingRef.current = true
      setIsPlaying(true)
      setSpeaking(true)
      const fb = feedbackRef.current[slideIdx]
      // Resume caption from where it was paused (captionIdxRef holds the word index)
      if (fb) startCaption(cleanForTTS(`${fb.title}. ${fb.text}. ${fb.suggestion}`), captionIdxRef.current)
      audioRef.current.play().catch(() => {
        // If browser can't resume (e.g., blob expired), restart fresh
        startSlideAudio(slideIdx)
      })
    } else {
      // Fresh start
      isPlayingRef.current = true
      setIsPlaying(true)
      startSlideAudio(slideIdx)
    }
  }, [isPlaying, slideIdx, startSlideAudio, startCaption])

  // ── Loading ──
  if (loading) return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', gap: 10, color: c.textMuted }}>
      <Loader2 size={20} style={{ animation: 'spin 1s linear infinite' }} />
      <span style={{ fontSize: 14 }}>Loading…</span>
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </div>
  )

  // ── Error ──
  if (error || !project) return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', gap: 16, padding: '0 24px', textAlign: 'center' }}>
      <div style={{ width: 56, height: 56, borderRadius: '50%', background: 'oklch(0.65 0.18 25 / 0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <AlertCircle size={26} color="oklch(0.65 0.18 25)" />
      </div>
      <div>
        <p style={{ fontSize: 16, fontWeight: 700, color: c.textPrimary, margin: '0 0 6px' }}>Something went wrong</p>
        <p style={{ fontSize: 13, color: c.textMuted, margin: 0, maxWidth: 320 }}>{error || 'Project not found.'}</p>
      </div>
      <div style={{ display: 'flex', gap: 10 }}>
        <button onClick={() => navigate({ to: '/projects' })} style={{ padding: '9px 20px', borderRadius: 100, background: 'none', border: `1px solid ${c.border}`, color: c.textMuted, fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
          ← My Projects
        </button>
        {error && (
          <button onClick={() => setRetryKey(k => k + 1)} style={{ padding: '9px 20px', borderRadius: 100, background: '#F97316', border: 'none', color: '#fff', fontSize: 13, fontWeight: 600, cursor: 'pointer', boxShadow: '0 0 14px oklch(0.72 0.18 45 / 0.3)' }}>
            Try again
          </button>
        )}
      </div>
    </div>
  )

  // ── Pending ──
  if (!latestAnalysis) return (
    <div style={{ padding: '24px 28px' }}>
      <button onClick={() => navigate({ to: '/projects' })} style={{ background: 'none', border: 'none', cursor: 'pointer', color: c.textMuted, fontSize: 13, padding: 0, marginBottom: 16, display: 'flex', alignItems: 'center', gap: 4 }}>
        <ChevronLeft size={14} /> My Projects
      </button>
      <h1 style={{ fontSize: 20, fontWeight: 800, color: c.textPrimary, margin: '0 0 4px', fontFamily: FONT }}>{project.name}</h1>
      <div style={{ marginTop: 48, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16, textAlign: 'center' }}>
        {isPending ? (
          <>
            <style>{`
              @keyframes bar-shimmer {
                0%   { transform: translateX(-100%); }
                100% { transform: translateX(250%); }
              }
              @keyframes bar-glow-pulse {
                0%,100% { box-shadow: 0 0 8px #F97316, 0 0 20px oklch(0.72 0.18 45/0.35); }
                50%     { box-shadow: 0 0 16px #F97316, 0 0 40px oklch(0.72 0.18 45/0.6); }
              }
            `}</style>

            {/* Stage label */}
            <p style={{ fontSize: 13, fontWeight: 600, color: '#F97316', margin: '0 0 20px', letterSpacing: '0.01em', fontFamily: FONT }}>
              {progress < 8  ? 'Receiving your drawings…'
              : progress < 22 ? 'Reading every page…'
              : progress < 52 ? 'Studying your design…'
              : progress < 75 ? 'Writing critique…'
              : progress < 90 ? 'Checking quality…'
              : 'Almost ready…'}
            </p>

            {/* Bar track */}
            <div style={{
              width: 280, height: 6, borderRadius: 100,
              background: c.isDark ? 'oklch(0.22 0.006 270)' : '#e5e7eb',
              overflow: 'hidden',
              position: 'relative',
            }}>
              {/* Filled portion */}
              <div style={{
                height: '100%',
                width: `${Math.min(97, progress)}%`,
                borderRadius: 100,
                background: 'linear-gradient(90deg, #e86a00, #F97316, #ffaa55)',
                transition: 'width 0.4s ease',
                animation: 'bar-glow-pulse 2s ease-in-out infinite',
                position: 'relative',
                overflow: 'hidden',
              }}>
                {/* Shimmer sweep */}
                <div style={{
                  position: 'absolute', top: 0, bottom: 0, width: '35%',
                  background: 'linear-gradient(90deg, transparent, rgba(255,255,255,0.55), transparent)',
                  animation: 'bar-shimmer 1.8s ease-in-out infinite',
                }} />
              </div>
            </div>

            <h2 style={{ fontSize: 20, fontWeight: 700, margin: '28px 0 0', color: c.textPrimary, fontFamily: FONT }}>Analysis in progress</h2>
            <p style={{ fontSize: 14, color: c.textMuted, maxWidth: 340, margin: '8px 0 0', lineHeight: 1.6 }}>
              Crit is reading every page of your drawings in detail.<br/>
              This usually takes <strong style={{ color: c.textPrimary }}>3–5 minutes</strong> — longer projects take a bit more.
            </p>
            <p style={{ fontSize: 12, color: c.textMuted, maxWidth: 300, margin: '14px 0 0', lineHeight: 1.5, opacity: 0.7 }}>
              You can leave this tab open in the background.<br/>Your results will be here when it's done.
            </p>
          </>
        ) : latestFailed ? (
          <>
            <div style={{ fontSize: 48 }}>⚠️</div>
            <h2 style={{ fontSize: 18, fontWeight: 700, margin: 0, color: c.textPrimary }}>Analysis failed</h2>
            <p style={{ fontSize: 14, color: c.textMuted, maxWidth: 300, textAlign: 'center', lineHeight: 1.6, margin: '4px 0 0' }}>Something went wrong while processing your drawings. Please try uploading again.</p>
            <button onClick={() => navigate({ to: '/projects/new' })} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 24px', borderRadius: 100, background: '#F97316', border: 'none', color: '#fff', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
              <Plus size={15} /> Try again
            </button>
          </>
        ) : (
          <>
            <div style={{ fontSize: 48 }}>📐</div>
            <h2 style={{ fontSize: 18, fontWeight: 700, margin: 0, color: c.textPrimary }}>No analysis yet</h2>
            <button onClick={() => navigate({ to: '/projects/new' })} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 24px', borderRadius: 100, background: '#F97316', border: 'none', color: '#fff', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
              <Plus size={15} /> Upload drawings
            </button>
          </>
        )}
      </div>
    </div>
  )

  // ── Full analysis ──
  const avg         = ((latestAnalysis.concept_score ?? 0) + (latestAnalysis.spatial_score ?? 0) + (latestAnalysis.presentation_score ?? 0)) / 3
  const totalSlides = feedbackItems.length + 1
  const isSummary   = slideIdx >= feedbackItems.length
  const current     = !isSummary ? feedbackItems[slideIdx] : null

  const pdfPage   = current?.page  ?? 1
  const focusX    = current?.focus?.x ?? 0.5
  const focusY    = current?.focus?.y ?? 0.5
  // Only apply zoom when Claude is pointing at a specific element (threshold > 1.15)
  const zoomLevel = (current?.zoom ?? 1) > 1.15 ? (current?.zoom ?? 1) : 1

  const scoreRings = [
    { label: 'Concept',      score: latestAnalysis.concept_score ?? 0 },
    { label: 'Spatial',      score: latestAnalysis.spatial_score ?? 0 },
    { label: 'Presentation', score: latestAnalysis.presentation_score ?? 0 },
  ]
  const ringSummaries = [
    feedbackItems.find((_, i) => i % 3 === 0)?.title ?? '—',
    feedbackItems.find((_, i) => i % 3 === 1)?.title ?? '—',
    feedbackItems.find((_, i) => i % 3 === 2)?.title ?? '—',
  ]

  // Score deltas vs previous version (null when no previous analysis)
  const deltas = {
    concept:      previousAnalysis ? (latestAnalysis.concept_score      ?? 0) - (previousAnalysis.concept_score      ?? 0) : null,
    spatial:      previousAnalysis ? (latestAnalysis.spatial_score       ?? 0) - (previousAnalysis.spatial_score       ?? 0) : null,
    presentation: previousAnalysis ? (latestAnalysis.presentation_score  ?? 0) - (previousAnalysis.presentation_score  ?? 0) : null,
  }
  const deltaValues = [deltas.concept, deltas.spatial, deltas.presentation]

  const handleExport = () => {
    track.pdfExported(params.projectId)
    const date = new Date(latestAnalysis.created_at).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })
    const stageLabel = stage?.label ?? project.stage
    const scoreColor = (s: number) => s >= 7.5 ? '#1a9e4a' : s >= 5 ? '#F97316' : '#d93025'
    const SF = `-apple-system, BlinkMacSystemFont, 'SF Pro Display', 'SF Pro Text', 'Helvetica Neue', Arial, sans-serif`
    // Inline SVG logo (the orange Critup mark, scaled to fit a 36px box)
    const logoSvg = `<svg width="36" height="36" viewBox="0 0 1024 1024" xmlns="http://www.w3.org/2000/svg"><path d="M0 0 C7.68055726 6.38262337 12.84828104 14.34553294 15.0625 24.125 C15.18625 25.9503125 15.18625 25.9503125 15.3125 27.8125 C15.37566406 28.58803223 15.43882812 29.36356445 15.50390625 30.16259766 C15.93527269 39.96400843 13.27469187 48.57364068 10.5625 57.875 C10.06664538 59.61886305 9.57237515 61.36317729 9.07958984 63.10791016 C8.03995757 66.78161855 6.99218933 70.45286487 5.93847656 74.12255859 C4.29364194 79.86192102 2.68525306 85.61108968 1.0859375 91.36328125 C0.82167969 92.31366776 0.55742188 93.26405426 0.28515625 94.24324036 C-0.24101607 96.13608339 -0.7670995 98.02895114 -1.29309082 99.92184448 C-2.5112927 104.30069365 -3.73620028 108.67766264 -4.9609375 113.0546875 C-6.96754045 120.22832613 -8.96418547 127.40467921 -10.95581055 134.58248901 C-12.37980071 139.71190745 -13.81677711 144.83756125 -15.25976562 149.96166992 C-17.67292201 158.53175116 -20.04268433 167.10950622 -22.31713867 175.7175293 C-24.82712039 185.18364547 -27.40969504 194.62715213 -30.25 204 C-30.50652344 204.89033936 -30.76304687 205.78067871 -31.02734375 206.69799805 C-33.18509002 213.62321526 -36.45690231 218.42801123 -42.3125 222.75 C-48.62481814 224.73721127 -55.0862402 225.04218645 -61.125 222.1875 C-69.7618359 214.1826277 -71.90224181 205.70655882 -74.1875 194.5625 C-74.62093594 192.50359837 -75.05581549 190.44500009 -75.4921875 188.38671875 C-75.69811523 187.41395996 -75.90404297 186.44120117 -76.11621094 185.43896484 C-76.77769166 182.39784961 -77.52355849 179.38543471 -78.3125 176.375 C-79.67409074 171.12095213 -80.6581966 165.8237471 -81.62670898 160.48657227 C-82.46978488 155.86795807 -83.46054062 151.34281155 -84.6875 146.8125 C-87.79100412 147.40717581 -89.65776682 148.32531614 -92.0859375 150.33203125 C-93.04222046 151.11489502 -93.04222046 151.11489502 -94.01782227 151.91357422 C-94.69256592 152.47834473 -95.36730957 153.04311523 -96.0625 153.625 C-96.7649585 154.20523926 -97.46741699 154.78547852 -98.19116211 155.38330078 C-100.36409734 157.18427014 -102.52712904 158.99648595 -104.6875 160.8125 C-105.3479834 161.36566895 -106.0084668 161.91883789 -106.68896484 162.48876953 C-112.66623082 167.50662721 -118.61897559 172.51107639 -124.02587891 178.15161133 C-125.62290678 179.74793525 -127.27593991 181.18827782 -129.00390625 182.640625 C-134.89743457 187.76575488 -140.3589264 193.3348245 -145.86938477 198.86401367 C-147.74579475 200.74578274 -149.62748969 202.62214738 -151.50976562 204.49804688 C-156.91147595 209.89676042 -162.27030873 215.27997003 -167.22143555 221.10131836 C-169.73491189 224.03503288 -172.4122654 226.81536195 -175.0625 229.625 C-179.73110508 234.61449663 -184.17877671 239.71173954 -188.453125 245.046875 C-190.93642179 248.12060599 -193.49464714 251.12205497 -196.0625 254.125 C-201.33579706 260.320041 -206.3833133 266.67545485 -211.36425781 273.10693359 C-212.63024525 274.73870264 -213.90400464 276.3640871 -215.1796875 277.98828125 C-221.43843481 286.01667436 -227.32211602 294.27879057 -233.15087891 302.62304688 C-234.66656839 304.78267561 -236.19584341 306.93192012 -237.73046875 309.078125 C-244.67947603 318.80875492 -251.30498963 328.70161396 -257.6875 338.8125 C-258.18330566 339.59544434 -258.67911133 340.37838867 -259.18994141 341.18505859 C-272.89265226 362.88209777 -285.62279979 385.16662228 -297.6875 407.8125 C-298.22165527 408.8123291 -298.75581055 409.8121582 -299.30615234 410.84228516 C-320.95199174 451.51424294 -338.81924763 493.76448656 -355.79985046 536.55230713 C-361.010239 549.67389653 -366.32319777 562.75317084 -371.6875 575.8125 C-372.20183594 577.07755371 -372.20183594 577.07755371 -372.7265625 578.36816406 C-382.43342363 602.16052476 -395.43915434 624.60687621 -413.6875 642.8125 C-414.58210938 643.71871094 -415.47671875 644.62492188 -416.3984375 645.55859375 C-430.67142887 659.30838163 -449.65922808 667.68878476 -469.5625 668.1875 C-493.01561761 667.5578861 -511.87598431 657.95711259 -528.6875 641.8125 C-529.43644531 641.11511719 -530.18539063 640.41773438 -530.95703125 639.69921875 C-555.43447535 616.25059892 -570.10958652 582.33993739 -584.93798828 552.34399414 C-588.15820031 545.83153091 -591.51405764 539.40106048 -594.92407227 532.98632812 C-598.07268884 527.03997447 -601.07967398 521.0309113 -604.0625 515 C-630.27236088 456.82019456 -630.27236088 456.82019456 -674.00390625 413.6953125 C-681.62045558 411.18972276 -689.76074216 411.89588049 -696.9375 415.3125 C-714.62382412 425.3487871 -730.93404056 442.30634741 -743.54296875 458.1640625 C-745.67672402 460.79919196 -747.90127147 463.3090995 -750.1875 465.8125 C-753.30208668 469.22989372 -756.2793662 472.7177235 -759.1875 476.3125 C-774.42972798 495.05990933 -774.42972798 495.05990933 -782.6875 497.8125 C-788.91871387 498.37897399 -788.91871387 498.37897399 -792.0625 496.0625 C-795.80543684 490.87997206 -795.22463706 484.2133307 -794.26611328 478.14453125 C-793.65814027 475.18163134 -792.97435501 472.24913082 -792.25 469.3125 C-791.98558105 468.23025146 -791.72116211 467.14800293 -791.44873047 466.03295898 C-783.06588315 433.03770976 -768.26294948 399.03166924 -747.6875 371.8125 C-747.00300781 370.89855469 -746.31851563 369.98460937 -745.61328125 369.04296875 C-727.62722068 345.87633901 -703.39490328 324.59743502 -673.61328125 319.26171875 C-660.96964762 317.8149348 -646.70115319 317.21568833 -634.6875 321.8125 C-633.77460205 322.15909668 -633.77460205 322.15909668 -632.84326172 322.51269531 C-609.8557118 331.42086113 -591.79830823 347.66585136 -576.6875 366.8125 C-576.20506836 367.41852051 -575.72263672 368.02454102 -575.22558594 368.64892578 C-550.01204238 400.43264414 -530.54782097 436.75661635 -511.49072266 472.44433594 C-509.72559569 475.74134266 -507.94868172 479.03170187 -506.16796875 482.3203125 C-498.57001047 496.37902103 -491.1748031 510.53432683 -483.875 524.75 C-483.20824249 526.04627823 -483.20824249 526.04627823 -482.52801514 527.3687439 C-481.25946316 529.8369029 -479.99431873 532.30677431 -478.73046875 534.77734375 C-478.35094559 535.51571472 -477.97142242 536.25408569 -477.58039856 537.01483154 C-475.77222507 540.56075201 -474.0843388 544.07831773 -472.6875 547.8125 C-469.79886323 546.36818161 -469.5268038 544.518219 -468.28125 541.55859375 C-467.55035156 539.84216675 -467.55035156 539.84216675 -466.8046875 538.09106445 C-466.54268555 537.46833649 -466.28068359 536.84560852 -466.01074219 536.20401001 C-464.57583425 532.79817815 -463.11527167 529.40336831 -461.65625 526.0078125 C-461.34236328 525.27635513 -461.02847656 524.54489777 -460.70507812 523.79127502 C-450.41446611 499.86954966 -439.57564653 476.18654321 -428.13720703 452.79296875 C-426.24635506 448.90554523 -424.39224351 445.00118918 -422.5390625 441.09570312 C-413.00336586 421.01837653 -403.10246782 401.16099222 -392.3046875 381.73046875 C-390.55660397 378.57631803 -388.82469831 375.41358425 -387.09375 372.25 C-379.55048064 358.50675632 -371.7332368 344.9826214 -363.45996094 331.66601562 C-361.64575886 328.74530022 -359.84218862 325.81818862 -358.0390625 322.890625 C-345.76462587 303.0322593 -332.92965978 283.59993698 -319.11767578 264.77636719 C-317.36623758 262.37135372 -315.65403461 259.94025396 -313.94311523 257.50634766 C-308.02448175 249.1037532 -301.71208322 241.01936549 -295.35986328 232.94189453 C-293.84757913 231.0163263 -292.34207092 229.08576081 -290.83984375 227.15234375 C-281.24046682 214.81954336 -271.45614647 202.62115023 -260.83984375 191.14453125 C-258.95788624 189.10545932 -257.12560916 187.03757608 -255.3125 184.9375 C-246.08956292 174.3562009 -236.34259735 164.30495905 -226.40429688 154.39892578 C-224.42199756 152.4220399 -222.44517367 150.43978961 -220.46875 148.45703125 C-214.37729398 142.36237981 -208.27979409 136.37030467 -201.6875 130.8125 C-200.07981627 129.35804483 -198.47510285 127.90029105 -196.875 126.4375 C-192.53185726 122.51872541 -188.0636715 118.79110098 -183.515625 115.11328125 C-180.66806615 112.79668987 -177.86546109 110.43276355 -175.0625 108.0625 C-166.58805596 100.98004742 -157.88131585 93.94171056 -148.6875 87.8125 C-148.6875 87.1525 -148.6875 86.4925 -148.6875 85.8125 C-149.50500732 85.58699463 -150.32251465 85.36148926 -151.16479492 85.12915039 C-166.42622163 80.90776893 -181.66438432 76.61351565 -196.8125 72 C-198.0193042 71.6397876 -199.2261084 71.2795752 -200.46948242 70.90844727 C-208.24558855 68.50959556 -214.23014301 66.07835432 -219.6875 59.8125 C-221.4762051 54.44638469 -221.87062584 48.01559678 -219.88671875 42.64453125 C-215.3938704 35.6505096 -207.18725765 32.58578105 -199.4062376 30.83404541 C-198.52605371 30.65113953 -197.64586981 30.46823364 -196.73901367 30.27978516 C-195.78251073 30.06879181 -194.82600779 29.85779846 -193.84051991 29.64041138 C-190.68164123 28.9471371 -187.51876033 28.27438771 -184.35546875 27.6015625 C-182.10779062 27.1122467 -179.86040036 26.62160691 -177.61328125 26.12973022 C-171.61028671 24.81938105 -165.60366483 23.52647677 -159.59606552 22.23742676 C-153.38866077 20.90300544 -147.184284 19.55466335 -140.97973633 18.20703125 C-133.54320959 16.59237719 -126.10648236 14.97870839 -118.66825867 13.37188721 C-105.22120113 10.4649608 -91.78641287 7.51245915 -78.37178612 4.45927048 C-75.94953741 3.90828404 -73.52678907 3.35955626 -71.10383606 2.81167603 C-69.57028067 2.46478854 -68.03672656 2.11789536 -66.50317383 1.77099609 C-65.40441909 1.52250003 -65.40441909 1.52250003 -64.28346729 1.26898384 C-60.76575294 0.47216295 -57.24963296 -0.33070235 -53.73641968 -1.14715576 C-14.22966874 -10.31886574 -14.22966874 -10.31886574 0 0 Z" fill="#FD6C06" transform="translate(923.6875,173.1875)"/></svg>`

    const html = `<!DOCTYPE html><html><head><meta charset="UTF-8"/>
<title>Critup.ai — ${project.name}</title>
<style>
  *{box-sizing:border-box;margin:0;padding:0}
  body{font-family:${SF};color:#111;background:#fff;padding:52px 56px;max-width:780px;margin:0 auto;-webkit-font-smoothing:antialiased}
  /* ── Header ── */
  .header{display:flex;align-items:center;justify-content:space-between;padding-bottom:24px;border-bottom:2px solid #F97316;margin-bottom:32px}
  .brand{display:flex;align-items:center;gap:10px}
  .brand-name{font-size:18px;font-weight:700;letter-spacing:-.3px;color:#111}
  .brand-name span{color:#F97316}
  .header-right{text-align:right}
  .header-date{font-size:12px;color:#888;font-weight:500;letter-spacing:-.1px}
  /* ── Project title ── */
  .project-name{font-size:28px;font-weight:800;letter-spacing:-.6px;color:#111;margin-bottom:6px;line-height:1.2}
  .stage-pill{display:inline-block;font-size:11px;font-weight:600;letter-spacing:.04em;color:#F97316;background:#fff3e8;padding:3px 10px;border-radius:100px;margin-bottom:28px}
  /* ── Score row ── */
  .scores{display:flex;gap:0;margin-bottom:28px;border:1.5px solid #eee;border-radius:16px;overflow:hidden}
  .score-box{flex:1;text-align:center;padding:18px 12px;border-right:1.5px solid #eee}
  .score-box:last-child{border-right:none}
  .score-val{font-size:30px;font-weight:800;letter-spacing:-.5px;line-height:1}
  .score-lbl{font-size:10px;font-weight:600;color:#999;letter-spacing:.08em;text-transform:uppercase;margin-top:5px}
  /* ── Average ── */
  .avg-row{display:flex;align-items:center;gap:16px;padding:18px 20px;background:linear-gradient(135deg,#fff8f3,#fff3e8);border-radius:14px;margin-bottom:32px;border:1.5px solid #fde8d0}
  .avg-circle{width:64px;height:64px;border-radius:50%;border:3px solid #F97316;display:flex;flex-direction:column;align-items:center;justify-content:center;flex-shrink:0}
  .avg-num{font-size:20px;font-weight:800;color:#F97316;letter-spacing:-.5px;line-height:1}
  .avg-denom{font-size:10px;color:#F97316;opacity:.6;font-weight:500}
  .avg-text h3{font-size:15px;font-weight:700;color:#111;margin-bottom:3px;letter-spacing:-.2px}
  .avg-text p{font-size:12px;color:#888;line-height:1.5}
  /* ── Section titles ── */
  .section-title{font-size:10px;font-weight:700;letter-spacing:.14em;text-transform:uppercase;color:#aaa;margin-bottom:14px;margin-top:32px}
  /* ── Feedback cards ── */
  .feedback-item{border-left:3px solid #F97316;border-radius:0 12px 12px 0;padding:14px 16px;margin-bottom:12px;background:#fafafa}
  .fb-num{font-size:9px;font-weight:700;color:#F97316;letter-spacing:.12em;text-transform:uppercase;margin-bottom:5px}
  .fb-title{font-size:14px;font-weight:700;color:#111;margin-bottom:7px;line-height:1.3;letter-spacing:-.2px}
  .fb-text{font-size:12.5px;color:#444;line-height:1.65;margin-bottom:0}
  .fb-suggestion{margin-top:10px;padding:9px 12px;border-radius:8px;background:#fff3e8;font-size:12px;color:#666;line-height:1.55}
  .fb-suggestion span{color:#F97316;font-weight:600;margin-right:4px}
  /* ── Jury questions ── */
  .jury-q{font-size:13px;color:#333;line-height:1.65;margin-bottom:10px;padding:12px 16px;background:#f8f8f8;border-radius:10px;font-style:italic}
  /* ── Footer ── */
  .footer{margin-top:48px;padding-top:18px;border-top:1px solid #f0f0f0;display:flex;align-items:center;justify-content:space-between}
  .footer-brand{display:flex;align-items:center;gap:7px;font-size:11px;font-weight:600;color:#bbb}
  .footer-right{font-size:11px;color:#ccc}
  @media print{
    body{padding:28px 32px}
    .feedback-item{break-inside:avoid}
    @page{margin:15mm}
  }
</style>
</head><body>

<div class="header">
  <div class="brand">
    ${logoSvg}
    <div class="brand-name">Critup<span>.ai</span></div>
  </div>
  <div class="header-right">
    <div class="header-date">AI Critique Report</div>
    <div class="header-date">${date}</div>
  </div>
</div>

<div class="project-name">${project.name}</div>
<div class="stage-pill">${stageLabel.toUpperCase()}</div>

<div class="scores">
  ${scoreRings.map(r => `<div class="score-box"><div class="score-val" style="color:${scoreColor(r.score)}">${r.score.toFixed(1)}</div><div class="score-lbl">${r.label}</div></div>`).join('')}
</div>

<div class="avg-row">
  <div class="avg-circle">
    <div class="avg-num">${avg.toFixed(1)}</div>
    <div class="avg-denom">/ 10</div>
  </div>
  <div class="avg-text">
    <h3>Overall Score</h3>
    <p>Average across Concept, Spatial &amp; Presentation</p>
  </div>
</div>

<div class="section-title">Detailed Feedback</div>
${feedbackItems.map((fb, i) => `
<div class="feedback-item">
  <div class="fb-num">Point ${i + 1} of ${feedbackItems.length}</div>
  <div class="fb-title">${fb.title}</div>
  <div class="fb-text">${fb.text}</div>
  ${fb.suggestion ? `<div class="fb-suggestion"><span>Suggestion</span>${fb.suggestion}</div>` : ''}
</div>`).join('')}

${juryQuestions.length > 0 ? `
<div class="section-title">Likely Jury Questions</div>
${juryQuestions.map(q => `<div class="jury-q">"${q}"</div>`).join('')}` : ''}

<div class="footer">
  <div class="footer-brand">${logoSvg.replace('width="36" height="36"','width="20" height="20"')} Critup.ai — AI Jury Feedback</div>
  <div class="footer-right">critup.ai</div>
</div>

</body></html>`

    const w = window.open('', '_blank')
    if (!w) return
    w.document.write(html)
    w.document.close()
    w.focus()
    setTimeout(() => w.print(), 400)
  }

  const isPublished = !!latestAnalysis?.is_public

  // Copy a private shareable link — does NOT publish to the community feed.
  const handleCopyLink = async () => {
    if (!latestAnalysis) return
    const url = `${window.location.origin}/p/${latestAnalysis.id}`
    try { await navigator.clipboard.writeText(url) } catch { /* ignore */ }
    setLinkCopied(true)
    setTimeout(() => setLinkCopied(false), 2000)
  }

  // Open the post composer (seed with any existing caption).
  const openPostModal = () => {
    if (!latestAnalysis) return
    setPostCaption(latestAnalysis.caption ?? '')
    setShowPostModal(true)
  }

  // Publish to the community feed with an optional caption.
  // Pre-renders the PDF pages to static images so the feed loads instantly.
  const handleConfirmPost = async () => {
    if (!latestAnalysis || sharing) return
    const analysisId = latestAnalysis.id
    setSharing(true)
    try {
      const caption = postCaption.trim().slice(0, 280) || null

      // 1. Render slides to JPEGs and upload them to the public bucket.
      //    Best-effort: if this fails we still publish (feed falls back to PDF).
      let slideCount = 0
      try {
        let srcUrl = pdfUrl
        if (!srcUrl && latestAnalysis.pdf_path) {
          const { data } = await supabase.storage.from('project-pdfs').createSignedUrl(latestAnalysis.pdf_path, 600)
          srcUrl = data?.signedUrl ?? null
        }
        if (srcUrl) {
          setSlideProgress({ done: 0, total: 1 })
          const blobs = await renderPdfToJpegBlobs(srcUrl, {
            maxPages: 12,
            onProgress: (done, total) => setSlideProgress({ done, total }),
          })
          for (let i = 0; i < blobs.length; i++) {
            const { error: upErr } = await supabase.storage
              .from('post-slides')
              .upload(`${analysisId}/${i}.jpg`, blobs[i], { contentType: 'image/jpeg', upsert: true })
            if (upErr) throw upErr
          }
          slideCount = blobs.length
        }
      } catch (e) {
        console.warn('slide pre-render failed, falling back to live PDF', e)
        slideCount = 0
      }

      // 2. Publish the analysis. We denormalize the public display fields
      //    (author name + project meta) onto the row so the feed and shared
      //    post pages can render them without reading the author's profile or
      //    project — both of which are protected by owner-only RLS.
      const { error: pubErr } = await supabase
        .from('analyses')
        .update({
          is_public: true,
          caption,
          slide_count: slideCount,
          owner_name:         profile?.full_name ?? null,
          project_name:       project?.name ?? null,
          project_stage:      project?.stage ?? null,
          project_discipline: project?.discipline ?? null,
        })
        .eq('id', analysisId)
      if (pubErr) throw pubErr

      // Reflect immediately in local state so the UI flips to "Posted" without a refetch.
      setProject(p => p && ({
        ...p,
        analyses: p.analyses.map(a => a.id === analysisId ? { ...a, is_public: true, caption } : a),
      }))
      track.postedToCommunity(analysisId)
      setShowPostModal(false)
    } catch {
      window.alert('Could not post to the community. Please try again.')
    } finally {
      setSharing(false)
      setSlideProgress(null)
    }
  }

  // Take the project back down from the community feed.
  const handleUnpublish = async () => {
    if (!latestAnalysis || sharing) return
    setSharing(true)
    try {
      const { error: unErr } = await supabase
        .from('analyses')
        .update({ is_public: false })
        .eq('id', latestAnalysis.id)
      if (unErr) throw unErr
      setProject(p => p && ({
        ...p,
        analyses: p.analyses.map(a => a.id === latestAnalysis.id ? { ...a, is_public: false } : a),
      }))
      setShowUnpublishModal(false)
    } catch {
      window.alert('Could not remove the post. Please try again.')
    } finally {
      setSharing(false)
    }
  }

  return (
    <div style={{ height: 'calc(100vh - 54px)', display: 'flex', flexDirection: 'column', overflow: 'hidden', fontFamily: "'Inter',sans-serif", background: c.bg }}>
      <style>{`
        @keyframes spin          { to { transform: rotate(360deg); } }
        @keyframes slide-up      { from { opacity:0; transform:translateY(8px); } to { opacity:1; transform:translateY(0); } }
        @keyframes inset-glow-pulse {
          0%,100% { box-shadow: inset 0 0 60px oklch(0.72 0.18 45/0.7), inset 0 0 120px oklch(0.72 0.18 45/0.35), inset 0 0 200px oklch(0.72 0.18 45/0.15); }
          50%     { box-shadow: inset 0 0 24px oklch(0.72 0.18 45/0.2),  inset 0 0 50px oklch(0.72 0.18 45/0.08); }
        }
        @keyframes inset-glow-flash {
          0%,100% { box-shadow: inset 0 0 70px oklch(0.72 0.18 45/0.75), inset 0 0 140px oklch(0.72 0.18 45/0.4), inset 0 0 220px oklch(0.72 0.18 45/0.18); }
          50%     { box-shadow: inset 0 0 24px oklch(0.72 0.18 45/0.2),  inset 0 0 50px oklch(0.72 0.18 45/0.08); }
        }
        @keyframes inset-green {
          0%,100% { box-shadow: inset 0 0 70px oklch(0.72 0.17 145/0.75), inset 0 0 140px oklch(0.72 0.17 145/0.4), inset 0 0 220px oklch(0.72 0.17 145/0.18); }
          50%     { box-shadow: inset 0 0 24px oklch(0.72 0.17 145/0.2),  inset 0 0 50px oklch(0.72 0.17 145/0.08); }
        }
      `}</style>

      {/* ── Header ── */}
      <div style={{ padding: isMobile ? '8px 14px' : '10px 22px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexShrink: 0, borderBottom: `1px solid ${c.border}` }}>
        <div>
          <button onClick={() => navigate({ to: '/projects' })} style={{ background: 'none', border: 'none', cursor: 'pointer', color: c.textMuted, fontSize: 12, padding: 0, marginBottom: 1, display: 'flex', alignItems: 'center', gap: 4 }}>
            <ChevronLeft size={13} /> My Projects
          </button>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <h1 style={{ fontSize: isMobile ? 14 : 16, fontWeight: 800, color: c.textPrimary, margin: 0, fontFamily: FONT, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: isMobile ? 140 : 'none' }}>{project.name}</h1>
            {!isMobile && <span style={{ fontSize: 10, fontWeight: 700, color: stage?.color, background: `${stage?.color}22`, padding: '2px 8px', borderRadius: 100, letterSpacing: '0.06em' }}>{stage?.label?.toUpperCase()}</span>}
          </div>
        </div>
        <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
          {/* Voice toggle — Pro only */}
          {isPro ? (
            <button
              onClick={() => setVoiceOn(v => !v)}
              title={voiceOn ? 'Turn off voice' : 'Turn on AI voice narration'}
              style={{ display: 'flex', alignItems: 'center', gap: 6, padding: isMobile ? '7px 10px' : '7px 14px', borderRadius: 100, background: voiceOn ? 'oklch(0.72 0.18 45/0.12)' : c.cardBg, border: `1px solid ${voiceOn ? '#F97316' : c.border}`, color: voiceOn ? '#F97316' : c.textMuted, fontSize: 12, cursor: 'pointer', transition: 'all 0.2s' }}
            >
              {speaking ? <Volume2 size={13} style={{ animation: 'pulse-ring 0.8s ease-in-out infinite' }} /> : voiceOn ? <Volume2 size={13} /> : <VolumeX size={13} />}
              {!isMobile && (voiceOn ? (speaking ? 'Speaking…' : 'Voice ON') : 'Voice')}
            </button>
          ) : (
            <button
              onClick={() => navigate({ to: '/pricing' })}
              title="Voice narration is available on Pro"
              style={{ display: 'flex', alignItems: 'center', gap: 6, padding: isMobile ? '7px 10px' : '7px 14px', borderRadius: 100, background: c.cardBg, border: `1px solid ${c.border}`, color: c.textMuted, fontSize: 12, cursor: 'pointer', transition: 'all 0.2s', opacity: 0.7 }}
            >
              <VolumeX size={13} />
              {!isMobile && <span>Voice <span style={{ fontSize: 10, fontWeight: 700, color: '#F97316', background: 'oklch(0.72 0.18 45/0.12)', padding: '1px 5px', borderRadius: 4, marginLeft: 2 }}>PRO</span></span>}
            </button>
          )}
          <button
            onClick={() => { setShowReupload(true); setReuploadFile(null); setReuploadError(null) }}
            style={{ display: 'flex', alignItems: 'center', gap: 6, padding: isMobile ? '7px 10px' : '7px 14px', borderRadius: 100, background: c.cardBg, border: `1px solid ${c.border}`, color: c.textMuted, fontSize: 12, cursor: 'pointer', transition: 'all 0.15s' }}
            onMouseEnter={e => { e.currentTarget.style.borderColor = '#F97316'; e.currentTarget.style.color = '#F97316' }}
            onMouseLeave={e => { e.currentTarget.style.borderColor = c.border; e.currentTarget.style.color = c.textMuted }}
          >
            <Upload size={13} />{!isMobile && ' New version'}
          </button>
          {!isMobile && (
            <button onClick={handleExport} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '7px 14px', borderRadius: 100, background: c.cardBg, border: `1px solid ${c.border}`, color: c.textMuted, fontSize: 12, cursor: 'pointer', transition: 'all 0.15s' }}
              onMouseEnter={e => { e.currentTarget.style.borderColor = '#F97316'; e.currentTarget.style.color = '#F97316' }}
              onMouseLeave={e => { e.currentTarget.style.borderColor = c.border; e.currentTarget.style.color = c.textMuted }}
            >
              <Download size={13} /> Export PDF
            </button>
          )}
          {/* Post to / manage in the community feed. The shareable link only
              works once published (the /p/ page requires is_public=true), so
              Copy link is shown only after the project has been posted. */}
          {isPublished ? (
            <>
              <button
                onClick={() => { if (!sharing) setShowUnpublishModal(true) }}
                title="Posted to the Community feed — click to remove"
                style={{ display: 'flex', alignItems: 'center', gap: 6, padding: isMobile ? '7px 10px' : '7px 14px', borderRadius: 100, background: 'oklch(0.72 0.17 145 / 0.15)', border: '1px solid oklch(0.72 0.17 145)', color: 'oklch(0.72 0.17 145)', fontSize: 12, cursor: sharing ? 'default' : 'pointer', transition: 'all 0.2s', opacity: sharing ? 0.6 : 1 }}
              >
                {sharing ? <Loader2 size={13} style={{ animation: 'spin 0.8s linear infinite' }} /> : <Check size={13} />}
                {!isMobile && (sharing ? ' Removing…' : ' Posted')}
              </button>
              <button
                onClick={handleCopyLink}
                title="Copy the public link to this critique"
                style={{ display: 'flex', alignItems: 'center', gap: 6, padding: isMobile ? '7px 10px' : '7px 14px', borderRadius: 100, background: linkCopied ? 'oklch(0.72 0.17 145 / 0.15)' : c.cardBg, border: `1px solid ${linkCopied ? 'oklch(0.72 0.17 145)' : c.border}`, color: linkCopied ? 'oklch(0.72 0.17 145)' : c.textMuted, fontSize: 12, cursor: 'pointer', transition: 'all 0.2s' }}
              >
                {linkCopied ? <><Check size={13} />{!isMobile && ' Copied!'}</> : <><Link size={13} />{!isMobile && ' Copy link'}</>}
              </button>
            </>
          ) : (
            <button
              onClick={openPostModal}
              title="Share this critique with the Critup community"
              style={{ display: 'flex', alignItems: 'center', gap: 6, padding: isMobile ? '7px 10px' : '7px 14px', borderRadius: 100, background: '#F97316', border: '1px solid #F97316', color: '#fff', fontSize: 12, fontWeight: 600, cursor: 'pointer', transition: 'all 0.2s', boxShadow: '0 0 12px oklch(0.72 0.18 45/0.3)' }}
            >
              <Users size={13} />{!isMobile && ' Post to Community'}
            </button>
          )}
        </div>
      </div>

      {/* ── Main ── */}
      <div style={{ flex: 1, display: 'flex', flexDirection: isMobile ? 'column' : 'row', gap: isMobile ? 0 : 18, padding: isMobile ? '10px 14px 0' : '16px 22px 0', overflow: isMobile ? 'auto' : 'hidden', minHeight: 0 }}>

        {/* Left: viewer with INSET glow */}
        <div style={{ flex: isMobile ? '0 0 auto' : '0 0 58%', display: 'flex', flexDirection: 'column', minHeight: 0, height: isMobile ? 280 : undefined }}>
          <div
            key={`viewer-${slideIdx}`}
            style={{
              flex: 1,
              borderRadius: 20,
              overflow: 'hidden',
              position: 'relative',
              background: c.isDark ? 'oklch(0.12 0.004 270)' : '#e8edf2',
              border: `1.5px solid ${isSummary ? 'oklch(0.72 0.17 145/0.6)' : 'oklch(0.72 0.18 45/0.5)'}`,
              minHeight: 0,
            }}
          >
            {pdfUrl ? (
              <PDFViewer
                url={pdfUrl}
                pageNumber={pdfPage}
                focusX={focusX}
                focusY={focusY}
                zoomLevel={zoomLevel}
              />
            ) : (
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: c.textMuted, fontSize: 13 }}>
                Loading PDF…
              </div>
            )}

            {/* INSET GLOW OVERLAY */}
            <div
              key={`glow-${slideIdx}`}
              style={{
                position: 'absolute', inset: 0,
                borderRadius: 18,
                pointerEvents: 'none',
                animation: isSummary ? 'inset-green 4s ease-in-out infinite' : 'inset-glow-flash 4s ease-in-out infinite',
              }}
            />


            {/* Slide badge */}
            {!isSummary && (
              <div style={{ position: 'absolute', top: 12, right: 12, background: 'rgba(0,0,0,0.55)', backdropFilter: 'blur(8px)', borderRadius: 100, padding: '3px 10px', fontSize: 11, fontWeight: 700, color: '#fff', letterSpacing: '0.05em' }}>
                {slideIdx + 1} / {feedbackItems.length}
              </div>
            )}
            {isSummary && (
              <div style={{ position: 'absolute', top: 12, right: 12, background: 'oklch(0.72 0.17 145/0.85)', backdropFilter: 'blur(8px)', borderRadius: 100, padding: '3px 12px', fontSize: 11, fontWeight: 700, color: '#fff', letterSpacing: '0.06em' }}>
                SUMMARY
              </div>
            )}
            {!isSummary && current?.page && (
              <div style={{ position: 'absolute', top: 12, left: 12, background: 'rgba(0,0,0,0.45)', backdropFilter: 'blur(8px)', borderRadius: 100, padding: '3px 10px', fontSize: 11, color: 'rgba(255,255,255,0.7)', letterSpacing: '0.04em' }}>
                p.{current.page}
              </div>
            )}
          </div>

          {/* Progress dots */}
          <div style={{ display: 'flex', gap: 5, justifyContent: 'center', padding: '8px 0 0', alignItems: 'center' }}>
            {Array.from({ length: totalSlides }).map((_, i) => (
              <button
                key={i}
                onClick={() => { killAudio(); setSlideIdx(i) }}
                style={{
                  width: i === slideIdx ? 20 : 6, height: 6, borderRadius: 100,
                  border: 'none', cursor: 'pointer', padding: 0, transition: 'all 0.3s',
                  background: i === slideIdx
                    ? (i >= feedbackItems.length ? 'oklch(0.72 0.17 145)' : '#F97316')
                    : (c.isDark ? 'oklch(0.28 0.004 270)' : '#d1d5db'),
                }}
              />
            ))}
          </div>
        </div>

        {/* Right: scores + feedback */}
        <div style={{ flex: isMobile ? '0 0 auto' : '0 0 42%', display: 'flex', flexDirection: 'column', gap: 10, overflowY: isMobile ? 'visible' : 'auto', paddingBottom: isMobile ? 0 : 4, marginTop: isMobile ? 12 : 0 }}>
          {!isSummary ? (
            <div key={`panel-${slideIdx}`} style={{ animation: 'slide-up 0.3s ease-out', display: 'flex', flexDirection: 'column', gap: 10 }}>
              <div style={{ background: c.cardBg, borderRadius: 16, padding: '16px', border: `1.5px solid #F97316`, boxShadow: '0 0 20px oklch(0.72 0.18 45/0.1)' }}>
                <div style={{ fontSize: 10, fontWeight: 700, color: '#F97316', letterSpacing: '0.1em', marginBottom: 6 }}>
                  FEEDBACK {slideIdx + 1} OF {feedbackItems.length}
                </div>
                <div style={{ fontSize: 14, fontWeight: 800, color: c.textPrimary, lineHeight: 1.35, marginBottom: 8, fontFamily: FONT }}>
                  {current?.title}
                </div>
                <p style={{ fontSize: 12, color: c.textMuted, margin: 0, lineHeight: 1.6 }}>
                  {current?.text}
                </p>
                {current?.suggestion && (
                  <div style={{ marginTop: 10, padding: '9px 11px', borderRadius: 10, background: 'oklch(0.72 0.18 45/0.08)', display: 'flex', gap: 8, alignItems: 'flex-start' }}>
                    <span style={{ fontSize: 13, flexShrink: 0 }}>💡</span>
                    <p style={{ fontSize: 12, color: c.textMuted, margin: 0, lineHeight: 1.5 }}>{current.suggestion}</p>
                  </div>
                )}
              </div>

              {scoreRings.map((ring, i) => (
                <div key={ring.label} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 14px', borderRadius: 12, background: c.cardBg, border: `1px solid ${c.border}` }}>
                  <ScoreRing score={ring.score} label="" size={54} theme={theme} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 10, fontWeight: 700, color: c.textMuted, letterSpacing: '0.08em', marginBottom: 1 }}>{ring.label.toUpperCase()}</div>
                    <div style={{ display: 'flex', alignItems: 'baseline', gap: 6 }}>
                      <div style={{ fontSize: 15, fontWeight: 800, color: c.textPrimary, fontFamily: FONT }}>{ring.score.toFixed(1)}</div>
                      {deltaValues[i] !== null && (
                        <div style={{ fontSize: 10, fontWeight: 700, color: deltaValues[i]! >= 0 ? 'oklch(0.72 0.17 145)' : 'oklch(0.65 0.18 25)' }}>
                          {deltaValues[i]! >= 0 ? '+' : ''}{deltaValues[i]!.toFixed(1)}
                        </div>
                      )}
                    </div>
                    <div style={{ fontSize: 11, color: c.textMuted, lineHeight: 1.4, overflow: 'hidden', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' as const }}>
                      {ringSummaries[i]}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div key="summary" style={{ animation: 'slide-up 0.4s ease-out', display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div style={{ fontSize: 10, fontWeight: 700, color: 'oklch(0.72 0.17 145)', letterSpacing: '0.12em' }}>OVERALL ANALYSIS</div>
              <div style={{ display: 'flex', justifyContent: 'space-around', padding: '8px 0' }}>
                {scoreRings.map(r => (
                  <div key={r.label} style={{ textAlign: 'center' }}>
                    <ScoreRing score={r.score} label={r.label} size={72} theme={theme} />
                  </div>
                ))}
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '14px 0', background: c.cardBg, borderRadius: 16, border: `1px solid ${c.border}` }}>
                <div style={{ fontSize: 10, fontWeight: 700, color: c.textMuted, letterSpacing: '0.1em', marginBottom: 10 }}>AVERAGE SCORE</div>
                <ScoreRing score={avg} label="" size={88} theme={theme} />
                <div style={{ fontSize: 22, fontWeight: 900, color: c.textPrimary, marginTop: 4, fontFamily: FONT }}>{avg.toFixed(1)}<span style={{ fontSize: 12, fontWeight: 400, color: c.textMuted }}> / 10</span></div>
              </div>
              <div style={{ background: c.cardBg, borderRadius: 14, padding: '14px', border: `1px solid ${c.border}` }}>
                <div style={{ fontSize: 10, fontWeight: 700, color: c.textMuted, letterSpacing: '0.08em', marginBottom: 8 }}>KEY FINDINGS</div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
                  {feedbackItems.slice(0, 5).map((fb, i) => (
                    <div key={i} style={{ display: 'flex', gap: 8, alignItems: 'flex-start' }}>
                      <div style={{ width: 5, height: 5, borderRadius: '50%', background: '#F97316', flexShrink: 0, marginTop: 5 }} />
                      <span style={{ fontSize: 12, color: c.textMuted, lineHeight: 1.5 }}>{fb.title}</span>
                    </div>
                  ))}
                </div>
              </div>
              {juryQuestions.length > 0 && (
                <div style={{ background: c.cardBg, borderRadius: 14, padding: '14px', border: `1px solid ${c.border}` }}>
                  <div style={{ fontSize: 10, fontWeight: 700, color: c.textMuted, letterSpacing: '0.08em', marginBottom: 8 }}>JURY WILL ASK</div>
                  <p style={{ fontSize: 12, color: c.textPrimary, margin: '0 0 10px', lineHeight: 1.5 }}>"{juryQuestions[0]}"</p>
                  <button onClick={() => navigate({ to: '/jury' })} style={{ padding: '6px 14px', borderRadius: 100, background: '#F97316', border: 'none', color: '#fff', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>
                    Practise answers →
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* ── Footer ── */}
      <div style={{ padding: isMobile ? '8px 14px 12px' : '10px 22px 14px', flexShrink: 0 }}>
        {/* Caption bar — shows upgrade prompt for free users */}
        <div style={{ background: c.isDark ? 'oklch(0.15 0.004 270)' : '#f8fafc', border: `1px solid ${speaking ? 'oklch(0.72 0.18 45/0.5)' : c.border}`, borderRadius: 12, padding: '10px 16px', marginBottom: 10, minHeight: 46, display: 'flex', alignItems: 'center', gap: 10, transition: 'border-color 0.3s' }}>
          <Volume2 size={13} color={!isPro ? 'oklch(0.72 0.18 45/0.5)' : speaking ? '#F97316' : c.textMuted} style={{ flexShrink: 0, transition: 'color 0.3s' }} />
          <p style={{ fontSize: 13, margin: 0, lineHeight: 1.5, flex: 1, minHeight: '1.5em' }}>
            {!isPro
              ? <span style={{ color: c.textMuted }}>
                  Voice narration is available on{' '}
                  <span
                    onClick={() => navigate({ to: '/pricing' })}
                    style={{ color: '#F97316', fontWeight: 600, cursor: 'pointer', textDecoration: 'underline', textUnderlineOffset: 2 }}
                  >
                    Pro
                  </span>
                  {' '}— use ← → to read critiques below
                </span>
              : speaking && captionWords.length > 0
                ? captionWords.map((word, i) => (
                    <span
                      key={`${slideIdx}-${i}`}
                      style={{
                        color: i === captionWords.length - 1 ? '#F97316' : c.textPrimary,
                        fontWeight: i === captionWords.length - 1 ? 600 : 400,
                        transition: 'color 0.15s',
                      }}
                    >
                      {word}{' '}
                    </span>
                  ))
                : isSummary
                  ? <span style={{ color: c.textMuted }}>Analysis complete — {feedbackItems.length} critiques · {avg.toFixed(1)} / 10</span>
                  : current
                    ? <span style={{ color: c.textMuted }}>{current.title}</span>
                    : <span style={{ color: c.textMuted }}>Press play to begin</span>
            }
          </p>
        </div>

        {/* Navigation */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 12 }}>
          <button
            onClick={() => { killAudio(); setSlideIdx(s => Math.max(s - 1, 0)) }}
            disabled={slideIdx === 0}
            style={{ padding: '8px 18px', borderRadius: 100, background: c.cardBg, border: `1px solid ${c.border}`, color: c.textPrimary, fontSize: 13, fontWeight: 500, cursor: slideIdx === 0 ? 'not-allowed' : 'pointer', opacity: slideIdx === 0 ? 0.35 : 1, transition: 'all 0.15s' }}
          >
            ← Previous
          </button>
          {/* Play button — Pro only; free users see an upgrade button */}
          {isPro ? (
          <button
            onClick={handlePlayPause}
            title={!audioReady && voiceOn && !isPlaying ? 'Loading audio…' : undefined}
            style={{ width: 48, height: 48, borderRadius: '50%', background: isPlaying ? 'oklch(0.65 0.18 25)' : '#F97316', border: 'none', color: '#fff', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: `0 0 20px ${isPlaying ? 'oklch(0.65 0.18 25/0.5)' : 'oklch(0.72 0.18 45/0.5)'}`, transition: 'all 0.2s', flexShrink: 0, opacity: (!audioReady && voiceOn && !isPlaying) ? 0.65 : 1 }}
          >
            {(!audioReady && voiceOn && !isPlaying)
              ? <Loader2 size={17} style={{ animation: 'spin 1s linear infinite' }} />
              : isPlaying ? <Pause size={17} /> : <Play size={17} style={{ marginLeft: 2 }} />
            }
          </button>
          ) : (
            <button
              onClick={() => navigate({ to: '/pricing' })}
              title="Upgrade to Pro for voice narration"
              style={{ width: 48, height: 48, borderRadius: '50%', background: c.cardBg, border: `1.5px solid ${c.border}`, color: c.textMuted, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'all 0.2s', flexShrink: 0, position: 'relative' }}
              onMouseEnter={e => { e.currentTarget.style.borderColor = '#F97316'; e.currentTarget.style.color = '#F97316' }}
              onMouseLeave={e => { e.currentTarget.style.borderColor = c.border; e.currentTarget.style.color = c.textMuted }}
            >
              <Play size={17} style={{ marginLeft: 2, opacity: 0.4 }} />
              <span style={{ position: 'absolute', top: -4, right: -4, fontSize: 8, fontWeight: 800, background: '#F97316', color: '#fff', borderRadius: 4, padding: '1px 4px', lineHeight: 1.4 }}>PRO</span>
            </button>
          )}
          <button
            onClick={() => { killAudio(); setSlideIdx(s => Math.min(s + 1, totalSlides - 1)) }}
            disabled={slideIdx >= totalSlides - 1}
            style={{ padding: '8px 18px', borderRadius: 100, background: c.cardBg, border: `1px solid ${c.border}`, color: c.textPrimary, fontSize: 13, fontWeight: 500, cursor: slideIdx >= totalSlides - 1 ? 'not-allowed' : 'pointer', opacity: slideIdx >= totalSlides - 1 ? 0.35 : 1, transition: 'all 0.15s' }}
          >
            Next →
          </button>
        </div>
      </div>

      {/* ── Re-upload modal ── */}
      {showReupload && (
        <div
          style={{ position: 'fixed', inset: 0, zIndex: 200, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.55)', backdropFilter: 'blur(4px)' }}
          onClick={e => { if (e.target === e.currentTarget && !reuploadSaving) { setShowReupload(false); setReuploadFile(null); setReuploadError(null) } }}
        >
          <div style={{ background: c.bg, borderRadius: 20, padding: '28px', width: '100%', maxWidth: 440, border: `1px solid ${c.border}`, boxShadow: '0 24px 80px rgba(0,0,0,0.35)', position: 'relative' }}>
            {/* Header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 6 }}>
              <div>
                <h2 style={{ fontSize: 17, fontWeight: 800, color: c.textPrimary, margin: 0, fontFamily: FONT }}>Upload new version</h2>
                <p style={{ fontSize: 12, color: c.textMuted, margin: '4px 0 0' }}>{project.name} — {stage?.label}</p>
              </div>
              <button onClick={() => { if (!reuploadSaving) { setShowReupload(false); setReuploadFile(null); setReuploadError(null) } }} style={{ background: 'none', border: 'none', cursor: 'pointer', color: c.textMuted, padding: 4, lineHeight: 1 }}>
                <X size={16} />
              </button>
            </div>

            <p style={{ fontSize: 13, color: c.textMuted, lineHeight: 1.6, margin: '0 0 20px' }}>
              The previous analysis is kept. Scores and feedback for the new version will appear once analysis completes.
            </p>

            {/* Drop zone */}
            {!reuploadFile ? (
              <div
                onDragOver={e => { e.preventDefault(); setReuploadDrag(true) }}
                onDragLeave={() => setReuploadDrag(false)}
                onDrop={e => { e.preventDefault(); setReuploadDrag(false); const f = e.dataTransfer.files[0]; if (f?.type === 'application/pdf') setReuploadFile(f) }}
                onClick={() => document.getElementById('reupload-input')?.click()}
                style={{ border: `2px dashed ${reuploadDrag ? '#F97316' : c.border}`, borderRadius: 14, padding: '32px 20px', textAlign: 'center', cursor: 'pointer', background: reuploadDrag ? 'oklch(0.72 0.18 45/0.05)' : c.cardBg, transition: 'all 0.15s' }}
              >
                <div style={{ width: 44, height: 44, borderRadius: '50%', background: 'oklch(0.72 0.18 45/0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 12px' }}>
                  <Upload size={20} color="#F97316" />
                </div>
                <p style={{ fontSize: 14, fontWeight: 600, color: c.textPrimary, margin: '0 0 4px' }}>Drop your updated PDF here</p>
                <p style={{ fontSize: 12, color: c.textMuted, margin: 0 }}>or click to browse</p>
                <input id="reupload-input" type="file" accept=".pdf" style={{ display: 'none' }} onChange={e => { const f = e.target.files?.[0]; if (f) setReuploadFile(f) }} />
              </div>
            ) : (
              <div style={{ background: c.cardBg, border: `1.5px solid oklch(0.72 0.17 145/0.6)`, borderRadius: 14, padding: '14px 16px', display: 'flex', alignItems: 'center', gap: 12 }}>
                <div style={{ width: 38, height: 38, borderRadius: 9, background: 'oklch(0.72 0.17 145/0.12)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  <FileText size={18} color="oklch(0.72 0.17 145)" />
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <p style={{ fontSize: 13, fontWeight: 600, color: c.textPrimary, margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{reuploadFile.name}</p>
                  <p style={{ fontSize: 11, color: c.textMuted, margin: '2px 0 0' }}>{(reuploadFile.size / 1024 / 1024).toFixed(1)} MB</p>
                </div>
                <button onClick={() => setReuploadFile(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: c.textMuted, padding: 4 }}>
                  <X size={14} />
                </button>
              </div>
            )}

            {/* Error */}
            {reuploadError && (
              <div style={{ marginTop: 12, padding: '10px 14px', borderRadius: 10, background: 'oklch(0.65 0.18 25/0.1)', border: '1px solid oklch(0.65 0.18 25/0.3)', fontSize: 13, color: 'oklch(0.65 0.18 25)' }}>
                {reuploadError}
              </div>
            )}

            {/* Actions */}
            <div style={{ display: 'flex', gap: 10, marginTop: 20, justifyContent: 'flex-end' }}>
              <button onClick={() => { if (!reuploadSaving) { setShowReupload(false); setReuploadFile(null); setReuploadError(null) } }} disabled={reuploadSaving} style={{ padding: '10px 20px', borderRadius: 100, background: 'none', border: `1px solid ${c.border}`, color: c.textMuted, fontSize: 13, fontWeight: 500, cursor: 'pointer' }}>
                Cancel
              </button>
              <button
                onClick={handleReupload}
                disabled={!reuploadFile || reuploadSaving}
                style={{ padding: '10px 24px', borderRadius: 100, background: reuploadFile && !reuploadSaving ? '#F97316' : (c.isDark ? 'oklch(0.28 0.004 270)' : '#e5e7eb'), border: 'none', color: reuploadFile && !reuploadSaving ? '#fff' : c.textMuted, fontSize: 13, fontWeight: 600, cursor: reuploadFile && !reuploadSaving ? 'pointer' : 'not-allowed', display: 'flex', alignItems: 'center', gap: 7, boxShadow: reuploadFile && !reuploadSaving ? '0 0 16px oklch(0.72 0.18 45/0.35)' : 'none', transition: 'all 0.15s' }}
              >
                {reuploadSaving && <Loader2 size={13} style={{ animation: 'spin 0.8s linear infinite' }} />}
                {reuploadSaving ? 'Uploading…' : 'Start analysis →'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Post to Community modal ── */}
      {showPostModal && latestAnalysis && (
        <div
          style={{ position: 'fixed', inset: 0, zIndex: 200, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.55)', backdropFilter: 'blur(4px)', padding: 16 }}
          onClick={e => { if (e.target === e.currentTarget && !sharing) setShowPostModal(false) }}
        >
          <div style={{ background: c.bg, borderRadius: 20, padding: '28px', width: '100%', maxWidth: 460, border: `1px solid ${c.border}`, boxShadow: '0 24px 80px rgba(0,0,0,0.35)', position: 'relative' }}>
            {/* Header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 6 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <div style={{ width: 36, height: 36, borderRadius: 10, background: 'oklch(0.72 0.18 45/0.12)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <Users size={18} color="#F97316" />
                </div>
                <div>
                  <h2 style={{ fontSize: 17, fontWeight: 800, color: c.textPrimary, margin: 0, fontFamily: FONT }}>Post to Community</h2>
                  <p style={{ fontSize: 12, color: c.textMuted, margin: '3px 0 0', display: 'flex', alignItems: 'center', gap: 4 }}>
                    <Globe size={11} /> Public · anyone on Critup can see it
                  </p>
                </div>
              </div>
              <button onClick={() => { if (!sharing) setShowPostModal(false) }} style={{ background: 'none', border: 'none', cursor: 'pointer', color: c.textMuted, padding: 4, lineHeight: 1 }}>
                <X size={16} />
              </button>
            </div>

            {/* Caption */}
            <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: c.textMuted, margin: '20px 0 8px' }}>Add a caption (optional)</label>
            <textarea
              value={postCaption}
              onChange={e => setPostCaption(e.target.value.slice(0, 280))}
              placeholder="Say something about your project…"
              rows={3}
              autoFocus
              style={{ width: '100%', boxSizing: 'border-box', resize: 'none', borderRadius: 12, border: `1px solid ${c.border}`, background: c.cardBg, color: c.textPrimary, fontSize: 14, fontFamily: FONT, padding: '12px 14px', outline: 'none', lineHeight: 1.5 }}
            />
            <div style={{ textAlign: 'right', fontSize: 11, color: c.textMuted, marginTop: 4 }}>{postCaption.length}/280</div>

            {/* Preview of what gets shared */}
            <div style={{ marginTop: 14, padding: '14px 16px', borderRadius: 12, background: c.cardBg, border: `1px solid ${c.border}` }}>
              <div style={{ fontSize: 10, fontWeight: 700, color: c.textMuted, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 8 }}>What you're sharing</div>
              <div style={{ fontSize: 14, fontWeight: 700, color: c.textPrimary, marginBottom: 8 }}>{project.name}</div>
              <div style={{ display: 'flex', gap: 16 }}>
                {([['Concept', latestAnalysis.concept_score], ['Spatial', latestAnalysis.spatial_score], ['Presentation', latestAnalysis.presentation_score]] as const).map(([label, score]) => (
                  <div key={label}>
                    <div style={{ fontSize: 16, fontWeight: 800, color: '#F97316' }}>{(score ?? 0).toFixed(1)}</div>
                    <div style={{ fontSize: 10, color: c.textMuted, fontWeight: 600 }}>{label}</div>
                  </div>
                ))}
              </div>
            </div>
            <p style={{ fontSize: 11, color: c.textMuted, lineHeight: 1.5, margin: '12px 0 0' }}>
              Your scores, feedback and drawings become viewable by the community. You can remove the post anytime.
            </p>

            {/* Actions */}
            <div style={{ display: 'flex', gap: 10, marginTop: 20, justifyContent: 'flex-end' }}>
              <button onClick={() => { if (!sharing) setShowPostModal(false) }} disabled={sharing} style={{ padding: '10px 20px', borderRadius: 100, background: 'none', border: `1px solid ${c.border}`, color: c.textMuted, fontSize: 13, fontWeight: 500, cursor: sharing ? 'default' : 'pointer' }}>
                Cancel
              </button>
              <button
                onClick={handleConfirmPost}
                disabled={sharing}
                style={{ padding: '10px 24px', borderRadius: 100, background: '#F97316', border: 'none', color: '#fff', fontSize: 13, fontWeight: 700, cursor: sharing ? 'default' : 'pointer', display: 'flex', alignItems: 'center', gap: 7, boxShadow: '0 0 16px oklch(0.72 0.18 45/0.35)', opacity: sharing ? 0.7 : 1 }}
              >
                {sharing && <Loader2 size={13} style={{ animation: 'spin 0.8s linear infinite' }} />}
                {sharing
                  ? (slideProgress ? `Preparing slides ${slideProgress.done}/${slideProgress.total}…` : 'Posting…')
                  : 'Post to Community'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Remove from Community modal ── */}
      {showUnpublishModal && latestAnalysis && (
        <div
          style={{ position: 'fixed', inset: 0, zIndex: 200, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.55)', backdropFilter: 'blur(4px)', padding: 16 }}
          onClick={e => { if (e.target === e.currentTarget && !sharing) setShowUnpublishModal(false) }}
        >
          <div style={{ background: c.bg, borderRadius: 20, padding: '28px', width: '100%', maxWidth: 420, border: `1px solid ${c.border}`, boxShadow: '0 24px 80px rgba(0,0,0,0.35)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
              <div style={{ width: 36, height: 36, borderRadius: 10, background: 'oklch(0.65 0.18 25/0.12)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <AlertCircle size={18} color="oklch(0.65 0.18 25)" />
              </div>
              <h2 style={{ fontSize: 17, fontWeight: 800, color: c.textPrimary, margin: 0, fontFamily: FONT }}>Remove from Community?</h2>
            </div>
            <p style={{ fontSize: 13, color: c.textMuted, lineHeight: 1.55, margin: 0 }}>
              This takes <strong style={{ color: c.textPrimary }}>{project.name}</strong> off the Community feed. Anyone with the link will no longer be able to see it. You can post it again anytime.
            </p>
            <div style={{ display: 'flex', gap: 10, marginTop: 22, justifyContent: 'flex-end' }}>
              <button onClick={() => { if (!sharing) setShowUnpublishModal(false) }} disabled={sharing} style={{ padding: '10px 20px', borderRadius: 100, background: 'none', border: `1px solid ${c.border}`, color: c.textMuted, fontSize: 13, fontWeight: 500, cursor: sharing ? 'default' : 'pointer' }}>
                Cancel
              </button>
              <button
                onClick={handleUnpublish}
                disabled={sharing}
                style={{ padding: '10px 24px', borderRadius: 100, background: 'oklch(0.65 0.18 25)', border: 'none', color: '#fff', fontSize: 13, fontWeight: 700, cursor: sharing ? 'default' : 'pointer', display: 'flex', alignItems: 'center', gap: 7, opacity: sharing ? 0.7 : 1 }}
              >
                {sharing && <Loader2 size={13} style={{ animation: 'spin 0.8s linear infinite' }} />}
                {sharing ? 'Removing…' : 'Remove post'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
