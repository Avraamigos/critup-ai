import { createContext, useContext, useEffect, useState } from 'react'

type Theme = 'dark' | 'light'

interface ThemeCtx {
  theme: Theme
  setTheme: (t: Theme) => void
  toggle: () => void
  isDark: boolean
}

const ThemeContext = createContext<ThemeCtx>({
  theme: 'dark',
  setTheme: () => {},
  toggle: () => {},
  isDark: true,
})

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setThemeState] = useState<Theme>(() => {
    try {
      return (localStorage.getItem('critup-theme') as Theme) || 'dark'
    } catch {
      return 'dark'
    }
  })

  const setTheme = (t: Theme) => {
    setThemeState(t)
    try { localStorage.setItem('critup-theme', t) } catch {}
  }

  const toggle = () => setTheme(theme === 'dark' ? 'light' : 'dark')

  useEffect(() => {
    document.body.className = theme === 'light' ? 'light' : ''
  }, [theme])

  return (
    <ThemeContext.Provider value={{ theme, setTheme, toggle, isDark: theme === 'dark' }}>
      {children}
    </ThemeContext.Provider>
  )
}

export const useTheme = () => useContext(ThemeContext)

export function useColors(theme: Theme) {
  const isDark = theme === 'dark'
  return {
    isDark,
    bg: isDark ? 'oklch(0.19 0.004 270)' : '#f8fafc',
    cardBg: isDark ? 'oklch(0.225 0.004 270)' : '#ffffff',
    sidebarBg: isDark ? 'oklch(0.21 0.004 270)' : '#f9fafb',
    border: isDark ? 'oklch(0.28 0.004 270)' : '#e5e7eb',
    textPrimary: isDark ? 'oklch(0.96 0 0)' : '#111827',
    textMuted: isDark ? 'oklch(0.65 0.005 270)' : '#6b7280',
    inputBg: isDark ? 'oklch(0.19 0.004 270)' : '#f9fafb',
    activeBg: isDark ? 'oklch(0.28 0.006 270)' : '#fff7ed',
    hoverBorder: 'oklch(0.72 0.18 45 / 0.35)',
    orange: '#F97316',
    green: 'oklch(0.72 0.17 145)',
    red: 'oklch(0.65 0.18 25)',
  }
}
