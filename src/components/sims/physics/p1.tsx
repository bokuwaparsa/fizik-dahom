// ─── فیزیک‌دهم · فصل ۱ widgets ────────────────────────────────────────────────
// u1-fundamental is the canonical exemplar; the other five chapter-1 widgets
// (u1-modeling, u1-quantities, u1-si-units, u1-precision, u1-density) live in
// this same file and register in the same simsCh1 map.
'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
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
import { Input } from '@/components/ui/input'
import type { SimComponent } from '@/lib/game/types'

// ─── shared helpers (chapter-local) ──────────────────────────────────────────
const FONT_FA = '600 12px Vazirmatn, Tahoma, sans-serif'
const FONT_FA_BOLD = '700 13px Vazirmatn, Tahoma, sans-serif'
const FONT_MONO = '700 13px ui-monospace, SFMono-Regular, Menlo, monospace'

/** Format a number for canvas/HTML readouts — never NaN/Infinity. */
export function fmtNum(v: number): string {
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

/** Win jingle: two quick ascending blips (660 Hz, then 880 Hz after 150 ms). */
function useWinBeep() {
  const beep = useSimBeep()
  return () => {
    beep(660, 120)
    window.setTimeout(() => beep(880, 150), 150)
  }
}

/** Rounded success/info banner drawn across the canvas. */
function drawBanner(
  ctx: CanvasRenderingContext2D,
  w: number,
  y: number,
  text: string,
  tone: 'green' | 'rose' = 'green',
) {
  const bw = Math.min(400, Math.max(240, w - 40))
  const bx = (w - bw) / 2
  ctx.fillStyle = tone === 'green' ? 'rgba(16,185,129,0.92)' : 'rgba(244,63,94,0.9)'
  rr(ctx, bx, y, bw, 34, 10)
  ctx.fill()
  faText(ctx, text, w / 2, y + 17, { bold: true, size: 14, color: '#ffffff' })
}

/** Arrow with a filled triangular head; skips degenerate zero-length arrows. */
function drawArrow(
  ctx: CanvasRenderingContext2D,
  x1: number,
  y1: number,
  x2: number,
  y2: number,
  color: string,
  width = 2,
  dash?: number[],
) {
  const len = Math.hypot(x2 - x1, y2 - y1)
  if (!(len > 0.5) || !Number.isFinite(len)) return
  const ang = Math.atan2(y2 - y1, x2 - x1)
  const head = Math.min(12, len * 0.4)
  ctx.save()
  ctx.strokeStyle = color
  ctx.fillStyle = color
  ctx.lineWidth = width
  ctx.lineCap = 'round'
  if (dash) ctx.setLineDash(dash)
  ctx.beginPath()
  ctx.moveTo(x1, y1)
  ctx.lineTo(x2, y2)
  ctx.stroke()
  ctx.setLineDash([])
  ctx.beginPath()
  ctx.moveTo(x2, y2)
  ctx.lineTo(x2 - head * Math.cos(ang - 0.42), y2 - head * Math.sin(ang - 0.42))
  ctx.lineTo(x2 - head * Math.cos(ang + 0.42), y2 - head * Math.sin(ang + 0.42))
  ctx.closePath()
  ctx.fill()
  ctx.restore()
}

/** Parse a number typed with Persian/Arabic digits or a decimal comma; NaN-safe. */
function parseNum(s: string): number {
  const fa = '۰۱۲۳۴۵۶۷۸۹'
  const ar = '٠١٢٣٤٥٦٧٨٩'
  return parseFloat(
    s
      .replace(/[۰-۹]/g, (d) => String(fa.indexOf(d)))
      .replace(/[٠-٩]/g, (d) => String(ar.indexOf(d)))
      .replace(',', '.')
      .trim(),
  )
}

/** `10^e` with Unicode superscripts — used inside HTML result strings. */
function powSup(e: number): string {
  const sup = '⁰¹²³⁴⁵⁶⁷⁸⁹'
  const digits = String(Math.abs(e))
    .split('')
    .map((d) => sup[Number(d)] ?? d)
    .join('')
  return `10${e < 0 ? '⁻' : ''}${digits}`
}

// ─────────────────────────────────────────────────────────────────────────────
// u1-fundamental · «مقیاس جهان» — powers-of-ten explorer
// ─────────────────────────────────────────────────────────────────────────────
interface ScaleObject {
  exp: number // size (or characteristic length) as 10^exp metres
  name: string
  size: string // human-friendly size label
  hint: string
  draw: (ctx: CanvasRenderingContext2D, cx: number, cy: number, s: number) => void
}

const SCALE_OBJECTS: ScaleObject[] = [
  {
    exp: -15, name: 'هستهٔ اتم', size: '$\\sim 10^{-15}$ m',
    hint: 'کوچکترین بخشِ قابل مشاهدهٔ ماده در فیزیک هسته‌ای — پروتون و نوترون اینجا زندگی می‌کنند.',
    draw: (ctx, cx, cy, s) => {
      ctx.fillStyle = CANVAS.amber
      ctx.beginPath(); ctx.arc(cx, cy, 10 * s, 0, Math.PI * 2); ctx.fill()
      faText(ctx, '+', cx, cy - 1, { size: 14, bold: true, color: '#1c1917' })
    },
  },
  {
    exp: -10, name: 'اتم', size: '$\\sim 10^{-10}$ m',
    hint: 'خودِ اتم هزار برابر هسته‌اش بزرگتر است — بیشترِ آن فقط فضای خالی و ابر الکترونی است.',
    draw: (ctx, cx, cy, s) => {
      ctx.strokeStyle = CANVAS.teal; ctx.lineWidth = 1.5
      for (const rot of [0, Math.PI / 3, -Math.PI / 3]) {
        ctx.save(); ctx.translate(cx, cy); ctx.rotate(rot)
        ctx.beginPath(); ctx.ellipse(0, 0, 26 * s, 11 * s, 0, 0, Math.PI * 2); ctx.stroke()
        ctx.restore()
      }
      ctx.fillStyle = CANVAS.amber
      ctx.beginPath(); ctx.arc(cx, cy, 5 * s, 0, Math.PI * 2); ctx.fill()
    },
  },
  {
    exp: -8, name: 'مولکول DNA', size: '$\\sim 10^{-8}$ m (قطر)',
    hint: 'حامل اطلاعات زندگی — قطر مارپیچ دوگانهٔ DNA حدود دو نانومتر است.',
    draw: (ctx, cx, cy, s) => {
      ctx.strokeStyle = CANVAS.emerald; ctx.lineWidth = 2
      ctx.beginPath()
      for (let i = -30; i <= 30; i += 2) {
        const x = cx + i * s
        const y = cy + Math.sin((i / 30) * Math.PI * 2.5) * 12 * s
        i === -30 ? ctx.moveTo(x, y) : ctx.lineTo(x, y)
      }
      ctx.stroke()
      ctx.beginPath()
      for (let i = -30; i <= 30; i += 2) {
        const x = cx + i * s
        const y = cy - Math.sin((i / 30) * Math.PI * 2.5) * 12 * s
        i === -30 ? ctx.moveTo(x, y) : ctx.lineTo(x, y)
      }
      ctx.stroke()
    },
  },
  {
    exp: -6, name: 'باکتری', size: '$\\sim 10^{-6}$ m',
    hint: 'یک میکرومتر — تنها با میکروسکوپ دیده می‌شود؛ سلول‌های بدن تو هم در همین مقیاس‌اند.',
    draw: (ctx, cx, cy, s) => {
      ctx.fillStyle = CANVAS.violet
      rr(ctx, cx - 24 * s, cy - 9 * s, 48 * s, 18 * s, 9 * s); ctx.fill()
      ctx.strokeStyle = CANVAS.muted; ctx.lineWidth = 1.2
      ctx.beginPath(); ctx.moveTo(cx - 24 * s, cy); ctx.quadraticCurveTo(cx - 34 * s, cy - 6 * s, cx - 40 * s, cy); ctx.stroke()
    },
  },
  {
    exp: -4, name: 'تار مو / دانهٔ شن', size: '$\\sim 10^{-4}$ m (قطر)',
    hint: 'حدود یک دهم میلی‌متر — کوچکترین چیزی که هنوز با چشم غیرمسلح دیده می‌شود.',
    draw: (ctx, cx, cy, s) => {
      ctx.strokeStyle = CANVAS.orange; ctx.lineWidth = 6 * s; ctx.lineCap = 'round'
      ctx.beginPath(); ctx.moveTo(cx - 30 * s, cy + 10 * s)
      ctx.quadraticCurveTo(cx, cy - 22 * s, cx + 30 * s, cy + 10 * s); ctx.stroke()
    },
  },
  {
    exp: -3, name: 'مورچه', size: '$\\sim 10^{-3}$ m (۱ mm)',
    hint: 'چند میلی‌متر — مقیاسی که خط‌کش‌های معمولی با دقت میلی‌متر می‌سنجند.',
    draw: (ctx, cx, cy, s) => {
      ctx.fillStyle = CANVAS.rose
      for (const [dx, r] of [[-16, 7], [0, 5], [12, 9]] as const) {
        ctx.beginPath(); ctx.ellipse(cx + dx * s, cy, r * s, (r * 0.7) * s, 0, 0, Math.PI * 2); ctx.fill()
      }
      ctx.strokeStyle = CANVAS.rose; ctx.lineWidth = 1.5
      for (let i = 0; i < 3; i++) {
        ctx.beginPath(); ctx.moveTo(cx - 2 * s, cy + 4 * s)
        ctx.lineTo(cx + (6 + i * 4) * s, cy + 14 * s); ctx.stroke()
      }
    },
  },
  {
    exp: 0, name: 'انسان', size: '$\\sim 10^{0}$ m (≈ 1.7 m)',
    hint: 'مقیاس روزمرهٔ ما — متداول‌ترین ابزارها: خط‌کش، متر نواری و ترازو.',
    draw: (ctx, cx, cy, s) => {
      ctx.strokeStyle = CANVAS.white; ctx.lineWidth = 2.5 * s; ctx.lineCap = 'round'
      ctx.beginPath(); ctx.arc(cx, cy - 26 * s, 8 * s, 0, Math.PI * 2); ctx.stroke()
      ctx.beginPath(); ctx.moveTo(cx, cy - 18 * s); ctx.lineTo(cx, cy + 6 * s)
      ctx.moveTo(cx - 14 * s, cy - 8 * s); ctx.lineTo(cx + 14 * s, cy - 8 * s)
      ctx.moveTo(cx, cy + 6 * s); ctx.lineTo(cx - 10 * s, cy + 26 * s)
      ctx.moveTo(cx, cy + 6 * s); ctx.lineTo(cx + 10 * s, cy + 26 * s); ctx.stroke()
    },
  },
  {
    exp: 4, name: 'کوه و شهر', size: '$\\sim 10^{4}$ m (۱۰ km)',
    hint: 'مقیاس نقشه‌ها و پروازهای کوتاه — کیلومتر اینجا واحد روزمره است.',
    draw: (ctx, cx, cy, s) => {
      ctx.fillStyle = CANVAS.muted
      ctx.beginPath(); ctx.moveTo(cx - 40 * s, cy + 18 * s); ctx.lineTo(cx - 10 * s, cy - 20 * s); ctx.lineTo(cx + 18 * s, cy + 18 * s); ctx.closePath(); ctx.fill()
      ctx.fillStyle = CANVAS.white
      ctx.beginPath(); ctx.moveTo(cx - 16 * s, cy - 8 * s); ctx.lineTo(cx - 10 * s, cy - 20 * s); ctx.lineTo(cx - 4 * s, cy - 8 * s); ctx.closePath(); ctx.fill()
    },
  },
  {
    exp: 7, name: 'زمین', size: '$\\sim 1.3 \\times 10^{7}$ m (قطر)',
    hint: 'سیارهٔ ما — قطرش را اراتوستن حدود ۲۲۰۰ سال پیش با سایه‌ها اندازه گرفت!',
    draw: (ctx, cx, cy, s) => {
      ctx.fillStyle = CANVAS.teal
      ctx.beginPath(); ctx.arc(cx, cy, 24 * s, 0, Math.PI * 2); ctx.fill()
      ctx.fillStyle = 'rgba(16,185,129,0.55)'
      ctx.beginPath(); ctx.ellipse(cx - 7 * s, cy - 4 * s, 9 * s, 5 * s, 0.5, 0, Math.PI * 2); ctx.fill()
      ctx.beginPath(); ctx.ellipse(cx + 9 * s, cy + 8 * s, 7 * s, 4 * s, -0.4, 0, Math.PI * 2); ctx.fill()
    },
  },
  {
    exp: 9, name: 'خورشید', size: '$\\sim 1.4 \\times 10^{9}$ m (قطر)',
    hint: '۱۰۹ برابر زمین پهن است — و با این حال فقط یک ستارهٔ معمولی است.',
    draw: (ctx, cx, cy, s) => {
      ctx.fillStyle = CANVAS.yellow
      ctx.beginPath(); ctx.arc(cx, cy, 26 * s, 0, Math.PI * 2); ctx.fill()
      ctx.strokeStyle = 'rgba(234,179,8,0.5)'; ctx.lineWidth = 2
      for (let i = 0; i < 12; i++) {
        const a = (i / 12) * Math.PI * 2
        ctx.beginPath()
        ctx.moveTo(cx + Math.cos(a) * 30 * s, cy + Math.sin(a) * 30 * s)
        ctx.lineTo(cx + Math.cos(a) * 38 * s, cy + Math.sin(a) * 38 * s)
        ctx.stroke()
      }
    },
  },
  {
    exp: 11.2, name: 'فاصلهٔ زمین تا خورشید', size: '$\\sim 1.5 \\times 10^{11}$ m',
    hint: 'یک واحد نجومی (AU) — نوری که حرکت می‌کند حدود ۸ دقیقه و ۲۰ ثانیه طول می‌کشد.',
    draw: (ctx, cx, cy, s) => {
      ctx.strokeStyle = 'rgba(148,163,184,0.5)'; ctx.lineWidth = 1.5
      ctx.beginPath(); ctx.ellipse(cx, cy, 44 * s, 16 * s, 0, 0, Math.PI * 2); ctx.stroke()
      ctx.fillStyle = CANVAS.teal; ctx.beginPath(); ctx.arc(cx - 44 * s, cy, 5 * s, 0, Math.PI * 2); ctx.fill()
      ctx.fillStyle = CANVAS.yellow; ctx.beginPath(); ctx.arc(cx + 44 * s, cy, 9 * s, 0, Math.PI * 2); ctx.fill()
    },
  },
  {
    exp: 21, name: 'کهکشان راه شیری', size: '$\\sim 10^{21}$ m (قطر)',
    hint: 'صدها میلیارد ستاره در یک قرص مارپیچ — خورشید ما یکی از آن‌هاست.',
    draw: (ctx, cx, cy, s) => {
      ctx.strokeStyle = 'rgba(139,92,246,0.8)'; ctx.lineWidth = 2
      for (let k = 0; k < 3; k++) {
        ctx.beginPath()
        for (let i = 0; i <= 30; i++) {
          const a = (k * Math.PI * 2) / 3 + (i / 30) * Math.PI * 1.6
          const r = (4 + i * 1.4) * s
          const x = cx + Math.cos(a) * r
          const y = cy + Math.sin(a) * r * 0.55
          i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y)
        }
        ctx.stroke()
      }
      ctx.fillStyle = 'rgba(250,250,249,0.9)'
      ctx.beginPath(); ctx.arc(cx, cy, 5 * s, 0, Math.PI * 2); ctx.fill()
    },
  },
  {
    exp: 26, name: 'کیهان قابل مشاهده', size: '$\\sim 9 \\times 10^{26}$ m (قطر)',
    hint: 'دورترین مرزی که نورش فرصت کرده به ما برسد — مقیاس کیهان‌شناسی.',
    draw: (ctx, cx, cy, s) => {
      ctx.strokeStyle = CANVAS.violet; ctx.lineWidth = 2
      ctx.beginPath(); ctx.arc(cx, cy, 34 * s, 0, Math.PI * 2); ctx.stroke()
      ctx.fillStyle = CANVAS.white
      for (let i = 0; i < 14; i++) {
        const a = i * 2.399
        const r = (6 + (i % 5) * 5.5) * s
        ctx.beginPath(); ctx.arc(cx + Math.cos(a) * r, cy + Math.sin(a) * r, 1.6 * s, 0, Math.PI * 2); ctx.fill()
      }
    },
  },
]

const EXP_MIN = -15
const EXP_MAX = 26

function U1FundamentalSim() {
  const [exp, setExp] = useState(0)
  const nearest = useMemo(() => {
    let best = SCALE_OBJECTS[0]
    for (const o of SCALE_OBJECTS) if (Math.abs(o.exp - exp) < Math.abs(best.exp - exp)) best = o
    return best
  }, [exp])

  const { canvasRef } = useSimCanvas((ctx, w, h) => {
    ctx.clearRect(0, 0, w, h)
    ctx.fillStyle = CANVAS.bg
    ctx.fillRect(0, 0, w, h)

    const rulerY = h - 64
    const x = (e: number) => 24 + ((e - EXP_MIN) / (EXP_MAX - EXP_MIN)) * (w - 48)

    // ruler base
    ctx.strokeStyle = CANVAS.muted
    ctx.lineWidth = 1.5
    ctx.beginPath(); ctx.moveTo(16, rulerY); ctx.lineTo(w - 16, rulerY); ctx.stroke()
    ctx.font = FONT_MONO
    ctx.textAlign = 'center'
    for (let e = EXP_MIN; e <= EXP_MAX; e += 5) {
      const px = x(e)
      const major = e % 10 === 0
      ctx.strokeStyle = major ? CANVAS.muted : 'rgba(168,162,158,0.4)'
      ctx.beginPath(); ctx.moveTo(px, rulerY); ctx.lineTo(px, rulerY + (major ? 10 : 6)); ctx.stroke()
      ctx.fillStyle = major ? CANVAS.fg : CANVAS.muted
      ctx.fillText(`10^${e}`, px, rulerY + 20)
    }
    faText(ctx, 'متر (توان از ۱۰)', w - 28, rulerY - 14, { align: 'right', size: 11, color: CANVAS.muted })

    // object markers on ruler
    for (const o of SCALE_OBJECTS) {
      const px = x(o.exp)
      const isNear = o === nearest
      ctx.fillStyle = isNear ? CANVAS.amber : 'rgba(168,162,158,0.55)'
      ctx.beginPath(); ctx.arc(px, rulerY - 14, isNear ? 5 : 3, 0, Math.PI * 2); ctx.fill()
      if (isNear) {
        ctx.strokeStyle = 'rgba(245,158,11,0.5)'
        ctx.setLineDash([4, 4])
        ctx.beginPath(); ctx.moveTo(px, rulerY - 8); ctx.lineTo(px, rulerY); ctx.stroke()
        ctx.setLineDash([])
      }
    }

    // lens marker
    const mx = x(exp)
    ctx.strokeStyle = CANVAS.amber; ctx.lineWidth = 2
    ctx.beginPath(); ctx.moveTo(mx, rulerY - 26); ctx.lineTo(mx, rulerY + 4); ctx.stroke()

    // stage: the nearest object, big
    const stageCy = (h - 100) / 2 + 8
    const s = Math.min(1.6, (h - 140) / 110)
    nearest.draw(ctx, w / 2, stageCy, s)

    faText(ctx, nearest.name, w / 2, stageCy - 52 * s - 6, { bold: true, size: 16, color: CANVAS.amber })
    ctx.font = FONT_MONO
    ctx.fillStyle = CANVAS.muted
    ctx.fillText(nearest.size, w / 2, stageCy + 52 * s + 14)

    // hint box
    const bw = Math.min(430, w - 32)
    const bx = (w - bw) / 2
    const by = h - 118
    ctx.fillStyle = 'rgba(41,37,36,0.85)'
    rr(ctx, bx, by, bw, 40, 10); ctx.fill()
    ctx.strokeStyle = 'rgba(245,158,11,0.35)'; ctx.lineWidth = 1; ctx.stroke()
    faText(ctx, nearest.hint, w / 2, by + 20, { size: 11, color: CANVAS.fg })
  }, 430)

  return (
    <SimFrame
      title="مقیاس جهان"
      brief="اسلایدر را جابه‌جا کن تا از دنیای هستهٔ اتم تا کیهان سفر کنی — هر ایستگاه یک نمونهٔ واقعی است."
    >
      <div className="overflow-hidden rounded-lg border">
        <canvas ref={canvasRef} className="block w-full" aria-label="کاوشگر مقیاس‌های طول در فیزیک" />
      </div>
      <div className="flex flex-wrap items-center gap-3">
        <SimSlider
          label="توان از ۱۰ (طول بر حسب متر)"
          value={exp}
          min={EXP_MIN}
          max={EXP_MAX}
          step={0.1}
          onChange={setExp}
          format={(v) => `10^${v.toFixed(1)}`}
          className="min-w-[220px] flex-1"
        />
        <Readout label="نزدیکترین نمونه" value={nearest.name} />
      </div>
    </SimFrame>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// u1-modeling · «آزمایشگاه مدل‌سازی — سقوط اجسام»
// گوی: فقط گرانش (a = g) · برگ: a = g − (k/m)·v با سرعت حدی v_t = g·m/k
// ─────────────────────────────────────────────────────────────────────────────
const G_MS2 = 10
const LEAF_K = 0.035 // kg/s — ثابت مقاومت هوا برای برگ
const SIMUL_TOL = 0.02 // اختلاف زمانی کمتر از این = «هر دو با هم»

interface DropState {
  t: number
  yb: number
  vb: number
  yl: number
  vl: number
  tb: number | null
  tl: number | null
  evaluated: boolean
}

function freshDrop(): DropState {
  return { t: 0, yb: 0, vb: 0, yl: 0, vl: 0, tb: null, tl: null, evaluated: false }
}

/** یک گام کوچک از رهاشدن هر دو جسم؛ زمان فرود هر یک را ثبت می‌کند. */
function advanceDrop(st: DropState, dt: number, h: number, mLeaf: number, air: boolean) {
  if (st.tb === null) {
    const left = h - st.yb
    st.vb += G_MS2 * dt
    const dy = st.vb * dt
    if (dy >= left) {
      st.yb = h
      st.tb = st.t + dt * (left / Math.max(dy, 1e-9))
    } else st.yb += dy
  }
  if (st.tl === null) {
    const left = h - st.yl
    const a = air ? G_MS2 - (LEAF_K / mLeaf) * st.vl : G_MS2
    st.vl = Math.max(0, st.vl + a * dt)
    const dy = st.vl * dt
    if (dy >= left) {
      st.yl = h
      st.tl = st.t + dt * (left / Math.max(dy, 1e-9))
    } else st.yl += dy
  }
  st.t += dt
}

/** زمان فرود برگ با گام ریز عددی — برای حالت «کاهش حرکت» (نتیجهٔ فوری). */
function leafLandingTime(h: number, mLeaf: number, air: boolean): number {
  if (!air) return Math.sqrt((2 * h) / G_MS2)
  let t = 0
  let y = 0
  let v = 0
  const dt = 0.001
  while (y < h && t < 300) {
    const left = h - y
    v = Math.max(0, v + (G_MS2 - (LEAF_K / mLeaf) * v) * dt)
    const dy = v * dt
    if (dy >= left) return t + dt * (left / Math.max(dy, 1e-9))
    y += dy
    t += dt
  }
  return t
}

type Guess = 'ball' | 'both' | 'leaf'

function U1ModelingSim() {
  const reduced = useReducedMotion()
  const winBeep = useWinBeep()
  const [height, setHeight] = useState(20)
  const [mass, setMass] = useState(20) // گرم
  const [air, setAir] = useState(true)
  const [phase, setPhase] = useState<'predict' | 'run' | 'done'>('predict')
  const [guess, setGuess] = useState<Guess | null>(null)
  const [correct, setCorrect] = useState(false)
  const [status, setStatus] = useState('اول حدس بزن کدام زودتر می‌رسد، بعد «رها کردن» را بزن.')
  const dropRef = useRef<DropState>(freshDrop())

  const mLeaf = mass / 1000
  const vt = (G_MS2 * mLeaf) / LEAF_K

  const finish = (tb: number, tl: number, g: Guess | null) => {
    const diff = tb - tl
    const ok =
      (g === 'ball' && diff < -SIMUL_TOL) ||
      (g === 'both' && Math.abs(diff) <= SIMUL_TOL) ||
      (g === 'leaf' && diff > SIMUL_TOL)
    setCorrect(ok)
    setPhase('done')
    if (ok) {
      winBeep()
      setStatus(`درست پیش‌بینی کردی! گوی ${fmtNum(tb)} ثانیه و برگ ${fmtNum(tl)} ثانیه بعد فرود آمد.`)
    } else {
      setStatus(`حدس درست نبود — گوی ${fmtNum(tb)} ثانیه و برگ ${fmtNum(tl)} ثانیه طول کشید.`)
    }
  }

  const reset = () => {
    dropRef.current = freshDrop()
    setPhase('predict')
    setGuess(null)
    setCorrect(false)
    setStatus('حدس تازه: این بار کدام زودتر می‌رسد؟')
  }

  const release = () => {
    const st = freshDrop()
    dropRef.current = st
    if (reduced) {
      const tb = Math.sqrt((2 * height) / G_MS2)
      const tl = leafLandingTime(height, mLeaf, air)
      st.tb = tb
      st.tl = tl
      st.yb = height
      st.yl = height
      st.t = Math.max(tb, tl)
      st.evaluated = true
      finish(tb, tl, guess)
      return
    }
    setPhase('run')
  }

  const { canvasRef } = useSimCanvas((ctx, w, h, t, dt) => {
    ctx.clearRect(0, 0, w, h)
    ctx.fillStyle = CANVAS.bg
    ctx.fillRect(0, 0, w, h)
    drawGrid(ctx, w, h, 40)

    const st = dropRef.current
    if (phase === 'run') {
      const sub = Math.max(1, Math.ceil(dt / 0.004))
      const sdt = dt / sub
      for (let i = 0; i < sub; i++) {
        advanceDrop(st, sdt, height, mLeaf, air)
        if (st.tb !== null && st.tl !== null) break
      }
      if (!st.evaluated && ((st.tb !== null && st.tl !== null) || st.t > 60)) {
        st.evaluated = true
        finish(st.tb ?? st.t, st.tl ?? st.t, guess)
      }
    }

    // هندسهٔ صحنه
    const groundY = h - 40
    const topY = 32
    const scale = (groundY - topY) / Math.max(height, 5)
    const yOf = (fallen: number) => groundY - fallen * scale
    const bx = w * 0.68
    const lx = w * 0.32

    // زمین و خط رهاسازی
    ctx.fillStyle = CANVAS.panel
    ctx.fillRect(0, groundY, w, h - groundY)
    ctx.strokeStyle = CANVAS.muted
    ctx.lineWidth = 2
    ctx.beginPath(); ctx.moveTo(0, groundY); ctx.lineTo(w, groundY); ctx.stroke()
    ctx.setLineDash([5, 5])
    ctx.strokeStyle = 'rgba(148,163,184,0.45)'
    ctx.lineWidth = 1
    ctx.beginPath(); ctx.moveTo(16, topY); ctx.lineTo(w - 16, topY); ctx.stroke()
    ctx.setLineDash([])
    for (let hv = 0; hv <= height; hv += 5) {
      const yy = yOf(hv)
      ctx.strokeStyle = 'rgba(168,162,158,0.35)'
      ctx.lineWidth = 1
      ctx.beginPath(); ctx.moveTo(16, yy); ctx.lineTo(26, yy); ctx.stroke()
      ctx.font = FONT_MONO
      ctx.fillStyle = CANVAS.muted
      ctx.textAlign = 'left'
      ctx.fillText(String(hv), 30, yy + 4)
    }
    faText(ctx, 'ارتفاع (m)', 30, topY - 14, { align: 'left', size: 11, color: CANVAS.muted })

    // گوی فولادی
    const byY = yOf(st.yb)
    ctx.fillStyle = CANVAS.amber
    ctx.beginPath(); ctx.arc(bx, byY, 9, 0, Math.PI * 2); ctx.fill()
    ctx.fillStyle = 'rgba(255,255,255,0.35)'
    ctx.beginPath(); ctx.arc(bx - 3, byY - 3, 3, 0, Math.PI * 2); ctx.fill()

    // برگ کاغذ
    const lfY = yOf(st.yl)
    const rot = phase === 'run' ? Math.sin(t * 6) * 0.5 : 0.35
    ctx.save()
    ctx.translate(lx, lfY)
    ctx.rotate(rot)
    ctx.fillStyle = CANVAS.emerald
    ctx.beginPath(); ctx.ellipse(0, 0, 13, 6, 0, 0, Math.PI * 2); ctx.fill()
    ctx.strokeStyle = 'rgba(16,185,129,0.7)'
    ctx.lineWidth = 1
    ctx.beginPath(); ctx.moveTo(-13, 0); ctx.lineTo(13, 0); ctx.stroke()
    ctx.restore()

    faText(ctx, 'گوی فولادی', bx, 14, { bold: true, size: 12, color: CANVAS.amber })
    faText(ctx, air ? 'برگ کاغذ (با مقاومت هوا)' : 'برگ کاغذ (بی‌مقاومت)', lx, 14, { bold: true, size: 12, color: CANVAS.emerald })
    faText(ctx, `ارتفاع: ${fmtNum(Math.max(0, height - st.yb))} m`, bx, byY + 24, { size: 11, color: CANVAS.muted })
    faText(ctx, `ارتفاع: ${fmtNum(Math.max(0, height - st.yl))} m`, lx, lfY + 24, { size: 11, color: CANVAS.muted })
    if (st.tb !== null) faText(ctx, `فرود: ${fmtNum(st.tb)} s`, bx, h - 16, { size: 11, color: CANVAS.amber })
    if (st.tl !== null) faText(ctx, `فرود: ${fmtNum(st.tl)} s`, lx, h - 16, { size: 11, color: CANVAS.emerald })

    // ساعت
    ctx.fillStyle = 'rgba(41,37,36,0.85)'
    rr(ctx, w / 2 - 56, 44, 112, 24, 8)
    ctx.fill()
    ctx.font = FONT_MONO
    ctx.fillStyle = CANVAS.fg
    ctx.textAlign = 'center'
    ctx.fillText(`t = ${fmtNum(st.t)} s`, w / 2, 56)

    if (phase === 'done') {
      drawBanner(ctx, w, h - 84, correct ? 'درست پیش‌بینی کردی!' : 'حدس درست نبود — دوباره امتحان کن', correct ? 'green' : 'rose')
    } else if (phase === 'predict' && guess !== null) {
      faText(ctx, 'حدس ثبت شد؛ «رها کردن» را بزن.', w / 2, h - 62, { size: 11, color: CANVAS.muted })
    }
  }, 420)

  return (
    <SimFrame
      title="آزمایشگاه مدل‌سازی — سقوط اجسام"
      brief="گوی و برگ را همزمان رها کن؛ پیش از رها کردن حدس بزن کدام زودتر به زمین می‌رسد."
    >
      <div className="overflow-hidden rounded-lg border">
        <canvas ref={canvasRef} className="block w-full" aria-label="آزمایش همزمان سقوط گوی و برگ کاغذ با ساعت دیجیتال" />
      </div>
      <div className="flex flex-wrap items-center gap-3">
        <SimToggle label="مقاومت هوا برای برگ" checked={air} onChange={setAir} className="min-w-[170px]" />
        <SimSlider
          label="ارتفاع رهاسازی"
          value={height}
          min={5}
          max={30}
          step={1}
          unit="m"
          onChange={setHeight}
          disabled={phase !== 'predict'}
          className="min-w-[180px] flex-1"
        />
        <SimSlider
          label="جرم برگ"
          value={mass}
          min={10}
          max={60}
          step={1}
          unit="g"
          onChange={setMass}
          disabled={phase !== 'predict'}
          className="min-w-[180px] flex-1"
        />
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <SimButton variant="secondary" disabled={phase !== 'predict' || guess === 'ball'} onClick={() => setGuess('ball')}>
          گوی زودتر می‌رسد
        </SimButton>
        <SimButton variant="secondary" disabled={phase !== 'predict' || guess === 'both'} onClick={() => setGuess('both')}>
          هر دو با هم
        </SimButton>
        <SimButton variant="secondary" disabled={phase !== 'predict' || guess === 'leaf'} onClick={() => setGuess('leaf')}>
          برگ زودتر می‌رسد
        </SimButton>
        {phase === 'predict' ? (
          <SimButton onClick={release} disabled={guess === null}>رها کردن</SimButton>
        ) : (
          <SimButton variant="outline" onClick={reset}>آزمایش دوباره</SimButton>
        )}
        <Readout label="زمان گوی" value={dropRef.current.tb !== null ? fmtNum(dropRef.current.tb) : '—'} unit="s" />
        <Readout label="زمان برگ" value={dropRef.current.tl !== null ? fmtNum(dropRef.current.tl) : '—'} unit="s" />
        <Readout label="سرعت حدی برگ" value={air ? fmtNum(vt) : '—'} unit={air ? 'm/s' : undefined} />
      </div>
      <p role="status" className="text-sm text-muted-foreground">{status}</p>
      <div className="flex flex-wrap gap-4">
        <Legend color={CANVAS.amber} label="گوی — فقط گرانش" />
        <Legend color={CANVAS.emerald} label="برگ — گرانش و مقاومت هوا" />
      </div>
    </SimFrame>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// u1-quantities · «آزمایشگاه بردار» — نوک بردار را بکش تا با هدف یکی شود
// ─────────────────────────────────────────────────────────────────────────────
const VEC_MAX = 70 // بیشینهٔ اندازه بر حسب نیوتن
const VEC_H = 420

interface Vec {
  mag: number
  ang: number // درجه، پادساعتگرد از محور +x
}

function vecGeom(canvas: HTMLCanvasElement) {
  const w = canvas.clientWidth || 320
  const scale = Math.min((w - 70) / (2 * VEC_MAX), (VEC_H - 90) / (2 * VEC_MAX))
  return { scale, ox: w / 2, oy: VEC_H / 2 + 8 }
}

function vecToPx(v: Vec, scale: number, ox: number, oy: number) {
  const rad = (v.ang * Math.PI) / 180
  return { x: ox + Math.cos(rad) * v.mag * scale, y: oy - Math.sin(rad) * v.mag * scale }
}

function pxToVec(x: number, y: number, scale: number, ox: number, oy: number): Vec {
  const dx = x - ox
  const dy = oy - y
  const mag = Math.hypot(dx, dy) / scale
  let ang = (Math.atan2(dy, dx) * 180) / Math.PI
  if (ang < 0) ang += 360
  return { mag, ang }
}

function randomTarget(): Vec {
  return {
    mag: Math.round((20 + Math.random() * 40) * 10) / 10,
    ang: Math.round(15 + Math.random() * 150),
  }
}

function U1QuantitiesSim() {
  const winBeep = useWinBeep()
  const [target, setTarget] = useState<Vec>(() => randomTarget())
  const [user, setUser] = useState<Vec>({ mag: 30, ang: 45 })
  const [wins, setWins] = useState(0)
  const [msg, setMsg] = useState('نوکِ بردار کهربایی را بکش تا اندازه و جهتش با بردار هدف یکی شود.')
  const draggingRef = useRef(false)
  const matchedRef = useRef(false)
  const timerRef = useRef<number | null>(null)

  useEffect(
    () => () => {
      if (timerRef.current !== null) window.clearTimeout(timerRef.current)
    },
    [],
  )

  const { canvasRef } = useSimCanvas((ctx, w, h) => {
    ctx.clearRect(0, 0, w, h)
    ctx.fillStyle = CANVAS.bg
    ctx.fillRect(0, 0, w, h)
    drawGrid(ctx, w, h, 40)

    const { scale, ox, oy } = vecGeom(ctx.canvas)

    // محورها و اعداد مقیاس
    ctx.strokeStyle = 'rgba(168,162,158,0.6)'
    ctx.lineWidth = 1.5
    ctx.beginPath(); ctx.moveTo(14, oy); ctx.lineTo(w - 14, oy); ctx.stroke()
    ctx.beginPath(); ctx.moveTo(ox, 14); ctx.lineTo(ox, h - 14); ctx.stroke()
    ctx.font = FONT_MONO
    ctx.fillStyle = CANVAS.muted
    ctx.textAlign = 'center'
    for (let n = 10; n <= 60; n += 10) {
      ctx.fillText(String(n), ox + n * scale, oy + 16)
      ctx.textAlign = 'right'
      ctx.fillText(String(n), ox - 8, oy - n * scale)
      ctx.textAlign = 'center'
    }

    // بردار هدف (بنفش، خط‌چین)
    const tp = vecToPx(target, scale, ox, oy)
    drawArrow(ctx, ox, oy, tp.x, tp.y, CANVAS.violet, 2.5, [7, 5])
    ctx.fillStyle = CANVAS.violet
    ctx.beginPath(); ctx.arc(tp.x, tp.y, 4, 0, Math.PI * 2); ctx.fill()
    faText(ctx, `هدف: ${fmtNum(target.mag)} N ∠ ${target.ang}°`, w - 16, 20, { align: 'right', bold: true, size: 12, color: CANVAS.violet })

    // بردار کاربر + مؤلفه‌های خط‌چین
    const up = vecToPx(user, scale, ox, oy)
    ctx.setLineDash([4, 4])
    ctx.strokeStyle = 'rgba(20,184,166,0.8)'
    ctx.lineWidth = 1.2
    ctx.beginPath(); ctx.moveTo(up.x, up.y); ctx.lineTo(up.x, oy); ctx.stroke()
    ctx.beginPath(); ctx.moveTo(up.x, up.y); ctx.lineTo(ox, up.y); ctx.stroke()
    ctx.setLineDash([])
    drawArrow(ctx, ox, oy, up.x, up.y, CANVAS.amber, 3)
    const rad = (user.ang * Math.PI) / 180
    ctx.strokeStyle = 'rgba(245,158,11,0.6)'
    ctx.lineWidth = 1
    ctx.beginPath(); ctx.arc(ox, oy, 26, 0, -rad, true); ctx.stroke()
    ctx.fillStyle = CANVAS.white
    ctx.beginPath(); ctx.arc(up.x, up.y, 7, 0, Math.PI * 2); ctx.fill()
    ctx.strokeStyle = CANVAS.amber
    ctx.lineWidth = 2
    ctx.stroke()

    const fx = Math.cos(rad) * user.mag
    const fy = Math.sin(rad) * user.mag
    faText(ctx, `Fx = ${fmtNum(fx)} N`, (ox + up.x) / 2, oy + 32, { size: 11, color: CANVAS.teal })
    faText(ctx, `Fy = ${fmtNum(fy)} N`, ox + 42, (oy + up.y) / 2, { align: 'right', size: 11, color: CANVAS.teal })

    if (matchedRef.current) drawBanner(ctx, w, 12, 'بردار برگشت!')
  }, VEC_H)

  const onPointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const c = canvasRef.current
    if (!c) return
    const g = vecGeom(c)
    const p = canvasPos(e, c)
    const up = vecToPx(user, g.scale, g.ox, g.oy)
    if (Math.hypot(p.x - up.x, p.y - up.y) <= 22) {
      draggingRef.current = true
      c.setPointerCapture(e.pointerId)
    }
  }

  const onPointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!draggingRef.current) return
    const c = canvasRef.current
    if (!c) return
    const g = vecGeom(c)
    const p = canvasPos(e, c)
    const v = pxToVec(p.x, p.y, g.scale, g.ox, g.oy)
    v.mag = Math.max(1.5, Math.min(VEC_MAX, v.mag))
    setUser(v)
    if (!matchedRef.current) {
      const dMag = Math.abs(v.mag - target.mag)
      let dAng = Math.abs(v.ang - target.ang)
      if (dAng > 180) dAng = 360 - dAng
      if (dMag <= 3 && dAng <= 4) {
        matchedRef.current = true
        setWins((n) => n + 1)
        setMsg(`بردار برگشت! (${fmtNum(target.mag)} N در ${target.ang}°) — هدف جدید در راه است…`)
        winBeep()
        timerRef.current = window.setTimeout(() => {
          setTarget(randomTarget())
          matchedRef.current = false
          timerRef.current = null
        }, 1200)
      }
    }
  }

  const endDrag = () => {
    draggingRef.current = false
  }

  const newTarget = () => {
    if (timerRef.current !== null) {
      window.clearTimeout(timerRef.current)
      timerRef.current = null
    }
    matchedRef.current = false
    setTarget(randomTarget())
    setMsg('هدف تازه! نوک بردار را دوباره بکش.')
  }

  const rad = (user.ang * Math.PI) / 180
  const fx = Math.cos(rad) * user.mag
  const fy = Math.sin(rad) * user.mag

  return (
    <SimFrame
      title="آزمایشگاه بردار"
      brief="نوک بردار را بکش تا با بردار هدف (بنفشِ خط‌چین) هم‌اندازه و هم‌جهت شود؛ مؤلفه‌ها زنده محاسبه می‌شوند."
    >
      <div className="overflow-hidden rounded-lg border">
        <canvas
          ref={canvasRef}
          className="block w-full"
          style={{ touchAction: 'none' }}
          aria-label="بوم کشیدن بردار روی شبکه با نمایش زنده مؤلفه‌ها"
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={endDrag}
          onPointerCancel={endDrag}
        />
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <Readout label="اندازه" value={fmtNum(user.mag)} unit="N" />
        <Readout label="زاویه" value={fmtNum(user.ang)} unit="°" />
        <Readout label="Fx" value={fmtNum(fx)} unit="N" />
        <Readout label="Fy" value={fmtNum(fy)} unit="N" />
        <Readout label="بردارهای برگشته" value={String(wins)} />
        <SimButton variant="outline" onClick={newTarget}>هدف جدید</SimButton>
      </div>
      <p role="status" className="text-sm text-muted-foreground">{msg}</p>
    </SimFrame>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// u1-si-units · مبدل یکاها + نردبان پیشوندها + چالش تبدیل
// ─────────────────────────────────────────────────────────────────────────────
type PrefixQty = 'length' | 'mass' | 'time'

const SI_QTIES: { value: PrefixQty; label: string; base: string }[] = [
  { value: 'length', label: 'طول', base: 'm' },
  { value: 'mass', label: 'جرم', base: 'g' },
  { value: 'time', label: 'زمان', base: 's' },
]

const SI_PREFIXES: { sym: string; label: string; factor: number }[] = [
  { sym: '', label: 'بدون پیشوند', factor: 1 },
  { sym: 'k', label: 'کیلو (k)', factor: 1e3 },
  { sym: 'M', label: 'مگا (M)', factor: 1e6 },
  { sym: 'G', label: 'گیگا (G)', factor: 1e9 },
  { sym: 'd', label: 'دسی (d)', factor: 1e-1 },
  { sym: 'c', label: 'سانتی (c)', factor: 1e-2 },
  { sym: 'm', label: 'میلی (m)', factor: 1e-3 },
  { sym: 'μ', label: 'میکرو (μ)', factor: 1e-6 },
]

const LADDER: { sym: string; factor: number }[] = [
  { sym: 'G', factor: 1e9 }, { sym: 'M', factor: 1e6 }, { sym: 'k', factor: 1e3 },
  { sym: '', factor: 1 }, { sym: 'c', factor: 1e-2 }, { sym: 'm', factor: 1e-3 }, { sym: 'μ', factor: 1e-6 },
]

function fmtSci(v: number): string {
  if (!Number.isFinite(v)) return '—'
  if (v === 0) return '0'
  const a = Math.abs(v)
  if (a >= 1e-2 && a < 1e6) return fmtNum(v)
  const e = Math.floor(Math.log10(a))
  const m = v / Math.pow(10, e)
  return `${fmtNum(m)}e${e}`
}

function U1SiUnitsSim() {
  const winBeep = useWinBeep()
  const [qty, setQty] = useState<PrefixQty>('length')
  const [value, setValue] = useState(2.5)
  const [from, setFrom] = useState(1) // index into SI_PREFIXES (default: k)
  const [to, setTo] = useState(6) // default: m
  const [answer, setAnswer] = useState('')
  const [streak, setStreak] = useState(0)
  const [msg, setMsg] = useState('یک تبدیل انتخاب کن یا چالش تصادفی بگیر.')
  const [task, setTask] = useState<{ value: number; from: number; to: number; res: number } | null>(null)

  const base = SI_QTIES.find((q) => q.value === qty)?.base ?? 'm'
  const fromP = SI_PREFIXES[from]
  const toP = SI_PREFIXES[to]
  const result = (value * fromP.factor) / toP.factor

  const newTask = () => {
    const q = Math.random()
    const val = q < 0.34 ? Math.round(Math.random() * 90 + 10) / 10 : Math.round(Math.random() * 400 + 50)
    const fi = Math.floor(Math.random() * SI_PREFIXES.length)
    let ti = Math.floor(Math.random() * SI_PREFIXES.length)
    if (ti === fi) ti = (ti + 2) % SI_PREFIXES.length
    const res = (val * SI_PREFIXES[fi].factor) / SI_PREFIXES[ti].factor
    setTask({ value: val, from: fi, to: ti, res })
    setAnswer('')
    setMsg('تبدیل تازه! پاسخ عددی را وارد کن.')
  }

  const checkTask = () => {
    if (!task) return
    const v = parseFloat(answer.replace(',', '.'))
    if (!Number.isFinite(v)) return
    const ok = Math.abs(v - task.res) <= 0.02 * Math.abs(task.res) + 1e-12
    if (ok) {
      const s = streak + 1
      setStreak(s)
      if (s >= 3) {
        setMsg('سه تبدیل درستِ پیاپی! استاد پیشوندها شدی. 🎉')
        winBeep()
        setStreak(0)
      } else {
        setMsg(`درست بود! ${s} تبدیل درستِ پیاپی.`)
      }
      window.setTimeout(newTask, 700)
    } else {
      setStreak(0)
      setMsg(`دقیق نبود — پاسخ درست ${fmtSci(task.res)} بود. دوباره تلاش کن!`)
    }
  }

  const { canvasRef } = useSimCanvas((ctx, w, h) => {
    ctx.clearRect(0, 0, w, h)
    ctx.fillStyle = CANVAS.bg
    ctx.fillRect(0, 0, w, h)

    // ladder rail
    const y = h * 0.42
    const x0 = 36
    const x1 = w - 36
    ctx.strokeStyle = CANVAS.muted
    ctx.lineWidth = 2
    ctx.beginPath(); ctx.moveTo(x0, y); ctx.lineTo(x1, y); ctx.stroke()

    const px = (i: number) => x0 + (i / (LADDER.length - 1)) * (x1 - x0)
    const fromI = Math.max(0, LADDER.findIndex((p) => p.factor === fromP.factor))
    const toI = Math.max(0, LADDER.findIndex((p) => p.factor === toP.factor))

    LADDER.forEach((p, i) => {
      const x = px(i)
      ctx.strokeStyle = 'rgba(168,162,158,0.6)'
      ctx.lineWidth = 1.5
      ctx.beginPath(); ctx.moveTo(x, y - 8); ctx.lineTo(x, y + 8); ctx.stroke()
      ctx.font = FONT_MONO
      ctx.textAlign = 'center'
      ctx.fillStyle = CANVAS.fg
      ctx.fillText(p.sym === '' ? '×1' : `×${p.sym === 'μ' ? '10⁻⁶' : p.sym}`, x, y + 26)
      faText(ctx, fmtSci(p.factor), x, y - 20, { size: 10, color: CANVAS.muted })
    })

    // markers
    const mk = (i: number, color: string, label: string) => {
      const x = px(i)
      ctx.fillStyle = color
      ctx.beginPath(); ctx.arc(x, y, 8, 0, Math.PI * 2); ctx.fill()
      faText(ctx, label, x, y - 36, { bold: true, size: 12, color })
    }
    mk(fromI, CANVAS.amber, 'مبدا')
    mk(toI, CANVAS.teal, 'مقصد')

    // direction arrow + hint
    if (fromI !== toI) {
      const leftToRight = toI > fromI
      const ax1 = px(fromI) + (leftToRight ? 12 : -12)
      const ax2 = px(toI) + (leftToRight ? -12 : 12)
      drawArrow(ctx, ax1, y, ax2, y, leftToRight ? CANVAS.emerald : CANVAS.rose, 3, [6, 4])
      faText(
        ctx,
        leftToRight ? 'به سمت راست = ضریب بزرگتر → عدد کوچکتر' : 'به سمت چپ = ضریب کوچکتر → عدد بزرگتر',
        w / 2, y + 52, { size: 12, color: CANVAS.muted },
      )
    }

    // result line
    faText(
      ctx,
      `${fmtNum(value)} ${fromP.sym}${base} = ${fmtSci(result)} ${toP.sym}${base}`,
      w / 2, h * 0.18, { bold: true, size: 15, color: CANVAS.amber },
    )

    if (streak >= 3 || (msg.includes('استاد') && streak === 0 && msg !== '')) {
      drawBanner(ctx, w, 12, 'استاد پیشوندها شدی! 🎉')
    }
  }, 300)

  return (
    <SimFrame
      title="مبدل و نردبان پیشوندها"
      brief="کمیت و پیشوندها را انتخاب کن؛ نردبان نشان می‌دهد حرکت به کدام سمت یعنی ضرب و به کدام سمت یعنی تقسیم. حواست به حجم باشد: 1 m³ = 10⁶ cm³!"
    >
      <div className="overflow-hidden rounded-lg border">
        <canvas ref={canvasRef} className="block w-full" aria-label="نردبان پیشوندهای SI با نشانگر مبدا و مقصد" />
      </div>
      <div className="flex flex-wrap items-end gap-3">
        <SimSelect label="کمیت" value={qty} options={SI_QTIES.map((q) => ({ value: q.value, label: `${q.label} (${q.base})` }))} onChange={setQty} />
        <div>
          <p className="mb-1.5 text-xs font-medium text-muted-foreground">مقدار</p>
          <Input
            inputMode="decimal"
            value={String(value)}
            onChange={(e) => { const v = parseFloat(e.target.value.replace(',', '.')); if (Number.isFinite(v)) setValue(v) }}
            className="w-24 font-mono"
            aria-label="مقدار ورودی"
          />
        </div>
        <SimSelect label="پیشوند مبدا" value={String(from)} options={SI_PREFIXES.map((p, i) => ({ value: String(i), label: p.label }))} onChange={(v) => setFrom(Number(v))} />
        <SimSelect label="پیشوند مقصد" value={String(to)} options={SI_PREFIXES.map((p, i) => ({ value: String(i), label: p.label }))} onChange={(v) => setTo(Number(v))} />
        <Readout label="نتیجه" value={`${fmtSci(result)} ${toP.sym}${base}`} tone="text-amber-600 dark:text-amber-400" />
      </div>

      <div className="rounded-lg border bg-muted/30 p-3 space-y-2">
        <p className="text-sm font-bold">🎯 چالش تبدیل</p>
        {task ? (
          <p className="text-sm">
            {fmtNum(task.value)} <bdi>{SI_PREFIXES[task.from].sym}{base}</bdi> = چند <bdi>{SI_PREFIXES[task.to].sym}{base}</bdi>؟
          </p>
        ) : (
          <p className="text-sm text-muted-foreground">برای شروع دکمهٔ «تبدیل تصادفی» را بزن.</p>
        )}
        <div className="flex flex-wrap items-center gap-2">
          <Input
            inputMode="decimal"
            value={answer}
            onChange={(e) => setAnswer(e.target.value)}
            placeholder="پاسخ؟"
            className="w-32 font-mono"
            aria-label="پاسخ چالش تبدیل"
          />
          <SimButton onClick={checkTask} disabled={!task || answer.trim() === ''}>بررسی</SimButton>
          <SimButton variant="outline" onClick={newTask}>تبدیل تصادفی</SimButton>
          <Readout label="درستِ پیاپی" value={String(streak)} />
        </div>
        <p role="status" className="text-sm text-muted-foreground">{msg}</p>
      </div>
    </SimFrame>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// u1-precision · بازی قرائت خط‌کش با دقت وسیله
// ─────────────────────────────────────────────────────────────────────────────
type RulerDiv = '10' | '5' | '1'

const PRECISION_DIVS: { value: RulerDiv; label: string; stepCm: number }[] = [
  { value: '10', label: '۱ سانتی‌متر', stepCm: 1 },
  { value: '5', label: '۰٫۵ سانتی‌متر', stepCm: 0.5 },
  { value: '1', label: '۱ میلی‌متر', stepCm: 0.1 },
]

function U1PrecisionSim() {
  const winBeep = useWinBeep()
  const [div, setDiv] = useState<RulerDiv>('1')
  const [trueLen, setTrueLen] = useState(3.4)
  const [input, setInput] = useState('')
  const [streak, setStreak] = useState(0)
  const [tried, setTried] = useState(0)
  const [msg, setMsg] = useState('طول جسم را با دقتِ همین خط‌کش بخوان و بنویس (بر حسب cm).')

  const step = PRECISION_DIVS.find((d) => d.value === div)?.stepCm ?? 0.1

  const newSample = () => {
    let len: number
    if (step === 1) len = Math.round(Math.random() * 5 + 2)
    else if (step === 0.5) len = Math.round((Math.random() * 9 + 1.5) * 2) / 2
    else len = Math.round((Math.random() * 70 + 15)) / 10
    setTrueLen(len)
    setInput('')
    setTried(0)
    setMsg('نمونهٔ تازه! طول جسم را با دقتِ همین خط‌کش بخوان (cm).')
  }

  // pick a fresh sample when the ruler changes
  useEffect(() => { newSample() /* eslint-disable-line react-hooks/exhaustive-deps */ }, [div])

  const check = () => {
    const v = parseFloat(input.replace(',', '.'))
    if (!Number.isFinite(v)) return
    const tol = Math.max(step / 2, 0.05)
    const ok = Math.abs(v - trueLen) <= tol + 1e-9
    setTried((t) => t + 1)
    if (ok) {
      const s = streak + 1
      setStreak(s)
      if (s >= 3) {
        setMsg('سه قرائت دقیقِ پیاپی! چشم حرفه‌ای داری. 🎉')
        winBeep()
        setStreak(0)
        window.setTimeout(newSample, 900)
      } else {
        setMsg(`درست بود! طول واقعی ${fmtNum(trueLen)} cm است. (${s} درستِ پیاپی)`)
        window.setTimeout(newSample, 800)
      }
    } else {
      setStreak(0)
      setMsg(`قرائت درست ${fmtNum(trueLen)} cm است؛ یادت باشد قرائت باید هم‌مرتبهٔ دقت وسیله باشد.`)
    }
  }

  const { canvasRef } = useSimCanvas((ctx, w, h) => {
    ctx.clearRect(0, 0, w, h)
    ctx.fillStyle = CANVAS.bg
    ctx.fillRect(0, 0, w, h)

    const rulerY = h * 0.62
    const x0 = 40
    const pxPerCm = (w - 80) / 11
    const x = (cm: number) => x0 + cm * pxPerCm

    // ruler body
    ctx.fillStyle = CANVAS.panel
    rr(ctx, x0 - 14, rulerY - 14, 11 * pxPerCm + 28, 46, 8)
    ctx.fill()
    ctx.strokeStyle = 'rgba(168,162,158,0.5)'
    ctx.lineWidth = 1
    ctx.stroke()

    // ticks per division (label every cm)
    ctx.textAlign = 'center'
    for (let cm = 0; cm <= 10; cm += 0.1) {
      const major = Math.abs(cm - Math.round(cm)) < 1e-6
      const half = Math.abs((cm * 2) % 2 - (step === 0.5 ? 0 : 0)) < 1e-6
      const isHalf = Math.abs((cm * 10) % 5) < 1e-6 && !major
      if (step === 1 && !major) continue
      if (step === 0.5 && !major && !isHalf) continue
      const th = major ? 14 : isHalf && step === 0.5 ? 9 : 7
      ctx.strokeStyle = major ? CANVAS.fg : 'rgba(250,250,249,0.55)'
      ctx.lineWidth = major ? 1.6 : 1
      ctx.beginPath(); ctx.moveTo(x(cm), rulerY - 12); ctx.lineTo(x(cm), rulerY - 12 + th); ctx.stroke()
      if (major) {
        ctx.font = FONT_MONO
        ctx.fillStyle = CANVAS.muted
        ctx.fillText(String(cm), x(cm), rulerY + 18)
      }
    }
    faText(ctx, 'cm', x0 - 26, rulerY - 6, { size: 11, color: CANVAS.muted })

    // measured object
    const obTop = rulerY - 44
    ctx.fillStyle = '#94a3b8'
    rr(ctx, x(0), obTop, trueLen * pxPerCm, 26, 4)
    ctx.fill()
    ctx.strokeStyle = '#e2e8f0'
    ctx.stroke()
    faText(ctx, 'جسم', x(trueLen / 2), obTop + 13, { size: 11, color: '#1c1917' })

    // magnifier inset near the object edge
    const insW = Math.min(190, w * 0.4)
    const insX = w - insW - 16
    const insY = 16
    const zoom = 4
    ctx.fillStyle = 'rgba(41,37,36,0.95)'
    rr(ctx, insX, insY, insW, 92, 10)
    ctx.fill()
    ctx.strokeStyle = 'rgba(245,158,11,0.5)'
    ctx.stroke()
    faText(ctx, 'ذره‌بین روی لبهٔ جسم', insX + insW / 2, insY + 14, { size: 11, color: CANVAS.amber })

    // magnified ticks around the edge
    const edgeCm = trueLen
    const midIns = insX + insW / 2
    const spanCm = insW / (pxPerCm * zoom)
    for (let c = Math.ceil((edgeCm - spanCm / 2) * 10) / 10; c <= edgeCm + spanCm / 2; c += 0.1) {
      const cx = midIns + (c - edgeCm) * pxPerCm * zoom
      if (cx < insX + 8 || cx > insX + insW - 8) continue
      const major = Math.abs(c - Math.round(c)) < 1e-6
      const isHalf = Math.abs((c * 10) % 5) < 1e-6 && !major
      if (step === 1 && !major) continue
      if (step === 0.5 && !major && !isHalf) continue
      ctx.strokeStyle = major ? CANVAS.fg : 'rgba(250,250,249,0.6)'
      ctx.lineWidth = major ? 1.6 : 1
      ctx.beginPath(); ctx.moveTo(cx, insY + 34); ctx.lineTo(cx, insY + 34 + (major ? 22 : 12)); ctx.stroke()
      if (major) {
        ctx.font = FONT_MONO
        ctx.fillStyle = CANVAS.muted
        ctx.fillText(String(Math.round(c)), cx, insY + 74)
      }
    }
    // object edge indicator
    ctx.strokeStyle = CANVAS.rose
    ctx.lineWidth = 2
    ctx.beginPath(); ctx.moveTo(midIns, insY + 30); ctx.lineTo(midIns, insY + 62); ctx.stroke()

    // streak banner
    if (msg.includes('🎉')) drawBanner(ctx, w, 10, msg.replace(' 🎉', ''))
  }, 330)

  return (
    <SimFrame
      title="بازی قرائت خط‌کش"
      brief="درجه‌بندی خط‌کش را عوض کن و ببین دقت چطور تغییر می‌کند؛ قرائتت باید هم‌مرتبهٔ کوچکترین درجه‌بندی باشد."
    >
      <div className="overflow-hidden rounded-lg border">
        <canvas ref={canvasRef} className="block w-full" aria-label="خط‌کش تعاملی با جسم و ذره‌بین برای تمرین قرائت" />
      </div>
      <div className="flex flex-wrap items-end gap-3">
        <SimSelect label="کوچکترین درجه‌بندی" value={div} options={PRECISION_DIVS.map((d) => ({ value: d.value, label: d.label }))} onChange={setDiv} />
        <div>
          <p className="mb-1.5 text-xs font-medium text-muted-foreground">قرائت تو (cm)</p>
          <Input
            inputMode="decimal"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && check()}
            placeholder="؟"
            className="w-28 font-mono"
            aria-label="قرائت شما بر حسب سانتی‌متر"
          />
        </div>
        <SimButton onClick={check} disabled={input.trim() === ''}>بررسی</SimButton>
        <SimButton variant="outline" onClick={newSample}>نمونهٔ جدید</SimButton>
        <Readout label="دقت وسیله" value={`${fmtNum(step)} cm`} />
        <Readout label="درستِ پیاپی" value={String(streak)} />
      </div>
      <p role="status" className="text-sm text-muted-foreground">{msg}</p>
    </SimFrame>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// u1-density · آزمایشگاه چگالی + شناسایی مادهٔ مجهول
// ─────────────────────────────────────────────────────────────────────────────
const DENSITY_FLUIDS: { value: string; label: string; rho: number }[] = [
  { value: 'alcohol', label: 'الکل (۷۹۰)', rho: 790 },
  { value: 'water', label: 'آب (۱۰۰۰)', rho: 1000 },
  { value: 'mercury', label: 'جیوه (۱۳۶۰۰)', rho: 13600 },
]

const MYSTERY_MATERIALS: { value: string; label: string; rho: number }[] = [
  { value: 'ice', label: 'یخ', rho: 900 },
  { value: 'aluminum', label: 'آلومینیوم', rho: 2700 },
  { value: 'iron', label: 'آهن', rho: 7800 },
  { value: 'gold', label: 'طلا', rho: 19300 },
]

function U1DensitySim() {
  const winBeep = useWinBeep()
  const [mass, setMass] = useState(540) // g
  const [volume, setVolume] = useState(200) // cm³
  const [fluid, setFluid] = useState('water')
  const [released, setReleased] = useState(false)
  const [mystery, setMystery] = useState<{ m: number; v: number; mat: string } | null>(null)
  const [guess, setGuess] = useState('aluminum')
  const [msg, setMsg] = useState('جرم و حجم بلوک را تنظیم کن و آن را در مایع رها کن.')
  const posRef = useRef(0) // 0..1 fraction of depth above the floor
  const initRef = useRef(false)
  const reduced = useReducedMotion()

  const rhoB = mass / volume // g/cm³
  const rhoF = (DENSITY_FLUIDS.find((f) => f.value === fluid)?.rho ?? 1000) / 1000 // g/cm³
  const floats = rhoB <= rhoF
  const subFrac = floats ? Math.min(1, rhoB / rhoF) : 1

  // new mystery sample
  const newMystery = () => {
    const mat = MYSTERY_MATERIALS[Math.floor(Math.random() * MYSTERY_MATERIALS.length)]
    const v = (Math.floor(Math.random() * 16) + 5) * 10 // cm³ (multiple of 10 → clean mass)
    const rhoG = mat.rho / 1000 // g/cm³ (table stores kg/m³)
    const m = Math.round(rhoG * v) // g, exact for these materials
    setMystery({ m, v, mat: mat.value })
    setGuess(MYSTERY_MATERIALS.find((x) => x.value !== mat.value)!.value)
    setMsg('مادهٔ مجهول تازه! با جرم و حجم، چگالی را حساب کن و حدس بزن.')
  }

  const { canvasRef } = useSimCanvas((ctx, w, h, _t, dt) => {
    ctx.clearRect(0, 0, w, h)
    ctx.fillStyle = CANVAS.bg
    ctx.fillRect(0, 0, w, h)

    const tank = { x: w * 0.08, y: h * 0.16, w: w * 0.5, h: h * 0.72 }
    const fRho = DENSITY_FLUIDS.find((f) => f.value === fluid)?.rho ?? 1000
    const liqColor = fluid === 'mercury' ? 'rgba(148,163,184,0.55)' : fluid === 'alcohol' ? 'rgba(20,184,166,0.35)' : 'rgba(59,130,246,0.35)'

    // tank + liquid
    ctx.strokeStyle = CANVAS.muted
    ctx.lineWidth = 2
    ctx.strokeRect(tank.x, tank.y, tank.w, tank.h)
    const liqTop = tank.y + tank.h * 0.22
    ctx.fillStyle = liqColor
    ctx.fillRect(tank.x + 1, liqTop, tank.w - 2, tank.y + tank.h - liqTop - 1)
    faText(ctx, 'سطح مایع', tank.x + tank.w - 6, liqTop - 10, { align: 'right', size: 11, color: CANVAS.muted })

    // block geometry (square scaled by volume)
    const side = 26 + Math.sqrt(volume / 500) * 46
    const floorY = tank.y + tank.h - side / 2 - 4
    const surfY = liqTop + side * subFrac - side / 2
    const targetY = released ? (floats ? surfY : floorY) : tank.y + side / 2 + 8

    if (!initRef.current) { posRef.current = targetY; initRef.current = true }
    if (reduced) posRef.current = targetY
    else {
      const k = 1 - Math.exp(-3.2 * dt)
      posRef.current += (targetY - posRef.current) * k
    }
    const bx = tank.x + tank.w / 2
    const by = posRef.current
    const half = side / 2
    const subDepth = Math.max(0, Math.min(side, liqTop + side * subFrac - (by - half)))

    // liquid clip for submerged part (darker overlay)
    ctx.save()
    ctx.beginPath(); ctx.rect(tank.x + 1, liqTop, tank.w - 2, tank.y + tank.h - liqTop - 1); ctx.clip()
    ctx.fillStyle = 'rgba(30,41,59,0.35)'
    ctx.fillRect(bx - half, by - half, side, side)
    ctx.restore()

    // block
    ctx.fillStyle = rhoB > 9 ? CANVAS.yellow : rhoB > 3 ? '#cbd5e1' : CANVAS.orange
    rr(ctx, bx - half, by - half, side, side, 6)
    ctx.fill()
    ctx.strokeStyle = 'rgba(0,0,0,0.4)'
    ctx.stroke()
    faText(ctx, `${fmtNum(rhoB)}`, bx, by, { bold: true, size: 12, color: '#1c1917' })

    // force arrows (true relative scale)
    const wN = (mass / 1000) * 10 // N (kg·m/s²) with g=10
    const subV = (subDepth / side) * volume // cm³
    const fbN = (fRho * subV * 1e-6) * 10 // ρ[kg/m³]·V[m³]·g
    const scale = 60 / Math.max(wN, fbN, 1)
    drawArrow(ctx, bx, by + half + 6, bx, by + half + 6 + Math.min(70, wN * scale), CANVAS.rose, 3)
    faText(ctx, `W = ${fmtNum(wN)} N`, bx + 8, by + half + 16 + Math.min(70, wN * scale) / 2, { align: 'start', size: 11, color: CANVAS.rose })
    if (fbN > 0.01) {
      drawArrow(ctx, bx, by - half - 6, bx, by - half - 6 - Math.min(70, fbN * scale), CANVAS.emerald, 3)
      faText(ctx, `F_b = ${fmtNum(fbN)} N`, bx + 8, by - half - 16 - Math.min(70, fbN * scale) / 2, { align: 'start', size: 11, color: CANVAS.emerald })
    }

    // status panel (right)
    const px = w * 0.62
    const rows: [string, string][] = [
      ['چگالی بلوک', `${fmtNum(rhoB)} g/cm³ = ${fmtNum(rhoB * 1000)} kg/m³`],
      ['چگالی مایع', `${fmtNum(rhoF * 1000)} kg/m³`],
      ['کسر زیر آب', released ? `${Math.round(subFrac * 100)}٪` : '—'],
      ['وضعیت', !released ? 'منتظر رها شدن' : floats ? (subFrac >= 0.999 ? 'تعلیق' : 'شناور') : 'ته‌نشین'],
    ]
    rows.forEach(([k, v], i) => {
      faText(ctx, k, w - 16, h * 0.22 + i * 26, { align: 'end', size: 12, color: CANVAS.muted })
      ctx.font = FONT_MONO
      ctx.textAlign = 'end'
      ctx.fillStyle = CANVAS.fg
      ctx.fillText(v, w - 16, h * 0.22 + i * 26 + 15)
    })

    if (released && Math.abs(posRef.current - targetY) < 1.5) {
      drawBanner(ctx, w, 10, floats ? 'شناور ماند — چگالی بلوک کمتر از مایع است' : 'به کف رفت — چگالی بلوک بیشتر از مایع است', floats ? 'green' : 'rose')
    }
  }, 420)

  return (
    <SimFrame
      title="آزمایشگاه چگالی"
      brief="ρ = m/V — جرم و حجم را عوض کن، بلوک را رها کن و ببین در کدام مایع شناور می‌ماند. فلش‌های نیرو همیشه به مقیاس واقعی‌اند."
    >
      <div className="overflow-hidden rounded-lg border">
        <canvas ref={canvasRef} className="block w-full" aria-label="بوم آزمایش چگالی بلوک در مایع با فلش نیروی شناوری و وزن" />
      </div>
      <div className="flex flex-wrap items-center gap-3">
        <SimSlider label="جرم بلوک" value={mass} min={100} max={800} step={10} unit="g" onChange={(v) => { setMass(v); setReleased(false); initRef.current = false }} className="min-w-[170px]" />
        <SimSlider label="حجم بلوک" value={volume} min={50} max={500} step={10} unit="cm³" onChange={(v) => { setVolume(v); setReleased(false); initRef.current = false }} className="min-w-[170px]" />
        <SimSelect label="مایع" value={fluid} options={DENSITY_FLUIDS.map((f) => ({ value: f.value, label: f.label }))} onChange={(v) => { setFluid(v); setReleased(false) }} />
        <SimButton onClick={() => { setReleased(true); setMsg('رها شد! تعادل را تماشا کن.') }}>{released ? 'دوباره' : 'رها در مایع'}</SimButton>
        <Readout label="ρ بلوک" value={`${fmtNum(rhoB)} g/cm³`} tone="text-amber-600 dark:text-amber-400" />
      </div>

      <div className="rounded-lg border bg-muted/30 p-3 space-y-2">
        <p className="text-sm font-bold">🔎 چالش شناسایی مادهٔ مجهول</p>
        {mystery ? (
          <p className="text-sm">
            جرم <bdi>{fmtNum(mystery.m)} g</bdi> و حجم <bdi>{fmtNum(mystery.v)} cm³</bdi> — چگالی‌اش چند است و کدام ماده است؟
          </p>
        ) : (
          <p className="text-sm text-muted-foreground">برای گرفتن بلوک مجهول، دکمهٔ «نمونهٔ جدید» را بزن.</p>
        )}
        <div className="flex flex-wrap items-center gap-2">
          <SimSelect label="حدس تو" value={guess} options={MYSTERY_MATERIALS.map((m) => ({ value: m.value, label: m.label }))} onChange={setGuess} />
          <SimButton
            disabled={!mystery}
            onClick={() => {
              if (!mystery) return
              if (guess === mystery.mat) {
                setMsg(`درست بود! چگالی ${fmtNum(mystery.m / mystery.v)} g/cm³ یعنی ${MYSTERY_MATERIALS.find((m) => m.value === mystery.mat)?.label}. 🎉`)
                winBeep()
                window.setTimeout(newMystery, 900)
              } else {
                setMsg(`نه! چگالی ${fmtNum(mystery.m / mystery.v)} g/cm³ است؛ با جدول چگالی‌ها مقایسه کن.`)
              }
            }}
          >
            بررسی حدس
          </SimButton>
          <SimButton variant="outline" onClick={newMystery}>نمونهٔ جدید</SimButton>
        </div>
        <p role="status" className="text-sm text-muted-foreground">{msg}</p>
      </div>
    </SimFrame>
  )
}

export const simsCh1: Record<string, SimComponent> = {
  'u1-fundamental': U1FundamentalSim,
  'u1-modeling': U1ModelingSim,
  'u1-quantities': U1QuantitiesSim,
  'u1-si-units': U1SiUnitsSim,
  'u1-precision': U1PrecisionSim,
  'u1-density': U1DensitySim,
}
