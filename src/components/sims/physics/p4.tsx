// ─── فیزیک‌دهم · فصل ۴ «دما و گرما» widgets ───────────────────────────────────
// Chapter agent Task 3-d owns this file. Six canvas sims for ch4 lessons:
// u4-temperature, u4-expansion, u4-heat, u4-phase-change, u4-transfer,
// u4-gas-laws (u4-review reuses u4-gas-laws via the registry key).
'use client'

import { useCallback, useRef, useState } from 'react'
import {
  CANVAS,
  Legend,
  Readout,
  SimButton,
  SimFrame,
  SimSelect,
  SimSlider,
  SimToggle,
  canvasPos,
  drawGrid,
  useReducedMotion,
  useSimBeep,
  useSimCanvas,
} from '@/components/sims/sim-kit'
import type { SimComponent } from '@/lib/game/types'

// ─── chapter-local helpers (do not export) ───────────────────────────────────

/** Format a number for canvas/HTML readouts — never NaN/Infinity. */
/** Region-scoped grid lines (x, y, w, h in CSS px). */
function gridRegion(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, step = 34) {
  ctx.save()
  ctx.strokeStyle = CANVAS.grid
  ctx.lineWidth = 1
  ctx.beginPath()
  for (let px = x + step; px < x + w; px += step) { ctx.moveTo(px, y); ctx.lineTo(px, y + h) }
  for (let py = y + step; py < y + h; py += step) { ctx.moveTo(x, py); ctx.lineTo(x + w, py) }
  ctx.stroke()
  ctx.restore()
}

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

/** Draw Persian text safely on canvas. */
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

const FA_D = '۰۱۲۳۴۵۶۷۸۹'
function faDigits(v: number | string): string {
  return String(v).replace(/[0-9]/g, (d) => FA_D[Number(d)])
}

function clamp(v: number, lo: number, hi: number): number {
  return Math.min(hi, Math.max(lo, Number.isFinite(v) ? v : lo))
}
function lerp(a: number, b: number, k: number): number {
  return a + (b - a) * k
}

type Stop = [number, number, number, number] // x, r, g, b
function ramp(stops: Stop[], x: number): string {
  if (x <= stops[0][0]) return `rgb(${stops[0][1]},${stops[0][2]},${stops[0][3]})`
  for (let i = 1; i < stops.length; i++) {
    if (x <= stops[i][0]) {
      const a = stops[i - 1]
      const b = stops[i]
      const k = (x - a[0]) / (b[0] - a[0])
      return `rgb(${Math.round(lerp(a[1], b[1], k))},${Math.round(lerp(a[2], b[2], k))},${Math.round(lerp(a[3], b[3], k))})`
    }
  }
  const last = stops[stops.length - 1]
  return `rgb(${last[1]},${last[2]},${last[3]})`
}

const TEMP_STOPS: Stop[] = [
  [-60, 96, 165, 250],
  [0, 56, 189, 248],
  [30, 245, 158, 11],
  [120, 239, 68, 68],
]
function tempColor(T: number): string {
  return ramp(TEMP_STOPS, T)
}

const WATER_STOPS: Stop[] = [
  [0, 56, 189, 248],
  [45, 20, 184, 166],
  [90, 239, 68, 68],
]
function waterColor(T: number): string {
  return ramp(WATER_STOPS, T)
}

/** Rounded green win banner in canvas (Persian, RTL). */
function drawWinBanner(ctx: CanvasRenderingContext2D, w: number, text: string, y = 14) {
  const bw = Math.min(320, w - 40)
  const bx = (w - bw) / 2
  ctx.fillStyle = 'rgba(16,185,129,0.95)'
  rr(ctx, bx, y, bw, 42, 12)
  ctx.fill()
  ctx.strokeStyle = 'rgba(255,255,255,0.45)'
  ctx.lineWidth = 1.5
  ctx.stroke()
  faText(ctx, text, w / 2, y + 21, { bold: true, size: 14, color: '#ffffff' })
}

/** Win beeps: 660 Hz short + 880 Hz delayed. */
function useWinBeep() {
  const beep = useSimBeep()
  return useCallback(() => {
    beep(660, 120)
    window.setTimeout(() => beep(880, 160), 150)
  }, [beep])
}

/** Small candle-like flame used across sims. */
function flame(ctx: CanvasRenderingContext2D, x: number, y: number, s: number, t: number, on: boolean) {
  if (!on) return
  const fl = 1 + 0.18 * Math.sin(t * 11) + 0.1 * Math.sin(t * 23)
  ctx.fillStyle = 'rgba(249,115,22,0.9)'
  ctx.beginPath()
  ctx.moveTo(x - 8 * s, y)
  ctx.quadraticCurveTo(x - 9 * s, y - 16 * s * fl, x, y - 26 * s * fl)
  ctx.quadraticCurveTo(x + 9 * s, y - 16 * s * fl, x + 8 * s, y)
  ctx.closePath()
  ctx.fill()
  ctx.fillStyle = 'rgba(234,179,8,0.95)'
  ctx.beginPath()
  ctx.moveTo(x - 4 * s, y)
  ctx.quadraticCurveTo(x - 4.5 * s, y - 8 * s * fl, x, y - 13 * s * fl)
  ctx.quadraticCurveTo(x + 4.5 * s, y - 8 * s * fl, x + 4 * s, y)
  ctx.closePath()
  ctx.fill()
}

interface Banner {
  text: string
  until: number
}

// ─────────────────────────────────────────────────────────────────────────────
// u4-temperature · «سه مقیاس دما»
// ─────────────────────────────────────────────────────────────────────────────
function U4TemperatureSim() {
  const [c, setC] = useState(25)
  const [chalC, setChalC] = useState<number | null>(null)
  const [chalInput, setChalInput] = useState('')
  const [chalState, setChalState] = useState<'idle' | 'ask' | 'right' | 'wrong'>('idle')
  const [streak, setStreak] = useState(0)
  const [banner, setBanner] = useState<Banner | null>(null)
  const [status, setStatus] = useState('')
  const tRef = useRef(0)
  const tDispRef = useRef(25)
  const reduced = useReducedMotion()
  const winBeep = useWinBeep()

  const askQuestion = () => {
    setChalC(Math.round(-40 + Math.random() * 150))
    setChalInput('')
    setChalState('ask')
    setStatus('')
  }

  const checkAnswer = () => {
    if (chalC === null) return
    const k = chalC + 273
    const val = parseFloat(chalInput.replace(',', '.'))
    if (Number.isFinite(val) && Math.abs(val - k) <= 0.5) {
      const st = streak + 1
      setStreak(st)
      setChalState('right')
      setStatus(`درست است! ${chalC} °C = ${k} K. ${3 - st > 0 ? `${faDigits(3 - st)} پاسخ درست تا نشان سه‌تایی مانده.` : ''}`)
      if (st >= 3) {
        winBeep()
        setBanner({ text: 'سه پاسخ درست پیاپی! تبدیل دما دستت شد', until: tRef.current + 3 })
        setStreak(0)
        setStatus('🎉 سه درست پیاپی! فرمول T(K) = T(°C) + 273 را خوب یاد گرفتی.')
      } else {
        window.setTimeout(() => { /* small success blip */ }, 0)
      }
    } else {
      setStreak(0)
      setChalState('wrong')
      setStatus(`نه این‌بار. ${chalC} °C = ${k} K است؛ یادت باشد: به درجهٔ سلسیوس 273 اضافه کن.`)
    }
  }

  const { canvasRef } = useSimCanvas((ctx, w, h, t, dt) => {
    tRef.current = t
    ctx.clearRect(0, 0, w, h)
    ctx.fillStyle = CANVAS.bg
    ctx.fillRect(0, 0, w, h)

    const bulbCy = h - 84
    const tubeTop = 52
    const bx = 118
    const tempToY = (T: number) => bulbCy - ((T + 60) / 180) * (bulbCy - tubeTop - 6)

    // colored background zones (frozen / mild / hot) behind the scale
    const zones: [number, number, string, string][] = [
      [-60, 0, 'rgba(56,189,248,0.09)', 'یخ‌زده'],
      [0, 30, 'rgba(20,184,166,0.07)', 'معتدل'],
      [30, 120, 'rgba(249,115,22,0.09)', 'داغ'],
    ]
    for (const [t0, t1, col, label] of zones) {
      const y0 = tempToY(t1)
      const y1 = tempToY(t0)
      ctx.fillStyle = col
      ctx.fillRect(24, y0, w - 48, y1 - y0)
      faText(ctx, label, 44, (y0 + y1) / 2, { size: 10, color: CANVAS.muted, align: 'left' })
    }

    // animated liquid column
    const target = c
    if (reduced) tDispRef.current = target
    else tDispRef.current += (target - tDispRef.current) * Math.min(1, dt * 8)
    const tDisp = tDispRef.current
    const colY = tempToY(tDisp)
    const liquid = tempColor(tDisp)

    // tube
    ctx.fillStyle = 'rgba(255,255,255,0.06)'
    rr(ctx, bx - 12, tubeTop, 24, bulbCy - tubeTop + 6, 12)
    ctx.fill()
    ctx.strokeStyle = 'rgba(250,250,249,0.25)'
    ctx.lineWidth = 1.5
    ctx.stroke()
    // liquid
    ctx.fillStyle = liquid
    rr(ctx, bx - 8, colY, 16, bulbCy - colY + 4, 8)
    ctx.fill()
    ctx.beginPath()
    ctx.arc(bx, bulbCy, 19, 0, Math.PI * 2)
    ctx.fill()
    ctx.strokeStyle = 'rgba(255,255,255,0.3)'
    ctx.beginPath()
    ctx.arc(bx, bulbCy, 19, 0, Math.PI * 2)
    ctx.stroke()

    // scale ticks
    ctx.font = '700 11px ui-monospace, Menlo, monospace'
    ctx.textAlign = 'right'
    ctx.textBaseline = 'middle'
    for (const T of [-60, -20, 0, 20, 40, 80, 120]) {
      const y = tempToY(T)
      ctx.strokeStyle = 'rgba(168,162,158,0.6)'
      ctx.beginPath()
      ctx.moveTo(bx - 12, y)
      ctx.lineTo(bx - 24, y)
      ctx.stroke()
      ctx.fillStyle = T === 0 ? CANVAS.emerald : CANVAS.muted
      ctx.fillText(String(T), bx - 28, y)
    }
    faText(ctx, '°C', bx - 40, tubeTop - 18, { size: 11, color: CANVAS.muted })
    faText(ctx, `${fmt(c)} °C`, bx, 22, { bold: true, size: 17, color: liquid })

    // mini thermometer helper (K and F)
    const mini = (x: number, label: string, v: number, lo: number, hi: number, color: string, unit: string) => {
      const top = 104
      const bot = h - 150
      const yFor = (val: number) => bot - ((val - lo) / (hi - lo)) * (bot - top)
      ctx.fillStyle = 'rgba(255,255,255,0.06)'
      rr(ctx, x - 6, top, 12, bot - top + 8, 6)
      ctx.fill()
      const yv = clamp(yFor(v), top, bot)
      ctx.fillStyle = color
      rr(ctx, x - 3.5, yv, 7, bot - yv + 4, 4)
      ctx.fill()
      ctx.beginPath()
      ctx.arc(x, bot + 14, 9, 0, Math.PI * 2)
      ctx.fill()
      faText(ctx, label, x, top - 16, { size: 11, color: CANVAS.muted })
      faText(ctx, `${fmt(v)} ${unit}`, x, bot + 42, { bold: true, size: 13, color })
    }
    mini(w * 0.52, 'کلوین (K) — مقیاس SI', c + 273, 213, 393, CANVAS.teal, 'K')
    mini(w * 0.78, 'فارنهایت (°F)', 1.8 * c + 32, -76, 248, CANVAS.violet, '°F')

    // streak chip
    faText(ctx, `زنجیرهٔ درست: ${faDigits(streak)}/۳`, w - 28, 24, { size: 12, color: streak > 0 ? CANVAS.emerald : CANVAS.muted, align: 'right' })
    faText(ctx, 'فرمول: T(K) = T(°C) + 273', w - 28, 44, { size: 11, color: CANVAS.muted, align: 'right' })

    if (banner && t < banner.until) drawWinBanner(ctx, w, banner.text)
  }, 420)

  const chalK = chalC !== null ? chalC + 273 : 0

  return (
    <SimFrame
      title="سه مقیاس دما"
      brief="اسلایدر را بکش تا ستون مایع بالا و پایین برود؛ همان دما را با کلوین و فارنهایت هم ببین. بعد سراغ چالش تبدیل برو!"
    >
      <div className="overflow-hidden rounded-lg border">
        <canvas ref={canvasRef} className="block w-full" aria-label="ترمومتر بزرگ و دو ترمومتر کوچک کلوین و فارنهایت" />
      </div>
      <div className="flex flex-wrap items-center gap-3">
        <SimSlider
          label="دما"
          value={c}
          min={-60}
          max={120}
          step={0.5}
          onChange={setC}
          format={(v) => `${fmt(v)} °C`}
          className="min-w-[200px] flex-1"
        />
        <Readout label="کلوین" value={fmt(c + 273)} unit="K" />
        <Readout label="فارنهایت" value={fmt(1.8 * c + 32)} unit="°F" />
      </div>
      <div className="flex flex-wrap items-center gap-3 rounded-lg border border-dashed p-3">
        <SimButton variant="secondary" onClick={askQuestion}>سؤال تصادفی</SimButton>
        {chalC !== null && (
          <span className="text-sm font-semibold">
            {faDigits(chalC)} °C را به کلوین بده:
          </span>
        )}
        {chalState === 'ask' && (
          <>
            <input
              aria-label="پاسخ عددی بر حسب کلوین"
              inputMode="decimal"
              value={chalInput}
              onChange={(e) => setChalInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && checkAnswer()}
              placeholder="?"
              className="w-24 rounded-md border bg-transparent px-2 py-1 text-center font-mono text-sm"
            />
            <SimButton onClick={checkAnswer}>بررسی</SimButton>
          </>
        )}
        <span className="text-xs text-muted-foreground">درست‌های پیاپی نشان سه‌تایی می‌گیرند!</span>
      </div>
      <p role="status" className="min-h-5 text-sm">{status}</p>
    </SimFrame>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// u4-expansion · «آزمایشگاه انبساط»
// ─────────────────────────────────────────────────────────────────────────────
const EXP_MATERIALS = {
  al: { label: 'آلومینیوم', alpha: 24e-6, color: '#cbd5e1' },
  fe: { label: 'آهن', alpha: 12e-6, color: '#a8a29e' },
  glass: { label: 'شیشه', alpha: 9e-6, color: 'rgba(56,189,248,0.4)' },
} as const
type ExpMat = keyof typeof EXP_MATERIALS

function U4ExpansionSim() {
  const [mode, setMode] = useState<'rod' | 'ballring' | 'bimetal'>('rod')
  const [mat, setMat] = useState<ExpMat>('al')
  const [dT, setDT] = useState(40)
  const [compare, setCompare] = useState(false)
  const [ringHot, setRingHot] = useState(false)
  const [ballHot, setBallHot] = useState(false)
  const [testRun, setTestRun] = useState(0)
  const [status, setStatus] = useState('')
  const tRef = useRef(0)
  const rodLenRef = useRef(0)
  const rodLen2Ref = useRef(0)
  const bendRef = useRef(0)
  const ballYRef = useRef(0)
  const reduced = useReducedMotion()

  const runPassTest = () => {
    const passes = !(ballHot && !ringHot)
    setTestRun((n) => n + 1)
    if (ballHot && !ringHot) {
      setStatus('گوی گرم بزرگ‌تر شده و از حلقهٔ سرد عبور نمی‌کند — سوراخ هم بزرگ شده، اما نه به‌اندازهٔ گوی!')
    } else if (ballHot && ringHot) {
      setStatus('هر دو گرم شدند: سوراخ و گوی با هم بزرگ شدند و نسبت‌ها حفظ شد — گوی باز هم عبور کرد!')
    } else if (ringHot) {
      setStatus('حلقهٔ گرم سوراخ بزرگ‌تری دارد؛ گوی سرد راحت‌تر از قبل عبور می‌کند.')
    } else {
      setStatus('حالت پایه: گوی سرد از حلقهٔ سرد می‌گذرد.')
    }
    if (passes) ballYRef.current = 0 // will animate below via testRun key
  }

  const { canvasRef } = useSimCanvas((ctx, w, h, t, dt) => {
    tRef.current = t
    ctx.clearRect(0, 0, w, h)
    ctx.fillStyle = CANVAS.bg
    ctx.fillRect(0, 0, w, h)

    if (mode === 'rod') {
      const x0 = 64
      const pxPerM = (w - 140) / 2
      const yBase = compare ? 150 : 190
      const k = reduced ? 1 : Math.min(1, dt * 6)
      const drawRod = (y: number, m: ExpMat, label: string) => {
        const info = EXP_MATERIALS[m]
        const dl = info.alpha * 2 * dT // ΔT slider is the temperature rise
        const target = clamp(dl * 10000, 0, 70)
        if (m === 'al') rodLenRef.current += (target - rodLenRef.current) * k
        else rodLen2Ref.current += (target - rodLen2Ref.current) * k
        const extra = m === 'al' ? rodLenRef.current : rodLen2Ref.current
        const len = pxPerM * 2 + extra
        // heat arrows
        if (dT > 0) {
          ctx.globalAlpha = 0.25 + (dT / 100) * 0.6
          for (let i = 0; i < 6; i++) {
            const ax = x0 + 30 + (i * (len - 40)) / 5
            ctx.strokeStyle = CANVAS.orange
            ctx.lineWidth = 2
            ctx.beginPath()
            ctx.moveTo(ax, y + 34)
            ctx.lineTo(ax, y + 16)
            ctx.lineTo(ax - 4, y + 24)
            ctx.moveTo(ax, y + 16)
            ctx.lineTo(ax + 4, y + 24)
            ctx.stroke()
          }
          ctx.globalAlpha = 1
        }
        ctx.fillStyle = info.color
        rr(ctx, x0, y, len, 20, 6)
        ctx.fill()
        ctx.strokeStyle = 'rgba(0,0,0,0.35)'
        ctx.lineWidth = 1
        ctx.stroke()
        faText(ctx, label, x0 + len / 2, y + 10, { size: 11, bold: true, color: '#1c1917' })
        faText(ctx, `ΔL = ${fmt(dl * 1000)} mm`, x0 + len + 12, y + 10, { size: 12, bold: true, color: CANVAS.amber, align: 'left' })
      }
      if (compare) {
        drawRod(yBase - 40, 'al', 'آلومینیوم (α=24×10⁻⁶)')
        drawRod(yBase + 10, 'fe', 'آهن (α=12×10⁻⁶)')
      } else {
        drawRod(yBase, mat, `${EXP_MATERIALS[mat].label} (α=${EXP_MATERIALS[mat].alpha === 24e-6 ? '24' : EXP_MATERIALS[mat].alpha === 12e-6 ? '12' : '9'}×10⁻⁶)`)
      }

      // ruler
      const ry = h - 78
      ctx.strokeStyle = CANVAS.muted
      ctx.lineWidth = 1.5
      ctx.beginPath()
      ctx.moveTo(x0, ry)
      ctx.lineTo(x0 + pxPerM * 2 + 70, ry)
      ctx.stroke()
      ctx.font = '700 11px ui-monospace, Menlo, monospace'
      ctx.textAlign = 'center'
      ctx.fillStyle = CANVAS.muted
      for (let i = 0; i <= 4; i++) {
        const tx = x0 + pxPerM * (i / 2)
        ctx.beginPath()
        ctx.moveTo(tx, ry)
        ctx.lineTo(tx, ry + 8)
        ctx.stroke()
        ctx.fillText(`${(i / 2).toFixed(1)} m`, tx, ry + 20)
      }
      faText(ctx, 'بزرگ‌نمایی ΔL: ۱۰٬۰۰۰ برابر', w - 28, ry - 12, { size: 10, color: CANVAS.muted, align: 'right' })
    }

    if (mode === 'ballring') {
      const cx = w * 0.5
      const cy = 190
      const holeR = ringHot ? 38 : 30
      const ballR = ballHot ? 32 : 26
      const k = reduced ? 1 : Math.min(1, dt * 2.2)
      // pass check: ball radius vs hole radius
      const passes = ballR <= holeR
      // ball animated downward after each test
      const startY = 52
      const restY = cy - holeR - ballR + 2
      const endY = cy + 110
      const targetY = testRun === 0 ? startY : passes ? endY : restY
      ballYRef.current += (targetY - ballYRef.current) * k
      // ring
      ctx.strokeStyle = ringHot ? CANVAS.orange : '#b8c0cc'
      ctx.lineWidth = 12
      ctx.beginPath()
      ctx.arc(cx, cy, holeR + 6, 0, Math.PI * 2)
      ctx.stroke()
      // stand
      ctx.strokeStyle = 'rgba(168,162,158,0.5)'
      ctx.lineWidth = 3
      ctx.beginPath()
      ctx.moveTo(cx, cy + holeR + 12)
      ctx.lineTo(cx, cy + holeR + 60)
      ctx.stroke()
      flame(ctx, cx, cy + holeR + 62, ringHot ? 1.1 : 0, t, ringHot)
      faText(ctx, ringHot ? 'حلقهٔ داغ — سوراخ بزرگ‌تر شده' : 'حلقهٔ سرد', cx, cy + holeR + 86, { size: 11, color: ringHot ? CANVAS.orange : CANVAS.muted })
      // string + ball
      ctx.strokeStyle = 'rgba(250,250,249,0.35)'
      ctx.lineWidth = 1.5
      ctx.beginPath()
      ctx.moveTo(cx, 16)
      ctx.lineTo(cx, ballYRef.current - ballR + 2)
      ctx.stroke()
      ctx.fillStyle = ballHot ? CANVAS.red : '#d6d3d1'
      ctx.beginPath()
      ctx.arc(cx, ballYRef.current, ballR, 0, Math.PI * 2)
      ctx.fill()
      ctx.strokeStyle = 'rgba(0,0,0,0.4)'
      ctx.stroke()
      faText(ctx, ballHot ? 'گوی داغ' : 'گوی سرد', cx + ballR + 26, ballYRef.current, { size: 11, color: ballHot ? CANVAS.red : CANVAS.muted })
      if (testRun > 0 && !passes && ballYRef.current > restY - 4) {
        faText(ctx, 'عبور نمی‌کند!', cx, cy + holeR + ballR + 26, { bold: true, size: 13, color: CANVAS.rose })
      }
      if (testRun > 0 && passes && ballYRef.current > endY - 8) {
        faText(ctx, 'عبور کرد!', cx, cy + holeR + 110, { bold: true, size: 13, color: CANVAS.emerald })
      }
      faText(ctx, 'نکته: با گرم شدن، سوراخ هم بزرگ می‌شود — برخلاف حدس رایج!', w - 28, h - 26, { size: 11, color: CANVAS.muted, align: 'right' })
    }

    if (mode === 'bimetal') {
      const x0 = 70
      const L = Math.min(300, w * 0.45)
      const y0 = 210
      const target = (dT / 100) * 0.55
      bendRef.current += (target - bendRef.current) * (reduced ? 1 : Math.min(1, dt * 5))
      const th = bendRef.current
      const ex = x0 + L * Math.cos(th)
      const ey = y0 + L * Math.sin(th)
      const mx = x0 + L * 0.5 * Math.cos(th)
      const my = y0 + L * 0.5 * Math.sin(th) + 34
      // two layers (brass top, iron bottom)
      for (const [off, color] of [[-5, '#eab308'], [5, '#94a3b8']] as const) {
        ctx.strokeStyle = color
        ctx.lineWidth = 8
        ctx.lineCap = 'round'
        ctx.beginPath()
        ctx.moveTo(x0, y0 + off)
        ctx.quadraticCurveTo(mx, my + off, ex, ey + off)
        ctx.stroke()
      }
      // heater arrows below strip
      if (dT > 0) {
        ctx.globalAlpha = 0.25 + (dT / 100) * 0.6
        for (let i = 0; i < 5; i++) {
          const ax = x0 + 30 + (i * (L - 50)) / 4
          ctx.strokeStyle = CANVAS.orange
          ctx.lineWidth = 2
          ctx.beginPath()
          ctx.moveTo(ax, y0 + 66)
          ctx.lineTo(ax, y0 + 44)
          ctx.stroke()
        }
        ctx.globalAlpha = 1
      }
      faText(ctx, 'برنج — α بزرگ‌تر (لایهٔ بیرونی)', x0 + L * 0.2, y0 - 26, { size: 11, color: CANVAS.yellow })
      faText(ctx, 'آهن — α کوچک‌تر (سمت مقعر)', x0 + L * 0.2, y0 + 26, { size: 11, color: '#94a3b8' })
      faText(ctx, `زاویهٔ خمش ≈ ${fmt((th * 180) / Math.PI)}°`, w - 28, 40, { size: 12, bold: true, color: CANVAS.amber, align: 'right' })
      faText(ctx, 'گرم شدن ⇒ نوار به سمت فلز کم‌انبساط خم می‌شود — اصل ترموستات', w - 28, h - 26, { size: 11, color: CANVAS.muted, align: 'right' })
    }
  }, 410)

  return (
    <SimFrame
      title="آزمایشگاه انبساط"
      brief="سه آزمایش: میله، گوی و حلقه، و نوار دو فلزی — ببین گرما چگونه اجسام را بزرگ می‌کند."
    >
      <div className="overflow-hidden rounded-lg border">
        <canvas ref={canvasRef} className="block w-full" aria-label="آزمایشگاه انبساط گرمایی" />
      </div>
      <div className="flex flex-wrap items-center gap-3">
        <SimSelect
          label="آزمایش"
          value={mode}
          onChange={(v) => setMode(v)}
          options={[
            { value: 'rod', label: 'میله و خط‌کش' },
            { value: 'ballring', label: 'گوی و حلقه' },
            { value: 'bimetal', label: 'نوار دو فلزی' },
          ]}
        />
        {mode === 'rod' && (
          <>
            <SimSelect
              label="جنس میله"
              value={mat}
              onChange={(v) => setMat(v)}
              options={[
                { value: 'al', label: 'آلومینیوم' },
                { value: 'fe', label: 'آهن' },
                { value: 'glass', label: 'شیشه' },
              ]}
            />
            <SimToggle label="مقایسهٔ آلومینیوم با آهن" checked={compare} onChange={setCompare} />
          </>
        )}
        {mode === 'ballring' && (
          <>
            <SimToggle label="شعله زیر حلقه" checked={ringHot} onChange={setRingHot} />
            <SimToggle label="گرم‌کردن گوی" checked={ballHot} onChange={setBallHot} />
            <SimButton variant="secondary" onClick={runPassTest}>آزمایش عبور</SimButton>
          </>
        )}
        {mode !== 'ballring' && (
          <SimSlider
            label="افزایش دما (ΔT)"
            value={dT}
            min={0}
            max={100}
            step={1}
            onChange={setDT}
            format={(v) => `${fmt(v)} °C`}
            className="min-w-[180px] flex-1"
          />
        )}
      </div>
      <div className="flex flex-wrap items-center gap-3">
        {mode === 'rod' && (
          <Readout
            label="ΔL میله (۲ متری)"
            value={fmt(EXP_MATERIALS[mat].alpha * 2 * dT * 1000)}
            unit="mm"
          />
        )}
        {mode === 'bimetal' && <Readout label="خمش" value={fmt((dT / 100) * 31.5)} unit="درجه" />}
        {mode === 'ballring' && (
          <Legend color="#f97316" label="شعلهٔ گرم‌کننده" />
        )}
        <Legend color="#eab308" label="برنج (α بزرگ‌تر)" />
        <Legend color="#94a3b8" label="آهن (α کوچک‌تر)" />
      </div>
      {mode === 'ballring' && <p role="status" className="min-h-5 text-sm">{status}</p>}
    </SimFrame>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// u4-heat · «آمیختن آب گرم و سرد»
// ─────────────────────────────────────────────────────────────────────────────
function U4HeatSim() {
  const [m1, setM1] = useState(1)
  const [t1, setT1] = useState(80)
  const [m2, setM2] = useState(2)
  const [t2, setT2] = useState(20)
  const [guess, setGuess] = useState('')
  const [phase, setPhase] = useState<'setup' | 'mixed'>('setup')
  const [result, setResult] = useState<{ tf: number; q: number } | null>(null)
  const [banner, setBanner] = useState<Banner | null>(null)
  const [status, setStatus] = useState('')
  const tRef = useRef(0)
  const pourRef = useRef(0)
  const reduced = useReducedMotion()
  const winBeep = useWinBeep()

  const mix = () => {
    const tf = (m1 * t1 + m2 * t2) / (m1 + m2)
    const q = 4200 * Math.min(m1, m2 === m1 ? m1 : m1) * Math.abs(tf - t1)
    const qv = 4200 * m1 * Math.abs(tf - t1)
    setResult({ tf, q: Math.abs(qv) })
    setPhase('mixed')
    pourRef.current = reduced ? 1 : 0
    const g = parseFloat(guess.replace(',', '.'))
    if (Number.isFinite(g) && Math.abs(g - tf) <= 1) {
      winBeep()
      setBanner({ text: 'پیش‌بینی دقیق! آفرین', until: tRef.current + 3 })
      setStatus(`پیش‌بینی دقیق! حدس تو ${fmt(g)} °C و دمای واقعی ${fmt(tf)} °C بود (اختلاف کمتر از ۱ درجه).`)
    } else if (Number.isFinite(g)) {
      setStatus(`دمای تعادل ${fmt(tf)} °C شد؛ حدس تو ${fmt(g)} بود. جرم بزرگ‌تر دما را به سمت خودش کشید.`)
    } else {
      setStatus(`دمای تعادل ${fmt(tf)} °C است؛ دفعهٔ بعد قبل از ریختن، حدست را در کادر بنویس.`)
    }
  }

  const reset = () => {
    setPhase('setup')
    setResult(null)
    setStatus('')
    setGuess('')
    pourRef.current = 0
  }

  const { canvasRef } = useSimCanvas((ctx, w, h, t, dt) => {
    tRef.current = t
    ctx.clearRect(0, 0, w, h)
    ctx.fillStyle = CANVAS.bg
    ctx.fillRect(0, 0, w, h)

    const gy = h - 64 // glass bottom
    const gh = 190
    if (phase === 'mixed' && !reduced) pourRef.current = Math.min(1, pourRef.current + dt * 0.9)
    const pour = pourRef.current

    const drawGlass = (x: number, mass: number, temp: number, label: string, retain: number) => {
      const gw = 104
      const fill = clamp(mass / 3, 0.12, 1) * (gh - 30) * retain
      // glass body
      ctx.fillStyle = 'rgba(255,255,255,0.05)'
      rr(ctx, x, gy - gh, gw, gh, 10)
      ctx.fill()
      ctx.strokeStyle = 'rgba(250,250,249,0.3)'
      ctx.lineWidth = 2
      ctx.stroke()
      // water
      const col = waterColor(temp)
      ctx.fillStyle = col
      ctx.globalAlpha = 0.85
      rr(ctx, x + 5, gy - 8 - fill, gw - 10, fill, 6)
      ctx.fill()
      ctx.globalAlpha = 1
      // wave line
      ctx.strokeStyle = col
      ctx.lineWidth = 2
      ctx.beginPath()
      for (let i = 0; i <= gw - 10; i += 4) {
        const yv = gy - 8 - fill + Math.sin(i / 9 + t * 2) * 2
        i === 0 ? ctx.moveTo(x + 5 + i, yv) : ctx.lineTo(x + 5 + i, yv)
      }
      ctx.stroke()
      faText(ctx, label, x + gw / 2, gy + 22, { size: 11, color: CANVAS.muted })
      faText(ctx, `${fmt(mass)} kg · ${fmt(temp)} °C`, x + gw / 2, gy - gh - 14, { bold: true, size: 12, color: col })
    }

    const x1 = w * 0.16
    const x2 = w * 0.62
    const x3 = w * 0.38
    const g3w = 130
    if (phase === 'mixed' && result) {
      drawGlass(x1, m1, t1, 'لیوان ۱ (گرم‌تر؟)', 1 - 0.85 * pour)
      drawGlass(x2, m2, t2, 'لیوان ۲', 1 - 0.85 * pour)
      // streams
      if (pour < 0.92) {
        ctx.strokeStyle = waterColor(t1)
        ctx.lineWidth = 5
        ctx.globalAlpha = 0.8
        ctx.beginPath()
        ctx.moveTo(x1 + 52, gy - 20)
        ctx.quadraticCurveTo(x3 + 30, gy - 140, x3 + 55, gy - 8 - clamp((m1 + m2) / 3.5, 0.15, 1) * 150)
        ctx.stroke()
        ctx.strokeStyle = waterColor(t2)
        ctx.beginPath()
        ctx.moveTo(x2 + 52, gy - 20)
        ctx.quadraticCurveTo(x3 + 100, gy - 140, x3 + 75, gy - 8 - clamp((m1 + m2) / 3.5, 0.15, 1) * 150)
        ctx.stroke()
        ctx.globalAlpha = 1
      }
      // third glass
      const fill = clamp((m1 + m2) / 3.5, 0.15, 1) * (gh - 20) * pour
      ctx.fillStyle = 'rgba(255,255,255,0.06)'
      rr(ctx, x3, gy - gh - 10, g3w, gh + 10, 12)
      ctx.fill()
      ctx.strokeStyle = 'rgba(250,250,249,0.4)'
      ctx.lineWidth = 2.5
      ctx.stroke()
      ctx.fillStyle = waterColor(result.tf)
      ctx.globalAlpha = 0.9
      rr(ctx, x3 + 6, gy - 8 - fill, g3w - 12, fill, 8)
      ctx.fill()
      ctx.globalAlpha = 1
      faText(ctx, `مخلوط: ${fmt(m1 + m2)} kg · ${fmt(result.tf)} °C`, x3 + g3w / 2, gy - gh - 26, { bold: true, size: 13, color: waterColor(result.tf) })

      // equal Q bars
      const bw = 120
      const bh = 14
      const by = 46
      const qh = clamp(result.q / 400000, 0.08, 1) * bw
      ctx.fillStyle = 'rgba(239,68,68,0.85)'
      rr(ctx, w / 2 - bw - 30, by, qh, bh, 6)
      ctx.fill()
      faText(ctx, 'گرمای داده‌شده (آب گرم)', w / 2 - bw - 30 + qh / 2, by + bh / 2, { size: 10, color: '#ffffff' })
      ctx.fillStyle = 'rgba(20,184,166,0.9)'
      rr(ctx, w / 2 + 30, by, qh, bh, 6)
      ctx.fill()
      faText(ctx, 'گرمای گرفته‌شده (آب سرد)', w / 2 + 30 + qh / 2, by + bh / 2, { size: 10, color: '#ffffff' })
      faText(ctx, `${fmt(result.q / 1000)} kJ = ${fmt(result.q / 1000)} kJ  (برابر!)`, w / 2, by + 34, { size: 11, bold: true, color: CANVAS.emerald })
    } else {
      drawGlass(x1, m1, t1, 'لیوان ۱', 1)
      drawGlass(x2, m2, t2, 'لیوان ۲', 1)
      faText(ctx, 'اول حدست را بنویس، بعد «بریز روی هم» را بزن!', w / 2, 40, { size: 12, color: CANVAS.muted })
    }
    if (banner && t < banner.until) drawWinBanner(ctx, w, banner.text)
  }, 430)

  return (
    <SimFrame
      title="آمیختن آب گرم و سرد"
      brief="جرم و دمای دو لیوان را تنظیم کن، دمای تعادل را پیش‌بینی کن و بعد بریز روی هم — ببین چقدر دقیق حدس می‌زنی."
    >
      <div className="overflow-hidden rounded-lg border">
        <canvas ref={canvasRef} className="block w-full" aria-label="دو لیوان آب با دما و جرم تنظیمی و لیوان مخلوط" />
      </div>
      <div className="flex flex-wrap items-center gap-3">
        <SimSlider label="جرم لیوان ۱" value={m1} min={0.5} max={3} step={0.1} onChange={setM1} format={(v) => `${fmt(v)} kg`} disabled={phase === 'mixed'} className="min-w-[150px] flex-1" />
        <SimSlider label="دمای لیوان ۱" value={t1} min={0} max={90} step={1} onChange={setT1} format={(v) => `${fmt(v)} °C`} disabled={phase === 'mixed'} className="min-w-[150px] flex-1" />
        <SimSlider label="جرم لیوان ۲" value={m2} min={0.5} max={3} step={0.1} onChange={setM2} format={(v) => `${fmt(v)} kg`} disabled={phase === 'mixed'} className="min-w-[150px] flex-1" />
        <SimSlider label="دمای لیوان ۲" value={t2} min={0} max={90} step={1} onChange={setT2} format={(v) => `${fmt(v)} °C`} disabled={phase === 'mixed'} className="min-w-[150px] flex-1" />
      </div>
      <div className="flex flex-wrap items-center gap-3 rounded-lg border border-dashed p-3">
        <span className="text-sm font-semibold">پیش‌بینی T_f (°C):</span>
        <input
          aria-label="پیش‌بینی دمای تعادل بر حسب درجهٔ سلسیوس"
          inputMode="decimal"
          value={guess}
          onChange={(e) => setGuess(e.target.value)}
          placeholder="?"
          disabled={phase === 'mixed'}
          className="w-24 rounded-md border bg-transparent px-2 py-1 text-center font-mono text-sm"
        />
        <SimButton onClick={mix} disabled={phase === 'mixed'}>بریز روی هم</SimButton>
        <SimButton variant="outline" onClick={reset} disabled={phase === 'setup'}>از نو</SimButton>
      </div>
      <p role="status" className="min-h-5 text-sm">{status}</p>
      {result && (
        <div className="flex flex-wrap items-center gap-3">
          <Readout label="دمای تعادل" value={fmt(result.tf)} unit="°C" />
          <Readout label="Q جابه‌جاشده" value={fmt(result.q / 1000)} unit="kJ" />
          <span className="text-xs text-muted-foreground">گرمای داده‌شده = گرمای گرفته‌شده — فرمول: T_f = (m₁T₁ + m₂T₂)/(m₁ + m₂)</span>
        </div>
      )}
    </SimFrame>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// u4-phase-change · «منحنی گرمایش یخ»
// ─────────────────────────────────────────────────────────────────────────────
const PC_SEGS = [
  { q: 42000, T0: -20, T1: 0, name: 'گرم‌شدن یخ' },
  { q: 340000, T0: 0, T1: 0, name: 'ذوب در 0 °C' },
  { q: 420000, T0: 0, T1: 100, name: 'گرم‌شدن آب' },
  { q: 2300000, T0: 100, T1: 100, name: 'جوش در 100 °C' },
  { q: 40000, T0: 100, T1: 120, name: 'گرم‌شدن بخار' },
]
const PC_TOTAL = PC_SEGS.reduce((s, g) => s + g.q, 0)

function pcState(q: number) {
  let acc = 0
  for (const g of PC_SEGS) {
    if (q < acc + g.q) {
      const f = (q - acc) / g.q
      return { name: g.name, T: lerp(g.T0, g.T1, f), frac: f, segStart: acc, seg: g }
    }
    acc += g.q
  }
  const last = PC_SEGS[PC_SEGS.length - 1]
  return { name: last.name, T: last.T1, frac: 1, segStart: PC_TOTAL - last.q, seg: last }
}

function U4PhaseChangeSim() {
  const [heating, setHeating] = useState(false)
  const [rate, setRate] = useState(1500)
  const [banner, setBanner] = useState<Banner | null>(null)
  const qRef = useRef(0)
  const doneRef = useRef(false)
  const tRef = useRef(0)
  const reduced = useReducedMotion()
  const winBeep = useWinBeep()
  const st = pcState(qRef.current)

  const nextStage = () => {
    const cur = pcState(qRef.current)
    const target = Math.min(PC_TOTAL, cur.segStart + cur.seg.q)
    qRef.current = Math.max(target, qRef.current + (target - qRef.current === 0 ? cur.seg.q / 2 : 0))
  }

  const { canvasRef } = useSimCanvas((ctx, w, h, t, dt) => {
    tRef.current = t
    if (heating && !reduced) {
      qRef.current = Math.min(PC_TOTAL, qRef.current + rate * dt)
      if (qRef.current >= PC_TOTAL && !doneRef.current) {
        doneRef.current = true
        setHeating(false)
        winBeep()
        setBanner({ text: 'همهٔ یخ به بخار ۱۲۰ درجه تبدیل شد!', until: t + 3 })
      }
    }
    const q = qRef.current
    const s = pcState(q)

    ctx.clearRect(0, 0, w, h)
    ctx.fillStyle = CANVAS.bg
    ctx.fillRect(0, 0, w, h)

    // ── graph (left ~62%) ──
    const gx = 56
    const gy = 52
    const gw = w * 0.56
    const gh = h - 128
    gridRegion(ctx, gx, gy, gw, gh, 34)
    const qx = (q0: number) => gx + (q0 / PC_TOTAL) * gw
    const ty = (T: number) => gy + gh - ((T + 30) / 160) * gh

    // axes
    ctx.strokeStyle = 'rgba(168,162,158,0.5)'
    ctx.lineWidth = 1.5
    ctx.beginPath()
    ctx.moveTo(gx, gy)
    ctx.lineTo(gx, gy + gh)
    ctx.lineTo(gx + gw, gy + gh)
    ctx.stroke()
    ctx.font = '700 10px ui-monospace, Menlo, monospace'
    ctx.fillStyle = CANVAS.muted
    ctx.textAlign = 'right'
    for (const T of [-20, 0, 50, 100, 120]) {
      ctx.fillText(String(T), gx - 6, ty(T))
    }
    ctx.textAlign = 'center'
    for (const [q0, lab] of [[42000, '42'], [382000, '382'], [802000, '802'], [3102000, '3102'], [3142000, '3142']] as const) {
      ctx.fillText(lab, qx(q0), gy + gh + 16)
    }
    faText(ctx, 'دما (°C)', gx - 34, gy - 22, { size: 11, color: CANVAS.muted })
    faText(ctx, 'انرژی تجمعی (kJ) از 0 تا 3142', gx + gw / 2, gy + gh + 34, { size: 11, color: CANVAS.muted })

    // heating curve
    ctx.strokeStyle = CANVAS.amber
    ctx.lineWidth = 2.5
    ctx.beginPath()
    ctx.moveTo(qx(0), ty(-20))
    for (const g of PC_SEGS) {
      const start = qx(pcState(0).segStart) // unused; compute cumulatives inline
      void start
      break
    }
    let acc = 0
    ctx.moveTo(qx(0), ty(-20))
    for (const g of PC_SEGS) {
      ctx.lineTo(qx(acc + g.q), ty(g.T1))
      acc += g.q
    }
    ctx.stroke()

    // plateau labels + cumulative Q
    faText(ctx, 'فلات ذوب (0 °C)', qx(210000), ty(0) - 14, { size: 10, color: CANVAS.teal })
    faText(ctx, 'فلات جوش (100 °C)', qx(1950000), ty(100) - 14, { size: 10, color: CANVAS.teal })
    ctx.font = '700 9px ui-monospace, Menlo, monospace'
    ctx.fillStyle = CANVAS.muted
    ctx.textAlign = 'center'
    for (const [q0, y] of [[42000, ty(0)], [382000, ty(0)], [802000, ty(100)], [3102000, ty(100)]] as const) {
      ctx.fillText(`${Math.round(q0 / 1000)} kJ`, qx(q0), y + 14)
    }

    // moving point
    const px = qx(q)
    const py = ty(s.T)
    ctx.setLineDash([4, 4])
    ctx.strokeStyle = 'rgba(244,63,94,0.5)'
    ctx.lineWidth = 1
    ctx.beginPath()
    ctx.moveTo(gx, py)
    ctx.lineTo(px, py)
    ctx.lineTo(px, gy + gh)
    ctx.stroke()
    ctx.setLineDash([])
    ctx.fillStyle = CANVAS.rose
    ctx.beginPath()
    ctx.arc(px, py, 6, 0, Math.PI * 2)
    ctx.fill()
    ctx.strokeStyle = '#ffffff'
    ctx.lineWidth = 1.5
    ctx.stroke()

    // ── scene (right) ──
    const sx = w * 0.72
    const potW = Math.min(150, w * 0.24)
    const potX = sx - potW / 2
    const potY = h - 150
    const potH = 100
    // pot body
    ctx.fillStyle = 'rgba(255,255,255,0.05)'
    rr(ctx, potX, potY, potW, potH, 10)
    ctx.fill()
    ctx.strokeStyle = 'rgba(250,250,249,0.35)'
    ctx.lineWidth = 2
    ctx.stroke()
    // contents
    const inner = { x: potX + 8, w: potW - 16, y: potY + 8, h: potH - 16 }
    if (s.name.startsWith('گرم‌شدن یخ')) {
      ctx.fillStyle = '#e2e8f0'
      for (let i = 0; i < 5; i++) {
        const bx0 = inner.x + 8 + (i % 3) * 40
        const by0 = inner.y + inner.h - 30 + Math.floor(i / 3) * 16
        rr(ctx, bx0, by0, 30, 14, 4)
        ctx.fill()
      }
    } else if (s.name === 'ذوب در 0 °C') {
      const wl = inner.h * (0.3 + 0.7 * s.frac)
      ctx.fillStyle = 'rgba(56,189,248,0.8)'
      rr(ctx, inner.x, inner.y + inner.h - wl, inner.w, wl, 6)
      ctx.fill()
      ctx.fillStyle = '#e2e8f0'
      ctx.globalAlpha = 1 - s.frac
      for (let i = 0; i < 3; i++) {
        rr(ctx, inner.x + 14 + i * 38, inner.y + inner.h - wl - 12, 26, 12, 4)
        ctx.fill()
      }
      ctx.globalAlpha = 1
    } else if (s.name === 'گرم‌شدن آب') {
      ctx.fillStyle = waterColor(s.T)
      rr(ctx, inner.x, inner.y + 4, inner.w, inner.h - 4, 6)
      ctx.fill()
      // bubbles grow with T
      ctx.strokeStyle = 'rgba(255,255,255,0.5)'
      for (let i = 0; i < 4; i++) {
        const yy = inner.y + inner.h - ((t * 30 + i * 25) % (inner.h - 10))
        ctx.beginPath()
        ctx.arc(inner.x + 20 + i * 28, yy, 1.5 + (s.T / 100) * 2.5, 0, Math.PI * 2)
        ctx.stroke()
      }
    } else if (s.name === 'جوش در 100 °C') {
      ctx.fillStyle = 'rgba(56,189,248,0.8)'
      rr(ctx, inner.x, inner.y + 4, inner.w, inner.h - 4, 6)
      ctx.fill()
      ctx.strokeStyle = 'rgba(255,255,255,0.7)'
      for (let i = 0; i < 7; i++) {
        const yy = inner.y + inner.h - ((t * 90 + i * 22) % (inner.h + 24))
        ctx.beginPath()
        ctx.arc(inner.x + 12 + i * 18, yy, 2.5 + (i % 3), 0, Math.PI * 2)
        ctx.stroke()
      }
    } else {
      ctx.fillStyle = 'rgba(56,189,248,0.25)'
      rr(ctx, inner.x, inner.y + inner.h - 14, inner.w, 10, 4)
      ctx.fill()
      ctx.strokeStyle = 'rgba(250,250,249,0.6)'
      ctx.lineWidth = 2
      for (let i = 0; i < 3; i++) {
        ctx.beginPath()
        for (let yy = 0; yy <= 60; yy += 4) {
          const xx = inner.x + 30 + i * 30 + Math.sin(yy / 9 + t * 3 + i) * 7
          yy === 0 ? ctx.moveTo(xx, inner.y - 6 - yy) : ctx.lineTo(xx, inner.y - 6 - yy)
        }
        ctx.stroke()
      }
    }
    flame(ctx, potX + potW / 2, potY + potH + 26, heating ? 1.2 : 0, t, heating && !reduced)
    faText(ctx, `مرحله: ${s.name}`, sx, potY - 58, { bold: true, size: 12, color: CANVAS.amber })
    faText(ctx, `T = ${fmt(s.T)} °C · Q = ${fmt(q / 1000)} kJ`, sx, potY - 38, { size: 11, color: CANVAS.muted })

    if (banner && t < banner.until) drawWinBanner(ctx, w, banner.text)
  }, 430)

  return (
    <SimFrame
      title="منحنی گرمایش یخ"
      brief="۱ کیلوگرم یخِ −20 درجه را گرم کن: دو فلات را ببین (ذوب در 0 و جوش در 100) و صحنهٔ ظرف را هم‌زمان دنبال کن."
    >
      <div className="overflow-hidden rounded-lg border">
        <canvas ref={canvasRef} className="block w-full" aria-label="نمودار دما بر حسب انرژی برای گرم شدن یخ تا بخار همراه با صحنهٔ ظرف" />
      </div>
      <div className="flex flex-wrap items-center gap-3">
        {!reduced ? (
          <SimButton variant={heating ? 'destructive' : 'default'} onClick={() => { setHeating(!heating); doneRef.current = qRef.current >= PC_TOTAL }}>
            {heating ? 'توقف گرما‌دادن' : 'شروع گرما‌دادن'}
          </SimButton>
        ) : (
          <SimButton variant="secondary" onClick={nextStage}>مرحلهٔ بعد</SimButton>
        )}
        <SimSlider
          label="نرخ گرما‌دادن"
          value={rate}
          min={500}
          max={5000}
          step={100}
          onChange={setRate}
          format={(v) => `${fmt(v / 1000)} kJ/s`}
          disabled={reduced}
          className="min-w-[170px] flex-1"
        />
        <SimButton variant="outline" onClick={() => { qRef.current = 0; doneRef.current = false; setHeating(false) }}>
          بازنشانی
        </SimButton>
      </div>
      <div className="flex flex-wrap items-center gap-3">
        <Readout label="مرحله" value={st.name} />
        <Readout label="دما" value={fmt(st.T)} unit="°C" />
        <Readout label="Q مصرفی" value={fmt(qRef.current / 1000)} unit="kJ" />
        <Legend color="#f43f5e" label="نقطهٔ حالت روی منحنی" />
        <Legend color="#f59e0b" label="منحنی گرمایش" />
      </div>
      <p role="status" className="min-h-5 text-sm">
        {qRef.current >= PC_TOTAL ? 'تمام شد! یخ از −20 °C تا بخار 120 °C کامل شد؛ مجموع گرما حدود 3142 kJ بود.' : ''}
      </p>
    </SimFrame>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// u4-transfer · «سه راه گرم و سرد»
// ─────────────────────────────────────────────────────────────────────────────
function U4TransferSim() {
  const [mode, setMode] = useState<'cond' | 'conv' | 'rad'>('cond')
  const [flameOn, setFlameOn] = useState(true)
  const [showWhite, setShowWhite] = useState(true)
  const [dist, setDist] = useState(40)
  const meltRef = useRef(0)
  const woodRef = useRef(0)
  const convRef = useRef<{ s: number }[] | null>(null)
  const reduced = useReducedMotion()

  const resetCond = () => {
    meltRef.current = 0
    woodRef.current = 0
  }

  const { canvasRef } = useSimCanvas((ctx, w, h, t, dt) => {
    ctx.clearRect(0, 0, w, h)
    ctx.fillStyle = CANVAS.bg
    ctx.fillRect(0, 0, w, h)

    if (mode === 'cond') {
      const x0 = 60
      const rw = w - 120
      const ry = 150
      if (flameOn && !reduced) {
        meltRef.current = Math.min(1, meltRef.current + dt / 5)
        woodRef.current = Math.min(0.15, woodRef.current + dt / 60)
      }
      const mid = x0 + rw / 2
      // metal half
      ctx.fillStyle = '#b8c0cc'
      rr(ctx, x0, ry, rw / 2, 18, 4)
      ctx.fill()
      ctx.strokeStyle = 'rgba(0,0,0,0.4)'
      ctx.stroke()
      // wood half
      ctx.fillStyle = '#8a5a2b'
      rr(ctx, mid, ry, rw / 2, 18, 4)
      ctx.fill()
      ctx.stroke()
      faText(ctx, 'نیمهٔ فلزی — رسانا', x0 + rw / 4, ry - 14, { size: 11, color: CANVAS.muted })
      faText(ctx, 'نیمهٔ چوبی — عایق', mid + rw / 4, ry - 14, { size: 11, color: CANVAS.muted })
      // temperature profile bar
      const barY = ry + 34
      const n = 60
      for (let i = 0; i < n; i++) {
        const f = i / n
        const xT = x0 + f * rw
        const isMetal = xT < mid
        const fm = f / 0.5
        const T = isMetal ? lerp(100, 30, fm) : lerp(100, 24, fm * fm * fm)
        ctx.fillStyle = tempColor(clamp(T, -60, 120))
        ctx.fillRect(xT, barY, rw / n + 0.5, 8)
      }
      faText(ctx, 'نوار دما در طول میله (گرم ← سرد)', x0 + rw / 2, barY + 20, { size: 10, color: CANVAS.muted })
      // wax balls
      const drawBall = (bx: number, melt: number, label: string) => {
        const r = 12
        const squash = 1 + melt * 1.6
        ctx.fillStyle = '#fde68a'
        ctx.beginPath()
        ctx.ellipse(bx, ry + 44, r * squash, r * (1 - melt * 0.6), 0, 0, Math.PI * 2)
        ctx.fill()
        ctx.strokeStyle = 'rgba(0,0,0,0.35)'
        ctx.stroke()
        faText(ctx, label, bx, ry + 78, { size: 10, color: melt >= 1 ? CANVAS.rose : CANVAS.muted })
      }
      drawBall(mid - 6, meltRef.current, meltRef.current >= 1 ? 'ذوب شد!' : 'موم روی فلز')
      drawBall(w - 66, woodRef.current, woodRef.current >= 0.149 ? 'تقریباً هیچ' : 'موم روی چوب')
      flame(ctx, x0 + 16, ry + 58, flameOn ? 1.2 : 0, t, flameOn)
      faText(ctx, flameOn ? 'شعله زیر سرِ فلزی — موم فلزی زودتر ذوب می‌شود' : 'شعله خاموش — «روشن» را بزن', x0 + rw / 2, h - 26, { size: 11, color: CANVAS.muted })
    }

    if (mode === 'conv') {
      const cx = w * 0.42
      const bw0 = Math.min(240, w * 0.36)
      const bh0 = 220
      const bx0 = cx - bw0 / 2
      const by0 = 70
      if (!convRef.current) {
        convRef.current = Array.from({ length: 16 }, (_, i) => ({ s: i / 16 }))
      }
      for (const p of convRef.current) {
        if (flameOn && !reduced) p.s = (p.s + dt * 0.09) % 1
      }
      // container
      ctx.fillStyle = 'rgba(56,189,248,0.08)'
      rr(ctx, bx0, by0, bw0, bh0, 12)
      ctx.fill()
      ctx.strokeStyle = 'rgba(250,250,249,0.35)'
      ctx.lineWidth = 2
      ctx.stroke()
      // particles along a loop: up the middle, across top, down the sides, along bottom
      const pos = (s: number) => {
        const p = s * 4
        if (p < 1) return { x: cx, y: by0 + bh0 - 20 - p * (bh0 - 40) }
        if (p < 2) return { x: cx + ((p - 1) * (bw0 / 2 - 22)), y: by0 + 20 }
        if (p < 3) return { x: bx0 + bw0 - 22, y: by0 + 20 + (p - 2) * (bh0 - 40) }
        if (p < 4) return { x: bx0 + bw0 / 2 - ((p - 3) * (bw0 / 2 - 22)), y: by0 + bh0 - 20 }
        return { x: cx, y: by0 + bh0 - 20 }
      }
      for (const p of convRef.current) {
        const q = pos(p.s)
        const cold = (q.y - by0) / bh0
        ctx.fillStyle = ramp([[0, 239, 68, 68], [0.5, 234, 179, 8], [1, 56, 189, 248]], 1 - cold)
        ctx.beginPath()
        ctx.arc(q.x, q.y, 4.5, 0, Math.PI * 2)
        ctx.fill()
      }
      // arrows
      ctx.strokeStyle = 'rgba(239,68,68,0.8)'
      ctx.lineWidth = 2.5
      ctx.beginPath()
      ctx.moveTo(cx, by0 + bh0 - 40)
      ctx.lineTo(cx, by0 + 46)
      ctx.stroke()
      ctx.fillStyle = 'rgba(239,68,68,0.9)'
      ctx.beginPath()
      ctx.moveTo(cx - 6, by0 + 52)
      ctx.lineTo(cx + 6, by0 + 52)
      ctx.lineTo(cx, by0 + 40)
      ctx.closePath()
      ctx.fill()
      ctx.strokeStyle = 'rgba(56,189,248,0.85)'
      ctx.beginPath()
      ctx.moveTo(bx0 + 22, by0 + 40)
      ctx.lineTo(bx0 + 22, by0 + bh0 - 40)
      ctx.stroke()
      faText(ctx, 'آب گرم بالا', cx + 46, by0 + 60, { size: 11, color: CANVAS.rose })
      faText(ctx, 'آب سرد پایین', bx0 + 60, by0 + bh0 - 46, { size: 11, color: '#38bdf8' })
      flame(ctx, cx, by0 + bh0 + 28, flameOn ? 1.2 : 0, t, flameOn)
      faText(ctx, flameOn ? 'شعله زیر ظرف — جریان گردشی همرفتی' : 'شعله خاموش — ذرات بی‌حرکت', cx, by0 + bh0 + 52, { size: 11, color: CANVAS.muted })
      faText(ctx, 'همرفت فقط در شاره‌ها ممکن است', w - 28, h - 26, { size: 11, color: CANVAS.muted, align: 'right' })
    }

    if (mode === 'rad') {
      const lampX = 120
      const lampY = 74
      // lamp
      ctx.fillStyle = CANVAS.orange
      ctx.beginPath()
      ctx.arc(lampX, lampY, 16, 0, Math.PI * 2)
      ctx.fill()
      ctx.fillStyle = 'rgba(249,115,22,0.25)'
      ctx.beginPath()
      ctx.arc(lampX, lampY, 28, 0, Math.PI * 2)
      ctx.fill()
      faText(ctx, 'لامپ گرمایی', lampX, lampY - 34, { size: 11, color: CANVAS.muted })
      // plates
      const plateY = h - 150
      const plateX = lampX + 60 + dist * 2.1
      const drawPlate = (px: number, black: boolean) => {
        const e = clamp(2600 / (dist * dist), 0, 1)
        const barH = clamp(e * (black ? 1 : 0.18) * 90, 3, 92)
        ctx.fillStyle = black ? '#0c0a09' : '#f5f5f4'
        rr(ctx, px, plateY, 58, 84, 6)
        ctx.fill()
        ctx.strokeStyle = 'rgba(250,250,249,0.4)'
        ctx.lineWidth = 1.5
        ctx.stroke()
        faText(ctx, black ? 'سیاه مات' : 'سفید براق', px + 29, plateY + 98, { size: 11, color: CANVAS.muted })
        // energy bar
        ctx.fillStyle = 'rgba(255,255,255,0.08)'
        rr(ctx, px + 12, plateY - 108, 22, 100, 4)
        ctx.fill()
        ctx.fillStyle = black ? CANVAS.orange : CANVAS.yellow
        rr(ctx, px + 12, plateY - 8 - barH, 22, barH, 4)
        ctx.fill()
        faText(ctx, black ? `${fmt(e * 100)}٪` : `${fmt(e * 18)}٪`, px + 40, plateY - 108 + 8, { size: 10, color: CANVAS.muted, align: 'left' })
        // rays
        const rays = 5
        for (let i = 0; i < rays; i++) {
          const y0 = lampY - 20 + i * 10
          ctx.strokeStyle = `rgba(249,115,22,${clamp(120 / (dist * dist) + 0.06, 0.06, 0.6)})`
          ctx.lineWidth = 1.5
          ctx.beginPath()
          ctx.moveTo(lampX + 20, lampY)
          ctx.lineTo(px - 4, plateY + 10 + i * 14)
          ctx.stroke()
          void y0
        }
      }
      drawPlate(plateX, true)
      if (showWhite) drawPlate(plateX + 84, false)
      faText(ctx, `فاصله: ${fmt(dist)} cm — جذب ∝ 1/d²`, w - 28, 40, { size: 12, bold: true, color: CANVAS.amber, align: 'right' })
      faText(ctx, 'سیاه مات جذب بیشتر، سفید براق بازتاب بیشتر', w - 28, h - 26, { size: 11, color: CANVAS.muted, align: 'right' })
    }
  }, 420)

  return (
    <SimFrame
      title="سه راه گرم و سرد"
      brief="رسانایی، همرفت و تابش را یکی‌یکی امتحان کن — هر راه قوانین خودش را دارد."
    >
      <div className="overflow-hidden rounded-lg border">
        <canvas ref={canvasRef} className="block w-full" aria-label="آزمایش سه روش انتقال گرما" />
      </div>
      <div className="flex flex-wrap items-center gap-3">
        <SimSelect
          label="روش"
          value={mode}
          onChange={(v) => setMode(v)}
          options={[
            { value: 'cond', label: 'رسانایی' },
            { value: 'conv', label: 'همرفت' },
            { value: 'rad', label: 'تابش' },
          ]}
        />
        {mode !== 'rad' && <SimToggle label="شعله" checked={flameOn} onChange={setFlameOn} />}
        {mode === 'rad' && (
          <>
            <SimSlider label="فاصلهٔ صفحه" value={dist} min={20} max={100} step={1} onChange={setDist} format={(v) => `${fmt(v)} cm`} className="min-w-[170px] flex-1" />
            <SimToggle label="نمایش صفحهٔ سفید" checked={showWhite} onChange={setShowWhite} />
          </>
        )}
        {mode === 'cond' && <SimButton variant="outline" onClick={resetCond}>ذوب موم از نو</SimButton>}
      </div>
      <div className="flex flex-wrap items-center gap-3">
        <Legend color="#b8c0cc" label="فلز (رسانا)" />
        <Legend color="#8a5a2b" label="چوب (عایق)" />
        <Legend color="#f43f5e" label="ذرهٔ گرم" />
        <Legend color="#38bdf8" label="ذرهٔ سرد" />
      </div>
    </SimFrame>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// u4-gas-laws · «پیستون گاز» (u4-review هم از همین استفاده می‌کند)
// ─────────────────────────────────────────────────────────────────────────────
interface GasP {
  x: number
  y: number
  vx: number
  vy: number
}
function initParts(): GasP[] {
  const arr: GasP[] = []
  let seed = 7
  const rnd = () => {
    seed = (seed * 16807) % 2147483647
    return seed / 2147483647
  }
  for (let i = 0; i < 40; i++) {
    arr.push({ x: 0.05 + rnd() * 0.9, y: 0.05 + rnd() * 0.9, vx: 0.22 + rnd() * 0.5, vy: 0.22 + rnd() * 0.5 })
  }
  return arr
}

function gasGeom(w: number) {
  return { x0: 70, x1: Math.max(320, w * 0.5), top: 84, bot: 306 }
}
function pistonFace(v: number, g: { x0: number; x1: number }) {
  return g.x0 + 46 + ((clamp(v, 2, 10) - 2) / 8) * (g.x1 - g.x0 - 92)
}

function U4GasLawsSim() {
  const [mode, setMode] = useState<'boyle' | 'charles' | 'gay' | 'free'>('boyle')
  const [T, setT] = useState(300)
  const [V, setV] = useState(6)
  const [p0, setP0] = useState(60) // charles: fixed pressure
  const [v0, setV0] = useState(6) // gay-lussac: fixed volume
  const [chal, setChal] = useState<{ v: number; input: string; state: 'ask' | 'right' | 'wrong' } | null>(null)
  const [banner, setBanner] = useState<Banner | null>(null)
  const [status, setStatus] = useState('')
  const tRef = useRef(0)
  const vDispRef = useRef(6)
  const partsRef = useRef<GasP[] | null>(null)
  const draggingRef = useRef(false)
  const trailRef = useRef<[number, number][]>([])
  const reduced = useReducedMotion()
  const winBeep = useWinBeep()

  const Veff = mode === 'charles' ? clamp(T / p0, 2, 10) : mode === 'gay' ? v0 : V
  const P = T / Veff // kPa  (k = 1 kPa·L/K)

  const changeMode = (m: 'boyle' | 'charles' | 'gay' | 'free') => {
    setMode(m)
    if (m === 'boyle') setT(300)
    if (m === 'charles') setP0(clamp(T / V, 20, 200))
    if (m === 'gay') setV0(V)
    setChal(null)
    setStatus('')
  }

  const startPredict = () => {
    setChal({ v: Math.round((2.5 + Math.random() * 6.5) * 10) / 10, input: '', state: 'ask' })
    setStatus('')
  }
  const checkPredict = () => {
    if (!chal) return
    const p2 = 300 / chal.v
    const val = parseFloat(chal.input.replace(',', '.'))
    if (Number.isFinite(val) && Math.abs(val - p2) <= p2 * 0.02) {
      winBeep()
      setChal({ ...chal, state: 'right' })
      setBanner({ text: 'پیش‌بینی درست! قانون بویل دستت شد', until: tRef.current + 3 })
      setStatus(`درست است! P₂ = P₁V₁/V₂ = ${fmt(p2)} kPa برای حجم ${fmt(chal.v)} لیتر (T ثابت = 300 K).`)
    } else {
      setChal({ ...chal, state: 'wrong' })
      setStatus(`نه این‌بار. P₂ = P₁V₁/V₂ = 300/${fmt(chal.v)} = ${fmt(p2)} kPa؛ حجم کمتر ⇒ فشار بیشتر.`)
    }
  }

  const { canvasRef } = useSimCanvas((ctx, w, h, t, dt) => {
    tRef.current = t
    ctx.clearRect(0, 0, w, h)
    ctx.fillStyle = CANVAS.bg
    ctx.fillRect(0, 0, w, h)

    const g = gasGeom(w)
    const k = reduced || draggingRef.current ? 1 : Math.min(1, dt * 6)
    vDispRef.current += (Veff - vDispRef.current) * k
    const faceX = pistonFace(vDispRef.current, g)
    const gasL = g.x0 + 8
    const gasR = faceX - 10
    const gasW = Math.max(46, gasR - gasL)
    const gasH = g.bot - g.top - 8

    // cylinder body
    ctx.fillStyle = 'rgba(255,255,255,0.04)'
    rr(ctx, g.x0, g.top, g.x1 - g.x0, g.bot - g.top, 10)
    ctx.fill()
    ctx.strokeStyle = 'rgba(250,250,249,0.3)'
    ctx.lineWidth = 2
    ctx.stroke()
    // gas tint by temperature
    ctx.fillStyle = tempColor(T)
    ctx.globalAlpha = 0.14
    ctx.fillRect(gasL, g.top + 4, gasW, g.bot - g.top - 8)
    ctx.globalAlpha = 1

    // particles
    if (!partsRef.current) partsRef.current = initParts()
    const parts = partsRef.current
    if (!reduced) {
      const sp = Math.sqrt(T / 300)
      for (const p of parts) {
        p.x += p.vx * sp * dt
        p.y += p.vy * sp * dt
        if (p.x < 0.02) { p.x = 0.02; p.vx = Math.abs(p.vx) }
        if (p.x > 0.98) { p.x = 0.98; p.vx = -Math.abs(p.vx) }
        if (p.y < 0.04) { p.y = 0.04; p.vy = Math.abs(p.vy) }
        if (p.y > 0.96) { p.y = 0.96; p.vy = -Math.abs(p.vy) }
      }
    }
    ctx.fillStyle = '#fbbf24'
    for (const p of parts) {
      const x = gasL + p.x * gasW
      const y = g.top + 4 + p.y * gasH
      ctx.beginPath()
      ctx.arc(x, y, 3, 0, Math.PI * 2)
      ctx.fill()
    }

    // piston
    ctx.fillStyle = '#78716c'
    rr(ctx, faceX, g.top + 2, 10, g.bot - g.top - 4, 3)
    ctx.fill()
    ctx.strokeStyle = draggingRef.current ? CANVAS.amber : 'rgba(250,250,249,0.5)'
    ctx.lineWidth = 2
    ctx.stroke()
    ctx.strokeStyle = 'rgba(250,250,249,0.4)'
    ctx.beginPath()
    ctx.moveTo(faceX + 5, g.top)
    ctx.lineTo(faceX + 5, g.top - 22)
    ctx.stroke()
    faText(ctx, 'پیستون (درگ کن)', faceX + 14, g.top - 26, { size: 10, color: CANVAS.muted, align: 'left' })

    // live values under cylinder
    faText(ctx, `P = ${fmt(P)} kPa`, g.x0 + 60, g.bot + 26, { bold: true, size: 12, color: CANVAS.rose })
    faText(ctx, `V = ${fmt(Veff)} L`, g.x0 + 190, g.bot + 26, { bold: true, size: 12, color: CANVAS.teal })
    faText(ctx, `T = ${fmt(T)} K`, g.x0 + 300, g.bot + 26, { bold: true, size: 12, color: CANVAS.orange })

    // ── P–V graph ──
    const gx = w * 0.56
    const gy = 40
    const gw = w * 0.38
    const gh = h - 150
    gridRegion(ctx, gx, gy, gw, gh, 30)
    ctx.strokeStyle = 'rgba(168,162,158,0.5)'
    ctx.lineWidth = 1.5
    ctx.beginPath()
    ctx.moveTo(gx, gy)
    ctx.lineTo(gx, gy + gh)
    ctx.lineTo(gx + gw, gy + gh)
    ctx.stroke()
    const vx0 = (v: number) => gx + ((v - 2) / 8) * gw
    const py0 = (p: number) => gy + gh - (clamp(p, 0, 310) / 310) * gh
    // isotherm for current T
    ctx.setLineDash([5, 4])
    ctx.strokeStyle = 'rgba(148,163,184,0.6)'
    ctx.lineWidth = 1.5
    ctx.beginPath()
    for (let i = 0; i <= 40; i++) {
      const v = 2 + (i / 40) * 8
      const p = T / v
      const x = vx0(v)
      const y = py0(p)
      i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y)
    }
    ctx.stroke()
    ctx.setLineDash([])
    // process trail
    const trail = trailRef.current
    const last = trail[trail.length - 1]
    if (!last || Math.abs(last[0] - Veff) + Math.abs(last[1] - P) > 0.12) {
      trail.push([Veff, P])
      if (trail.length > 90) trail.shift()
    }
    ctx.strokeStyle = CANVAS.amber
    ctx.lineWidth = 2
    ctx.beginPath()
    for (let i = 0; i < trail.length; i++) {
      const [tv, tp] = trail[i]
      i === 0 ? ctx.moveTo(vx0(tv), py0(tp)) : ctx.lineTo(vx0(tv), py0(tp))
    }
    ctx.stroke()
    ctx.fillStyle = CANVAS.rose
    ctx.beginPath()
    ctx.arc(vx0(Veff), py0(P), 5, 0, Math.PI * 2)
    ctx.fill()
    faText(ctx, 'نمودار P–V و مسیر فرایند', gx + gw / 2, gy + gh + 20, { size: 11, color: CANVAS.muted })
    faText(ctx, 'V (لیتر)', gx + gw / 2, gy + gh + 38, { size: 10, color: CANVAS.muted })
    faText(ctx, 'P (kPa)', gx - 6, gy - 14, { size: 10, color: CANVAS.muted, align: 'left' })

    if (banner && t < banner.until) drawWinBanner(ctx, w, banner.text)
  }, 430)

  const onDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (mode !== 'boyle' && mode !== 'free') return
    const canvas = e.currentTarget
    const pos = canvasPos(e, canvas)
    const g = gasGeom(canvas.clientWidth)
    const faceX = pistonFace(Veff, g)
    if (Math.abs(pos.x - faceX) < 30 && pos.y > g.top - 20 && pos.y < g.bot + 20) {
      draggingRef.current = true
      canvas.setPointerCapture(e.pointerId)
    }
  }
  const onMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!draggingRef.current) return
    const canvas = e.currentTarget
    const pos = canvasPos(e, canvas)
    const g = gasGeom(canvas.clientWidth)
    const v = 2 + ((pos.x - (g.x0 + 46)) / (g.x1 - g.x0 - 92)) * 8
    setV(clamp(Number.isFinite(v) ? v : V, 2, 10))
  }
  const onUp = (e: React.PointerEvent<HTMLCanvasElement>) => {
    draggingRef.current = false
    if (e.currentTarget.hasPointerCapture(e.pointerId)) e.currentTarget.releasePointerCapture(e.pointerId)
  }

  return (
    <SimFrame
      title="پیستون گاز"
      brief="حالت آزمایش را انتخاب کن و یکی از کمیت‌ها را تغییر بده؛ بقیه طبق قانون گازها واکنش نشان می‌دهند."
    >
      <div className="overflow-hidden rounded-lg border">
        <canvas
          ref={canvasRef}
          className="block w-full"
          style={{ touchAction: 'none' }}
          aria-label="استوانهٔ گاز با ذره‌ها، پیستون متحرک و نمودار فشار-حجم"
          onPointerDown={onDown}
          onPointerMove={onMove}
          onPointerUp={onUp}
          onPointerCancel={onUp}
        />
      </div>
      <div className="flex flex-wrap items-center gap-3">
        <SimSelect
          label="حالت آزمایش"
          value={mode}
          onChange={changeMode}
          options={[
            { value: 'boyle', label: 'بویل — T ثابت' },
            { value: 'charles', label: 'شارل — P ثابت' },
            { value: 'gay', label: 'گیلوساک — V ثابت' },
            { value: 'free', label: 'آزاد' },
          ]}
        />
        {(mode === 'boyle' || mode === 'free') && (
          <SimSlider label="حجم" value={V} min={2} max={10} step={0.1} onChange={setV} format={(v) => `${fmt(v)} L`} className="min-w-[170px] flex-1" />
        )}
        {(mode === 'charles' || mode === 'gay' || mode === 'free') && (
          <SimSlider label="دما" value={T} min={150} max={600} step={1} onChange={setT} format={(v) => `${fmt(v)} K`} className="min-w-[170px] flex-1" />
        )}
        <SimButton variant="outline" onClick={() => { setT(300); setV(6); setP0(60); setV0(6); setChal(null); trailRef.current = []; setStatus('') }}>
          بازنشانی
        </SimButton>
      </div>
      <div className="flex flex-wrap items-center gap-3">
        <Readout label="فشار" value={fmt(P)} unit="kPa" tone="text-rose-500" />
        <Readout label="حجم" value={fmt(Veff)} unit="L" tone="text-teal-500" />
        <Readout label="دما" value={fmt(T)} unit="K" tone="text-orange-500" />
        <Legend color="#fbbf24" label="ذره‌های گاز (سرعت ∝ √T)" />
        <Legend color="#f59e0b" label="مسیر فرایند" />
      </div>
      {mode === 'boyle' && (
        <div className="flex flex-wrap items-center gap-3 rounded-lg border border-dashed p-3">
          <SimButton variant="secondary" onClick={startPredict}>پیش‌بینی کن</SimButton>
          {chal && chal.state === 'ask' && (
            <>
              <span className="text-sm font-semibold">
                در دمای ثابت 300 K، حجم را به {faDigits(chal.v)} لیتر برسان؛ P₂ چند kPa می‌شود؟
              </span>
              <input
                aria-label="حدس فشار دوم بر حسب کیلوپاسکال"
                inputMode="decimal"
                value={chal.input}
                onChange={(e) => setChal({ ...chal, input: e.target.value })}
                onKeyDown={(e) => e.key === 'Enter' && checkPredict()}
                placeholder="?"
                className="w-24 rounded-md border bg-transparent px-2 py-1 text-center font-mono text-sm"
              />
              <SimButton onClick={checkPredict}>بررسی</SimButton>
            </>
          )}
        </div>
      )}
      <p role="status" className="min-h-5 text-sm">{status}</p>
    </SimFrame>
  )
}

// ─── registry ────────────────────────────────────────────────────────────────
export const simsCh4: Record<string, SimComponent> = {
  'u4-temperature': U4TemperatureSim,
  'u4-expansion': U4ExpansionSim,
  'u4-heat': U4HeatSim,
  'u4-phase-change': U4PhaseChangeSim,
  'u4-transfer': U4TransferSim,
  'u4-gas-laws': U4GasLawsSim,
}
