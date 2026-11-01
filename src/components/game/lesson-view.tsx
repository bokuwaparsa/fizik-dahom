// ─── فیزیک‌دهم · Lesson view: Learn → Simulate → Practice → Quiz ───────────
'use client'

import { createElement, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible'
import { ContentBlocks } from '@/components/game/content-blocks'
import { RichText, isolateLatin } from '@/components/game/tex'
import { PracticePanel } from '@/components/game/practice-panel'
import { QuizPanel } from '@/components/game/quiz-panel'
import { Celebration } from '@/components/game/celebration'
import { getSim } from '@/components/sims/registry'
import { useLesson, useUnit, useLessons, useDifficultyLabel } from '@/lib/game/l10n'
import { PRACTICE_XP, useGame } from '@/lib/game/progress'
import { allLessons as getAllLessons } from '@/lib/game/curriculum'
import { navigate } from '@/lib/game/router'
import { useI18n } from '@/lib/game/i18n'
import type { Difficulty } from '@/lib/game/types'
import {
  BookOpen, FlaskConical, Dumbbell, GraduationCap, ChevronDown, ChevronRight,
  ArrowLeft, ArrowRight, Clock, Zap, CheckCircle2, CircleDashed, Play,
} from 'lucide-react'
import { cn } from '@/lib/utils'

const DIFF_CLASS: Record<Difficulty, string> = {
  easy: 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-400',
  standard: 'bg-amber-500/15 text-amber-700 dark:text-amber-400',
  challenge: 'bg-rose-500/15 text-rose-700 dark:text-rose-400',
}

export function LessonView({ id }: { id: string }) {
  const { t } = useI18n()
  const diffLabel = useDifficultyLabel()
  const allLessons = useLessons()
  const lesson = useLesson(id)
  const unit = useUnit(id) // safe before the not-found branch (hooks must be unconditional)
  const [tab, setTab] = useState('learn')
  const [celebrate, setCelebrate] = useState<{ xpGain: number; score: number } | null>(null)
  const [visited, setVisited] = useState<Record<string, boolean>>({})

  const record = useGame((s) => s.lessons[id])
  const awardSpecial = useGame((s) => s.awardSpecial)
  // NOTE: the shell mounts <LessonView key={route.id}>, so per-lesson state
  // (tab/celebrate/visited) resets automatically when the lesson changes.

  if (!lesson) {
    return (
      <div className="mx-auto max-w-xl py-20 text-center space-y-4">
        <p className="text-4xl" aria-hidden>🧭</p>
        <h1 className="text-2xl font-bold">{t('notFound.title')}</h1>
        <p className="text-muted-foreground">{t('notFound.body')}</p>
        <Button onClick={() => navigate({ name: 'home' })}>{t('nav.backMap')}</Button>
      </div>
    )
  }

  const next = allLessons[allLessons.findIndex((l) => l.id === lesson.id) + 1]
  const quizXpMax = lesson.xp - 30
  const xpEarned = record?.xp ?? 0

  const markVisited = (k: string) => setVisited((v) => ({ ...v, [k]: true }))

  const onMastered = (xpGain: number, score: number) => {
    // milestone badges
    const s = useGame.getState()
    const mastered = Object.values(s.lessons).filter((l) => l.completed).length
    if (mastered >= 1) awardSpecial('first-lesson')
    if (mastered >= 5) awardSpecial('five-lessons')
    if (mastered >= 10) awardSpecial('ten-lessons')
    if (mastered >= 20) awardSpecial('twenty-lessons')
    if (mastered >= getAllLessons().length) awardSpecial('all-lessons')
    setCelebrate({ xpGain, score })
  }

  const steps = [
    { key: 'learn', label: t('steps.learn'), icon: BookOpen, done: !!visited['learn'] },
    { key: 'sim', label: t('steps.sim'), icon: FlaskConical, done: !!visited['sim'] },
    { key: 'practice', label: t('steps.practice'), icon: Dumbbell, done: !!record?.practiceDone },
    { key: 'quiz', label: t('steps.quiz'), icon: GraduationCap, done: !!record?.completed },
  ]

  return (
    <div className="mx-auto max-w-4xl space-y-5">
      {/* header */}
      <div className="space-y-3">
        <Button variant="ghost" size="sm" className="-ms-2" onClick={() => navigate({ name: 'home' })}>
          <ArrowLeft className="me-1 h-4 w-4 rtl:rotate-180" aria-hidden /> {t('nav.worldMap')}
        </Button>
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant="outline" className={cn('border-transparent font-semibold', unit.accent)}>
            {unit.title}
          </Badge>
          <Badge variant="outline" className={cn('border-transparent font-semibold', DIFF_CLASS[lesson.difficulty])}>
            {diffLabel[lesson.difficulty]}
          </Badge>
          <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
            <Clock className="h-3.5 w-3.5" aria-hidden /> {t('lesson.min', { n: lesson.minutes })}
          </span>
          <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
            <Zap className="h-3.5 w-3.5 text-amber-500" aria-hidden /> <span dir="ltr" className="tabular-nums">{xpEarned}/{lesson.xp} XP</span>
          </span>
          {record?.completed && (
            <Badge className="border-transparent bg-emerald-500/15 text-emerald-700 dark:text-emerald-400">
              <CheckCircle2 className="me-1 h-3 w-3" aria-hidden /> {t('lesson.mastered')}
            </Badge>
          )}
        </div>
        <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight"><bdi>{isolateLatin(lesson.title)}</bdi></h1>
        <p className="text-muted-foreground"><RichText text={lesson.tagline} /></p>
      </div>

      {/* step rail — 2×2 on phones so Persian labels never crush */}
      <ol className="grid grid-cols-2 gap-2 sm:grid-cols-4" aria-label={t('steps.aria')}>
        {steps.map((s, i) => (
          <li key={s.key}>
            <button
              onClick={() => setTab(s.key)}
              aria-current={tab === s.key ? 'step' : undefined}
              className={cn(
                'w-full rounded-lg border px-2 py-2 text-center transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                tab === s.key ? 'border-primary bg-primary/10' : 'hover:bg-muted/50',
              )}
            >
              <span className="flex items-center justify-center gap-1.5">
                {s.done
                  ? <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500 shrink-0" aria-hidden />
                  : <CircleDashed className="h-3.5 w-3.5 text-muted-foreground shrink-0" aria-hidden />}
                <s.icon className="h-3.5 w-3.5 shrink-0" aria-hidden />
                <span className="text-[11px] sm:text-xs font-semibold">{s.label}</span>
              </span>
              <span className="sr-only">{t('step.sr', { n: i + 1 })}</span>
            </button>
          </li>
        ))}
      </ol>

      <Tabs value={tab} onValueChange={(v) => { setTab(v); markVisited(v) }}>
        <TabsList className="sr-only">
          <TabsTrigger value="learn">{t('steps.learn')}</TabsTrigger>
          <TabsTrigger value="sim">{t('steps.sim')}</TabsTrigger>
          <TabsTrigger value="practice">{t('steps.practice')}</TabsTrigger>
          <TabsTrigger value="quiz">{t('steps.quiz')}</TabsTrigger>
        </TabsList>

        {/* ── LEARN ── */}
        <TabsContent value="learn" className="mt-0 space-y-4">
          <div className="rounded-xl border bg-card p-4 sm:p-6 space-y-4">
            <h2 className="text-sm font-bold uppercase tracking-wide text-muted-foreground">{t('lesson.objectives')}</h2>
            <ul className="grid gap-2 sm:grid-cols-3">
              {lesson.objectives.map((o, i) => (
                <li key={i} className="rounded-lg bg-muted/50 px-3 py-2 text-sm font-medium">
                  <RichText text={o} />
                </li>
              ))}
            </ul>
          </div>

          <div className="rounded-xl border bg-card p-4 sm:p-6">
            <ContentBlocks blocks={lesson.concept} />
          </div>

          <WorkedExampleCard lesson={lesson} />

          <div className="flex justify-end">
            <Button onClick={() => { setTab('sim'); markVisited('sim') }}>
              {t('lesson.trySim')} <ArrowRight className="ms-1 h-4 w-4 rtl:rotate-180" aria-hidden />
            </Button>
          </div>
        </TabsContent>

        {/* ── SIMULATE ── */}
        <TabsContent value="sim" className="mt-0 space-y-4">
          {createElement(getSim(lesson.simKey), { lessonId: lesson.id })}
          <div className="flex justify-end">
            <Button onClick={() => { setTab('practice'); markVisited('practice') }}>
              {t('lesson.toPractice')} <ArrowRight className="ms-1 h-4 w-4 rtl:rotate-180" aria-hidden />
            </Button>
          </div>
        </TabsContent>

        {/* ── PRACTICE ── */}
        <TabsContent value="practice" className="mt-0 space-y-4">
          <PracticePanel
            lesson={lesson}
            onDone={(xp) => {
              // gentle celebration for finishing practice
              if (!record?.practiceDone) {
                useGame.getState().touchDay()
              }
            }}
          />
          <div className="flex justify-end">
            <Button variant="secondary" onClick={() => { setTab('quiz'); markVisited('quiz') }}>
              {t('lesson.toQuiz')} <ArrowRight className="ms-1 h-4 w-4 rtl:rotate-180" aria-hidden />
            </Button>
          </div>
        </TabsContent>

        {/* ── QUIZ ── */}
        <TabsContent value="quiz" className="mt-0 space-y-4">
          <QuizPanel lesson={lesson} onMastered={onMastered} />
          {record?.completed && (
            <div className="flex flex-wrap gap-2">
              <Button variant="secondary" onClick={() => navigate({ name: 'home' })}>
                {t('nav.backMap')}
              </Button>
              {next && (
                <Button onClick={() => navigate({ name: 'lesson', id: next.id })}>
                  {t('lesson.next', { title: next.title })} <ArrowRight className="ms-1 h-4 w-4 rtl:rotate-180" aria-hidden />
                </Button>
              )}
            </div>
          )}
        </TabsContent>
      </Tabs>

      {/* prev / next */}
      <div className="flex flex-wrap items-center justify-between gap-2 border-t pt-4">
        <span className="text-xs text-muted-foreground min-w-0">
          {t('lesson.footer', { n: lesson.order, q: quizXpMax, p: PRACTICE_XP })}
        </span>
        {next && (
          <Button variant="ghost" size="sm" className="shrink-0" onClick={() => navigate({ name: 'lesson', id: next.id })}>
            {t('lesson.skip', { title: next.title })} <ChevronRight className="ms-1 h-4 w-4 rtl:rotate-180" aria-hidden />
          </Button>
        )}
      </div>

      {celebrate && (
        <Celebration
          lesson={lesson}
          xpGain={celebrate.xpGain}
          score={celebrate.score}
          onClose={() => setCelebrate(null)}
        />
      )}
    </div>
  )
}

function WorkedExampleCard({ lesson }: { lesson: NonNullable<ReturnType<typeof useLesson>> }) {
  const { t } = useI18n()
  const we = lesson.workedExample
  const [open, setOpen] = useState(false)
  return (
    <Collapsible open={open} onOpenChange={setOpen} className="rounded-xl border bg-card overflow-hidden">
      <CollapsibleTrigger className="flex w-full items-center justify-between gap-2 px-4 py-3 text-start hover:bg-muted/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
        <span className="flex items-center gap-2 text-sm font-bold">
          <Play className="h-4 w-4 text-primary shrink-0" aria-hidden /> {t('lesson.worked', { title: we.title })}
        </span>
        <ChevronDown className={cn('h-4 w-4 shrink-0 transition-transform', open && 'rotate-180')} aria-hidden />
      </CollapsibleTrigger>
      <CollapsibleContent>
        <div className="border-t px-4 py-4 space-y-3">
          <p className="text-sm font-medium leading-relaxed"><RichText text={we.problem} /></p>
          <ol className="space-y-2.5">
            {we.steps.map((s, i) => (
              <li key={i} className="rounded-lg bg-muted/40 px-3 py-2.5 text-sm leading-relaxed">
                <span className="me-2 inline-flex h-5 w-5 items-center justify-center rounded-full bg-primary text-[11px] font-bold text-primary-foreground">
                  {i + 1}
                </span>
                {s.text}
                {s.tex && <div className="mt-1.5 overflow-x-auto"><RichText text={`$${s.tex}$`} /></div>}
              </li>
            ))}
          </ol>
          <div className="rounded-lg border-s-4 border-emerald-500 bg-emerald-500/10 px-3 py-2.5 text-sm font-medium">
            <RichText text={we.answer} />
          </div>
        </div>
      </CollapsibleContent>
    </Collapsible>
  )
}
