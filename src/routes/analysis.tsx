import { useState, useEffect, useRef } from 'react'
import { useParams, useNavigate } from '@tanstack/react-router'
import { ChevronLeft, Play, Pause, Download, Loader2, AlertCircle, Plus, Volume2 } from 'lucide-react'
import { ScoreRing } from '@/components/ScoreRing'
import { useTheme, useColors } from '@/lib/theme'
import { supabase } from '@/lib/supabase'
import type { Json } from '@/lib/database.types'

// ─── Types ───────────────────────────────────────────────────────────────────

type FeedbackItem = {
  n: number
  title: string
  text: string
  suggestion: string
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
  'pre-design':       { label: 'Pre-Design',      color: '#6366f1' },
  'initial-concept':  { label: 'Initial Concept',  color: '#F97316' },
  'finalized-design': { label: 'Finalized Design', color: 'oklch(0.72 0.17 145)' },
  'jury-prep':        { label: 'Jury Prep',        color: 'oklch(0.65 0.18 25)' },
}

// ─── Mock PDF Viewer ──────────────────────────────────────────────────────────

function MockPDFViewer({ theme, slideIdx }: { theme: 'dark' | 'light'; slideIdx: number }) {
  const shapes = [
    // Slide 0 — floor plan
    <svg key={0} width="100%" height="100%" viewBox="0 0 200 260">
      <rect x="20" y="20" width="160" height="220" fill="none" stroke="currentColor" strokeWidth="1.5" />
      <rect x="40" y="40" width="60" height="80" fill="none" stroke="currentColor" strokeWidth="0.8" />
      <rect x="120" y="40" width="45" height="80" fill="none" stroke="currentColor" strokeWidth="0.8" />
      <rect x="40" y="150" width="120" height="70" fill="none" stroke="currentColor" strokeWidth="0.8" />
      <line x1="20" y1="130" x2="180" y2="130" stroke="currentColor" strokeWidth="0.5" strokeDasharray="4,3" opacity="0.4" />
      <text x="100" y="248" textAnchor="middle" fill="currentColor" fontSize="8" opacity="0.5">GROUND FLOOR PLAN</text>
    </svg>,
    // Slide 1 — section
    <svg key={1} width="100%" height="100%" viewBox="0 0 200 260">
      <rect x="20" y="80" width="160" height="120" fill="none" stroke="currentColor" strokeWidth="1.5" />
      <line x1="20" y1="200" x2="180" y2="200" stroke="currentColor" strokeWidth="2" />
      <path d="M40 200 Q60 140 80 160 Q100 140 120 155 Q140 130 160 200" fill="none" stroke="currentColor" strokeWidth="1" />
      <line x1="20" y1="80" x2="20" y2="220" stroke="currentColor" strokeWidth="0.5" strokeDasharray="3,3" opacity="0.4" />
      <line x1="180" y1="80" x2="180" y2="220" stroke="currentColor" strokeWidth="0.5" strokeDasharray="3,3" opacity="0.4" />
      <text x="100" y="248" textAnchor="middle" fill="currentColor" fontSize="8" opacity="0.5">SECTION A–A</text>
    </svg>,
    // Slide 2 — elevation
    <svg key={2} width="100%" height="100%" viewBox="0 0 200 260">
      <rect x="20" y="60" width="160" height="150" fill="none" stroke="currentColor" strokeWidth="1.5" />
      <rect x="40" y="80" width="30" height="50" fill="none" stroke="currentColor" strokeWidth="0.8" />
      <rect x="90" y="80" width="30" height="50" fill="none" stroke="currentColor" strokeWidth="0.8" />
      <rect x="140" y="80" width="30" height="50" fill="none" stroke="currentColor" strokeWidth="0.8" />
      <rect x="80" y="155" width="40" height="55" fill="none" stroke="currentColor" strokeWidth="0.8" />
      <line x1="0" y1="210" x2="200" y2="210" stroke="currentColor" strokeWidth="1" />
      <text x="100" y="248" textAnchor="middle" fill="currentColor" fontSize="8" opacity="0.5">NORTH ELEVATION</text>
    </svg>,
  ]
  const textColor = theme === 'dark' ? 'oklch(0.5 0.004 270)' : '#9ca3af'
  return (
    <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: textColor }}>
      {shapes[slideIdx % shapes.length]}
    </div>
  )
}

// ─── Main ─────────────────────────────────────────────────────────────────────

export function AnalysisPage() {
  const { theme } = useTheme()
  const c = useColors(theme)
  const params = useParams({ from: '/app/analysis/$projectId' })
  const navigate = useNavigate()
  const FONT = "-apple-system, BlinkMacSystemFont, 'SF Pro Display', 'Helvetica Neue', 'Inter', sans-serif"

  const [project, setProject]   = useState<ProjectData | null>(null)
  const [loading, setLoading]   = useState(true)
  const [error, setError]       = useState<string | null>(null)
  const [slideIdx, setSlideIdx] = useState(0)
  const [isPlaying, setIsPlaying] = useState(false)
  const [pdfUrl, setPdfUrl]     = useState<string | null>(null)
  const playTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

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

    setLoading(true)
    setError(null)
    load()

    const sub = supabase
      .channel(`analysis-${params.projectId}`)
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'analyses', filter: `project_id=eq.${params.projectId}` }, load)
      .subscribe()

    return () => { if (pollTimer) clearTimeout(pollTimer); supabase.removeChannel(sub) }
  }, [params.projectId])

  // ── Get signed PDF URL ──
  const latestAnalysis = project?.analyses
    ?.filter(a => a.status === 'complete')
    .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())[0]

  useEffect(() => {
    if (!latestAnalysis?.pdf_path) return
    supabase.storage.from('project-pdfs').createSignedUrl(latestAnalysis.pdf_path, 7200)
      .then(({ data }) => { if (data?.signedUrl) setPdfUrl(data.signedUrl) })
  }, [latestAnalysis?.pdf_path])

  // ── Auto-play ──
  useEffect(() => {
    if (!isPlaying) return
    const total = (feedbackItems.length || 0) + 1
    playTimerRef.current = setTimeout(() => {
      setSlideIdx(s => {
        if (s < total - 1) return s + 1
        setIsPlaying(false)
        return s
      })
    }, 6000)
    return () => { if (playTimerRef.current) clearTimeout(playTimerRef.current) }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isPlaying, slideIdx])

  const isPending   = project?.analyses?.some(a => a.status === 'pending' || a.status === 'processing')
  const stage       = project ? (STAGE_META[project.stage] ?? { label: project.stage, color: '#F97316' }) : null

  const feedbackItems: FeedbackItem[] = Array.isArray(latestAnalysis?.feedback)
    ? latestAnalysis.feedback as unknown as FeedbackItem[]
    : []

  const juryQuestions: string[] = Array.isArray(latestAnalysis?.jury_questions)
    ? latestAnalysis.jury_questions as unknown as string[]
    : []

  // ── Loading ──
  if (loading) return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', gap: 10, color: c.textMuted }}>
      <Loader2 size={20} style={{ animation: 'spin 1s linear infinite' }} />
      <span style={{ fontSize: 14 }}>Loading analysis…</span>
      <style>{`@keyframes spin{from{transform:rotate(0deg)}to{transform:rotate(360deg)}}`}</style>
    </div>
  )

  // ── Error ──
  if (error || !project) return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', gap: 12 }}>
      <AlertCircle size={32} color="oklch(0.65 0.18 25)" />
      <p style={{ fontSize: 14, color: c.textMuted }}>{error || 'Project not found.'}</p>
      <button onClick={() => navigate({ to: '/projects' })} style={{ padding: '8px 20px', borderRadius: 100, background: '#F97316', border: 'none', color: '#fff', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>Back to Projects</button>
    </div>
  )

  // ── Pending ──
  if (!latestAnalysis) return (
    <div style={{ padding: '24px 28px', fontFamily: "'Inter',sans-serif" }}>
      <button onClick={() => navigate({ to: '/projects' })} style={{ background: 'none', border: 'none', cursor: 'pointer', color: c.textMuted, fontSize: 13, padding: 0, marginBottom: 16, display: 'flex', alignItems: 'center', gap: 4 }}>
        <ChevronLeft size={14} /> My Projects
      </button>
      <h1 style={{ fontSize: 20, fontWeight: 800, color: c.textPrimary, margin: '0 0 4px', fontFamily: FONT }}>{project.name}</h1>
      <span style={{ fontSize: 12, fontWeight: 600, color: stage?.color }}>{stage?.label}</span>
      <div style={{ marginTop: 48, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16, textAlign: 'center' }}>
        {isPending ? (
          <>
            <div style={{ width: 72, height: 72, borderRadius: '50%', background: 'oklch(0.72 0.18 45 / 0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', animation: 'spin-ring 3s ease-in-out infinite', boxShadow: '0 0 30px oklch(0.72 0.18 45 / 0.4)' }}>
              <Loader2 size={30} color="#F97316" style={{ animation: 'spin 1s linear infinite' }} />
            </div>
            <style>{`@keyframes spin-ring{0%,100%{box-shadow:0 0 20px oklch(0.72 0.18 45/0.3)}50%{box-shadow:0 0 50px oklch(0.72 0.18 45/0.7)}}`}</style>
            <h2 style={{ fontSize: 20, fontWeight: 700, margin: 0, color: c.textPrimary, fontFamily: FONT }}>Analysis in progress…</h2>
            <p style={{ fontSize: 14, color: c.textMuted, maxWidth: 340, margin: 0, lineHeight: 1.6 }}>Your drawings are being reviewed by AI. This usually takes 1–2 minutes.</p>
          </>
        ) : (
          <>
            <div style={{ fontSize: 48 }}>📐</div>
            <h2 style={{ fontSize: 18, fontWeight: 700, margin: 0, color: c.textPrimary, fontFamily: FONT }}>No analysis yet</h2>
            <p style={{ fontSize: 14, color: c.textMuted, maxWidth: 340, margin: 0 }}>Upload your PDF drawings to get AI-powered critique.</p>
            <button onClick={() => navigate({ to: '/projects/new' })} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 24px', borderRadius: 100, background: '#F97316', border: 'none', color: '#fff', fontSize: 13, fontWeight: 600, cursor: 'pointer', boxShadow: '0 0 16px oklch(0.72 0.18 45 / 0.3)' }}>
              <Plus size={15} /> Upload drawings
            </button>
          </>
        )}
      </div>
    </div>
  )

  // ── Full analysis view ──
  const avg = ((latestAnalysis.concept_score ?? 0) + (latestAnalysis.spatial_score ?? 0) + (latestAnalysis.presentation_score ?? 0)) / 3
  const totalSlides = feedbackItems.length + 1 // +1 for summary
  const isSummary = slideIdx >= feedbackItems.length
  const currentFeedback = !isSummary ? feedbackItems[slideIdx] : null

  const scoreRings = [
    { label: 'Concept',      score: latestAnalysis.concept_score ?? 0 },
    { label: 'Spatial',      score: latestAnalysis.spatial_score ?? 0 },
    { label: 'Presentation', score: latestAnalysis.presentation_score ?? 0 },
  ]

  // Brief text next to each ring — pick feedback items by dimension
  const ringSummaries = [
    feedbackItems.find((_, i) => i % 3 === 0)?.title ?? '—',
    feedbackItems.find((_, i) => i % 3 === 1)?.title ?? '—',
    feedbackItems.find((_, i) => i % 3 === 2)?.title ?? '—',
  ]

  const subtitleText = isSummary
    ? `Analysis complete — ${feedbackItems.length} feedback points reviewed. Overall score: ${avg.toFixed(1)} / 10`
    : currentFeedback
      ? currentFeedback.text
      : ''

  const suggestionText = !isSummary && currentFeedback?.suggestion ? currentFeedback.suggestion : ''

  return (
    <div style={{ height: 'calc(100vh - 54px)', display: 'flex', flexDirection: 'column', overflow: 'hidden', fontFamily: "'Inter', sans-serif", background: c.bg }}>

      {/* ── CSS animations ── */}
      <style>{`
        @keyframes glow-flash-pulse {
          0%   { box-shadow: 0 0 70px oklch(0.72 0.18 45/0.95), 0 0 140px oklch(0.72 0.18 45/0.5); border-color: oklch(0.72 0.18 45/0.9); }
          25%  { box-shadow: 0 0 30px oklch(0.72 0.18 45/0.5), 0 0 70px oklch(0.72 0.18 45/0.2);  border-color: oklch(0.72 0.18 45/0.5); }
          60%  { box-shadow: 0 0 55px oklch(0.72 0.18 45/0.85),0 0 110px oklch(0.72 0.18 45/0.4); border-color: oklch(0.72 0.18 45/0.8); }
          80%  { box-shadow: 0 0 25px oklch(0.72 0.18 45/0.45),0 0 60px oklch(0.72 0.18 45/0.18); border-color: oklch(0.72 0.18 45/0.4); }
          100% { box-shadow: 0 0 55px oklch(0.72 0.18 45/0.85),0 0 110px oklch(0.72 0.18 45/0.4); border-color: oklch(0.72 0.18 45/0.8); }
        }
        @keyframes glow-summary {
          0%,100% { box-shadow: 0 0 20px oklch(0.72 0.17 145/0.4), 0 0 50px oklch(0.72 0.17 145/0.15); border-color: oklch(0.72 0.17 145/0.5); }
          50%     { box-shadow: 0 0 40px oklch(0.72 0.17 145/0.7), 0 0 90px oklch(0.72 0.17 145/0.3);  border-color: oklch(0.72 0.17 145/0.8); }
        }
        @keyframes slide-up { from { opacity:0; transform:translateY(8px); } to { opacity:1; transform:translateY(0); } }
        @keyframes spin { to { transform: rotate(360deg); } }
        @keyframes dot-prog { from { width:0% } }
      `}</style>

      {/* ── Header ── */}
      <div style={{ padding: '12px 24px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexShrink: 0, borderBottom: `1px solid ${c.border}` }}>
        <div>
          <button onClick={() => navigate({ to: '/projects' })} style={{ background: 'none', border: 'none', cursor: 'pointer', color: c.textMuted, fontSize: 12, padding: 0, marginBottom: 2, display: 'flex', alignItems: 'center', gap: 4 }}>
            <ChevronLeft size={13} /> My Projects
          </button>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <h1 style={{ fontSize: 17, fontWeight: 800, color: c.textPrimary, margin: 0, fontFamily: FONT }}>{project.name}</h1>
            <span style={{ fontSize: 10, fontWeight: 700, color: stage?.color, background: `${stage?.color}22`, padding: '2px 8px', borderRadius: 100, letterSpacing: '0.06em' }}>{stage?.label?.toUpperCase()}</span>
          </div>
        </div>
        <button style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '7px 14px', borderRadius: 100, background: c.cardBg, border: `1px solid ${c.border}`, color: c.textMuted, fontSize: 12, cursor: 'pointer' }}>
          <Download size={13} /> Export PDF
        </button>
      </div>

      {/* ── Main body: viewer + scores ── */}
      <div style={{ flex: 1, display: 'flex', gap: 20, padding: '18px 24px 0', overflow: 'hidden', minHeight: 0 }}>

        {/* Left: viewer */}
        <div style={{ flex: '0 0 58%', display: 'flex', flexDirection: 'column', minHeight: 0 }}>
          {/* Glowing viewer box */}
          <div
            key={`viewer-${slideIdx}`}
            style={{
              flex: 1,
              borderRadius: 20,
              overflow: 'hidden',
              position: 'relative',
              background: c.isDark ? 'oklch(0.13 0.004 270)' : '#f1f5f9',
              border: '1.5px solid transparent',
              animation: isSummary
                ? 'glow-summary 3s ease-in-out infinite'
                : 'glow-flash-pulse 3s ease-in-out infinite',
              minHeight: 0,
            }}
          >
            {/* PDF or mock drawing */}
            {pdfUrl ? (
              <embed
                src={`${pdfUrl}`}
                type="application/pdf"
                style={{ width: '100%', height: '100%', border: 'none', borderRadius: 18 }}
              />
            ) : (
              <MockPDFViewer theme={theme} slideIdx={slideIdx} />
            )}

            {/* Volume icon */}
            <div style={{ position: 'absolute', bottom: 14, left: 14, opacity: 0.35 }}>
              <Volume2 size={16} color={c.isDark ? '#fff' : '#000'} />
            </div>

            {/* Slide counter badge */}
            {!isSummary && (
              <div style={{ position: 'absolute', top: 14, right: 14, background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(8px)', borderRadius: 100, padding: '4px 10px', fontSize: 11, fontWeight: 700, color: '#fff', letterSpacing: '0.06em' }}>
                {slideIdx + 1} / {feedbackItems.length}
              </div>
            )}
            {isSummary && (
              <div style={{ position: 'absolute', top: 14, right: 14, background: 'oklch(0.72 0.17 145 / 0.85)', backdropFilter: 'blur(8px)', borderRadius: 100, padding: '4px 12px', fontSize: 11, fontWeight: 700, color: '#fff', letterSpacing: '0.06em' }}>
                SUMMARY
              </div>
            )}
          </div>

          {/* Progress dots */}
          <div style={{ display: 'flex', gap: 6, justifyContent: 'center', padding: '10px 0 0' }}>
            {Array.from({ length: totalSlides }).map((_, i) => (
              <button
                key={i}
                onClick={() => setSlideIdx(i)}
                style={{
                  width: i === slideIdx ? 22 : 7, height: 7, borderRadius: 100,
                  border: 'none', cursor: 'pointer', padding: 0, transition: 'all 0.3s',
                  background: i === slideIdx
                    ? (isSummary ? 'oklch(0.72 0.17 145)' : '#F97316')
                    : (c.isDark ? 'oklch(0.3 0.004 270)' : '#d1d5db'),
                }}
              />
            ))}
          </div>
        </div>

        {/* Right: scores panel */}
        <div style={{ flex: '0 0 42%', display: 'flex', flexDirection: 'column', gap: 12, overflowY: 'auto', paddingBottom: 4 }}>
          {!isSummary ? (
            // Per-feedback-slide view
            <div key={`panel-${slideIdx}`} style={{ animation: 'slide-up 0.35s ease-out', display: 'flex', flexDirection: 'column', gap: 12 }}>
              {/* Current feedback big card */}
              <div style={{ background: c.cardBg, borderRadius: 18, padding: '18px', border: `1.5px solid #F97316`, boxShadow: '0 0 24px oklch(0.72 0.18 45 / 0.12)' }}>
                <div style={{ fontSize: 10, fontWeight: 700, color: '#F97316', letterSpacing: '0.1em', marginBottom: 8 }}>
                  FEEDBACK {slideIdx + 1} OF {feedbackItems.length}
                </div>
                <div style={{ fontSize: 15, fontWeight: 800, color: c.textPrimary, lineHeight: 1.35, marginBottom: 8, fontFamily: FONT }}>
                  {currentFeedback?.title}
                </div>
                <p style={{ fontSize: 13, color: c.textMuted, margin: 0, lineHeight: 1.6 }}>
                  {currentFeedback?.text}
                </p>
                {currentFeedback?.suggestion && (
                  <div style={{ marginTop: 12, padding: '10px 12px', borderRadius: 10, background: 'oklch(0.72 0.18 45 / 0.08)', display: 'flex', gap: 8 }}>
                    <span style={{ fontSize: 14 }}>💡</span>
                    <p style={{ fontSize: 12, color: c.textMuted, margin: 0, lineHeight: 1.5 }}>{currentFeedback.suggestion}</p>
                  </div>
                )}
              </div>

              {/* 3 score rings */}
              {scoreRings.map((ring, i) => (
                <div key={ring.label} style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '12px 16px', borderRadius: 14, background: c.cardBg, border: `1px solid ${c.border}` }}>
                  <ScoreRing score={ring.score} label="" size={58} theme={theme} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 10, fontWeight: 700, color: c.textMuted, letterSpacing: '0.08em', marginBottom: 2 }}>{ring.label.toUpperCase()}</div>
                    <div style={{ fontSize: 16, fontWeight: 800, color: c.textPrimary, marginBottom: 3, fontFamily: FONT }}>{ring.score.toFixed(1)}</div>
                    <div style={{ fontSize: 11, color: c.textMuted, lineHeight: 1.4, overflow: 'hidden', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' as const }}>
                      {ringSummaries[i]}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            // Summary slide
            <div key="summary-panel" style={{ animation: 'slide-up 0.4s ease-out', display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div style={{ fontSize: 10, fontWeight: 700, color: 'oklch(0.72 0.17 145)', letterSpacing: '0.12em' }}>OVERALL ANALYSIS</div>

              {/* 3 score rings in a row */}
              <div style={{ display: 'flex', justifyContent: 'space-around', padding: '8px 0 4px' }}>
                {scoreRings.map(ring => (
                  <div key={ring.label} style={{ textAlign: 'center' }}>
                    <ScoreRing score={ring.score} label={ring.label} size={76} theme={theme} />
                  </div>
                ))}
              </div>

              {/* Big average ring */}
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '10px 0', background: c.cardBg, borderRadius: 18, border: `1px solid ${c.border}` }}>
                <div style={{ fontSize: 10, fontWeight: 700, color: c.textMuted, letterSpacing: '0.1em', marginBottom: 12 }}>AVERAGE SCORE</div>
                <ScoreRing score={avg} label="" size={96} theme={theme} />
                <div style={{ fontSize: 24, fontWeight: 900, color: c.textPrimary, marginTop: 6, fontFamily: FONT }}>{avg.toFixed(1)}<span style={{ fontSize: 13, fontWeight: 500, color: c.textMuted }}> / 10</span></div>
              </div>

              {/* Key findings */}
              <div style={{ background: c.cardBg, borderRadius: 14, padding: '14px 16px', border: `1px solid ${c.border}` }}>
                <div style={{ fontSize: 10, fontWeight: 700, color: c.textMuted, letterSpacing: '0.08em', marginBottom: 10 }}>KEY FINDINGS</div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  {feedbackItems.slice(0, 4).map((fb, i) => (
                    <div key={i} style={{ display: 'flex', gap: 8, alignItems: 'flex-start' }}>
                      <div style={{ width: 5, height: 5, borderRadius: '50%', background: '#F97316', flexShrink: 0, marginTop: 5 }} />
                      <span style={{ fontSize: 12, color: c.textMuted, lineHeight: 1.5 }}>{fb.title}</span>
                    </div>
                  ))}
                  {feedbackItems.length > 4 && (
                    <div style={{ fontSize: 11, color: c.textMuted, opacity: 0.6, paddingLeft: 13 }}>+ {feedbackItems.length - 4} more</div>
                  )}
                </div>
              </div>

              {/* Jury questions preview */}
              {juryQuestions.length > 0 && (
                <div style={{ background: c.cardBg, borderRadius: 14, padding: '14px 16px', border: `1px solid ${c.border}` }}>
                  <div style={{ fontSize: 10, fontWeight: 700, color: c.textMuted, letterSpacing: '0.08em', marginBottom: 10 }}>JURY WILL ASK</div>
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

      {/* ── Footer: subtitle + navigation ── */}
      <div style={{ padding: '12px 24px 16px', flexShrink: 0 }}>
        {/* Subtitle bar */}
        <div style={{
          background: c.isDark ? 'oklch(0.16 0.004 270)' : '#f8fafc',
          border: `1px solid ${c.border}`,
          borderRadius: 12,
          padding: '12px 18px',
          marginBottom: 12,
          minHeight: 52,
          display: 'flex', alignItems: 'center', gap: 12,
        }}>
          <Volume2 size={14} color={c.textMuted} style={{ flexShrink: 0 }} />
          <p key={`sub-${slideIdx}`} style={{ fontSize: 13, color: c.textPrimary, margin: 0, lineHeight: 1.6, animation: 'slide-up 0.3s ease-out', flex: 1 }}>
            {subtitleText}
            {suggestionText && <span style={{ color: c.textMuted }}> — {suggestionText}</span>}
          </p>
        </div>

        {/* Navigation controls */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 14 }}>
          <button
            onClick={() => setSlideIdx(s => Math.max(s - 1, 0))}
            disabled={slideIdx === 0}
            style={{ padding: '9px 20px', borderRadius: 100, background: c.cardBg, border: `1px solid ${c.border}`, color: c.textPrimary, fontSize: 13, fontWeight: 500, cursor: slideIdx === 0 ? 'not-allowed' : 'pointer', opacity: slideIdx === 0 ? 0.35 : 1, transition: 'all 0.15s' }}
          >
            ← Previous
          </button>

          <button
            onClick={() => setIsPlaying(p => !p)}
            style={{ width: 50, height: 50, borderRadius: '50%', background: isPlaying ? 'oklch(0.65 0.18 25)' : '#F97316', border: 'none', color: '#fff', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: `0 0 22px ${isPlaying ? 'oklch(0.65 0.18 25/0.5)' : 'oklch(0.72 0.18 45/0.5)'}`, transition: 'all 0.2s', flexShrink: 0 }}
          >
            {isPlaying ? <Pause size={18} /> : <Play size={18} style={{ marginLeft: 2 }} />}
          </button>

          <button
            onClick={() => setSlideIdx(s => Math.min(s + 1, totalSlides - 1))}
            disabled={slideIdx >= totalSlides - 1}
            style={{ padding: '9px 20px', borderRadius: 100, background: c.cardBg, border: `1px solid ${c.border}`, color: c.textPrimary, fontSize: 13, fontWeight: 500, cursor: slideIdx >= totalSlides - 1 ? 'not-allowed' : 'pointer', opacity: slideIdx >= totalSlides - 1 ? 0.35 : 1, transition: 'all 0.15s' }}
          >
            Next →
          </button>
        </div>
      </div>
    </div>
  )
}
