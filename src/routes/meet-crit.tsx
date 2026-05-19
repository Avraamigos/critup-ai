import { AIOrb } from '@/components/AIOrb'

const FONT = "-apple-system, BlinkMacSystemFont, 'SF Pro Display', 'Helvetica Neue', 'Inter', sans-serif"

const traits = [
  { emoji: '🔍', label: 'Surgical', desc: 'Spots weak points in your drawings — grid errors, missing section datums, dead-end circulation' },
  { emoji: '🎙', label: 'Narrates', desc: 'Walks you through every board with a spoken critique, page by page' },
  { emoji: '⚖️', label: 'Honest',   desc: 'No fluff. Scores calibrated to real jury rubrics — most student work is 5–8' },
  { emoji: '🎯', label: 'Predicts', desc: 'Generates the exact jury questions your project will face, before you walk in' },
]

export function MeetCritPage() {
  return (
    <div style={{
      minHeight: '100vh',
      background: '#0a0a0a',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      fontFamily: FONT,
      overflow: 'hidden',
      position: 'relative',
    }}>

      {/* Ambient glow behind orb */}
      <div style={{
        position: 'absolute',
        width: 600,
        height: 600,
        borderRadius: '50%',
        background: 'radial-gradient(circle, rgba(249,115,22,0.18) 0%, transparent 70%)',
        top: '50%',
        left: '50%',
        transform: 'translate(-50%, -62%)',
        pointerEvents: 'none',
      }} />

      {/* Subtle dot grid */}
      <div style={{
        position: 'absolute',
        inset: 0,
        backgroundImage: 'radial-gradient(circle, rgba(255,255,255,0.06) 1px, transparent 1px)',
        backgroundSize: '32px 32px',
        pointerEvents: 'none',
      }} />

      {/* Content */}
      <div style={{
        position: 'relative',
        zIndex: 1,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: 0,
        textAlign: 'center',
        padding: '0 24px',
      }}>

        {/* Eyebrow */}
        <div style={{
          fontSize: 11,
          fontWeight: 700,
          color: '#F97316',
          letterSpacing: '0.16em',
          textTransform: 'uppercase',
          marginBottom: 40,
          opacity: 0.9,
        }}>
          Critup.ai
        </div>

        {/* Orb — big showcase version */}
        <div style={{ marginBottom: 36, filter: 'drop-shadow(0 0 60px rgba(249,115,22,0.35))' }}>
          <AIOrb size={200} float />
        </div>

        {/* Title */}
        <h1 style={{
          fontSize: 64,
          fontWeight: 900,
          color: '#ffffff',
          margin: '0 0 14px',
          letterSpacing: '-0.04em',
          lineHeight: 1,
        }}>
          Meet Crit
        </h1>

        {/* Subtitle */}
        <p style={{
          fontSize: 20,
          color: 'rgba(255,255,255,0.45)',
          margin: '0 0 56px',
          fontWeight: 400,
          letterSpacing: '-0.01em',
        }}>
          Your AI design critic
        </p>

        {/* Quote */}
        <div style={{
          maxWidth: 480,
          background: 'rgba(255,255,255,0.04)',
          border: '1px solid rgba(255,255,255,0.08)',
          borderRadius: 18,
          padding: '20px 28px',
          marginBottom: 52,
        }}>
          <p style={{
            fontSize: 15,
            color: 'rgba(255,255,255,0.6)',
            margin: 0,
            lineHeight: 1.7,
            fontStyle: 'italic',
          }}>
            "I read your drawings page by page — section datums, circulation dead ends, missing north arrows. I tell you exactly what the jury will ask before you walk in the room."
          </p>
          <div style={{ fontSize: 12, color: '#F97316', fontWeight: 600, marginTop: 14 }}>— Crit</div>
        </div>

        {/* Trait pills */}
        <div style={{
          display: 'flex',
          flexWrap: 'wrap',
          gap: 12,
          justifyContent: 'center',
          maxWidth: 640,
        }}>
          {traits.map(({ emoji, label, desc }) => (
            <div
              key={label}
              title={desc}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                padding: '10px 18px',
                borderRadius: 100,
                background: 'rgba(255,255,255,0.05)',
                border: '1px solid rgba(255,255,255,0.1)',
                fontSize: 13,
                color: 'rgba(255,255,255,0.75)',
                fontWeight: 500,
                cursor: 'default',
                transition: 'all 0.2s',
              }}
              onMouseEnter={e => {
                e.currentTarget.style.background = 'rgba(249,115,22,0.12)'
                e.currentTarget.style.borderColor = 'rgba(249,115,22,0.4)'
                e.currentTarget.style.color = '#fff'
              }}
              onMouseLeave={e => {
                e.currentTarget.style.background = 'rgba(255,255,255,0.05)'
                e.currentTarget.style.borderColor = 'rgba(255,255,255,0.1)'
                e.currentTarget.style.color = 'rgba(255,255,255,0.75)'
              }}
            >
              <span style={{ fontSize: 15 }}>{emoji}</span>
              {label}
            </div>
          ))}
        </div>

        {/* CTA */}
        <div style={{ marginTop: 52, display: 'flex', gap: 12, flexWrap: 'wrap', justifyContent: 'center' }}>
          <a
            href="/signup"
            style={{
              padding: '13px 32px',
              borderRadius: 100,
              background: '#F97316',
              color: '#fff',
              fontSize: 15,
              fontWeight: 700,
              textDecoration: 'none',
              letterSpacing: '-0.2px',
              boxShadow: '0 0 32px rgba(249,115,22,0.4)',
              transition: 'all 0.2s',
            }}
            onMouseEnter={e => (e.currentTarget.style.boxShadow = '0 0 48px rgba(249,115,22,0.6)')}
            onMouseLeave={e => (e.currentTarget.style.boxShadow = '0 0 32px rgba(249,115,22,0.4)')}
          >
            Try Crit free →
          </a>
          <a
            href="/landing"
            style={{
              padding: '13px 28px',
              borderRadius: 100,
              background: 'rgba(255,255,255,0.06)',
              border: '1px solid rgba(255,255,255,0.12)',
              color: 'rgba(255,255,255,0.6)',
              fontSize: 15,
              fontWeight: 500,
              textDecoration: 'none',
              letterSpacing: '-0.1px',
              transition: 'all 0.2s',
            }}
            onMouseEnter={e => { e.currentTarget.style.color = '#fff'; e.currentTarget.style.borderColor = 'rgba(255,255,255,0.25)' }}
            onMouseLeave={e => { e.currentTarget.style.color = 'rgba(255,255,255,0.6)'; e.currentTarget.style.borderColor = 'rgba(255,255,255,0.12)' }}
          >
            Learn more
          </a>
        </div>

        {/* Footer credit */}
        <div style={{ marginTop: 64, fontSize: 12, color: 'rgba(255,255,255,0.2)', letterSpacing: '0.02em' }}>
          critup.ai — AI Jury Feedback for Design Students
        </div>

      </div>
    </div>
  )
}
