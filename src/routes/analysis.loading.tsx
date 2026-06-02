import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useNavigate } from '@tanstack/react-router'
import { CritupLogo } from '@/components/CritupLogo'
import { useTheme, useColors } from '@/lib/theme'

function DotGrid({ theme }: { theme: 'dark' | 'light' }) {
  const dotColor = theme === 'light' ? 'rgba(0,0,0,0.07)' : 'rgba(255,255,255,0.04)'
  return <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none', zIndex: 0, backgroundImage: `radial-gradient(circle, ${dotColor} 1px, transparent 1px)`, backgroundSize: '24px 24px' }} />
}

const STEPS = [
  { labelKey: 'analysisLoading.step1', dur: 1400 },
  { labelKey: 'analysisLoading.step2', dur: 1600 },
  { labelKey: 'analysisLoading.step3', dur: 1800 },
  { labelKey: 'analysisLoading.step4', dur: 1600 },
  { labelKey: 'analysisLoading.step5', dur: 1400 },
  { labelKey: 'analysisLoading.step6', dur: 1200 },
  { labelKey: 'analysisLoading.step7', dur: 1000 },
]

export function AnalysisLoadingPage() {
  const { t } = useTranslation()
  const { theme } = useTheme()
  const c = useColors(theme)
  const navigate = useNavigate()
  const [currentStep, setCurrentStep] = useState(0)
  const [progress, setProgress] = useState(0)

  useEffect(() => {
    let stepIdx = 0
    let elapsed = 0
    const total = STEPS.reduce((a, s) => a + s.dur, 0)

    const tick = () => {
      if (stepIdx >= STEPS.length) {
        setProgress(100)
        setTimeout(() => navigate({ to: '/analysis/$projectId', params: { projectId: 'riverside-pavilion' } }), 600)
        return
      }
      setCurrentStep(stepIdx)
      const stepDur = STEPS[stepIdx].dur
      elapsed += stepDur
      setProgress(Math.round((elapsed / total) * 100))
      stepIdx++
      setTimeout(tick, stepDur)
    }

    const t = setTimeout(tick, 400)
    return () => clearTimeout(t)
  }, [navigate])

  return (
    <div style={{ minHeight: '100vh', background: c.bg, fontFamily: "'Inter',sans-serif", color: c.textPrimary, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', position: 'relative', overflow: 'hidden' }}>
      <DotGrid theme={theme} />
      <div style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', width: '60%', height: '60%', background: 'radial-gradient(ellipse, oklch(0.72 0.18 45 / 0.06) 0%, transparent 70%)', pointerEvents: 'none' }} />

      <div style={{ position: 'relative', zIndex: 1, width: '100%', maxWidth: 480, padding: '0 24px', textAlign: 'center' }}>
        <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 40 }}>
          <CritupLogo size={22} theme={theme} />
        </div>

        {/* Animated rings */}
        <div style={{ position: 'relative', width: 120, height: 120, margin: '0 auto 36px' }}>
          {[0, 1, 2].map(i => (
            <div key={i} style={{
              position: 'absolute', inset: `${i * 14}px`, borderRadius: '50%',
              border: `1.5px solid oklch(0.72 0.18 45 / ${0.25 - i * 0.07})`,
              animation: `spin ${2.5 + i * 0.8}s linear infinite${i % 2 ? ' reverse' : ''}`,
            }} />
          ))}
          <div style={{ position: 'absolute', inset: 42, borderRadius: '50%', background: 'oklch(0.72 0.18 45 / 0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <span style={{ fontSize: 16, fontWeight: 800, color: '#F97316' }}>{progress}%</span>
          </div>
        </div>

        <h2 style={{ fontSize: 22, fontWeight: 800, letterSpacing: '-0.03em', margin: '0 0 8px', fontFamily: "-apple-system, BlinkMacSystemFont, 'SF Pro Display', 'Helvetica Neue', 'Inter', sans-serif" }}>
          {t('analysisLoading.title')}
        </h2>
        <p style={{ fontSize: 14, color: '#F97316', margin: '0 0 36px', fontWeight: 500, minHeight: 20, transition: 'opacity 0.3s' }}>
          {t(STEPS[Math.min(currentStep, STEPS.length - 1)].labelKey)}…
        </p>

        {/* Progress bar */}
        <div style={{ height: 4, background: c.isDark ? 'oklch(0.28 0.004 270)' : '#e5e7eb', borderRadius: 100, overflow: 'hidden', marginBottom: 32 }}>
          <div style={{ height: '100%', background: 'linear-gradient(90deg, #F97316, oklch(0.72 0.18 45))', width: `${progress}%`, transition: 'width 0.8s ease', borderRadius: 100, boxShadow: '0 0 10px oklch(0.72 0.18 45 / 0.5)' }} />
        </div>

        {/* Steps list */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, textAlign: 'left' }}>
          {STEPS.map((s, i) => {
            const done = i < currentStep
            const active = i === currentStep
            return (
              <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 10, opacity: done || active ? 1 : 0.35, transition: 'opacity 0.4s' }}>
                <div style={{
                  width: 18, height: 18, borderRadius: '50%', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center',
                  background: done ? 'oklch(0.72 0.17 145)' : active ? '#F97316' : c.isDark ? 'oklch(0.28 0.004 270)' : '#e5e7eb',
                  transition: 'background 0.3s',
                }}>
                  {done && <svg width="10" height="10" viewBox="0 0 10 10"><polyline points="1.5,5 4,7.5 8.5,2.5" stroke="#fff" strokeWidth="1.8" fill="none" strokeLinecap="round" strokeLinejoin="round" /></svg>}
                  {active && <div style={{ width: 6, height: 6, borderRadius: '50%', background: '#fff', animation: 'bounce-dot 0.8s ease-in-out infinite' }} />}
                </div>
                <span style={{ fontSize: 13, color: done ? c.textPrimary : active ? '#F97316' : c.textMuted, fontWeight: active ? 600 : 400, transition: 'color 0.3s' }}>{t(s.labelKey)}</span>
              </div>
            )
          })}
        </div>
      </div>

      <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
    </div>
  )
}
