// ─── فیزیک‌دهم · Home = mission control with the chapter map grid ───────────
'use client'

import { useMemo } from 'react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Progress } from '@/components/ui/progress'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { levelFor, xpIntoLevel } from '@/lib/game/curriculum'
import { useLessons, useUnits, useDifficultyLabel, useRankFor } from '@/lib/game/l10n'
import { useGame } from '@/lib/game/progress'
import { navigate } from '@/lib/game/router'
import { useI18n } from '@/lib/game/i18n'
import { RichText, isolateLatin } from '@/components/game/tex'
import type { Lesson, UnitId } from '@/lib/game/types'
import {
  Ruler, Droplets, Zap, Thermometer, Cog, Flame, Search, Play,
  Zap as XpIcon, Trophy, BookOpenCheck, Compass,
} from 'lucide-react'
import { useState } from 'react'
import { cn } from '@/lib/utils'

export const UNIT_ICONS: Record<UnitId, typeof Ruler> = {
  ch1: Ruler, ch2: Droplets, ch3: Zap, ch4: Thermometer, ch5: Cog,
}

const DIFF_DOT: Record<Lesson['difficulty'], string> = {
  easy: 'bg-emerald-500', standard: 'bg-amber-500', challenge: 'bg-rose-500',
}

export function Home() {
  const { t } = useI18n()
  const diffLabel = useDifficultyLabel()
  const lessonsState = useGame((s) => s.lessons)
  const xp = useGame((s) => s.xp)
  const streak = useGame((s) => s.streak)
  const rank = useRankFor(xp)
  const allLessons = useLessons()
  const units = useUnits()

  const [query, setQuery] = useState('')
  const [unitFilter, setUnitFilter] = useState<UnitId | 'all'>('all')
  const [diffFilter, setDiffFilter] = useState<Lesson['difficulty'] | 'all'>('all')

  const masteredCount = useMemo(
    () => Object.values(lessonsState).filter((l) => l.completed).length,
    [lessonsState],
  )
  const total = allLessons.length

  const continueLesson = useMemo(() => {
    return allLessons.find((l) => !lessonsState[l.id]?.completed) ?? allLessons[0]
  }, [lessonsState, allLessons])

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    return allLessons.filter((l) => {
      if (unitFilter !== 'all' && l.unitId !== unitFilter) return false
      if (diffFilter !== 'all' && l.difficulty !== diffFilter) return false
      if (!q) return true
      return [l.title, l.tagline, ...l.objectives].join(' ').toLowerCase().includes(q)
    })
  }, [query, unitFilter, diffFilter, allLessons])

  const searching = query.trim() !== '' || unitFilter !== 'all' || diffFilter !== 'all'

  return (
    <div className="space-y-8">
      {/* hero */}
      <section className="relative overflow-hidden rounded-2xl border bg-gradient-to-br from-amber-500/10 via-transparent to-emerald-500/10 px-5 py-8 sm:px-8 sm:py-12">
        <div className="relative z-10 max-w-2xl space-y-4">
          <Badge variant="outline" className="border-amber-500/40 text-amber-700 dark:text-amber-400">
            {t('hero.badge')}
          </Badge>
          <h1 className="text-3xl sm:text-5xl font-black tracking-tight leading-tight">
            فیزیک‌دهم
          </h1>
          <p className="text-base sm:text-lg text-muted-foreground leading-relaxed">
            {t('hero.sub', { n: total })}
          </p>
          <div className="flex flex-wrap gap-2 pt-1">
            {continueLesson && (
              <Button size="lg" onClick={() => navigate({ name: 'lesson', id: continueLesson.id })}>
                <Play className="me-1.5 h-4 w-4" aria-hidden />
                {masteredCount === 0
                  ? t('hero.startWith', { title: continueLesson.title })
                  : t('hero.continueWith', { title: continueLesson.title })}
              </Button>
            )}
            <Button size="lg" variant="secondary" onClick={() => navigate({ name: 'playground' })}>
              <Compass className="me-1.5 h-4 w-4" aria-hidden /> {t('nav.playground')}
            </Button>
          </div>
        </div>
        {/* decorative orbit — mirrored automatically in RTL via logical insets */}
        <div aria-hidden className="pointer-events-none absolute -end-16 -top-16 h-64 w-64 rounded-full border-4 border-dashed border-amber-500/20" />
        <div aria-hidden className="pointer-events-none absolute -end-6 top-10 h-24 w-24 rounded-full border-2 border-emerald-500/20" />
      </section>

      {/* stats */}
      <section className="grid grid-cols-2 gap-3 sm:grid-cols-4" aria-label={t('stats.aria')}>
        <StatCard icon={XpIcon} label={t('stats.xp')} value={`${xp}`} sub={t('stats.toNext', { n: xpIntoLevel(xp) })} />
        <StatCard icon={Trophy} label={t('stats.level')} value={`${levelFor(xp)}`} sub={rank} />
        <StatCard icon={BookOpenCheck} label={t('stats.mastered')} value={`${masteredCount}/${total}`} sub={t('stats.masteredSub')} />
        <StatCard icon={Flame} label={t('stats.streak')} value={`${streak}`} sub={streak === 1 ? t('stats.streakDay') : t('stats.streakDays')} />
      </section>

      {/* search + filters */}
      <section className="space-y-3" aria-label={t('aria.search')}>
        <div className="flex flex-col gap-3 sm:flex-row">
          <div className="relative min-w-0 flex-1">
            <Search className="absolute start-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={t('search.placeholder')}
              aria-label={t('aria.search')}
              className="ps-9"
            />
          </div>
          <div className="flex gap-2">
            <Select value={unitFilter} onValueChange={(v) => setUnitFilter(v as UnitId | 'all')}>
              <SelectTrigger className="min-w-0 flex-1 sm:w-[170px] sm:flex-none" aria-label={t('aria.filterWorld')}>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{t('filter.world')}</SelectItem>
                {units.map((u) => <SelectItem key={u.id} value={u.id}>{u.title}</SelectItem>)}
              </SelectContent>
            </Select>
            <Select value={diffFilter} onValueChange={(v) => setDiffFilter(v as Lesson['difficulty'] | 'all')}>
              <SelectTrigger className="min-w-0 flex-1 sm:w-[130px] sm:flex-none" aria-label={t('aria.filterDiff')}>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{t('filter.any')}</SelectItem>
                <SelectItem value="easy">{t('diff.easy')}</SelectItem>
                <SelectItem value="standard">{t('diff.standard')}</SelectItem>
                <SelectItem value="challenge">{t('diff.challenge')}</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      </section>

      {/* search results */}
      {searching && (
        <section aria-label={t('results.aria')} className="space-y-3">
          <h2 className="text-lg font-bold">
            {filtered.length === 1 ? t('results.one') : t('results.many', { n: filtered.length })}
          </h2>
          {filtered.length === 0 ? (
            <p className="rounded-xl border border-dashed p-8 text-center text-sm text-muted-foreground">
              {t('results.none')}
            </p>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {filtered.map((l) => <LessonChip key={l.id} lesson={l} done={!!lessonsState[l.id]?.completed} />)}
            </div>
          )}
        </section>
      )}

      {/* world map */}
      {!searching && (
        <section aria-label={t('map.aria')} className="space-y-5">
          <h2 className="text-xl font-bold">{t('map.title')}</h2>
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {units.map((u) => {
              const Icon = UNIT_ICONS[u.id]
              const uLessons = u.lessonIds.map((id) => allLessons.find((l) => l.id === id)!).filter(Boolean)
              const done = uLessons.filter((l) => lessonsState[l.id]?.completed).length
              return (
                <div key={u.id} className="rounded-xl border bg-card overflow-hidden flex flex-col">
                  <div className="flex items-start gap-3 border-b bg-muted/30 px-4 py-3">
                    <span
                      className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg text-white"
                      style={{ background: u.hex }}
                    >
                      <Icon className="h-5 w-5" aria-hidden />
                    </span>
                    <div className="min-w-0 flex-1">
                      <h3 className="font-bold leading-tight">{u.title}</h3>
                      <p className="text-xs text-muted-foreground">{u.tagline}</p>
                    </div>
                    <Badge variant="secondary" className="shrink-0 tabular-nums">{done}/{uLessons.length}</Badge>
                  </div>
                  <div className="px-4 py-3">
                    <Progress value={(done / Math.max(1, uLessons.length)) * 100} aria-label={t('unit.progressAria', { unit: u.title })} className="h-1.5" />
                  </div>
                  <ul className="flex-1 space-y-1 px-2 pb-3">
                    {uLessons.map((l, i) => {
                      const isDone = !!lessonsState[l.id]?.completed
                      return (
                        <li key={l.id}>
                          <button
                            onClick={() => navigate({ name: 'lesson', id: l.id })}
                            className="group flex w-full items-center gap-2.5 rounded-lg px-2 py-2 text-start hover:bg-muted/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                          >
                            <span
                              className={cn(
                                'flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[11px] font-bold',
                                isDone ? 'text-white' : 'bg-muted text-muted-foreground group-hover:bg-background',
                              )}
                              style={isDone ? { background: u.hex } : undefined}
                              aria-hidden
                            >
                              {isDone ? '✓' : i + 1}
                            </span>
                            <span className="min-w-0 flex-1">
                              <bdi className="block truncate text-sm font-medium group-hover:underline underline-offset-2">
                                {isolateLatin(l.title)}
                              </bdi>
                              <bdi className="block truncate text-xs text-muted-foreground"><RichText text={l.tagline} /></bdi>
                            </span>
                            <span className={cn('h-2 w-2 shrink-0 rounded-full', DIFF_DOT[l.difficulty])} title={diffLabel[l.difficulty]} aria-label={t('diff.title', { d: diffLabel[l.difficulty] })} />
                          </button>
                        </li>
                      )
                    })}
                  </ul>
                </div>
              )
            })}
          </div>
        </section>
      )}

      {/* how to play */}
      {!searching && (
        <section aria-label={t('how.aria')} className="rounded-xl border bg-muted/30 px-5 py-6">
          <h2 className="text-lg font-bold">{t('how.title')}</h2>
          <ol className="mt-3 grid gap-3 sm:grid-cols-4">
            {[
              { n: 1, t: t('steps.learn'), d: t('how.1d') },
              { n: 2, t: t('steps.sim'), d: t('how.2d') },
              { n: 3, t: t('steps.practice'), d: t('how.3d') },
              { n: 4, t: t('steps.quiz'), d: t('how.4d') },
            ].map((s) => (
              <li key={s.n} className="rounded-lg border bg-card px-3 py-3">
                <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-primary text-xs font-bold text-primary-foreground" aria-hidden>{s.n}</span>
                <p className="mt-2 text-sm font-bold">{s.t}</p>
                <p className="mt-0.5 text-xs text-muted-foreground leading-relaxed">{s.d}</p>
              </li>
            ))}
          </ol>
          <p className="mt-4 text-xs text-muted-foreground">
            {t('how.note')}{' '}
            <Button variant="link" className="h-auto p-0 text-xs underline" onClick={() => navigate({ name: 'progress' })}>{t('nav.progress')}</Button>.
          </p>
        </section>
      )}
    </div>
  )
}

function StatCard({
  icon: Icon, label, value, sub,
}: { icon: typeof XpIcon; label: string; value: string; sub: string }) {
  return (
    <div className="rounded-xl border bg-card px-4 py-3">
      <p className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
        <Icon className="h-3.5 w-3.5 text-amber-500" aria-hidden /> {label}
      </p>
      <p className="mt-1 text-2xl font-extrabold tabular-nums leading-none">{value}</p>
      <p className="mt-1 text-xs text-muted-foreground">{sub}</p>
    </div>
  )
}

function LessonChip({ lesson, done }: { lesson: Lesson; done: boolean }) {
  const { t } = useI18n()
  const diffLabel = useDifficultyLabel()
  const units = useUnits()
  const unit = units.find((u) => u.id === lesson.unitId) ?? units[0]
  const Icon = UNIT_ICONS[unit.id]
  return (
    <button
      onClick={() => navigate({ name: 'lesson', id: lesson.id })}
      className="group flex items-start gap-3 rounded-xl border bg-card px-4 py-3 text-start transition-colors hover:border-primary/50 hover:bg-muted/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
    >
      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-white" style={{ background: unit.hex }}>
        <Icon className="h-4 w-4" aria-hidden />
      </span>
      <span className="min-w-0 flex-1">
        <bdi className="block text-sm font-semibold group-hover:underline underline-offset-2">{isolateLatin(lesson.title)}</bdi>
        <bdi className="block truncate text-xs text-muted-foreground">{unit.title} · {diffLabel[lesson.difficulty]} · {t('lesson.min', { n: lesson.minutes })}</bdi>
      </span>
      {done && <span className="ms-auto text-emerald-500" aria-label={t('aria.mastered')}>✓</span>}
    </button>
  )
}
