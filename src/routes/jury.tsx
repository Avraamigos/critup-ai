import { useState, useEffect } from 'react'
import { Mic, MicOff, ChevronRight, RotateCcw, ThumbsUp, ThumbsDown, Plus } from 'lucide-react'
import { useTheme, useColors } from '@/lib/theme'
import { useAuth } from '@/lib/auth'
import { supabase } from '@/lib/supabase'
import { useNavigate } from '@tanstack/react-router'

type Stage = 'select' | 'answering' | 'result'

export function JuryPage() {
  const { theme } = useTheme()
  const c = useColors(theme)
  const navigate = useNavigate()
  const { user } = useAuth()
  const FONT = "-apple-system, BlinkMacSystemFont, 'SF Pro Display', 'Helvetica Neue', 'Inter', sans-serif"

  const [questions, setQuestions] = useState<string[]>([])
  const [projectName, setProjectName] = useState<string>('')
  const [loading, setLoading] = useState(true)
  const [qIdx, setQIdx] = useState(0)
  const [stage, setStage] = useState<Stage>('select')
  const [recording, setRecording] = useState(false)
  const [timer, setTimer] = useState(0)
  const [intervalId, setIntervalId] = useState<ReturnType<typeof setInterval> | null>(null)

  // Load jury questions from the user's most recent complete analysis
  useEffect(() => {
    if (!user) return
    const load = async () => {
      setLoading(true)
      const { data } = await supabase
        .from('analyses')
        .select('jury_questions, projects(name)')
        .eq('user_id', user.id)
        .eq('status', 'complete')
        .order('created_at', { ascending: false })
        .limit(1)
        .single()

      if (data?.jury_questions && Array.isArray(data.jury_questions)) {
        setQuestions(data.jury_questions as string[])
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        setProjectName((data as any).projects?.name || '')
      }
      setLoading(false)
    }
    load()
  }, [user])

  const question = questions[qIdx] || ''

  const startRecording = () => {
    setRecording(true)
    setTimer(0)
    const id = setInterval(() => setTimer(t => t + 1), 1000)
    setIntervalId(id)
  }

  const stopRecording = () => {
    setRecording(false)
    if (intervalId) { clearInterval(intervalId); setIntervalId(null) }
    setStage('result')
  }

  const nextQuestion = () => {
    setQIdx(i => (i + 1) % questions.length)
    setStage('select')
    setTimer(0)
  }

  const fmt = (s: number) => `${Math.floor(s / 60).toString().padStart(2, '0')}:${(s % 60).toString().padStart(2, '0')}`

  return (
    <div style={{ padding: '32px 36px', fontFamily: "'Inter',sans-serif" }}>
      <div style={{ marginBottom: 28 }}>
        <h1 style={{ fontSize: 24, fontWeight: 800, letterSpacing: '-0.03em', color: c.textPrimary, margin: '0 0 4px', fontFamily: FONT }}>
          Jury Practice
        </h1>
        <p style={{ fontSize: 14, color: c.textMuted, margin: 0 }}>
          Practise answering tough jury questions out loud
        </p>
      </div>

      {/* Empty state — no questions yet */}
      {!loading && questions.length === 0 && (
        <div style={{ maxWidth: 480, margin: '60px auto 0', textAlign: 'center' }}>
          <div style={{ fontSize: 56, marginBottom: 20 }}>🎙</div>
          <h2 style={{ fontSize: 20, fontWeight: 700, margin: '0 0 10px', color: c.textPrimary, fontFamily: FONT }}>
            No questions yet
          </h2>
          <p style={{ fontSize: 14, color: c.textMuted, lineHeight: 1.6, margin: '0 0 28px' }}>
            Upload your project drawings to get AI-generated jury questions tailored to your specific design.
          </p>
          <button
            onClick={() => navigate({ to: '/projects/new' })}
            style={{
              display: 'inline-flex', alignItems: 'center', gap: 8,
              padding: '11px 28px', borderRadius: 100, background: '#F97316',
              border: 'none', color: '#fff', fontSize: 14, fontWeight: 600,
              cursor: 'pointer', boxShadow: '0 0 20px oklch(0.72 0.18 45 / 0.3)',
            }}>
            <Plus size={16} /> Upload a project
          </button>
        </div>
      )}

      {/* Questions loaded */}
      {!loading && questions.length > 0 && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20, maxWidth: 900 }}>
          {/* Left: Question bank */}
          <div style={{ background: c.cardBg, borderRadius: 18, border: `1px solid ${c.border}`, overflow: 'hidden' }}>
            <div style={{ padding: '16px 20px', borderBottom: `1px solid ${c.border}` }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: '#F97316', letterSpacing: '0.08em' }}>QUESTION BANK</div>
              {projectName && <div style={{ fontSize: 12, color: c.textMuted, marginTop: 2 }}>{projectName}</div>}
            </div>
            <div style={{ padding: '8px 0' }}>
              {questions.map((q, i) => (
                <button
                  key={i}
                  onClick={() => { setQIdx(i); setStage('select') }}
                  style={{
                    width: '100%', padding: '12px 20px',
                    background: i === qIdx ? (c.isDark ? 'oklch(0.72 0.18 45 / 0.08)' : '#fff7ed') : 'transparent',
                    border: 'none', cursor: 'pointer', textAlign: 'left',
                    display: 'flex', alignItems: 'flex-start', gap: 10,
                    borderLeft: `3px solid ${i === qIdx ? '#F97316' : 'transparent'}`,
                    transition: 'all 0.15s',
                  }}>
                  <span style={{ fontSize: 11, fontWeight: 700, color: i === qIdx ? '#F97316' : c.textMuted, minWidth: 18, paddingTop: 1 }}>Q{i + 1}</span>
                  <span style={{ fontSize: 13, color: i === qIdx ? c.textPrimary : c.textMuted, lineHeight: 1.4 }}>{q}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Right: Practice area */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            {/* Question card */}
            <div style={{ background: c.cardBg, borderRadius: 18, padding: '20px 22px', border: `1.5px solid #F97316`, boxShadow: '0 0 30px oklch(0.72 0.18 45 / 0.1)' }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: '#F97316', letterSpacing: '0.08em', marginBottom: 10 }}>QUESTION {qIdx + 1}</div>
              <p style={{ fontSize: 15, fontWeight: 600, color: c.textPrimary, margin: '0 0 16px', lineHeight: 1.5 }}>"{question}"</p>
              <div style={{ fontSize: 12, color: c.textMuted }}>💡 Think about your answer, then hit Record when ready</div>
            </div>

            {/* Record */}
            {stage === 'select' && (
              <div style={{ background: c.cardBg, borderRadius: 18, padding: '24px 22px', border: `1px solid ${c.border}`, textAlign: 'center' }}>
                <div
                  style={{ width: 68, height: 68, borderRadius: '50%', background: 'oklch(0.72 0.18 45 / 0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 14px', cursor: 'pointer', transition: 'all 0.2s' }}
                  onClick={() => { setStage('answering'); startRecording() }}
                  onMouseEnter={e => (e.currentTarget as HTMLDivElement).style.background = 'oklch(0.72 0.18 45 / 0.2)'}
                  onMouseLeave={e => (e.currentTarget as HTMLDivElement).style.background = 'oklch(0.72 0.18 45 / 0.1)'}
                >
                  <Mic size={26} color="#F97316" />
                </div>
                <p style={{ fontSize: 14, fontWeight: 600, color: c.textPrimary, margin: '0 0 4px' }}>Record your answer</p>
                <p style={{ fontSize: 12, color: c.textMuted, margin: 0 }}>Aim for 30–45 seconds</p>
              </div>
            )}

            {/* Answering */}
            {stage === 'answering' && (
              <div style={{ background: c.cardBg, borderRadius: 18, padding: '24px 22px', border: `1.5px solid oklch(0.65 0.18 25)`, textAlign: 'center' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 3, marginBottom: 16, height: 36 }}>
                  {[0, 1, 2, 3, 4].map(i => (
                    <div key={i} style={{ width: 4, borderRadius: 2, background: 'oklch(0.65 0.18 25)', animation: `wave-jury 0.8s ease-in-out infinite`, animationDelay: `${i * 0.1}s` }} />
                  ))}
                </div>
                <style>{`@keyframes wave-jury{0%,100%{height:8px}50%{height:24px}}`}</style>
                <div style={{ fontSize: 28, fontWeight: 800, fontFamily: 'monospace', color: c.textPrimary, marginBottom: 4 }}>{fmt(timer)}</div>
                <div style={{ fontSize: 12, color: c.textMuted, marginBottom: 20 }}>Recording… speak clearly</div>
                <button onClick={stopRecording} style={{ display: 'inline-flex', alignItems: 'center', gap: 8, padding: '10px 22px', borderRadius: 100, background: 'oklch(0.65 0.18 25)', border: 'none', color: '#fff', fontSize: 14, fontWeight: 600, cursor: 'pointer' }}>
                  <MicOff size={15} /> Stop & get feedback
                </button>
              </div>
            )}

            {/* Result */}
            {stage === 'result' && (
              <div style={{ background: c.cardBg, borderRadius: 18, border: `1px solid ${c.border}`, overflow: 'hidden' }}>
                <div style={{ padding: '14px 20px', borderBottom: `1px solid ${c.border}`, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: 12, fontWeight: 700, color: '#F97316', letterSpacing: '0.08em' }}>AI FEEDBACK</span>
                  <span style={{ fontSize: 12, color: c.textMuted }}>Duration: {fmt(timer)}</span>
                </div>
                <div style={{ padding: '16px 20px', display: 'flex', flexDirection: 'column', gap: 12 }}>
                  <div style={{ display: 'flex', gap: 10, padding: '12px', borderRadius: 10, background: 'oklch(0.72 0.17 145 / 0.08)', border: '1px solid oklch(0.72 0.17 145 / 0.3)' }}>
                    <ThumbsUp size={14} color="oklch(0.72 0.17 145)" style={{ flexShrink: 0, marginTop: 2 }} />
                    <p style={{ fontSize: 13, color: c.textPrimary, margin: 0, lineHeight: 1.5 }}>Good structure — you stayed on topic and addressed the question directly.</p>
                  </div>
                  <div style={{ display: 'flex', gap: 10, padding: '12px', borderRadius: 10, background: 'oklch(0.72 0.18 45 / 0.08)', border: '1px solid oklch(0.72 0.18 45 / 0.3)' }}>
                    <ThumbsDown size={14} color="#F97316" style={{ flexShrink: 0, marginTop: 2 }} />
                    <p style={{ fontSize: 13, color: c.textPrimary, margin: 0, lineHeight: 1.5 }}>Try to keep answers under 40 seconds — pause instead of filler words.</p>
                  </div>
                  <div style={{ display: 'flex', gap: 8 }}>
                    {(['Clarity', 'Confidence', 'Content'] as const).map((label, i) => (
                      <div key={label} style={{ flex: 1, background: c.isDark ? 'oklch(0.19 0.004 270)' : '#f8fafc', borderRadius: 10, padding: '8px', textAlign: 'center', border: `1px solid ${c.border}` }}>
                        <div style={{ fontSize: 11, color: c.textMuted, marginBottom: 2 }}>{label}</div>
                        <div style={{ fontSize: 16, fontWeight: 800, color: '#F97316', fontVariantNumeric: 'tabular-nums' }}>{[7, 8, 7.5][i]}</div>
                      </div>
                    ))}
                  </div>
                  <div style={{ display: 'flex', gap: 8, marginTop: 4 }}>
                    <button onClick={nextQuestion} style={{ flex: 1, padding: '10px', borderRadius: 100, background: '#F97316', border: 'none', color: '#fff', fontSize: 13, fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
                      Next question <ChevronRight size={14} />
                    </button>
                    <button onClick={() => setStage('select')} style={{ padding: '10px 16px', borderRadius: 100, background: 'transparent', border: `1px solid ${c.border}`, color: c.textMuted, fontSize: 13, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6 }}>
                      <RotateCcw size={13} /> Retry
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
