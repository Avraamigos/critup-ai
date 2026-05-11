interface Props {
  size?: number
  float?: boolean   // enable float animation (use in headers, disable in chat bubbles)
}

let injected = false
function injectStyles() {
  if (injected || typeof document === 'undefined') return
  injected = true
  const style = document.createElement('style')
  style.textContent = `
    @keyframes orb-float  { 0%,100% { transform:translateY(0);  } 50% { transform:translateY(-4px); } }
    @keyframes orb-pulse  { 0%      { box-shadow:0 0 10px rgba(255,107,0,0.35),0 0 20px rgba(255,107,0,0.15); }
                            100%    { box-shadow:0 0 22px rgba(255,107,0,0.65),0 0 40px rgba(255,107,0,0.3); } }
    @keyframes orb-blink  { 0%,94%,100% { transform:scaleY(1); } 97% { transform:scaleY(0.05); } }
    @keyframes orb-blink2 { 0%,88%,100% { transform:scaleY(1); } 92% { transform:scaleY(0.05); } }
  `
  document.head.appendChild(style)
}

export function AIOrb({ size = 38, float = false }: Props) {
  injectStyles()

  // Scale eye dimensions relative to original 100px design
  const s = size / 100
  const eyeW  = Math.max(3, Math.round(10 * s))
  const eyeH  = Math.max(5, Math.round(16 * s))
  const eyeGap = Math.max(3, Math.round(12 * s))

  return (
    <div style={{
      width: size,
      height: size,
      borderRadius: '50%',
      flexShrink: 0,
      background: 'radial-gradient(circle at 40% 35%, #feb019 0%, #ff6b00 60%, #e85500 100%)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      position: 'relative',
      cursor: 'default',
      animation: float
        ? 'orb-float 4s ease-in-out infinite, orb-pulse 3s ease-in-out infinite alternate'
        : 'orb-pulse 3s ease-in-out infinite alternate',
    }}>
      {/* Frosted glow layer */}
      <div style={{
        position: 'absolute',
        inset: 0,
        borderRadius: '50%',
        background: 'inherit',
        filter: 'blur(6px)',
        opacity: 0.7,
        zIndex: 0,
      }} />

      {/* Eyes */}
      <div style={{ display: 'flex', gap: eyeGap, position: 'relative', zIndex: 1 }}>
        <div style={{
          width: eyeW,
          height: eyeH,
          background: '#fff',
          borderRadius: 999,
          boxShadow: '0 0 6px rgba(255,255,255,0.9)',
          animation: 'orb-blink 5s ease-in-out infinite',
        }} />
        <div style={{
          width: eyeW,
          height: eyeH,
          background: '#fff',
          borderRadius: 999,
          boxShadow: '0 0 6px rgba(255,255,255,0.9)',
          animation: 'orb-blink2 7s ease-in-out infinite',
        }} />
      </div>
    </div>
  )
}
