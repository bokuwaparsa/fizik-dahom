// ─── Math Quest · KaTeX rendering helpers ──────────────────────────────────
'use client'

import { useMemo } from 'react'
import katex from 'katex'
import { cn } from '@/lib/utils'
import { useI18n } from '@/lib/game/i18n'

function renderTex(tex: string, displayMode: boolean): string {
  try {
    return katex.renderToString(tex, {
      displayMode,
      throwOnError: false,
      output: 'html',
      strict: false,
    })
  } catch {
    return tex
  }
}

export function Tex({ tex, display = false, className }: { tex: string; display?: boolean; className?: string }) {
  const html = useMemo(() => renderTex(tex, display), [tex, display])
  return (
    <span
      className={cn(display && 'block text-center overflow-x-auto py-1', className)}
      dangerouslySetInnerHTML={{ __html: html }}
      role={display ? 'math' : undefined}
      aria-label={display ? tex : undefined}
    />
  )
}

/**
 * Wrap Latin/number "islands" (units like "10 N", "m/s²", "(kg)", "≈ 1.4 m/s")
 * in Unicode LRI…PDI isolates. Without this, the Unicode bidi algorithm can
 * tear digits and their unit apart in Persian text (e.g. "…هُل 10 N" rendering
 * the "N" at the far opposite edge) and split a leading "≈" from its value.
 * By default only strings that already contain RTL script are processed
 * (EN/TR safe). Pass `force` (true on RTL pages) to also isolate pure-Latin
 * fragments — otherwise a bare "≈ 1.4 m/s" cell still gets reordered in an
 * RTL paragraph even though it holds no Persian itself.
 */
const ISLAND_RE = /[≈~±×÷<>≤≥][A-Za-z0-9 .,/+=×·°²³^_%(){}[\]-]*[A-Za-z0-9)%\]]|[A-Za-z0-9(][A-Za-z0-9 .,/+=×·°²³^_%(){}[\]-]*[A-Za-z0-9)%\]]|[A-Za-z]/g

export function isolateLatin(text: string, force = false): string {
  if (!force && !/[\u0590-\u08FF]/.test(text)) return text
  return text.replace(ISLAND_RE, (m) => (/[A-Za-z]/.test(m) ? `\u2066${m}\u2069` : m))
}

/**
 * Renders text that may contain inline math wrapped in $…$ and **bold** spans.
 */
export function RichText({ text, className }: { text: string; className?: string }) {
  const { dir } = useI18n()
  const isolateAll = dir === 'rtl'
  const parts = useMemo(() => text.split('$'), [text])
  if (parts.length === 1) return <span className={className}>{withBold(isolateLatin(text, isolateAll))}</span>
  return (
    <span className={className}>
      {parts.map((part, i) =>
        i % 2 === 1 ? (
          <Tex key={i} tex={part} />
        ) : (
          <span key={i}>{withBold(isolateLatin(part, isolateAll))}</span>
        ),
      )}
    </span>
  )
}

/** Minimal **bold** support inside plain text segments. */
function withBold(text: string): React.ReactNode[] {
  const chunks = text.split(/\*\*(.+?)\*\*/g)
  if (chunks.length === 1) return [text]
  return chunks.map((c, i) => (i % 2 === 1 ? <strong key={i} className="font-semibold">{c}</strong> : <span key={i}>{c}</span>))
}
