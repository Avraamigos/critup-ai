import { useRef, useState } from 'react'

// Swipeable image carousel for pre-rendered post slides. Pure <img> — no PDF
// rendering — so feed cards load instantly from the CDN.

interface ImageCarouselProps {
  images: string[]
  aspect?: number      // height / width of the frame; default 0.7
  rounded?: boolean
}

export function ImageCarousel({ images, aspect = 0.7, rounded = true }: ImageCarouselProps) {
  const [page, setPage] = useState(0)         // 0-based
  const total = images.length
  const touchX = useRef<number | null>(null)

  const go = (next: number) => {
    if (total <= 1) return
    setPage(Math.max(0, Math.min(total - 1, next)))
  }

  const onTouchStart = (e: React.TouchEvent) => { touchX.current = e.touches[0].clientX }
  const onTouchEnd = (e: React.TouchEvent) => {
    if (touchX.current == null) return
    const dx = e.changedTouches[0].clientX - touchX.current
    if (Math.abs(dx) > 40) go(dx < 0 ? page + 1 : page - 1)
    touchX.current = null
  }

  if (total === 0) return null

  return (
    <div style={{ position: 'relative', width: '100%' }}>
      <div
        onTouchStart={onTouchStart}
        onTouchEnd={onTouchEnd}
        style={{
          width: '100%',
          paddingBottom: `${aspect * 100}%`,
          position: 'relative',
          overflow: 'hidden',
          background: '#0b0b0f',
          borderRadius: rounded ? 14 : 0,
        }}
      >
        <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <img
            src={images[page]}
            alt={`Slide ${page + 1}`}
            loading="lazy"
            style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain', display: 'block' }}
          />
        </div>

        {total > 1 && page > 0 && (
          <button onClick={() => go(page - 1)} aria-label="Previous slide" style={arrowStyle('left')}>‹</button>
        )}
        {total > 1 && page < total - 1 && (
          <button onClick={() => go(page + 1)} aria-label="Next slide" style={arrowStyle('right')}>›</button>
        )}

        {total > 1 && (
          <div style={{
            position: 'absolute', top: 10, right: 10,
            background: 'rgba(0,0,0,0.55)', color: '#fff',
            fontSize: 12, fontWeight: 600, padding: '3px 9px', borderRadius: 999,
          }}>{page + 1} / {total}</div>
        )}
      </div>

      {total > 1 && (
        <div style={{ display: 'flex', gap: 6, justifyContent: 'center', padding: '10px 0 2px' }}>
          {images.map((_, i) => (
            <button
              key={i}
              onClick={() => go(i)}
              aria-label={`Go to slide ${i + 1}`}
              style={{
                width: i === page ? 8 : 6,
                height: i === page ? 8 : 6,
                borderRadius: '50%', border: 'none', padding: 0, cursor: 'pointer',
                background: i === page ? '#F97316' : 'rgba(120,120,130,0.4)',
                transition: 'all 0.2s',
              }}
            />
          ))}
        </div>
      )}
    </div>
  )
}

function arrowStyle(side: 'left' | 'right'): React.CSSProperties {
  return {
    position: 'absolute', top: '50%', [side]: 8, transform: 'translateY(-50%)',
    width: 34, height: 34, borderRadius: '50%', border: 'none',
    background: 'rgba(0,0,0,0.5)', color: '#fff', fontSize: 20, lineHeight: '34px',
    cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
  }
}
