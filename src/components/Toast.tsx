import { useState, useEffect, useCallback, createContext, useContext } from 'react'
import { CheckCircle2, XCircle, AlertTriangle, Info, X } from 'lucide-react'

// ─── Types ────────────────────────────────────────────────────────────────────

export type ToastType = 'success' | 'error' | 'warning' | 'info'

export interface ToastItem {
  id: string
  type: ToastType
  message: string
  duration?: number
}

type ToastContextValue = {
  toast: (message: string, type?: ToastType, duration?: number) => void
  success: (message: string, duration?: number) => void
  error: (message: string, duration?: number) => void
  warning: (message: string, duration?: number) => void
  info: (message: string, duration?: number) => void
}

// ─── Context ──────────────────────────────────────────────────────────────────

const ToastContext = createContext<ToastContextValue | null>(null)

export function useToast(): ToastContextValue {
  const ctx = useContext(ToastContext)
  if (!ctx) throw new Error('useToast must be used inside ToastProvider')
  return ctx
}

// ─── Individual toast ─────────────────────────────────────────────────────────

const STYLES: Record<ToastType, { bg: string; border: string; icon: string; iconColor: string }> = {
  success: { bg: 'oklch(0.15 0.02 145)',  border: 'oklch(0.72 0.17 145 / 0.5)', icon: 'success',  iconColor: 'oklch(0.72 0.17 145)' },
  error:   { bg: 'oklch(0.15 0.04 25)',   border: 'oklch(0.65 0.18 25 / 0.5)',  icon: 'error',    iconColor: 'oklch(0.65 0.18 25)'  },
  warning: { bg: 'oklch(0.15 0.03 60)',   border: 'oklch(0.72 0.18 45 / 0.5)', icon: 'warning',  iconColor: '#F97316'               },
  info:    { bg: 'oklch(0.15 0.02 250)',  border: 'oklch(0.6 0.18 250 / 0.5)', icon: 'info',     iconColor: 'oklch(0.6 0.18 250)'  },
}

function ToastIcon({ type }: { type: ToastType }) {
  const color = STYLES[type].iconColor
  const size = 16
  if (type === 'success') return <CheckCircle2 size={size} color={color} style={{ flexShrink: 0 }} />
  if (type === 'error')   return <XCircle      size={size} color={color} style={{ flexShrink: 0 }} />
  if (type === 'warning') return <AlertTriangle size={size} color={color} style={{ flexShrink: 0 }} />
  return <Info size={size} color={color} style={{ flexShrink: 0 }} />
}

function ToastCard({ item, onDismiss }: { item: ToastItem; onDismiss: (id: string) => void }) {
  const [visible, setVisible] = useState(false)
  const s = STYLES[item.type]

  useEffect(() => {
    // Tiny delay so the enter animation fires after mount
    const t = setTimeout(() => setVisible(true), 10)
    return () => clearTimeout(t)
  }, [])

  const dismiss = useCallback(() => {
    setVisible(false)
    setTimeout(() => onDismiss(item.id), 250)
  }, [item.id, onDismiss])

  useEffect(() => {
    const dur = item.duration ?? (item.type === 'error' ? 5000 : 3500)
    const t = setTimeout(dismiss, dur)
    return () => clearTimeout(t)
  }, [dismiss, item.duration, item.type])

  return (
    <div
      style={{
        display: 'flex', alignItems: 'flex-start', gap: 10,
        padding: '12px 14px',
        background: s.bg,
        border: `1px solid ${s.border}`,
        borderRadius: 12,
        maxWidth: 360, width: '100%',
        boxShadow: '0 8px 32px rgba(0,0,0,0.4)',
        backdropFilter: 'blur(12px)',
        opacity: visible ? 1 : 0,
        transform: visible ? 'translateY(0) scale(1)' : 'translateY(12px) scale(0.96)',
        transition: 'opacity 0.22s ease, transform 0.22s cubic-bezier(0.16,1,0.3,1)',
        pointerEvents: 'auto',
      }}
    >
      <ToastIcon type={item.type} />
      <p style={{ flex: 1, margin: 0, fontSize: 13, color: '#f1f5f9', lineHeight: 1.5, wordBreak: 'break-word' }}>
        {item.message}
      </p>
      <button
        onClick={dismiss}
        style={{
          background: 'none', border: 'none', cursor: 'pointer',
          color: 'rgba(255,255,255,0.4)', padding: 0, flexShrink: 0,
          display: 'flex', marginTop: 1, transition: 'color 0.15s',
        }}
        onMouseEnter={e => (e.currentTarget.style.color = 'rgba(255,255,255,0.8)')}
        onMouseLeave={e => (e.currentTarget.style.color = 'rgba(255,255,255,0.4)')}
      >
        <X size={14} />
      </button>
    </div>
  )
}

// ─── Provider ─────────────────────────────────────────────────────────────────

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([])

  const dismiss = useCallback((id: string) => {
    setToasts(prev => prev.filter(t => t.id !== id))
  }, [])

  const toast = useCallback((message: string, type: ToastType = 'info', duration?: number) => {
    const id = Math.random().toString(36).slice(2)
    setToasts(prev => [...prev.slice(-4), { id, type, message, duration }])
  }, [])

  const success = useCallback((msg: string, dur?: number) => toast(msg, 'success', dur), [toast])
  const error   = useCallback((msg: string, dur?: number) => toast(msg, 'error',   dur), [toast])
  const warning = useCallback((msg: string, dur?: number) => toast(msg, 'warning', dur), [toast])
  const info    = useCallback((msg: string, dur?: number) => toast(msg, 'info',    dur), [toast])

  return (
    <ToastContext.Provider value={{ toast, success, error, warning, info }}>
      {children}

      {/* Portal — fixed bottom-center, above everything */}
      <div style={{
        position: 'fixed', bottom: 24, left: '50%', transform: 'translateX(-50%)',
        zIndex: 9999, display: 'flex', flexDirection: 'column', gap: 8,
        alignItems: 'center', pointerEvents: 'none',
        width: '100%', maxWidth: 400, padding: '0 16px',
        boxSizing: 'border-box',
      }}>
        {toasts.map(item => (
          <ToastCard key={item.id} item={item} onDismiss={dismiss} />
        ))}
      </div>
    </ToastContext.Provider>
  )
}
