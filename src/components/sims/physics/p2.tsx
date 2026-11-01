// ─── فیزیک‌دهم · فصل ۲ «ویژگی‌های فیزیکی مواد» · interactive widgets ───────────
// u2-states · u2-intermolecular · u2-pressure · u2-buoyancy · u2-bernoulli
// (درس u2-review از طریق simKey خودش از widget «u2-buoyancy» استفاده می‌کند.)
// Helpers are chapter-local copies of the p1 style (faText/rr/fmt) — keep local.
'use client'

import { useEffect, useRef, useState } from 'react'
import {
  CANVAS,
  SimFrame,
  SimSlider,
  SimSelect,
  SimButton,
  Readout,
  Legend,
  useSimCanvas,
  useSimBeep,
  useReducedMotion,
  canvasPos,
} from '@/components/sims/sim-kit'
import type { SimComponent } from '@/lib/game/types'

// ─── chapter constants & helpers ─────────────────────────────────────────────
const G = 10 // m/s²
const P0 = 100000 // Pa

function fmtNum(v: number): string {
  if (!Number.isFinite(v)) return '—'
  const a = Math.abs(v)
  if (a >= 10000) return Math.round(v).toLocaleString('en-US')
  const r = Math.round(v * 100) / 100
  if (Number.isInteger(r)) return String(r)
  return r.toFixed(2).replace(/0+$/, '').replace(/\.$/, '')
}

function rr(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  rad: number,
) {
  const r = Math.min(rad, w / 2, h / 2)
  ctx.beginPath()
  ctx.moveTo(x + r, y)
  ctx.arcTo(x + w, y, x + w, y + h, r)
  ctx.arcTo(x + w, y + h, x, y + h, r)
  ctx.arcTo(x, y + h, x, y, r)
  ctx.arcTo(x, y, x + w, y, r)
  ctx.closePath()
}

/** Draw Persian text safely on canvas (RTL). */
function faText(
  ctx: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
  opts?: { align?: CanvasTextAlign; bold?: boolean; size?: number; color?: string },
) {
  ctx.save()
  ctx.direction = 'rtl'
  ctx.font = opts?.bold
    ? `700 ${opts.size ?? 13}px Vazirmatn, Tahoma, sans-serif`
    : `600 ${opts?.size ?? 12}px Vazirmatn, Tahoma, sans-serif`
  ctx.fillStyle = opts?.color ?? CANVAS.fg
  ctx.textAlign = opts?.align ?? 'center'
  ctx.textBaseline = 'middle'
  ctx.fillText(text, x, y)
  ctx.restore()
}

/** Monospace Latin text (numbers/units) on canvas. */
function monoText(
  ctx: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
  opts?: { align?: CanvasTextAlign; color?: string; size?: number },
) {
  ctx.save()
  ctx.font = `700 ${opts?.size ?? 11}px ui-monospace, SFMono-Regular, Menlo, monospace`
  ctx.fillStyle = opts?.color ?? CANVAS.muted
  ctx.textAlign = opts?.align ?? 'center'
  ctx.textBaseline = 'middle'
  ctx.fillText(text, x, y)
  ctx.restore()
}

function clamp(v: number, lo: number, hi: number): number {
  return Math.min(hi, Math.max(lo, v))
}

/** Deterministic pseudo-random in [0,1) — stable across frames & renders. */
function srand(i: number, salt = 0): number {
  const x = Math.sin(i * 127.1 + salt * 311.7 + 74.7) * 43758.5453
  return x - Math.floor(x)
}

function hexToRgb(hex: string): [number, number, number] {
  const h = hex.replace('#', '')
  return [
    parseInt(h.slice(0, 2), 16),
    parseInt(h.slice(2, 4), 16),
    parseInt(h.slice(4, 6), 16),
  ]
}

function mixHex(a: string, b: string, k: number): string {
  const A = hexToRgb(a)
  const B = hexToRgb(b)
  const kk = clamp(k, 0, 1)
  const c = A.map((v, i) => Math.round(v + (B[i] - v) * kk))
  return `rgb(${c[0]},${c[1]},${c[2]})`
}

/** Cold → warm particle color for temperature 0..100. */
function tempColor(T: number): string {
  return T < 50
    ? mixHex(CANVAS.teal, CANVAS.amber, T / 50)
    : mixHex(CANVAS.amber, CANVAS.red, (T - 50) / 50)
}

function arrow(
  ctx: CanvasRenderingContext2D,
  x0: number,
  y0: number,
  x1: number,
  y1: number,
  color: string,
  lw = 2.5,
) {
  const ang = Math.atan2(y1 - y0, x1 - x0)
  const head = Math.max(6, lw * 2.6)
  ctx.strokeStyle = color
  ctx.fillStyle = color
  ctx.lineWidth = lw
  ctx.beginPath()
  ctx.moveTo(x0, y0)
  ctx.lineTo(x1, y1)
  ctx.stroke()
  ctx.beginPath()
  ctx.moveTo(x1, y1)
  ctx.lineTo(x1 - head * Math.cos(ang - 0.45), y1 - head * Math.sin(ang - 0.45))
  ctx.lineTo(x1 - head * Math.cos(ang + 0.45), y1 - head * Math.sin(ang + 0.45))
  ctx.closePath()
  ctx.fill()
}

/** Rounded green win banner (canvas). */
function drawWinBanner(ctx: CanvasRenderingContext2D, w: number, text: string) {
  const bw = Math.min(360, Math.max(220, w - 24))
  const bx = (w - bw) / 2
  ctx.fillStyle = 'rgba(16,185,129,0.94)'
  rr(ctx, bx, 10, bw, 36, 10)
  ctx.fill()
  ctx.strokeStyle = 'rgba(250,250,249,0.55)'
  ctx.lineWidth = 1
  ctx.stroke()
  faText(ctx, text, w / 2, 28, { bold: true, size: 14, color: '#ffffff' })
}

/** Two-tone ascending chime for challenge wins. */
function useWinBeep() {
  const beep = useSimBeep()
  return () => {
    beep(660, 120)
    window.setTimeout(() => beep(880, 160), 350)
  }
}

/** A ref mirror of useReducedMotion() so RAF draw closures read the latest value. */
function useReducedMotionRef(): React.RefObject<boolean> {
  const reduced = useReducedMotion()
  const ref = useRef(reduced)
  ref.current = reduced
  return ref
}

/** Latched challenge state: fires once when `active`, re-arms when `reset`. */
function useChallenge(active: boolean, reset: boolean, onWin: () => void): boolean {
  const armedRef = useRef(true)
  const [won, setWon] = useState(false)
  useEffect(() => {
    if (reset) {
      if (!armedRef.current) setWon(false)
      armedRef.current = true
    }
    if (active && armedRef.current) {
      armedRef.current = false
      setWon(true)
      onWin()
    }
  }, [active, reset, onWin])
  return won
}

// ─────────────────────────────────────────────────────────────────────────────
// u2-states · «مولکول‌ها در سه حالت» — particle-motion explorer
// ─────────────────────────────────────────────────────────────────────────────
type MatterState = 'solid' | 'liquid' | 'gas'

const STATE_OPTIONS: { value: MatterState; label: string }[] = [
  { value: 'solid', label: 'جامد' },
  { value: 'liquid', label: 'مایع' },
  { value: 'gas', label: 'گاز' },
]
const STATE_FA: Record<MatterState, string> = { solid: 'جامد', liquid: 'مایع', gas: 'گاز' }
const STATE_HINT: Record<MatterState, string> = {
  solid: 'ارتعاش حول جای ثابت · دامنه ∝ دما',
  liquid: 'نزدیک اما لغزان · همسایه‌ها عوض می‌شوند',
  gas: 'دور و آزاد · سرعت ∝ دما',
}
const N_PART = 55

interface FlowPart {
  nx: number
  ny: number
  vx: number
  vy: number
  seed: number
}

function initParts(kind: MatterState): FlowPart[] {
  return Array.from({ length: N_PART }, (_, i) => {
    if (kind === 'liquid') {
      return { nx: 0.06 + srand(i, 1) * 0.88, ny: 0.62 + srand(i, 2) * 0.3, vx: 0, vy: 0, seed: srand(i, 3) }
    }
    const ang = srand(i, 7) * Math.PI * 2
    return {
      nx: 0.06 + srand(i, 4) * 0.88,
      ny: 0.06 + srand(i, 5) * 0.88,
      vx: Math.cos(ang) * 60,
      vy: Math.sin(ang) * 60,
      seed: srand(i, 6),
    }
  })
}

function U2StatesSim() {
  const [kind, setKind] = useState<MatterState>('solid')
  const [temp, setTemp] = useState(45)
  const reduced = useReducedMotion()
  const partsRef = useRef<FlowPart[]>(initParts('solid'))
  const kindRef = useRef<MatterState>('solid')

  const { canvasRef } = useSimCanvas((ctx, w, h, t, dt) => {
    ctx.clearRect(0, 0, w, h)
    ctx.fillStyle = CANVAS.bg
    ctx.fillRect(0, 0, w, h)

    const bx = 18
    const by = 40
    const bw = w - 36
    const bh = h - by - 52
    if (bw < 60 || bh < 60) return

    // re-init particles when the state changes
    if (kindRef.current !== kind || partsRef.current.length !== N_PART) {
      kindRef.current = kind
      partsRef.current = initParts(kind)
    }

    // box
    ctx.fillStyle = CANVAS.panel
    rr(ctx, bx, by, bw, bh, 14)
    ctx.fill()
    ctx.strokeStyle = 'rgba(168,162,158,0.45)'
    ctx.lineWidth = 1.5
    ctx.stroke()
    faText(ctx, `جعبهٔ ماده · ${STATE_FA[kind]}`, bx + 12, by - 22, {
      align: 'right',
      bold: true,
      size: 13,
      color: CANVAS.amber,
    })

    const col = tempColor(temp)
    const drawDot = (x: number, y: number) => {
      ctx.fillStyle = col
      ctx.beginPath()
      ctx.arc(x, y, 5, 0, Math.PI * 2)
      ctx.fill()
      ctx.strokeStyle = 'rgba(28,25,23,0.55)'
      ctx.lineWidth = 1
      ctx.stroke()
    }
    const parts = partsRef.current

    if (kind === 'solid') {
      // triangular lattice, tiny vibration around a fixed site (amplitude ∝ T)
      const cols = 11
      const rows = 5
      const sx = Math.min(34, (bw - 56) / (cols - 1))
      const sy = sx * 0.88
      const x0 = bx + bw / 2 - (sx * (cols - 1)) / 2
      const y0 = by + bh / 2 - (sy * (rows - 1)) / 2
      const amp = reduced ? 0 : 0.8 + temp * 0.035
      for (let i = 0; i < N_PART; i++) {
        const r = i % cols
        const c = Math.floor(i / cols)
        const bxp = x0 + r * sx + (c % 2) * sx * 0.5
        const byp = y0 + c * sy
        const s = parts[i].seed
        const px = bxp + amp * Math.sin(t * (2.1 + s * 0.8) + i * 1.7)
        const py = byp + amp * Math.cos(t * (1.8 + s * 0.6) + i * 2.3)
        drawDot(px, py)
      }
    } else if (kind === 'liquid') {
      // cluster pinned to the lower half; slow swaps of neighbours
      const speed = 10 + temp * 0.9
      if (!reduced) {
        const D = 13
        for (let i = 0; i < parts.length; i++) {
          for (let j = i + 1; j < parts.length; j++) {
            const a = parts[i]
            const b = parts[j]
            const dx = (b.nx - a.nx) * bw
            const dy = (b.ny - a.ny) * bh
            const d2 = dx * dx + dy * dy
            if (d2 > 0.01 && d2 < D * D) {
              const d = Math.sqrt(d2)
              const push = ((D - d) / D) * 260 * dt / d
              a.vx -= dx * push
              a.vy -= dy * push
              b.vx += dx * push
              b.vy += dy * push
            }
          }
        }
        for (const p of parts) {
          p.vy += 55 * dt // gravity-like pull keeps the pool at the bottom
          p.vx += (0.5 - p.nx) * 14 * dt
          p.vx *= Math.max(0, 1 - 1.4 * dt)
          p.vy *= Math.max(0, 1 - 1.4 * dt)
          const sp = Math.hypot(p.vx, p.vy)
          if (sp > speed && sp > 0) {
            p.vx = (p.vx / sp) * speed
            p.vy = (p.vy / sp) * speed
          }
          p.nx += (p.vx * dt) / bw
          p.ny += (p.vy * dt) / bh
          if (p.nx < 0.05) { p.nx = 0.05; p.vx = Math.abs(p.vx) * 0.5 }
          if (p.nx > 0.95) { p.nx = 0.95; p.vx = -Math.abs(p.vx) * 0.5 }
          if (p.ny < 0.58) { p.ny = 0.58; p.vy = Math.abs(p.vy) * 0.4 }
          if (p.ny > 0.94) { p.ny = 0.94; p.vy = -Math.abs(p.vy) * 0.4 }
        }
      }
      for (const p of parts) drawDot(bx + p.nx * bw, by + p.ny * bh)
    } else {
      // gas: straight-line flights + wall reflections, speed ∝ T
      const speed = 22 + temp * 3.2
      if (!reduced) {
        for (const p of parts) {
          const sp = Math.hypot(p.vx, p.vy) || 1
          p.vx = (p.vx / sp) * speed
          p.vy = (p.vy / sp) * speed
          p.nx += (p.vx * dt) / bw
          p.ny += (p.vy * dt) / bh
          if (p.nx < 0.05) { p.nx = 0.05; p.vx = Math.abs(p.vx) }
          if (p.nx > 0.95) { p.nx = 0.95; p.vx = -Math.abs(p.vx) }
          if (p.ny < 0.06) { p.ny = 0.06; p.vy = Math.abs(p.vy) }
          if (p.ny > 0.94) { p.ny = 0.94; p.vy = -Math.abs(p.vy) }
        }
      }
      for (const p of parts) drawDot(bx + p.nx * bw, by + p.ny * bh)
    }

    faText(ctx, STATE_HINT[kind], w / 2, by + bh + 26, { size: 12, color: CANVAS.muted })
  }, 420)

  const avgSpeed =
    kind === 'solid' ? (0.8 + temp * 0.035) * 2.6 : kind === 'liquid' ? 10 + temp * 0.9 : 22 + temp * 3.2
  const avgDist = kind === 'solid' ? 32 : kind === 'liquid' ? 33 : 58

  return (
    <SimFrame
      title="مولکول‌ها در سه حالت"
      brief="حالت ماده و دما را عوض کن و رقص ذره‌ها را ببین: جامدِ مرتب، مایعِ لغزان و گازِ آزاد."
    >
      <div className="overflow-hidden rounded-lg border">
        <canvas
          ref={canvasRef}
          className="block w-full"
          aria-label="شبیه‌سازی ذرات ماده در حالت‌های جامد، مایع و گاز"
        />
      </div>
      <div className="flex flex-wrap items-center gap-3">
        <SimSelect
          label="حالت ماده"
          value={kind}
          options={STATE_OPTIONS}
          onChange={setKind}
          className="min-w-[130px]"
        />
        <SimSlider
          label="دما"
          value={temp}
          min={0}
          max={100}
          step={1}
          unit="°C"
          onChange={setTemp}
          className="min-w-[200px] flex-1"
        />
        <Readout label="وضعیت" value={STATE_FA[kind]} />
        <Readout label="سرعت متوسط (نمایشی)" value={fmtNum(avgSpeed)} />
        <Readout label="فاصلهٔ متوسط (نمایشی)" value={`≈ ${fmtNum(avgDist)}`} />
      </div>
      <div className="flex flex-wrap items-center gap-4">
        <Legend color={tempColor(10)} label="ذرهٔ سرد (کند)" />
        <Legend color={tempColor(90)} label="ذرهٔ داغ (تند)" />
      </div>
    </SimFrame>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// u2-intermolecular · «کاوشگر نیروی بین‌مولکولی» — F(r) & U(r) probe
// ─────────────────────────────────────────────────────────────────────────────
const R0_PX = 46 // px for r = r₀
const R_MIN = 0.7
const R_MAX = 2.5
const XU_LO = 0.6
const XU_HI = 3.0
const MOL_CY = 88

/** net force (normalised): >0 repulsion, <0 attraction, 0 at r₀ */
function forceNorm(x: number): number {
  return Math.pow(1 / x, 13) - Math.pow(1 / x, 7)
}
/** potential energy (normalised): minimum −ε at r₀ */
function potNorm(x: number): number {
  return Math.pow(1 / x, 12) - 2 * Math.pow(1 / x, 6)
}

function U2IntermolecularSim() {
  const [r, setR] = useState(1.35)
  const dragRef = useRef(false)

  const { canvasRef } = useSimCanvas((ctx, w, h) => {
    ctx.clearRect(0, 0, w, h)
    ctx.fillStyle = CANVAS.bg
    ctx.fillRect(0, 0, w, h)

    const F = forceNorm(r)
    const leftX = w / 2 - 34
    const rightX = leftX + r * R0_PX
    const xOf = (x: number) => 40 + ((x - XU_LO) / (XU_HI - XU_LO)) * (w - 58)

    // ── scene: two molecules ──
    // equilibrium ghost at r₀
    ctx.setLineDash([4, 4])
    ctx.strokeStyle = 'rgba(168,162,158,0.5)'
    ctx.lineWidth = 1.2
    ctx.beginPath()
    ctx.arc(leftX + R0_PX, MOL_CY, 17, 0, Math.PI * 2)
    ctx.stroke()
    ctx.setLineDash([])
    faText(ctx, 'r₀', leftX + R0_PX, MOL_CY - 26, { size: 11, color: CANVAS.muted })

    // force arrows on both molecules
    const isZero = Math.abs(F) < 0.004
    const isRep = F > 0
    const fCol = isZero ? CANVAS.muted : isRep ? CANVAS.red : CANVAS.emerald
    const L = isZero ? 8 : clamp(Math.abs(F) / 0.24, 0, 1) * 52
    const inset = 21
    if (isRep) {
      arrow(ctx, rightX + inset, MOL_CY, rightX + inset + L, MOL_CY, fCol, 3)
      arrow(ctx, leftX - inset, MOL_CY, leftX - inset - L, MOL_CY, fCol, 3)
    } else {
      arrow(ctx, rightX - inset, MOL_CY, rightX - inset - L, MOL_CY, fCol, 3)
      arrow(ctx, leftX + inset, MOL_CY, leftX + inset + L, MOL_CY, fCol, 3)
    }

    // molecules (right one is draggable)
    for (const [mx, ring] of [
      [leftX, false],
      [rightX, true],
    ] as const) {
      ctx.fillStyle = CANVAS.violet
      ctx.beginPath()
      ctx.arc(mx, MOL_CY, 17, 0, Math.PI * 2)
      ctx.fill()
      ctx.strokeStyle = ring ? 'rgba(245,158,11,0.9)' : 'rgba(28,25,23,0.6)'
      ctx.lineWidth = ring ? 2 : 1.5
      ctx.stroke()
      ctx.fillStyle = 'rgba(250,250,249,0.35)'
      ctx.beginPath()
      ctx.arc(mx - 5, MOL_CY - 5, 5, 0, Math.PI * 2)
      ctx.fill()
    }
    faText(ctx, 'بکش!', rightX, MOL_CY - 30, { size: 10, color: CANVAS.amber })
    monoText(ctx, `r = ${r.toFixed(2)} r0`, w / 2, MOL_CY + 44, { color: CANVAS.fg, size: 12 })

    // ── shared plot helpers ──
    const drawChartFrame = (top: number, hgt: number, lo: number, hi: number) => {
      ctx.fillStyle = 'rgba(41,37,36,0.6)'
      rr(ctx, 32, top - 4, w - 58, hgt + 8, 10)
      ctx.fill()
      // coloured regions
      ctx.fillStyle = 'rgba(239,68,68,0.10)'
      ctx.fillRect(xOf(XU_LO), top, xOf(1) - xOf(XU_LO), hgt)
      ctx.fillStyle = 'rgba(16,185,129,0.09)'
      ctx.fillRect(xOf(1), top, xOf(XU_HI) - xOf(1), hgt)
      // zero line
      const y0 = top + ((hi - 0) / (hi - lo)) * hgt
      ctx.strokeStyle = 'rgba(168,162,158,0.5)'
      ctx.lineWidth = 1
      ctx.beginPath()
      ctx.moveTo(xOf(XU_LO), y0)
      ctx.lineTo(xOf(XU_HI), y0)
      ctx.stroke()
      // equilibrium marker
      ctx.setLineDash([4, 4])
      ctx.strokeStyle = 'rgba(245,158,11,0.55)'
      ctx.beginPath()
      ctx.moveTo(xOf(1), top)
      ctx.lineTo(xOf(1), top + hgt)
      ctx.stroke()
      ctx.setLineDash([])
      // ticks
      for (const xv of [1, 2, 3]) {
        monoText(ctx, String(xv), xOf(xv), top + hgt + 12, { size: 10 })
      }
      monoText(ctx, 'r/r0', w - 22, top + hgt + 12, { size: 10, color: CANVAS.muted })
    }
    const plotCurve = (
      top: number,
      hgt: number,
      lo: number,
      hi: number,
      fn: (x: number) => number,
      color: string,
    ) => {
      const yOf = (v: number) => top + ((hi - clamp(v, lo, hi)) / (hi - lo)) * hgt
      ctx.strokeStyle = color
      ctx.lineWidth = 2
      ctx.beginPath()
      let first = true
      for (let xv = XU_LO; xv <= XU_HI + 1e-9; xv += 0.015) {
        const px = xOf(xv)
        const py = yOf(fn(xv))
        if (first) {
          ctx.moveTo(px, py)
          first = false
        } else {
          ctx.lineTo(px, py)
        }
      }
      ctx.stroke()
      return yOf
    }

    // ── F(r) chart ──
    const F_TOP = 168
    const F_H = 108
    drawChartFrame(F_TOP, F_H, -0.26, 0.34)
    const yOfF = plotCurve(F_TOP, F_H, -0.26, 0.34, forceNorm, CANVAS.orange)
    ctx.fillStyle = '#fafaf9'
    ctx.beginPath()
    ctx.arc(xOf(r), yOfF(clamp(F, -0.26, 0.34)), 4.5, 0, Math.PI * 2)
    ctx.fill()
    ctx.strokeStyle = CANVAS.orange
    ctx.lineWidth = 2
    ctx.stroke()
    faText(ctx, 'نیروی خالص F', w - 44, F_TOP + 10, { align: 'right', size: 11, color: CANVAS.orange })
    faText(ctx, 'دافعه', xOf(0.75), F_TOP + 10, { size: 10, color: 'rgba(239,68,68,0.8)' })
    faText(ctx, 'جاذبه', xOf(2.1), F_TOP + 10, { size: 10, color: 'rgba(16,185,129,0.8)' })

    // ── U(r) chart ──
    const U_TOP = 304
    const U_H = 108
    drawChartFrame(U_TOP, U_H, -1.25, 1.6)
    const yOfU = plotCurve(U_TOP, U_H, -1.25, 1.6, potNorm, CANVAS.violet)
    // −ε marker at r₀
    ctx.fillStyle = CANVAS.amber
    ctx.beginPath()
    ctx.moveTo(xOf(1), yOfU(-1) - 5)
    ctx.lineTo(xOf(1) + 4, yOfU(-1))
    ctx.lineTo(xOf(1), yOfU(-1) + 5)
    ctx.lineTo(xOf(1) - 4, yOfU(-1))
    ctx.closePath()
    ctx.fill()
    monoText(ctx, '-ε', xOf(1) + 14, yOfU(-1) + 2, { size: 10, color: CANVAS.amber })
    const U = potNorm(r)
    ctx.fillStyle = '#fafaf9'
    ctx.beginPath()
    ctx.arc(xOf(r), yOfU(clamp(U, -1.25, 1.6)), 4.5, 0, Math.PI * 2)
    ctx.fill()
    ctx.strokeStyle = CANVAS.violet
    ctx.lineWidth = 2
    ctx.stroke()
    faText(ctx, 'انرژی پتانسیل U', w - 44, U_TOP + 10, { align: 'right', size: 11, color: CANVAS.violet })
  }, 440)

  const onDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const c = e.currentTarget
    const p = canvasPos(e, c)
    const leftX = c.clientWidth / 2 - 34
    const rx = leftX + r * R0_PX
    if (Math.abs(p.y - MOL_CY) < 36 && Math.abs(p.x - rx) < 36) {
      dragRef.current = true
      try {
        c.setPointerCapture(e.pointerId)
      } catch {
        /* pointer capture unavailable — drag still works via move events */
      }
    }
  }
  const onMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!dragRef.current) return
    const c = e.currentTarget
    const p = canvasPos(e, c)
    const leftX = c.clientWidth / 2 - 34
    const nr = clamp((p.x - leftX) / R0_PX, R_MIN, R_MAX)
    setR(Math.round(nr * 100) / 100)
  }
  const onUp = (e: React.PointerEvent<HTMLCanvasElement>) => {
    dragRef.current = false
    try {
      e.currentTarget.releasePointerCapture(e.pointerId)
    } catch {
      /* nothing to release */
    }
  }

  const F = forceNorm(r)
  const forceLabel = Math.abs(F) < 0.004 ? 'صفر (تعادل)' : F < 0 ? 'جاذبه' : 'دافعه'
  const forceTone = Math.abs(F) < 0.004 ? 'text-slate-400' : F < 0 ? 'text-emerald-500' : 'text-red-500'

  return (
    <SimFrame
      title="کاوشگر نیروی بین‌مولکولی"
      brief="مولکول راست را با اشاره‌گر بکش (یا از اسلایدر استفاده کن)؛ فلش نیرو و نقطهٔ متحرک روی هر دو نمودار هم‌زمان جواب می‌دهند."
    >
      <div className="overflow-hidden rounded-lg border">
        <canvas
          ref={canvasRef}
          className="block w-full"
          style={{ touchAction: 'none' }}
          aria-label="کاوشگر نیرو و انرژی پتانسیل بین دو مولکول"
          onPointerDown={onDown}
          onPointerMove={onMove}
          onPointerUp={onUp}
          onPointerCancel={onUp}
        />
      </div>
      <div className="flex flex-wrap items-center gap-3">
        <SimSlider
          label="فاصلهٔ دو مولکول (r/r₀)"
          value={r}
          min={R_MIN}
          max={R_MAX}
          step={0.01}
          onChange={setR}
          format={(v) => v.toFixed(2)}
          className="min-w-[220px] flex-1"
        />
        <Readout label="فاصله r/r₀" value={fmtNum(r)} />
        <Readout label="نیروی خالص" value={forceLabel} tone={forceTone} />
      </div>
      <div className="flex flex-wrap items-center gap-4">
        <Legend color={CANVAS.emerald} label="جاذبه (r > r₀)" />
        <Legend color={CANVAS.red} label="دافعه (r < r₀)" />
        <Legend color={CANVAS.muted} label="تعادل (r = r₀)" />
        <Legend color={CANVAS.orange} label="نمودار F" />
        <Legend color={CANVAS.violet} label="نمودار U" />
      </div>
    </SimFrame>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// u2-pressure · «سنسور فشار در عمق» — hydrostatic pressure probe
// ─────────────────────────────────────────────────────────────────────────────
type FluidKey = 'water' | 'alcohol' | 'mercury'

const FLUIDS: Record<FluidKey, { label: string; rho: number; rgb: string }> = {
  water: { label: 'آب', rho: 1000, rgb: '20,184,166' },
  alcohol: { label: 'الکل', rho: 790, rgb: '217,119,6' },
  mercury: { label: 'جیوه', rho: 13600, rgb: '148,163,184' },
}
const FLUID_OPTIONS: { value: FluidKey; label: string }[] = [
  { value: 'water', label: 'آب (۱۰۰۰ kg/m³)' },
  { value: 'alcohol', label: 'الکل (۷۹۰ kg/m³)' },
  { value: 'mercury', label: 'جیوه (۱۳۶۰۰ kg/m³)' },
]

// fixed vertical layout (height = 420)
const TANK_TOP = 52
const TANK_H = 304
const SURF_Y = TANK_TOP + 26
const BOT_Y = TANK_TOP + TANK_H
const PX_PER_M = (BOT_Y - SURF_Y) / 12

function U2PressureSim() {
  const [fluid, setFluid] = useState<FluidKey>('water')
  const [depth, setDepth] = useState(4)
  const dragRef = useRef(false)
  const winBeep = useWinBeep()
  const reducedRef = useReducedMotionRef()

  const f = FLUIDS[fluid]
  const excess = f.rho * G * depth
  const pTotal = P0 + excess

  // چالش: در آب به فشار کل ۲×۱۰⁵ Pa برس (عمق ۱۰ متر؛ فشار کل ۳×۱۰⁵ با سقف ۱۲ متری ممکن نبود)
  const won = useChallenge(
    fluid === 'water' && Math.abs(pTotal - 2e5) <= 3000,
    fluid !== 'water' || Math.abs(pTotal - 2e5) > 9000,
    winBeep,
  )

  const { canvasRef } = useSimCanvas((ctx, w, h, t) => {
    ctx.clearRect(0, 0, w, h)
    ctx.fillStyle = CANVAS.bg
    ctx.fillRect(0, 0, w, h)

    const tx = w / 2 - 95
    const tw = 190
    const sx = tx + tw / 2
    const sy = SURF_Y + depth * PX_PER_M

    // tank + liquid (darker with depth)
    const grad = ctx.createLinearGradient(0, SURF_Y, 0, BOT_Y)
    grad.addColorStop(0, `rgba(${f.rgb},0.30)`)
    grad.addColorStop(1, `rgba(${f.rgb},0.85)`)
    ctx.fillStyle = grad
    ctx.fillRect(tx, SURF_Y, tw, BOT_Y - SURF_Y)
    ctx.strokeStyle = 'rgba(168,162,158,0.55)'
    ctx.lineWidth = 2
    rr(ctx, tx, TANK_TOP, tw, TANK_H, 10)
    ctx.stroke()
    ctx.strokeStyle = `rgba(${f.rgb},0.9)`
    ctx.lineWidth = 2
    ctx.beginPath()
    ctx.moveTo(tx + 2, SURF_Y)
    ctx.lineTo(tx + tw - 2, SURF_Y)
    ctx.stroke()

    // atmospheric arrows on the surface
    for (const ax of [tx + 45, tx + tw / 2, tx + tw - 45]) {
      arrow(ctx, ax, TANK_TOP + 6, ax, SURF_Y - 3, 'rgba(168,162,158,0.8)', 2)
    }
    faText(ctx, 'هوا · P₀', tx + tw - 10, TANK_TOP + 12, { align: 'right', size: 10, color: CANVAS.muted })

    // depth ruler
    for (let m = 0; m <= 12; m += 2) {
      const yy = SURF_Y + m * PX_PER_M
      ctx.strokeStyle = 'rgba(250,250,249,0.4)'
      ctx.lineWidth = 1
      ctx.beginPath()
      ctx.moveTo(tx + 4, yy)
      ctx.lineTo(tx + 12, yy)
      ctx.stroke()
      monoText(ctx, String(m), tx + 20, yy, { size: 10, align: 'left' })
    }
    faText(ctx, 'عمق (m)', tx + 26, BOT_Y + 16, { size: 11, color: CANVAS.muted })

    // gentle bubbles (decorative, off with reduced motion)
    if (!reducedRef.current) {
      for (let i = 0; i < 6; i++) {
        const bxp = tx + 22 + srand(i, 9) * (tw - 44)
        const span = BOT_Y - SURF_Y - 18
        const byy = BOT_Y - 8 - ((t * 26 + srand(i, 8) * 300) % span)
        ctx.strokeStyle = 'rgba(250,250,249,0.35)'
        ctx.lineWidth = 1
        ctx.beginPath()
        ctx.arc(bxp, byy, 1.5 + srand(i, 10) * 2, 0, Math.PI * 2)
        ctx.stroke()
      }
    }

    // all-round pressure arrows (length ∝ P)
    const pScale = clamp(pTotal / 2e5, 0, 1.6)
    const len = 10 + pScale * 24
    for (let k = 0; k < 8; k++) {
      const ang = (k / 8) * Math.PI * 2 + Math.PI / 8
      const dx = Math.cos(ang)
      const dy = Math.sin(ang)
      arrow(
        ctx,
        sx + dx * (34 + len),
        sy + dy * (34 + len),
        sx + dx * 34,
        sy + dy * 34,
        'rgba(239,68,68,0.85)',
        2.5,
      )
    }

    // mini submarine (the sensor)
    ctx.fillStyle = CANVAS.amber
    rr(ctx, sx - 26, sy - 12, 52, 24, 9)
    ctx.fill()
    ctx.strokeStyle = 'rgba(28,25,23,0.6)'
    ctx.lineWidth = 1.5
    ctx.stroke()
    ctx.fillStyle = '#1c1917'
    ctx.fillRect(sx - 14, sy - 20, 4, 10)
    ctx.fillRect(sx - 14, sy - 22, 9, 3)
    ctx.fillStyle = 'rgba(250,250,249,0.85)'
    ctx.beginPath()
    ctx.arc(sx + 10, sy, 5, 0, Math.PI * 2)
    ctx.fill()
    faText(ctx, 'سنسور', sx, sy + 30, { size: 10, color: 'rgba(250,250,249,0.75)' })

    // stacked share bar: air | liquid
    const barY = h - 34
    const barH = 12
    const bx = 18
    const bw = w - 36
    const airFrac = clamp(P0 / pTotal, 0, 1)
    ctx.fillStyle = 'rgba(168,162,158,0.85)'
    ctx.fillRect(bx, barY, bw * airFrac, barH)
    ctx.fillStyle = `rgb(${f.rgb})`
    ctx.fillRect(bx + bw * airFrac, barY, bw * (1 - airFrac), barH)
    ctx.strokeStyle = 'rgba(250,250,249,0.35)'
    ctx.lineWidth = 1
    rr(ctx, bx, barY, bw, barH, 4)
    ctx.stroke()
    if (bw * airFrac > 60) {
      faText(ctx, `هوا ${fmtNum(P0)}`, bx + (bw * airFrac) / 2, barY + barH / 2, { size: 9, color: '#1c1917' })
    }
    if (bw * (1 - airFrac) > 60) {
      faText(ctx, `مایع ${fmtNum(excess)}`, bx + bw * airFrac + (bw * (1 - airFrac)) / 2, barY + barH / 2, {
        size: 9,
        color: '#1c1917',
      })
    }

    if (won) drawWinBanner(ctx, w, 'آفرین! فشار کل = ۲ برابر فشار هوا')
  }, 420)

  const onDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const c = e.currentTarget
    const p = canvasPos(e, c)
    const sx = c.clientWidth / 2
    if (Math.abs(p.x - sx) < 70 && Math.abs(p.y - (SURF_Y + depth * PX_PER_M)) < 40) {
      dragRef.current = true
      try {
        c.setPointerCapture(e.pointerId)
      } catch {
        /* noop */
      }
    }
  }
  const onMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!dragRef.current) return
    const p = canvasPos(e, e.currentTarget)
    const d = clamp((p.y - SURF_Y) / PX_PER_M, 0, 12)
    setDepth(Math.round(d * 10) / 10)
  }
  const onUp = (e: React.PointerEvent<HTMLCanvasElement>) => {
    dragRef.current = false
    try {
      e.currentTarget.releasePointerCapture(e.pointerId)
    } catch {
      /* noop */
    }
  }

  const status = won
    ? 'چالش انجام شد! در عمق ۱۰ متری آب، فشار کل ۲۰۰٬۰۰۰ پاسکال است — دو برابر فشار هوا.'
    : 'چالش: با مایع «آب»، سنسور را به عمقی ببر که فشار کل ۲×۱۰⁵ Pa شود (یعنی ۲ برابر فشار هوا).'

  return (
    <SimFrame
      title="سنسور فشار در عمق"
      brief="مایع و عمق را عوض کن؛ سنسور را با اسلایدر یا مستقیم با اشاره‌گر بالا و پایین ببر و سهم هوا و مایع را در فشار کل ببین."
    >
      <div className="overflow-hidden rounded-lg border">
        <canvas
          ref={canvasRef}
          className="block w-full"
          style={{ touchAction: 'none' }}
          aria-label="سنسور فشار در عمق مایع با نمایش فشار هوا و فشار مایع"
          onPointerDown={onDown}
          onPointerMove={onMove}
          onPointerUp={onUp}
          onPointerCancel={onUp}
        />
      </div>
      <div className="flex flex-wrap items-center gap-3">
        <SimSelect label="مایع" value={fluid} options={FLUID_OPTIONS} onChange={setFluid} className="min-w-[170px]" />
        <SimSlider
          label="عمق سنسور"
          value={depth}
          min={0}
          max={12}
          step={0.1}
          unit="m"
          onChange={setDepth}
          format={(v) => v.toFixed(1)}
          className="min-w-[200px] flex-1"
        />
        <Readout label="فشار هوا P₀" value={fmtNum(P0)} unit="Pa" />
        <Readout label="فشار فزونی ρgh" value={fmtNum(excess)} unit="Pa" />
        <Readout label="فشار کل" value={fmtNum(pTotal)} unit="Pa" tone="text-amber-500" />
      </div>
      <div className="flex flex-wrap items-center gap-4">
        <Legend color="#a8a29e" label="سهم فشار هوا" />
        <Legend color={`rgb(${f.rgb})`} label="سهم فشار مایع" />
      </div>
      <p role="status" className={won ? 'text-sm font-semibold text-emerald-500' : 'text-sm text-muted-foreground'}>
        {status}
      </p>
    </SimFrame>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// u2-buoyancy · «حوض شناوری» — block, buoyant force & weight
// ─────────────────────────────────────────────────────────────────────────────
const BS = 62 // block size px (≈ 0.4 m → V = 0.064 m³)
const POOL_W = 300
const POOL_TOP = 54
const SURF_B = 104 // water surface y
const FLOOR_B = 390
const HELD_Y = 64 // block centre while held above water
const BLOCK_V = 0.064 // m³

function buoyTargetY(rhoB: number, rhoF: number): number {
  if (rhoB > rhoF + 1) return FLOOR_B - BS / 2 - 2 // ته‌نشین
  if (Math.abs(rhoB - rhoF) <= 1) return SURF_B + 140 // تعلیق در میانهٔ آب
  const fe = clamp(rhoB / rhoF, 0, 1)
  return SURF_B - BS / 2 + fe * BS // شناور با کسر fe
}

function U2BuoyancySim() {
  const [rhoB, setRhoB] = useState(600)
  const [fluid, setFluid] = useState<FluidKey>('water')
  const [released, setReleased] = useState(false)
  const [yDisp, setYDisp] = useState(HELD_Y)
  const winBeep = useWinBeep()
  const reducedRef = useReducedMotionRef()

  const yRef = useRef(HELD_Y)
  const yDispRef = useRef(HELD_Y)

  const f = FLUIDS[fluid]
  const W = rhoB * G * BLOCK_V
  const fEq = rhoB / f.rho

  const won = useChallenge(
    fluid === 'water' && released && Math.abs(fEq - 0.5) <= 0.03,
    fluid !== 'water' || !released || Math.abs(fEq - 0.5) > 0.08,
    winBeep,
  )

  const { canvasRef } = useSimCanvas((ctx, w, h, t, dt) => {
    ctx.clearRect(0, 0, w, h)
    ctx.fillStyle = CANVAS.bg
    ctx.fillRect(0, 0, w, h)

    const px = w / 2 - POOL_W / 2
    const bcx = px + POOL_W / 2
    if (px < 4) return

    // ease the block toward its target (equilibrium or held position)
    const yT = !released ? HELD_Y : buoyTargetY(rhoB, f.rho)
    if (reducedRef.current) {
      yRef.current = yT
    } else {
      yRef.current += (yT - yRef.current) * Math.min(1, 4.5 * dt)
      if (Math.abs(yT - yRef.current) < 0.4) yRef.current = yT
    }
    if (Math.abs(yRef.current - yDispRef.current) > 0.5) {
      yDispRef.current = yRef.current
      setYDisp(yRef.current)
    }
    const y = yRef.current

    // pool + water
    const grad = ctx.createLinearGradient(0, SURF_B, 0, FLOOR_B)
    grad.addColorStop(0, `rgba(${f.rgb},0.30)`)
    grad.addColorStop(1, `rgba(${f.rgb},0.80)`)
    ctx.fillStyle = grad
    ctx.fillRect(px, SURF_B, POOL_W, FLOOR_B - SURF_B)
    ctx.strokeStyle = 'rgba(168,162,158,0.55)'
    ctx.lineWidth = 2
    rr(ctx, px, POOL_TOP, POOL_W, FLOOR_B - POOL_TOP, 10)
    ctx.stroke()
    ctx.strokeStyle = `rgba(${f.rgb},0.95)`
    ctx.lineWidth = 2
    ctx.beginPath()
    ctx.moveTo(px + 2, SURF_B)
    ctx.lineTo(px + POOL_W - 2, SURF_B)
    ctx.stroke()
    faText(ctx, 'سطح مایع', px + POOL_W - 8, SURF_B - 12, { align: 'right', size: 10, color: CANVAS.muted })
    // floor hatch
    ctx.strokeStyle = 'rgba(168,162,158,0.4)'
    ctx.lineWidth = 1
    for (let hx = px + 8; hx < px + POOL_W - 4; hx += 16) {
      ctx.beginPath()
      ctx.moveTo(hx, FLOOR_B - 1)
      ctx.lineTo(hx + 8, FLOOR_B - 9)
      ctx.stroke()
    }

    // decorative water molecules around the block
    for (let i = 0; i < 8; i++) {
      let mx = px + 24 + srand(i, 20) * (POOL_W - 48)
      let my = SURF_B + 22 + srand(i, 21) * (FLOOR_B - SURF_B - 44)
      if (!reducedRef.current) my += 2.5 * Math.sin(t * 1.8 + i * 1.4)
      if (Math.abs(mx - bcx) < 58 && Math.abs(my - y) < 58) mx = px + 26
      ctx.fillStyle = `rgba(${f.rgb},0.75)`
      ctx.beginPath()
      ctx.arc(mx, my, 3, 0, Math.PI * 2)
      ctx.fill()
      ctx.beginPath()
      ctx.arc(mx - 5, my - 3, 1.7, 0, Math.PI * 2)
      ctx.fill()
      ctx.beginPath()
      ctx.arc(mx + 5, my - 3, 1.7, 0, Math.PI * 2)
      ctx.fill()
    }

    // forces with a true common scale
    const fNow = clamp((y + BS / 2 - SURF_B) / BS, 0, 1)
    const Fb = f.rho * G * BLOCK_V * fNow
    const scale = 84 / Math.max(W, f.rho * G * BLOCK_V, 1)
    if (Fb * scale > 4) {
      arrow(ctx, bcx - 11, y - 12, bcx - 11, y - 12 - Fb * scale, CANVAS.emerald, 3)
      faText(ctx, 'شناوری', bcx - 11, y - 16 - Fb * scale, { size: 10, color: CANVAS.emerald })
    }
    if (W * scale > 4) {
      arrow(ctx, bcx + 11, y + 12, bcx + 11, y + 12 + W * scale, CANVAS.rose, 3)
      faText(ctx, 'وزن', bcx + 11, y + 18 + W * scale, { size: 10, color: CANVAS.rose })
    }

    // the block (submerged part tinted with the fluid colour)
    const bx = bcx - BS / 2
    ctx.fillStyle = CANVAS.amber
    rr(ctx, bx, y - BS / 2, BS, BS, 6)
    ctx.fill()
    ctx.strokeStyle = 'rgba(28,25,23,0.65)'
    ctx.lineWidth = 2
    ctx.stroke()
    const subTop = Math.max(SURF_B, y - BS / 2)
    const subH = clamp(y + BS / 2 - SURF_B, 0, BS)
    if (subH > 0) {
      ctx.fillStyle = `rgba(${f.rgb},0.35)`
      ctx.fillRect(bx, subTop, BS, subH)
    }
    faText(ctx, fmtNum(rhoB), bcx, y - 6, { bold: true, size: 12, color: '#1c1917' })
    monoText(ctx, 'kg/m³', bcx, y + 8, { size: 8, color: 'rgba(28,25,23,0.8)' })

    // status line
    const st =
      !released
        ? 'بلوک در دست توست — «رها کن» را بزن'
        : rhoB < f.rho - 1
          ? `شناور · حدود ${fmtNum(fEq * 100)}٪ زیر مایع`
          : Math.abs(rhoB - f.rho) <= 1
            ? 'تعلیق · کاملاً زیر مایع، بی‌حرکت'
            : 'ته‌نشین · به کف می‌رسد'
    faText(ctx, st, bcx, FLOOR_B + 20, { size: 12, color: CANVAS.muted })

    if (won) drawWinBanner(ctx, w, 'تعادل کامل! نیمهٔ بلوک زیر آب ماند')
  }, 430)

  const fNowDisp = clamp((yDisp + BS / 2 - SURF_B) / BS, 0, 1)
  const FbDisp = f.rho * G * BLOCK_V * fNowDisp
  const status =
    !released
      ? 'در دست'
      : rhoB < f.rho - 1
        ? 'شناور'
        : Math.abs(rhoB - f.rho) <= 1
          ? 'تعلیق'
          : 'ته‌نشین'

  return (
    <SimFrame
      title="حوض شناوری"
      brief="چگالی بلوک و مایع را تنظیم کن و «رها کن» را بزن؛ فلش‌ها با مقیاس واقعی نسبت به هم رسم می‌شوند. چالش «تعادل نیمه»: در آب، بلوکی که دقیقاً نیمه‌اش زیر آب بماند (±۳٪)."
    >
      <div className="overflow-hidden rounded-lg border">
        <canvas ref={canvasRef} className="block w-full" aria-label="حوض شناوری: بلوک در مایع با فلش‌های نیروی شناوری و وزن" />
      </div>
      <div className="flex flex-wrap items-center gap-3">
        <SimSlider
          label="چگالی بلوک"
          value={rhoB}
          min={100}
          max={3000}
          step={10}
          unit="kg/m³"
          onChange={setRhoB}
          className="min-w-[200px] flex-1"
        />
        <SimSelect label="مایع" value={fluid} options={FLUID_OPTIONS} onChange={setFluid} className="min-w-[170px]" />
        <SimButton onClick={() => setReleased((r) => !r)}>{released ? 'برداشتن بلوک' : 'رها کن'}</SimButton>
      </div>
      <div className="flex flex-wrap items-center gap-3">
        <Readout label="چگالی بلوک" value={fmtNum(rhoB)} unit="kg/m³" />
        <Readout label="نیروی شناوری" value={fmtNum(FbDisp)} unit="N" tone="text-emerald-500" />
        <Readout label="وزن W" value={fmtNum(W)} unit="N" tone="text-rose-500" />
        <Readout label="زیر مایع" value={fmtNum(fNowDisp * 100)} unit="%" />
        <Readout label="وضعیت" value={status} />
      </div>
      <p role="status" className={won ? 'text-sm font-semibold text-emerald-500' : 'text-sm text-muted-foreground'}>
        {won
          ? 'تعادل کامل! چگالی بلوک نصف چگالی آب است (۵۰۰ kg/m³) و دقیقاً نیمهٔ آن زیر آب ماند.'
          : 'چالش «تعادل نیمه» فعال است: چگالی بلوک را طوری بگذار که دقیقاً نیمهٔ آن زیر آب بماند، بعد رها کن.'}
      </p>
    </SimFrame>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// u2-bernoulli · «لولهٔ ونتوری» — continuity + Bernoulli gauges
// ─────────────────────────────────────────────────────────────────────────────
const R1_CM = 4 // entry/exit radius (cm)
const PPC = 13.5 // px per cm
const CY_B = 250 // pipe centreline y
const N_TRACER = 26

interface Tracer {
  u: number
  s: number
}

function pipeRadius(u: number, rT: number): number {
  const t1 = 0.3
  const t2 = 0.44
  const t3 = 0.56
  const t4 = 0.7
  if (u <= t1) return R1_CM
  if (u < t2) {
    const k = (u - t1) / (t2 - t1)
    const s = (1 - Math.cos(k * Math.PI)) / 2
    return R1_CM + (rT - R1_CM) * s
  }
  if (u <= t3) return rT
  if (u < t4) {
    const k = (u - t3) / (t4 - t3)
    const s = (1 - Math.cos(k * Math.PI)) / 2
    return rT + (R1_CM - rT) * s
  }
  return R1_CM
}

function U2BernoulliSim() {
  const [q, setQ] = useState(6) // L/s
  const [rT, setRT] = useState(2.5) // cm
  const winBeep = useWinBeep()
  const reducedRef = useReducedMotionRef()

  const A1 = Math.PI * R1_CM * R1_CM
  const A2 = Math.PI * rT * rT
  const v1 = (q * 1000) / A1 / 100 // m/s
  const v2 = (q * 1000) / A2 / 100 // m/s
  const p1 = P0
  const p2 = P0 - 0.5 * 1000 * (v2 * v2 - v1 * v1)

  const won = useChallenge(
    Math.abs(v2 - 8) <= 0.3,
    Math.abs(v2 - 8) > 0.9,
    winBeep,
  )

  const tracersRef = useRef<Tracer[]>(
    Array.from({ length: N_TRACER }, (_, i) => ({
      u: srand(i, 30),
      s: srand(i, 31) * 1.7 - 0.85,
    })),
  )

  const { canvasRef } = useSimCanvas((ctx, w, h, t, dt) => {
    ctx.clearRect(0, 0, w, h)
    ctx.fillStyle = CANVAS.bg
    ctx.fillRect(0, 0, w, h)

    const pipeLen = w - 48
    if (pipeLen < 80) return
    const xOfU = (u: number) => 24 + u * pipeLen

    // pipe body
    const steps = 90
    const upper: [number, number][] = []
    const lower: [number, number][] = []
    for (let i = 0; i <= steps; i++) {
      const u = i / steps
      const ry = pipeRadius(u, rT) * PPC
      upper.push([xOfU(u), CY_B - ry])
      lower.push([xOfU(u), CY_B + ry])
    }
    ctx.beginPath()
    ctx.moveTo(upper[0][0], upper[0][1])
    for (const [px, py] of upper) ctx.lineTo(px, py)
    for (let i = lower.length - 1; i >= 0; i--) ctx.lineTo(lower[i][0], lower[i][1])
    ctx.closePath()
    ctx.fillStyle = 'rgba(20,184,166,0.16)'
    ctx.fill()

    // tracer particles: local speed ∝ 1/A
    const tracers = tracersRef.current
    if (!reducedRef.current) {
      for (const tr of tracers) {
        const rc = pipeRadius(tr.u, rT)
        const vCm = (q * 1000) / (Math.PI * rc * rc)
        tr.u += (vCm * PPC * 0.045 * dt) / pipeLen
        if (tr.u > 1) {
          tr.u -= 1
          tr.s = Math.random() * 1.7 - 0.85
        }
      }
    }
    for (let i = 0; i < tracers.length; i++) {
      const tr = reducedRef.current
        ? { u: srand(i, 32), s: srand(i, 33) * 1.7 - 0.85 }
        : tracers[i]
      const rc = pipeRadius(tr.u, rT)
      const px = xOfU(tr.u)
      const py = CY_B + tr.s * (rc * PPC - 5)
      ctx.fillStyle = 'rgba(45,212,191,0.9)'
      ctx.beginPath()
      ctx.arc(px, py, 2.2, 0, Math.PI * 2)
      ctx.fill()
      if (reducedRef.current) {
        const vCm = (q * 1000) / (Math.PI * rc * rc)
        arrow(ctx, px, py, px + vCm * 0.06, py, 'rgba(45,212,191,0.7)', 1.5)
      }
    }

    // walls
    ctx.strokeStyle = 'rgba(250,250,249,0.75)'
    ctx.lineWidth = 2
    ctx.beginPath()
    ctx.moveTo(upper[0][0], upper[0][1])
    for (const [px, py] of upper) ctx.lineTo(px, py)
    ctx.stroke()
    ctx.beginPath()
    ctx.moveTo(lower[0][0], lower[0][1])
    for (const [px, py] of lower) ctx.lineTo(px, py)
    ctx.stroke()
    faText(ctx, 'گلویی', xOfU(0.5), CY_B + rT * PPC + 16, { size: 11, color: CANVAS.muted })

    // pressure gauges: inlet · throat · exit
    const gauges: { u: number; p: number; label: string }[] = [
      { u: 0.1, p: p1, label: 'ورودی' },
      { u: 0.5, p: p2, label: 'گلویی' },
      { u: 0.9, p: p1, label: 'خروجی' },
    ]
    for (const g of gauges) {
      const gx = xOfU(g.u)
      const wallY = CY_B - pipeRadius(g.u, rT) * PPC
      ctx.setLineDash([3, 4])
      ctx.strokeStyle = 'rgba(168,162,158,0.4)'
      ctx.lineWidth = 1
      ctx.beginPath()
      ctx.moveTo(gx, 136)
      ctx.lineTo(gx, wallY)
      ctx.stroke()
      ctx.setLineDash([])
      const bh = clamp((g.p - 30000) / 75000, 0, 1) * 84 + 4
      ctx.fillStyle = g.p < 70000 ? CANVAS.orange : CANVAS.teal
      ctx.fillRect(gx - 9, 136 - bh, 18, bh)
      ctx.strokeStyle = 'rgba(168,162,158,0.6)'
      ctx.lineWidth = 1.5
      rr(ctx, gx - 11, 44, 22, 92, 5)
      ctx.stroke()
      monoText(ctx, `${fmtNum(g.p / 1000)} kPa`, gx, 34, {
        size: 10,
        color: g.p < 70000 ? CANVAS.orange : CANVAS.teal,
      })
      faText(ctx, g.label, gx, 152, { size: 11 })
    }

    faText(ctx, 'نوار فشار: بلندتر = فشار بیشتر', w - 28, h - 14, {
      align: 'right',
      size: 11,
      color: CANVAS.muted,
    })
    faText(ctx, 'ذره‌ها در جای باریک تندتر می‌روند', 28, h - 14, {
      align: 'left',
      size: 11,
      color: CANVAS.muted,
    })

    if (won) drawWinBanner(ctx, w, 'عالی! سرعت گلویی = ۸ m/s')
  }, 400)

  const status = won
    ? 'چالش انجام شد! سرعت شاره در گلویی ۸ متر بر ثانیه است و فشار آن‌جا به کمترین مقدار رسید.'
    : 'چالش: گلویی (و در صورت نیاز دبی Q) را طوری تنظیم کن که سرعت شاره در گلویی ۸ m/s شود (±۰٫۳).'

  return (
    <SimFrame
      title="لولهٔ ونتوری"
      brief="دبی و شعاع گلویی را تغییر بده؛ ذره‌های ردیاب سرعت محلی (∝ ۱/A) و سه سنج فشار برنولی را هم‌زمان نشان می‌دهند."
    >
      <div className="overflow-hidden rounded-lg border">
        <canvas ref={canvasRef} className="block w-full" aria-label="لولهٔ ونتوری با ذره‌های ردیاب و سنج‌های فشار ورودی، گلویی و خروجی" />
      </div>
      <div className="flex flex-wrap items-center gap-3">
        <SimSlider
          label="دبی حجمی Q"
          value={q}
          min={1}
          max={8}
          step={0.25}
          unit="L/s"
          onChange={setQ}
          format={(v) => v.toFixed(2)}
          className="min-w-[200px] flex-1"
        />
        <SimSlider
          label="شعاع گلویی"
          value={rT}
          min={1.5}
          max={4}
          step={0.05}
          unit="cm"
          onChange={setRT}
          format={(v) => v.toFixed(2)}
          className="min-w-[200px] flex-1"
        />
      </div>
      <div className="flex flex-wrap items-center gap-3">
        <Readout label="v ورودی" value={fmtNum(v1)} unit="m/s" />
        <Readout label="v گلویی" value={fmtNum(v2)} unit="m/s" tone="text-amber-500" />
        <Readout label="P ورودی" value={fmtNum(p1 / 1000)} unit="kPa" />
        <Readout
          label="P گلویی"
          value={fmtNum(p2 / 1000)}
          unit="kPa"
          tone={p2 < 70000 ? 'text-orange-500' : undefined}
        />
      </div>
      <div className="flex flex-wrap items-center gap-4">
        <Legend color={CANVAS.teal} label="فشار نرمال" />
        <Legend color={CANVAS.orange} label="افت فشار در گلویی" />
        <Legend color="rgba(45,212,191,0.9)" label="ذرهٔ ردیاب" />
      </div>
      <p role="status" className={won ? 'text-sm font-semibold text-emerald-500' : 'text-sm text-muted-foreground'}>
        {status}
      </p>
    </SimFrame>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
export const simsCh2: Record<string, SimComponent> = {
  'u2-states': U2StatesSim,
  'u2-intermolecular': U2IntermolecularSim,
  'u2-pressure': U2PressureSim,
  'u2-buoyancy': U2BuoyancySim,
  'u2-bernoulli': U2BernoulliSim,
}
