interface Props {
  onClick: () => void
  active?: boolean
  size?: number
}

export function BlobButton({ onClick, active = false }: Props) {
  return (
    <>
      <style>{`
        @keyframes siri-pulse-1 {
          0%, 100% { transform: scale(1); opacity: 0.35; }
          50% { transform: scale(1.55); opacity: 0; }
        }
        @keyframes siri-pulse-2 {
          0%, 100% { transform: scale(1); opacity: 0.25; }
          50% { transform: scale(1.9); opacity: 0; }
        }
        @keyframes siri-glow {
          0%, 100% { box-shadow: 0 0 8px 2px oklch(0.72 0.18 45 / 0.5); }
          50% { box-shadow: 0 0 16px 4px oklch(0.72 0.18 45 / 0.8); }
        }
      `}</style>
      <button
        onClick={onClick}
        aria-label="Open AI Assistant"
        title="AI Assistant"
        style={{
          position: 'relative', width: 32, height: 32,
          borderRadius: '50%', border: 'none', cursor: 'pointer',
          background: 'transparent', flexShrink: 0, padding: 0,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}
      >
        {/* Outer pulse ring 2 */}
        <span style={{
          position: 'absolute', inset: 0, borderRadius: '50%',
          background: 'oklch(0.72 0.18 45 / 0.2)',
          animation: 'siri-pulse-2 2s ease-out infinite',
          animationDelay: '0.4s',
        }} />
        {/* Outer pulse ring 1 */}
        <span style={{
          position: 'absolute', inset: 0, borderRadius: '50%',
          background: 'oklch(0.72 0.18 45 / 0.3)',
          animation: 'siri-pulse-1 2s ease-out infinite',
        }} />
        {/* Core orb */}
        <span style={{
          width: 22, height: 22, borderRadius: '50%',
          background: 'radial-gradient(circle at 35% 35%, #ffb347, #F97316 60%, oklch(0.60 0.22 35))',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          position: 'relative', zIndex: 1,
          animation: 'siri-glow 2s ease-in-out infinite',
          transition: 'transform 0.15s',
        }} />
      </button>
    </>
  )
}
