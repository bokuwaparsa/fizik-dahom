// ─── فیزیک‌دهم · فصل ۵ «ترمودینامیک» widgets ──────────────────────────────────
// ۸ آزمایشگاه تعاملی فصل ۵ (u5-review از simKey مشترک 'u5-processes' استفاده می‌کند).
// قرارداد: W کارِ انجام‌شده توسط گاز (انبساط W>0)، Q گرما ورودی مثبت، دماها کلوین.
'use client'

import { useEffect, useRef, useState } from 'react'
import {
  CANVAS,
  SimFrame,
  SimSlider,
  SimSelect,
  SimButton,
  SimToggle,
  Readout,
  Legend,
  useSimCanvas,
  drawGrid,
  useSimBeep,
  useReducedMotion,
  canvasPos,
} from '@/components/sims/sim-kit'
import type { SimComponent } from '@/lib/game/types'

// ─── chapter-local helpers (do not import from p1) ───────────────────────────
const FONT_FA = '600 12px Vazirmatn, Tahoma, sans-serif'

/** Format a number for readouts/canvas — never NaN/Infinity. */
function fmt(v: number): string {
  if (!Number.isFinite(v)) return '—'
  const a = Math.abs(v)
  if (a >= 10000) return Math.round(v).toLocaleString('en-US')
  const r = Math.round(v * 100) / 100
  if (Number.isInteger(r)) return String(r)
  return r.toFixed(2).replace(/0+$/, '').replace(/\.$/, '')
}

function rr(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, rad: number) {
  const r = Math.min(rad, w / 2, h / 2)
  ctx.beginPath()
  ctx.moveTo(x + r, y)
  ctx.arcTo(x + w, y, x + w, y + h, r)
  ctx.arcTo(x + w, y + h, x, y + h, r)
  ctx.arcTo(x, y + h, x, y, r)
  ctx.arcTo(x, y, x + w, y, r)
  ctx.closePath()
}

/** Draw Persian text safely on canvas (rtl). */
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

/** Rounded banner across the canvas (win / warning). */
function banner(
  ctx: CanvasRenderingContext2D,
  w: number,
  y: number,
  text: string,
  color = CANVAS.emerald,
) {
  const bw = Math.min(500, w - 24)
  ctx.fillStyle = color
  rr(ctx, (w - bw) / 2, y, bw, 36, 10)
  ctx.fill()
  faText(ctx, text, w / 2, y + 18, { bold: true, size: 13, color: '#ffffff' })
}

function arrow(
  ctx: CanvasRenderingContext2D,
  x1: number,
  y1: number,
  x2: number,
  y2: number,
  color: string,
  width = 3,
) {
  const a = Math.atan2(y2 - y1, x2 - x1)
  const head = Math.max(8, width * 2.8)
  ctx.strokeStyle = color
  ctx.fillStyle = color
  ctx.lineWidth = width
  ctx.beginPath()
  ctx.moveTo(x1, y1)
  ctx.lineTo(x2 - Math.cos(a) * head * 0.7, y2 - Math.sin(a) * head * 0.7)
  ctx.stroke()
  ctx.beginPath()
  ctx.moveTo(x2, y2)
  ctx.lineTo(x2 - Math.cos(a - 0.42) * head, y2 - Math.sin(a - 0.42) * head)
  ctx.lineTo(x2 - Math.cos(a + 0.42) * head, y2 - Math.sin(a + 0.42) * head)
  ctx.closePath()
  ctx.fill()
}

/** Small translucent info panel. */
function panel(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number) {
  ctx.fillStyle = 'rgba(41,37,36,0.88)'
  rr(ctx, x, y, w, h, 8)
  ctx.fill()
  ctx.strokeStyle = 'rgba(245,158,11,0.35)'
  ctx.lineWidth = 1
  ctx.stroke()
}

/** Win feedback: two ascending beeps. */
function useWinBeep() {
  const beep = useSimBeep()
  return () => {
    beep(660, 120)
    window.setTimeout(() => beep(880, 160), 150)
  }
}

/** Timed canvas banner that needs the RAF clock. */
function useCanvasBanner() {
  const st = useRef({ pending: '', text: '', until: 0, dur: 2.6 })
  return {
    show: (text: string, dur = 2.6) => {
      st.current.pending = text
      st.current.dur = dur
    },
    tick: (t: number): string => {
      const s = st.current
      if (s.pending) {
        s.text = s.pending
        s.until = t + Math.max(0.5, s.dur)
        s.pending = ''
      }
      return s.until > t ? s.text : ''
    },
    clear: () => {
      st.current.pending = ''
      st.current.text = ''
      st.current.until = 0
    },
  }
}

interface PlotGeom {
  px: (v: number) => number
  py: (p: number) => number
  x0: number
  y0: number
  pw: number
  ph: number
  mL: number
  mB: number
}

/** Draw a P–V frame (P axis in 10⁵ Pa, V axis in L) inside a region. */
function drawPlot(
  ctx: CanvasRenderingContext2D,
  x0: number,
  y0: number,
  pw: number,
  ph: number,
  vMin: number,
  vMax: number,
  pMin: number,
  pMax: number,
  yTitle = 'P (10⁵ Pa)',
  xTitle = 'V (L)',
): PlotGeom {
  const mL = 42
  const mB = 28
  const px = (v: number) => x0 + mL + ((v - vMin) / (vMax - vMin)) * (pw - mL - 10)
  const py = (p: number) => y0 + ph - mB - ((p - pMin) / (pMax - pMin)) * (ph - mB - 12)
  ctx.font = FONT_FA
  for (let i = 0; i <= 4; i++) {
    const v = vMin + ((vMax - vMin) * i) / 4
    const p = pMin + ((pMax - pMin) * i) / 4
    ctx.strokeStyle = CANVAS.grid
    ctx.lineWidth = 1
    ctx.beginPath()
    ctx.moveTo(px(v), y0 + 6)
    ctx.lineTo(px(v), y0 + ph - mB)
    ctx.stroke()
    ctx.beginPath()
    ctx.moveTo(x0 + mL, py(p))
    ctx.lineTo(x0 + pw - 10, py(p))
    ctx.stroke()
    ctx.fillStyle = CANVAS.muted
    ctx.textAlign = 'center'
    ctx.fillText(fmt(v * 1000), px(v), y0 + ph - mB + 16)
    ctx.textAlign = 'right'
    ctx.fillText(fmt(p / 1e5), x0 + mL - 6, py(p) + 3)
  }
  ctx.strokeStyle = CANVAS.muted
  ctx.lineWidth = 1.5
  ctx.beginPath()
  ctx.moveTo(x0 + mL, y0 + 6)
  ctx.lineTo(x0 + mL, y0 + ph - mB)
  ctx.lineTo(x0 + pw - 10, y0 + ph - mB)
  ctx.stroke()
  faText(ctx, yTitle, x0 + 8, y0 + 2, { size: 10, color: CANVAS.muted, align: 'left' })
  faText(ctx, xTitle, x0 + pw - 8, y0 + ph - 8, { size: 10, color: CANVAS.muted })
  return { px, py, x0, y0, pw, ph, mL, mB }
}

/** Vertical cylinder with piston; gasH = gas column height (px). */
function drawCylinder(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  gasH: number,
  opts?: { jit?: number; t?: number; n?: number; gasColor?: string },
) {
  const gh = Math.max(10, Math.min(h, gasH))
  const gasTop = y + h - gh
  ctx.fillStyle = opts?.gasColor ?? 'rgba(139,92,246,0.18)'
  ctx.fillRect(x, gasTop, w, gh)
  const jit = opts?.jit ?? 0
  const t = opts?.t ?? 0
  ctx.fillStyle = CANVAS.violet
  if (gh > 18) {
    const n = opts?.n ?? 24
    for (let i = 0; i < n; i++) {
      const u = ((i * 73) % 97) / 97
      const v = ((i * 41) % 89) / 89
      const jx = jit > 0 ? Math.sin(t * 9 + i * 1.7) * jit : 0
      const jy = jit > 0 ? Math.cos(t * 7.3 + i * 2.3) * jit : 0
      ctx.beginPath()
      ctx.arc(x + 6 + u * (w - 12) + jx, gasTop + 6 + v * (gh - 12) + jy, 2.2, 0, Math.PI * 2)
      ctx.fill()
    }
  }
  // walls (U shape)
  ctx.strokeStyle = CANVAS.muted
  ctx.lineWidth = 3
  ctx.beginPath()
  ctx.moveTo(x, y)
  ctx.lineTo(x, y + h)
  ctx.lineTo(x + w, y + h)
  ctx.lineTo(x + w, y)
  ctx.stroke()
  // piston + rod + handle
  ctx.fillStyle = CANVAS.panelLight
  rr(ctx, x - 5, gasTop - 12, w + 10, 12, 3)
  ctx.fill()
  ctx.strokeStyle = CANVAS.fg
  ctx.lineWidth = 1
  ctx.stroke()
  ctx.strokeStyle = CANVAS.white
  ctx.lineWidth = 3
  ctx.beginPath()
  ctx.moveTo(x + w / 2, gasTop - 12)
  ctx.lineTo(x + w / 2, gasTop - 44)
  ctx.stroke()
  ctx.strokeStyle = CANVAS.amber
  ctx.beginPath()
  ctx.moveTo(x + w / 2 - 15, gasTop - 44)
  ctx.lineTo(x + w / 2 + 15, gasTop - 44)
  ctx.stroke()
}

function lerpColor(a: [number, number, number], b: [number, number, number], f: number): string {
  const k = Math.max(0, Math.min(1, f))
  const c = a.map((v, i) => Math.round(v + (b[i] - v) * k))
  return `rgb(${c[0]},${c[1]},${c[2]})`
}

// ─────────────────────────────────────────────────────────────────────────────
// u5-state-eq · «پیستون آرام یا تند؟» — quasistatic vs fast process
// ─────────────────────────────────────────────────────────────────────────────
const SE_VMIN = 0.004
const SE_VMAX = 0.012

function U5StateEqSim() {
  const reduced = useReducedMotion()
  const st = useRef({
    v: 0.008,
    target: 0.008,
    pts: [] as { v: number; p: number }[],
    jit: 0.6,
    dragging: false,
  })
  const [speed, setSpeed] = useState(20)
  const [ui, setUi] = useState({ v: 0.008, status: 'تعادل' })
  const acc = useRef(0)
  const geom = useRef<PlotGeom | null>(null)
  const speedRef = useRef(speed)
  speedRef.current = speed
  const reducedRef = useRef(reduced)
  reducedRef.current = reduced

  const clampV = (v: number) => Math.min(SE_VMAX, Math.max(SE_VMIN, v))

  const { canvasRef } = useSimCanvas((ctx, w, h, t, dt) => {
    ctx.clearRect(0, 0, w, h)
    ctx.fillStyle = CANVAS.bg
    ctx.fillRect(0, 0, w, h)
    drawGrid(ctx, w, h, 40)

    const s = st.current
    const moving = Math.abs(s.target - s.v) > 1e-7
    const quasi = speedRef.current <= 35
    if (moving) {
      const range = SE_VMAX - SE_VMIN
      const rate = reducedRef.current ? range * 8 : range * (0.06 + (speedRef.current / 100) * 1.1)
      const dir = Math.sign(s.target - s.v)
      const raw = s.v + dir * rate * dt
      const end = dir > 0 ? Math.min(raw, s.target) : Math.max(raw, s.target)
      const steps = reducedRef.current ? 2 : Math.max(1, Math.round((Math.abs(end - s.v) / range) * 160))
      for (let i = 1; i <= steps; i++) {
        const vv = s.v + ((end - s.v) * i) / steps
        let p = 1000 / vv
        if (!quasi && !reducedRef.current) p *= 1 + (Math.random() - 0.5) * 0.6
        s.pts.push({ v: vv, p })
      }
      if (s.pts.length > 500) s.pts.splice(0, s.pts.length - 500)
      s.v = end
    }
    const wantJit = moving && !quasi && !reducedRef.current ? 4.5 : moving ? 1.6 : 0.6
    s.jit += (wantJit - s.jit) * Math.min(1, dt * 5)
    acc.current += dt
    if (acc.current > 0.12) {
      acc.current = 0
      setUi({ v: s.v, status: moving ? (quasi ? 'ایستاوار' : 'غیرایستاوار') : 'تعادل' })
    }

    // ── cylinder (right side in RTL reading, drawn left physically) ──
    const cx0 = 20
    const cw = 122
    const cy0 = 84
    const ch = h - 150
    const gasH = 30 + ((s.v - SE_VMIN) / (SE_VMAX - SE_VMIN)) * (ch - 52)
    faText(ctx, 'پیستون و گاز', cx0 + cw / 2, 26, { bold: true, size: 13 })
    faText(
      ctx,
      moving ? (quasi ? 'آرام: تعادل در هر لحظه' : 'تند: عدم یکنواختی!') : 'گاز در تعادل',
      cx0 + cw / 2,
      46,
      { size: 11, color: moving && !quasi ? CANVAS.red : CANVAS.teal },
    )
    drawCylinder(ctx, cx0, cy0, cw, ch, gasH, { jit: s.jit, t })
    if (moving) {
      const dir = Math.sign(s.target - s.v)
      arrow(ctx, cx0 + cw / 2, cy0 - 58, cx0 + cw / 2, cy0 - 58 - dir * 20, CANVAS.amber, 2.5)
    }
    faText(ctx, 'مسیر روی نمودار P–V', w - 24, 26, { bold: true, size: 13, align: 'right' })

    const g = drawPlot(ctx, 158, 52, w - 172, h - 78, 0.003, 0.013, 60e3, 270e3)
    geom.current = g
    // equilibrium isotherm (faint)
    ctx.strokeStyle = 'rgba(20,184,166,0.35)'
    ctx.setLineDash([4, 4])
    ctx.lineWidth = 1.5
    ctx.beginPath()
    for (let i = 0; i <= 80; i++) {
      const vv = 0.0035 + (i / 80) * 0.009
      const pp = 1000 / vv
      if (pp < 60e3 || pp > 270e3) continue
      const X = g.px(vv)
      const Y = g.py(pp)
      if (i === 0 || !Number.isFinite(X) || !Number.isFinite(Y)) ctx.moveTo(X, Y)
      else ctx.lineTo(X, Y)
    }
    ctx.stroke()
    ctx.setLineDash([])
    // trail points
    for (let i = 0; i < s.pts.length; i++) {
      const pt = s.pts[i]
      ctx.fillStyle = 'rgba(244,63,94,0.5)'
      ctx.beginPath()
      ctx.arc(g.px(pt.v), g.py(Math.min(270e3, Math.max(60e3, pt.p))), 1.6, 0, Math.PI * 2)
      ctx.fill()
    }
    // current state point
    const X = g.px(s.v)
    const Y = g.py(1000 / s.v)
    ctx.fillStyle = CANVAS.amber
    ctx.beginPath()
    ctx.arc(X, Y, 6, 0, Math.PI * 2)
    ctx.fill()
    ctx.strokeStyle = 'rgba(245,158,11,0.5)'
    ctx.lineWidth = 2
    ctx.beginPath()
    ctx.arc(X, Y, 10 + Math.sin(t * 4) * 2, 0, Math.PI * 2)
    ctx.stroke()

    if (moving && !quasi) {
      banner(ctx, w, 8, 'حالت یکنواخت ندارد — فرایند ایستاوار نیست', CANVAS.red)
    }
  }, 430)

  const setTargetFromPointer = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current
    const g = geom.current
    if (!canvas || !g) return
    const pos = canvasPos(e, canvas)
    const frac = (pos.x - (g.x0 + g.mL)) / Math.max(1, g.pw - g.mL - 10)
    st.current.target = clampV(SE_VMIN + frac * (SE_VMAX - SE_VMIN))
  }

  return (
    <SimFrame
      title="پیستون آرام یا تند؟"
      brief="سرعت پیستون را کم و زیاد کن و روی نمودار بکش تا حجم هدف را انتخاب کنی — مسیر ایستاوار منظم است، مسیر تند پراکنده!"
    >
      <div className="overflow-hidden rounded-lg border">
        <canvas
          ref={canvasRef}
          className="block w-full cursor-crosshair"
          aria-label="نمایش پیستون و نمودار P–V برای مقایسهٔ فرایند ایستاوار و فرایند سریع"
          onPointerDown={(e) => {
            st.current.dragging = true
            setTargetFromPointer(e)
          }}
          onPointerMove={(e) => {
            if (st.current.dragging) setTargetFromPointer(e)
          }}
          onPointerUp={() => {
            st.current.dragging = false
          }}
          onPointerLeave={() => {
            st.current.dragging = false
          }}
        />
      </div>
      <div className="flex flex-wrap items-center gap-3">
        <SimSlider
          label="سرعت پیستون"
          value={speed}
          min={1}
          max={100}
          step={1}
          onChange={setSpeed}
          format={(v) => `${v}`}
          className="min-w-[180px] flex-1"
        />
        <SimButton onClick={() => (st.current.target = clampV(st.current.v - 0.002))}>تراکم</SimButton>
        <SimButton variant="secondary" onClick={() => (st.current.target = clampV(st.current.v + 0.002))}>
          انبساط
        </SimButton>
        <Readout label="حجم" value={fmt(ui.v * 1000)} unit="L" />
        <Readout label="فشار (نمایشی)" value={fmt(1000 / Math.max(1e-6, ui.v))} unit="Pa" />
        <Readout
          label="وضعیت"
          value={ui.status}
          tone={ui.status === 'غیرایستاوار' ? 'text-rose-400' : 'text-emerald-400'}
        />
      </div>
      <div className="flex flex-wrap items-center gap-4">
        <Legend color={CANVAS.amber} label="نقطهٔ حالت فعلی" />
        <Legend color={CANVAS.teal} label="هذلولی هم‌دما (تعادل)" />
        <Legend color={CANVAS.rose} label="نقاط پراکنده: غیرایستاوار" />
        <span className="text-xs text-muted-foreground">سرعت ≤ ۳۵ → ایستاوار</span>
      </div>
    </SimFrame>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// u5-exchange · «کار گاز و گرما» — isobaric expansion with flame/ice
// ─────────────────────────────────────────────────────────────────────────────
const EX_VMIN = 0.002
const EX_VMAX = 0.006
const EX_V0 = 0.003

function U5ExchangeSim() {
  const reduced = useReducedMotion()
  const winBeep = useWinBeep()
  const st = useRef({ v: EX_V0, mode: 0, W: 0, Q: 0, dV: 0 })
  const [pBar, setPBar] = useState(1)
  const [challenge, setChallenge] = useState(false)
  const [won, setWon] = useState(false)
  const [ui, setUi] = useState({ v: EX_V0, W: 0, Q: 0, dV: 0 })
  const acc = useRef(0)
  const pRef = useRef(pBar)
  pRef.current = pBar
  const challengeRef = useRef(challenge)
  challengeRef.current = challenge
  const wonRef = useRef(won)
  wonRef.current = won
  const reducedRef = useRef(reduced)
  reducedRef.current = reduced

  /** Apply a signed volume step; updates W/Q/dV consistently. */
  const step = (dvv: number) => {
    const s = st.current
    const P = pRef.current * 1e5
    const nv = Math.min(EX_VMAX, Math.max(EX_VMIN, s.v + dvv))
    const real = nv - s.v
    s.W += P * real
    s.Q += 2.5 * P * real
    s.dV += real
    s.v = nv
    if (nv <= EX_VMIN + 1e-9 || nv >= EX_VMAX - 1e-9) s.mode = 0
    return real
  }

  const setMode = (m: number) => {
    if (reducedRef.current) {
      step(0.0004 * m)
      const s = st.current
      setUi({ v: s.v, W: s.W, Q: s.Q, dV: s.dV })
      return
    }
    st.current.mode = m
  }

  const reset = () => {
    st.current = { v: EX_V0, mode: 0, W: 0, Q: 0, dV: 0 }
    wonRef.current = false
    setWon(false)
    setUi({ v: EX_V0, W: 0, Q: 0, dV: 0 })
  }

  const { canvasRef } = useSimCanvas((ctx, w, h, t, dt) => {
    ctx.clearRect(0, 0, w, h)
    ctx.fillStyle = CANVAS.bg
    ctx.fillRect(0, 0, w, h)
    drawGrid(ctx, w, h, 40)

    const s = st.current
    if (s.mode !== 0) {
      step(s.mode * 0.0009 * dt)
    }
    acc.current += dt
    if (acc.current > 0.1) {
      acc.current = 0
      setUi({ v: s.v, W: s.W, Q: s.Q, dV: s.dV })
      if (challengeRef.current && !wonRef.current && s.mode === 0 && Math.abs(s.W - 250) <= 5) {
        wonRef.current = true
        setWon(true)
        winBeep()
      }
    }

    // ── cylinder ──
    const cx0 = 20
    const cw = 122
    const cy0 = 70
    const ch = h - 140
    const gasH = 40 + ((s.v - EX_VMIN) / (EX_VMAX - EX_VMIN)) * (ch - 60)
    faText(ctx, 'گاز هم‌فشار با وزنه', cx0 + cw / 2, 24, { bold: true, size: 13 })
    drawCylinder(ctx, cx0, cy0, cw, ch, gasH, { jit: 0.8, t })
    // weights ∝ P
    const nw = Math.max(1, Math.round(pRef.current))
    for (let i = 0; i < nw; i++) {
      ctx.fillStyle = CANVAS.amber
      rr(ctx, cx0 + cw / 2 - 24, cy0 - 66 - i * 12, 48, 10, 2)
      ctx.fill()
    }
    faText(ctx, `${fmt(pRef.current)} ×10⁵ Pa`, cx0 + cw / 2, cy0 - 84, { size: 11, color: CANVAS.amber })
    // flame / ice under cylinder
    const fy = cy0 + ch + 16
    if (s.mode > 0) {
      for (let i = -1; i <= 1; i++) {
        const fh = 16 + Math.abs(Math.sin(t * 7 + i)) * 10
        ctx.fillStyle = i === 0 ? CANVAS.orange : 'rgba(249,115,22,0.65)'
        ctx.beginPath()
        ctx.moveTo(cx0 + cw / 2 + i * 20 - 8, fy + 14)
        ctx.quadraticCurveTo(cx0 + cw / 2 + i * 20, fy + 14 - fh * 1.6, cx0 + cw / 2 + i * 20 + 8, fy + 14)
        ctx.closePath()
        ctx.fill()
      }
      faText(ctx, 'شعله: گرما ورودی', cx0 + cw / 2, fy + 32, { size: 11, color: CANVAS.orange })
    } else if (s.mode < 0) {
      ctx.fillStyle = 'rgba(56,189,248,0.85)'
      for (let i = -1; i <= 1; i++) {
        rr(ctx, cx0 + cw / 2 + i * 22 - 8, fy, 16, 14, 3)
        ctx.fill()
      }
      faText(ctx, 'یخ: گرما خروجی', cx0 + cw / 2, fy + 32, { size: 11, color: '#38bdf8' })
    } else {
      faText(ctx, 'بدون تبادل گرمایی', cx0 + cw / 2, fy + 10, { size: 11, color: CANVAS.muted })
    }

    // ── P–V plot ──
    const g = drawPlot(ctx, 158, 52, w - 172, h - 78, 0.001, 0.007, 0, 3.2e5)
    const y0 = g.py(pRef.current * 1e5)
    const xV0 = g.px(EX_V0)
    const xV = g.px(s.v)
    const base = g.py(0)
    // shaded work area (dynamic)
    ctx.fillStyle = 'rgba(245,158,11,0.28)'
    ctx.fillRect(Math.min(xV0, xV), y0, Math.abs(xV - xV0), Math.max(0, base - y0))
    // path line
    ctx.strokeStyle = CANVAS.amber
    ctx.lineWidth = 3
    ctx.beginPath()
    ctx.moveTo(xV0, y0)
    ctx.lineTo(xV, y0)
    ctx.stroke()
    // start marker
    ctx.strokeStyle = 'rgba(250,250,249,0.4)'
    ctx.setLineDash([4, 4])
    ctx.lineWidth = 1
    ctx.beginPath()
    ctx.moveTo(xV0, g.py(0))
    ctx.lineTo(xV0, g.py(3.2e5))
    ctx.stroke()
    ctx.setLineDash([])
    ctx.fillStyle = CANVAS.fg
    ctx.beginPath()
    ctx.arc(xV0, y0, 3, 0, Math.PI * 2)
    ctx.fill()
    // current point
    ctx.fillStyle = CANVAS.amber
    ctx.beginPath()
    ctx.arc(xV, y0, 6, 0, Math.PI * 2)
    ctx.fill()
    // area label = W
    if (Math.abs(xV - xV0) > 30) {
      faText(ctx, `W = ${fmt(s.W)} J`, (xV0 + xV) / 2, (y0 + base) / 2, { bold: true, size: 12, color: '#fde68a' })
    }
    faText(ctx, 'مسیر هم‌فشار؛ سایه = کار', 158 + (w - 172) / 2 + 20, 40, { size: 11, color: CANVAS.muted })

    if (won) banner(ctx, w, 8, 'آفرین! کاری برابر 250 J از گاز گرفتی ✓', CANVAS.emerald)
  }, 430)

  return (
    <SimFrame
      title="کار گاز و گرما"
      brief="با شعله گاز را (در فشار ثابت وزنه) منبسط کن یا با یخ متراکم؛ سایهٔ زیر مسیر همان کار گاز است."
    >
      <div className="overflow-hidden rounded-lg border">
        <canvas
          ref={canvasRef}
          className="block w-full"
          aria-label="پیستون هم‌فشار با شعله و یخ و نمودار P–V با مساحت کار"
        />
      </div>
      <div className="flex flex-wrap items-center gap-3">
        <SimSlider
          label="فشار (وزنه)"
          value={pBar}
          min={0.5}
          max={3}
          step={0.1}
          unit="×10⁵ Pa"
          onChange={setPBar}
          className="min-w-[180px] flex-1"
        />
        <SimButton onClick={() => setMode(1)}>گرما بده</SimButton>
        <SimButton variant="secondary" onClick={() => setMode(-1)}>
          گرما بگیر
        </SimButton>
        <SimButton variant="outline" onClick={() => (st.current.mode = 0)}>
          توقف
        </SimButton>
        <SimButton variant="ghost" onClick={reset}>
          بازنشانی
        </SimButton>
      </div>
      <div className="flex flex-wrap items-center gap-3">
        <SimToggle
          label="چالش: کاری برابر 250 J از گاز بگیر (±5)"
          checked={challenge}
          onChange={(v) => {
            setChallenge(v)
            if (!v) {
              wonRef.current = false
              setWon(false)
            }
          }}
        />
      </div>
      <div className="flex flex-wrap items-center gap-3">
        <Readout
          label="کار گاز W"
          value={fmt(ui.W)}
          unit="J"
          tone={ui.W >= 0 ? 'text-amber-400' : 'text-rose-400'}
        />
        <Readout label="تغییر حجم ΔV" value={fmt(ui.dV * 1000)} unit="L" />
        <Readout label="گرما Q" value={fmt(ui.Q)} unit="J" tone="text-emerald-400" />
        <Readout label="حجم" value={fmt(ui.v * 1000)} unit="L" />
      </div>
      {won ? (
        <p role="status" className="text-sm font-medium text-emerald-500">
          چالش کامل شد: W = {fmt(st.current.W)} J (حدود ۲۵۰ ژول) — مساحتِ همان مستطیل کهربایی روی نمودار!
        </p>
      ) : (
        <p className="text-xs text-muted-foreground">
          نکته: با فشار بیشتر، برای همان ۲۵۰ ژول، انبساط کوچک‌تری لازم است — ΔV = W/P.
        </p>
      )}
    </SimFrame>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// u5-first-law · «ترازوی قانون اول» — live ΔU = Q − W balance
// ─────────────────────────────────────────────────────────────────────────────
function U5FirstLawSim() {
  const reduced = useReducedMotion()
  const winBeep = useWinBeep()
  const [q, setQ] = useState(200)
  const [wv, setWv] = useState(100)
  const [challenge, setChallenge] = useState(false)
  const [won, setWon] = useState(false)
  const winRef = useRef(false)
  const dU = q - wv
  const pistonRef = useRef(0.5)

  useEffect(() => {
    if (challenge && !winRef.current && Math.abs(dU - 200) <= 2) {
      winRef.current = true
      setWon(true)
      winBeep()
    }
  }, [challenge, dU, winBeep])

  const interp = (() => {
    const qs = Math.sign(q)
    const ws = Math.sign(wv)
    if (qs === 0 && ws === 0) return 'هیچ تبادل انرژی‌ای در کار نیست؛ ΔU هم صفر می‌ماند.'
    if (qs === 0 && ws > 0) return 'بی‌دررو انبساط: کارِ گاز از انرژی درونی پرداخت می‌شود؛ گاز سرد می‌شود (ΔU = −W).'
    if (qs === 0 && ws < 0) return 'بی‌دررو تراکم: کارِ روی گاز انرژی درونی را بالا می‌برد؛ گاز گرم می‌شود (ΔU = −W).'
    if (qs > 0 && ws > 0) {
      return dU > 0
        ? 'گرمای ورودی بیشتر از کارِ گاز است؛ باقی‌مانده انرژی درونی را بالا می‌برد.'
        : 'گاز گرما می‌گیرد ولی کارش بیشتر است؛ کسری از انرژی درونی جبران می‌شود.'
    }
    if (qs > 0 && ws < 0) return 'هم گرما می‌گیرد و هم کار روی آن می‌شود؛ انرژی درونی قطعاً بالا می‌رود.'
    if (qs > 0 && ws === 0) return 'هم‌حجم! تمام گرمای ورودی صرف بالا بردن انرژی درونی می‌شود.'
    if (qs < 0 && ws > 0) return 'گاز هم گرما از دست می‌دهد و هم کار می‌کند؛ انرژی درونی قطعاً پایین می‌رود.'
    if (qs < 0 && ws < 0) {
      return dU > 0
        ? 'کارِ روی گاز بیشتر از گرمای ازدست‌رفته است؛ انرژی درونی بالا می‌رود.'
        : 'هم گرما از دست می‌دهد و هم کار روی آن می‌شود؛ انرژی درونی پایین می‌آید.'
    }
    return 'هم‌حجم با خروج گرما: انرژی درونی به همان اندازه کم می‌شود.'
  })()

  const { canvasRef } = useSimCanvas((ctx, w, h, t) => {
    ctx.clearRect(0, 0, w, h)
    ctx.fillStyle = CANVAS.bg
    ctx.fillRect(0, 0, w, h)
    drawGrid(ctx, w, h, 40)

    // ── mini piston (left) ──
    const cx0 = 20
    const cw = 110
    const cy0 = 70
    const ch = h - 150
    const target = Math.min(1, Math.max(0, 0.5 + wv / 300 * 0.42))
    pistonRef.current += (target - pistonRef.current) * (reduced ? 1 : Math.min(1, 0.08))
    const gasH = 44 + pistonRef.current * (ch - 64)
    faText(ctx, 'پیستون کوچک', cx0 + cw / 2, 26, { bold: true, size: 13 })
    drawCylinder(ctx, cx0, cy0, cw, ch, gasH, { jit: 0.8, t })
    const fy = cy0 + ch + 18
    if (q > 0) {
      const fh = 10 + (Math.abs(q) / 500) * 22 + Math.sin(t * 8) * 3
      ctx.fillStyle = CANVAS.orange
      ctx.beginPath()
      ctx.moveTo(cx0 + cw / 2 - 10, fy + 16)
      ctx.quadraticCurveTo(cx0 + cw / 2, fy + 16 - fh * 1.7, cx0 + cw / 2 + 10, fy + 16)
      ctx.closePath()
      ctx.fill()
      faText(ctx, `شعله: Q = +${fmt(q)} J`, cx0 + cw / 2, fy + 32, { size: 11, color: CANVAS.orange })
    } else if (q < 0) {
      ctx.fillStyle = 'rgba(56,189,248,0.85)'
      rr(ctx, cx0 + cw / 2 - 10, fy, 20, 16, 3)
      ctx.fill()
      faText(ctx, `یخ: Q = ${fmt(q)} J`, cx0 + cw / 2, fy + 32, { size: 11, color: '#38bdf8' })
    } else {
      faText(ctx, 'Q = 0 (بی‌دررو)', cx0 + cw / 2, fy + 12, { size: 11, color: CANVAS.muted })
    }

    // ── energy bars (right) ──
    const bx0 = 158
    const bw = w - 172
    const xc = bx0 + bw / 2
    const scale = (bw / 2 - 20) / 500
    const rows: { label: string; v: number; color: string; y: number }[] = [
      { label: 'Q گرما', v: q, color: q >= 0 ? CANVAS.emerald : CANVAS.red, y: 74 },
      { label: 'W کار گاز', v: wv, color: CANVAS.amber, y: 158 },
      { label: 'ΔU انرژی درونی', v: dU, color: CANVAS.violet, y: 242 },
    ]
    faText(ctx, 'ترازوی انرژی (به سمت راست = مثبت)', bx0 + bw / 2, 40, { size: 12, color: CANVAS.muted })
    for (const r of rows) {
      ctx.strokeStyle = 'rgba(168,162,158,0.5)'
      ctx.lineWidth = 1
      ctx.beginPath()
      ctx.moveTo(xc, r.y - 8)
      ctx.lineTo(xc, r.y + 40)
      ctx.stroke()
      const bwid = Math.abs(r.v) * scale
      ctx.fillStyle = r.color
      if (r.v >= 0) rr(ctx, xc, r.y, Math.max(2, bwid), 32, 6)
      else rr(ctx, xc - Math.max(2, bwid), r.y, Math.max(2, bwid), 32, 6)
      ctx.fill()
      faText(ctx, r.label, bx0 + bw - 8, r.y + 16, { size: 11, color: CANVAS.muted, align: 'right' })
      faText(ctx, `${r.v > 0 ? '+' : ''}${fmt(r.v)} J`, bx0 + 10, r.y + 16, {
        size: 12,
        bold: true,
        color: r.color,
        align: 'left',
      })
    }
    faText(
      ctx,
      `ΔU = Q − W  →  ${fmt(q)} − (${fmt(wv)}) = ${dU > 0 ? '+' : ''}${fmt(dU)} J`,
      bx0 + bw / 2,
      h - 40,
      { bold: true, size: 14, color: CANVAS.fg },
    )
    if (won) banner(ctx, w, h - 84, 'آفرین! ΔU = 200 J شد ✓', CANVAS.emerald)
  }, 400)

  return (
    <SimFrame
      title="ترازوی قانون اول"
      brief="Q و W را با اسلایدر تنظیم کن؛ نوار بنفش همیشه برابر تفاضل آن‌هاست: ΔU = Q − W."
    >
      <div className="overflow-hidden rounded-lg border">
        <canvas ref={canvasRef} className="block w-full" aria-label="نوارهای انرژی Q و W و ΔU با پیستون کوچک" />
      </div>
      <div className="flex flex-wrap items-center gap-3">
        <SimSlider
          label="گرما Q"
          value={q}
          min={-500}
          max={500}
          step={10}
          unit="J"
          onChange={setQ}
          className="min-w-[200px] flex-1"
        />
        <SimSlider
          label="کار گاز W"
          value={wv}
          min={-300}
          max={300}
          step={10}
          unit="J"
          onChange={setWv}
          className="min-w-[200px] flex-1"
        />
        <Readout label="ΔU" value={`${dU > 0 ? '+' : ''}${fmt(dU)}`} unit="J" tone="text-violet-400" />
      </div>
      <div className="flex flex-wrap items-center gap-3">
        <SimToggle
          label="چالش: به ΔU = 200 J برسان"
          checked={challenge}
          onChange={(v) => {
            setChallenge(v)
            if (!v) {
              winRef.current = false
              setWon(false)
            }
          }}
        />
      </div>
      {won ? (
        <p role="status" className="text-sm font-medium text-emerald-500">
          چالش کامل شد: Q − W = 200 J — بی‌شمار ترکیب دیگر هم جواب می‌دهد؛ چون ΔU فقط به تفاضل بستگی دارد!
        </p>
      ) : (
        <p className="text-sm text-muted-foreground" role="status">
          تعبیر: {interp}
        </p>
      )}
    </SimFrame>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// u5-processes · «نقاش فرایندها روی P–V» — trace the four named processes
// ─────────────────────────────────────────────────────────────────────────────
type Proc = 'isoT' | 'isoP' | 'isoV' | 'adia'
const PR_NR = 1000 / 300 // nR ≈ 3.333 J/K  (P₀V₀/T₀ with P₀=1e5, V₀=0.01, T₀=300)

function U5ProcessesSim() {
  const reduced = useReducedMotion()
  const st = useRef({
    P: 1e5,
    V: 0.01,
    trail: [] as { v: number; p: number }[],
    last: null as null | { W: number; Q: number; dU: number },
  })
  const anim = useRef<null | {
    proc: Proc
    e: number
    dur: number
    from: { P: number; V: number }
    to: { P: number; V: number }
    T0: number
    T1: number
    pts: { v: number; p: number }[]
    res: { W: number; Q: number; dU: number }
  }>(null)
  const [proc, setProc] = useState<Proc>('isoT')
  const [expand, setExpand] = useState(true)
  const [running, setRunning] = useState(false)
  const [ui, setUi] = useState({ T: 300, W: 0, Q: 0, dU: 0 })
  const procRef = useRef(proc)
  procRef.current = proc
  const expRef = useRef(expand)
  expRef.current = expand
  const reducedRef = useRef(reduced)
  reducedRef.current = reduced

  const pressureAt = (from: { P: number; V: number }, proc: Proc, v: number): number => {
    if (proc === 'isoT') return (from.P * from.V) / v
    if (proc === 'isoP') return from.P
    if (proc === 'adia') return from.P * Math.pow(from.V / v, 5 / 3)
    return from.P
  }

  const samplePath = (
    from: { P: number; V: number },
    to: { P: number; V: number },
    proc: Proc,
    n: number,
  ): { v: number; p: number }[] => {
    const out: { v: number; p: number }[] = []
    for (let i = 1; i <= n; i++) {
      const f = i / n
      const v = from.V + (to.V - from.V) * f
      out.push({ v, p: pressureAt(from, proc, v) })
    }
    return out
  }

  const integrate = (
    from: { P: number; V: number },
    to: { P: number; V: number },
    proc: Proc,
    T0: number,
    T1: number,
  ): { W: number; Q: number; dU: number } => {
    const N = 60
    let W = 0
    for (let i = 1; i <= N; i++) {
      const vA = from.V + ((to.V - from.V) * (i - 1)) / N
      const vB = from.V + ((to.V - from.V) * i) / N
      W += pressureAt(from, proc, (vA + vB) / 2) * (vB - vA)
    }
    const dU = 1.5 * PR_NR * (T1 - T0)
    let Q = 0
    if (proc === 'isoT') Q = W
    else if (proc === 'isoP') Q = dU + W
    else if (proc === 'isoV') Q = dU
    return { W, Q, dU }
  }

  const planStep = () => {
    const from = { P: st.current.P, V: st.current.V }
    const T0 = (from.P * from.V) / PR_NR
    if (procRef.current === 'isoV') {
      const T1 = Math.min(900, Math.max(150, T0 + (expRef.current ? 60 : -60)))
      return { from, to: { P: (PR_NR * T1) / from.V, V: from.V }, T0, T1 }
    }
    const V1 = Math.min(0.016, Math.max(0.004, from.V + (expRef.current ? 0.002 : -0.002)))
    const to = { P: pressureAt(from, procRef.current, V1), V: V1 }
    const T1 = (to.P * to.V) / PR_NR
    if (T1 > 900 || T1 < 150) return null
    return { from, to, T0, T1 }
  }

  const finishInstant = () => {
    const plan = planStep()
    if (!plan) return
    const res = integrate(plan.from, plan.to, procRef.current, plan.T0, plan.T1)
    st.current.P = plan.to.P
    st.current.V = plan.to.V
    st.current.trail.push(...samplePath(plan.from, plan.to, procRef.current, 48))
    if (st.current.trail.length > 500) st.current.trail.splice(0, st.current.trail.length - 500)
    st.current.last = res
    setUi({ T: plan.T1, W: res.W, Q: res.Q, dU: res.dU })
  }

  const run = () => {
    if (anim.current) return
    if (reducedRef.current) {
      finishInstant()
      return
    }
    const plan = planStep()
    if (!plan) return
    const res = integrate(plan.from, plan.to, procRef.current, plan.T0, plan.T1)
    anim.current = {
      proc: procRef.current,
      e: 0,
      dur: 1.3,
      from: plan.from,
      to: plan.to,
      T0: plan.T0,
      T1: plan.T1,
      pts: samplePath(plan.from, plan.to, procRef.current, 48),
      res,
    }
    setRunning(true)
  }

  const { canvasRef } = useSimCanvas((ctx, w, h, t, dt) => {
    ctx.clearRect(0, 0, w, h)
    ctx.fillStyle = CANVAS.bg
    ctx.fillRect(0, 0, w, h)
    drawGrid(ctx, w, h, 40)
    faText(ctx, 'نقطهٔ حالت را روی مسیرِ فرایند انتخابی بگردان', w / 2, 20, { bold: true, size: 13 })

    const a = anim.current
    if (a) {
      a.e += dt
      const f = Math.min(1, a.e / a.dur)
      const ease = f < 0.5 ? 2 * f * f : 1 - Math.pow(-2 * f + 2, 2) / 2
      const g0 = drawPlot(ctx, 12, 46, w - 24, h - 72, 0.003, 0.017, 0.2e5, 3.0e5)
      const nShow = Math.max(2, Math.ceil(a.pts.length * ease))
      const shown = a.pts.slice(0, nShow)
      // work shading under partial path
      ctx.fillStyle = 'rgba(245,158,11,0.22)'
      ctx.beginPath()
      ctx.moveTo(g0.px(a.from.V), g0.py(0.2e5))
      for (const pt of shown) ctx.lineTo(g0.px(pt.v), g0.py(Math.min(3.0e5, Math.max(0.2e5, pt.p))))
      ctx.lineTo(g0.px(shown[shown.length - 1].v), g0.py(0.2e5))
      ctx.closePath()
      ctx.fill()
      // partial path
      ctx.strokeStyle = CANVAS.amber
      ctx.lineWidth = 2.5
      ctx.beginPath()
      shown.forEach((pt, i) => (i === 0 ? ctx.moveTo(g0.px(pt.v), g0.py(Math.min(3.0e5, Math.max(0.2e5, pt.p)))) : ctx.lineTo(g0.px(pt.v), g0.py(Math.min(3.0e5, Math.max(0.2e5, pt.p))))))
      ctx.stroke()
      // moving dot
      const cur = shown[shown.length - 1]
      ctx.fillStyle = CANVAS.amber
      ctx.beginPath()
      ctx.arc(g0.px(cur.v), g0.py(Math.min(3.0e5, Math.max(0.2e5, cur.p))), 6, 0, Math.PI * 2)
      ctx.fill()
      if (f >= 1) {
        st.current.P = a.to.P
        st.current.V = a.to.V
        st.current.trail.push(...a.pts)
        if (st.current.trail.length > 500) st.current.trail.splice(0, st.current.trail.length - 500)
        st.current.last = a.res
        setUi({ T: a.T1, W: a.res.W, Q: a.res.Q, dU: a.res.dU })
        anim.current = null
        setRunning(false)
      }
    } else {
      const g0 = drawPlot(ctx, 12, 46, w - 24, h - 72, 0.003, 0.017, 0.2e5, 3.0e5)
      // isotherm through current point (dashed reference)
      ctx.strokeStyle = 'rgba(20,184,166,0.4)'
      ctx.setLineDash([4, 4])
      ctx.lineWidth = 1.5
      ctx.beginPath()
      let started = false
      for (let i = 0; i <= 80; i++) {
        const vv = 0.0035 + (i / 80) * 0.013
        const pp = (st.current.P * st.current.V) / vv
        if (pp < 0.2e5 || pp > 3.0e5) continue
        started ? ctx.lineTo(g0.px(vv), g0.py(pp)) : ctx.moveTo(g0.px(vv), g0.py(pp))
        started = true
      }
      ctx.stroke()
      ctx.setLineDash([])
      // old trails (faded)
      for (const pt of st.current.trail) {
        ctx.fillStyle = 'rgba(20,184,166,0.35)'
        ctx.beginPath()
        ctx.arc(g0.px(pt.v), g0.py(Math.min(3.0e5, Math.max(0.2e5, pt.p))), 1.6, 0, Math.PI * 2)
        ctx.fill()
      }
      // current point
      const X = g0.px(st.current.V)
      const Y = g0.py(st.current.P)
      ctx.fillStyle = CANVAS.amber
      ctx.beginPath()
      ctx.arc(X, Y, 6, 0, Math.PI * 2)
      ctx.fill()
      ctx.strokeStyle = 'rgba(245,158,11,0.5)'
      ctx.lineWidth = 2
      ctx.beginPath()
      ctx.arc(X, Y, 10 + Math.sin(t * 4) * 2, 0, Math.PI * 2)
      ctx.stroke()
    }

    // info panel (always)
    const T = (st.current.P * st.current.V) / PR_NR
    const last = st.current.last
    panel(ctx, 22, 56, 176, 96)
    faText(ctx, `T = ${fmt(T)} K`, 34, 74, { size: 12, bold: true, align: 'left' })
    faText(ctx, last ? `W = ${fmt(last.W)} J` : 'W = —', 34, 94, { size: 11, color: CANVAS.amber, align: 'left' })
    faText(ctx, last ? `Q = ${fmt(last.Q)} J` : 'Q = —', 34, 112, { size: 11, color: CANVAS.emerald, align: 'left' })
    faText(ctx, last ? `ΔU = ${fmt(last.dU)} J` : 'ΔU = —', 34, 130, { size: 11, color: CANVAS.violet, align: 'left' })
  }, 430)

  return (
    <SimFrame
      title="نقاش فرایندها روی P–V"
      brief="فرایند و جهت را انتخاب و «اجرا» را بزن؛ هم‌دما روی هذلولی می‌ماند، بی‌دررو تندتر است، هم‌فشار افقی و هم‌حجم عمودی. در هم‌حجم، کلیدِ جهت، جهتِ گرما را تعیین می‌کند."
    >
      <div className="overflow-hidden rounded-lg border">
        <canvas ref={canvasRef} className="block w-full" aria-label="نمودار P–V با نقطهٔ حالت متحرک روی چهار فرایند" />
      </div>
      <div className="flex flex-wrap items-end gap-3">
        <SimSelect<Proc>
          label="فرایند"
          value={proc}
          onChange={setProc}
          options={[
            { value: 'isoT', label: 'هم‌دما (T ثابت)' },
            { value: 'isoP', label: 'هم‌فشار (P ثابت)' },
            { value: 'isoV', label: 'هم‌حجم (V ثابت)' },
            { value: 'adia', label: 'بی‌دررو (Q = 0)' },
          ]}
        />
        <SimToggle label="انبساط (خاموش = تراکم)" checked={expand} onChange={setExpand} />
        <SimButton onClick={run} disabled={running}>
          اجرا
        </SimButton>
        <SimButton
          variant="ghost"
          onClick={() => {
            st.current.trail = []
            st.current.last = null
            setUi({ T: (st.current.P * st.current.V) / PR_NR, W: 0, Q: 0, dU: 0 })
          }}
        >
          پاک‌کردن مسیرها
        </SimButton>
      </div>
      <div className="flex flex-wrap items-center gap-3">
        <Readout label="دمای فعلی" value={fmt(ui.T)} unit="K" />
        <Readout label="کار گام W" value={fmt(ui.W)} unit="J" tone="text-amber-400" />
        <Readout label="گرمای گام Q" value={fmt(ui.Q)} unit="J" tone="text-emerald-400" />
        <Readout label="ΔU گام" value={fmt(ui.dU)} unit="J" tone="text-violet-400" />
        <Legend color={CANVAS.teal} label="مسیرهای قبلی (محو)" />
      </div>
      <p className="text-xs text-muted-foreground">
        مقادیر نمونه‌ای با nR = 3.33 J/K و شروع از P₀ = 1×10⁵ Pa، V₀ = 0.01 m³ (T₀ ≈ 300 K) — بی‌دررو با γ = 5/3.
      </p>
    </SimFrame>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// u5-cycle · «دویدن دور چرخه» — rectangular loop, area = net work
// ─────────────────────────────────────────────────────────────────────────────
const CY = { p1: 1e5, p2: 2.2e5, v1: 0.004, v2: 0.01 }
const CY_AREA = (CY.p2 - CY.p1) * (CY.v2 - CY.v1) // = 720 J

function U5CycleSim() {
  const reduced = useReducedMotion()
  const bn = useCanvasBanner()
  const st = useRef({ pos: 0, running: false, laps: 0, sumW: 0, shade: 0 })
  const [dir, setDir] = useState<'cw' | 'ccw'>('cw')
  const [speed, setSpeed] = useState(1)
  const [ui, setUi] = useState({ laps: 0, sumW: 0 })
  const dirRef = useRef(dir)
  dirRef.current = dir
  const speedRef = useRef(speed)
  speedRef.current = speed
  const reducedRef = useRef(reduced)
  reducedRef.current = reduced

  const cornerPts = [
    { v: CY.v1, p: CY.p1 },
    { v: CY.v2, p: CY.p1 },
    { v: CY.v2, p: CY.p2 },
    { v: CY.v1, p: CY.p2 },
  ]
  /** position along the (clockwise-parameterised) loop, f in [0,1) */
  const cornerAt = (fRaw: number) => {
    let f = fRaw - Math.floor(fRaw)
    if (dirRef.current === 'ccw') f = 1 - f
    const seg = Math.min(3, Math.floor(f * 4))
    const k = f * 4 - seg
    const a = cornerPts[seg]
    const b = cornerPts[(seg + 1) % 4]
    return { v: a.v + (b.v - a.v) * k, p: a.p + (b.p - a.p) * k }
  }

  const lapComplete = (t: number) => {
    const s = st.current
    s.laps += 1
    s.sumW += dirRef.current === 'cw' ? CY_AREA : -CY_AREA
    s.shade = Math.min(0.5, s.shade + 0.14)
    s.running = false
    bn.show(
      `هر دور: W = مساحت = ${dirRef.current === 'cw' ? '+' : '−'}${fmt(CY_AREA)} J ${dirRef.current === 'cw' ? '(کار توسط گاز)' : '(کار روی گاز)'}`,
      reducedRef.current ? 3600 : 2.6,
    )
    setUi({ laps: s.laps, sumW: s.sumW })
  }

  const runLap = () => {
    if (reducedRef.current) {
      lapComplete(0)
      return
    }
    if (!st.current.running) {
      st.current.pos = 0
      st.current.running = true
    }
  }

  const reset = () => {
    st.current = { pos: 0, running: false, laps: 0, sumW: 0, shade: 0 }
    bn.clear()
    setUi({ laps: 0, sumW: 0 })
  }

  const { canvasRef } = useSimCanvas((ctx, w, h, t, dt) => {
    ctx.clearRect(0, 0, w, h)
    ctx.fillStyle = CANVAS.bg
    ctx.fillRect(0, 0, w, h)
    drawGrid(ctx, w, h, 40)
    faText(ctx, 'چرخهٔ مستطیلی — مساحت محصور همان کار خالص هر دور است', w / 2, 20, { bold: true, size: 13 })

    const s = st.current
    if (s.running) {
      s.pos += (dt * speedRef.current) / 7
      if (s.pos >= 1) {
        s.pos = 0
        lapComplete(t)
      }
    }
    const g = drawPlot(ctx, 14, 46, w - 28, h - 72, 0.002, 0.012, 0.2e5, 2.6e5)

    // shaded enclosed area
    ctx.fillStyle = `rgba(245,158,11,${s.shade})`
    ctx.beginPath()
    cornerPts.forEach((c, i) => (i === 0 ? ctx.moveTo(g.px(c.v), g.py(c.p)) : ctx.lineTo(g.px(c.v), g.py(c.p))))
    ctx.closePath()
    ctx.fill()
    // loop edges
    ctx.strokeStyle = 'rgba(250,250,249,0.55)'
    ctx.setLineDash([6, 4])
    ctx.lineWidth = 1.5
    ctx.beginPath()
    cornerPts.forEach((c, i) => (i === 0 ? ctx.moveTo(g.px(c.v), g.py(c.p)) : ctx.lineTo(g.px(c.v), g.py(c.p))))
    ctx.closePath()
    ctx.stroke()
    ctx.setLineDash([])
    // direction arrows on each edge
    for (let i = 0; i < 4; i++) {
      const f1 = 0.09 + i * 0.25
      const p1 = cornerAt(f1)
      const p2 = cornerAt(f1 + 0.04)
      arrow(ctx, g.px(p1.v), g.py(p1.p), g.px(p2.v), g.py(p2.p), 'rgba(245,158,11,0.85)', 2.2)
    }
    // labels of corners
    faText(ctx, `${fmt(CY.p1 / 1e5)}×10⁵`, g.px(CY.v1) + 26, g.py(CY.p1) - 12, { size: 10, color: CANVAS.muted })
    faText(ctx, `${fmt(CY.p2 / 1e5)}×10⁵`, g.px(CY.v1) + 26, g.py(CY.p2) + 14, { size: 10, color: CANVAS.muted })
    // moving dot
    const cur = cornerAt(s.pos)
    ctx.fillStyle = CANVAS.amber
    ctx.beginPath()
    ctx.arc(g.px(cur.v), g.py(cur.p), 7, 0, Math.PI * 2)
    ctx.fill()
    ctx.strokeStyle = 'rgba(245,158,11,0.5)'
    ctx.lineWidth = 2
    ctx.beginPath()
    ctx.arc(g.px(cur.v), g.py(cur.p), 12 + Math.sin(t * 5) * 2, 0, Math.PI * 2)
    ctx.stroke()

    const bt = bn.tick(t)
    if (bt) banner(ctx, w, 8, bt, CANVAS.emerald)
  }, 430)

  return (
    <SimFrame
      title="دویدن دور چرخه"
      brief="چرخه را اجرا کن؛ با هر دور، سایهٔ محصور پررنگ‌تر و شمارندهٔ ΣW به‌اندازهٔ مساحت جلو می‌رود."
    >
      <div className="overflow-hidden rounded-lg border">
        <canvas ref={canvasRef} className="block w-full" aria-label="چرخهٔ مستطیلی روی نمودار P–V با نقطهٔ متحرک و مساحت سایه‌خورده" />
      </div>
      <div className="flex flex-wrap items-end gap-3">
        <SimButton onClick={runLap} disabled={st.current.running}>
          چرخه را اجرا
        </SimButton>
        <SimSelect<'cw' | 'ccw'>
          label="جهت چرخه"
          value={dir}
          onChange={setDir}
          options={[
            { value: 'cw', label: 'ساعتگرد (ماشین گرمایی)' },
            { value: 'ccw', label: 'پادساعتگرد (یخچال)' },
          ]}
        />
        <SimSlider
          label="سرعت"
          value={speed}
          min={0.5}
          max={3}
          step={0.25}
          onChange={setSpeed}
          className="min-w-[150px] flex-1"
        />
        <SimButton variant="ghost" onClick={reset}>
          بازنشانی
        </SimButton>
      </div>
      <div className="flex flex-wrap items-center gap-3">
        <Readout label="دورها" value={fmt(ui.laps)} />
        <Readout
          label="ΣW خالص"
          value={fmt(ui.sumW)}
          unit="J"
          tone={ui.sumW > 0 ? 'text-emerald-400' : ui.sumW < 0 ? 'text-rose-400' : undefined}
        />
        <Readout label="ΣQ خالص" value={fmt(ui.sumW)} unit="J" tone="text-teal-400" />
        <Readout label="مساحت هر دور" value={fmt(CY_AREA)} unit="J" />
      </div>
      <p className="text-xs text-muted-foreground">
        چون چرخه است، ΔU = 0 و ΣQ = ΣW؛ ساعتگرد ΣW مثبت (کار توسط گاز) و پادساعتگرد منفی (کار روی گاز).
      </p>
    </SimFrame>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// u5-engine · «جریان انرژی ماشین» — simple Sankey with Carnot ceiling
// ─────────────────────────────────────────────────────────────────────────────
function U5EngineSim() {
  const bn = useCanvasBanner()
  const [tH, setTH] = useState(700)
  const [tC, setTC] = useState(300)
  const [eta, setEta] = useState(35)
  const QH = 1000
  const etaMax = tC < tH ? 1 - tC / tH : 0
  const valid = eta / 100 <= etaMax + 1e-9
  const W = (eta / 100) * QH
  const QC = QH - W

  const setToCarnot = () => {
    setEta(Math.round(etaMax * 1000) / 10)
    bn.show(`بازده روی سقف کارنو تنظیم شد: ${fmt(etaMax * 100)}٪`, 3)
  }

  const { canvasRef } = useSimCanvas((ctx, w, h, t) => {
    ctx.clearRect(0, 0, w, h)
    ctx.fillStyle = CANVAS.bg
    ctx.fillRect(0, 0, w, h)
    drawGrid(ctx, w, h, 40)

    const cx = w / 2
    // reservoirs
    ctx.fillStyle = 'rgba(239,68,68,0.16)'
    rr(ctx, 20, 14, w - 40, 44, 10)
    ctx.fill()
    ctx.strokeStyle = 'rgba(239,68,68,0.5)'
    ctx.lineWidth = 1.5
    ctx.stroke()
    faText(ctx, 'منبع گرم', w - 36, 36, { bold: true, size: 13, align: 'right' })
    faText(ctx, `T_H = ${fmt(tH)} K`, 36, 36, { size: 12, color: CANVAS.red, align: 'left' })

    ctx.fillStyle = 'rgba(56,189,248,0.12)'
    rr(ctx, 20, h - 58, w - 40, 44, 10)
    ctx.fill()
    ctx.strokeStyle = 'rgba(56,189,248,0.45)'
    ctx.stroke()
    faText(ctx, 'منبع سرد', w - 36, h - 36, { bold: true, size: 13, align: 'right' })
    faText(ctx, `T_C = ${fmt(tC)} K`, 36, h - 36, { size: 12, color: '#38bdf8', align: 'left' })

    // engine
    const ey = h / 2 - 6
    const er = 38
    ctx.fillStyle = 'rgba(245,158,11,0.14)'
    ctx.beginPath()
    ctx.arc(cx, ey, er, 0, Math.PI * 2)
    ctx.fill()
    ctx.strokeStyle = valid ? CANVAS.amber : CANVAS.red
    ctx.lineWidth = 2.5
    ctx.stroke()
    ctx.save()
    ctx.translate(cx, ey)
    ctx.rotate(t * 1.2)
    ctx.strokeStyle = valid ? 'rgba(245,158,11,0.6)' : 'rgba(239,68,68,0.5)'
    for (let i = 0; i < 3; i++) {
      ctx.rotate((Math.PI * 2) / 3)
      ctx.beginPath()
      ctx.moveTo(er * 0.4, 0)
      ctx.lineTo(er * 0.85, 0)
      ctx.stroke()
    }
    ctx.restore()
    faText(ctx, 'ماشین', cx, ey, { bold: true, size: 13 })

    const flowMax = 78
    const wQH = 8 + (QH / QH) * flowMax * 0.95
    const wW = 8 + (W / QH) * flowMax
    const wQC = 8 + (QC / QH) * flowMax
    const cMain = valid ? CANVAS.emerald : CANVAS.red
    if (!valid) ctx.setLineDash([8, 6])
    // Q_H: hot reservoir → engine
    ctx.strokeStyle = cMain
    ctx.lineWidth = wQH
    ctx.globalAlpha = 0.65
    ctx.beginPath()
    ctx.moveTo(cx, 58)
    ctx.lineTo(cx, ey - er)
    ctx.stroke()
    ctx.globalAlpha = 1
    arrow(ctx, cx, ey - er - 2, cx, ey - er + 10, cMain, 3)
    faText(ctx, `Q_H = ${fmt(QH)} J`, cx + 14, (58 + ey - er) / 2, { size: 12, color: cMain, align: 'left' })
    // W: engine → out (right)
    arrow(ctx, cx + er, ey, w - 46, ey, valid ? CANVAS.amber : CANVAS.red, Math.max(2.5, wW / 6))
    faText(ctx, `W = ${fmt(W)} J`, cx + er + 14, ey - 16, { size: 12, bold: true, color: valid ? CANVAS.amber : CANVAS.red, align: 'left' })
    faText(ctx, `η = ${fmt(eta)}٪`, cx + er + 14, ey + 16, { size: 11, color: valid ? CANVAS.muted : CANVAS.red, align: 'left' })
    // Q_C: engine → cold reservoir
    arrow(ctx, cx, ey + er, cx, h - 58, valid ? CANVAS.teal : CANVAS.red, Math.max(2.5, wQC / 6))
    faText(ctx, `Q_C = ${fmt(QC)} J`, cx + 14, (ey + er + h - 58) / 2, { size: 12, color: valid ? CANVAS.teal : CANVAS.red, align: 'left' })
    ctx.setLineDash([])

    if (!valid) {
      banner(ctx, w, h / 2 + 62, 'قانون دوم اجازه نمی‌دهد! η باید ≤ η_max باشد', CANVAS.red)
    } else {
      faText(
        ctx,
        `پایستگی: ${fmt(QH)} = ${fmt(W)} + ${fmt(QC)} ✓`,
        cx,
        h / 2 + 74,
        { size: 12, color: CANVAS.muted },
      )
    }
    const bt = bn.tick(t)
    if (bt) banner(ctx, w, 8, bt, CANVAS.emerald)
  }, 430)

  return (
    <SimFrame
      title="جریان انرژی ماشین"
      brief="دماهای دو منبع و بازده دلخواه را تنظیم کن؛ ضخامت هر جریان متناسب با مقدار انرژی آن است."
    >
      <div className="overflow-hidden rounded-lg border">
        <canvas ref={canvasRef} className="block w-full" aria-label="نمودار سانکی ماشین گرمایی با منبع گرم و سرد" />
      </div>
      <div className="flex flex-wrap items-end gap-3">
        <SimSlider label="دمای منبع گرم T_H" value={tH} min={400} max={1000} step={10} unit="K" onChange={setTH} className="min-w-[170px] flex-1" />
        <SimSlider label="دمای منبع سرد T_C" value={tC} min={280} max={400} step={5} unit="K" onChange={setTC} className="min-w-[170px] flex-1" />
        <SimSlider label="بازده η" value={eta} min={0} max={85} step={1} onChange={setEta} format={(v) => `${v}٪`} className="min-w-[150px] flex-1" />
        <SimButton onClick={setToCarnot}>بیشترین بازده مجاز</SimButton>
      </div>
      <div className="flex flex-wrap items-center gap-3">
        <Readout label="Q_H" value={fmt(QH)} unit="J" />
        <Readout label="W" value={fmt(W)} unit="J" tone="text-amber-400" />
        <Readout label="Q_C" value={fmt(QC)} unit="J" tone="text-teal-400" />
        <Readout label="η" value={`${fmt(eta)}٪`} tone={valid ? 'text-emerald-400' : 'text-rose-400'} />
        <Readout label="η_max (کارنو)" value={`${fmt(etaMax * 100)}٪`} tone="text-violet-400" />
      </div>
      {valid ? (
        <p className="text-xs text-muted-foreground">
          بازده درست است؛ برای بازده بالاتر یا T_H را بالا ببر یا T_C را پایین بیاور — سقف کارنو {fmt(etaMax * 100)}٪ است.
        </p>
      ) : (
        <p role="status" className="text-sm font-medium text-rose-500">
          رد شد! η = {fmt(eta)}٪ از سقف کارنو ({fmt(etaMax * 100)}٪) بالاتر است — قانون دوم اجازهٔ این تبدیل را نمی‌دهد.
        </p>
      )}
    </SimFrame>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// u5-second-law · «سقف کارنو» — dual gauge η vs η_max
// ─────────────────────────────────────────────────────────────────────────────
function U5SecondLawSim() {
  const winBeep = useWinBeep()
  const bn = useCanvasBanner()
  const [tH, setTH] = useState(600)
  const [tC, setTC] = useState(300)
  const [eta, setEta] = useState(30)
  const [challenge, setChallenge] = useState(false)
  const [won, setWon] = useState(false)
  const winRef = useRef(false)
  const etaMax = tC < tH ? 1 - tC / tH : 0
  const forbidden = eta / 100 > etaMax + 1e-9

  useEffect(() => {
    if (challenge && !winRef.current && tC < tH && Math.abs(etaMax - 0.6) <= 0.01) {
      winRef.current = true
      setWon(true)
      winBeep()
      bn.show('آفرین! سقف کارنو را 60٪ کردی ✓', 4)
    }
  }, [challenge, etaMax, tC, tH, winBeep, bn])

  const { canvasRef } = useSimCanvas((ctx, w, h, t) => {
    ctx.clearRect(0, 0, w, h)
    ctx.fillStyle = CANVAS.bg
    ctx.fillRect(0, 0, w, h)
    drawGrid(ctx, w, h, 40)

    const cx = w / 2
    const cy = h - 96
    const r = Math.min(120, w * 0.24)
    const ang = (e: number) => Math.PI * (1 - Math.min(1, Math.max(0, e)))
    // base arc
    ctx.lineCap = 'butt'
    ctx.strokeStyle = 'rgba(250,250,249,0.12)'
    ctx.lineWidth = 26
    ctx.beginPath()
    ctx.arc(cx, cy, r, Math.PI, 0)
    ctx.stroke()
    // allowed zone 0..η_max
    ctx.strokeStyle = CANVAS.emerald
    ctx.beginPath()
    ctx.arc(cx, cy, r, Math.PI, ang(etaMax))
    ctx.stroke()
    // forbidden zone η_max..1
    ctx.strokeStyle = 'rgba(239,68,68,0.75)'
    ctx.beginPath()
    ctx.arc(cx, cy, r, ang(etaMax), 0)
    ctx.stroke()
    // ticks
    ctx.font = FONT_FA
    ctx.fillStyle = CANVAS.muted
    ctx.textAlign = 'center'
    for (const e of [0, 0.25, 0.5, 0.75, 1]) {
      const a = ang(e)
      ctx.beginPath()
      ctx.moveTo(cx + Math.cos(a) * (r - 16), cy + Math.sin(a) * (r - 16))
      ctx.lineTo(cx + Math.cos(a) * (r + 16), cy + Math.sin(a) * (r + 16))
      ctx.strokeStyle = 'rgba(250,250,249,0.4)'
      ctx.lineWidth = 1.5
      ctx.stroke()
      ctx.fillText(`${Math.round(e * 100)}`, cx + Math.cos(a) * (r + 28), cy + Math.sin(a) * (r + 28) + 3)
    }
    faText(ctx, '٪ بازده', cx, cy + 14, { size: 11, color: CANVAS.muted })
    // η_max marker
    const am = ang(etaMax)
    ctx.fillStyle = CANVAS.white
    ctx.save()
    ctx.translate(cx + Math.cos(am) * r, cy + Math.sin(am) * r)
    ctx.rotate(am + Math.PI / 2)
    ctx.beginPath()
    ctx.moveTo(0, -7)
    ctx.lineTo(6, 5)
    ctx.lineTo(-6, 5)
    ctx.closePath()
    ctx.fill()
    ctx.restore()
    // η needle
    const an = ang(eta / 100)
    ctx.strokeStyle = forbidden ? CANVAS.red : CANVAS.fg
    ctx.lineWidth = 3.5
    ctx.beginPath()
    ctx.moveTo(cx, cy)
    ctx.lineTo(cx + Math.cos(an) * (r - 24), cy + Math.sin(an) * (r - 24))
    ctx.stroke()
    ctx.fillStyle = forbidden ? CANVAS.red : CANVAS.amber
    ctx.beginPath()
    ctx.arc(cx, cy, 7, 0, Math.PI * 2)
    ctx.fill()
    // values
    faText(ctx, `η = ${fmt(eta)}٪`, cx, cy - r - 46, { bold: true, size: 15, color: forbidden ? CANVAS.red : CANVAS.fg })
    faText(ctx, `η_max کارنو = ${fmt(etaMax * 100)}٪  (T_H = ${fmt(tH)} K ، T_C = ${fmt(tC)} K)`, cx, cy - r - 22, {
      size: 12,
      color: CANVAS.violet,
    })
    if (tC >= tH) {
      faText(ctx, 'T_C باید کمتر از T_H باشد!', cx, cy - r - 68, { size: 12, bold: true, color: CANVAS.red })
    } else if (forbidden) {
      faText(ctx, 'ماشین غیرمجاز: η بالاتر از سقف کارنو است!', cx, cy - r - 68, { size: 12, bold: true, color: CANVAS.red })
    }
    const bt = bn.tick(t)
    if (bt) banner(ctx, w, 8, bt, CANVAS.emerald)
  }, 400)

  return (
    <SimFrame
      title="سقف کارنو"
      brief="با دماها سقف بازده را بساز و ببین نوار سبز (مجاز) و قرمز (غیرمجاز) چطور جابه‌جا می‌شوند."
    >
      <div className="overflow-hidden rounded-lg border">
        <canvas ref={canvasRef} className="block w-full" aria-label="گیج دوطلقهٔ بازده واقعی و سقف کارنو" />
      </div>
      <div className="flex flex-wrap items-end gap-3">
        <SimSlider label="بازده واقعی η" value={eta} min={0} max={100} step={1} onChange={setEta} format={(v) => `${v}٪`} className="min-w-[160px] flex-1" />
        <SimSlider label="دمای منبع گرم T_H" value={tH} min={350} max={1000} step={10} unit="K" onChange={setTH} className="min-w-[160px] flex-1" />
        <SimSlider label="دمای منبع سرد T_C" value={tC} min={250} max={450} step={5} unit="K" onChange={setTC} className="min-w-[160px] flex-1" />
      </div>
      <div className="flex flex-wrap items-center gap-3">
        <SimToggle
          label="چالش: کارنو را 60٪ کن (هر ترکیب دمایی)"
          checked={challenge}
          onChange={(v) => {
            setChallenge(v)
            if (!v) {
              winRef.current = false
              setWon(false)
              bn.clear()
            }
          }}
        />
        <Readout label="η_max" value={`${fmt(etaMax * 100)}٪`} tone="text-violet-400" />
        <Readout label="وضعیت" value={tC >= tH ? 'T_C ≥ T_H!' : forbidden ? 'غیرمجاز' : 'مجاز'} tone={forbidden || tC >= tH ? 'text-rose-400' : 'text-emerald-400'} />
      </div>
      {won ? (
        <p role="status" className="text-sm font-medium text-emerald-500">
          چالش کامل شد: |η_max − 60٪| ≤ 1٪ — مثلاً T_H = {fmt(tH)} K و T_C = {fmt(tC)} K. هر زوجی با T_C/T_H = 0.4 درست است.
        </p>
      ) : (
        <p className="text-sm text-muted-foreground">
          {tC >= tH
            ? 'منبع سرد از گرم گرم‌تر شده! اول T_C را زیر T_H بیاور.'
            : `با T_H = ${fmt(tH)} K و T_C = ${fmt(tC)} K سقف کارنو ${fmt(etaMax * 100)}٪ است؛ برای سقف بالاتر، T_H را بالا ببر یا T_C را پایین بیاور (دماها کلوین!).`}
        </p>
      )}
    </SimFrame>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// u5-fridge · «یخچال از دید انرژی» — refrigerant loop with COP bars
// ─────────────────────────────────────────────────────────────────────────────
function U5FridgeSim() {
  const reduced = useReducedMotion()
  const [wIn, setWIn] = useState(200)
  const [qc, setQc] = useState(600)
  const [hp, setHp] = useState(false)
  const cop = qc / Math.max(1, wIn)
  const qH = wIn + qc
  const copHP = qH / Math.max(1, wIn)
  const copShown = hp ? copHP : cop

  const { canvasRef } = useSimCanvas((ctx, w, h, t) => {
    ctx.clearRect(0, 0, w, h)
    ctx.fillStyle = CANVAS.bg
    ctx.fillRect(0, 0, w, h)
    drawGrid(ctx, w, h, 40)

    const boxX = 16
    const boxW = 210
    const boxY = 66
    const boxH = h - 118
    // cold box (or outside ambient in heat-pump mode)
    ctx.fillStyle = hp ? 'rgba(56,189,248,0.10)' : 'rgba(139,92,246,0.10)'
    rr(ctx, boxX, boxY, boxW, boxH, 12)
    ctx.fill()
    ctx.strokeStyle = hp ? 'rgba(56,189,248,0.5)' : 'rgba(139,92,246,0.5)'
    ctx.lineWidth = 2
    ctx.setLineDash([7, 5])
    ctx.stroke()
    ctx.setLineDash([])
    faText(ctx, hp ? 'محیط سرد بیرون' : 'محفظهٔ سرد یخچال', boxX + boxW / 2, boxY + 18, { bold: true, size: 12, color: '#38bdf8' })
    faText(ctx, hp ? 'خانه (گرم می‌شود)' : 'آشپزخانه', w - 24, 24, { bold: true, size: 13, color: CANVAS.orange, align: 'right' })

    // refrigerant loop polyline
    const yTop = 130
    const yBot = boxY + boxH - 36
    const pts: { x: number; y: number }[] = [
      { x: 70, y: yTop },
      { x: 70, y: yBot },
      { x: 258, y: yBot + 6 },
      { x: 330, y: yBot - 30 },
      { x: 330, y: yTop + 30 },
      { x: 150, y: yTop - 14 },
    ]
    const segLen: number[] = []
    let total = 0
    for (let i = 0; i < pts.length; i++) {
      const a = pts[i]
      const b = pts[(i + 1) % pts.length]
      const L = Math.hypot(b.x - a.x, b.y - a.y)
      segLen.push(L)
      total += L
    }
    const posAt = (sRaw: number) => {
      let s = sRaw - Math.floor(sRaw)
      let d = s * total
      for (let i = 0; i < pts.length; i++) {
        if (d <= segLen[i]) {
          const a = pts[i]
          const b = pts[(i + 1) % pts.length]
          const f = segLen[i] > 0 ? d / segLen[i] : 0
          return { x: a.x + (b.x - a.x) * f, y: a.y + (b.y - a.y) * f, seg: i, f }
        }
        d -= segLen[i]
      }
      return { x: pts[0].x, y: pts[0].y, seg: 0, f: 0 }
    }
    // temperature profile by loop position (0 = cold, 1 = hot)
    const cum: number[] = [0]
    for (let i = 0; i < pts.length; i++) cum.push(cum[i] + segLen[i])
    const vertexTemp = [0.12, 0.1, 1, 0.9, 0.55, 0.15]
    const tempAt = (sRaw: number) => {
      const d = (sRaw - Math.floor(sRaw)) * total
      for (let i = 0; i < pts.length; i++) {
        if (d <= cum[i + 1] || i === pts.length - 1) {
          const f = segLen[i] > 0 ? (d - cum[i]) / segLen[i] : 0
          return vertexTemp[i] + (vertexTemp[(i + 1) % pts.length] - vertexTemp[i]) * Math.min(1, Math.max(0, f))
        }
      }
      return 0.5
    }
    // pipe
    ctx.strokeStyle = 'rgba(168,162,158,0.6)'
    ctx.lineWidth = 7
    ctx.lineJoin = 'round'
    ctx.beginPath()
    pts.forEach((p, i) => (i === 0 ? ctx.moveTo(p.x, p.y) : ctx.lineTo(p.x, p.y)))
    ctx.closePath()
    ctx.stroke()
    // coil decorations on vertical runs
    ctx.strokeStyle = 'rgba(168,162,158,0.35)'
    ctx.lineWidth = 1.5
    for (const vx of [70, 330]) {
      for (let i = 0; i < 5; i++) {
        const yy = yTop + 26 + i * ((yBot - yTop - 40) / 4)
        ctx.beginPath()
        ctx.arc(vx, yy, 6, 0, Math.PI * 2)
        ctx.stroke()
      }
    }
    // refrigerant particles
    const speeds = reduced ? [0.15, 0.45, 0.75] : [t * 0.06, (t * 0.06 + 1 / 3) % 1, (t * 0.06 + 2 / 3) % 1]
    for (const s of speeds) {
      const p = posAt(s)
      const col = lerpColor([56, 189, 248], [239, 68, 68], tempAt(s))
      ctx.fillStyle = col
      ctx.beginPath()
      ctx.arc(p.x, p.y, 5.5, 0, Math.PI * 2)
      ctx.fill()
    }
    // compressor + valve
    ctx.fillStyle = CANVAS.panelLight
    rr(ctx, 236, yBot - 10, 46, 32, 6)
    ctx.fill()
    ctx.strokeStyle = CANVAS.fg
    ctx.lineWidth = 1
    ctx.stroke()
    faText(ctx, 'کمپرسور', 259, yBot + 34, { size: 10, color: CANVAS.muted })
    ctx.fillStyle = CANVAS.panelLight
    rr(ctx, 136, yTop - 24, 30, 20, 4)
    ctx.fill()
    ctx.stroke()
    faText(ctx, 'شیر انبساط', 151, yTop - 34, { size: 10, color: CANVAS.muted })
    faText(ctx, 'اواپراتور (گرما را می‌بلعد)', 120, (yTop + yBot) / 2 + 40, { size: 10, color: CANVAS.teal })
    faText(ctx, 'کندانسور (گرما را می‌دهد)', 330, (yTop + yBot) / 2 - 54, { size: 10, color: CANVAS.orange })

    // energy arrows
    const midY = (yTop + yBot) / 2
    arrow(ctx, 130, midY, 86, midY, CANVAS.teal, 4)
    faText(ctx, `Q_C = ${fmt(qc)} J ${hp ? 'از بیرون' : 'از محفظه'}`, 128, midY - 18, { size: 11, color: CANVAS.teal, align: 'right' })
    arrow(ctx, 336, midY, w - 40, midY, CANVAS.orange, 4)
    faText(ctx, `Q_H = ${fmt(qH)} J ${hp ? 'به خانه' : 'به آشپزخانه'}`, w - 46, midY - 18, { size: 11, color: CANVAS.orange, align: 'right' })
    arrow(ctx, 196, yBot + 58, 246, yBot + 18, CANVAS.amber, 4)
    faText(ctx, `W = ${fmt(wIn)} J (برق کمپرسور)`, 190, yBot + 70, { size: 11, color: CANVAS.amber, align: 'right' })

    // COP + Q_H bars
    panel(ctx, w - 196, 40, 180, 62)
    faText(ctx, hp ? 'COP پمپ‌گرما = Q_H/W' : 'COP یخچال = Q_C/W', w - 106, 56, { size: 11, color: CANVAS.muted })
    const copW = Math.min(160, (copShown / 6) * 160)
    ctx.fillStyle = CANVAS.emerald
    rr(ctx, w - 188, 66, Math.max(4, copW), 10, 5)
    ctx.fill()
    faText(ctx, `COP = ${fmt(copShown)}`, w - 106, 92, { size: 12, bold: true, color: CANVAS.emerald })
  }, 430)

  return (
    <SimFrame
      title="یخچال از دید انرژی"
      brief="مبرد را دنبال کن: بعد از کمپرسور داغ است، در کندانسور گرما می‌دهد، در شیر انبساط سرد و در اواپراتور گرمای محفظه را می‌بلعد."
    >
      <div className="overflow-hidden rounded-lg border">
        <canvas ref={canvasRef} className="block w-full" aria-label="حلقهٔ مبرد یخچال با جریان‌های W و Q_C و Q_H" />
      </div>
      <div className="flex flex-wrap items-end gap-3">
        <SimSlider label="کار کمپرسور W" value={wIn} min={100} max={400} step={10} unit="J" onChange={setWIn} className="min-w-[170px] flex-1" />
        <SimSlider label="گرما بیرون‌کشیده Q_C" value={qc} min={200} max={1000} step={10} unit="J" onChange={setQc} className="min-w-[170px] flex-1" />
        <SimToggle label="حالت پمپ‌گرما" checked={hp} onChange={setHp} />
      </div>
      <div className="flex flex-wrap items-center gap-3">
        <Readout label={hp ? 'COP پمپ‌گرما' : 'COP یخچال'} value={fmt(copShown)} tone="text-emerald-400" />
        <Readout label="Q_H = W + Q_C" value={fmt(qH)} unit="J" tone="text-orange-400" />
        <Readout label="Q_C" value={fmt(qc)} unit="J" tone="text-teal-400" />
        <Readout label="W" value={fmt(wIn)} unit="J" tone="text-amber-400" />
        <Legend color="#38bdf8" label="مبرد سرد" />
        <Legend color="#ef4444" label="مبرد داغ" />
      </div>
      <p className="text-xs text-muted-foreground">
        {hp
          ? 'در پمپ‌گرما هدف گرم کردن است؛ شاخص COP = Q_H/W و همیشه یکی بیشتر از حالت یخچالی است.'
          : 'COP = Q_C/W می‌تواند بزرگ‌تر از ۱ باشد؛ با W کمتر برای Q_C ثابت، یخچال بهینه‌تر است.'}
      </p>
    </SimFrame>
  )
}

export const simsCh5: Record<string, SimComponent> = {
  'u5-state-eq': U5StateEqSim,
  'u5-exchange': U5ExchangeSim,
  'u5-first-law': U5FirstLawSim,
  'u5-processes': U5ProcessesSim,
  'u5-cycle': U5CycleSim,
  'u5-engine': U5EngineSim,
  'u5-second-law': U5SecondLawSim,
  'u5-fridge': U5FridgeSim,
}
