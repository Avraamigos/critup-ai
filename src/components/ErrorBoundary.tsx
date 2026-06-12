import { Component, type ReactNode } from 'react'
import * as Sentry from '@sentry/react'

// Top-level error boundary: a render crash anywhere in the tree shows this
// card instead of a white screen. Copy is hardcoded (not i18n) because the
// crash may have happened before/inside the i18n provider.
export class ErrorBoundary extends Component<{ children: ReactNode }, { hasError: boolean }> {
  state = { hasError: false }

  static getDerivedStateFromError() {
    return { hasError: true }
  }

  componentDidCatch(error: unknown) {
    Sentry.captureException(error)
  }

  render() {
    if (!this.state.hasError) return this.props.children
    return (
      <div style={{
        minHeight: '100vh', display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'center', gap: 14, padding: 24,
        background: 'oklch(0.175 0.004 270)', color: '#fff', textAlign: 'center',
        fontFamily: "-apple-system, BlinkMacSystemFont, 'SF Pro Display', 'Inter', sans-serif",
      }}>
        <div style={{ fontSize: 40 }}>🛠️</div>
        <h1 style={{ fontSize: 20, fontWeight: 700, margin: 0 }}>Something went wrong</h1>
        <p style={{ fontSize: 14, color: 'oklch(0.65 0.004 270)', margin: 0, maxWidth: 360, lineHeight: 1.5 }}>
          The error has been reported automatically. Reloading usually fixes it.
        </p>
        <button
          onClick={() => window.location.reload()}
          style={{
            marginTop: 6, padding: '10px 26px', borderRadius: 100, border: 'none',
            background: '#F97316', color: '#fff', fontSize: 14, fontWeight: 600, cursor: 'pointer',
          }}
        >
          Reload
        </button>
      </div>
    )
  }
}
