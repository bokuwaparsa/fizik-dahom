// ─── Math Quest · Celebration overlay (respects reduced motion) ────────────
'use client'

import { Button } from '@/components/ui/button'
import { useGame } from '@/lib/game/progress'
import { getUnit } from '@/lib/game/curriculum'
import { useLessons } from '@/lib/game/l10n'
import type { Lesson } from '@/lib/game/types'
import { Award, ArrowRight, Map } from 'lucide-react'
import { navigate } from '@/lib/game/router'
import { useI18n } from '@/lib/game/i18n'
import { RichText } from '@/components/game/tex'

export function Celebration({
  lesson, xpGain, score, onClose,
}: {
  lesson: Lesson
  xpGain: number
  score?: number
  onClose: () => void
}) {
  const { t } = useI18n()
  const reducedMotion = useGame((s) => s.reducedMotion)
  const unit = getUnit(lesson.unitId)
  const allLessons = useLessons()
  const next = allLessons[allLessons.findIndex((l) => l.id === lesson.id) + 1]

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
      role="dialog"
      aria-modal="true"
      aria-label={t('celebrate.aria')}
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-md rounded-2xl border bg-card p-6 text-center shadow-2xl animate-in zoom-in-95 fade-in duration-300"
        onClick={(e) => e.stopPropagation()}
      >
        {!reducedMotion && <Confetti />}
        <div
          className="mx-auto flex h-20 w-20 items-center justify-center rounded-full shadow-lg"
          style={{ background: unit.hex }}
        >
          <Award className="h-10 w-10 text-white" aria-hidden />
        </div>
        <h2 className="mt-4 text-2xl font-extrabold">{t('celebrate.title')}</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          {t('celebrate.body', { title: lesson.title, score: typeof score === 'number' ? score : '—' })}
        </p>
        <p className="mt-3 inline-flex items-center gap-1.5 rounded-full bg-amber-500/15 px-4 py-1.5 text-lg font-bold text-amber-600 dark:text-amber-400">
          +{xpGain} XP
        </p>
        <div className="mt-5 flex flex-col gap-2 sm:flex-row sm:justify-center">
          {next && (
            <Button onClick={() => { onClose(); navigate({ name: 'lesson', id: next.id }) }}>
              {t('celebrate.next', { title: next.title })} <ArrowRight className="ms-1 h-4 w-4 rtl:rotate-180" aria-hidden />
            </Button>
          )}
          <Button variant="secondary" onClick={() => { onClose(); navigate({ name: 'home' }) }}>
            <Map className="me-1 h-4 w-4" aria-hidden /> {t('nav.worldMap')}
          </Button>
        </div>
      </div>
    </div>
  )
}

function Confetti() {
  const colors = ['#f59e0b', '#f97316', '#10b981', '#14b8a6', '#f43f5e', '#8b5cf6', '#eab308']
  return (
    <div aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden rounded-2xl">
      {Array.from({ length: 28 }).map((_, i) => (
        <span
          key={i}
          className="pq-confetti absolute top-0 h-2 w-2 rounded-sm"
          style={{
            left: `${(i * 3.7 + 4) % 100}%`,
            background: colors[i % colors.length],
            animationDelay: `${(i % 7) * 0.12}s`,
            animationDuration: `${1.6 + (i % 5) * 0.25}s`,
            transform: `rotate(${i * 37}deg)`,
          }}
        />
      ))}
    </div>
  )
}

/** Small inline XP chip used after practice completion. */
export function XpChip({ xp, note }: { xp: number; note?: string }) {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-500/15 px-3 py-1 text-sm font-bold text-amber-600 dark:text-amber-400">
      <Award className="h-3.5 w-3.5" aria-hidden /> +{xp} XP{note ? <span className="font-normal">· {note}</span> : null}
    </span>
  )
}

export function Explanation({ text, correct }: { text: string; correct: boolean }) {
  return (
    <div
      className={`rounded-lg px-3 py-2.5 text-sm leading-relaxed ${
        correct
          ? 'bg-emerald-500/10 text-emerald-800 dark:text-emerald-300'
          : 'bg-rose-500/10 text-rose-800 dark:text-rose-300'
      }`}
      role="status"
    >
      <RichText text={text} />
    </div>
  )
}
