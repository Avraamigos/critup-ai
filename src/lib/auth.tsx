import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'
import type { User, Session } from '@supabase/supabase-js'
import { supabase, isSupabaseConfigured } from './supabase'
import type { Database } from './database.types'
import i18n from './i18n'
import { setSentryUser } from './sentry'

// Keep the UI language in sync with the profile's saved language (en/ru/tr).
function syncUiLanguage(profile: { language?: string | null } | null) {
  const lang = profile?.language ?? 'en'
  if (i18n.language !== lang) i18n.changeLanguage(lang)
}

type Profile = Database['public']['Tables']['profiles']['Row']

interface AuthState {
  user: User | null
  session: Session | null
  profile: Profile | null
  loading: boolean
}

interface AuthContext extends AuthState {
  signIn: (email: string, password: string) => Promise<{ error: string | null }>
  signUp: (email: string, password: string, fullName: string) => Promise<{ error: string | null }>
  signOut: () => void
  refreshProfile: () => Promise<void>
}

const ADMIN_EMAILS = ['ibro12345@icloud.com']

// Ensure admin accounts always have full Pro access regardless of DB state
function applyAdminOverride(user: User | null, profile: Profile | null): Profile | null {
  if (!profile || !user) return profile
  if (ADMIN_EMAILS.includes(user.email ?? '')) {
    return { ...profile, plan: 'monthly' as Profile['plan'] }
  }
  return profile
}

const Ctx = createContext<AuthContext | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AuthState>({
    user: null,
    session: null,
    profile: null,
    loading: true,
  })

  // IMPORTANT: fetchProfile must NOT be called inside the onAuthStateChange callback
  // because Supabase holds the auth lock for the entire duration of async callbacks.
  // Awaiting a network call there deadlocks signOut (which also needs the lock).
  const fetchProfile = async (user: User): Promise<Profile | null> => {
    try {
      const { data } = await Promise.race([
        Promise.resolve(supabase.from('profiles').select('*').eq('id', user.id).single()),
        new Promise<never>((_, reject) =>
          setTimeout(() => reject(new Error('profile fetch timeout')), 8_000)
        ),
      ])
      if (data) return data

      // No profile — Google OAuth new user. Create one from their Google metadata.
      const fullName = (user.user_metadata?.full_name as string | undefined)
        || (user.user_metadata?.name as string | undefined)
        || ''
      const { data: created } = await supabase.from('profiles').insert({
        id: user.id,
        full_name: fullName,
        plan: 'free',
        language: 'en',
        analyses_used: 0,
        onboarding_complete: false,
      }).select().single()
      return created ?? null
    } catch {
      return null
    }
  }

  useEffect(() => {
    if (!isSupabaseConfigured) {
      setState(s => ({ ...s, loading: false }))
      return
    }

    // Use ONLY onAuthStateChange — it fires INITIAL_SESSION immediately on
    // subscription with the cached session from localStorage. Using getSession()
    // in parallel caused a double-fire: two different User object references for
    // the same user, making useEffect([user]) in child components run twice and
    // briefly clear their state (the "dashboard goes empty" bug).
    //
    // CRITICAL: this callback must be synchronous (no await inside).
    // Supabase holds the auth lock for the duration of async callbacks — awaiting
    // fetchProfile() here keeps the lock held, which deadlocks signOut().
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      // Update user + loading immediately (synchronous) — lock released right away
      setState(s => ({ ...s, user: session?.user ?? null, session, loading: false }))
      if (session?.user) {
        // Tag Sentry with the logged-in user
        setSentryUser(session.user.id, session.user.email)
        // Fetch profile OUTSIDE the auth lock via .then() — never blocks lock
        const sessionUser = session.user
        fetchProfile(sessionUser).then(profile => {
          const resolved = applyAdminOverride(sessionUser, profile)
          syncUiLanguage(resolved)
          setState(s => ({ ...s, profile: resolved }))
        })
      } else {
        setSentryUser(null)
        setState(s => ({ ...s, profile: null }))
      }
    })

    return () => subscription.unsubscribe()
  }, [])

  const signIn = async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    return { error: error?.message ?? null }
  }

  const signUp = async (email: string, password: string, fullName: string) => {
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: { data: { full_name: fullName } },
    })
    if (error) return { error: error.message }

    // Create profile row
    if (data.user) {
      await supabase.from('profiles').insert({
        id: data.user.id,
        full_name: fullName,
        plan: 'free',
        language: 'en',
        analyses_used: 0,
      })
    }
    return { error: null }
  }

  const signOut = () => {
    // scope:'local' clears localStorage and fires SIGNED_OUT via onAuthStateChange
    // before the Promise resolves, so awaiting is unnecessary — and dangerous,
    // because the auth lock might be held by a concurrent operation (e.g. a
    // slow token-refresh). Fire-and-forget is safe here.
    supabase.auth.signOut({ scope: 'local' }).catch(() => {})
  }

  const refreshProfile = async () => {
    if (state.user) {
      const profile = await fetchProfile(state.user)
      const resolved = applyAdminOverride(state.user, profile ?? null)
      syncUiLanguage(resolved)
      setState(s => ({ ...s, profile: resolved }))
    }
  }

  return (
    <Ctx.Provider value={{ ...state, signIn, signUp, signOut, refreshProfile }}>
      {children}
    </Ctx.Provider>
  )
}

export function useAuth() {
  const ctx = useContext(Ctx)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}

// Guard hook — redirects to /login if not authenticated
export function useRequireAuth() {
  const auth = useAuth()
  return auth
}
