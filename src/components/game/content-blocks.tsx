// ─── Math Quest · Renders ContentBlock[] with KaTeX support ────────────────
'use client'

import { RichText, Tex } from '@/components/game/tex'
import type { ContentBlock } from '@/lib/game/types'
import { Lightbulb } from 'lucide-react'

export function ContentBlocks({ blocks }: { blocks: ContentBlock[] }) {
  return (
    <div className="space-y-4">
      {blocks.map((b, i) => {
        switch (b.type) {
          case 'h':
            return (
              <h4 key={i} className="text-base font-bold pt-2 first:pt-0">
                <RichText text={b.text} />
              </h4>
            )
          case 'p':
            return (
              <p key={i} className="text-sm leading-relaxed text-foreground/90">
                <RichText text={b.text} />
              </p>
            )
          case 'formula':
            return (
              <figure key={i} className="rounded-lg border bg-muted/40 px-4 py-3">
                <Tex tex={b.tex} display />
                {b.caption && (
                  <figcaption className="text-xs text-muted-foreground text-center mt-1">
                    <RichText text={b.caption} />
                  </figcaption>
                )}
              </figure>
            )
          case 'list':
            return (
              <ul key={i} className="space-y-1.5 text-sm leading-relaxed text-foreground/90">
                {b.items.map((item, j) => (
                  <li key={j} className="flex gap-2">
                    <span aria-hidden className="text-primary mt-0.5">▸</span>
                    <span><RichText text={item} /></span>
                  </li>
                ))}
              </ul>
            )
          case 'key':
            return (
              <div key={i} className="rounded-lg border-s-4 border-amber-500 bg-amber-500/10 px-4 py-3 flex gap-2.5 flex-row">
                <Lightbulb className="h-4 w-4 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" aria-hidden />
                <p className="text-sm leading-relaxed font-medium">
                  <RichText text={b.text} />
                </p>
              </div>
            )
          case 'table':
            return (
              <div key={i} className="overflow-x-auto rounded-lg border">
                <table className="w-full text-sm">
                  <thead className="bg-muted/50">
                    <tr>
                      {b.headers.map((h, j) => (
                        <th key={j} className="px-3 py-2 text-start font-semibold">
                          <RichText text={h} />
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {b.rows.map((row, j) => (
                      <tr key={j} className="border-t">
                        {row.map((cell, k) => (
                          <td key={k} className="px-3 py-2">
                            <RichText text={cell} />
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )
          default:
            return null
        }
      })}
    </div>
  )
}
