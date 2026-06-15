import { useEffect, useRef, useState, useCallback } from 'react'

// ─── Types ───────────────────────────────────────────────────────────────────
interface PDFViewerProps {
  url: string
  pageNumber: number      // 1-based
  focusX?: number        // 0-1, horizontal focus point (0.5 = center)
  focusY?: number        // 0-1, vertical focus point   (0.5 = center)
  zoomLevel?: number     // 1 = full page, 2.5 = zoomed in
  onPageCount?: (n: number) => void
}

// ─── Worker setup (CDN, avoids Vite bundling issues) ─────────────────────────
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

// ─── Component ───────────────────────────────────────────────────────────────
export function PDFViewer({
  url,
  pageNumber,
  focusX = 0.5,
  focusY = 0.5,
  zoomLevel = 1,
  onPageCount,
}: PDFViewerProps) {
  const containerRef  = useRef<HTMLDivElement>(null)
  const canvasRef     = useRef<HTMLCanvasElement>(null)
  const pdfRef        = useRef<import('pdfjs-dist').PDFDocumentProxy | null>(null)
  const renderTaskRef = useRef<import('pdfjs-dist').RenderTask | null>(null)
  const [ready, setReady] = useState(false)
  const [fading, setFading] = useState(false)

  // ── Render a single page ──
  const renderPage = useCallback(async (num: number) => {
    if (!pdfjsLib || !pdfRef.current || !canvasRef.current || !containerRef.current) return

    // Cancel any in-progress render
    if (renderTaskRef.current) {
      try { renderTaskRef.current.cancel() } catch { /* ignore */ }
    }

    const safeNum = Math.max(1, Math.min(num, pdfRef.current.numPages))
    const page = await pdfRef.current.getPage(safeNum)

    const containerW = containerRef.current.clientWidth  || 600
    const containerH = containerRef.current.clientHeight || 800
    const baseVP     = page.getViewport({ scale: 1 })
    const scale      = Math.min(containerW / baseVP.width, containerH / baseVP.height) * 2 // 2× for retina clarity
    const viewport   = page.getViewport({ scale })

    const canvas    = canvasRef.current
    canvas.width    = viewport.width
    canvas.height   = viewport.height
    canvas.style.width  = `${viewport.width  / 2}px`
    canvas.style.height = `${viewport.height / 2}px`

    const ctx = canvas.getContext('2d')!
    // pdfjs-dist v5 changed RenderParameters to require `canvas` (the element);
    // cast to any so this compiles regardless of which minor type version Vercel installs
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    renderTaskRef.current = page.render({ canvasContext: ctx, viewport } as any)
    await renderTaskRef.current.promise
    setReady(true)
  }, [])

  // ── Load PDF ──
  useEffect(() => {
    setReady(false)
    ensurePdfJs(async () => {
      if (!pdfjsLib) return
      try {
        if (pdfRef.current) { pdfRef.current.destroy(); pdfRef.current = null }
        // cMapUrl + standardFontDataUrl let pdf.js resolve embedded subset/CID
        // fonts — without them, architecture PDFs render garbled glyphs.
        const doc = await pdfjsLib.getDocument({
          url,
          disableRange: false,
          cMapUrl: `https://unpkg.com/pdfjs-dist@${pdfjsLib.version}/cmaps/`,
          cMapPacked: true,
          standardFontDataUrl: `https://unpkg.com/pdfjs-dist@${pdfjsLib.version}/standard_fonts/`,
        }).promise
        pdfRef.current = doc
        onPageCount?.(doc.numPages)
        await renderPage(pageNumber)
      } catch (e) {
        console.warn('PDFViewer load error', e)
      }
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [url])

  // ── Page changes: fade out → render → fade in ──
  useEffect(() => {
    if (!pdfRef.current) return
    setFading(true)
    const t = setTimeout(async () => {
      await renderPage(pageNumber)
      setFading(false)
    }, 250)
    return () => clearTimeout(t)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pageNumber])

  // ── CSS zoom/pan transform ──
  const scale      = ready ? zoomLevel : 1
  const originX    = focusX  * 100
  const originY    = focusY  * 100

  return (
    <div
      ref={containerRef}
      style={{
        width: '100%', height: '100%',
        overflow: 'hidden',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        userSelect: 'none',
        pointerEvents: 'none', // prevent any user interaction with PDF
      }}
    >
      <canvas
        ref={canvasRef}
        style={{
          display: 'block',
          maxWidth: '100%', maxHeight: '100%',
          transform: `scale(${scale})`,
          transformOrigin: `${originX}% ${originY}%`,
          transition: 'transform 1.4s cubic-bezier(0.4, 0, 0.2, 1)',
          opacity: fading ? 0 : (ready ? 1 : 0),
          filter: fading ? 'blur(2px)' : 'none',
          transitionProperty: 'transform, opacity, filter',
        }}
      />
      {/* Loading shimmer while rendering */}
      {!ready && (
        <div style={{
          position: 'absolute', inset: 0,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <div style={{ width: 28, height: 28, borderRadius: '50%', border: '2.5px solid oklch(0.72 0.18 45/0.3)', borderTopColor: '#F97316', animation: 'spin 0.8s linear infinite' }} />
          <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
        </div>
      )}
    </div>
  )
}
