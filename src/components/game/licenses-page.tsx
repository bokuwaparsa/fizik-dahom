// ─── Math Quest · Licenses & attribution page ──────────────────────────────
'use client'

import { Badge } from '@/components/ui/badge'
import { RichText } from '@/components/game/tex'
import { useI18n } from '@/lib/game/i18n'

const LIBS = [
  { name: 'Next.js', license: 'MIT', useKey: 'lic.use.nextjs', url: 'https://nextjs.org' },
  { name: 'React & React DOM', license: 'MIT', useKey: 'lic.use.react', url: 'https://react.dev' },
  { name: 'TypeScript', license: 'Apache-2.0', useKey: 'lic.use.ts', url: 'https://www.typescriptlang.org' },
  { name: 'Tailwind CSS', license: 'MIT', useKey: 'lic.use.tailwind', url: 'https://tailwindcss.com' },
  { name: 'shadcn/ui + Radix UI primitives', license: 'MIT', useKey: 'lic.use.shadcn', url: 'https://ui.shadcn.com' },
  { name: 'lucide-react', license: 'ISC', useKey: 'lic.use.lucide', url: 'https://lucide.dev' },
  { name: 'Zustand', license: 'MIT', useKey: 'lic.use.zustand', url: 'https://zustand.docs.pmnd.rs' },
  { name: 'KaTeX', license: 'MIT', useKey: 'lic.use.katex', url: 'https://katex.org' },
  { name: 'next-themes', license: 'MIT', useKey: 'lic.use.nextThemes', url: 'https://github.com/pacocoursey/next-themes' },
  { name: 'Geist font (via next/font)', license: 'SIL Open Font License 1.1', useKey: 'lic.use.geist', url: 'https://vercel.com/font' },
  { name: 'Vazirmatn font', license: 'SIL Open Font License 1.1', useKey: 'lic.use.vazirmatn', url: 'https://github.com/rastikerdar/vazirmatn' },
]

export function LicensesPage() {
  const { t } = useI18n()
  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <header className="space-y-2">
        <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight">{t('lic.title')}</h1>
        <p className="text-muted-foreground">
          {t('lic.sub')}
        </p>
      </header>

      <section className="rounded-xl border bg-card p-5 space-y-3">
        <h2 className="text-lg font-bold">{t('lic.libs')}</h2>
        <div className="overflow-x-auto rounded-lg border">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 text-start">
              <tr>
                <th className="px-3 py-2 font-semibold text-start">{t('lic.colLib')}</th>
                <th className="px-3 py-2 font-semibold text-start">{t('lic.colLicense')}</th>
                <th className="px-3 py-2 font-semibold text-start">{t('lic.colUse')}</th>
              </tr>
            </thead>
            <tbody>
              {LIBS.map((l) => (
                <tr key={l.name} className="border-t">
                  <td className="px-3 py-2 font-medium" dir="ltr">
                    <a href={l.url} target="_blank" rel="noopener noreferrer" className="underline-offset-2 hover:underline">
                      {l.name}
                    </a>
                  </td>
                  <td className="px-3 py-2"><Badge variant="secondary">{l.license}</Badge></td>
                  <td className="px-3 py-2 text-muted-foreground">{t(l.useKey)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="rounded-xl border bg-card p-5 space-y-3">
        <h2 className="text-lg font-bold">{t('lic.content')}</h2>
        <ul className="list-disc space-y-2 ps-5 text-sm leading-relaxed text-foreground/90">
          <li><RichText text={t('lic.c1')} /></li>
          <li><RichText text={t('lic.c2')} /></li>
          <li><RichText text={t('lic.c3')} /></li>
          <li>{t('lic.c4')}</li>
          <li>{t('lic.c5')}</li>
          <li>{t('lic.c6')}</li>
        </ul>
      </section>

      <section className="rounded-xl border bg-card p-5 space-y-2">
        <h2 className="text-lg font-bold">{t('lic.code')}</h2>
        <p className="text-sm leading-relaxed text-foreground/90">
          <RichText text={t('lic.codeP1')} />
        </p>
        <p className="text-sm leading-relaxed text-foreground/90">
          <RichText text={t('lic.codeP2')} />
        </p>
      </section>
    </div>
  )
}
