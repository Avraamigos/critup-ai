import { AIOrb } from '@/components/AIOrb'

const FONT = "-apple-system, BlinkMacSystemFont, 'SF Pro Display', 'Helvetica Neue', 'Inter', sans-serif"

export function MeetCritPage() {
  return (
    <div style={{
      minHeight: '100vh',
      background: '#0d0d0d',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      fontFamily: FONT,
      overflow: 'hidden',
      position: 'relative',
    }}>

      {/* Dot grid */}
      <div style={{
        position: 'absolute',
        inset: 0,
        backgroundImage: 'radial-gradient(circle, rgba(255,255,255,0.07) 1px, transparent 1px)',
        backgroundSize: '28px 28px',
        pointerEvents: 'none',
      }} />

      {/* Ambient glow */}
      <div style={{
        position: 'absolute',
        width: 500,
        height: 500,
        borderRadius: '50%',
        background: 'radial-gradient(circle, rgba(249,115,22,0.2) 0%, transparent 70%)',
        pointerEvents: 'none',
      }} />

      {/* Content */}
      <div style={{
        position: 'relative',
        zIndex: 1,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: 32,
      }}>
        <div style={{ filter: 'drop-shadow(0 0 80px rgba(249,115,22,0.5))' }}>
          <AIOrb size={220} float />
        </div>

        <h1 style={{
          fontSize: 72,
          fontWeight: 900,
          color: '#ffffff',
          margin: 0,
          letterSpacing: '-0.04em',
          lineHeight: 1,
        }}>
          Meet Crit
        </h1>
      </div>
    </div>
  )
}
