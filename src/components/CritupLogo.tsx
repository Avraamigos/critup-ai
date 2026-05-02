interface Props {
  size?: number
  showText?: boolean
  theme?: 'dark' | 'light'
}

export function CritupLogo({ size = 28, showText = true, theme = 'dark' }: Props) {
  const textColor = theme === 'light' ? '#1a1a1a' : '#ffffff'
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
      {/* Orange swoosh arrow logo matching user's attached image */}
      <svg width={size} height={size} viewBox="0 0 500 500" fill="none">
        <path
          d="M60 380 C80 300 140 220 200 200 C170 260 180 310 220 320 C260 330 300 260 360 180 C400 120 440 80 460 60"
          stroke="#F97316" strokeWidth="52" strokeLinecap="round" strokeLinejoin="round" fill="none"
        />
        <path d="M390 55 L465 55 L465 130" stroke="#F97316" strokeWidth="50" strokeLinecap="round" strokeLinejoin="round" fill="none" />
      </svg>
      {showText && (
        <span style={{
          fontFamily: "'Inter', sans-serif",
          fontWeight: 700,
          fontSize: size * 0.75,
          letterSpacing: '-0.03em',
          color: textColor,
        }}>
          Critup<span style={{ color: '#F97316' }}>.ai</span>
        </span>
      )}
    </div>
  )
}
