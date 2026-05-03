import { useState, useEffect } from 'react'
import { useParams, useNavigate } from '@tanstack/react-router'
import { ChevronLeft, ChevronRight, Volume2, Download, ChevronDown, ChevronUp, Loader2, AlertCircle, Plus } from 'lucide-react'
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
  category?: 'concept' | 'spatial' | 'presentation'
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
  'jury-prep':        { label: 'Jury Prep',         color: 'oklch(0.65 0.18 25)' },
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function WaveBar({ active }: { active: boolean }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 2 }}>
      {[0, 1, 2, 3, 4].map(i => (
        <div key={i} style={{
          width: 3, borderRadius: 2,
          height: active ? undefined : 8,
          background: '#F97316',
          animation: active ? `wave-bar 0.8s ease-in-out infinite` : 'none',
          animationDelay: active ? `${i * 0.1}s` : '0s',
        }} />
      ))}
      <style>{`@keyframes wave-bar { 0%,100%{height:8px} 50%{height:20px} }`}</style>
    </div>
  )
}

function MockPDFViewer({ theme, pageIdx, totalPages }: { theme: 'dark' | 'light'; pageIdx: number; totalPages: number }) {
  const c = useColors(theme)
  const bg = theme === 'dark' ? 'oklch(0.24 0.004 270)' : '#f1f5f9'
  const labels = ['CONCEPT DIAGRAM', 'GROUND FLOOR PLAN', 'SECTION A-A', 'ELEVATION', 'DETAIL']
  return (
    <div style={{ position: 'relative', width: '100%', paddingBottom: '141%', background: bg, borderRadius: 12, overflow: 'hidden' }}>
      <div style={{ position: 'absolute', inset: 0, padding: '8%' }}>
        <div style={{ height: '100%', border: `1px solid ${c.border}`, borderRadius: 4, position: 'relative' }}>
          <svg width="100%" height="100%" viewBox="0 0 200 280" style={{ position: 'absolute', inset: 0, opacity: 0.5 }}>
            <rect x="20" y="20" width="160" height="240" fill="none" stroke={theme === 'dark' ? 'oklch(0.45 0.004 270)' : '#9ca3af'} strokeWidth="1.5" />
            <rect x="40" y="40" width="60" height="80" fill="none" stroke={theme === 'dark' ? 'oklch(0.45 0.004 270)' : '#9ca3af'} strokeWidth="0.8" />
            <rect x="120" y="40" width="45" height="80" fill="none" stroke={theme === 'dark' ? 'oklch(0.45 0.004 270)' : '#9ca3af'} strokeWidth="0.8" />
            <rect x="40" y="150" width="120" height="90" fill="none" stroke={theme === 'dark' ? 'oklch(0.45 0.004 270)' : '#9ca3af'} strokeWidth="0.8" />
            <line x1="20" y1="130" x2="180" y2="130" stroke={theme === 'dark' ? 'oklch(0.35 0.004 270)' : '#d1d5db'} strokeWidth="0.5" strokeDasharray="4,3" />
            <line x1="100" y1="20" x2="100" y2="260" stroke={theme === 'dark' ? 'oklch(0.35 0.004 270)' : '#d1d5db'} strokeWidth="0.5" strokeDasharray="4,3" />
            <text x="100" y="275" textAnchor="middle" fill={theme === 'dark' ? 'oklch(0.45 0.004 270)' : '#9ca3af'} fontSize="8">
              {labels[pageIdx % labels.length]}
            </text>
          </svg>
        </div>
      </div>
    </div>
  )
}

// ─── Main page ────────────────────────────────────────────────────────────────

export function AnalysisPage() {
  const { theme } = useTheme()
  const c = useColors(theme)
  const params = useParams({ from: '/app/analysis/$projectId' })
  const navigate = useNavigate()
  const FONT = "-apple-system, BlinkMacSystemFont, 'SF Pro Display', 'Helvetica Neue', 'Inter', sans-serif"

  const [project, setProject] = useState<ProjectData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [pageIdx, setPageIdx] = useState(0)
  const [voiceActive, setVoiceActive] = useState(false)
  const [expandedFeedback, setExpandedFeedback] = useState<number | null>(null)
  const [activeTab, setActiveTab] = useState<'feedback' | 'jury'>('feedback')

  // Load project + analyses
  useEffect(() => {
    const load = async () => {
      setLoading(true)
      setError(null)
      const { data, error: err } = await supabase
        .from('projects')
        .select('id, name, stage, analyses(id, status, concept_score, spatial_score, presentation_score, feedback, jury_questions, pdf_path, created_at)')
        .eq('id', params.projectId)
        .single()

      if (err || !data) {
        setError('Project not found.')
        setLoading(false)
        return
      }
      setProject(data as unknown as ProjectData)
      setLoading(false)
    }
    load()

    // Realtime: update when analysis completes
    const sub = supabase
      .channel(`analysis-${params.projectId}`)
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'analyses', filter: `project_id=eq.${params.projectId}` }, load)
      .subscribe()
    return () => { supabase.removeChannel(sub) }
  }, [params.projectId])

  // Get latest complete analysis
  const latestAnalysis = project?.analyses
    ?.filter(a => a.status === 'complete')
    .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())[0]

  const isPending = project?.analyses?.some(a => a.status === 'pending' || a.status === 'processing')

  const stage = project ? (STAGE_META[project.stage] ?? { label: project.stage, color: '#F97316' }) : null

  // Parse feedback & jury questions from JSON
  const feedbackItems: FeedbackItem[] = Array.isArray(latestAnalysis?.feedback)
    ? latestAnalysis.feedback as unknown as FeedbackItem[]
    : []

  const juryQuestions: string[] = Array.isArray(latestAnalysis?.jury_questions)
    ? latestAnalysis.jury_questions as unknown as string[]
    : []

  const FONT_INTER = "'Inter', sans-serif"

  // ── Loading state ──
  if (loading) return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', gap: 10, color: c.textMuted }}>
      <Loader2 size={20} style={{ animation: 'spin 1s linear infinite' }} />
      <span style={{ fontSize: 14, fontFamily: FONT_INTER }}>Loading analysis…</span>
      <style>{`@keyframes spin{from{transform:rotate(0deg)}to{transform:rotate(360deg)}}`}</style>
    </div>
  )

  // ── Error state ──
  if (error || !project) return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', gap: 12, color: c.textMuted }}>
      <AlertCircle size={32} color="oklch(0.65 0.18 25)" />
      <p style={{ fontSize: 14, fontFamily: FONT_INTER }}>{error || 'Project not found.'}</p>
      <button onClick={() => navigate({ to: '/projects' })} style={{ padding: '8px 20px', borderRadius: 100, background: '#F97316', border: 'none', color: '#fff', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
        Back to Projects
      </button>
    </div>
  )

  // ── Pending / no analysis state ──
  if (!latestAnalysis) return (
    <div style={{ padding: '24px 28px', fontFamily: FONT_INTER }}>
      <button onClick={() => navigate({ to: '/projects' })} style={{ background: 'none', border: 'none', cursor: 'pointer', color: c.textMuted, fontSize: 13, padding: 0, marginBottom: 16, display: 'flex', alignItems: 'center', gap: 4 }}>
        <ChevronLeft size={14} /> My Projects
      </button>
      <h1 style={{ fontSize: 20, fontWeight: 800, letterSpacing: '-0.02em', color: c.textPrimary, margin: '0 0 4px', fontFamily: FONT }}>{project.name}</h1>
      <span style={{ fontSize: 12, fontWeight: 600, color: stage?.color }}>{stage?.label}</span>

      <div style={{ marginTop: 48, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16, textAlign: 'center' }}>
        {isPending ? (
          <>
            <div style={{ width: 64, height: 64, borderRadius: '50%', background: 'oklch(0.72 0.18 45 / 0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Loader2 size={28} color="#F97316" style={{ animation: 'spin 1s linear infinite' }} />
            </div>
            <h2 style={{ fontSize: 18, fontWeight: 700, margin: 0, color: c.textPrimary, fontFamily: FONT }}>Analysis in progress…</h2>
            <p style={{ fontSize: 14, color: c.textMuted, maxWidth: 340, margin: 0 }}>Your drawings are being reviewed by AI. This usually takes 1–2 minutes.</p>
          </>
        ) : (
          <>
            <div style={{ fontSize: 48 }}>📐</div>
            <h2 style={{ fontSize: 18, fontWeight: 700, margin: 0, color: c.textPrimary, fontFamily: FONT }}>No analysis yet</h2>
            <p style={{ fontSize: 14, color: c.textMuted, maxWidth: 340, margin: 0 }}>Upload your PDF drawings to get AI-powered critique and jury preparation questions.</p>
            <button
              onClick={() => navigate({ to: '/projects/new' })}
              style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 24px', borderRadius: 100, background: '#F97316', border: 'none', color: '#fff', fontSize: 13, fontWeight: 600, cursor: 'pointer', boxShadow: '0 0 16px oklch(0.72 0.18 45 / 0.3)' }}>
              <Plus size={15} /> Upload drawings
            </button>
          </>
        )}
      </div>
    </div>
  )

  // ── Full analysis view ──
  const avg = ((latestAnalysis.concept_score ?? 0) + (latestAnalysis.spatial_score ?? 0) + (latestAnalysis.presentation_score ?? 0)) / 3

  return (
    <div style={{ padding: '24px 28px', fontFamily: FONT_INTER, height: 'calc(100vh - 54px)', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>

      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20, flexShrink: 0 }}>
        <div>
          <button onClick={() => navigate({ to: '/projects' })} style={{ background: 'none', border: 'none', cursor: 'pointer', color: c.textMuted, fontSize: 13, padding: 0, marginBottom: 4, display: 'flex', alignItems: 'center', gap: 4 }}>
            <ChevronLeft size={14} /> My Projects
          </button>
          <h1 style={{ fontSize: 20, fontWeight: 800, letterSpacing: '-0.02em', color: c.textPrimary, margin: 0, fontFamily: FONT }}>{project.name}</h1>
          <span style={{ fontSize: 12, fontWeight: 600, color: stage?.color }}>{stage?.label}</span>
        </div>
        <button style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 14px', borderRadius: 100, background: c.cardBg, border: `1px solid ${c.border}`, color: c.textMuted, fontSize: 13, cursor: 'pointer' }}>
          <Download size={14} /> Export PDF
        </button>
      </div>

      {/* 3-column layout */}
      <div style={{ display: 'flex', gap: 16, flex: 1, overflow: 'hidden' }}>

        {/* Left: PDF Viewer */}
        <div style={{ width: 280, flexShrink: 0, display: 'flex', flexDirection: 'column', gap: 10 }}>
          <div style={{ background: c.cardBg, borderRadius: 16, padding: 12, border: `1px solid ${c.border}`, flex: 1, display: 'flex', flexDirection: 'column' }}>
            <MockPDFViewer theme={theme} pageIdx={pageIdx} totalPages={3} />
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 12, paddingTop: 10, borderTop: `1px solid ${c.border}` }}>
              <button onClick={() => setPageIdx(p => Math.max(0, p - 1))} disabled={pageIdx === 0}
                style={{ background: 'none', border: `1px solid ${c.border}`, borderRadius: 8, padding: '4px 10px', cursor: pageIdx === 0 ? 'not-allowed' : 'pointer', color: c.textPrimary, opacity: pageIdx === 0 ? 0.4 : 1 }}>
                <ChevronLeft size={14} />
              </button>
              <span style={{ fontSize: 12, color: c.textMuted }}>{pageIdx + 1} / 3</span>
              <button onClick={() => setPageIdx(p => Math.min(2, p + 1))} disabled={pageIdx === 2}
                style={{ background: 'none', border: `1px solid ${c.border}`, borderRadius: 8, padding: '4px 10px', cursor: pageIdx === 2 ? 'not-allowed' : 'pointer', color: c.textPrimary, opacity: pageIdx === 2 ? 0.4 : 1 }}>
                <ChevronRight size={14} />
              </button>
            </div>
          </div>
          <button onClick={() => setVoiceActive(v => !v)} style={{
            display: 'flex', alignItems: 'center', gap: 10, padding: '12px 14px', borderRadius: 12,
            background: voiceActive ? 'oklch(0.72 0.18 45 / 0.1)' : c.cardBg,
            border: `1.5px solid ${voiceActive ? '#F97316' : c.border}`,
            cursor: 'pointer', transition: 'all 0.2s', color: c.textPrimary,
          }}>
            <WaveBar active={voiceActive} />
            <span style={{ fontSize: 13, fontWeight: 600, color: voiceActive ? '#F97316' : c.textPrimary }}>
              {voiceActive ? 'Stop narration' : 'Play narration'}
            </span>
            <Volume2 size={14} color={voiceActive ? '#F97316' : c.textMuted} style={{ marginLeft: 'auto' }} />
          </button>
        </div>

        {/* Center: Scores */}
        <div style={{ width: 180, flexShrink: 0, display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div style={{ background: c.cardBg, borderRadius: 16, padding: '16px 12px', border: `1px solid ${c.border}`, textAlign: 'center' }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: '#F97316', letterSpacing: '0.08em', marginBottom: 12 }}>SCORES</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <ScoreRing score={latestAnalysis.concept_score ?? 0} label="Concept" size={72} theme={theme} />
              <ScoreRing score={latestAnalysis.spatial_score ?? 0} label="Spatial" size={72} theme={theme} />
              <ScoreRing score={latestAnalysis.presentation_score ?? 0} label="Presentation" size={72} theme={theme} />
            </div>
          </div>
          <div style={{ background: c.cardBg, borderRadius: 16, padding: '14px 12px', border: `1px solid ${c.border}`, textAlign: 'center' }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: c.textMuted, letterSpacing: '0.08em', marginBottom: 10 }}>OVERALL</div>
            <ScoreRing score={avg} label="Average" size={80} theme={theme} />
          </div>
        </div>

        {/* Right: Feedback + Jury tabs */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
          <div style={{ display: 'flex', gap: 4, marginBottom: 12, background: c.isDark ? 'oklch(0.19 0.004 270)' : '#f3f4f6', borderRadius: 10, padding: 4, flexShrink: 0 }}>
            {(['feedback', 'jury'] as const).map(t => (
              <button key={t} onClick={() => setActiveTab(t)} style={{
                flex: 1, padding: '8px', borderRadius: 8, border: 'none', cursor: 'pointer', fontSize: 13, fontWeight: 600, transition: 'all 0.15s',
                background: activeTab === t ? c.cardBg : 'transparent',
                color: activeTab === t ? c.textPrimary : c.textMuted,
                boxShadow: activeTab === t ? '0 1px 4px rgba(0,0,0,0.1)' : 'none',
              }}>
                {t === 'feedback' ? `AI Feedback${feedbackItems.length > 0 ? ` (${feedbackItems.length})` : ''}` : `Jury Questions${juryQuestions.length > 0 ? ` (${juryQuestions.length})` : ''}`}
              </button>
            ))}
          </div>

          <div style={{ flex: 1, overflowY: 'auto', paddingRight: 2 }}>
            {activeTab === 'feedback' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {feedbackItems.length === 0 ? (
                  <div style={{ textAlign: 'center', padding: '40px 20px', color: c.textMuted }}>
                    <p style={{ fontSize: 14 }}>AI feedback will appear here once analysis completes.</p>
                  </div>
                ) : feedbackItems.map(fb => (
                  <div key={fb.n} style={{ background: c.cardBg, borderRadius: 14, border: `1px solid ${c.border}`, overflow: 'hidden' }}>
                    <button
                      onClick={() => setExpandedFeedback(expandedFeedback === fb.n ? null : fb.n)}
                      style={{ width: '100%', padding: '14px 16px', background: 'none', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'flex-start', gap: 10, textAlign: 'left' }}>
                      <div style={{ width: 22, height: 22, borderRadius: '50%', background: '#F97316', color: '#fff', fontSize: 11, fontWeight: 800, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                        {fb.n}
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 13, fontWeight: 700, color: c.textPrimary }}>{fb.title}</div>
                        <div style={{ fontSize: 12, color: c.textMuted, marginTop: 2 }}>{fb.text}</div>
                      </div>
                      {expandedFeedback === fb.n ? <ChevronUp size={14} color={c.textMuted} /> : <ChevronDown size={14} color={c.textMuted} />}
                    </button>
                    {expandedFeedback === fb.n && (
                      <div style={{ padding: '0 16px 14px 48px', borderTop: `1px solid ${c.border}` }}>
                        <div style={{ paddingTop: 12, display: 'flex', gap: 8 }}>
                          <div style={{ width: 3, borderRadius: 100, background: '#F97316', flexShrink: 0 }} />
                          <p style={{ fontSize: 13, color: c.textMuted, margin: 0, lineHeight: 1.6 }}>{fb.suggestion}</p>
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}

            {activeTab === 'jury' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {juryQuestions.length === 0 ? (
                  <div style={{ textAlign: 'center', padding: '40px 20px', color: c.textMuted }}>
                    <p style={{ fontSize: 14 }}>Jury questions will appear here once analysis completes.</p>
                  </div>
                ) : juryQuestions.map((q, i) => (
                  <div key={i} style={{ background: c.cardBg, borderRadius: 14, padding: '14px 16px', border: `1px solid ${c.border}` }}>
                    <div style={{ display: 'flex', gap: 10 }}>
                      <div style={{ width: 22, height: 22, borderRadius: 8, background: c.isDark ? 'oklch(0.28 0.004 270)' : '#f3f4f6', color: c.textMuted, fontSize: 11, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                        {i + 1}
                      </div>
                      <p style={{ fontSize: 13, color: c.textPrimary, margin: 0, lineHeight: 1.5 }}>{q}</p>
                    </div>
                    <button
                      onClick={() => navigate({ to: '/jury' })}
                      style={{ marginTop: 10, padding: '6px 14px', borderRadius: 100, background: 'transparent', border: `1px solid ${c.border}`, color: c.textMuted, fontSize: 12, cursor: 'pointer' }}>
                      Practise answer →
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
