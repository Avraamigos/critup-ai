import { useState, useEffect, useRef, useCallback } from 'react'
import { useParams, useNavigate } from '@tanstack/react-router'
import { ChevronLeft, Play, Pause, Download, Loader2, AlertCircle, Plus, Volume2, VolumeX } from 'lucide-react'
import { ScoreRing } from '@/components/ScoreRing'
import { PDFViewer } from '@/components/PDFViewer'
import { useTheme, useColors } from '@/lib/theme'
import { supabase } from '@/lib/supabase'
import type { Json } from '@/lib/database.types'

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
  created_at: string
}

type ProjectData = {
  id: string
  name: string
  stage: string
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
  const FONT = "-apple-system, BlinkMacSystemFont, 'SF Pro Display', 'Helvetica Neue', 'Inter', sans-serif"

  const [project,    setProject]   = useState<ProjectData | null>(null)
  const [loading,    setLoading]   = useState(true)
  const [error,      setError]     = useState<string | null>(null)
  const [slideIdx,      setSlideIdx]     = useState(0)
  const [isPlaying,     setIsPlaying]    = useState(false)
  const [voiceOn,       setVoiceOn]      = useState(true)   // ON by default
  const [pdfUrl,        setPdfUrl]       = useState<string | null>(null)
  const [speaking,      setSpeaking]     = useState(false)
  const [captionWords,  setCaptionWords] = useState<string[]>([])
  const [audioReady,    setAudioReady]   = useState(false)   // true once slide 0 is in cache

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

  // Keep refs in sync with state (order matters — these run before the main effect)
  useEffect(() => { isPlayingRef.current = isPlaying }, [isPlaying])
  useEffect(() => { voiceOnRef.current   = voiceOn   }, [voiceOn])

  // ── Load data with polling ──
  useEffect(() => {
    let pollTimer: ReturnType<typeof setTimeout> | null = null
    const load = async () => {
      const { data, error: err } = await supabase
        .from('projects')
        .select('id, name, stage, analyses(id, status, concept_score, spatial_score, presentation_score, feedback, jury_questions, pdf_path, created_at)')
        .eq('id', params.projectId)
        .single()
      if (err || !data) { setError('Project not found.'); setLoading(false); return }
      const proj = data as unknown as ProjectData
      setProject(proj)
      setLoading(false)
      const stillPending = proj.analyses?.some(a => a.status === 'pending' || a.status === 'processing')
      if (stillPending) pollTimer = setTimeout(load, 4000)
    }
    setLoading(true); setError(null); load()
    const sub = supabase.channel(`analysis-${params.projectId}`)
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'analyses', filter: `project_id=eq.${params.projectId}` }, load)
      .subscribe()
    return () => { if (pollTimer) clearTimeout(pollTimer); supabase.removeChannel(sub) }
  }, [params.projectId])

  // ── Remember last-visited project so the sidebar nav and AI chat can reference it ──
  useEffect(() => {
    localStorage.setItem('critup_last_analysis_id', params.projectId)
    if (project?.name) localStorage.setItem('critup_last_project_name', project.name)
  }, [params.projectId, project?.name])

  const latestAnalysis = project?.analyses
    ?.filter(a => a.status === 'complete')
    .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())[0]

  // Keep analysisId ref in sync so speakSlide can read it without re-creating
  useEffect(() => { analysisIdRef.current = latestAnalysis?.id ?? null }, [latestAnalysis?.id])

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
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', gap: 12 }}>
      <AlertCircle size={32} color="oklch(0.65 0.18 25)" />
      <p style={{ fontSize: 14, color: c.textMuted }}>{error || 'Project not found.'}</p>
      <button onClick={() => navigate({ to: '/projects' })} style={{ padding: '8px 20px', borderRadius: 100, background: '#F97316', border: 'none', color: '#fff', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>Back</button>
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
            <div style={{ width: 72, height: 72, borderRadius: '50%', background: 'oklch(0.72 0.18 45/0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 0 40px oklch(0.72 0.18 45/0.3)', animation: 'pulse-ring 2.5s ease-in-out infinite' }}>
              <Loader2 size={30} color="#F97316" style={{ animation: 'spin 1s linear infinite' }} />
            </div>
            <style>{`@keyframes spin{to{transform:rotate(360deg)}}@keyframes pulse-ring{0%,100%{box-shadow:0 0 20px oklch(0.72 0.18 45/0.2)}50%{box-shadow:0 0 50px oklch(0.72 0.18 45/0.6)}}`}</style>
            <h2 style={{ fontSize: 20, fontWeight: 700, margin: 0, color: c.textPrimary, fontFamily: FONT }}>Analysis in progress…</h2>
            <p style={{ fontSize: 14, color: c.textMuted, maxWidth: 340, margin: 0, lineHeight: 1.6 }}>Your drawings are being reviewed by AI. Usually takes 1–2 minutes.</p>
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
  const zoomLevel = current?.zoom  ?? 1

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
        @keyframes focus-ping {
          0%    { transform: translate(-50%,-50%) scale(1);   opacity: 0.9; }
          70%   { transform: translate(-50%,-50%) scale(2.4); opacity: 0; }
          100%  { transform: translate(-50%,-50%) scale(2.4); opacity: 0; }
        }
        @keyframes focus-dot-pulse {
          0%,100% { box-shadow: 0 0 0 0 oklch(0.72 0.18 45/0.5); }
          50%     { box-shadow: 0 0 0 6px oklch(0.72 0.18 45/0); }
        }
      `}</style>

      {/* ── Header ── */}
      <div style={{ padding: '10px 22px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexShrink: 0, borderBottom: `1px solid ${c.border}` }}>
        <div>
          <button onClick={() => navigate({ to: '/projects' })} style={{ background: 'none', border: 'none', cursor: 'pointer', color: c.textMuted, fontSize: 12, padding: 0, marginBottom: 1, display: 'flex', alignItems: 'center', gap: 4 }}>
            <ChevronLeft size={13} /> My Projects
          </button>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <h1 style={{ fontSize: 16, fontWeight: 800, color: c.textPrimary, margin: 0, fontFamily: FONT }}>{project.name}</h1>
            <span style={{ fontSize: 10, fontWeight: 700, color: stage?.color, background: `${stage?.color}22`, padding: '2px 8px', borderRadius: 100, letterSpacing: '0.06em' }}>{stage?.label?.toUpperCase()}</span>
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          {/* Voice toggle */}
          <button
            onClick={() => setVoiceOn(v => !v)}
            title={voiceOn ? 'Turn off voice' : 'Turn on AI voice narration'}
            style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '7px 14px', borderRadius: 100, background: voiceOn ? 'oklch(0.72 0.18 45/0.12)' : c.cardBg, border: `1px solid ${voiceOn ? '#F97316' : c.border}`, color: voiceOn ? '#F97316' : c.textMuted, fontSize: 12, cursor: 'pointer', transition: 'all 0.2s' }}
          >
            {speaking ? <Volume2 size={13} style={{ animation: 'pulse-ring 0.8s ease-in-out infinite' }} /> : voiceOn ? <Volume2 size={13} /> : <VolumeX size={13} />}
            {voiceOn ? (speaking ? 'Speaking…' : 'Voice ON') : 'Voice'}
          </button>
          <button style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '7px 14px', borderRadius: 100, background: c.cardBg, border: `1px solid ${c.border}`, color: c.textMuted, fontSize: 12, cursor: 'pointer' }}>
            <Download size={13} /> Export
          </button>
        </div>
      </div>

      {/* ── Main ── */}
      <div style={{ flex: 1, display: 'flex', gap: 18, padding: '16px 22px 0', overflow: 'hidden', minHeight: 0 }}>

        {/* Left: viewer with INSET glow */}
        <div style={{ flex: '0 0 58%', display: 'flex', flexDirection: 'column', minHeight: 0 }}>
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

            {/* Focus annotation dot — shows exactly where on the drawing Claude is pointing */}
            {!isSummary && current?.focus && (
              <div
                key={`dot-${slideIdx}`}
                style={{
                  position: 'absolute',
                  left: `${focusX * 100}%`,
                  top:  `${focusY * 100}%`,
                  pointerEvents: 'none',
                  zIndex: 10,
                }}
              >
                {/* Ping ring */}
                <div style={{
                  position: 'absolute',
                  width: 36, height: 36,
                  borderRadius: '50%',
                  border: '2px solid #F97316',
                  animation: 'focus-ping 1.8s ease-out infinite',
                }} />
                {/* Solid dot */}
                <div style={{
                  position: 'absolute',
                  width: 14, height: 14,
                  borderRadius: '50%',
                  background: '#F97316',
                  transform: 'translate(-50%, -50%)',
                  boxShadow: '0 0 12px #F97316, 0 0 24px oklch(0.72 0.18 45/0.6)',
                  animation: 'focus-dot-pulse 2s ease-in-out infinite',
                  border: '2px solid #fff',
                }} />
                {/* Feedback number label */}
                <div style={{
                  position: 'absolute',
                  left: 14, top: -18,
                  background: '#F97316',
                  color: '#fff',
                  fontSize: 10, fontWeight: 800,
                  padding: '2px 7px', borderRadius: 100,
                  whiteSpace: 'nowrap',
                  boxShadow: '0 2px 8px oklch(0.72 0.18 45/0.4)',
                }}>
                  {(current?.n ?? slideIdx + 1)}
                </div>
              </div>
            )}

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
        <div style={{ flex: '0 0 42%', display: 'flex', flexDirection: 'column', gap: 10, overflowY: 'auto', paddingBottom: 4 }}>
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
                    <div style={{ fontSize: 15, fontWeight: 800, color: c.textPrimary, fontFamily: FONT }}>{ring.score.toFixed(1)}</div>
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
      <div style={{ padding: '10px 22px 14px', flexShrink: 0 }}>
        {/* Caption bar */}
        <div style={{ background: c.isDark ? 'oklch(0.15 0.004 270)' : '#f8fafc', border: `1px solid ${speaking ? 'oklch(0.72 0.18 45/0.5)' : c.border}`, borderRadius: 12, padding: '10px 16px', marginBottom: 10, minHeight: 46, display: 'flex', alignItems: 'center', gap: 10, transition: 'border-color 0.3s' }}>
          <Volume2 size={13} color={speaking ? '#F97316' : c.textMuted} style={{ flexShrink: 0, transition: 'color 0.3s' }} />
          <p style={{ fontSize: 13, margin: 0, lineHeight: 1.5, flex: 1, minHeight: '1.5em' }}>
            {speaking && captionWords.length > 0
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
          <button
            onClick={() => { killAudio(); setSlideIdx(s => Math.min(s + 1, totalSlides - 1)) }}
            disabled={slideIdx >= totalSlides - 1}
            style={{ padding: '8px 18px', borderRadius: 100, background: c.cardBg, border: `1px solid ${c.border}`, color: c.textPrimary, fontSize: 13, fontWeight: 500, cursor: slideIdx >= totalSlides - 1 ? 'not-allowed' : 'pointer', opacity: slideIdx >= totalSlides - 1 ? 0.35 : 1, transition: 'all 0.15s' }}
          >
            Next →
          </button>
        </div>
      </div>
    </div>
  )
}
