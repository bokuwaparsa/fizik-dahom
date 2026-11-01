// ─── Math Quest · Book coverage map: 44 chapters → lessons ─────────────────
'use client'

import { useMemo } from 'react'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import { BOOK_CHAPTERS, bookChapterProgress, getLesson } from '@/lib/game/curriculum'
import { useLesson } from '@/lib/game/l10n'
import { useGame } from '@/lib/game/progress'
import { navigate } from '@/lib/game/router'
import { useI18n } from '@/lib/game/i18n'
import { BookOpen, CheckCircle2, Circle, CircleDot } from 'lucide-react'
import { cn } from '@/lib/utils'
import { isolateLatin } from './tex'

type TFn = (key: string, vars?: Record<string, string | number>) => string

/** Localized chapter title: dict key `bookmap.chN`, falling back to the English topic name. */
function chapterTitle(chapter: { ch: number; title: string }, t: TFn): string {
  const key = `bookmap.ch${chapter.ch}`
  const localized = t(key)
  return localized === key ? chapter.title : localized
}

export function BookMapPage() {
  const { t } = useI18n()
  const lessons = useGame((s) => s.lessons)
  const completed = useMemo(
    () => new Set(Object.entries(lessons).filter(([, v]) => v.completed).map(([id]) => id)),
    [lessons],
  )
  const doneChapters = BOOK_CHAPTERS.filter((c) => bookChapterProgress(c, completed) === 'done').length

  return (
    <div className="space-y-6">
      <header className="space-y-2">
        <h1 className="flex items-center gap-2 text-2xl font-black tracking-tight sm:text-3xl">
          <BookOpen className="h-7 w-7 text-amber-500" aria-hidden />
          {t('bookmap.title')}
        </h1>
        <p className="text-sm text-muted-foreground">{t('bookmap.intro')}</p>
      </header>

      <section className="rounded-xl border bg-card p-4 sm:p-5" aria-label={t('bookmap.progressLabel')}>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="text-sm font-semibold">
            {t('bookmap.mastered', { done: doneChapters, total: BOOK_CHAPTERS.length })}
          </p>
          <p className="text-xs text-muted-foreground tabular-nums">
            {Math.round((doneChapters / BOOK_CHAPTERS.length) * 100)}%
          </p>
        </div>
        <Progress
          value={(doneChapters / BOOK_CHAPTERS.length) * 100}
          className="mt-2 h-2"
          aria-label={t('bookmap.progressLabel')}
        />
        <ul className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-muted-foreground" aria-hidden>
          <li className="inline-flex items-center gap-1"><CheckCircle2 className="h-3 w-3 text-emerald-500" />{t('bookmap.legendDone')}</li>
          <li className="inline-flex items-center gap-1"><CircleDot className="h-3 w-3 text-amber-500" />{t('bookmap.legendStarted')}</li>
          <li className="inline-flex items-center gap-1"><Circle className="h-3 w-3" />{t('bookmap.legendTodo')}</li>
        </ul>
      </section>

      <ol className="space-y-2" aria-label={t('bookmap.title')}>
        {BOOK_CHAPTERS.map((chapter) => {
          const state = bookChapterProgress(chapter, completed)
          return (
            <li
              key={chapter.ch}
              className={cn(
                'rounded-xl border bg-card p-3 sm:p-4',
                state === 'done' && 'border-emerald-500/40 bg-emerald-500/5',
              )}
            >
              <div className="flex items-start gap-3">
                <span
                  className={cn(
                    'mt-0.5 inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-xs font-bold tabular-nums',
                    state === 'done' ? 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400' : 'bg-muted text-muted-foreground',
                  )}
                  aria-hidden
                >
                  {chapter.ch}
                </span>
                <div className="min-w-0 flex-1">
                  <h2 className="flex items-center gap-1.5 text-sm font-semibold leading-snug">
                    <bdi>{isolateLatin(chapterTitle(chapter, t), true)}</bdi>
                    {state === 'done' && (
                      <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-500" aria-label={t('bookmap.legendDone')} />
                    )}
                  </h2>
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {chapter.lessonIds.map((id) => {
                      const lesson = getLesson(id)
                      if (!lesson) return null
                      const isDone = completed.has(id)
                      return (
                        <LessonChip
                          key={id}
                          id={id}
                          label={lesson.title}
                          done={isDone}
                        />
                      )
                    })}
                  </div>
                </div>
              </div>
            </li>
          )
        })}
      </ol>
    </div>
  )
}

function LessonChip({ id, label, done }: { id: string; label: string; done: boolean }) {
  const { t } = useI18n()
  const localized = useLesson(id)
  const title = localized?.title ?? label
  return (
    <button
      onClick={() => navigate({ name: 'lesson', id })}
      className={cn(
        'inline-flex max-w-full items-center gap-1 rounded-full border px-2.5 py-1 text-xs font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
        done
          ? 'border-emerald-500/40 bg-emerald-500/10 text-emerald-700 hover:bg-emerald-500/20 dark:text-emerald-400'
          : 'bg-muted/50 text-muted-foreground hover:bg-muted hover:text-foreground',
      )}
      title={done ? t('bookmap.legendDone') : title}
    >
      {done && <CheckCircle2 className="h-3 w-3 shrink-0" aria-hidden />}
      <span className="truncate"><bdi>{title}</bdi></span>
    </button>
  )
}
