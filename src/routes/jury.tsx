import { useState, useEffect, useRef } from 'react'
import { Mic, MicOff, ChevronRight, RotateCcw, Plus, AlertCircle, Loader2 } from 'lucide-react'
import { useTheme, useColors } from '@/lib/theme'
import { useAuth } from '@/lib/auth'
import { supabase } from '@/lib/supabase'
import { useNavigate } from '@tanstack/react-router'

// ─── Types ────────────────────────────────────────────────────────────────────

type Stage = 'select' | 'answering' | 'loading' | 'result'

interface CoachingFeedback {
  whatLanded: string
  theGap: string
  betterFraming: string
  likelyFollowUp: string
}

// ─── Speech recognition setup ─────────────────────────────────────────────────
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition
const speechSupported = !!SpeechRecognition

// ─── Component ───────────────────────────────────────────────────────────────

export function JuryPage() {
  const { theme } = useTheme()
  const c = useColors(theme)
  const navigate = useNavigate()
  const { user } = useAuth()
  const FONT = "-apple-system, BlinkMacSystemFont, 'SF Pro Display', 'Helvetica Neue', 'Inter', sans-serif"

  const [questions,    setQuestions]    = useState<string[]>([])
  const [projectName,  setProjectName]  = useState('')
  const [analysisId,   setAnalysisId]   = useState<string | null>(null)
  const [loading,      setLoading]      = useState(true)
  const [qIdx,         setQIdx]         = useState(0)
  const [stage,        setStage]        = useState<Stage>('select')
  const [timer,        setTimer]        = useState(0)
  const [transcript,   setTranscript]   = useState('')
  const [interimText,  setInterimText]  = useState('')
  const [feedback,     setFeedback]     = useState<CoachingFeedback | null>(null)
  const [feedbackErr,  setFeedbackErr]  = useState<string | null>(null)
  const [micError,     setMicError]     = useState<string | null>(null)

  const recognitionRef = useRef<InstanceType<typeof SpeechRecognition> | null>(null)
  const timerRef       = useRef<ReturnType<typeof setInterval> | null>(null)
  const timerVal       = useRef(0)

  // ── Load jury questions ───────────────────────────────────────────────────
  useEffect(() => {
    if (!user?.id) return
    let cancelled = false
    const load = async () => {
      setLoading(true)
      try {
        // Prefer the analysis that's currently active (from AI chat context)
        const storedId = localStorage.getItem('critup_last_analysis_id')
        let query = supabase
          .from('analyses')
          .select('id, jury_questions, projects(name)')
          .eq('user_id', user.id)
          .eq('status', 'complete')
          .order('created_at', { ascending: false })
          .limit(1)

        if (storedId) {
          // Try active project first
          const { data: active } = await supabase
            .from('analyses')
            .select('id, jury_questions, projects(name)')
            .eq('id', storedId)
            .eq('status', 'complete')
            .single()
          if (active?.jury_questions && Array.isArray(active.jury_questions)) {
            if (!cancelled) {
              setQuestions(active.jury_questions as string[])
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              setProjectName((active as any).projects?.name || '')
              setAnalysisId(active.id)
            }
            setLoading(false)
            return
          }
        }

        // Fall back to most recent
        const { data } = await query.single()
        if (!cancelled && data?.jury_questions && Array.isArray(data.jury_questions)) {
          setQuestions(data.jury_questions as string[])
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          setProjectName((data as any).projects?.name || '')
          setAnalysisId(data.id)
        }
      } catch { /* show empty state */ }
      finally { if (!cancelled) setLoading(false) }
    }
    load()
    return () => { cancelled = true }
  }, [user?.id])

  const question = questions[qIdx] || ''
  const fmt = (s: number) => `${Math.floor(s / 60).toString().padStart(2, '0')}:${(s % 60).toString().padStart(2, '0')}`

  // ── Start recording ───────────────────────────────────────────────────────
  const startRecording = () => {
    if (!speechSupported) return
    setMicError(null)
    setTranscript('')
    setInterimText('')
    setTimer(0)
    timerVal.current = 0

    const rec = new SpeechRecognition()
    rec.continuous      = true
    rec.interimResults  = true
    rec.lang            = 'en-US'

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    rec.onresult = (e: any) => {
      let final = ''
      let interim = ''
      for (let i = 0; i < e.results.length; i++) {
        if (e.results[i].isFinal) final  += e.results[i][0].transcript + ' '
        else                       interim = e.results[i][0].transcript
      }
      setTranscript(final)
      setInterimText(interim)
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    rec.onerror = (e: any) => {
      if (e.error === 'not-allowed') setMicError('Microphone access was denied. Please allow mic access in your browser and try again.')
      else if (e.error === 'no-speech') { /* ignore, just silence */ }
      else setMicError(`Recording error: ${e.error}`)
    }

    rec.start()
    recognitionRef.current = rec
    setStage('answering')

    timerRef.current = setInterval(() => {
      timerVal.current += 1
      setTimer(timerVal.current)
    }, 1000)
  }

  // ── Stop recording + get feedback ─────────────────────────────────────────
  const stopRecording = async () => {
    recognitionRef.current?.stop()
    recognitionRef.current = null
    if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null }

    const finalTranscript = transcript.trim()
    if (!finalTranscript) {
      setMicError("No speech detected. Make sure your microphone is working and speak clearly.")
      setStage('select')
      return
    }

    setStage('loading')
    setFeedback(null)
    setFeedbackErr(null)

    try {
      const res = await fetch('/api/jury-feedback', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          transcript: finalTranscript,
          question,
          analysisId,
          duration: timerVal.current,
        }),
      })
      if (!res.ok) throw new Error(`API error ${res.status}`)
      const data: CoachingFeedback = await res.json()
      setFeedback(data)
      setStage('result')
    } catch (err) {
      setFeedbackErr('Could not get feedback right now. Please try again.')
      setStage('result')
    }
  }

  // ── Next question ─────────────────────────────────────────────────────────
  const nextQuestion = () => {
    setQIdx(i => (i + 1) % questions.length)
    setStage('select')
    setTranscript('')
    setInterimText('')
    setTimer(0)
    setFeedback(null)
    setFeedbackErr(null)
    setMicError(null)
  }

  const retry = () => {
    setStage('select')
    setTranscript('')
    setInterimText('')
    setTimer(0)
    setFeedback(null)
    setFeedbackErr(null)
    setMicError(null)
  }

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div style={{ padding: '28px 32px', fontFamily: "'Inter',sans-serif", height: 'calc(100vh - 54px)', overflowY: 'auto', boxSizing: 'border-box' }}>
      <style>{`
        @keyframes wave-jury { 0%,100%{height:6px} 50%{height:22px} }
        @keyframes fade-up { from{opacity:0;transform:translateY(8px)} to{opacity:1;transform:translateY(0)} }
        @keyframes spin { to{transform:rotate(360deg)} }
      `}</style>

      {/* Header */}
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ fontSize: 22, fontWeight: 800, letterSpacing: '-0.03em', color: c.textPrimary, margin: '0 0 4px', fontFamily: FONT }}>Jury Practice</h1>
        <p style={{ fontSize: 13, color: c.textMuted, margin: 0 }}>Answer questions out loud — Crit coaches you on how to frame your argument</p>
      </div>

      {/* Speech not supported */}
      {!speechSupported && (
        <div style={{ display: 'flex', gap: 10, padding: '14px 16px', borderRadius: 12, background: 'oklch(0.65 0.18 25/0.08)', border: '1px solid oklch(0.65 0.18 25/0.3)', marginBottom: 20 }}>
          <AlertCircle size={15} color="oklch(0.65 0.18 25)" style={{ flexShrink: 0, marginTop: 1 }} />
          <p style={{ fontSize: 13, color: 'oklch(0.65 0.18 25)', margin: 0 }}>Voice recording requires Chrome or Safari. Please open this page in Chrome for the best experience.</p>
        </div>
      )}

      {/* Mic error */}
      {micError && (
        <div style={{ display: 'flex', gap: 10, padding: '12px 14px', borderRadius: 10, background: 'oklch(0.65 0.18 25/0.08)', border: '1px solid oklch(0.65 0.18 25/0.3)', marginBottom: 16 }}>
          <AlertCircle size={14} color="oklch(0.65 0.18 25)" style={{ flexShrink: 0, marginTop: 1 }} />
          <p style={{ fontSize: 13, color: 'oklch(0.65 0.18 25)', margin: 0 }}>{micError}</p>
        </div>
      )}

      {/* Empty state */}
      {!loading && questions.length === 0 && (
        <div style={{ maxWidth: 440, margin: '60px auto', textAlign: 'center' }}>
          <div style={{ fontSize: 52, marginBottom: 18 }}>🎙</div>
          <h2 style={{ fontSize: 18, fontWeight: 700, margin: '0 0 10px', color: c.textPrimary, fontFamily: FONT }}>No questions yet</h2>
          <p style={{ fontSize: 14, color: c.textMuted, lineHeight: 1.6, margin: '0 0 24px' }}>Upload your drawings to get jury questions tailored to your specific project.</p>
          <button onClick={() => navigate({ to: '/projects/new' })} style={{ display: 'inline-flex', alignItems: 'center', gap: 8, padding: '11px 28px', borderRadius: 100, background: '#F97316', border: 'none', color: '#fff', fontSize: 14, fontWeight: 600, cursor: 'pointer', boxShadow: '0 0 20px oklch(0.72 0.18 45/0.3)' }}>
            <Plus size={16} /> Upload a project
          </button>
        </div>
      )}

      {/* Main layout */}
      {!loading && questions.length > 0 && (
        <div style={{ display: 'grid', gridTemplateColumns: '280px 1fr', gap: 18, maxWidth: 960, height: 'calc(100% - 80px)' }}>

          {/* Left — question bank */}
          <div style={{ background: c.cardBg, borderRadius: 18, border: `1px solid ${c.border}`, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
            <div style={{ padding: '14px 18px', borderBottom: `1px solid ${c.border}`, flexShrink: 0 }}>
              <div style={{ fontSize: 10, fontWeight: 700, color: '#F97316', letterSpacing: '0.1em', marginBottom: 2 }}>JURY QUESTIONS</div>
              {projectName && <div style={{ fontSize: 11, color: c.textMuted, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{projectName}</div>}
            </div>
            <div style={{ overflowY: 'auto', flex: 1 }}>
              {questions.map((q, i) => (
                <button key={i} onClick={() => { setQIdx(i); retry() }}
                  style={{ width: '100%', padding: '11px 16px', background: i === qIdx ? (c.isDark ? 'oklch(0.72 0.18 45/0.08)' : '#fff7ed') : 'transparent', border: 'none', cursor: 'pointer', textAlign: 'left', display: 'flex', alignItems: 'flex-start', gap: 8, borderLeft: `3px solid ${i === qIdx ? '#F97316' : 'transparent'}`, transition: 'all 0.15s' }}>
                  <span style={{ fontSize: 10, fontWeight: 800, color: i === qIdx ? '#F97316' : c.textMuted, minWidth: 16, paddingTop: 2, flexShrink: 0 }}>Q{i + 1}</span>
                  <span style={{ fontSize: 12, color: i === qIdx ? c.textPrimary : c.textMuted, lineHeight: 1.45 }}>{q}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Right — practice area */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14, overflow: 'hidden' }}>

            {/* Question card */}
            <div style={{ background: c.cardBg, borderRadius: 16, padding: '18px 20px', border: `1.5px solid #F97316`, boxShadow: '0 0 24px oklch(0.72 0.18 45/0.1)', flexShrink: 0 }}>
              <div style={{ fontSize: 10, fontWeight: 700, color: '#F97316', letterSpacing: '0.1em', marginBottom: 8 }}>QUESTION {qIdx + 1} OF {questions.length}</div>
              <p style={{ fontSize: 15, fontWeight: 600, color: c.textPrimary, margin: '0 0 10px', lineHeight: 1.5 }}>"{question}"</p>
              <p style={{ fontSize: 12, color: c.textMuted, margin: 0 }}>💡 Think for a moment, then record. Aim for 30–60 seconds.</p>
            </div>

            {/* Record / Answering / Loading / Result */}
            <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 14 }}>

              {/* SELECT — ready to record */}
              {stage === 'select' && (
                <div style={{ background: c.cardBg, borderRadius: 16, padding: '28px 20px', border: `1px solid ${c.border}`, textAlign: 'center', animation: 'fade-up 0.3s ease-out' }}>
                  <div onClick={speechSupported ? () => startRecording() : undefined}
                    style={{ width: 72, height: 72, borderRadius: '50%', background: speechSupported ? 'oklch(0.72 0.18 45/0.1)' : c.cardBg, display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 14px', cursor: speechSupported ? 'pointer' : 'not-allowed', transition: 'all 0.2s', border: `2px solid ${speechSupported ? 'oklch(0.72 0.18 45/0.3)' : c.border}` }}
                    onMouseEnter={e => { if (speechSupported) (e.currentTarget as HTMLDivElement).style.background = 'oklch(0.72 0.18 45/0.2)' }}
                    onMouseLeave={e => { if (speechSupported) (e.currentTarget as HTMLDivElement).style.background = 'oklch(0.72 0.18 45/0.1)' }}
                  >
                    <Mic size={28} color={speechSupported ? '#F97316' : c.textMuted} />
                  </div>
                  <p style={{ fontSize: 14, fontWeight: 600, color: c.textPrimary, margin: '0 0 4px' }}>
                    {speechSupported ? 'Tap to record your answer' : 'Voice not supported in this browser'}
                  </p>
                  <p style={{ fontSize: 12, color: c.textMuted, margin: 0 }}>
                    {speechSupported ? 'Your answer will be transcribed live as you speak' : 'Open in Chrome or Safari'}
                  </p>
                </div>
              )}

              {/* ANSWERING — live transcript */}
              {stage === 'answering' && (
                <div style={{ background: c.cardBg, borderRadius: 16, border: `1.5px solid oklch(0.65 0.18 25)`, overflow: 'hidden', animation: 'fade-up 0.3s ease-out', flexShrink: 0 }}>
                  {/* Recording header */}
                  <div style={{ padding: '14px 18px', borderBottom: `1px solid ${c.border}`, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <div style={{ width: 8, height: 8, borderRadius: '50%', background: 'oklch(0.65 0.18 25)', animation: 'wave-jury 1s ease-in-out infinite' }} />
                      <span style={{ fontSize: 12, fontWeight: 700, color: 'oklch(0.65 0.18 25)', letterSpacing: '0.06em' }}>RECORDING</span>
                    </div>
                    <span style={{ fontSize: 16, fontWeight: 800, fontFamily: 'monospace', color: c.textPrimary }}>{fmt(timer)}</span>
                  </div>

                  {/* Live waveform bars */}
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 3, padding: '16px 18px 12px', height: 48 }}>
                    {[0,1,2,3,4,5,6].map(i => (
                      <div key={i} style={{ width: 4, borderRadius: 2, background: 'oklch(0.65 0.18 25)', animation: `wave-jury ${0.6 + i * 0.08}s ease-in-out infinite`, animationDelay: `${i * 0.07}s` }} />
                    ))}
                  </div>

                  {/* Live transcript */}
                  <div style={{ padding: '0 18px 16px', minHeight: 60 }}>
                    <p style={{ fontSize: 13, color: c.textPrimary, lineHeight: 1.6, margin: 0 }}>
                      {transcript || <span style={{ color: c.textMuted, fontStyle: 'italic' }}>Listening…</span>}
                      {interimText && <span style={{ color: c.textMuted }}> {interimText}</span>}
                    </p>
                  </div>

                  {/* Stop button */}
                  <div style={{ padding: '0 18px 18px', display: 'flex', justifyContent: 'center' }}>
                    <button onClick={stopRecording} style={{ display: 'inline-flex', alignItems: 'center', gap: 8, padding: '10px 28px', borderRadius: 100, background: 'oklch(0.65 0.18 25)', border: 'none', color: '#fff', fontSize: 14, fontWeight: 600, cursor: 'pointer' }}>
                      <MicOff size={15} /> Done — get coaching
                    </button>
                  </div>
                </div>
              )}

              {/* LOADING */}
              {stage === 'loading' && (
                <div style={{ background: c.cardBg, borderRadius: 16, padding: '40px 20px', border: `1px solid ${c.border}`, textAlign: 'center', animation: 'fade-up 0.3s ease-out' }}>
                  <Loader2 size={28} color="#F97316" style={{ animation: 'spin 1s linear infinite', marginBottom: 14 }} />
                  <p style={{ fontSize: 14, fontWeight: 600, color: c.textPrimary, margin: '0 0 4px' }}>Crit is reading your answer…</p>
                  <p style={{ fontSize: 12, color: c.textMuted, margin: 0 }}>Analysing how to frame it better</p>
                </div>
              )}

              {/* RESULT — coaching feedback */}
              {stage === 'result' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 12, animation: 'fade-up 0.4s ease-out' }}>

                  {feedbackErr && (
                    <div style={{ padding: '14px 16px', borderRadius: 12, background: 'oklch(0.65 0.18 25/0.08)', border: '1px solid oklch(0.65 0.18 25/0.3)', fontSize: 13, color: 'oklch(0.65 0.18 25)' }}>
                      {feedbackErr}
                    </div>
                  )}

                  {/* What you said */}
                  {transcript && (
                    <div style={{ background: c.cardBg, borderRadius: 14, padding: '14px 16px', border: `1px solid ${c.border}` }}>
                      <div style={{ fontSize: 10, fontWeight: 700, color: c.textMuted, letterSpacing: '0.1em', marginBottom: 8 }}>YOUR ANSWER</div>
                      <p style={{ fontSize: 13, color: c.textMuted, margin: '0 0 4px', lineHeight: 1.6, fontStyle: 'italic' }}>"{transcript}"</p>
                      <div style={{ fontSize: 11, color: c.textMuted }}>{fmt(timer)} spoken</div>
                    </div>
                  )}

                  {feedback && (
                    <>
                      {/* What landed */}
                      <div style={{ background: c.isDark ? 'oklch(0.72 0.17 145/0.06)' : 'oklch(0.96 0.02 145)', borderRadius: 14, padding: '16px', border: '1px solid oklch(0.72 0.17 145/0.35)' }}>
                        <div style={{ fontSize: 10, fontWeight: 700, color: 'oklch(0.55 0.17 145)', letterSpacing: '0.1em', marginBottom: 8 }}>✓ WHAT LANDED</div>
                        <p style={{ fontSize: 13, color: c.textPrimary, margin: 0, lineHeight: 1.65 }}>{feedback.whatLanded}</p>
                      </div>

                      {/* The gap */}
                      <div style={{ background: c.isDark ? 'oklch(0.72 0.18 45/0.06)' : 'oklch(0.97 0.02 45)', borderRadius: 14, padding: '16px', border: '1px solid oklch(0.72 0.18 45/0.3)' }}>
                        <div style={{ fontSize: 10, fontWeight: 700, color: '#F97316', letterSpacing: '0.1em', marginBottom: 8 }}>↗ THE GAP</div>
                        <p style={{ fontSize: 13, color: c.textPrimary, margin: 0, lineHeight: 1.65 }}>{feedback.theGap}</p>
                      </div>

                      {/* Better framing — the main coaching block */}
                      <div style={{ background: c.cardBg, borderRadius: 14, padding: '16px', border: `1.5px solid #F97316`, boxShadow: '0 0 20px oklch(0.72 0.18 45/0.08)' }}>
                        <div style={{ fontSize: 10, fontWeight: 700, color: '#F97316', letterSpacing: '0.1em', marginBottom: 10 }}>💬 HOW TO FRAME IT</div>
                        <p style={{ fontSize: 13, color: c.textPrimary, margin: 0, lineHeight: 1.75 }}>{feedback.betterFraming}</p>
                      </div>

                      {/* Likely follow-up */}
                      <div style={{ background: c.cardBg, borderRadius: 14, padding: '14px 16px', border: `1px solid ${c.border}`, display: 'flex', gap: 10, alignItems: 'flex-start' }}>
                        <span style={{ fontSize: 16, flexShrink: 0 }}>🎯</span>
                        <div>
                          <div style={{ fontSize: 10, fontWeight: 700, color: c.textMuted, letterSpacing: '0.1em', marginBottom: 6 }}>JURY WILL FOLLOW UP WITH</div>
                          <p style={{ fontSize: 13, color: c.textPrimary, margin: 0, lineHeight: 1.55, fontStyle: 'italic' }}>"{feedback.likelyFollowUp}"</p>
                        </div>
                      </div>
                    </>
                  )}

                  {/* Actions */}
                  <div style={{ display: 'flex', gap: 10, paddingBottom: 8 }}>
                    <button onClick={nextQuestion} style={{ flex: 1, padding: '11px', borderRadius: 100, background: '#F97316', border: 'none', color: '#fff', fontSize: 13, fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, boxShadow: '0 0 14px oklch(0.72 0.18 45/0.3)' }}>
                      Next question <ChevronRight size={14} />
                    </button>
                    <button onClick={retry} style={{ padding: '11px 18px', borderRadius: 100, background: 'transparent', border: `1px solid ${c.border}`, color: c.textMuted, fontSize: 13, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6 }}>
                      <RotateCcw size={13} /> Try again
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
