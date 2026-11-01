// ─── فیزیک‌دهم · Local progress store (localStorage via zustand persist) ──────
'use client'

import { create } from 'zustand'
import { persist } from 'zustand/middleware'

export interface LessonProgress {
  practiceDone: boolean
  /** best quiz score in percent (0–100) */
  quizBest: number
  attempts: number
  /** mastered = quizBest >= pass mark */
  completed: boolean
  /** XP earned so far in this lesson (max = lesson.xp) */
  xp: number
}

interface GameState {
  lessons: Record<string, LessonProgress>
  xp: number
  streak: number
  lastDay: string
  specialBadges: string[]
  reducedMotion: boolean
  soundOn: boolean
  // actions
  getLesson: (id: string) => LessonProgress | undefined
  markPracticeDone: (lessonId: string, xpReward: number) => void
  recordQuiz: (lessonId: string, pct: number, quizXpMax: number) => { xpGain: number; newlyMastered: boolean }
  touchDay: () => void
  awardSpecial: (badgeId: string) => boolean
  setReducedMotion: (v: boolean) => void
  setSoundOn: (v: boolean) => void
  resetAll: () => void
}

const PASS_MARK = 70

function todayKey(): string {
  // local-date key, e.g. "2025-06-01"
  const d = new Date()
  const m = `${d.getMonth() + 1}`.padStart(2, '0')
  const day = `${d.getDate()}`.padStart(2, '0')
  return `${d.getFullYear()}-${m}-${day}`
}

function yesterdayKey(): string {
  const d = new Date()
  d.setDate(d.getDate() - 1)
  const m = `${d.getMonth() + 1}`.padStart(2, '0')
  const day = `${d.getDate()}`.padStart(2, '0')
  return `${d.getFullYear()}-${m}-${day}`
}

export const PASS_PERCENT = PASS_MARK

export const useGame = create<GameState>()(
  persist(
    (set, get) => ({
      lessons: {},
      xp: 0,
      streak: 0,
      lastDay: '',
      specialBadges: [],
      reducedMotion: false,
      soundOn: false,

      getLesson: (id) => get().lessons[id],

      markPracticeDone: (lessonId, xpReward) => {
        const prev = get().lessons[lessonId] ?? {
          practiceDone: false, quizBest: 0, attempts: 0, completed: false, xp: 0,
        }
        if (prev.practiceDone) return
        const next: LessonProgress = { ...prev, practiceDone: true, xp: prev.xp + xpReward }
        set((s) => ({ lessons: { ...s.lessons, [lessonId]: next }, xp: s.xp + xpReward }))
        get().touchDay()
      },

      recordQuiz: (lessonId, pct, quizXpMax) => {
        const prev = get().lessons[lessonId] ?? {
          practiceDone: false, quizBest: 0, attempts: 0, completed: false, xp: 0,
        }
        const best = Math.max(prev.quizBest, Math.round(pct))
        const newXpForQuiz = Math.round((quizXpMax * best) / 100)
        const xpGain = Math.max(0, newXpForQuiz - prev.xp + (prev.practiceDone ? 0 : 0))
        const wasCompleted = prev.completed
        const completed = best >= PASS_MARK
        const next: LessonProgress = {
          ...prev,
          quizBest: best,
          attempts: prev.attempts + 1,
          completed: prev.completed || completed,
          xp: (prev.practiceDone ? 30 : 0) + Math.round((quizXpMax * best) / 100),
        }
        set((s) => ({
          lessons: { ...s.lessons, [lessonId]: next },
          xp: s.xp + Math.max(0, next.xp - prev.xp),
        }))
        get().touchDay()
        return { xpGain: Math.max(0, next.xp - prev.xp), newlyMastered: completed && !wasCompleted }
      },

      touchDay: () => {
        const today = todayKey()
        const { lastDay, streak } = get()
        if (lastDay === today) return
        const cont = lastDay === yesterdayKey()
        set({ lastDay: today, streak: cont ? streak + 1 : 1 })
        if ((cont ? streak + 1 : 1) >= 3) get().awardSpecial('streak-3')
      },

      awardSpecial: (badgeId) => {
        if (get().specialBadges.includes(badgeId)) return false
        set((s) => ({ specialBadges: [...s.specialBadges, badgeId] }))
        return true
      },

      setReducedMotion: (v) => set({ reducedMotion: v }),
      setSoundOn: (v) => set({ soundOn: v }),

      resetAll: () =>
        set({
          lessons: {}, xp: 0, streak: 0, lastDay: '', specialBadges: [],
        }),
    }),
    { name: 'fizik-dahom-v1' },
  ),
)

/** XP awarded for finishing guided practice (fixed) and quiz (proportional). */
export const PRACTICE_XP = 30
