import { useState, useEffect, useRef } from 'react'
import { useParams, useNavigate } from '@tanstack/react-router'
import { ChevronLeft, ChevronRight, Volume2, MessageSquare, Download, ChevronDown, ChevronUp } from 'lucide-react'
import { ScoreRing } from '@/components/ScoreRing'
import { useTheme, useColors } from '@/lib/theme'
import { MOCK_PROJECTS, MOCK_ANALYSIS_PAGES } from '@/lib/mock-data'

function WaveBar({ active, theme }: { active: boolean; theme: 'dark' | 'light' }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 2 }}>
      {[0, 1, 2, 3, 4].map(i => (
        <div key={i} style={{
          width: 3, borderRadius: 2,
          height: active ? undefined : 8,
          background: '#F97316',
          animation: active ? `wave-${i} 0.8s ease-in-out infinite` : 'none',
          animationDelay: active ? `${i * 0.1}s` : '0s',
        }} />
      ))}
    </div>
  )
}

function MockPDFPage({ pageIndex, highlights, theme }: { pageIndex: number; highlights: { x: string; y: string; n: number }[]; theme: 'dark' | 'light' }) {
  const c = useColors(theme)
  const bg = theme === 'dark' ? 'oklch(0.24 0.004 270)' : '#f1f5f9'
  return (
    <div style={{ position: 'relative', width: '100%', paddingBottom: '141%', background: bg, borderRadius: 12, overflow: 'hidden' }}>
      {/* Mock drawing content */}
      <div style={{ position: 'absolute', inset: 0, padding: '8%' }}>
        <div style={{ height: '100%', border: `1px solid ${c.border}`, borderRadius: 4, position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          {/* Mock floor plan lines */}
          <svg width="100%" height="100%" viewBox="0 0 200 280" style={{ position: 'absolute', inset: 0, opacity: 0.5 }}>
            <rect x="20" y="20" width="160" height="240" fill="none" stroke={theme === 'dark' ? 'oklch(0.45 0.004 270)' : '#9ca3af'} strokeWidth="1.5" />
            <rect x="40" y="40" width="60" height="80" fill="none" stroke={theme === 'dark' ? 'oklch(0.45 0.004 270)' : '#9ca3af'} strokeWidth="0.8" />
            <rect x="120" y="40" width="45" height="80" fill="none" stroke={theme === 'dark' ? 'oklch(0.45 0.004 270)' : '#9ca3af'} strokeWidth="0.8" />
            <rect x="40" y="150" width="120" height="90" fill="none" stroke={theme === 'dark' ? 'oklch(0.45 0.004 270)' : '#9ca3af'} strokeWidth="0.8" />
            <line x1="20" y1="130" x2="180" y2="130" stroke={theme === 'dark' ? 'oklch(0.35 0.004 270)' : '#d1d5db'} strokeWidth="0.5" strokeDasharray="4,3" />
            <line x1="100" y1="20" x2="100" y2="260" stroke={theme === 'dark' ? 'oklch(0.35 0.004 270)' : '#d1d5db'} strokeWidth="0.5" strokeDasharray="4,3" />
            <text x="100" y="275" textAnchor="middle" fill={theme === 'dark' ? 'oklch(0.45 0.004 270)' : '#9ca3af'} fontSize="8">
              {['CONCEPT DIAGRAM', 'GROUND FLOOR PLAN', 'SECTION A-A'][pageIndex]}
            </text>
          </svg>
          <span style={{ fontSize: 11, color: c.textMuted, position: 'relative', zIndex: 1, opacity: 0 }}>PDF Page</span>
        </div>
      </div>
      {/* Highlight markers */}
      {highlights.map(h => (
        <div key={h.n} style={{
          position: 'absolute', left: h.x, top: h.y,
          width: 22, height: 22, borderRadius: '50%',
          background: '#F97316', color: '#fff', fontSize: 11, fontWeight: 800,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          animation: 'critup-pulse 2s ease-in-out infinite',
          animationDelay: `${h.n * 0.3}s`,
          cursor: 'pointer', zIndex: 10,
          boxShadow: '0 0 0 0 oklch(0.72 0.18 45 / 0.5)',
        }}>
          {h.n}
        </div>
      ))}
    </div>
  )
}

export function AnalysisPage() {
  const { theme } = useTheme()
  const c = useColors(theme)
  const params = useParams({ from: '/app/analysis/$projectId' })
  const navigate = useNavigate()

  const project = MOCK_PROJECTS.find(p => p.id === params.projectId) || MOCK_PROJECTS[0]
  const [pageIdx, setPageIdx] = useState(0)
  const [voiceActive, setVoiceActive] = useState(false)
  const [expandedFeedback, setExpandedFeedback] = useState<number | null>(null)
  const [activeTab, setActiveTab] = useState<'feedback' | 'jury'>('feedback')
  const page = MOCK_ANALYSIS_PAGES[pageIdx]

  const JURY_Q = [
    "Your sectional drawing doesn't show the ground datum. How do you justify that?",
    "Walk us through your circulation logic from the main entry.",
    "What precedent studies influenced your structural approach?",
  ]

  return (
    <div style={{ padding: '24px 28px', fontFamily: "'Inter',sans-serif", height: 'calc(100vh - 60px)', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20, flexShrink: 0 }}>
        <div>
          <button onClick={() => navigate({ to: '/projects' })} style={{ background: 'none', border: 'none', cursor: 'pointer', color: c.textMuted, fontSize: 13, padding: 0, marginBottom: 4, display: 'flex', alignItems: 'center', gap: 4 }}>
            <ChevronLeft size={14} /> My Projects
          </button>
          <h1 style={{ fontSize: 20, fontWeight: 800, letterSpacing: '-0.02em', color: c.textPrimary, margin: 0, fontFamily: "-apple-system, BlinkMacSystemFont, 'SF Pro Display', 'Helvetica Neue', 'Inter', sans-serif" }}>{project.name}</h1>
          <span style={{ fontSize: 12, fontWeight: 600, color: project.stageColor }}>{project.stage}</span>
        </div>
        <button style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 14px', borderRadius: 100, background: c.cardBg, border: `1px solid ${c.border}`, color: c.textMuted, fontSize: 13, cursor: 'pointer' }}>
          <Download size={14} /> Export PDF
        </button>
      </div>

      {/* Main 3-column layout */}
      <div style={{ display: 'flex', gap: 16, flex: 1, overflow: 'hidden' }}>
        {/* Left: PDF Viewer */}
        <div style={{ width: 280, flexShrink: 0, display: 'flex', flexDirection: 'column', gap: 10 }}>
          <div style={{ background: c.cardBg, borderRadius: 16, padding: 12, border: `1px solid ${c.border}`, flex: 1, display: 'flex', flexDirection: 'column' }}>
            <MockPDFPage pageIndex={pageIdx} highlights={page.highlights} theme={theme} />
            {/* Page nav */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 12, paddingTop: 10, borderTop: `1px solid ${c.border}` }}>
              <button
                onClick={() => setPageIdx(p => Math.max(0, p - 1))}
                disabled={pageIdx === 0}
                style={{ background: 'none', border: `1px solid ${c.border}`, borderRadius: 8, padding: '4px 10px', cursor: pageIdx === 0 ? 'not-allowed' : 'pointer', color: pageIdx === 0 ? c.textMuted : c.textPrimary, opacity: pageIdx === 0 ? 0.4 : 1 }}
              >
                <ChevronLeft size={14} />
              </button>
              <span style={{ fontSize: 12, color: c.textMuted }}>{pageIdx + 1} / {MOCK_ANALYSIS_PAGES.length}</span>
              <button
                onClick={() => setPageIdx(p => Math.min(MOCK_ANALYSIS_PAGES.length - 1, p + 1))}
                disabled={pageIdx === MOCK_ANALYSIS_PAGES.length - 1}
                style={{ background: 'none', border: `1px solid ${c.border}`, borderRadius: 8, padding: '4px 10px', cursor: pageIdx === MOCK_ANALYSIS_PAGES.length - 1 ? 'not-allowed' : 'pointer', color: pageIdx === MOCK_ANALYSIS_PAGES.length - 1 ? c.textMuted : c.textPrimary, opacity: pageIdx === MOCK_ANALYSIS_PAGES.length - 1 ? 0.4 : 1 }}
              >
                <ChevronRight size={14} />
              </button>
            </div>
          </div>

          {/* Voiceover */}
          <button
            onClick={() => setVoiceActive(v => !v)}
            style={{
              display: 'flex', alignItems: 'center', gap: 10, padding: '12px 14px', borderRadius: 12,
              background: voiceActive ? 'oklch(0.72 0.18 45 / 0.1)' : c.cardBg,
              border: `1.5px solid ${voiceActive ? '#F97316' : c.border}`,
              cursor: 'pointer', transition: 'all 0.2s', color: c.textPrimary,
            }}
          >
            <WaveBar active={voiceActive} theme={theme} />
            <span style={{ fontSize: 13, fontWeight: 600, color: voiceActive ? '#F97316' : c.textPrimary }}>
              {voiceActive ? 'Stop narration' : 'Play narration'}
            </span>
            <Volume2 size={14} color={voiceActive ? '#F97316' : c.textMuted} style={{ marginLeft: 'auto' }} />
          </button>
        </div>

        {/* Center: Scores */}
        <div style={{ width: 180, flexShrink: 0, display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div style={{ background: c.cardBg, borderRadius: 16, padding: '16px 12px', border: `1px solid ${c.border}`, textAlign: 'center' }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: '#F97316', letterSpacing: '0.08em', marginBottom: 12 }}>PAGE SCORES</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <ScoreRing score={page.scores.concept} label="Concept" size={72} theme={theme} />
              <ScoreRing score={page.scores.spatial} label="Spatial" size={72} theme={theme} />
              <ScoreRing score={page.scores.presentation} label="Presentation" size={72} theme={theme} />
            </div>
          </div>
          <div style={{ background: c.cardBg, borderRadius: 16, padding: '14px 12px', border: `1px solid ${c.border}` }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: c.textMuted, letterSpacing: '0.08em', marginBottom: 10 }}>OVERALL</div>
            <ScoreRing score={(project.scores.concept + project.scores.spatial + project.scores.presentation) / 3} label="Average" size={80} theme={theme} />
          </div>
        </div>

        {/* Right: Feedback + Jury */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
          {/* Tabs */}
          <div style={{ display: 'flex', gap: 4, marginBottom: 12, background: c.isDark ? 'oklch(0.19 0.004 270)' : '#f3f4f6', borderRadius: 10, padding: 4, flexShrink: 0 }}>
            {(['feedback', 'jury'] as const).map(t => (
              <button key={t} onClick={() => setActiveTab(t)} style={{
                flex: 1, padding: '8px', borderRadius: 8, border: 'none', cursor: 'pointer', fontSize: 13, fontWeight: 600, transition: 'all 0.15s',
                background: activeTab === t ? c.cardBg : 'transparent',
                color: activeTab === t ? c.textPrimary : c.textMuted,
                boxShadow: activeTab === t ? '0 1px 4px rgba(0,0,0,0.1)' : 'none',
              }}>
                {t === 'feedback' ? 'AI Feedback' : 'Jury Questions'}
              </button>
            ))}
          </div>

          <div style={{ flex: 1, overflowY: 'auto', paddingRight: 2 }}>
            {activeTab === 'feedback' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                <div style={{ fontSize: 12, color: c.textMuted, fontWeight: 600, letterSpacing: '0.06em', marginBottom: 2 }}>
                  {page.title} · {page.feedback.length} notes
                </div>
                {page.feedback.map(fb => (
                  <div key={fb.n} style={{ background: c.cardBg, borderRadius: 14, border: `1px solid ${c.border}`, overflow: 'hidden' }}>
                    <button
                      onClick={() => setExpandedFeedback(expandedFeedback === fb.n ? null : fb.n)}
                      style={{ width: '100%', padding: '14px 16px', background: 'none', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'flex-start', gap: 10, textAlign: 'left' }}
                    >
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
                <div style={{ fontSize: 12, color: c.textMuted, fontWeight: 600, letterSpacing: '0.06em', marginBottom: 2 }}>
                  Likely questions from your jury
                </div>
                {JURY_Q.map((q, i) => (
                  <div key={i} style={{ background: c.cardBg, borderRadius: 14, padding: '14px 16px', border: `1px solid ${c.border}` }}>
                    <div style={{ display: 'flex', gap: 10 }}>
                      <div style={{ width: 22, height: 22, borderRadius: 8, background: c.isDark ? 'oklch(0.28 0.004 270)' : '#f3f4f6', color: c.textMuted, fontSize: 11, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                        {i + 1}
                      </div>
                      <p style={{ fontSize: 13, color: c.textPrimary, margin: 0, lineHeight: 1.5 }}>{q}</p>
                    </div>
                    <button
                      onClick={() => navigate({ to: '/jury' })}
                      style={{ marginTop: 10, padding: '6px 14px', borderRadius: 100, background: 'transparent', border: `1px solid ${c.border}`, color: c.textMuted, fontSize: 12, cursor: 'pointer' }}
                    >
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
