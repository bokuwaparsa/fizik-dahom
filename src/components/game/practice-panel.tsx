// ─── Math Quest · Guided practice: hints, retries, immediate feedback ──────
'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import type { Lesson, Question } from '@/lib/game/types'
import { PRACTICE_XP, useGame } from '@/lib/game/progress'
import { Explanation, XpChip } from '@/components/game/celebration'
import { RichText } from '@/components/game/tex'
import { useI18n } from '@/lib/game/i18n'
import { Lightbulb, Check, ArrowRight, RotateCcw } from 'lucide-react'
import { cn } from '@/lib/utils'

type Status = 'asking' | 'correct' | 'retry'

export function PracticePanel({ lesson, onDone }: { lesson: Lesson; onDone: (xp: number) => void }) {
  const { t } = useI18n()
  const [idx, setIdx] = useState(0)
  const [status, setStatus] = useState<Status>('asking')
  const [hintsShown, setHintsShown] = useState(0)
  const [tries, setTries] = useState(0)
  const [input, setInput] = useState('')
  const [choice, setChoice] = useState<number | null>(null)
  const [allDone, setAllDone] = useState(false)

  const markPracticeDone = useGame((s) => s.markPracticeDone)
  const practiceDone = useGame((s) => s.lessons[lesson.id]?.practiceDone ?? false)

  const q: Question | undefined = lesson.practice[idx]

  const check = () => {
    if (!q) return
    if (q.kind === 'mc') {
      if (choice === q.answerIndex) setStatus('correct')
      else { setStatus('retry'); setTries((tr) => tr + 1) }
    } else {
      const val = parseFloat(input.replace(',', '.'))
      const tol = (q.tolerance ?? 0.02) * Math.abs(q.answer ?? 0)
      if (Number.isFinite(val) && q.answer !== undefined && Math.abs(val - q.answer) <= Math.max(tol, 1e-9)) {
        setStatus('correct')
      } else {
        setStatus('retry')
        setTries((tr) => tr + 1)
      }
    }
  }

  const nextQ = () => {
    if (idx + 1 >= lesson.practice.length) {
      if (!practiceDone) markPracticeDone(lesson.id, PRACTICE_XP)
      setAllDone(true)
      onDone(PRACTICE_XP)
    } else {
      setIdx((i) => i + 1)
      setStatus('asking'); setHintsShown(0); setTries(0); setInput(''); setChoice(null)
    }
  }

  if (allDone || (practiceDone && idx >= lesson.practice.length)) {
    return (
      <div className="rounded-xl border bg-card p-6 text-center space-y-3">
        <p className="text-3xl" aria-hidden>🎯</p>
        <h3 className="text-lg font-bold">{t('practice.doneTitle')}</h3>
        <p className="text-sm text-muted-foreground">
          {t('practice.doneBody')}
        </p>
        <XpChip xp={PRACTICE_XP} />
        <div>
          <Button onClick={() => setAllDone(false)} variant="secondary">
            <RotateCcw className="me-1 h-4 w-4" aria-hidden /> {t('practice.again')}
          </Button>
        </div>
      </div>
    )
  }

  if (!q) return null

  return (
    <div className="rounded-xl border bg-card p-4 sm:p-6 space-y-4">
      <div className="flex items-center justify-between gap-2">
        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          {t('practice.head', { i: idx + 1, n: lesson.practice.length })}
        </p>
        <div className="flex gap-1" aria-hidden>
          {lesson.practice.map((_, i) => (
            <span key={i} className={cn('h-1.5 w-6 rounded-full', i < idx || status === 'correct' && i === idx ? 'bg-emerald-500' : i === idx ? 'bg-amber-500' : 'bg-muted')} />
          ))}
        </div>
      </div>

      <p className="text-base font-medium leading-relaxed"><RichText text={q.prompt} /></p>

      {q.kind === 'mc' ? (
        <div className="grid gap-2 sm:grid-cols-2" role="radiogroup" aria-label={t('aria.choices')}>
          {q.choices?.map((c, i) => {
            const isPicked = choice === i
            const reveal = status !== 'asking'
            const isRight = i === q.answerIndex
            return (
              <button
                key={i}
                role="radio"
                aria-checked={isPicked}
                disabled={status === 'correct'}
                onClick={() => { setChoice(i); setStatus('asking') }}
                className={cn(
                  'rounded-lg border px-4 py-3 text-start text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                  reveal && isRight && 'border-emerald-500 bg-emerald-500/10',
                  reveal && isPicked && !isRight && 'border-rose-500 bg-rose-500/10',
                  !reveal && isPicked && 'border-primary bg-primary/10',
                  !reveal && !isPicked && 'hover:border-primary/50 hover:bg-muted/50',
                  reveal && !isRight && !isPicked && 'opacity-60',
                )}
              >
                <RichText text={c} />
              </button>
            )
          })}
        </div>
      ) : (
        <div className="flex items-center gap-2 max-w-xs">
          <Input
            aria-label={t('aria.answer')}
            inputMode="decimal"
            value={input}
            placeholder="?"
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && check()}
            disabled={status === 'correct'}
            className="font-mono"
          />
          {q.unit && <span className="text-sm font-semibold text-muted-foreground whitespace-nowrap">{q.unit}</span>}
        </div>
      )}

      {/* hints */}
      {hintsShown < q.hints.length && status !== 'correct' && (
        <div>
          <Button variant="ghost" size="sm" onClick={() => setHintsShown((h) => h + 1)}>
            <Lightbulb className="me-1 h-4 w-4 text-amber-500" aria-hidden />
            {t('practice.hint', { i: hintsShown + 1, n: q.hints.length })}
          </Button>
          {q.hints.slice(0, hintsShown).map((h, i) => (
            <p key={i} className="mt-2 rounded-lg bg-amber-500/10 px-3 py-2 text-sm text-amber-800 dark:text-amber-300">
              <RichText text={h} />
            </p>
          ))}
        </div>
      )}

      {status === 'retry' && (
        <Explanation
          correct={false}
          text={tries >= 2
            ? t('practice.retry2', { why: q.explanation })
            : t('practice.retry1')}
        />
      )}
      {status === 'correct' && <Explanation correct text={q.explanation} />}

      <div className="flex flex-wrap gap-2">
        {status !== 'correct' && (
          <Button onClick={check} disabled={q.kind === 'numeric' ? !input : choice === null}>
            <Check className="me-1 h-4 w-4" aria-hidden /> {t('practice.check')}
          </Button>
        )}
        {status === 'correct' && (
          <Button onClick={nextQ}>
            {idx + 1 >= lesson.practice.length ? t('practice.finish') : t('practice.nextQ')} <ArrowRight className="ms-1 h-4 w-4 rtl:rotate-180" aria-hidden />
          </Button>
        )}
        {status === 'retry' && tries >= 2 && (
          <Button variant="ghost" onClick={() => { setStatus('correct') }}>
            {t('practice.reveal')}
          </Button>
        )}
      </div>
    </div>
  )
}
