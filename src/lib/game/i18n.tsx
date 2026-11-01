// ─── Math Quest · i18n core: locale store, dictionaries, term glossary ────────
'use client'

import { useSyncExternalStore, useMemo } from 'react'
import { fa } from './dict/fa'
import { termsFa } from './dict/terms-fa'

export type Locale = 'fa'

export const LOCALES: { id: Locale; native: string; english: string }[] = [
  { id: 'fa', native: 'فارسی', english: 'Persian' },
]

const DICTS: Record<Locale, Record<string, string>> = { fa }

/** Sim vocabulary used by shared controls (English label → translation). */
const TERMS: Partial<Record<Locale, Record<string, string>>> = {
  fa: termsFa,
}

export const LOCALE_KEY = 'mq.locale'

export function dirFor(locale: Locale): 'ltr' | 'rtl' {
  return locale === 'fa' ? 'rtl' : 'ltr'
}

/**
 * Mirror the locale into a cookie so the server can render <html lang/dir>
 * correctly on the next visit (localStorage is not visible to SSR).
 */
function persistCookie(locale: Locale) {
  try {
    document.cookie = `${LOCALE_KEY}=${locale};path=/;max-age=31536000;samesite=lax`
  } catch { /* storage unavailable */ }
}

// ─── Tiny external store (single-locale: 'fa' everywhere, always)
let storeLocale: Locale = 'fa'
const listeners = new Set<() => void>()

function applyDocument(locale: Locale) {
  if (typeof document === 'undefined') return
  document.documentElement.lang = locale
  document.documentElement.dir = dirFor(locale)
}

/** Switch locale, persist it, sync <html lang/dir>, notify subscribers. */
export function setLocale(locale: Locale) {
  if (locale === storeLocale) return
  storeLocale = locale
  try { window.localStorage.setItem(LOCALE_KEY, locale) } catch { /* storage unavailable */ }
  persistCookie(locale)
  applyDocument(locale)
  listeners.forEach((l) => l())
}

function subscribe(cb: () => void) {
  listeners.add(cb)
  return () => { listeners.delete(cb) }
}

/** Math Quest ships in Persian only. */
function detectLocale(): Locale {
  return 'fa'
}

export interface I18n {
  locale: Locale
  setLocale: (l: Locale) => void
  /** Translate a UI dictionary key, with {var} interpolation. Falls back to the key. */
  t: (key: string, vars?: Record<string, string | number>) => string
  /** Translate a sim/term given in its English form. Falls back to the English term. */
  simT: (label: string) => string
  dir: 'ltr' | 'rtl'
}

function makeI18n(locale: Locale): I18n {
  return {
    locale,
    dir: dirFor(locale),
    setLocale,
    t: (key, vars) => {
      let s = DICTS[locale]?.[key] ?? key
      if (vars) {
        for (const [k, v] of Object.entries(vars)) s = s.split(`{${k}}`).join(String(v))
      }
      return s
    },
    simT: (label) => TERMS[locale]?.[label] ?? label,
  }
}

const I18N_INSTANCES: Partial<Record<Locale, I18n>> = {}

/** Hydration-safe i18n hook: renders 'fa' during SSR and on the client alike. */
export function useI18n(): I18n {
  const locale = useSyncExternalStore(
    subscribe,
    () => storeLocale,
    () => 'fa' as Locale,
  )
  return useMemo(() => {
    I18N_INSTANCES[locale] ??= makeI18n(locale)
    return I18N_INSTANCES[locale] as I18n
  }, [locale])
}

/** One-time bootstrap: keep <html lang/dir> in sync (Persian only). */
export function bootstrapLocale() {
  persistCookie(storeLocale)
  applyDocument(storeLocale)
}
