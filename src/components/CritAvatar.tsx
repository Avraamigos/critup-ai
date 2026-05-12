// Minimal flat badge used in message threads — keeps focus on the text.
// Full AIOrb character is reserved for headers/buttons only.
interface Props { size?: number }

export function CritAvatar({ size = 24 }: Props) {
  return (
    <div style={{
      width: size, height: size, borderRadius: '50%', flexShrink: 0,
      background: 'linear-gradient(135deg, #ff6b00 0%, #e05000 100%)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      fontSize: Math.round(size * 0.46), fontWeight: 800, color: '#fff',
      fontFamily: "'Inter', sans-serif",
      letterSpacing: '-0.02em',
      boxShadow: '0 2px 8px rgba(255,107,0,0.35)',
      userSelect: 'none',
    }}>
      C
    </div>
  )
}
