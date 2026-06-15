// Render PDF pages to compressed JPEG blobs in the browser, using the same
// pdfjs build the viewer uses. Run once at post time so the feed can serve
// static images instead of rendering a multi-MB PDF on every view.

let pdfjsLib: typeof import('pdfjs-dist') | null = null

async function getPdfJs() {
  if (pdfjsLib) return pdfjsLib
  const lib = await import('pdfjs-dist')
  lib.GlobalWorkerOptions.workerSrc =
    `https://unpkg.com/pdfjs-dist@${lib.version}/build/pdf.worker.min.mjs`
  pdfjsLib = lib
  return lib
}

export interface RenderSlidesOptions {
  maxPages?: number     // cap number of pages rendered (default 12)
  maxWidth?: number     // longest edge in px (default 1400)
  quality?: number      // JPEG quality 0-1 (default 0.82)
  onProgress?: (done: number, total: number) => void
}

// Returns one JPEG blob per rendered page, in order.
export async function renderPdfToJpegBlobs(
  url: string,
  { maxPages = 12, maxWidth = 1400, quality = 0.82, onProgress }: RenderSlidesOptions = {},
): Promise<Blob[]> {
  const lib = await getPdfJs()
  // cMapUrl + standardFontDataUrl are REQUIRED for PDFs that embed subset/CID
  // fonts (almost every architecture export from Illustrator/InDesign). Without
  // them pdf.js can't map the glyphs and renders garbled symbols into the JPEG.
  const doc = await lib.getDocument({
    url,
    cMapUrl: `https://unpkg.com/pdfjs-dist@${lib.version}/cmaps/`,
    cMapPacked: true,
    standardFontDataUrl: `https://unpkg.com/pdfjs-dist@${lib.version}/standard_fonts/`,
  }).promise
  const total = Math.min(doc.numPages, maxPages)
  const blobs: Blob[] = []

  const canvas = document.createElement('canvas')
  const ctx = canvas.getContext('2d')
  if (!ctx) { doc.destroy(); return [] }

  try {
    for (let i = 1; i <= total; i++) {
      const page = await doc.getPage(i)
      const base = page.getViewport({ scale: 1 })
      const scale = Math.min(maxWidth / base.width, maxWidth / base.height, 2)
      const viewport = page.getViewport({ scale })
      canvas.width = Math.round(viewport.width)
      canvas.height = Math.round(viewport.height)
      // White background so transparent PDFs don't go black under JPEG.
      ctx.fillStyle = '#ffffff'
      ctx.fillRect(0, 0, canvas.width, canvas.height)
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await page.render({ canvasContext: ctx, viewport } as any).promise
      const blob = await new Promise<Blob | null>(res => canvas.toBlob(res, 'image/jpeg', quality))
      if (blob) blobs.push(blob)
      onProgress?.(i, total)
    }
  } finally {
    doc.destroy()
  }
  return blobs
}
