import { createRootRoute, createRoute, createRouter, Outlet } from '@tanstack/react-router'
import { AppShell } from '@/components/AppShell'
import { ThemeProvider } from '@/lib/theme'

// Pages
import { DashboardPage } from '@/routes/dashboard'
import { LandingPage } from '@/routes/landing'
import { LoginPage } from '@/routes/login'
import { SignupPage } from '@/routes/signup'
import { OnboardingPage } from '@/routes/onboarding'
import { PricingPage } from '@/routes/pricing'
import { ProjectsPage } from '@/routes/projects'
import { NewProjectPage } from '@/routes/projects.new'
import { AnalysisPage } from '@/routes/analysis'
import { AnalysisLoadingPage } from '@/routes/analysis.loading'
import { JuryPage } from '@/routes/jury'
import { AssistantPage } from '@/routes/assistant'
import { SettingsPage } from '@/routes/settings'
import { HelpPage } from '@/routes/help'
import { PrivacyPage } from '@/routes/privacy'
import { TermsPage } from '@/routes/terms'
import { MeetCritPage } from '@/routes/meet-crit'

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
const landingRoute = createRoute({ getParentRoute: () => rootRoute, path: '/landing', component: LandingPage })
const loginRoute = createRoute({ getParentRoute: () => rootRoute, path: '/login', component: LoginPage })
const signupRoute = createRoute({ getParentRoute: () => rootRoute, path: '/signup', component: SignupPage })
const onboardingRoute = createRoute({ getParentRoute: () => rootRoute, path: '/onboarding', component: OnboardingPage })
const pricingRoute = createRoute({ getParentRoute: () => rootRoute, path: '/pricing', component: PricingPage })
const newProjectRoute = createRoute({ getParentRoute: () => rootRoute, path: '/projects/new', component: NewProjectPage })
const analysisLoadingRoute = createRoute({ getParentRoute: () => rootRoute, path: '/analysis/loading', component: AnalysisLoadingPage })
const privacyRoute   = createRoute({ getParentRoute: () => rootRoute, path: '/privacy',    component: PrivacyPage })
const termsRoute     = createRoute({ getParentRoute: () => rootRoute, path: '/terms',      component: TermsPage })
const meetCritRoute  = createRoute({ getParentRoute: () => rootRoute, path: '/meet-crit',  component: MeetCritPage })

// App shell routes
const dashboardRoute = createRoute({ getParentRoute: () => appRoute, path: '/', component: DashboardPage })
const projectsRoute = createRoute({ getParentRoute: () => appRoute, path: '/projects', component: ProjectsPage })
const analysisRoute = createRoute({ getParentRoute: () => appRoute, path: '/analysis/$projectId', component: AnalysisPage })
const juryRoute = createRoute({ getParentRoute: () => appRoute, path: '/jury', component: JuryPage })
const assistantRoute = createRoute({ getParentRoute: () => appRoute, path: '/assistant', component: AssistantPage })
const settingsRoute = createRoute({ getParentRoute: () => appRoute, path: '/settings', component: SettingsPage })
const helpRoute = createRoute({ getParentRoute: () => appRoute, path: '/help', component: HelpPage })

const routeTree = rootRoute.addChildren([
  appRoute.addChildren([
    dashboardRoute,
    projectsRoute,
    analysisRoute,
    juryRoute,
    assistantRoute,
    settingsRoute,
    helpRoute,
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
])

export const router = createRouter({ routeTree })

declare module '@tanstack/react-router' {
  interface Register {
    router: typeof router
  }
}
