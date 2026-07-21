import i18n from 'i18next'
import { initReactI18next } from 'react-i18next'
import { en } from '@/locales/en'
import { ru } from '@/locales/ru'
import { tr } from '@/locales/tr'
import { es } from '@/locales/es'
import { fr } from '@/locales/fr'
import { de } from '@/locales/de'
import { pt } from '@/locales/pt'
import { ar } from '@/locales/ar'

// Single flat namespace ('translation'). Keys are dotted strings like
// 'nav.dashboard'. The app language is driven by profiles.language (en/ru/tr) —
// see auth.tsx, which calls i18n.changeLanguage() whenever the profile loads or
// the user changes it in Settings. English is the fallback for any missing key.
export const SUPPORTED_LANGUAGES = ['en', 'ru', 'tr', 'es', 'fr', 'de', 'pt', 'ar'] as const
export type AppLanguage = (typeof SUPPORTED_LANGUAGES)[number]

// Languages whose interface is fully translated. Others (none currently) fall
// back to English UI while the AI still responds in the chosen language.
export const RTL_LANGUAGES = ['ar'] as const

i18n.use(initReactI18next).init({
  resources: {
    en: { translation: en },
    ru: { translation: ru },
    tr: { translation: tr },
    es: { translation: es },
    fr: { translation: fr },
    de: { translation: de },
    pt: { translation: pt },
    ar: { translation: ar },
  },
  lng: 'en',
  fallbackLng: 'en',
  interpolation: { escapeValue: false },
  returnEmptyString: false,
})

// Keep the document direction/lang in sync with the active language so Arabic
// (and any future RTL locale) renders right-to-left. Runs on init and on every
// changeLanguage() call, so both the auth-profile sync and the Settings picker
// are covered without duplicating this logic.
function applyDirection(lng: string) {
  if (typeof document === 'undefined') return
  const isRtl = (RTL_LANGUAGES as readonly string[]).includes(lng)
  document.documentElement.dir = isRtl ? 'rtl' : 'ltr'
  document.documentElement.lang = lng
}
applyDirection(i18n.language)
i18n.on('languageChanged', applyDirection)

export default i18n
