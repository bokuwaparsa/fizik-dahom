// ─── فیزیک‌دهم · Curriculum registry & helpers ────────────────────────────────
'use client'

import type { Lesson, Unit, UnitId } from '@/lib/game/types'

import { lessonsCh1 } from '@/data/physics/ch1'
import { lessonsCh2 } from '@/data/physics/ch2'
import { lessonsCh3 } from '@/data/physics/ch3'
import { lessonsCh4 } from '@/data/physics/ch4'
import { lessonsCh5 } from '@/data/physics/ch5'

/** The 5 chapters of the Grade-10 physics textbook (فیزیک ۱). */
export const UNITS: Unit[] = [
  {
    id: 'ch1', title: 'فیزیک و اندازه‌گیری', tagline: 'فیزیک چیست و چگونه دقیق اندازه می‌گیریم؟',
    accent: 'text-orange-600 dark:text-orange-400', hex: '#ea580c',
    lessonIds: [...lessonsCh1].sort((a, b) => a.order - b.order).map((l) => l.id),
  },
  {
    id: 'ch2', title: 'ویژگی‌های فیزیکی مواد', tagline: 'حالت‌های ماده، فشار شاره‌ها، شناوری و برنولی',
    accent: 'text-teal-600 dark:text-teal-400', hex: '#0d9488',
    lessonIds: [...lessonsCh2].sort((a, b) => a.order - b.order).map((l) => l.id),
  },
  {
    id: 'ch3', title: 'کار، انرژی و توان', tagline: 'کار نیرو، انرژی جنبشی و پتانسیل، پایستگی و توان',
    accent: 'text-emerald-600 dark:text-emerald-400', hex: '#059669',
    lessonIds: [...lessonsCh3].sort((a, b) => a.order - b.order).map((l) => l.id),
  },
  {
    id: 'ch4', title: 'دما و گرما', tagline: 'دماسنجی، انبساط، تغییر حالت و قانون گازها',
    accent: 'text-rose-600 dark:text-rose-400', hex: '#e11d48',
    lessonIds: [...lessonsCh4].sort((a, b) => a.order - b.order).map((l) => l.id),
  },
  {
    id: 'ch5', title: 'ترمودینامیک', tagline: 'قانون اول و دوم، چرخه‌ها، ماشین گرمایی و یخچال',
    accent: 'text-violet-600 dark:text-violet-400', hex: '#7c3aed',
    lessonIds: [...lessonsCh5].sort((a, b) => a.order - b.order).map((l) => l.id),
  },
]

const ALL_LESSONS: Lesson[] = [
  ...lessonsCh1, ...lessonsCh2, ...lessonsCh3, ...lessonsCh4, ...lessonsCh5,
]

const LESSON_MAP = new Map<string, Lesson>(ALL_LESSONS.map((l) => [l.id, l]))

export function getLesson(id: string): Lesson | undefined {
  return LESSON_MAP.get(id)
}

export function getUnit(id: UnitId): Unit {
  return UNITS.find((u) => u.id === id) ?? UNITS[0]
}

export function allLessons(): Lesson[] {
  return UNITS.flatMap((u) => u.lessonIds.map((id) => LESSON_MAP.get(id)!)).filter(Boolean)
}

export function nextLessonAfter(id: string): Lesson | undefined {
  const list = allLessons()
  const i = list.findIndex((l) => l.id === id)
  return i >= 0 && i < list.length - 1 ? list[i + 1] : undefined
}

export function searchLessons(query: string, unit?: UnitId | 'all', difficulty?: string | 'all'): Lesson[] {
  const q = query.trim().toLowerCase()
  return allLessons().filter((l) => {
    if (unit && unit !== 'all' && l.unitId !== unit) return false
    if (difficulty && difficulty !== 'all' && l.difficulty !== difficulty) return false
    if (!q) return true
    const hay = [
      l.title, l.tagline, ...l.objectives,
      getUnit(l.unitId).title,
    ].join(' ').toLowerCase()
    return hay.includes(q)
  })
}

// ─── Textbook coverage map (کتاب درسی فیزیک ۱) ────────────────────────────────
// The 5 chapters of the official Grade-10 physics textbook and the lesson(s)
// that teach each one. Chapter titles follow the printed فهرست.
export interface BookChapter {
  ch: number
  title: string
  lessonIds: string[]
}

export const BOOK_CHAPTERS: BookChapter[] = [
  {
    ch: 1, title: 'فیزیک و اندازه‌گیری',
    lessonIds: ['u1-fundamental', 'u1-modeling', 'u1-quantities', 'u1-si-units', 'u1-precision', 'u1-density', 'u1-review'],
  },
  {
    ch: 2, title: 'ویژگی‌های فیزیکی مواد',
    lessonIds: ['u2-states', 'u2-intermolecular', 'u2-pressure', 'u2-buoyancy', 'u2-bernoulli', 'u2-review'],
  },
  {
    ch: 3, title: 'کار، انرژی و توان',
    lessonIds: ['u3-kinetic', 'u3-work', 'u3-work-ke', 'u3-pe', 'u3-conservation', 'u3-internal', 'u3-power', 'u3-review'],
  },
  {
    ch: 4, title: 'دما و گرما',
    lessonIds: ['u4-temperature', 'u4-expansion', 'u4-heat', 'u4-phase-change', 'u4-transfer', 'u4-gas-laws', 'u4-review'],
  },
  {
    ch: 5, title: 'ترمودینامیک',
    lessonIds: ['u5-state-eq', 'u5-exchange', 'u5-first-law', 'u5-processes', 'u5-cycle', 'u5-engine', 'u5-second-law', 'u5-fridge', 'u5-review'],
  },
]

export function bookChapterProgress(chapter: BookChapter, completed: Set<string>): 'done' | 'started' | 'todo' {
  const states = chapter.lessonIds.map((id) => completed.has(id))
  if (states.every(Boolean)) return 'done'
  if (states.some(Boolean)) return 'started'
  return 'todo'
}

// ─── Ranks & badges ──────────────────────────────────────────────────────────
export const RANKS = [
  'تازه‌کار آزمایشگاه', 'اندازه‌گیر', 'مشاهده‌گر', 'نیروسنج', 'انرژی‌شناس',
  'گرماسنج', 'پدیده‌شناس', 'ترمودینامیست', 'استاد فیزیک', 'افسانهٔ فیزیک',
]

export function levelFor(xp: number): number {
  return Math.floor(xp / 300) + 1
}

export function rankFor(xp: number): string {
  return RANKS[Math.min(levelFor(xp) - 1, RANKS.length - 1)]
}

export function xpIntoLevel(xp: number): number {
  return xp % 300
}

export interface SpecialBadge {
  id: string
  title: string
  description: string
  icon: string // lucide icon key handled in UI
}

export const SPECIAL_BADGES: SpecialBadge[] = [
  { id: 'first-lesson', title: 'اولین قدم', description: 'اولین درس را کامل کن', icon: 'Footprints' },
  { id: 'five-lessons', title: 'گرم شدی', description: '۵ درس را کامل کن', icon: 'CircleGauge' },
  { id: 'ten-lessons', title: 'نیمی از راه', description: '۱۰ درس را کامل کن', icon: 'Hill' },
  { id: 'twenty-lessons', title: 'پشتکار', description: '۲۰ درس را کامل کن', icon: 'Mountain' },
  { id: 'all-lessons', title: 'قهرمان فیزیک', description: 'همهٔ درس‌های بازی را کامل کن', icon: 'Trophy' },
  { id: 'perfect-quiz', title: 'بی‌نقص', description: 'در یک آزمون نمرهٔ کامل بگیر', icon: 'Sparkles' },
  { id: 'streak-3', title: 'سه روز پیاپی', description: '۳ روز پشت‌سرهم بازی کن', icon: 'Flame' },
  { id: 'sandbox-visitor', title: 'ذهن باز', description: 'به زمین بازی فیزیک سر بزن', icon: 'Wand2' },
]
