interface Props {
  size?: number
  float?: boolean    // gentle up/down float (use in headers)
  onClick?: () => void
  active?: boolean   // slightly brighter glow when chat is open
}

let injected = false
function injectStyles() {
  if (injected || typeof document === 'undefined') return
  injected = true
  const style = document.createElement('style')
  style.textContent = `
    /* Up/down float */
    @keyframes orb-float {
      0%,100% { transform: translateY(0px);  }
      50%      { transform: translateY(-3px); }
    }
    /* Glow pulse */
    @keyframes orb-pulse {
      0%   { box-shadow: 0 0 12px rgba(255,107,0,0.35), 0 0 24px rgba(255,107,0,0.12); }
      100% { box-shadow: 0 0 26px rgba(255,107,0,0.70), 0 0 50px rgba(255,107,0,0.30); }
    }
    /* Both eyes blink in sync */
    @keyframes orb-blink {
      0%, 90%, 100% { transform: scaleY(1);    }
      95%           { transform: scaleY(0.05); }
    }
    /* Eyes glance left → center → right → center, like a curious pet */
    @keyframes orb-glance {
      0%,  20%  { transform: translateX(0);    }
      28%, 40%  { transform: translateX(-35%); }
      48%, 58%  { transform: translateX(0);    }
      66%, 78%  { transform: translateX(35%);  }
      86%, 100% { transform: translateX(0);    }
    }
  `
  document.head.appendChild(style)
}

export function AIOrb({ size = 38, float = false, onClick, active = false }: Props) {
  injectStyles()

  const s     = size / 100
  const eyeW  = Math.max(3, Math.round(10 * s))
  const eyeH  = Math.max(5, Math.round(16 * s))
  const eyeGap = Math.max(3, Math.round(12 * s))

  const orb = (
    <div style={{
      width: size,
      height: size,
      borderRadius: '50%',
      flexShrink: 0,
      background: active
        ? 'radial-gradient(circle at 38% 32%, #ffd04a 0%, #ff6b00 55%, #d44e00 100%)'
        : 'radial-gradient(circle at 38% 32%, #feb019 0%, #ff6b00 60%, #e05500 100%)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      position: 'relative',
      cursor: onClick ? 'pointer' : 'default',
      animation: float
        ? 'orb-float 4s ease-in-out infinite, orb-pulse 3s ease-in-out infinite alternate'
        : 'orb-pulse 3s ease-in-out infinite alternate',
      transition: 'transform 0.15s',
    }}>
      {/* Frosted glow halo */}
      <div style={{
        position: 'absolute', inset: 0, borderRadius: '50%',
        background: 'inherit', filter: 'blur(7px)', opacity: 0.65, zIndex: 0,
        pointerEvents: 'none',
      }} />

      {/* Eyes wrapper — glances left/right */}
      <div style={{
        display: 'flex',
        gap: eyeGap,
        position: 'relative',
        zIndex: 1,
        animation: 'orb-glance 6s ease-in-out infinite',
      }}>
        {/* Left eye */}
        <div style={{
          width: eyeW, height: eyeH,
          background: '#fff',
          borderRadius: 999,
          boxShadow: '0 0 6px rgba(255,255,255,0.9)',
          animation: 'orb-blink 5s ease-in-out infinite',
          transformOrigin: 'center',
        }} />
        {/* Right eye — same blink timing = sync */}
        <div style={{
          width: eyeW, height: eyeH,
          background: '#fff',
          borderRadius: 999,
          boxShadow: '0 0 6px rgba(255,255,255,0.9)',
          animation: 'orb-blink 5s ease-in-out infinite',
          transformOrigin: 'center',
        }} />
      </div>
    </div>
  )

  if (!onClick) return orb

  return (
    <button
      onClick={onClick}
      aria-label="AI Assistant"
      title="AI Assistant"
      style={{
        border: 'none', background: 'transparent',
        padding: 0, cursor: 'pointer', borderRadius: '50%',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        flexShrink: 0,
      }}
      onMouseEnter={e => ((e.currentTarget.firstChild as HTMLElement).style.transform = 'scale(1.1)')}
      onMouseLeave={e => ((e.currentTarget.firstChild as HTMLElement).style.transform = 'scale(1)')}
      onMouseDown={e  => ((e.currentTarget.firstChild as HTMLElement).style.transform = 'scale(0.92)')}
      onMouseUp={e    => ((e.currentTarget.firstChild as HTMLElement).style.transform = 'scale(1.1)')}
    >
      {orb}
    </button>
  )
}
