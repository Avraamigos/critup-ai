// Share a public post. Uses the native share sheet (Web Share API) when the
// browser supports it — on iOS/iPadOS Safari this opens the system sheet with
// Copy link / WhatsApp / Messages / etc. Falls back to copying the link to the
// clipboard on desktop browsers that don't implement navigator.share.
//
// Returns 'shared' when the native sheet handled it, 'copied' when we fell back
// to the clipboard, or 'dismissed' when the user cancelled the share sheet.
export async function sharePost(
  analysisId: string,
  opts?: { title?: string; text?: string },
): Promise<'shared' | 'copied' | 'dismissed'> {
  const url = `${window.location.origin}/p/${analysisId}`
  const title = opts?.title ?? 'Critup.ai'
  const text = opts?.text ?? 'Check out this AI architecture critique on Critup.ai'

  if (typeof navigator !== 'undefined' && typeof navigator.share === 'function') {
    try {
      await navigator.share({ title, text, url })
      return 'shared'
    } catch (e) {
      // The user dismissing the sheet rejects with AbortError — that's not a
      // failure, so don't fall back to copying.
      if (e instanceof Error && e.name === 'AbortError') return 'dismissed'
      // Any other error (e.g. share not actually permitted) → fall through.
    }
  }

  try {
    await navigator.clipboard.writeText(url)
  } catch {
    /* clipboard blocked — nothing more we can do */
  }
  return 'copied'
}
