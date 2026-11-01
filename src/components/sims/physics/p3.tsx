// ─── فیزیک‌دهم · فصل ۳ widgets «کار، انرژی و توان» ────────────────────────────
// Task 3-c owns this file. Seven canvas sims (u3-review reuses u3-conservation).
// Helpers are chapter-local (faText/rr/fmt) — do not import them elsewhere.
'use client'

import { useEffect, useRef, useState } from 'react'
import {
  CANVAS,
  SimButton,
  SimFrame,
  SimSlider,
  SimToggle,
  Readout,
  Legend,
  useSimCanvas,
  useSimBeep,
  useReducedMotion,
  canvasPos,
  drawGrid,
} from '@/components/sims/sim-kit'
import type { SimComponent } from '@/lib/game/types'

const G = 10

const FONT_MONO = '700 13px ui-monospace, SFMono-Regular, Menlo, monospace'

/** Format a number for canvas/HTML readouts — never NaN/Infinity. */
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

function arrow(
  ctx: CanvasRenderingContext2D,
  x1: number, y1: number, x2: number, y2: number,
  color: string, width = 2.5,
) {
  const len = Math.hypot(x2 - x1, y2 - y1)
  if (len < 8 || !Number.isFinite(len)) return
  const ang = Math.atan2(y2 - y1, x2 - x1)
  ctx.strokeStyle = color
  ctx.fillStyle = color
  ctx.lineWidth = width
  ctx.lineCap = 'round'
  ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.stroke()
  ctx.beginPath()
  ctx.moveTo(x2, y2)
  ctx.lineTo(x2 - 8 * Math.cos(ang - 0.42), y2 - 8 * Math.sin(ang - 0.42))
  ctx.lineTo(x2 - 8 * Math.cos(ang + 0.42), y2 - 8 * Math.sin(ang + 0.42))
  ctx.closePath(); ctx.fill()
}

/** Horizontal energy bar with RTL label above-right and mono value inside-left. */
function drawBar(
  ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number,
  frac: number, color: string, label: string, val: string,
) {
  const f = Math.max(0, Math.min(1, Number.isFinite(frac) ? frac : 0))
  ctx.fillStyle = 'rgba(250,250,249,0.07)'
  rr(ctx, x, y, w, h, Math.min(7, h / 2)); ctx.fill()
  if (f > 0.005) {
    ctx.fillStyle = color
    rr(ctx, x, y, Math.max(h * 0.8, w * f), h, Math.min(7, h / 2)); ctx.fill()
  }
  if (label) faText(ctx, label, x + w - 4, y - 9, { align: 'right', size: 10, color: CANVAS.muted })
  if (val) {
    ctx.save()
    ctx.direction = 'rtl'
    ctx.font = FONT_MONO
    ctx.fillStyle = CANVAS.fg
    ctx.textAlign = 'left'
    ctx.textBaseline = 'middle'
    ctx.fillText(val, x + 6, y + h / 2 + 0.5)
    ctx.restore()
  }
}

/** Rounded result banner (green win / amber info) with bold white Persian text. */
function drawBanner(
  ctx: CanvasRenderingContext2D, w: number, y: number, text: string, tone: 'win' | 'info',
) {
  const bw = Math.min(350, w - 28)
  const bx = (w - bw) / 2
  ctx.fillStyle = tone === 'win' ? 'rgba(16,185,129,0.95)' : 'rgba(245,158,11,0.95)'
  rr(ctx, bx, y, bw, 32, 9); ctx.fill()
  faText(ctx, text, w / 2, y + 16, { bold: true, size: 13, color: '#ffffff' })
}

/** Two-tone win chirp (respects the game's sound setting). */
function useWinBeep(): () => void {
  const beep = useSimBeep()
  return () => {
    beep(660, 120)
    if (typeof window !== 'undefined') window.setTimeout(() => beep(880, 160), 150)
  }
}

function drawGround(ctx: CanvasRenderingContext2D, w: number, y: number) {
  ctx.strokeStyle = CANVAS.muted
  ctx.lineWidth = 2
  ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(w, y); ctx.stroke()
  ctx.strokeStyle = 'rgba(168,162,158,0.35)'
  ctx.lineWidth = 1.5
  for (let x = 8; x < w; x += 26) {
    ctx.beginPath(); ctx.moveTo(x, y + 2); ctx.lineTo(x - 8, y + 12); ctx.stroke()
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// u3-kinetic · «آزمایشگاه انرژی جنبشی» — road, cart & fixed brake
// ─────────────────────────────────────────────────────────────────────────────
const F_BRAKE = 200      // N, fixed brake force
const BRAKE_AT = 32      // m, brake marker position
const ROAD_M = 52        // m of visible road
const KE_MAX = 0.5 * 10 * 20 * 20 // 2000 J scale for the bar

function U3KineticSim() {
  const [mass, setMass] = useState(2)
  const [speed, setSpeed] = useState(6)
  const [challenge, setChallenge] = useState(false)
  const [status, setStatus] = useState('جرم و سرعت گاری را تنظیم کن و «حالت پیش‌روی» را بزن.')
  const winBeep = useWinBeep()
  const reduced = useReducedMotion()
  const anim = useRef({ phase: 'idle' as 'idle' | 'cruise' | 'brake' | 'stop', pos: 0, v: 0, measured: 0 })
  const solvedRef = useRef(false)

  const ke = 0.5 * mass * speed * speed
  const dStop = ke / F_BRAKE

  // challenge: tune cart so KE = 100 J (±2)
  useEffect(() => {
    if (!solvedRef.current && Math.abs(ke - 100) <= 2) {
      solvedRef.current = true
      setChallenge(true)
      setStatus('چالش حل شد! KE ≈ 100 J — حالا مسافت ترمز را با سرعت کم‌تر مقایسه کن.')
      winBeep()
    }
  }, [ke, winBeep])

  const start = () => {
    if (speed <= 0) {
      anim.current = { phase: 'idle', pos: 0, v: 0, measured: 0 }
      setStatus('سرعت صفر یعنی انرژی جنبشی صفر — گاری اصلاً حرکت نمی‌کند!')
      return
    }
    if (reduced) {
      anim.current = { phase: 'stop', pos: BRAKE_AT + dStop, v: 0, measured: dStop }
      setStatus(`نتیجهٔ فوری: توقف پس از ${fmt(dStop)} m — این اثر v² است.`)
    } else {
      anim.current = { phase: 'cruise', pos: 0, v: speed, measured: 0 }
      setStatus('در حال حرکت… به نشانگر ترمز نگاه کن.')
    }
  }

  const { canvasRef } = useSimCanvas((ctx, w, h, _t, dt) => {
    ctx.clearRect(0, 0, w, h)
    ctx.fillStyle = CANVAS.bg
    ctx.fillRect(0, 0, w, h)
    drawGrid(ctx, w, h, 44)

    const a = anim.current
    if (!reduced) {
      if (a.phase === 'cruise') {
        a.pos += a.v * dt
        if (a.pos >= BRAKE_AT) { a.pos = BRAKE_AT; a.phase = 'brake' }
      } else if (a.phase === 'brake') {
        a.v = Math.max(0, a.v - (F_BRAKE / Math.max(0.5, mass)) * dt)
        a.pos += a.v * dt
        if (a.v <= 0.001) {
          a.v = 0
          a.phase = 'stop'
          a.measured = Math.max(0, a.pos - BRAKE_AT)
          setStatus(`توقف پس از ${fmt(a.measured)} m — دو برابر سرعت یعنی چهار برابر این مسافت!`)
        }
      }
    }

    const groundY = h - 58
    const px = (w - 48) / ROAD_M
    const cartX = 28 + a.pos * px

    // road
    ctx.fillStyle = CANVAS.panel
    ctx.fillRect(0, groundY + 10, w, 26)
    ctx.fillStyle = 'rgba(250,250,249,0.22)'
    for (let x = 6; x < w; x += 34) ctx.fillRect(x, groundY + 22, 18, 3)
    drawGround(ctx, w, groundY + 10)

    // brake marker (fixed block)
    const bx = 28 + BRAKE_AT * px
    ctx.fillStyle = CANVAS.orange
    rr(ctx, bx - 5, groundY - 20, 10, 32, 2); ctx.fill()
    faText(ctx, 'ترمز ثابت', bx, groundY - 32, { size: 10, color: CANVAS.orange })

    // predicted stop marker
    const sx = 28 + Math.min(ROAD_M, BRAKE_AT + dStop) * px
    ctx.strokeStyle = CANVAS.amber
    ctx.lineWidth = 1.5
    ctx.setLineDash([4, 4])
    ctx.beginPath(); ctx.moveTo(sx, groundY - 6); ctx.lineTo(sx, groundY + 40); ctx.stroke()
    ctx.setLineDash([])
    faText(ctx, `توقف پیش‌بینی: ${fmt(dStop)} m`, Math.min(w - 70, sx + 62), groundY + 50, { size: 10, color: CANVAS.amber })

    // skid trail while braking
    if (a.pos > BRAKE_AT) {
      ctx.strokeStyle = 'rgba(244,63,94,0.55)'
      ctx.lineWidth = 4
      ctx.beginPath(); ctx.moveTo(bx, groundY + 5); ctx.lineTo(cartX, groundY + 5); ctx.stroke()
    }

    // cart
    const cartY = groundY - 14
    ctx.fillStyle = CANVAS.teal
    rr(ctx, cartX - 26, cartY - 26, 52, 24, 6); ctx.fill()
    ctx.fillStyle = '#0f172a'
    for (const wx of [-15, 15]) {
      ctx.beginPath(); ctx.arc(cartX + wx, cartY + 1, 6, 0, Math.PI * 2); ctx.fill()
    }
    faText(ctx, `${fmt(mass)} kg`, cartX, cartY - 14, { size: 10, bold: true, color: '#0f172a' })

    // speed arrow
    const vNow = a.phase === 'cruise' || a.phase === 'brake' ? a.v : a.phase === 'idle' ? speed : 0
    if (vNow > 0.2) {
      arrow(ctx, cartX, cartY - 38, Math.min(w - 16, cartX + vNow * 2.4), cartY - 38, CANVAS.amber, 2.5)
      faText(ctx, `${fmt(vNow)} m/s`, cartX + 20, cartY - 50, { size: 10, color: CANVAS.amber })
    }

    // energy bar
    drawBar(ctx, 16, 18, w - 32, 18, ke / KE_MAX, CANVAS.amber, 'انرژی جنبشی', `${fmt(ke)} J`)

    if (a.phase === 'stop') drawBanner(ctx, w, h - 116, `توقف پس از ${fmt(a.measured)} m`, 'info')
    if (challenge) drawBanner(ctx, w, h - 78, 'چالش: انرژی جنبشی = 100 J ✓', 'win')
  }, 400)

  return (
    <SimFrame
      title="آزمایشگاه انرژی جنبشی"
      brief="گاری را با جرم و سرعت دلخواه رها کن؛ ترمز ثابت 200 N نشان می‌دهد چرا سرعت، مسافت توقف را به توان دو بزرگ می‌کند."
    >
      <div className="overflow-hidden rounded-lg border">
        <canvas ref={canvasRef} className="block w-full" style={{ touchAction: 'none' }} aria-label="آزمایشگاه انرژی جنبشی: گاری، ترمز و نوار انرژی" />
      </div>
      <div className="flex flex-wrap items-center gap-3">
        <SimSlider label="جرم گاری" value={mass} min={1} max={10} step={0.5} unit="kg" onChange={setMass} format={fmt} className="min-w-[150px] flex-1" />
        <SimSlider label="سرعت اولیه" value={speed} min={0} max={20} step={0.5} unit="m/s" onChange={setSpeed} format={fmt} className="min-w-[150px] flex-1" />
        <SimButton onClick={start}>حالت پیش‌روی</SimButton>
      </div>
      <div className="flex flex-wrap items-center gap-3">
        <Readout label="انرژی جنبشی" value={fmt(ke)} unit="J" />
        <Readout label="مسافت توقف" value={fmt(dStop)} unit="m" />
        <Legend color={CANVAS.amber} label="نوار انرژی جنبشی" />
        <Legend color={CANVAS.orange} label="ترمز ثابت 200 N" />
      </div>
      <p role="status" className="text-xs text-muted-foreground">{status}</p>
    </SimFrame>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// u3-work · «نیمکت کار و زاویه» — rope angle, force decomposition & work meter
// ─────────────────────────────────────────────────────────────────────────────
const W_PX_PER_M = 42
const W_FLOOR = 322
const W_BOX_X0 = 70
const W_BOX_W = 64
const W_BOX_H = 44

function U3WorkSim() {
  const [theta, setTheta] = useState(60)
  const [force, setForce] = useState(100)
  const [dist, setDist] = useState(3)
  const [running, setRunning] = useState(false)
  const [done, setDone] = useState(false)
  const [challenge, setChallenge] = useState(false)
  const [status, setStatus] = useState('زاویهٔ طناب را با درگ دسته تنظیم کن، بعد «انجام بده» را بزن.')
  const winBeep = useWinBeep()
  const reduced = useReducedMotion()
  const anim = useRef({ p: 0, running: false })
  const dragging = useRef(false)
  const solvedRef = useRef(false)

  const rad = (theta * Math.PI) / 180
  const fx = force * Math.cos(rad)
  const fy = force * Math.sin(rad)
  const work = fx * dist
  const wScale = 200 * 6 // max |W| = 1200 J

  useEffect(() => {
    if (!solvedRef.current && Math.abs(work - 120) <= 3) {
      solvedRef.current = true
      setChallenge(true)
      setStatus('چالش حل شد: کار 120 J ساختی! مثلاً 60 N هم‌جهت در 2 m یا 80 N با زاویهٔ 60° در 3 m.')
      winBeep()
    }
  }, [work, winBeep])

  const run = () => {
    if (reduced) {
      anim.current = { p: 1, running: false }
      setDone(true)
      setRunning(false)
      setStatus(`کار انجام شد: W = ${fmt(work)} J`)
    } else {
      anim.current = { p: 0, running: true }
      setDone(false)
      setRunning(true)
      setStatus('جعبه در حال لغزش است…')
    }
  }

  const { canvasRef } = useSimCanvas((ctx, w, h, _t, dt) => {
    ctx.clearRect(0, 0, w, h)
    ctx.fillStyle = CANVAS.bg
    ctx.fillRect(0, 0, w, h)
    drawGrid(ctx, w, h, 44)

    const a = anim.current
    if (a.running) {
      a.p += dt / 1.4
      if (a.p >= 1) {
        a.p = 1
        a.running = false
        setRunning(false)
        setDone(true)
        setStatus(`کار انجام شد: W = ${fmt(work)} J`)
      }
    }

    drawGround(ctx, w, W_FLOOR)
    const boxX = W_BOX_X0 + a.p * dist * W_PX_PER_M
    const boxTopY = W_FLOOR - W_BOX_H
    const bx = boxX + W_BOX_W / 2
    const by = boxTopY

    // skid marks
    if (a.p > 0.02) {
      ctx.strokeStyle = 'rgba(168,162,158,0.4)'
      ctx.lineWidth = 3
      ctx.beginPath(); ctx.moveTo(W_BOX_X0 + 8, W_FLOOR + 5); ctx.lineTo(bx - 8, W_FLOOR + 5); ctx.stroke()
    }

    // rope + handle (angle draggable)
    const ropeLen = 96
    const hx = bx + Math.cos(rad) * ropeLen
    const hy = by - Math.sin(rad) * ropeLen
    ctx.strokeStyle = 'rgba(214,211,209,0.85)'
    ctx.lineWidth = 2
    ctx.beginPath(); ctx.moveTo(bx, by); ctx.lineTo(hx, hy); ctx.stroke()
    ctx.fillStyle = CANVAS.white
    ctx.beginPath(); ctx.arc(hx, hy, 6, 0, Math.PI * 2); ctx.fill()
    if (force > 0.5) {
      arrow(ctx, bx, by, hx, hy, CANVAS.amber, 2.5)
      faText(ctx, `F = ${fmt(force)} N`, hx + Math.cos(rad) * 24, hy - Math.sin(rad) * 24 - 10, { size: 11, color: CANVAS.amber })
    }

    // angle arc
    if (theta > 2 && theta < 178) {
      ctx.strokeStyle = CANVAS.violet
      ctx.lineWidth = 1.5
      ctx.beginPath(); ctx.arc(bx, by, 26, -rad, 0); ctx.stroke()
      faText(ctx, `${fmt(theta)}°`, bx + Math.cos(rad / 2) * 40, by - Math.sin(rad / 2) * 40, { size: 10, color: CANVAS.violet })
    }

    // decomposition arrows from box top
    const vs = 0.42
    if (Math.abs(fx) > 1) {
      arrow(ctx, bx, by, bx + fx * vs, by, CANVAS.emerald, 2.5)
      faText(ctx, `Fx = ${fmt(fx)} N`, bx + fx * vs / 2, by + 14, { size: 10, color: CANVAS.emerald })
    }
    if (Math.abs(fy) > 1) {
      arrow(ctx, bx, by, bx, by - fy * vs, 'rgba(168,162,158,0.9)', 2.5)
      faText(ctx, `Fy = ${fmt(fy)} N`, bx + 34, by - fy * vs / 2, { size: 10, color: CANVAS.muted })
    }

    // box
    ctx.fillStyle = CANVAS.teal
    rr(ctx, boxX, boxTopY, W_BOX_W, W_BOX_H, 6); ctx.fill()
    faText(ctx, 'جعبه', bx, boxTopY + W_BOX_H / 2, { size: 11, bold: true, color: '#0f172a' })

    // live work label while sliding
    if (a.running || a.p >= 1) {
      faText(ctx, `کار شمرده‌شده: ${fmt(work * a.p)} J`, w / 2, W_FLOOR - 58, { size: 12, bold: true, color: CANVAS.fg })
    }
    if (Math.abs(fx) < 1) {
      faText(ctx, 'نمایش آموزشی: نیروی عمود کار صفر دارد؛ جعبه فقط برای مقایسه می‌لغزد.', w / 2, W_FLOOR - 34, { size: 10, color: CANVAS.muted })
    }

    // work meter
    const wColor = work > 0.5 ? CANVAS.emerald : Math.abs(work) <= 0.5 ? 'rgba(168,162,158,0.8)' : CANVAS.red
    drawBar(ctx, 16, h - 44, w - 32, 16, Math.abs(work) / wScale, wColor, 'کار W (مثبت سبز / صفر خاکستری / منفی قرمز)', `${fmt(work)} J`)

    if (done && !challenge) drawBanner(ctx, w, 14, `کار انجام شد: W = ${fmt(work)} J`, 'info')
    if (challenge) drawBanner(ctx, w, 14, 'چالش: کارِ 120 J ساخته شد ✓', 'win')
  }, 400)

  const updateThetaFromPointer = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current
    if (!canvas || anim.current.running) return
    const { x, y } = canvasPos(e, canvas)
    const curX = W_BOX_X0 + anim.current.p * dist * W_PX_PER_M + W_BOX_W / 2
    const dx = x - curX
    const dy = (W_FLOOR - W_BOX_H) - y
    const ang = (Math.atan2(dy, dx) * 180) / Math.PI
    if (Math.hypot(dx, dy) < 18) return
    const t = Math.max(0, Math.min(180, ang))
    setTheta(Math.round(t / 5) * 5)
  }

  return (
    <SimFrame
      title="نیمکت کار و زاویه"
      brief="طناب را با درگ دسته کج و راست کن؛ فقط مؤلفهٔ موازی جابه‌جایی (Fx) در کار شرکت می‌کند."
    >
      <div className="overflow-hidden rounded-lg border">
        <canvas
          ref={canvasRef}
          className="block w-full"
          style={{ touchAction: 'none' }}
          aria-label="نیمکت کار و زاویه: جعبه، طناب زاویه‌دار و شمارندهٔ کار"
          onPointerDown={(e) => {
            e.currentTarget.setPointerCapture(e.pointerId)
            dragging.current = true
            updateThetaFromPointer(e)
          }}
          onPointerMove={(e) => { if (dragging.current) updateThetaFromPointer(e) }}
          onPointerUp={(e) => {
            dragging.current = false
            try { e.currentTarget.releasePointerCapture(e.pointerId) } catch { /* not captured */ }
          }}
          onPointerCancel={() => { dragging.current = false }}
        />
      </div>
      <div className="flex flex-wrap items-center gap-3">
        <SimSlider label="زاویهٔ طناب θ" value={theta} min={0} max={180} step={5} unit="°" onChange={setTheta} format={(v) => `${fmt(v)}°`} className="min-w-[150px] flex-1" />
        <SimSlider label="نیرو" value={force} min={0} max={200} step={5} unit="N" onChange={setForce} format={fmt} className="min-w-[150px] flex-1" />
        <SimSlider label="جابه‌جایی" value={dist} min={0} max={6} step={0.5} unit="m" onChange={setDist} format={fmt} className="min-w-[150px] flex-1" />
        <SimButton onClick={run} disabled={running}>انجام بده</SimButton>
      </div>
      <div className="flex flex-wrap items-center gap-3">
        <Readout label="Fx موازی سطح" value={fmt(fx)} unit="N" />
        <Readout label="Fy عمود" value={fmt(fy)} unit="N" />
        <Readout label="کار W" value={fmt(work)} unit="J" />
        <Legend color={CANVAS.emerald} label="Fx کار مثبت" />
        <Legend color="rgba(168,162,158,0.9)" label="Fy بی‌کار" />
      </div>
      <p role="status" className="text-xs text-muted-foreground">{status}</p>
    </SimFrame>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// u3-work-ke · «پیست نظریهٔ کار–انرژی» — mirrored work bars that must match ΔKE
// ─────────────────────────────────────────────────────────────────────────────
const WKE_W_SCALE = 1000 // max |W| = F·d = 100 N · 10 m

function U3WorkKeSim() {
  const [mass, setMass] = useState(2)
  const [force, setForce] = useState(40)
  const [dPush, setDPush] = useState(5)
  const [frictionOn, setFrictionOn] = useState(false)
  const [fFric, setFFric] = useState(10)
  const [running, setRunning] = useState(false)
  const [done, setDone] = useState(false)
  const [status, setStatus] = useState('نیرو و مسافت را تنظیم کن؛ نوارهای W_net و ΔKE باید برابر تمام شوند!')
  const reduced = useReducedMotion()
  const anim = useRef({ el: 0, dur: 1, running: false })

  const fNet = force - (frictionOn ? fFric : 0)
  const wPush = force * dPush
  const wFric = frictionOn ? -fFric * dPush : 0
  const wNet = Math.max(0, fNet) * dPush
  const vFinal = Math.max(0, fNet) > 0 ? Math.sqrt((2 * wNet) / Math.max(0.5, mass)) : 0

  const run = () => {
    if (fNet <= 0) {
      setStatus('نیروی خالص صفر یا منفی است — گاری از جا تکان نمی‌خورد!')
      anim.current = { el: 0, dur: 1, running: false }
      setRunning(false)
      setDone(false)
      return
    }
    if (reduced) {
      anim.current = { el: 1, dur: 1, running: false }
      setRunning(false)
      setDone(true)
      setStatus(`نتیجهٔ فوری: W_net = ΔKE = ${fmt(wNet)} J و v = ${fmt(vFinal)} m/s`)
    } else {
      const tEst = Math.sqrt((2 * dPush * mass) / fNet)
      anim.current = { el: 0, dur: Math.min(2.2, Math.max(0.9, tEst)), running: true }
      setRunning(true)
      setDone(false)
      setStatus('گاری در حال شتاب‌گیری است…')
    }
  }

  const { canvasRef } = useSimCanvas((ctx, w, h, _t, dt) => {
    ctx.clearRect(0, 0, w, h)
    ctx.fillStyle = CANVAS.bg
    ctx.fillRect(0, 0, w, h)
    drawGrid(ctx, w, h, 44)

    const a = anim.current
    if (a.running) {
      a.el += dt
      if (a.el >= a.dur) {
        a.el = a.dur
        a.running = false
        setRunning(false)
        setDone(true)
        setStatus(`W_net = ΔKE = ${fmt(wNet)} J برابر شدند ✓ — v = ${fmt(vFinal)} m/s`)
      }
    }
    const p = Math.min(1, a.el / a.dur)
    const pos = dPush * p * p // constant-accel shape (x ∝ t²)
    const vNow = fNet > 0 ? Math.sqrt((2 * fNet * pos) / Math.max(0.5, mass)) : 0

    // work bars (live)
    const curPush = force * pos
    const curFric = (frictionOn ? fFric : 0) * pos
    const curNet = Math.max(0, fNet) * pos
    drawBar(ctx, 16, 18, w - 32, 16, curPush / WKE_W_SCALE, CANVAS.emerald, 'W_push (کار هل‌دادن)', `${fmt(curPush)} J`)
    drawBar(ctx, 16, 50, w - 32, 16, curFric / WKE_W_SCALE, CANVAS.red, 'W_friction (کار اصطکاک، منفی)', `−${fmt(curFric)} J`)
    drawBar(ctx, 16, 82, w - 32, 16, curNet / WKE_W_SCALE, CANVAS.amber, 'W_net و ΔKE (باید برابر شوند)', `${fmt(curNet)} J`)
    // ΔKE marker on the push bar
    const mx = 16 + (w - 32) * Math.min(1, curNet / WKE_W_SCALE)
    ctx.strokeStyle = 'rgba(250,250,249,0.85)'
    ctx.lineWidth = 1.5
    ctx.setLineDash([3, 3])
    ctx.beginPath(); ctx.moveTo(mx, 12); ctx.lineTo(mx, 38); ctx.stroke()
    ctx.setLineDash([])
    faText(ctx, 'ΔKE', mx, 8, { size: 9, color: CANVAS.fg })

    // track
    const trackY = 210
    drawGround(ctx, w, trackY)
    const x0 = 46
    const px = (w - 130) / Math.max(0.5, dPush)
    // start & finish flags
    ctx.strokeStyle = CANVAS.muted
    ctx.lineWidth = 2
    ctx.beginPath(); ctx.moveTo(x0, trackY - 4); ctx.lineTo(x0, trackY - 34); ctx.stroke()
    const finX = x0 + dPush * px
    ctx.strokeStyle = CANVAS.amber
    ctx.beginPath(); ctx.moveTo(finX, trackY - 4); ctx.lineTo(finX, trackY - 34); ctx.stroke()
    faText(ctx, 'پایان هل', finX, trackY - 42, { size: 10, color: CANVAS.amber })

    // cart
    const cartX = x0 + pos * px
    ctx.fillStyle = CANVAS.teal
    rr(ctx, cartX - 24, trackY - 40, 48, 22, 6); ctx.fill()
    ctx.fillStyle = '#0f172a'
    for (const wx of [-13, 13]) {
      ctx.beginPath(); ctx.arc(cartX + wx, trackY - 16, 5.5, 0, Math.PI * 2); ctx.fill()
    }
    faText(ctx, `${fmt(mass)} kg`, cartX, trackY - 29, { size: 10, bold: true, color: '#0f172a' })
    if (vNow > 0.2) {
      arrow(ctx, cartX, trackY - 54, Math.min(finX + 10, cartX + vNow * 1.6), trackY - 54, CANVAS.amber, 2.5)
      faText(ctx, `${fmt(vNow)} m/s`, cartX + 24, trackY - 66, { size: 10, color: CANVAS.amber })
    }

    // energy identity note
    faText(ctx, 'آزمون درستی: W_push + W_friction = W_net = ΔKE', w / 2, 250, { size: 11, color: CANVAS.muted })
    if (fNet <= 0) {
      faText(ctx, 'نیروی خالص صفر یا منفی است؛ برای حرکت، F را از اصطکاک بزرگ‌تر کن.', w / 2, 276, { size: 11, color: CANVAS.orange })
    }
    if (done) drawBanner(ctx, w, h - 60, `سرعت نهایی: v = ${fmt(vFinal)} m/s`, 'win')
  }, 300)

  return (
    <SimFrame
      title="پیست نظریهٔ کار–انرژی"
      brief="هل بده، اصطکاک را روشن کن و ببین چطور نوارهای کار سرانجام با ΔKE برابر می‌شوند."
    >
      <div className="overflow-hidden rounded-lg border">
        <canvas ref={canvasRef} className="block w-full" style={{ touchAction: 'none' }} aria-label="پیست نظریهٔ کار و انرژی: گاری و نوارهای کار" />
      </div>
      <div className="flex flex-wrap items-center gap-3">
        <SimSlider label="جرم گاری" value={mass} min={1} max={10} step={0.5} unit="kg" onChange={setMass} format={fmt} className="min-w-[140px] flex-1" />
        <SimSlider label="نیروی هل‌دادن" value={force} min={0} max={100} step={5} unit="N" onChange={setForce} format={fmt} className="min-w-[140px] flex-1" />
        <SimSlider label="فاصلهٔ هل" value={dPush} min={0.5} max={10} step={0.5} unit="m" onChange={setDPush} format={fmt} className="min-w-[140px] flex-1" />
      </div>
      <div className="flex flex-wrap items-center gap-3">
        <SimToggle label="اصطکاک" checked={frictionOn} onChange={setFrictionOn} />
        <SimSlider label="نیروی اصطکاک f" value={fFric} min={0} max={50} step={5} unit="N" onChange={setFFric} format={fmt} disabled={!frictionOn} className="min-w-[140px] flex-1" />
        <SimButton onClick={run} disabled={running}>اجرا</SimButton>
        <Readout label="W_net" value={fmt(wNet)} unit="J" />
        <Readout label="v نهایی" value={fmt(vFinal)} unit="m/s" />
      </div>
      <div className="flex flex-wrap items-center gap-3">
        <Legend color={CANVAS.emerald} label="W_push" />
        <Legend color={CANVAS.red} label="W_friction" />
        <Legend color={CANVAS.amber} label="W_net = ΔKE" />
      </div>
      <p role="status" className="text-xs text-muted-foreground">{status}</p>
    </SimFrame>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// u3-pe · «جرثقیل و تبدیل انرژی» — lift, release, PE⇄KE with constant sum
// ─────────────────────────────────────────────────────────────────────────────
function U3PeSim() {
  const [mass, setMass] = useState(2)
  const [height, setHeight] = useState(5)
  const [phase, setPhase] = useState<'idle' | 'lift' | 'top' | 'fall' | 'hit'>('idle')
  const [challenge, setChallenge] = useState(false)
  const [status, setStatus] = useState('اول «بالا ببر» تا انرژی پتانسیل ذخیره شود، بعد «رها کن»!')
  const [live, setLive] = useState({ pe: 0, ke: 0, v: 0 })
  const winBeep = useWinBeep()
  const reduced = useReducedMotion()
  const anim = useRef({ y: 0, v: 0, phase: 'idle' as 'idle' | 'lift' | 'top' | 'fall' | 'hit' })
  const lastLive = useRef({ pe: 0, ke: 0, v: 0 })
  const accRef = useRef(0)
  const solvedRef = useRef(false)

  const impactV = Math.sqrt(2 * G * height)
  const eMax = Math.max(1, mass * G * height)

  // challenge: pick height so impact speed = 12 m/s (h = 7.2 m ±0.2)
  useEffect(() => {
    if (!solvedRef.current && Math.abs(impactV - 12) <= 0.2) {
      solvedRef.current = true
      setChallenge(true)
      setStatus('چالش حل شد! h = 7.2 m → v = 12 m/s (چون v = √(2gh) بود).')
      winBeep()
    }
  }, [impactV, winBeep])

  const push = (y: number, v: number) => {
    const pe = mass * G * y
    const ke = 0.5 * mass * v * v
    const prev = lastLive.current
    if (Math.abs(prev.pe - pe) > 0.4 || Math.abs(prev.ke - ke) > 0.4 || Math.abs(prev.v - v) > 0.05) {
      lastLive.current = { pe, ke, v }
      setLive({ pe, ke, v })
    }
  }

  const lift = () => {
    if (reduced) {
      anim.current = { y: height, v: 0, phase: 'top' }
      setPhase('top')
      push(height, 0)
      setStatus('بار بالا رفت (نمایش فوری): همهٔ انرژی پتانسیل شده است.')
    } else {
      anim.current = { y: 0, v: 0, phase: 'lift' }
      setPhase('lift')
      setStatus('در حال بالا بردن… نوار PE را ببین که پر می‌شود.')
    }
  }

  const drop = () => {
    if (reduced) {
      const vi = Math.sqrt(2 * G * height)
      anim.current = { y: 0, v: vi, phase: 'hit' }
      setPhase('hit')
      push(0, vi)
      setStatus(`نتیجهٔ فوری: سرعت برخورد ${fmt(vi)} m/s — مجموع انرژی ثابت ماند.`)
    } else {
      anim.current = { y: height, v: 0, phase: 'fall' }
      setPhase('fall')
      setStatus('رها شد! PE به KE تبدیل می‌شود…')
    }
  }

  const { canvasRef } = useSimCanvas((ctx, w, h, _t, dt) => {
    ctx.clearRect(0, 0, w, h)
    ctx.fillStyle = CANVAS.bg
    ctx.fillRect(0, 0, w, h)
    drawGrid(ctx, w, h, 44)

    const a = anim.current
    let moving = false
    if (!reduced && a.phase === 'lift') {
      moving = true
      a.y += (height * dt) / 1.6
      if (a.y >= height) { a.y = height; a.phase = 'top'; setPhase('top'); push(height, 0) }
    }
    if (!reduced && a.phase === 'fall') {
      moving = true
      a.v += G * dt
      a.y -= a.v * dt
      if (a.y <= 0) {
        a.y = 0
        a.v = Math.sqrt(2 * G * height)
        a.phase = 'hit'
        setPhase('hit')
        push(0, a.v)
        setStatus(`برخورد! سرعت ${fmt(a.v)} m/s — همهٔ PE به KE تبدیل شده بود.`)
      }
    }
    if (moving) {
      accRef.current += dt
      if (accRef.current > 0.08) { accRef.current = 0; push(a.y, a.v) }
    }

    const groundY = h - 46
    const k = (groundY - 56) / 16
    const cy = (hm: number) => groundY - hm * k

    // height scale
    ctx.font = FONT_MONO
    ctx.textAlign = 'left'
    ctx.textBaseline = 'middle'
    for (let hm = 0; hm <= 15; hm += 5) {
      const y = cy(hm)
      ctx.strokeStyle = 'rgba(250,250,249,0.15)'
      ctx.lineWidth = 1
      ctx.beginPath(); ctx.moveTo(30, y); ctx.lineTo(w - 16, y); ctx.stroke()
      ctx.fillStyle = CANVAS.muted
      ctx.fillText(`${hm} m`, 8, y)
    }

    // crane tower + arm
    const towerX = 84
    const topY = cy(15.8)
    ctx.strokeStyle = CANVAS.muted
    ctx.lineWidth = 4
    ctx.beginPath(); ctx.moveTo(towerX, groundY); ctx.lineTo(towerX, topY); ctx.stroke()
    ctx.lineWidth = 3
    ctx.beginPath(); ctx.moveTo(towerX - 26, topY); ctx.lineTo(towerX + 42, topY); ctx.stroke()

    // rope + box
    const boxBottom = cy(a.y)
    const boxTop = boxBottom - 34
    ctx.strokeStyle = 'rgba(214,211,209,0.85)'
    ctx.lineWidth = 1.5
    ctx.beginPath(); ctx.moveTo(towerX + 34, topY); ctx.lineTo(towerX + 34, boxTop); ctx.stroke()
    ctx.fillStyle = CANVAS.teal
    rr(ctx, towerX + 10, boxTop, 48, 34, 5); ctx.fill()
    faText(ctx, `${fmt(mass)} kg`, towerX + 34, boxTop + 17, { size: 10, bold: true, color: '#0f172a' })

    // height marker
    ctx.strokeStyle = 'rgba(245,158,11,0.5)'
    ctx.lineWidth = 1
    ctx.setLineDash([4, 4])
    ctx.beginPath(); ctx.moveTo(towerX + 62, boxBottom); ctx.lineTo(w - 16, boxBottom); ctx.stroke()
    ctx.setLineDash([])
    faText(ctx, `ارتفاع فعلی: ${fmt(a.y)} m`, w - 22, boxBottom - 10, { align: 'right', size: 10, color: CANVAS.amber })

    // speed arrow while falling
    if (a.v > 0.2) {
      arrow(ctx, towerX + 90, boxTop + 10, towerX + 90, Math.min(groundY - 4, boxTop + 10 + a.v * 3), CANVAS.amber, 2)
      faText(ctx, `${fmt(a.v)} m/s`, towerX + 106, boxTop + 10, { size: 10, color: CANVAS.amber })
    }

    // energy bars (normalized to total mgh)
    const pe = mass * G * a.y
    const ke = 0.5 * mass * a.v * a.v
    drawBar(ctx, w - 216, 22, 200, 15, pe / eMax, CANVAS.teal, 'انرژی پتانسیل PE', `${fmt(pe)} J`)
    drawBar(ctx, w - 216, 52, 200, 15, ke / eMax, CANVAS.amber, 'انرژی جنبشی KE', `${fmt(ke)} J`)
    // constant-sum reference line on the KE bar row
    ctx.strokeStyle = 'rgba(250,250,249,0.7)'
    ctx.lineWidth = 1.5
    ctx.setLineDash([4, 3])
    ctx.beginPath(); ctx.moveTo(w - 216, 66); ctx.lineTo(w - 16, 66); ctx.stroke()
    ctx.setLineDash([])
    faText(ctx, 'جمع ثابت = mgh', w - 220, 68, { align: 'right', size: 10, color: CANVAS.fg })

    if (a.phase === 'hit') drawBanner(ctx, w, 96, `سرعت برخورد: ${fmt(a.v)} m/s`, 'info')
    if (challenge) drawBanner(ctx, w, 136, 'چالش: سرعت برخورد = 12 m/s ✓', 'win')
  }, 420)

  return (
    <SimFrame
      title="جرثقیل و تبدیل انرژی"
      brief="بالا بردن یعنی ذخیرهٔ انرژی پتانسیل؛ رها کردن یعنی خرج کردن آن در قالب سرعت."
    >
      <div className="overflow-hidden rounded-lg border">
        <canvas ref={canvasRef} className="block w-full" style={{ touchAction: 'none' }} aria-label="جرثقیل و تبدیل انرژی پتانسیل به جنبشی" />
      </div>
      <div className="flex flex-wrap items-center gap-3">
        <SimSlider label="جرم جعبه" value={mass} min={1} max={10} step={0.5} unit="kg" onChange={setMass} format={fmt} className="min-w-[150px] flex-1" />
        <SimSlider label="ارتفاع بالا بردن" value={height} min={0.5} max={15} step={0.1} unit="m" onChange={setHeight} format={fmt} className="min-w-[150px] flex-1" />
        <SimButton onClick={lift} disabled={phase === 'lift' || phase === 'fall' || phase === 'top'}>بالا ببر</SimButton>
        <SimButton onClick={drop} variant="secondary" disabled={phase !== 'top'}>رها کن</SimButton>
      </div>
      <div className="flex flex-wrap items-center gap-3">
        <Readout label="PE" value={fmt(live.pe)} unit="J" />
        <Readout label="KE" value={fmt(live.ke)} unit="J" />
        <Readout label="سرعت" value={fmt(live.v)} unit="m/s" />
        <Legend color={CANVAS.teal} label="PE" />
        <Legend color={CANVAS.amber} label="KE" />
      </div>
      <p role="status" className="text-xs text-muted-foreground">{status}</p>
    </SimFrame>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// u3-conservation · «مسیر غلتک انرژی» — fixed track, energy-driven ball
// ─────────────────────────────────────────────────────────────────────────────
const TRACK: [number, number][] = [
  [0, 6], [1.5, 6], [4.5, 0.9], [7.5, 0.9], [10.5, 3.4], [13.5, 0.6], [16.5, 0.6],
]
const CREST_X = 10.5
const BALL_M = 2
const E_SCALE = BALL_M * G * 6 // 120 J

function trackH(x: number): number {
  for (let i = 0; i < TRACK.length - 1; i++) {
    const [x1, h1] = TRACK[i]
    const [x2, h2] = TRACK[i + 1]
    if (x >= x1 && x <= x2) return x2 === x1 ? h1 : h1 + ((x - x1) / (x2 - x1)) * (h2 - h1)
  }
  return TRACK[TRACK.length - 1][1]
}
function trackCos(x: number): number {
  for (let i = 0; i < TRACK.length - 1; i++) {
    const [x1, h1] = TRACK[i]
    const [x2, h2] = TRACK[i + 1]
    if (x >= x1 && x <= x2) {
      const dx = Math.max(1e-6, x2 - x1)
      return Math.cos(Math.atan2(h2 - h1, dx))
    }
  }
  return 1
}
function startXFor(h0: number): number {
  if (h0 >= 5.95) return 0.75
  const t = Math.max(0, Math.min(1, (6 - h0) / (6 - 0.9)))
  return 1.5 + t * 3
}

function U3ConservationSim() {
  const [h0, setH0] = useState(5)
  const [frictionOn, setFrictionOn] = useState(false)
  const [status, setStatus] = useState('ارتفاع شروع را انتخاب کن و «رها کن»؛ اگر فراز بلندتر از شروع باشد گوی برمی‌گردد.')
  const [live, setLive] = useState({ v: 0, h: 5, e: 100 })
  const reduced = useReducedMotion()
  const anim = useRef({ x: startXFor(5), dir: 1, n: 0, running: false, rest: 0 })
  const lastLive = useRef({ v: 0, h: 5, e: 100 })
  const accRef = useRef(0)

  const push = (x: number, n: number) => {
    const hEff = h0 * (frictionOn ? Math.pow(0.9, n) : 1)
    const hh = trackH(x)
    const v = Math.max(0, Math.sqrt(2 * G * Math.max(0, hEff - hh)))
    const e = BALL_M * G * hEff
    const prev = lastLive.current
    if (Math.abs(prev.v - v) > 0.05 || Math.abs(prev.h - hh) > 0.03 || Math.abs(prev.e - e) > 0.4) {
      lastLive.current = { v, h: hh, e }
      setLive({ v, h: hh, e })
    }
  }

  const resetBall = (runNow: boolean) => {
    anim.current = { x: startXFor(h0), dir: 1, n: 0, running: runNow && !reduced, rest: 0 }
    if (reduced && runNow) {
      push(anim.current.x, 0)
      setStatus('نمایش فوری (حالت حرکت کم‌حرکت): به نشانگر نقاط کلیدی روی مسیر نگاه کن.')
    } else if (runNow) {
      setStatus('گوی رها شد — در هر ارتفاعی فقط اختلاف ارتفاع سرعت را تعیین می‌کند.')
    } else {
      setStatus('گوی سر جای شروع نشست.')
    }
    push(anim.current.x, 0)
  }

  const { canvasRef } = useSimCanvas((ctx, w, h, _t, dt) => {
    ctx.clearRect(0, 0, w, h)
    ctx.fillStyle = CANVAS.bg
    ctx.fillRect(0, 0, w, h)
    drawGrid(ctx, w, h, 44)

    const a = anim.current
    const hEff = h0 * (frictionOn ? Math.pow(0.9, a.n) : 1)
    if (!reduced && a.running) {
      const v2 = 2 * G * (hEff - trackH(a.x))
      if (v2 <= 0.0005) {
        a.rest += dt
        a.dir = -a.dir
        if (frictionOn && a.rest > 0.8) {
          a.running = false
          setStatus(`گوی با اصطکاک کم‌انرژی شد و در ارتفاع ${fmt(trackH(a.x))} m آرام گرفت.`)
        }
      } else {
        a.rest = 0
        const v = Math.sqrt(v2)
        const nx = a.x + a.dir * v * dt * Math.max(0.25, trackCos(a.x))
        if ((a.x - CREST_X) * (nx - CREST_X) < 0) a.n += 1
        if (nx >= 16.2) { a.x = 16.2; a.dir = -1 }
        else if (nx <= 0.15) { a.x = 0.15; a.dir = 1 }
        else a.x = nx
      }
      accRef.current += dt
      if (accRef.current > 0.08) { accRef.current = 0; push(a.x, a.n) }
    }

    const groundY = h - 44
    const sx = (x: number) => 26 + (x / 17) * (w - 52)
    const sy = (hh: number) => groundY - hh * ((groundY - 96) / 6.5)

    // track
    ctx.strokeStyle = CANVAS.white
    ctx.lineWidth = 7
    ctx.lineJoin = 'round'
    ctx.lineCap = 'round'
    ctx.beginPath()
    TRACK.forEach(([tx, th], i) => (i === 0 ? ctx.moveTo(sx(tx), sy(th)) : ctx.lineTo(sx(tx), sy(th))))
    ctx.stroke()

    // crest flag
    const cxp = sx(CREST_X)
    const cyp = sy(trackH(CREST_X))
    ctx.strokeStyle = CANVAS.violet
    ctx.lineWidth = 2
    ctx.beginPath(); ctx.moveTo(cxp, cyp - 4); ctx.lineTo(cxp, cyp - 30); ctx.stroke()
    ctx.fillStyle = CANVAS.violet
    ctx.beginPath(); ctx.moveTo(cxp, cyp - 30); ctx.lineTo(cxp + 16, cyp - 25); ctx.lineTo(cxp, cyp - 20); ctx.closePath(); ctx.fill()
    faText(ctx, 'فراز', cxp + 20, cyp - 27, { size: 10, color: CANVAS.violet })

    // reduced motion: key-point markers with speeds
    if (reduced) {
      const pts: [number, string][] = [
        [startXFor(h0), 'شروع v=0'],
        [7.5, `دره v=${fmt(Math.sqrt(2 * G * Math.max(0, h0 - 0.9)))}`],
        [CREST_X, h0 > 3.4 ? `فراز v=${fmt(Math.sqrt(2 * G * (h0 - 3.4)))}` : 'فراز: برمی‌گردد'],
        [16.2, `انتها v=${fmt(Math.sqrt(2 * G * Math.max(0, h0 - 0.6)))}`],
      ]
      for (const [px, label] of pts) {
        const yy = sy(trackH(px))
        ctx.fillStyle = CANVAS.amber
        ctx.beginPath(); ctx.arc(sx(px), yy - 16, 4, 0, Math.PI * 2); ctx.fill()
        faText(ctx, label, Math.min(w - 44, Math.max(40, sx(px))), yy + 18, { size: 9, color: CANVAS.amber })
      }
    }

    // ball
    const bx = sx(a.x)
    const by = sy(trackH(a.x)) - 11
    ctx.fillStyle = CANVAS.amber
    ctx.beginPath(); ctx.arc(bx, by, 10, 0, Math.PI * 2); ctx.fill()
    ctx.fillStyle = 'rgba(28,25,23,0.45)'
    ctx.beginPath(); ctx.arc(bx - 3, by - 3, 3, 0, Math.PI * 2); ctx.fill()

    // energy bars
    const ke = 0.5 * BALL_M * Math.pow(live.v, 2)
    const pe = BALL_M * G * live.h
    drawBar(ctx, 16, 20, w - 32, 14, ke / E_SCALE, CANVAS.amber, 'KE جنبشی', `${fmt(ke)} J`)
    drawBar(ctx, 16, 48, w - 32, 14, pe / E_SCALE, CANVAS.teal, 'PE پتانسیل', `${fmt(pe)} J`)
    drawBar(ctx, 16, 76, w - 32, 14, live.e / E_SCALE, CANVAS.violet, 'E مجموع', `${fmt(live.e)} J`)
    // initial energy reference line
    const e0x = 16 + (w - 32) * Math.min(1, (BALL_M * G * h0) / E_SCALE)
    ctx.strokeStyle = 'rgba(250,250,249,0.7)'
    ctx.lineWidth = 1.5
    ctx.setLineDash([4, 3])
    ctx.beginPath(); ctx.moveTo(e0x, 14); ctx.lineTo(e0x, 92); ctx.stroke()
    ctx.setLineDash([])
    faText(ctx, 'E اولیه', Math.max(52, e0x + 30), 8, { size: 9, color: CANVAS.fg })
    if (frictionOn) faText(ctx, 'اصطکاک: ۱۰٪ اتلاف در هر عبور از فراز', w - 22, 106, { align: 'right', size: 10, color: CANVAS.red })
  }, 430)

  return (
    <SimFrame
      title="مسیر غلتک انرژی"
      brief="پایستگی انرژی روی مسیر پیچ‌دار: در هر ارتفاع سرعت از ریشهٔ اختلاف ارتفاع می‌آید — مسیر فقط جهت سرعت را عوض می‌کند."
    >
      <div className="overflow-hidden rounded-lg border">
        <canvas ref={canvasRef} className="block w-full" style={{ touchAction: 'none' }} aria-label="مسیر غلتک و پایستگی انرژی" />
      </div>
      <div className="flex flex-wrap items-center gap-3">
        <SimSlider label="ارتفاع شروع" value={h0} min={1} max={6} step={0.25} unit="m" onChange={setH0} format={fmt} className="min-w-[150px] flex-1" />
        <SimToggle label="اصطکاک (۱۰٪ اتلاف هر فراز)" checked={frictionOn} onChange={setFrictionOn} />
        <SimButton onClick={() => resetBall(true)}>رها کن</SimButton>
        <SimButton variant="secondary" onClick={() => resetBall(false)}>بازگشت به شروع</SimButton>
      </div>
      <div className="flex flex-wrap items-center gap-3">
        <Readout label="سرعت لحظه‌ای" value={fmt(live.v)} unit="m/s" />
        <Readout label="ارتفاع" value={fmt(live.h)} unit="m" />
        <Readout label="E مکانیکی" value={fmt(live.e)} unit="J" />
        <Legend color={CANVAS.amber} label="گوی" />
        <Legend color={CANVAS.violet} label="E مجموع" />
      </div>
      <p role="status" className="text-xs text-muted-foreground">{status}</p>
    </SimFrame>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// u3-internal · «سطح زبر و گرمایش» — sliding block, heat trail & KE⇄Thermal bars
// ─────────────────────────────────────────────────────────────────────────────
function U3InternalSim() {
  const [mu, setMu] = useState(0.4)
  const [v0, setV0] = useState(10)
  const [mass, setMass] = useState(5)
  const [running, setRunning] = useState(false)
  const [done, setDone] = useState(false)
  const [status, setStatus] = useState('μ، سرعت و جرم را تنظیم کن و «پرتاب» را بزن؛ دنبالهٔ قرمز یعنی انرژی درونی!')
  const [live, setLive] = useState({ v: 10, d: 0, q: 0 })
  const reduced = useReducedMotion()
  const anim = useRef({ v: 10, pos: 0, running: false })
  const lastLive = useRef({ v: 10, d: 0, q: 0 })
  const accRef = useRef(0)

  const dStop = (v0 * v0) / (2 * mu * G)
  const ke0 = 0.5 * mass * v0 * v0
  const decel = mu * G
  const tStop = v0 / decel
  const ts = Math.min(20, Math.max(1, tStop / 4)) // time-warp so long slides stay watchable

  const push = (v: number, pos: number) => {
    const q = ke0 - 0.5 * mass * v * v
    const prev = lastLive.current
    if (Math.abs(prev.v - v) > 0.05 || Math.abs(prev.d - pos) > 0.05 || Math.abs(prev.q - q) > 0.5) {
      lastLive.current = { v, d: pos, q }
      setLive({ v, d: pos, q })
    }
  }

  const launch = () => {
    if (reduced) {
      anim.current = { v: 0, pos: dStop, running: false }
      setRunning(false)
      setDone(true)
      setLive({ v: 0, d: dStop, q: ke0 })
      setStatus(`نتیجهٔ فوری: توقف پس از ${fmt(dStop)} m و گرمای ${fmt(ke0)} J`)
    } else {
      anim.current = { v: v0, pos: 0, running: true }
      setRunning(true)
      setDone(false)
      setLive({ v: v0, d: 0, q: 0 })
      setStatus('بلوک در حال لغزش است؛ به دنبالهٔ گرما نگاه کن…')
    }
  }

  const { canvasRef } = useSimCanvas((ctx, w, h, _t, dt) => {
    ctx.clearRect(0, 0, w, h)
    ctx.fillStyle = CANVAS.bg
    ctx.fillRect(0, 0, w, h)
    drawGrid(ctx, w, h, 44)

    const a = anim.current
    if (a.running) {
      a.v = Math.max(0, a.v - decel * dt * ts)
      a.pos += a.v * dt * ts
      if (a.v <= 0.001) {
        a.v = 0
        a.pos = Math.min(dStop, a.pos)
        a.running = false
        setRunning(false)
        setDone(true)
        setLive({ v: 0, d: dStop, q: ke0 })
        setStatus(`توقف پس از ${fmt(dStop)} m — کل انرژی جنبشی (${fmt(ke0)} J) گرما شد.`)
      } else {
        accRef.current += dt
        if (accRef.current > 0.08) { accRef.current = 0; push(a.v, a.pos) }
      }
    }

    const groundY = 232
    const x0 = 34
    const px = (w - 68) / Math.max(1, dStop)

    // rough strip
    ctx.fillStyle = CANVAS.panel
    ctx.fillRect(x0 - 10, groundY + 6, w - 2 * (x0 - 10), 22)
    ctx.strokeStyle = 'rgba(168,162,158,0.4)'
    ctx.lineWidth = 1
    for (let x = x0 - 6; x < w - 20; x += 14) {
      ctx.beginPath(); ctx.moveTo(x, groundY + 26); ctx.lineTo(x + 5, groundY + 8); ctx.stroke()
    }
    drawGround(ctx, w, groundY + 6)

    // stop marker
    const endX = x0 + dStop * px
    ctx.strokeStyle = CANVAS.amber
    ctx.lineWidth = 1.5
    ctx.setLineDash([4, 4])
    ctx.beginPath(); ctx.moveTo(endX, groundY - 10); ctx.lineTo(endX, groundY + 32); ctx.stroke()
    ctx.setLineDash([])
    faText(ctx, `توقف: ${fmt(dStop)} m`, Math.min(w - 60, endX + 56), groundY + 42, { size: 10, color: CANVAS.amber })

    // heat trail (internal energy along traveled path)
    const travX = x0 + a.pos * px
    if (travX > x0 + 2) {
      const grad = ctx.createLinearGradient(x0, 0, travX, 0)
      grad.addColorStop(0, 'rgba(244,63,94,0.18)')
      grad.addColorStop(1, 'rgba(239,68,68,0.85)')
      ctx.fillStyle = grad
      ctx.fillRect(x0, groundY + 10, travX - x0, 12)
    }

    // block
    const bw = 46
    ctx.fillStyle = CANVAS.teal
    rr(ctx, travX - bw / 2, groundY - 40, bw, 40, 5); ctx.fill()
    faText(ctx, `${fmt(mass)} kg`, travX, groundY - 20, { size: 10, bold: true, color: '#0f172a' })
    if (a.v > 0.2) {
      arrow(ctx, travX + bw / 2 + 4, groundY - 52, Math.min(w - 14, travX + bw / 2 + 4 + a.v * 4), groundY - 52, CANVAS.amber, 2.5)
      faText(ctx, `${fmt(a.v)} m/s`, travX + bw / 2 + 26, groundY - 64, { size: 10, color: CANVAS.amber })
    }

    // energy bars: KE vs Thermal (sum = KE0)
    const ke = 0.5 * mass * a.v * a.v
    const q = ke0 - ke
    drawBar(ctx, 16, 22, w - 32, 16, ke / Math.max(1, ke0), CANVAS.amber, 'KE باقی‌مانده', `${fmt(ke)} J`)
    drawBar(ctx, 16, 54, w - 32, 16, q / Math.max(1, ke0), CANVAS.red, 'Thermal انرژی درونی (گرما)', `${fmt(q)} J`)
    ctx.strokeStyle = 'rgba(250,250,249,0.7)'
    ctx.lineWidth = 1.5
    ctx.setLineDash([4, 3])
    ctx.beginPath(); ctx.moveTo(16 + (w - 32), 16); ctx.lineTo(16 + (w - 32), 74); ctx.stroke()
    ctx.setLineDash([])
    faText(ctx, `جمع ثابت = KE₀ = ${fmt(ke0)} J`, w - 22, 6, { align: 'right', size: 10, color: CANVAS.fg })
    faText(ctx, `شتاب کند شدن a = μg = ${fmt(decel)} m/s² · پخش ×${fmt(ts)}`, w - 22, 84, { align: 'right', size: 10, color: CANVAS.muted })

    if (done) drawBanner(ctx, w, h - 56, `توقف پس از ${fmt(dStop)} m`, 'win')
  }, 300)

  return (
    <SimFrame
      title="سطح زبر و گرمایش"
      brief="اصطکاک کار منفی می‌کند و انرژی جنبشی را به انرژی درونی (دنبالهٔ قرمز) تبدیل می‌کند."
    >
      <div className="overflow-hidden rounded-lg border">
        <canvas ref={canvasRef} className="block w-full" style={{ touchAction: 'none' }} aria-label="بلوک لغزان روی سطح زبر و تولید گرما" />
      </div>
      <div className="flex flex-wrap items-center gap-3">
        <SimSlider label="ضریب اصطکاک μ" value={mu} min={0.05} max={0.8} step={0.05} onChange={setMu} format={fmt} className="min-w-[140px] flex-1" />
        <SimSlider label="سرعت اولیه v₀" value={v0} min={2} max={30} step={1} unit="m/s" onChange={setV0} format={fmt} className="min-w-[140px] flex-1" />
        <SimSlider label="جرم" value={mass} min={1} max={10} step={0.5} unit="kg" onChange={setMass} format={fmt} className="min-w-[140px] flex-1" />
        <SimButton onClick={launch} disabled={running}>پرتاب</SimButton>
      </div>
      <div className="flex flex-wrap items-center gap-3">
        <Readout label="سرعت" value={fmt(live.v)} unit="m/s" />
        <Readout label="مسافت طی‌شده" value={fmt(live.d)} unit="m" />
        <Readout label="Q آزادشده" value={fmt(live.q)} unit="J" />
        <Legend color={CANVAS.amber} label="KE" />
        <Legend color={CANVAS.red} label="انرژی درونی" />
      </div>
      <p role="status" className="text-xs text-muted-foreground">{status}</p>
    </SimFrame>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// u3-power · «مسابقهٔ جرثقیل‌ها» — same work (mgh = 200 J), different times
// ─────────────────────────────────────────────────────────────────────────────
const POW_M = 2
const POW_H = 10
const POW_W = POW_M * G * POW_H // 200 J
const POW_PMAX = POW_W / 1 // 200 W

function U3PowerSim() {
  const [tA, setTA] = useState(4)
  const [tB, setTB] = useState(7)
  const [guess, setGuess] = useState<'A' | 'B' | null>(null)
  const [running, setRunning] = useState(false)
  const [banner, setBanner] = useState<{ text: string; tone: 'win' | 'info' } | null>(null)
  const [status, setStatus] = useState('اول برنده را حدس بزن، بعد «مسابقه» را بزن: کمترین زمان = بیشترین توان!')
  const [live, setLive] = useState({ ya: 0, yb: 0 })
  const winBeep = useWinBeep()
  const reduced = useReducedMotion()
  const anim = useRef({ el: 0, running: false })
  const lastLive = useRef({ ya: 0, yb: 0 })

  const pA = POW_W / tA
  const pB = POW_W / tB

  const finish = () => {
    const res = tA < tB ? 'A' : tB < tA ? 'B' : 'tie'
    setRunning(false)
    setLive({ ya: 1, yb: 1 })
    if (res === 'tie') {
      setBanner({ text: 'مساوی! هر دو هم‌زمان رسیدند', tone: 'info' })
      setStatus('زمان‌های برابر یعنی توان‌های برابر؛ حدس هر طرفی درست بود.')
    } else {
      const pWin = res === 'A' ? pA : pB
      if (guess === res) {
        setBanner({ text: `حدس درست بود — برنده: جرثقیل ${res}`, tone: 'win' })
        winBeep()
        setStatus(`برندهٔ ${res} با توان ${fmt(pWin)} W بالاتر از برندهٔ دیگر بود: همان کار، زمان کمتر.`)
      } else if (guess) {
        setBanner({ text: `برنده: جرثقیل ${res}`, tone: 'info' })
        setStatus(`حدس نادرست بود؛ جرثقیل ${res} زودتر رسید چون توان بیشتری داشت (${fmt(pWin)} W).`)
      } else {
        setBanner({ text: `برنده: جرثقیل ${res}`, tone: 'info' })
        setStatus(`جرثقیل ${res} با توان ${fmt(pWin)} W زودتر بالا رفت — کار هر دو 200 J بود.`)
      }
    }
  }
  const finishRef = useRef(finish)
  finishRef.current = finish

  const race = () => {
    setBanner(null)
    if (reduced) {
      anim.current = { el: Math.max(tA, tB), running: false }
      finishRef.current()
      setStatus('نتیجهٔ فوری: بارها بالا رفتند؛ نوار توان‌ها را مقایسه کن.')
    } else {
      anim.current = { el: 0, running: true }
      setRunning(true)
      setLive({ ya: 0, yb: 0 })
      setStatus('مسابقه شروع شد…')
    }
  }

  const { canvasRef } = useSimCanvas((ctx, w, h, _t, dt) => {
    ctx.clearRect(0, 0, w, h)
    ctx.fillStyle = CANVAS.bg
    ctx.fillRect(0, 0, w, h)
    drawGrid(ctx, w, h, 44)

    const a = anim.current
    if (a.running) {
      const tspd = 2.6 / Math.max(tA, tB)
      a.el += dt * tspd
      const ya = Math.min(1, a.el / tA)
      const yb = Math.min(1, a.el / tB)
      const prev = lastLive.current
      if (Math.abs(prev.ya - ya) > 0.01 || Math.abs(prev.yb - yb) > 0.01) {
        lastLive.current = { ya, yb }
        setLive({ ya, yb })
      }
      if (ya >= 1 && yb >= 1) {
        a.running = false
        finishRef.current()
      }
    }

    const groundY = h - 64
    const drawCrane = (
      cx: number, label: string, yFrac: number, pFrac: number,
      pText: string, tText: string, color: string,
    ) => {
      const topY = groundY - 196
      // tower
      ctx.strokeStyle = CANVAS.muted
      ctx.lineWidth = 4
      ctx.beginPath(); ctx.moveTo(cx, groundY); ctx.lineTo(cx, topY); ctx.stroke()
      ctx.lineWidth = 2
      for (let i = 1; i <= 4; i++) {
        const yy = groundY - (i * (groundY - topY)) / 5
        ctx.beginPath(); ctx.moveTo(cx - 9, yy); ctx.lineTo(cx + 9, yy - 12); ctx.stroke()
      }
      // arm toward center
      const armDir = cx < w / 2 ? 1 : -1
      ctx.lineWidth = 3
      ctx.beginPath(); ctx.moveTo(cx - 30 * armDir, topY); ctx.lineTo(cx + 46 * armDir, topY); ctx.stroke()
      // rope + load
      const tipX = cx + 40 * armDir
      const loadBottom = groundY - 16 - yFrac * 160
      ctx.strokeStyle = 'rgba(214,211,209,0.85)'
      ctx.lineWidth = 1.5
      ctx.beginPath(); ctx.moveTo(tipX, topY); ctx.lineTo(tipX, loadBottom - 26); ctx.stroke()
      ctx.fillStyle = color
      rr(ctx, tipX - 22, loadBottom - 26, 44, 26, 4); ctx.fill()
      faText(ctx, `${POW_M} kg`, tipX, loadBottom - 13, { size: 10, bold: true, color: '#0f172a' })
      // label + power bar
      faText(ctx, label, cx, topY - 18, { size: 15, bold: true, color })
      drawBar(ctx, cx - 78, groundY + 12, 156, 14, pFrac, color, '', pText)
      faText(ctx, tText, cx, groundY + 40, { size: 10, color: CANVAS.muted })
    }

    drawCrane(w * 0.7, 'جرثقیل A', live.ya, pA / POW_PMAX, `P = ${fmt(pA)} W`, `زمان: ${fmt(tA)} s`, CANVAS.emerald)
    drawCrane(w * 0.3, 'جرثقیل B', live.yb, pB / POW_PMAX, `P = ${fmt(pB)} W`, `زمان: ${fmt(tB)} s`, CANVAS.teal)
    faText(ctx, `ارتفاع 10 m · بار 2 kg · کار مشترک W = ${POW_W} J`, w / 2, 18, { size: 11, color: CANVAS.muted })

    if (banner) drawBanner(ctx, w, 40, banner.text, banner.tone)
  }, 380)

  return (
    <SimFrame
      title="مسابقهٔ جرثقیل‌ها"
      brief="هر دو جرثقیل بار 2 kg را تا 10 m می‌برند (کار مشترک 200 J)؛ سریع‌تر یعنی تواناتر."
    >
      <div className="overflow-hidden rounded-lg border">
        <canvas ref={canvasRef} className="block w-full" style={{ touchAction: 'none' }} aria-label="مسابقهٔ دو جرثقیل و نوار توان" />
      </div>
      <div className="flex flex-wrap items-center gap-3">
        <SimSlider label="زمان برخاستن A" value={tA} min={1} max={10} step={0.5} unit="s" onChange={setTA} format={fmt} className="min-w-[150px] flex-1" />
        <SimSlider label="زمان برخاستن B" value={tB} min={1} max={10} step={0.5} unit="s" onChange={setTB} format={fmt} className="min-w-[150px] flex-1" />
      </div>
      <div className="flex flex-wrap items-center gap-3">
        <SimButton variant="outline" disabled={running} onClick={() => { setGuess('A'); setStatus('حدس تو: جرثقیل A') }}>حدس: برندهٔ A</SimButton>
        <SimButton variant="outline" disabled={running} onClick={() => { setGuess('B'); setStatus('حدس تو: جرثقیل B') }}>حدس: برندهٔ B</SimButton>
        <SimButton onClick={race} disabled={running}>مسابقه</SimButton>
        <Readout label="W مشترک" value={fmt(POW_W)} unit="J" />
        <Readout label="P جرثقیل A" value={fmt(pA)} unit="W" />
        <Readout label="P جرثقیل B" value={fmt(pB)} unit="W" />
      </div>
      <p role="status" className="text-xs text-muted-foreground">{status}</p>
    </SimFrame>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Registry — u3-review maps to simKey 'u3-conservation' in its lesson data
// ─────────────────────────────────────────────────────────────────────────────
export const simsCh3: Record<string, SimComponent> = {
  'u3-kinetic': U3KineticSim,
  'u3-work': U3WorkSim,
  'u3-work-ke': U3WorkKeSim,
  'u3-pe': U3PeSim,
  'u3-conservation': U3ConservationSim,
  'u3-internal': U3InternalSim,
  'u3-power': U3PowerSim,
}
