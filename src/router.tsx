import { createRootRoute, createRoute, createRouter, lazyRouteComponent, Outlet } from '@tanstack/react-router'
import { AppShell } from '@/components/AppShell'
import { ThemeProvider } from '@/lib/theme'

// Pages are code-split: each route loads its own chunk on first visit, so the
// initial bundle doesn't ship PDF.js, the admin panel, etc. to every visitor.
// lazyRouteComponent(importer, exportName) handles the named exports.
const page = <T extends string>(importer: () => Promise<Record<string, unknown>>, exportName: T) =>
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  lazyRouteComponent(importer as any, exportName as any)

// Root route
const rootRoute = createRootRoute({
  component: () => (
    <ThemeProvider>
      <Outlet />
    </ThemeProvider>
  ),
})

// App shell layout route (wraps all authenticated pages)
const appRoute = createRoute({
  getParentRoute: () => rootRoute,
  id: 'app',
  component: () => (
    <AppShell>
      <Outlet />
    </AppShell>
  ),
})

// Fullscreen routes (no AppShell)
const landingRoute = createRoute({ getParentRoute: () => rootRoute, path: '/landing', component: page(() => import('@/routes/landing'), 'LandingPage') })
const loginRoute = createRoute({ getParentRoute: () => rootRoute, path: '/login', component: page(() => import('@/routes/login'), 'LoginPage') })
const signupRoute = createRoute({ getParentRoute: () => rootRoute, path: '/signup', component: page(() => import('@/routes/signup'), 'SignupPage') })
const onboardingRoute = createRoute({ getParentRoute: () => rootRoute, path: '/onboarding', component: page(() => import('@/routes/onboarding'), 'OnboardingPage') })
const pricingRoute = createRoute({ getParentRoute: () => rootRoute, path: '/pricing', component: page(() => import('@/routes/pricing'), 'PricingPage') })
const newProjectRoute = createRoute({ getParentRoute: () => rootRoute, path: '/projects/new', component: page(() => import('@/routes/projects.new'), 'NewProjectPage') })
const analysisLoadingRoute = createRoute({ getParentRoute: () => rootRoute, path: '/analysis/loading', component: page(() => import('@/routes/analysis.loading'), 'AnalysisLoadingPage') })
const privacyRoute   = createRoute({ getParentRoute: () => rootRoute, path: '/privacy',    component: page(() => import('@/routes/privacy'), 'PrivacyPage') })
const termsRoute     = createRoute({ getParentRoute: () => rootRoute, path: '/terms',      component: page(() => import('@/routes/terms'), 'TermsPage') })
const meetCritRoute  = createRoute({ getParentRoute: () => rootRoute, path: '/meet-crit',  component: page(() => import('@/routes/meet-crit'), 'MeetCritPage') })
const resetPasswordRoute = createRoute({ getParentRoute: () => rootRoute, path: '/reset-password', component: page(() => import('@/routes/reset-password'), 'ResetPasswordPage') })
const postRoute = createRoute({ getParentRoute: () => rootRoute, path: '/p/$analysisId', component: page(() => import('@/routes/post'), 'PostPage') })
const showcaseRoute  = createRoute({ getParentRoute: () => rootRoute, path: '/showcase', component: page(() => import('@/routes/showcase'), 'ShowcasePage') })
const notFoundRoute  = createRoute({ getParentRoute: () => rootRoute, path: '*', component: page(() => import('@/routes/not-found'), 'NotFoundPage') })

// App shell routes
const dashboardRoute = createRoute({ getParentRoute: () => appRoute, path: '/', component: page(() => import('@/routes/dashboard'), 'DashboardPage') })
const projectsRoute = createRoute({ getParentRoute: () => appRoute, path: '/projects', component: page(() => import('@/routes/projects'), 'ProjectsPage') })
const analysisRoute = createRoute({ getParentRoute: () => appRoute, path: '/analysis/$projectId', component: page(() => import('@/routes/analysis'), 'AnalysisPage') })
const juryRoute = createRoute({ getParentRoute: () => appRoute, path: '/jury', component: page(() => import('@/routes/jury'), 'JuryPage') })
const feedRoute = createRoute({ getParentRoute: () => appRoute, path: '/feed', component: page(() => import('@/routes/feed'), 'FeedPage') })
const assistantRoute = createRoute({ getParentRoute: () => appRoute, path: '/assistant', component: page(() => import('@/routes/assistant'), 'AssistantPage') })
const settingsRoute = createRoute({ getParentRoute: () => appRoute, path: '/settings', component: page(() => import('@/routes/settings'), 'SettingsPage') })
const helpRoute  = createRoute({ getParentRoute: () => appRoute, path: '/help',  component: page(() => import('@/routes/help'), 'HelpPage') })
const adminRoute = createRoute({ getParentRoute: () => appRoute, path: '/admin', component: page(() => import('@/routes/admin'), 'AdminPage') })
const competitionsRoute = createRoute({ getParentRoute: () => appRoute, path: '/competitions', component: page(() => import('@/routes/competitions'), 'CompetitionsPage') })

const routeTree = rootRoute.addChildren([
  appRoute.addChildren([
    dashboardRoute,
    projectsRoute,
    analysisRoute,
    juryRoute,
    feedRoute,
    competitionsRoute,
    assistantRoute,
    settingsRoute,
    helpRoute,
    adminRoute,
  ]),
  landingRoute,
  loginRoute,
  signupRoute,
  onboardingRoute,
  pricingRoute,
  newProjectRoute,
  analysisLoadingRoute,
  privacyRoute,
  termsRoute,
  meetCritRoute,
  resetPasswordRoute,
  postRoute,
  showcaseRoute,
  notFoundRoute,
])

export const router = createRouter({ routeTree })

declare module '@tanstack/react-router' {
  interface Register {
    router: typeof router
  }
}
