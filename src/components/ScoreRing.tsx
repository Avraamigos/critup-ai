import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'

interface Props {
  score: number
  label?: string
  size?: number
  animated?: boolean
  theme?: 'dark' | 'light'
  /** Show a qualitative band word (Strong / Solid / Developing / Needs work) under the label.
   *  Scores are already stage-calibrated by the analysis, so the band reflects stage context. */
  showBand?: boolean
}

// Exported so callers can reason about the same tiers if needed.
export function scoreBandKey(score: number): 'strong' | 'solid' | 'developing' | 'weak' {
  return score >= 8 ? 'strong' : score >= 6 ? 'solid' : score >= 4 ? 'developing' : 'weak'
}

export function ScoreRing({ score, label, size = 80, animated = true, theme = 'dark', showBand = false }: Props) {
  const { t } = useTranslation()
  const [displayScore, setDisplayScore] = useState(animated ? 0 : score)
  const [progress, setProgress] = useState(animated ? 0 : score / 10)
  const trackColor = theme === 'light' ? '#e5e7eb' : 'oklch(0.28 0.004 270)'

  useEffect(() => {
    if (!animated) {
      setDisplayScore(score)
      setProgress(score / 10)
      return
    }
    let start: number | null = null
    const duration = 900
    const animate = (ts: number) => {
      if (!start) start = ts
      const p = Math.min((ts - start) / duration, 1)
      const ease = 1 - Math.pow(1 - p, 3)
      setDisplayScore(Math.round(ease * score * 10) / 10)
      setProgress(ease * score / 10)
      if (p < 1) requestAnimationFrame(animate)
    }
    const id = requestAnimationFrame(animate)
    return () => cancelAnimationFrame(id)
  }, [score, animated])

  // Tiers tuned so a 6 reads as "good" (green), not borderline. 6+ green, 4–6 amber, <4 red.
  const color = score >= 6 ? 'oklch(0.72 0.17 145)' : score >= 4 ? '#F97316' : 'oklch(0.65 0.18 25)'
  const r = (size - 8) / 2
  const circ = 2 * Math.PI * r
  const dash = circ * progress
  const textColor = theme === 'light' ? '#1a1a1a' : 'oklch(0.96 0 0)'

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
      <div style={{ position: 'relative', width: size, height: size }}>
        <svg width={size} height={size} style={{ transform: 'rotate(-90deg)' }}>
          <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={trackColor} strokeWidth="5" />
          <circle
            cx={size / 2} cy={size / 2} r={r} fill="none" stroke={color} strokeWidth="5"
            strokeLinecap="round" strokeDasharray={`${dash} ${circ}`}
            style={{ filter: `drop-shadow(0 0 4px ${color}80)`, transition: 'stroke 0.3s' }}
          />
        </svg>
        <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
          <span style={{
            fontFamily: "-apple-system, BlinkMacSystemFont, 'SF Pro Display', 'Inter', sans-serif",
            fontWeight: 600, fontSize: size * 0.30, color: textColor, lineHeight: 1,
            letterSpacing: '-0.03em', fontVariantNumeric: 'tabular-nums',
          }}>
            {displayScore.toFixed(displayScore % 1 === 0 ? 0 : 1)}
          </span>
        </div>
      </div>
      {label && (
        <span style={{ fontSize: 10, fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase', color: theme === 'light' ? '#6b7280' : 'oklch(0.68 0.005 270)' }}>
          {label}
        </span>
      )}
      {showBand && (
        <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.02em', color, marginTop: -1 }}>
          {t(`scores.band_${scoreBandKey(score)}`)}
        </span>
      )}
    </div>
  )
}
