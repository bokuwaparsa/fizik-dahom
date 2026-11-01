/** Number formatting helpers shared by sims and content. */

/** Format a number with fixed significant digits, trimming trailing zeros. */
export function fmt(n: number, digits = 1): string {
  if (!Number.isFinite(n)) return '—'
  const v = Number(n.toFixed(digits))
  // avoid "-0"
  return Object.is(v, -0) ? '0' : `${v}`
}

export function clamp(v: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, v))
}

export const G = 9.8 // m/s² — standard gravity used everywhere in this game
