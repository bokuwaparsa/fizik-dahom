// ─── Math Quest · Localized curriculum hooks ───────────────────────────────
'use client'

import { useMemo } from 'react'
import { useI18n, type Locale } from './i18n'
import { allLessons, UNITS, RANKS, SPECIAL_BADGES, levelFor } from './curriculum'
import { localizedUnit, localizedRank } from './translate'
import type { Lesson, Unit, Difficulty } from './types'

/** All lessons (single-locale: content is written in Persian). */
export function lessonsFor(_locale: Locale): Lesson[] {
  return allLessons()
}

export function useLessons(): Lesson[] {
  const { locale } = useI18n()
  return useMemo(() => lessonsFor(locale), [locale])
}

export function useLesson(id: string): Lesson | undefined {
  const lessons = useLessons()
  return useMemo(() => lessons.find((l) => l.id === id), [lessons, id])
}

export function useUnits(): Unit[] {
  const { locale, t } = useI18n()
  return useMemo(
    () => UNITS.map((u) => localizedUnit(u, (key, fallback) => {
      const v = t(key)
      return v === key ? fallback : v
    })),
    [locale, t],
  )
}

export function useUnit(id: string): Unit {
  const units = useUnits()
  return units.find((u) => u.id === id) ?? units[0]
}

export function useRankFor(xp: number): string {
  const { t } = useI18n()
  const level = levelFor(xp)
  const base = RANKS[Math.min(level - 1, RANKS.length - 1)]
  return localizedRank(base, level, (key, fallback) => {
    const v = t(key)
    return v === key ? fallback : v
  })
}

export function useDifficultyLabel(): Record<Difficulty, string> {
  const { t } = useI18n()
  return useMemo(() => ({
    easy: t('diff.easy'),
    standard: t('diff.standard'),
    challenge: t('diff.challenge'),
  }), [t])
}

/** Special badges with localized title/description (keys: badge.<id>.title / .description). */
export function useSpecialBadges() {
  const { t } = useI18n()
  return useMemo(
    () => SPECIAL_BADGES.map((b) => ({
      ...b,
      title: t(`badge.${b.id}.title`),
      description: t(`badge.${b.id}.description`),
    })),
    [t],
  )
}
