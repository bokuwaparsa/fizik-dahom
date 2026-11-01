// ─── Math Quest · Radix direction context synced with the app locale ──────
// Radix primitives (Tabs, Dialog, Select, Slider, Collapsible, Toast, …) render
// `dir="ltr"` on their root elements by default. That default silently turns the
// whole lesson content into an LTR bidi paragraph on Persian pages (left-aligned
// paragraphs, LTR table column order, bullets on the wrong side). Feeding them
// the app direction through Radix's DirectionProvider fixes every primitive at
// once — no per-component changes needed.
'use client'

import { DirectionProvider } from '@radix-ui/react-direction'
import { useI18n } from '@/lib/game/i18n'

export function AppDirection({ children }: { children: React.ReactNode }) {
  const { dir } = useI18n()
  return <DirectionProvider dir={dir}>{children}</DirectionProvider>
}
