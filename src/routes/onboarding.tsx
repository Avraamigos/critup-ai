import { useState } from 'react'
import { useNavigate } from '@tanstack/react-router'
import { ArrowLeft, Check } from 'lucide-react'
import { CritupLogo } from '@/components/CritupLogo'
import { useTheme, useColors } from '@/lib/theme'
import { useAuth } from '@/lib/auth'
import { supabase } from '@/lib/supabase'

function DotGrid({ theme }: { theme: 'dark' | 'light' }) {
  const dotColor = theme === 'light' ? 'rgba(0,0,0,0.07)' : 'rgba(255,255,255,0.04)'
  return <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none', zIndex: 0, backgroundImage: `radial-gradient(circle, ${dotColor} 1px, transparent 1px)`, backgroundSize: '24px 24px' }} />
}

const STEPS = [
  {
    q: 'What are you studying?', key: 'discipline', type: 'single' as const,
    options: [
      { v: 'arch', l: 'Architecture', emoji: '🏛' },
      { v: 'interior', l: 'Interior Architecture', emoji: '🏠' },
      { v: 'urban', l: 'Urban Design', emoji: '🗺' },
      { v: 'landscape', l: 'Landscape Architecture', emoji: '🌲' },
    ],
  },
  {
    q: 'What year are you in?', key: 'year', type: 'single' as const,
    options: [
      { v: '1', l: 'Year 1' }, { v: '2', l: 'Year 2' }, { v: '3', l: 'Year 3' },
      { v: '4', l: 'Year 4' }, { v: 'grad', l: 'Graduate' },
    ],
  },
  {
    q: "What's your university?", key: 'university', type: 'search' as const,
    suggestions: ['MIT', 'ETH Zurich', 'TU Berlin', 'METU', 'Bartlett UCL', 'Pratt Institute', 'SCI-Arc', 'AA London', 'TU Delft', 'Columbia GSAPP'],
  },
  {
    q: 'Preferred language?', key: 'language', type: 'single' as const,
    options: [
      { v: 'en', l: 'English', flag: '🇬🇧' },
      { v: 'ru', l: 'Русский', flag: '🇷🇺' },
      { v: 'tr', l: 'Türkçe', flag: '🇹🇷' },
    ],
  },
  {
    q: "What's your biggest jury challenge?", key: 'challenges', type: 'multi' as const,
    sub: 'Select all that apply',
    options: [
      { v: 'concept', l: 'Getting my concept across' },
      { v: 'defending', l: 'Defending design decisions' },
      { v: 'nerves', l: 'Presentation nerves' },
      { v: 'spatial', l: 'Spatial logic questions' },
      { v: 'unknown', l: "Not knowing what jury will ask" },
      { v: 'time', l: 'Time management' },
      { v: 'drawings', l: 'Explaining my drawings' },
      { v: 'unexpected', l: 'Handling unexpected questions' },
    ],
  },
]

export function OnboardingPage() {
  const { theme } = useTheme()
  const c = useColors(theme)
  const navigate = useNavigate()
  const { user, refreshProfile } = useAuth()
  const [step, setStep] = useState(0)
  const [sel, setSel] = useState<Record<string, string | string[]>>({})
  const [saving, setSaving] = useState(false)
  const totalSteps = STEPS.length
  const cur = STEPS[step]
  const curSel = sel[cur.key]
  const canNext = cur.type === 'multi' ? (Array.isArray(curSel) && curSel.length > 0) : !!curSel

  const select = (v: string) => {
    if (cur.type === 'multi') {
      const arr = (curSel as string[]) || []
      setSel(s => ({ ...s, [cur.key]: arr.includes(v) ? arr.filter(x => x !== v) : [...arr, v] }))
    } else {
      setSel(s => ({ ...s, [cur.key]: v }))
    }
  }
  const isSelected = (v: string) => cur.type === 'multi' ? ((curSel as string[]) || []).includes(v) : curSel === v

  const goNext = async () => {
    if (!canNext) return
    if (step < totalSteps - 1) { setStep(s => s + 1); return }

    // Last step — save everything to Supabase
    if (!user) { navigate({ to: '/pricing' }); return }
    setSaving(true)
    await supabase.from('profiles').update({
      discipline:          (sel.discipline as string) || null,
      year:                (sel.year as string) || null,
      university:          (sel.university as string) || null,
      language:            (sel.language as string) || 'en',
      challenges:          (sel.challenges as string[]) || [],
      onboarding_complete: true,
      updated_at:          new Date().toISOString(),
    }).eq('id', user.id)

    await refreshProfile()
    setSaving(false)
    navigate({ to: '/pricing' })
  }

  const goBack = () => {
    if (step === 0) { navigate({ to: '/landing' }); return }
    setStep(s => s - 1)
  }

  return (
    <div style={{ minHeight: '100vh', background: c.bg, fontFamily: "'Inter',sans-serif", color: c.textPrimary, display: 'flex', flexDirection: 'column', position: 'relative', overflow: 'hidden' }}>
      <DotGrid theme={theme} />
      {/* Progress bar */}
      <div style={{ height: 3, background: c.isDark ? 'oklch(0.28 0.004 270)' : '#e5e7eb', position: 'fixed', top: 0, left: 0, right: 0, zIndex: 100 }}>
        <div style={{ height: '100%', background: '#F97316', width: `${((step + 1) / totalSteps) * 100}%`, transition: 'width 0.4s ease', boxShadow: '0 0 8px oklch(0.72 0.18 45 / 0.6)', borderRadius: 100 }} />
      </div>

      <div style={{ maxWidth: 600, margin: '0 auto', width: '100%', padding: '72px 24px 48px', flex: 1, display: 'flex', flexDirection: 'column', position: 'relative', zIndex: 1 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 48 }}>
          <button onClick={goBack} style={{ background: 'none', border: 'none', cursor: 'pointer', color: c.textMuted, display: 'flex', alignItems: 'center', gap: 6, fontSize: 14, padding: '4px 8px', borderRadius: 8 }}>
            <ArrowLeft size={16} color={c.textMuted} /> Back
          </button>
          <span style={{ fontSize: 12, color: c.textMuted, fontWeight: 500 }}>Step {step + 1} of {totalSteps}</span>
          <CritupLogo size={18} showText={false} theme={theme} />
        </div>

        <h1 style={{ fontSize: 30, fontWeight: 800, letterSpacing: '-0.03em', marginBottom: cur.type === 'multi' ? 6 : 32, lineHeight: 1.15, fontFamily: "-apple-system, BlinkMacSystemFont, 'SF Pro Display', 'Helvetica Neue', 'Inter', sans-serif" }}>
          {cur.q}
        </h1>
        {'sub' in cur && cur.sub && <p style={{ fontSize: 14, color: c.textMuted, marginBottom: 24 }}>{cur.sub}</p>}

        {(cur.type === 'single' || cur.type === 'multi') && (
          <div style={{
            display: 'grid',
            gridTemplateColumns: cur.options!.length <= 3 ? `repeat(${cur.options!.length}, 1fr)` : 'repeat(2, 1fr)',
            gap: 10,
          }}>
            {cur.options!.map(opt => (
              <button key={opt.v} onClick={() => select(opt.v)} style={{
                padding: '18px 16px', borderRadius: 14,
                background: isSelected(opt.v) ? (c.isDark ? 'oklch(0.72 0.18 45 / 0.1)' : '#fff7ed') : c.cardBg,
                border: isSelected(opt.v) ? '1.5px solid #F97316' : `1px solid ${c.border}`,
                color: c.textPrimary, cursor: 'pointer', textAlign: 'left', transition: 'all 0.15s',
                boxShadow: isSelected(opt.v) ? '0 0 20px oklch(0.72 0.18 45 / 0.12)' : 'none',
                position: 'relative',
              }}>
                {isSelected(opt.v) && (
                  <div style={{ position: 'absolute', top: 10, right: 10, width: 18, height: 18, borderRadius: '50%', background: '#F97316', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <Check size={10} color="#fff" strokeWidth={3} />
                  </div>
                )}
                {'emoji' in opt && opt.emoji && <div style={{ fontSize: 22, marginBottom: 8 }}>{opt.emoji}</div>}
                {'flag' in opt && opt.flag && <div style={{ fontSize: 24, marginBottom: 8 }}>{opt.flag}</div>}
                <div style={{ fontSize: 14, fontWeight: 600, color: isSelected(opt.v) ? '#F97316' : c.textPrimary }}>{opt.l}</div>
              </button>
            ))}
          </div>
        )}

        {cur.type === 'search' && (
          <div>
            <input
              value={(curSel as string) || ''}
              onChange={e => setSel(s => ({ ...s, [cur.key]: e.target.value }))}
              placeholder="Search your university..."
              style={{ width: '100%', padding: '13px 16px', borderRadius: 12, boxSizing: 'border-box', background: c.cardBg, border: `1px solid ${c.border}`, color: c.textPrimary, fontSize: 15, outline: 'none', fontFamily: "'Inter',sans-serif" }}
              onFocus={e => e.target.style.borderColor = '#F97316'}
              onBlur={e => e.target.style.borderColor = c.border}
            />
            <div style={{ marginTop: 10, display: 'flex', flexWrap: 'wrap', gap: 6 }}>
              {[...(cur.suggestions || []), 'Other / Not listed'].map(s => (
                <button key={s} onClick={() => setSel(sv => ({ ...sv, [cur.key]: s }))} style={{
                  padding: '6px 14px', borderRadius: 100,
                  background: curSel === s ? 'oklch(0.72 0.18 45 / 0.12)' : c.cardBg,
                  border: curSel === s ? '1px solid #F97316' : `1px solid ${c.border}`,
                  color: curSel === s ? '#F97316' : c.textMuted, fontSize: 13, cursor: 'pointer', transition: 'all 0.15s',
                }}>{s}</button>
              ))}
            </div>
          </div>
        )}

        <div style={{ marginTop: 'auto', paddingTop: 36, display: 'flex', justifyContent: 'flex-end' }}>
          <button onClick={goNext} disabled={saving} style={{
            padding: '12px 32px', borderRadius: 100,
            background: canNext ? '#F97316' : (c.isDark ? 'oklch(0.28 0.004 270)' : '#e5e7eb'),
            border: 'none', color: canNext ? '#fff' : c.textMuted, fontSize: 15, fontWeight: 600,
            cursor: (canNext && !saving) ? 'pointer' : 'not-allowed', opacity: saving ? 0.7 : 1,
            boxShadow: canNext ? '0 0 18px oklch(0.72 0.18 45 / 0.35)' : 'none', transition: 'all 0.2s',
          }}>
            {saving ? 'Saving…' : step === totalSteps - 1 ? 'Finish setup →' : 'Next →'}
          </button>
        </div>
      </div>
    </div>
  )
}
