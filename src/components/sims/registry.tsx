// ─── فیزیک‌دهم · Simulation (widget) registry ─────────────────────────────────
'use client'

import type { SimComponent, SimProps } from '@/lib/game/types'
import { simsCh1 } from './physics/p1'
import { simsCh2 } from './physics/p2'
import { simsCh3 } from './physics/p3'
import { simsCh4 } from './physics/p4'
import { simsCh5 } from './physics/p5'

export const SIMS: Record<string, SimComponent> = {
  ...simsCh1,
  ...simsCh2,
  ...simsCh3,
  ...simsCh4,
  ...simsCh5,
}

/** Graceful placeholder rendered when a lesson's widget is not registered yet. */
export function MissingSim({ lessonId }: SimProps) {
  return (
    <div className="flex h-44 items-center justify-center rounded-xl border border-dashed border-muted-foreground/40 text-sm text-muted-foreground">
      آزمایشگاه تعاملی این درس در دسترس نیست.
    </div>
  )
}

export function getSim(key: string): SimComponent {
  return SIMS[key] ?? MissingSim
}
