// English — canonical source of truth for all UI strings.
// ru.ts and tr.ts are typed against `typeof en`, so TypeScript forces every key
// to exist in all three languages. Add new keys here first.
export const en = {
  common: {
    save: 'Save',
    saved: 'Saved!',
    saving: 'Saving…',
    cancel: 'Cancel',
    delete: 'Delete',
    edit: 'Edit',
    close: 'Close',
    back: 'Back',
    next: 'Next',
    continue: 'Continue',
    loading: 'Loading…',
    retry: 'Retry',
    confirm: 'Confirm',
    submit: 'Submit',
    upgrade: 'Upgrade',
    free: 'Free',
    pro: 'Pro',
  },
  nav: {
    dashboard: 'Dashboard',
    projects: 'Projects',
    analysis: 'Analysis',
    feed: 'Community',
    jury: 'Jury',
    settings: 'Settings',
    help: 'Help',
    pricing: 'Pricing',
    admin: 'Admin',
    signOut: 'Sign out',
  },
  appShell: {
    freePlan: 'FREE PLAN',
    analyses: 'Analyses',
    usedCount: '{{used}}/1 used',
    upgradeToPro: 'Upgrade to Pro →',
    profile: 'Profile',
    myProjects: 'My Projects',
    upgradeProMenu: 'Upgrade to Pro',
    upgradeYearlyMenu: 'Upgrade to Yearly',
  },
}

export type TranslationSchema = typeof en
