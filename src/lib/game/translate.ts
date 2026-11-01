// ─── Math Quest · Persian-first helpers ────────────────────────────────────────
import type { Unit, UnitId } from '@/lib/game/types'
export function localizedUnit(
  base: Unit,
  lookup: (key: string, fallback: string) => string,
): Unit {
  return {
    ...base,
    title: lookup(`unit.${base.id}.title`, base.title),
    tagline: lookup(`unit.${base.id}.tagline`, base.tagline),
  }
}

export function localizedRank(
  base: string,
  level: number,
  lookup: (key: string, fallback: string) => string,
): string {
  const i = Math.min(Math.max(1, level), 10)
  return lookup(`rank.${i - 1}`, base)
}

export function localizedUnitName(id: UnitId, lookup: (key: string, fallback: string) => string): string {
  return lookup(`unit.${id}.title`, id)
}
