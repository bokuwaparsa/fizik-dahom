// ─── فیزیک‌دهم · App shell: header, sidebar, routed main area, footer ───────
'use client'

import { useEffect, useSyncExternalStore } from 'react'
import { ThemeProvider } from 'next-themes'
import { useTheme } from 'next-themes'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Switch } from '@/components/ui/switch'
import { Progress } from '@/components/ui/progress'
import { SidebarRail, MobileNav } from '@/components/game/sidebar'
import { Home } from '@/components/game/home'
import { LessonView } from '@/components/game/lesson-view'
import { Playground } from '@/components/game/playground'
import { ProgressPage } from '@/components/game/progress-page'
import { LicensesPage } from '@/components/game/licenses-page'
import { BookMapPage } from '@/components/game/book-map'
import { useHashRoute, navigate, type Route } from '@/lib/game/router'
import { useGame } from '@/lib/game/progress'
import { levelFor, xpIntoLevel, allLessons } from '@/lib/game/curriculum'
import { useRankFor } from '@/lib/game/l10n'
import { useI18n, LOCALES, bootstrapLocale } from '@/lib/game/i18n'
import { Atom, Settings, Moon, Sun, Flame, Zap, Award, Volume2, VolumeX, Sparkles, Languages, Check } from 'lucide-react'
import { cn } from '@/lib/utils'

export function GameShell() {
  return (
    <ThemeProvider attribute="class" defaultTheme="system" enableSystem disableTransitionOnChange>
      <Shell />
    </ThemeProvider>
  )
}
const emptySubscribe = () => () => {}

/** Hydration-safe mounted check (no setState-in-effect). */
function useMounted(): boolean {
  return useSyncExternalStore(emptySubscribe, () => true, () => false)
}

function Shell() {
  const route = useHashRoute()
  const mounted = useMounted()
  const { t } = useI18n()

  // pick up the saved/browser locale once after hydration
  useEffect(() => {
    bootstrapLocale()
  }, [])

  // scroll main area to top on route change
  useEffect(() => {
    window.scrollTo({ top: 0 })
  }, [route])

  if (!mounted) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background" role="status" aria-label={t('shell.loading')}>
        <div className="flex flex-col items-center gap-3">
          <Atom className="h-10 w-10 animate-spin text-amber-500 [animation-duration:2.5s]" aria-hidden />
          <p className="text-sm text-muted-foreground">{t('shell.loading')}</p>
        </div>
      </div>
    )
  }

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <Header route={route} />
      <div className="flex flex-1">
        <SidebarRail />
        <main className="min-w-0 flex-1 px-4 pb-10 pt-6 sm:px-6 lg:px-8">
          <div className="mx-auto w-full max-w-6xl">
            {route.name === 'home' && <Home />}
            {route.name === 'lesson' && <LessonView key={route.id} id={route.id} />}
            {route.name === 'playground' && <Playground />}
            {route.name === 'progress' && <ProgressPage />}
            {route.name === 'bookmap' && <BookMapPage />}
            {route.name === 'licenses' && <LicensesPage />}
          </div>
        </main>
      </div>
      <Footer />
    </div>
  )
}

function Header({ route }: { route: Route }) {
  const { t } = useI18n()
  const xp = useGame((s) => s.xp)
  const streak = useGame((s) => s.streak)
  const rank = useRankFor(xp)
  const mastered = Object.values(useGame((s) => s.lessons)).filter((l) => l.completed).length
  const total = allLessons().length

  return (
    <header className="sticky top-0 z-40 border-b bg-background/80 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="mx-auto flex h-14 max-w-7xl items-center gap-3 px-4 sm:px-6">
        <MobileNav />
        <button
          onClick={() => navigate({ name: 'home' })}
          className="flex items-center gap-2 font-black tracking-tight focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded-md"
          aria-label={t('aria.appHome')}
        >
          <Atom className="h-6 w-6 text-amber-500" aria-hidden />
          <span className="text-lg hidden sm:inline">فیزیک<span className="text-amber-500">‌دهم</span></span>
        </button>

        <div className="ms-auto flex items-center gap-2 sm:gap-3">
          {/* XP / level */}
          <div className="hidden md:block w-44" title={t('header.levelTitle', { xp, level: levelFor(xp), rank })}>
            <div className="flex items-center justify-between text-[10px] font-semibold text-muted-foreground mb-0.5">
              <span className="inline-flex items-center gap-1"><Zap className="h-3 w-3 text-amber-500" aria-hidden />{xp} XP</span>
              <span>{t('header.levelShort', { n: levelFor(xp), rank })}</span>
            </div>
            <Progress value={(xpIntoLevel(xp) / 300) * 100} className="h-1.5" aria-label={t('header.levelProgress')} />
          </div>
          <Badge variant="secondary" className="gap-1 tabular-nums hidden sm:inline-flex" title={t('header.masteredTitle')}>
            <Award className="h-3.5 w-3.5 text-emerald-500" aria-hidden />{mastered}/{total}
          </Badge>
          <Badge variant="secondary" className="gap-1 tabular-nums" title={t('header.streakTitle')}>
            <Flame className={cn('h-3.5 w-3.5', streak > 0 ? 'text-orange-500' : 'text-muted-foreground')} aria-hidden />{streak}
          </Badge>
          <SettingsMenu />
        </div>
      </div>
    </header>
  )
}

function SettingsMenu() {
  const { theme, setTheme, resolvedTheme } = useTheme()
  const { t, locale, setLocale } = useI18n()
  const reducedMotion = useGame((s) => s.reducedMotion)
  const setReducedMotion = useGame((s) => s.setReducedMotion)
  const soundOn = useGame((s) => s.soundOn)
  const setSoundOn = useGame((s) => s.setSoundOn)

  const themeLabel = (v: string) => (v === 'light' ? t('theme.light') : v === 'dark' ? t('theme.dark') : t('theme.system'))

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="icon" className="h-9 w-9" aria-label={t('settings.open')}>
          <Settings className="h-4.5 w-4.5" aria-hidden />
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-80 space-y-4">
        {/* Language */}
        <div>
          <p className="mb-2 flex items-center gap-1.5 text-xs font-bold uppercase tracking-wide text-muted-foreground">
            <Languages className="h-3.5 w-3.5" aria-hidden /> {t('settings.language')}
          </p>
          <div className="grid grid-cols-3 gap-1.5">
            {LOCALES.map((l) => (
              <Button
                key={l.id}
                size="sm"
                variant={locale === l.id ? 'default' : 'outline'}
                onClick={() => setLocale(l.id)}
                lang={l.id}
                aria-pressed={locale === l.id}
                className="font-semibold"
              >
                {locale === l.id && <Check className="me-1 h-3.5 w-3.5" aria-hidden />}
                {l.native}
              </Button>
            ))}
          </div>
          <p className="mt-1.5 text-[11px] text-muted-foreground">{t('settings.languageHint')}</p>
        </div>

        <div>
          <p className="mb-2 text-xs font-bold uppercase tracking-wide text-muted-foreground">{t('settings.appearance')}</p>
          <div className="grid grid-cols-3 gap-1.5">
            {(['light', 'dark', 'system'] as const).map((th) => (
              <Button
                key={th}
                size="sm"
                variant={theme === th ? 'default' : 'outline'}
                onClick={() => setTheme(th)}
              >
                {th === 'light' ? <Sun className="me-1 h-3.5 w-3.5" aria-hidden /> : th === 'dark' ? <Moon className="me-1 h-3.5 w-3.5" aria-hidden /> : <Sparkles className="me-1 h-3.5 w-3.5" aria-hidden />}
                {t(`theme.${th}`)}
              </Button>
            ))}
          </div>
          <p className="mt-1.5 text-[11px] text-muted-foreground">{t('settings.current', { theme: themeLabel(resolvedTheme ?? 'system') })}</p>
        </div>
        <div className="flex items-center justify-between">
          <label htmlFor="pq-motion" className="text-sm font-medium">{t('settings.reducedMotion')}</label>
          <Switch id="pq-motion" checked={reducedMotion} onCheckedChange={setReducedMotion} />
        </div>
        <div className="flex items-center justify-between">
          <label htmlFor="pq-sound" className="text-sm font-medium">
            <span className="inline-flex items-center gap-1.5">{soundOn ? <Volume2 className="h-4 w-4" aria-hidden /> : <VolumeX className="h-4 w-4" aria-hidden />} {t('settings.sounds')}</span>
            <span className="block text-[11px] font-normal text-muted-foreground">{t('settings.soundsHint')}</span>
          </label>
          <Switch id="pq-sound" checked={soundOn} onCheckedChange={setSoundOn} />
        </div>
      </PopoverContent>
    </Popover>
  )
}

function Footer() {
  const { t } = useI18n()
  return (
    <footer className="mt-auto border-t bg-muted/30">
      <div className="mx-auto flex max-w-7xl flex-col items-center justify-between gap-2 px-4 py-4 text-center sm:flex-row sm:px-6 sm:text-start">
        <p className="text-xs text-muted-foreground">
          <span className="font-semibold text-foreground">فیزیک‌دهم</span> {t('footer.about')}
        </p>
        <nav className="flex items-center gap-4 text-xs" aria-label="Footer">
          <button className="text-muted-foreground underline-offset-2 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded" onClick={() => navigate({ name: 'bookmap' })}>
            {t('nav.bookMap')}
          </button>
          <button className="text-muted-foreground underline-offset-2 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded" onClick={() => navigate({ name: 'licenses' })}>
            {t('footer.licenses')}
          </button>
          <button className="text-muted-foreground underline-offset-2 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded" onClick={() => navigate({ name: 'progress' })}>
            {t('footer.progress')}
          </button>
          <span className="text-muted-foreground">{t('footer.free')}</span>
        </nav>
      </div>
    </footer>
  )
}
