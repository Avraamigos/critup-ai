import { useState } from 'react'
import { Mic, MicOff, ChevronRight, RotateCcw, ThumbsUp, ThumbsDown } from 'lucide-react'
import { useTheme, useColors } from '@/lib/theme'
import { JURY_QUESTIONS } from '@/lib/mock-data'

const FEEDBACK_POOL = [
  { type: 'good', text: "Strong opening — you stated your concept clearly in the first sentence. Good pacing." },
  { type: 'improve', text: "You used 'um' 3 times. Try pausing instead — silence reads as confidence to a jury." },
  { type: 'good', text: "Excellent reference to the datum issue. You pre-empted a likely jury challenge." },
  { type: 'improve', text: "Your answer was 45 seconds — aim for 30. Edit ruthlessly: one claim, one reason, one example." },
]

type Stage = 'select' | 'ready' | 'answering' | 'result'

export function JuryPage() {
  const { theme } = useTheme()
  const c = useColors(theme)
  const [qIdx, setQIdx] = useState(0)
  const [stage, setStage] = useState<Stage>('select')
  const [recording, setRecording] = useState(false)
  const [timer, setTimer] = useState(0)
  const [intervalId, setIntervalId] = useState<ReturnType<typeof setInterval> | null>(null)

  const question = JURY_QUESTIONS[qIdx]
  const feedback = FEEDBACK_POOL[qIdx % FEEDBACK_POOL.length]

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
    setQIdx(i => (i + 1) % JURY_QUESTIONS.length)
    setStage('select')
    setTimer(0)
  }

  const fmt = (s: number) => `${Math.floor(s / 60).toString().padStart(2, '0')}:${(s % 60).toString().padStart(2, '0')}`

  return (
    <div style={{ padding: '32px 36px', fontFamily: "'Inter',sans-serif" }}>
      <div style={{ marginBottom: 28 }}>
        <h1 style={{ fontSize: 24, fontWeight: 800, letterSpacing: '-0.03em', color: c.textPrimary, margin: '0 0 4px', fontFamily: "-apple-system, BlinkMacSystemFont, 'SF Pro Display', 'Helvetica Neue', 'Inter', sans-serif" }}>
          Jury Practice
        </h1>
        <p style={{ fontSize: 14, color: c.textMuted, margin: 0 }}>Practise answering tough jury questions out loud — get AI feedback on your delivery</p>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20, maxWidth: 900 }}>
        {/* Left: Question bank */}
        <div style={{ background: c.cardBg, borderRadius: 18, border: `1px solid ${c.border}`, overflow: 'hidden' }}>
          <div style={{ padding: '16px 20px', borderBottom: `1px solid ${c.border}` }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: '#F97316', letterSpacing: '0.08em' }}>QUESTION BANK</div>
          </div>
          <div style={{ padding: '8px 0' }}>
            {JURY_QUESTIONS.map((q, i) => (
              <button
                key={i}
                onClick={() => { setQIdx(i); setStage('select') }}
                style={{
                  width: '100%', padding: '12px 20px', background: i === qIdx ? (c.isDark ? 'oklch(0.72 0.18 45 / 0.08)' : '#fff7ed') : 'transparent',
                  border: 'none', cursor: 'pointer', textAlign: 'left', display: 'flex', alignItems: 'flex-start', gap: 10,
                  borderLeft: `3px solid ${i === qIdx ? '#F97316' : 'transparent'}`, transition: 'all 0.15s',
                }}
              >
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

          {/* Recording / result area */}
          {(stage === 'select' || stage === 'ready') && (
            <div style={{ background: c.cardBg, borderRadius: 18, padding: '24px 22px', border: `1px solid ${c.border}`, textAlign: 'center' }}>
              <div style={{ width: 68, height: 68, borderRadius: '50%', background: 'oklch(0.72 0.18 45 / 0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 14px', cursor: 'pointer', transition: 'all 0.2s' }}
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

          {stage === 'answering' && (
            <div style={{ background: c.cardBg, borderRadius: 18, padding: '24px 22px', border: `1.5px solid oklch(0.65 0.18 25)`, textAlign: 'center' }}>
              {/* Animated waves */}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 3, marginBottom: 16, height: 36 }}>
                {[0, 1, 2, 3, 4].map(i => (
                  <div key={i} style={{ width: 4, borderRadius: 2, background: 'oklch(0.65 0.18 25)', animation: `wave-${i} 0.8s ease-in-out infinite`, animationDelay: `${i * 0.1}s` }} />
                ))}
              </div>
              <div style={{ fontSize: 28, fontWeight: 800, fontFamily: 'monospace', color: c.textPrimary, marginBottom: 4 }}>{fmt(timer)}</div>
              <div style={{ fontSize: 12, color: c.textMuted, marginBottom: 20 }}>Recording… speak clearly</div>
              <button onClick={stopRecording} style={{ display: 'inline-flex', alignItems: 'center', gap: 8, padding: '10px 22px', borderRadius: 100, background: 'oklch(0.65 0.18 25)', border: 'none', color: '#fff', fontSize: 14, fontWeight: 600, cursor: 'pointer' }}>
                <MicOff size={15} /> Stop & get feedback
              </button>
            </div>
          )}

          {stage === 'result' && (
            <div style={{ background: c.cardBg, borderRadius: 18, border: `1px solid ${c.border}`, overflow: 'hidden' }}>
              <div style={{ padding: '14px 20px', borderBottom: `1px solid ${c.border}`, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: 12, fontWeight: 700, color: '#F97316', letterSpacing: '0.08em' }}>AI FEEDBACK</span>
                <span style={{ fontSize: 12, color: c.textMuted }}>Duration: {fmt(timer)}</span>
              </div>
              <div style={{ padding: '16px 20px', display: 'flex', flexDirection: 'column', gap: 12 }}>
                <div style={{ display: 'flex', gap: 10, padding: '12px', borderRadius: 10, background: feedback.type === 'good' ? 'oklch(0.72 0.17 145 / 0.08)' : 'oklch(0.72 0.18 45 / 0.08)', border: `1px solid ${feedback.type === 'good' ? 'oklch(0.72 0.17 145 / 0.3)' : 'oklch(0.72 0.18 45 / 0.3)'}` }}>
                  {feedback.type === 'good' ? <ThumbsUp size={14} color="oklch(0.72 0.17 145)" style={{ flexShrink: 0, marginTop: 2 }} /> : <ThumbsDown size={14} color="#F97316" style={{ flexShrink: 0, marginTop: 2 }} />}
                  <p style={{ fontSize: 13, color: c.textPrimary, margin: 0, lineHeight: 1.5 }}>{feedback.text}</p>
                </div>
                {/* Score */}
                <div style={{ display: 'flex', gap: 8 }}>
                  {['Clarity', 'Confidence', 'Content'].map((label, i) => {
                    const score = [7, 8, 7.5][i]
                    return (
                      <div key={label} style={{ flex: 1, background: c.isDark ? 'oklch(0.19 0.004 270)' : '#f8fafc', borderRadius: 10, padding: '8px', textAlign: 'center', border: `1px solid ${c.border}` }}>
                        <div style={{ fontSize: 11, color: c.textMuted, marginBottom: 2 }}>{label}</div>
                        <div style={{ fontSize: 16, fontWeight: 800, color: '#F97316' }}>{score}</div>
                      </div>
                    )
                  })}
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
    </div>
  )
}
