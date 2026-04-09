import { create } from 'zustand'
import { en } from './en'
import { zh } from './zh'

export type Locale = 'en' | 'zh'

const translations = { en, zh }

type LocaleStore = {
  locale: Locale
  setLocale: (l: Locale) => void
}

const savedLocale = (localStorage.getItem('claude_locale') as Locale) || 'zh'

export const useLocaleStore = create<LocaleStore>((set) => ({
  locale: savedLocale,
  setLocale: (l) => {
    localStorage.setItem('claude_locale', l)
    set({ locale: l })
  },
}))

export function useT() {
  const locale = useLocaleStore((s) => s.locale)
  return translations[locale]
}
