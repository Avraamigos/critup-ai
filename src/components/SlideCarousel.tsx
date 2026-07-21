import { useEffect, useRef, useState, useCallback } from 'react'

// Instagram-style swipeable PDF slide carousel.
// Renders one page at a time, fit-to-width, on demand. Rendering is gated by an
// IntersectionObserver so feeds with many carousels don't load every PDF at once.

interface SlideCarouselProps {
  url: string
  maxPages?: number          // cap pages rendered (perf); default 12
  aspect?: number            // height / width of the frame; default 0.75 (4:3-ish)
  rounded?: boolean
  renderScale?: number       // canvas resolution multiplier (2 = retina); lower = faster
}

let pdfjsLib: typeof import('pdfjs-dist') | null = null
let pdfjsLoading = false
let pdfjsCallbacks: Array<() => void> = []

function ensurePdfJs(cb: () => void) {
  if (pdfjsLib) { cb(); return }
  pdfjsCallbacks.push(cb)
  if (pdfjsLoading) return
  pdfjsLoading = true
  import('pdfjs-dist').then(lib => {
    lib.GlobalWorkerOptions.workerSrc =
      `https://unpkg.com/pdfjs-dist@${lib.version}/build/pdf.worker.min.mjs`
    pdfjsLib = lib
    pdfjsCallbacks.forEach(fn => fn())
    pdfjsCallbacks = []
  }).catch(console.error)
}

export function SlideCarousel({
  url,
  maxPages = 12,
  aspect = 0.75,
  rounded = true,
  renderScale = 2,
}: SlideCarouselProps) {
  const frameRef      = useRef<HTMLDivElement>(null)
  const canvasRef     = useRef<HTMLCanvasElement>(null)
  const pdfRef        = useRef<import('pdfjs-dist').PDFDocumentProxy | null>(null)
  const renderTaskRef = useRef<import('pdfjs-dist').RenderTask | null>(null)

  const [inView, setInView] = useState(false)
  const [numPages, setNumPages] = useState(0)
  const [page, setPage] = useState(1)          // 1-based
  const [ready, setReady] = useState(false)

  const total = Math.min(numPages || 0, maxPages)

  // ── Lazy-load: only mount pdfjs work once the card scrolls into view ──
  useEffect(() => {
    const el = frameRef.current
    if (!el) return
    const io = new IntersectionObserver(
      entries => { if (entries[0]?.isIntersecting) { setInView(true); io.disconnect() } },
      { rootMargin: '300px' }
    )
    io.observe(el)
    return () => io.disconnect()
  }, [])

  // ── Render a single page fit-to-width ──
  const renderPage = useCallback(async (num: number) => {
    if (!pdfjsLib || !pdfRef.current || !canvasRef.current || !frameRef.current) return
    if (renderTaskRef.current) { try { renderTaskRef.current.cancel() } catch { /* ignore */ } }

    const safeNum = Math.max(1, Math.min(num, pdfRef.current.numPages))
    const pg = await pdfRef.current.getPage(safeNum)

    const frameW = frameRef.current.clientWidth || 600
    const frameH = frameRef.current.clientHeight || 450
    const baseVP = pg.getViewport({ scale: 1 })
    const scale  = Math.min(frameW / baseVP.width, frameH / baseVP.height) * renderScale
    const viewport = pg.getViewport({ scale })

    const canvas = canvasRef.current
    canvas.width  = viewport.width
    canvas.height = viewport.height
    canvas.style.width  = `${viewport.width  / renderScale}px`
    canvas.style.height = `${viewport.height / renderScale}px`

    const ctx = canvas.getContext('2d')!
    // Force LTR: in an RTL document (Arabic UI) the canvas inherits dir=rtl,
    // which makes pdf.js mis-space/reorder Latin glyphs on the drawing.
    ctx.direction = 'ltr'
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    renderTaskRef.current = pg.render({ canvasContext: ctx, viewport } as any)
    try {
      await renderTaskRef.current.promise
      setReady(true)
    } catch { /* cancelled */ }
  }, [renderScale])

  // ── Load PDF once in view ──
  useEffect(() => {
    if (!inView) return
    ensurePdfJs(async () => {
      if (!pdfjsLib) return
      try {
        const doc = await pdfjsLib.getDocument({ url, disableRange: false }).promise
        pdfRef.current = doc
        setNumPages(doc.numPages)
        await renderPage(1)
      } catch (e) { console.warn('SlideCarousel load error', e) }
    })
    return () => {
      if (pdfRef.current) { pdfRef.current.destroy(); pdfRef.current = null }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [inView, url])

  // ── Re-render on page change ──
  useEffect(() => {
    if (pdfRef.current) renderPage(page)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page])

  const go = (next: number) => {
    if (total <= 1) return
    setPage(p => Math.max(1, Math.min(total, next)))
  }

  // ── Swipe handling ──
  const touchX = useRef<number | null>(null)
  const onTouchStart = (e: React.TouchEvent) => { touchX.current = e.touches[0].clientX }
  const onTouchEnd = (e: React.TouchEvent) => {
    if (touchX.current == null) return
    const dx = e.changedTouches[0].clientX - touchX.current
    if (Math.abs(dx) > 40) go(dx < 0 ? page + 1 : page - 1)
    touchX.current = null
  }

  return (
    <div style={{ position: 'relative', width: '100%' }}>
      <div
        ref={frameRef}
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
          <canvas ref={canvasRef} style={{ display: 'block', maxWidth: '100%', maxHeight: '100%', opacity: ready ? 1 : 0, transition: 'opacity 0.25s' }} />
        </div>

        {!ready && (
          <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <div style={{ width: 26, height: 26, borderRadius: '50%', border: '2.5px solid rgba(249,115,22,0.3)', borderTopColor: '#F97316', animation: 'spin 0.8s linear infinite' }} />
            <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
          </div>
        )}

        {/* Arrows (desktop) */}
        {total > 1 && page > 1 && (
          <button
            onClick={() => go(page - 1)}
            aria-label="Previous slide"
            style={arrowStyle('left')}
          >‹</button>
        )}
        {total > 1 && page < total && (
          <button
            onClick={() => go(page + 1)}
            aria-label="Next slide"
            style={arrowStyle('right')}
          >›</button>
        )}

        {/* Slide counter */}
        {total > 1 && (
          <div style={{
            position: 'absolute', top: 10, right: 10,
            background: 'rgba(0,0,0,0.55)', color: '#fff',
            fontSize: 12, fontWeight: 600, padding: '3px 9px', borderRadius: 999,
          }}>{page} / {total}</div>
        )}
      </div>

      {/* Pagination dots */}
      {total > 1 && (
        <div style={{ display: 'flex', gap: 6, justifyContent: 'center', padding: '10px 0 2px' }}>
          {Array.from({ length: total }).map((_, i) => (
            <button
              key={i}
              onClick={() => go(i + 1)}
              aria-label={`Go to slide ${i + 1}`}
              style={{
                width: i + 1 === page ? 8 : 6,
                height: i + 1 === page ? 8 : 6,
                borderRadius: '50%', border: 'none', padding: 0, cursor: 'pointer',
                background: i + 1 === page ? '#F97316' : 'rgba(120,120,130,0.4)',
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
