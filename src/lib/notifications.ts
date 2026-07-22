// Desktop notification for "analysis complete" — the one notification that is
// both useful and achievable client-side. The analysis page polls while a
// critique is processing; when it flips to complete we fire this so a user who
// switched away gets pinged. Everything is best-effort and never throws.
import i18n from './i18n'

const PREF_KEY = 'critup_notif_analysis'

// Default ON. Stored per-browser (matches desktop notifications being per-device).
export function analysisNotifEnabled(): boolean {
  if (typeof window === 'undefined') return false
  return localStorage.getItem(PREF_KEY) !== 'off'
}

export function setAnalysisNotifEnabled(on: boolean): void {
  if (typeof window === 'undefined') return
  localStorage.setItem(PREF_KEY, on ? 'on' : 'off')
}

export function notifyAnalysisComplete(projectName: string): void {
  if (typeof window === 'undefined' || !('Notification' in window)) return
  if (Notification.permission !== 'granted' || !analysisNotifEnabled()) return
  // Don't interrupt someone who's actively looking at the page.
  if (document.visibilityState === 'visible' && document.hasFocus()) return
  try {
    const n = new Notification(i18n.t('settings.notifAnalysis'), {
      body: projectName,
      tag: 'critup-analysis',       // collapse repeats into one
    })
    n.onclick = () => { window.focus(); n.close() }
  } catch {
    /* some browsers throw if invoked outside a user gesture — ignore */
  }
}
