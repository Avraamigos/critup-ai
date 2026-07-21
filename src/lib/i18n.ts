import i18n from 'i18next'
import { initReactI18next } from 'react-i18next'
import { en } from '@/locales/en'
import { ru } from '@/locales/ru'
import { tr } from '@/locales/tr'
import { es } from '@/locales/es'

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
  },
  lng: 'en',
  fallbackLng: 'en',
  interpolation: { escapeValue: false },
  returnEmptyString: false,
})

export default i18n
