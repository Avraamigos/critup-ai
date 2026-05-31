// Plausible custom events
// Script is loaded in index.html — this just wraps window.plausible()

type PlausibleFn = (event: string, options?: { props?: Record<string, string | number | boolean> }) => void

declare global {
  interface Window {
    plausible?: PlausibleFn
  }
}

export function trackEvent(event: string, props?: Record<string, string | number | boolean>) {
  try {
    window.plausible?.(event, props ? { props } : undefined)
  } catch {
    // silently ignore — analytics must never break the app
  }
}

// Typed helpers for all app events
export const track = {
  signedUp: (method: 'email' | 'google') => trackEvent('signed_up', { method }),
  analysisCreated: (projectId: string) => trackEvent('analysis_created', { projectId }),
  upgradeClicked: (source: string) => trackEvent('upgrade_clicked', { source }),
  juryStarted: (projectId: string) => trackEvent('jury_started', { projectId }),
  pdfExported: (projectId: string) => trackEvent('pdf_exported', { projectId }),
  postedToCommunity: (analysisId: string) => trackEvent('posted_to_community', { analysisId }),
}
