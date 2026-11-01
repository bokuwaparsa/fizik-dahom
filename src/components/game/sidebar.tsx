// ─── Math Quest · Persistent lesson index sidebar (desktop rail / mobile sheet)
'use client'

import { useMemo, useState } from 'react'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Sheet, SheetContent, SheetTitle, SheetTrigger } from '@/components/ui/sheet'
import { UNITS } from '@/lib/game/curriculum'
import { useLessons, useUnits } from '@/lib/game/l10n'
import { useGame } from '@/lib/game/progress'
import { navigate } from '@/lib/game/router'
import { useI18n } from '@/lib/game/i18n'
import { UNIT_ICONS } from '@/components/game/home'
import { isolateLatin } from '@/components/game/tex'
import { cn } from '@/lib/utils'
import { Search, Menu, Compass, BarChart3, Scale, BookOpen, Home as HomeIcon } from 'lucide-react'
import type { UnitId } from '@/lib/game/types'

function SidebarContent({ onNavigate }: { onNavigate?: () => void }) {
  const { t, dir } = useI18n()
  const lessons = useGame((s) => s.lessons)
  const allLessons = useLessons()
  const units = useUnits()
  const [query, setQuery] = useState('')

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return null
    return allLessons.filter((l) =>
      [l.title, l.tagline, ...l.objectives].join(' ').toLowerCase().includes(q))
  }, [query, allLessons])

  const go = (id: string) => {
    navigate({ name: 'lesson', id })
    onNavigate?.()
  }

  const link = (icon: React.ReactNode, label: string, route: 'home' | 'playground' | 'progress' | 'bookmap' | 'licenses') => (
    <button
      onClick={() => { navigate({ name: route }); onNavigate?.() }}
      className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-medium text-muted-foreground hover:bg-muted/60 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
    >
      {icon} {label}
    </button>
  )

  return (
    <div className="flex h-full flex-col">
      <div className="space-y-3 p-3 border-b">
        {link(<HomeIcon className="h-4 w-4" />, t('nav.home'), 'home')}
        {link(<Compass className="h-4 w-4" />, t('nav.playground'), 'playground')}
        {link(<BarChart3 className="h-4 w-4" />, t('nav.progress'), 'progress')}
        {link(<BookOpen className="h-4 w-4" />, t('nav.bookMap'), 'bookmap')}
        {link(<Scale className="h-4 w-4" />, t('nav.licenses'), 'licenses')}
        <div className="relative pt-1">
          <div className="relative">
            <Search className="absolute start-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={t('search.allPlaceholder')}
              aria-label={t('aria.searchAll')}
              className="ps-8 h-9"
            />
          </div>
        </div>
      </div>

      {/* plain scroll container: Radix ScrollArea's viewport uses display:table,
          which lets rows grow to max-content and defeats title truncation */}
      <div className="pq-scroll min-h-0 flex-1 overflow-y-auto overflow-x-hidden">
        <nav className="p-2" aria-label={t('aria.lessonIndex')}>
          {filtered ? (
            <ul className="space-y-0.5 px-1">
              {filtered.length === 0 && (
                <li className="px-2 py-4 text-sm text-muted-foreground">{t('search.noMatch', { q: query })}</li>
              )}
              {filtered.map((l) => (
                <li key={l.id}>
                  <button
                    onClick={() => go(l.id)}
                    className="flex w-full min-w-0 items-center gap-2 overflow-hidden rounded-lg px-2 py-1.5 text-start text-sm hover:bg-muted/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  >
                    <span className={cn('h-2 w-2 rounded-full shrink-0')} style={{ background: UNITS.find((u) => u.id === l.unitId)?.hex }} aria-hidden />
                    <bdi className="min-w-0 flex-1 truncate">{isolateLatin(l.title)}</bdi>
                    {lessons[l.id]?.completed && <span className="shrink-0 text-emerald-500 text-xs" aria-label={t('aria.mastered')}>✓</span>}
                  </button>
                </li>
              ))}
            </ul>
          ) : (
            units.map((u) => {
              const Icon = UNIT_ICONS[u.id]
              const done = u.lessonIds.filter((id) => lessons[id]?.completed).length
              return (
                <div key={u.id} className="mb-3">
                  <p className="flex min-w-0 items-center gap-2 px-2 py-1.5 text-xs font-bold uppercase tracking-wide text-muted-foreground">
                    <Icon className="h-3.5 w-3.5 shrink-0" style={{ color: u.hex }} aria-hidden />
                    <bdi className="min-w-0 flex-1 truncate">{isolateLatin(u.title)}</bdi>
                    <Badge variant="secondary" className="ms-auto shrink-0 tabular-nums">{done}/{u.lessonIds.length}</Badge>
                  </p>
                  <ul className="space-y-0.5 px-1">
                    {u.lessonIds.map((id) => {
                      const l = allLessons.find((x) => x.id === id)
                      if (!l) return null
                      return (
                        <li key={id}>
                          <button
                            onClick={() => go(id)}
                            className="flex w-full min-w-0 items-center gap-2 overflow-hidden rounded-lg px-2 ps-4 py-1.5 text-start text-sm hover:bg-muted/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                          >
                            <bdi className="min-w-0 flex-1 truncate">{isolateLatin(l.title)}</bdi>
                            {lessons[id]?.completed && <span className="shrink-0 text-emerald-500 text-xs" aria-label={t('aria.mastered')}>✓</span>}
                          </button>
                        </li>
                      )
                    })}
                  </ul>
                </div>
              )
            })
          )}
        </nav>
      </div>
    </div>
  )
}

export function SidebarRail() {
  return (
    <aside className="sticky top-[57px] hidden h-[calc(100vh-57px)] w-64 shrink-0 border-e bg-card/40 lg:block">
      <SidebarContent />
    </aside>
  )
}

export function MobileNav() {
  const [open, setOpen] = useState(false)
  const { t, dir } = useI18n()
  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger
        className="inline-flex h-9 w-9 items-center justify-center rounded-md hover:bg-muted lg:hidden focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        aria-label={t('aria.openIndex')}
      >
        <Menu className="h-5 w-5" aria-hidden />
      </SheetTrigger>
      <SheetContent side={dir === 'rtl' ? 'right' : 'left'} className="w-80 p-0">
        <SheetTitle className="sr-only">{t('aria.lessonIndex')}</SheetTitle>
        <SidebarContent onNavigate={() => setOpen(false)} />
      </SheetContent>
    </Sheet>
  )
}

export type { UnitId }
