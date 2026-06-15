import { useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { Plus, Loader2, Sparkles, RefreshCw, Lock, HelpCircle, MessageSquare, Mic, Lightbulb } from 'lucide-react'
import { useIsMobile } from '@/lib/useIsMobile'
import { useTheme, useColors } from '@/lib/theme'
import { useAuth } from '@/lib/auth'
import { supabase } from '@/lib/supabase'
import { useNavigate } from '@tanstack/react-router'
import type { JuryQA, JuryScriptSlide, ScriptLanguageLevel } from '@/lib/database.types'

// ─── Component ───────────────────────────────────────────────────────────────

const LEVELS: ScriptLanguageLevel[] = ['simple', 'natural', 'academic']

export function JuryPage() {
  const { t } = useTranslation()
  const isMobile = useIsMobile()
  const { theme } = useTheme()
  const c = useColors(theme)
  const navigate = useNavigate()
  const { user, profile } = useAuth()
  const FONT = "-apple-system, BlinkMacSystemFont, 'SF Pro Display', 'Helvetica Neue', 'Inter', sans-serif"

  const isPro = !!profile && profile.plan !== 'free'

  const [loading,     setLoading]     = useState(true)
  const [analysisId,  setAnalysisId]  = useState<string | null>(null)
  const [projectName, setProjectName] = useState('')
  const [qa,          setQa]          = useState<JuryQA[]>([])

  const [level,      setLevel]      = useState<ScriptLanguageLevel>('natural')
  const [slides,     setSlides]     = useState<JuryScriptSlide[]>([])
  const [scriptBusy, setScriptBusy] = useState(false)
  const [scriptErr,  setScriptErr]  = useState<string | null>(null)

  // ── Load the most recent (or active) completed analysis ────────────────────
  useEffect(() => {
    if (!user?.id) return
    let cancelled = false
    const load = async () => {
      setLoading(true)
      try {
        const apply = (row: { id: string; jury_qa: unknown; jury_questions: unknown; projects?: { name?: string } | null }) => {
          if (cancelled) return
          // Prefer the bundled Q&A; fall back to the older plain question list (answer-less) for legacy analyses.
          const pairs: JuryQA[] = Array.isArray(row.jury_qa) && row.jury_qa.length
            ? (row.jury_qa as JuryQA[])
            : Array.isArray(row.jury_questions)
              ? (row.jury_questions as string[]).map(q => ({ question: q, answer: '' }))
              : []
          setQa(pairs)
          setProjectName(row.projects?.name || '')
          setAnalysisId(row.id)
        }

        const storedId = localStorage.getItem('critup_last_analysis_id')
        if (storedId) {
          const { data: active } = await supabase
            .from('analyses')
            .select('id, jury_qa, jury_questions, projects(name)')
            .eq('id', storedId)
            .eq('status', 'complete')
            .maybeSingle()
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          if (active) { apply(active as any); setLoading(false); return }
        }

        const { data } = await supabase
          .from('analyses')
          .select('id, jury_qa, jury_questions, projects(name)')
          .eq('user_id', user.id)
          .eq('status', 'complete')
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle()
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        if (data) apply(data as any)
      } catch { /* empty state */ }
      finally { if (!cancelled) setLoading(false) }
    }
    load()
    return () => { cancelled = true }
  }, [user?.id])

  // ── Load cached script for the current analysis + level (no charge) ────────
  useEffect(() => {
    if (!analysisId || !isPro) { setSlides([]); return }
    let cancelled = false
    setScriptErr(null)
    const loadCached = async () => {
      const { data } = await supabase
        .from('jury_scripts')
        .select('slides')
        .eq('analysis_id', analysisId)
        .eq('language_level', level)
        .maybeSingle()
      if (cancelled) return
      const s = (data as { slides?: unknown } | null)?.slides
      setSlides(Array.isArray(s) ? (s as JuryScriptSlide[]) : [])
    }
    loadCached()
    return () => { cancelled = true }
  }, [analysisId, level, isPro])

  // ── Generate (or regenerate) the script ────────────────────────────────────
  // The Claude call re-reads the whole PDF and can take 60-90s. Rather than rely
  // on a single long-held HTTP response (which a proxy/timeout or a page reload can
  // drop — leaving the user with a dead spinner), we fire the request AND poll the
  // jury_scripts cache. Whichever resolves first wins, and because the server caches
  // the result, a reload mid-generation simply picks it up. Either path is accepted.
  const generate = async (regenerate = false) => {
    if (!analysisId) return
    setScriptBusy(true)
    setScriptErr(null)

    const startedAt = Date.now()
    const MAX_WAIT = 290_000   // the server function may run up to 300s; out-wait it
    let settled = false

    // Baseline updated_at so a regenerate waits for a genuinely NEW row, not the old one.
    let baseline: string | null = null
    if (regenerate) {
      const { data } = await supabase
        .from('jury_scripts')
        .select('updated_at')
        .eq('analysis_id', analysisId)
        .eq('language_level', level)
        .maybeSingle()
      baseline = (data as { updated_at?: string } | null)?.updated_at ?? null
    }

    const finish = (slidesData: JuryScriptSlide[]) => {
      if (settled) return
      settled = true
      setSlides(slidesData)
      setScriptBusy(false)
    }
    const fail = (msg: string) => {
      if (settled) return
      settled = true
      setScriptBusy(false)
      setScriptErr(msg)
    }

    // Poll the cache as a safety net / reload-proof path.
    const poll = async () => {
      while (!settled && Date.now() - startedAt < MAX_WAIT) {
        await new Promise(r => setTimeout(r, 4000))
        if (settled) return
        const { data } = await supabase
          .from('jury_scripts')
          .select('slides, updated_at')
          .eq('analysis_id', analysisId)
          .eq('language_level', level)
          .maybeSingle()
        const row = data as { slides?: unknown; updated_at?: string } | null
        const s = row?.slides
        if (Array.isArray(s) && s.length && row?.updated_at !== baseline) {
          finish(s as JuryScriptSlide[])
          return
        }
      }
      if (!settled) fail(t('jury.scriptTimeout'))
    }
    poll()

    // Fire the request. If it returns cleanly, use it; if it drops, the poller covers us.
    try {
      const res = await fetch('/api/jury-script', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ analysisId, languageLevel: level, regenerate }),
      })
      const data = await res.json().catch(() => null)
      if (settled) return
      if (res.ok) {
        if (Array.isArray(data?.slides) && data.slides.length) finish(data.slides as JuryScriptSlide[])
        return
      }
      // Explicit business error (paywall, rate limit, no-slides) carries a message → show it.
      // A gateway timeout (504, no JSON body) means the function may still be finishing —
      // don't fail; let the poller pick up the cached result.
      if (data?.message) fail(data.message)
    } catch {
      // HTTP dropped mid-flight — leave it to the poller.
    }
  }

  // ── Loading ─────────────────────────────────────────────────────────────────
  if (loading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: 'calc(100vh - 54px)' }}>
        <Loader2 size={26} color="#F97316" style={{ animation: 'spin 1s linear infinite' }} />
        <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
      </div>
    )
  }

  // ── Empty state — no project uploaded ────────────────────────────────────────
  if (!analysisId || qa.length === 0) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: 'calc(100vh - 54px)', padding: '0 24px', fontFamily: FONT }}>
        <div style={{ maxWidth: 440, textAlign: 'center' }}>
          <div style={{ width: 64, height: 64, borderRadius: '50%', background: 'oklch(0.72 0.18 45/0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 18px' }}>
            <HelpCircle size={28} color="#F97316" strokeWidth={1.7} />
          </div>
          <h2 style={{ fontSize: 20, fontWeight: 800, color: c.textPrimary, margin: '0 0 10px', letterSpacing: '-0.02em' }}>{t('jury.noProjectTitle')}</h2>
          <p style={{ fontSize: 14, color: c.textMuted, lineHeight: 1.6, margin: '0 0 24px' }}>{t('jury.noProjectBody')}</p>
          <button onClick={() => navigate({ to: '/projects/new' })} style={{ display: 'inline-flex', alignItems: 'center', gap: 8, padding: '11px 28px', borderRadius: 100, background: '#F97316', border: 'none', color: '#fff', fontSize: 14, fontWeight: 600, cursor: 'pointer', boxShadow: '0 0 20px oklch(0.72 0.18 45/0.3)' }}>
            <Plus size={16} /> {t('jury.uploadProject')}
          </button>
        </div>
      </div>
    )
  }

  // ── Main ──────────────────────────────────────────────────────────────────
  return (
    <div style={{ padding: isMobile ? '16px 14px 40px' : '24px 28px 48px', fontFamily: FONT, height: 'calc(100vh - 54px)', overflowY: 'auto', boxSizing: 'border-box' }}>
      <style>{`
        @keyframes spin { to { transform: rotate(360deg) } }
        @keyframes fade-up { from { opacity:0; transform:translateY(8px) } to { opacity:1; transform:translateY(0) } }
      `}</style>

      <div style={{ maxWidth: 760, margin: '0 auto' }}>
        {/* Header */}
        <div style={{ marginBottom: 24, display: 'flex', alignItems: 'flex-start', gap: 14 }}>
          <div style={{ width: 46, height: 46, borderRadius: 14, background: 'linear-gradient(135deg, #F97316, oklch(0.6 0.21 30))', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, boxShadow: '0 6px 18px oklch(0.72 0.18 45/0.35)' }}>
            <Mic size={22} color="#fff" strokeWidth={2} />
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
              <h1 style={{ fontSize: 22, fontWeight: 800, letterSpacing: '-0.03em', color: c.textPrimary, margin: 0 }}>{t('jury.title')}</h1>
              <span style={{ fontSize: 11, fontWeight: 700, color: '#F97316', background: 'oklch(0.72 0.18 45/0.12)', padding: '3px 10px', borderRadius: 100 }}>{qa.length} {t('jury.questionCount')}</span>
            </div>
            <p style={{ fontSize: 13, color: c.textMuted, margin: '4px 0 0' }}>{t('jury.subtitle')}</p>
            {projectName && <p style={{ fontSize: 12, color: '#F97316', fontWeight: 600, margin: '6px 0 0' }}>{t('jury.forProject', { name: projectName })}</p>}
          </div>
        </div>

        {/* ── Q&A list ── */}
        <div style={{ fontSize: 11, fontWeight: 700, color: c.textMuted, letterSpacing: '0.1em', margin: '0 0 8px' }}>{t('jury.questionsHeading')}</div>
        <button onClick={() => navigate({ to: '/assistant' })}
          style={{ display: 'inline-flex', alignItems: 'center', gap: 7, padding: '8px 14px', borderRadius: 10, background: c.isDark ? 'oklch(0.72 0.18 45/0.08)' : '#fff7ed', border: `1px solid ${c.isDark ? 'oklch(0.72 0.18 45/0.25)' : '#fed7aa'}`, cursor: 'pointer', marginBottom: 14 }}>
          <MessageSquare size={14} color="#F97316" />
          <span style={{ fontSize: 12.5, color: c.textPrimary, fontWeight: 500, textAlign: 'left' }}>{t('jury.chatHint')}</span>
        </button>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginBottom: 36 }}>
          {qa.map((pair, i) => (
            <div key={i} style={{ background: c.cardBg, borderRadius: 14, border: `1px solid ${c.border}`, padding: '16px 18px' }}>
              <div style={{ display: 'flex', gap: 11, alignItems: 'flex-start', marginBottom: pair.answer ? 11 : 0 }}>
                <span style={{ width: 24, height: 24, borderRadius: 8, background: 'oklch(0.72 0.18 45/0.12)', color: '#F97316', fontSize: 11, fontWeight: 800, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, marginTop: 1 }}>{i + 1}</span>
                <p style={{ fontSize: 14, fontWeight: 600, color: c.textPrimary, margin: 0, lineHeight: 1.5, paddingTop: 2 }}>{pair.question}</p>
              </div>
              {pair.answer && (
                <div style={{ marginLeft: 35, paddingLeft: 14, borderLeft: `2px solid ${c.isDark ? 'oklch(0.72 0.18 45/0.35)' : '#fed7aa'}` }}>
                  <div style={{ fontSize: 9, fontWeight: 700, color: c.textMuted, letterSpacing: '0.1em', marginBottom: 5 }}>{t('jury.suggestedAnswer')}</div>
                  <p style={{ fontSize: 13, color: c.textPrimary, margin: 0, lineHeight: 1.65 }}>{pair.answer}</p>
                </div>
              )}
            </div>
          ))}
        </div>

        {/* ── Presentation script ── */}
        <div style={{ fontSize: 11, fontWeight: 700, color: c.textMuted, letterSpacing: '0.1em', margin: '0 0 6px' }}>{t('jury.scriptHeading')}</div>
        <p style={{ fontSize: 13, color: c.textMuted, margin: '0 0 16px', lineHeight: 1.55 }}>{t('jury.scriptIntro')}</p>

        {!isPro ? (
          /* Pro paywall */
          <div style={{ background: c.cardBg, borderRadius: 16, border: `1px solid ${c.border}`, padding: '28px 24px', textAlign: 'center' }}>
            <div style={{ width: 52, height: 52, borderRadius: '50%', background: 'oklch(0.72 0.18 45/0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 14px' }}>
              <Lock size={22} color="#F97316" />
            </div>
            <h3 style={{ fontSize: 17, fontWeight: 800, color: c.textPrimary, margin: '0 0 8px' }}>{t('jury.scriptProTitle')}</h3>
            <p style={{ fontSize: 13, color: c.textMuted, lineHeight: 1.6, margin: '0 auto 20px', maxWidth: 400 }}>{t('jury.scriptProBody')}</p>
            <a href="/pricing" style={{ display: 'inline-block', padding: '11px 28px', borderRadius: 100, background: '#F97316', color: '#fff', fontSize: 14, fontWeight: 700, textDecoration: 'none', boxShadow: '0 4px 20px oklch(0.72 0.18 45/0.35)' }}>
              {t('jury.upgradeToPro')}
            </a>
            <div style={{ marginTop: 10, fontSize: 12, color: c.textMuted }}>{t('jury.priceNote')}</div>
          </div>
        ) : (
          <>
            {/* Language level toggle */}
            <div style={{ marginBottom: 16 }}>
              <div style={{ fontSize: 11, fontWeight: 600, color: c.textMuted, marginBottom: 8 }}>{t('jury.levelLabel')}</div>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                {LEVELS.map(lv => {
                  const active = lv === level
                  return (
                    <button key={lv} onClick={() => setLevel(lv)} disabled={scriptBusy}
                      style={{
                        flex: isMobile ? '1 1 100%' : '1', minWidth: isMobile ? 0 : 150, textAlign: 'left',
                        padding: '10px 14px', borderRadius: 12, cursor: scriptBusy ? 'default' : 'pointer',
                        background: active ? (c.isDark ? 'oklch(0.72 0.18 45/0.1)' : '#fff7ed') : c.cardBg,
                        border: `1.5px solid ${active ? '#F97316' : c.border}`, transition: 'all 0.15s',
                      }}>
                      <div style={{ fontSize: 13, fontWeight: 700, color: active ? '#F97316' : c.textPrimary }}>{t(`jury.level${lv[0].toUpperCase()}${lv.slice(1)}` as const)}</div>
                      <div style={{ fontSize: 11, color: c.textMuted, marginTop: 2 }}>{t(`jury.level${lv[0].toUpperCase()}${lv.slice(1)}Hint` as const)}</div>
                    </button>
                  )
                })}
              </div>
            </div>

            {scriptErr && (
              <div style={{ padding: '12px 14px', borderRadius: 10, background: 'oklch(0.65 0.18 25/0.08)', border: '1px solid oklch(0.65 0.18 25/0.3)', fontSize: 13, color: 'oklch(0.65 0.18 25)', marginBottom: 14 }}>
                {scriptErr}
              </div>
            )}

            {/* Busy */}
            {scriptBusy && (
              <div style={{ background: c.cardBg, borderRadius: 16, padding: '40px 20px', border: `1px solid ${c.border}`, textAlign: 'center' }}>
                <Loader2 size={26} color="#F97316" style={{ animation: 'spin 1s linear infinite', marginBottom: 12 }} />
                <p style={{ fontSize: 14, fontWeight: 600, color: c.textPrimary, margin: '0 0 4px' }}>{t('jury.generating')}</p>
                <p style={{ fontSize: 12, color: c.textMuted, margin: 0 }}>{t('jury.generatingHint')}</p>
              </div>
            )}

            {/* Empty → generate button */}
            {!scriptBusy && slides.length === 0 && (
              <button onClick={() => generate(false)} style={{ display: 'inline-flex', alignItems: 'center', gap: 8, padding: '12px 28px', borderRadius: 100, background: '#F97316', border: 'none', color: '#fff', fontSize: 14, fontWeight: 700, cursor: 'pointer', boxShadow: '0 4px 20px oklch(0.72 0.18 45/0.3)' }}>
                <Sparkles size={16} /> {t('jury.generateScript')}
              </button>
            )}

            {/* Script slides */}
            {!scriptBusy && slides.length > 0 && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 14, animation: 'fade-up 0.4s ease-out' }}>
                {slides.map((s, i) => (
                  <div key={i} style={{ background: c.cardBg, borderRadius: 16, border: `1px solid ${c.border}`, overflow: 'hidden' }}>
                    <div style={{ padding: '14px 18px', borderBottom: `1px solid ${c.border}` }}>
                      <div style={{ fontSize: 10, fontWeight: 700, color: '#F97316', letterSpacing: '0.1em', marginBottom: 3 }}>{t('jury.slideLabel', { n: i + 1 })}</div>
                      <div style={{ fontSize: 14, fontWeight: 700, color: c.textPrimary }}>{s.slideTitle}</div>
                    </div>
                    <div style={{ padding: '14px 18px' }}>
                      <p style={{ fontSize: 13.5, color: c.textPrimary, margin: 0, lineHeight: 1.7, whiteSpace: 'pre-wrap' }}>{s.script}</p>
                    </div>
                    {s.why && (
                      <div style={{ padding: '12px 18px', background: c.isDark ? 'oklch(0.72 0.18 45/0.06)' : '#fff7ed', borderTop: `1px solid ${c.isDark ? 'oklch(0.72 0.18 45/0.2)' : '#fed7aa'}` }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 9, fontWeight: 700, color: '#F97316', letterSpacing: '0.1em', marginBottom: 5 }}><Lightbulb size={11} color="#F97316" /> {t('jury.whyFrame')}</div>
                        <p style={{ fontSize: 12.5, color: c.textMuted, margin: 0, lineHeight: 1.6 }}>{s.why}</p>
                      </div>
                    )}
                  </div>
                ))}

                <button onClick={() => generate(true)} style={{ alignSelf: 'flex-start', display: 'inline-flex', alignItems: 'center', gap: 7, padding: '9px 18px', borderRadius: 100, background: 'transparent', border: `1px solid ${c.border}`, color: c.textMuted, fontSize: 13, fontWeight: 600, cursor: 'pointer', marginTop: 2 }}>
                  <RefreshCw size={13} /> {t('jury.regenerate')}
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}
