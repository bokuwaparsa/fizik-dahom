// ─── فیزیک‌دهم · Core types ───────────────────────────────────────────────────
import type { ComponentType } from 'react'

/** The 5 chapters of the Iranian Grade-10 physics textbook. */
export type UnitId =
  | 'ch1'
  | 'ch2'
  | 'ch3'
  | 'ch4'
  | 'ch5'

export type Difficulty = 'easy' | 'standard' | 'challenge'

/** Inline math is wrapped in $…$ inside text fields; it is rendered with KaTeX. */
export type ContentBlock =
  | { type: 'p'; text: string }
  | { type: 'h'; text: string }
  | { type: 'formula'; tex: string; caption?: string }
  | { type: 'list'; items: string[] }
  | { type: 'key'; text: string }
  | { type: 'table'; headers: string[]; rows: string[][] }

export interface WorkedStep {
  text: string
  tex?: string
}

export interface WorkedExample {
  title: string
  problem: string
  steps: WorkedStep[]
  answer: string
}

export interface Question {
  id: string
  prompt: string
  kind: 'mc' | 'numeric'
  /** multiple-choice option labels (KaTeX inline allowed) */
  choices?: string[]
  /** index of correct choice (for kind === 'mc') */
  answerIndex?: number
  /** numeric answer (for kind === 'numeric') */
  answer?: number
  /** tolerance as a fraction of the answer, default 0.02 (2%) */
  tolerance?: number
  unit?: string
  hints: string[]
  explanation: string
}

export interface Lesson {
  id: string
  unitId: UnitId
  order: number
  title: string
  tagline: string
  difficulty: Difficulty
  minutes: number
  /** total XP available for the lesson (practice 30 + quiz up to 70) */
  xp: number
  objectives: string[]
  concept: ContentBlock[]
  /** key into the sim registry */
  simKey: string
  workedExample: WorkedExample
  practice: Question[]
  quiz: Question[]
}

export interface Unit {
  id: UnitId
  title: string
  tagline: string
  /** tailwind text/bg accent classes */
  accent: string
  /** hex used for canvas + badge accents */
  hex: string
  lessonIds: string[]
}

/** Props every simulation (interactive widget) component receives. */
export interface SimProps {
  lessonId: string
  /** true when rendered inside the free-play playground */
  sandbox?: boolean
}

export type SimComponent = ComponentType<SimProps>
