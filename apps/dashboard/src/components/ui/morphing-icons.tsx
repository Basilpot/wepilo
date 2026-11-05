'use client'

import { useEffect, useId, useRef, useState, type ComponentProps, type ReactNode } from 'react'
import {
  animate,
  motion,
  useMotionValue,
  useMotionValueEvent,
  useReducedMotion,
  useTime,
  useTransform,
  type MotionValue,
  type Transition,
} from 'motion/react'

import { CopyCheck } from '@/components/ui/copy-check'
import { cn } from '@/lib/utils'

const MORPH: Transition = { type: 'spring', duration: 0.5, bounce: 0 }

const STAGED: Transition = { duration: 0.62, ease: [0.65, 0, 0.35, 1] }
const BLINK: Transition = { type: 'spring', duration: 0.45, bounce: 0 }
const DUSK: Transition = { type: 'spring', duration: 0.6, bounce: 0 }
const LISTEN: Transition = { duration: 0.75, ease: [0.65, 0, 0.35, 1] }

function useMorph(target: number, transition: Transition = MORPH, delay = 0) {
  const value = useMotionValue(target)
  const still = useReducedMotion()
  useEffect(() => {
    if (value.get() === target && !value.isAnimating()) return
    const controls = animate(value, target, still ? { duration: 0 } : { ...transition, delay })
    return () => controls.stop()
  }, [value, target, still, transition, delay])
  return value
}

type Pt = readonly [number, number]

const clamp01 = (v: number) => Math.min(1, Math.max(0, v))
const lerp = (a: number, b: number, t: number) => a + (b - a) * t
const smooth = (x: number) => x * x * (3 - 2 * x)
const stage = (t: number, from: number, to: number) => smooth(clamp01((t - from) / (to - from)))

const visible = (length: number) => clamp01(length * 6)

const lerpPts = (a: readonly Pt[], b: readonly Pt[], t: number): Pt[] =>
  a.map((p, i) => [lerp(p[0], b[i]![0], t), lerp(p[1], b[i]![1], t)] as const)

const n = (v: number) => Math.round(v * 1000) / 1000
const pt = (p: Pt) => `${n(p[0])} ${n(p[1])}`
const line = (a: Pt, b: Pt) => `M${pt(a)}L${pt(b)}`
const polyline = (pts: readonly Pt[]) => pts.map((p, i) => `${i ? 'L' : 'M'}${pt(p)}`).join('')
const cubic2 = (p: readonly Pt[]) =>
  `M${pt(p[0]!)}C${pt(p[1]!)} ${pt(p[2]!)} ${pt(p[3]!)}C${pt(p[4]!)} ${pt(p[5]!)} ${pt(p[6]!)}`

function roundedPolygon(pts: readonly Pt[], radius: number) {
  const count = pts.length
  const corners = pts.map((p, i) => {
    const prev = pts[(i - 1 + count) % count]!
    const next = pts[(i + 1) % count]!
    const d1 = Math.hypot(prev[0] - p[0], prev[1] - p[1])
    const d2 = Math.hypot(next[0] - p[0], next[1] - p[1])
    const r = Math.min(radius, d1 / 2, d2 / 2)
    const toward = (q: Pt, d: number): Pt =>
      d < 1e-6 ? p : [p[0] + ((q[0] - p[0]) * r) / d, p[1] + ((q[1] - p[1]) * r) / d]
    return { into: toward(prev, d1), at: p, out: toward(next, d2) }
  })
  let d = `M${pt(corners[0]!.out)}`
  for (let i = 1; i <= count; i++) {
    const c = corners[i % count]!
    d += `L${pt(c.into)}Q${pt(c.at)} ${pt(c.out)}`
  }
  return `${d}Z`
}

type MorphingIconProps = Omit<ComponentProps<'svg'>, 'children'> & {
  size?: number
  strokeWidth?: number
}

function Glyph({
  size = 24,
  strokeWidth = 1.5,
  className,
  children,
  ...props
}: MorphingIconProps & { children: ReactNode }) {
  return (
    <svg
      data-slot="morphing-icon"
      viewBox="0 0 24 24"
      width={size}
      height={size}
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
      className={cn('shrink-0', className)}
      {...props}
    >
      {children}
    </svg>
  )
}

function CopyIcon({
  copied = false,
  size = 24,
  strokeWidth = 1.5,
  className,
}: {
  copied?: boolean
  size?: number
  strokeWidth?: number
  className?: string
}) {
  return <CopyCheck copied={copied} size={size} strokeWidth={strokeWidth} className={className} />
}

const PLAY: Pt[] = [
  [5.5, 4.6],
  [19, 11.2],
  [19, 12.8],
  [5.5, 19.4],
]
const BAR_START: Pt[] = [
  [5, 4],
  [10, 4],
  [10, 20],
  [5, 20],
]
const BAR_END: Pt[] = [
  [14, 4],
  [19, 4],
  [19, 20],
  [14, 20],
]

function Interior({
  id,
  d,
  strokeWidth,
}: {
  id: string
  d: MotionValue<string>
  strokeWidth: number
}) {
  return (
    <mask id={id} maskUnits="userSpaceOnUse" x="-2" y="-2" width="28" height="28">
      <rect x="-2" y="-2" width="28" height="28" fill="#fff" />
      <motion.path d={d} fill="#000" stroke="#fff" strokeWidth={strokeWidth} />
    </mask>
  )
}

function PlayPauseIcon({
  playing = false,
  strokeWidth = 1.5,
  ...props
}: MorphingIconProps & { playing?: boolean }) {
  const t = useMorph(playing ? 1 : 0)
  const id = useId()
  const first = useTransform(t, (v) => roundedPolygon(lerpPts(PLAY, BAR_START, v), 2.4))
  const second = useTransform(t, (v) => roundedPolygon(lerpPts(PLAY, BAR_END, v), 2.4))

  const secondOpacity = useTransform(t, (v) => clamp01(v * 25))
  return (
    <Glyph strokeWidth={strokeWidth} {...props}>
      <defs>
        <Interior id={`${id}-a`} d={second} strokeWidth={strokeWidth} />
        <Interior id={`${id}-b`} d={first} strokeWidth={strokeWidth} />
      </defs>
      <motion.path d={first} mask={`url(#${id}-a)`} />
      <motion.path d={second} opacity={secondOpacity} mask={`url(#${id}-b)`} />
    </Glyph>
  )
}

function bar(v: number, from: number, turn: 1 | -1) {
  const travel = stage(v, 0, 0.6)
  const rotate = stage(v, 0.3, 1)
  const cy = lerp(from, 12, travel)
  const angle = (turn * Math.PI * rotate) / 4
  const half = lerp(8, 8.485, rotate)
  const dx = half * Math.cos(angle)
  const dy = half * Math.sin(angle)
  return line([12 - dx, cy - dy], [12 + dx, cy + dy])
}

function MenuIcon({ open = false, ...props }: MorphingIconProps & { open?: boolean }) {
  const t = useMorph(open ? 1 : 0)
  const top = useTransform(t, (v) => bar(v, 5, 1))
  const bottom = useTransform(t, (v) => bar(v, 19, -1))
  const middle = useTransform(t, (v) => {
    const half = lerp(8, 0, stage(v, 0, 0.4))
    return line([12 - half, 12], [12 + half, 12])
  })
  const middleOpacity = useTransform(t, (v) => 1 - stage(v, 0.05, 0.3))
  return (
    <Glyph {...props}>
      <motion.path d={top} />
      <motion.path d={middle} opacity={middleOpacity} />
      <motion.path d={bottom} />
    </Glyph>
  )
}

function Ray({ t, k }: { t: MotionValue<number>; k: number }) {
  const from = k * 0.05
  const d = useTransform(t, (v) => {
    const a = ((-90 + k * 45 + v * 30) * Math.PI) / 180
    const reach = lerp(10, 8.5, stage(v, from, from + 0.4))
    return line(
      [12 + 8.5 * Math.cos(a), 12 + 8.5 * Math.sin(a)],
      [12 + reach * Math.cos(a), 12 + reach * Math.sin(a)],
    )
  })
  const opacity = useTransform(t, (v) => 1 - stage(v, from, from + 0.25))
  return <motion.path d={d} opacity={opacity} />
}

const CUTTER = 8.2

function ThemeIcon({
  dark = false,
  strokeWidth = 1.5,
  ...props
}: MorphingIconProps & { dark?: boolean }) {
  const t = useMorph(dark ? 1 : 0, DUSK)
  const id = useId()
  const body = useTransform(t, (v) => lerp(4.5, 9, v))
  const bodyClip = useTransform(body, (r) => r + strokeWidth / 2)
  const cutX = useTransform(t, (v) => lerp(26, 17.5, v))
  const cutY = useTransform(t, (v) => lerp(-2, 6.5, v))
  return (
    <Glyph strokeWidth={strokeWidth} {...props}>

      <defs>
        <mask id={`${id}-cut`} maskUnits="userSpaceOnUse" x="0" y="0" width="24" height="24">
          <rect width="24" height="24" fill="#fff" />
          <motion.circle
            cx={cutX}
            cy={cutY}
            r={CUTTER - strokeWidth / 2}
            fill="#000"
            stroke="none"
          />
        </mask>
        <clipPath id={`${id}-body`}>
          <motion.circle cx={12} cy={12} r={bodyClip} />
        </clipPath>
      </defs>
      <motion.circle cx={12} cy={12} r={body} mask={`url(#${id}-cut)`} />
      <motion.circle cx={cutX} cy={cutY} r={CUTTER} clipPath={`url(#${id}-body)`} />
      {Array.from({ length: 8 }, (_, k) => (
        <Ray key={k} t={t} k={k} />
      ))}
    </Glyph>
  )
}

const LID_UPPER: Pt[] = [
  [2, 12],
  [3.8, 9.2],
  [7.5, 5],
  [12, 5],
  [16.5, 5],
  [20.2, 9.2],
  [22, 12],
]
const LID_LOWER: Pt[] = [
  [2, 12],
  [3.8, 14.8],
  [7.5, 19],
  [12, 19],
  [16.5, 19],
  [20.2, 14.8],
  [22, 12],
]
const LID_SHUT: Pt[] = [
  [2, 8.5],
  [2, 8.5],
  [6, 14.5],
  [12, 14.5],
  [18, 14.5],
  [22, 8.5],
  [22, 8.5],
]
const LASHES: Array<[Pt, Pt]> = [
  [
    [9, 14],
    [7.5, 16.5],
  ],
  [
    [15, 14],
    [16.5, 16.5],
  ],
  [
    [4, 11.5],
    [2, 13.5],
  ],
  [
    [20, 11.5],
    [22, 13.5],
  ],
]

function Lash({ t, k }: { t: MotionValue<number>; k: number }) {
  const [a, b] = LASHES[k]!
  const from = 0.6 + (k >> 1) * 0.08
  const length = useTransform(t, (v) => stage(v, from, from + 0.3))
  const opacity = useTransform(length, visible)
  return <motion.path d={line(a, b)} pathLength={length} opacity={opacity} />
}

function EyeIcon({ closed = false, ...props }: MorphingIconProps & { closed?: boolean }) {
  const t = useMorph(closed ? 1 : 0, BLINK)
  const id = useId()
  const shut = useTransform(t, (v) => stage(v, 0, 0.7))
  const upper = useTransform(shut, (p) => cubic2(lerpPts(LID_UPPER, LID_SHUT, p)))
  const lower = useTransform(shut, (p) => cubic2(lerpPts(LID_LOWER, LID_SHUT, p)))

  const opening = useTransform(shut, (p) => {
    const u = lerpPts(LID_UPPER, LID_SHUT, p)
    const l = lerpPts(LID_LOWER, LID_SHUT, p)
    return `${cubic2(u)}C${pt(l[5]!)} ${pt(l[4]!)} ${pt(l[3]!)}C${pt(l[2]!)} ${pt(l[1]!)} ${pt(l[0]!)}Z`
  })

  const lowerOpacity = useTransform(t, (v) => 1 - stage(v, 0.6, 0.7))
  const pupilY = useTransform(shut, (p) => lerp(12, 13.5, p))
  const pupilR = useTransform(shut, (p) => lerp(3, 2.2, p))
  return (
    <Glyph {...props}>
      <defs>
        <clipPath id={`${id}-open`}>
          <motion.path d={opening} />
        </clipPath>
      </defs>
      <motion.circle cx={12} cy={pupilY} r={pupilR} clipPath={`url(#${id}-open)`} />
      <motion.path d={upper} />
      <motion.path d={lower} opacity={lowerOpacity} />
      {LASHES.map((_, k) => (
        <Lash key={k} t={t} k={k} />
      ))}
    </Glyph>
  )
}

const SHACKLE_LEG = 5.5
const SHACKLE_LENGTH = SHACKLE_LEG * 2 + Math.PI * 4

const SHACKLE_OPEN = (SHACKLE_LENGTH - SHACKLE_LEG + 1.2) / SHACKLE_LENGTH

const SIDE: readonly { from: Pt; to: Pt }[] = [
  { from: [6, 9], to: [2.9, 6.6] },
  { from: [7, 8.1], to: [5.6, 4.2] },
]
const mirror = ([x, y]: Pt): Pt => [24 - x, y]

const SPARKS = SIDE.flatMap((spark) => [spark, { from: mirror(spark.from), to: mirror(spark.to) }])
const SPARK: Transition = {
  duration: 0.45,
  ease: [0.23, 1, 0.32, 1],

  opacity: { duration: 0.45, times: [0, 0.45, 1], ease: 'easeOut' },
}

function LockIcon({ unlocked = false, ...props }: MorphingIconProps & { unlocked?: boolean }) {
  const t = useMorph(unlocked ? 1 : 0)
  const id = useId()
  const still = useReducedMotion()

  const armed = useRef(false)
  const [burst, setBurst] = useState(0)
  useEffect(() => {
    armed.current = !unlocked && !still
  }, [unlocked, still])
  useMotionValueEvent(t, 'change', (v) => {

    if (!armed.current || v > 0.35) return
    armed.current = false
    setBurst((count) => count + 1)
  })
  const shackle = useTransform(t, (v) => {
    const dy = -2 * stage(v, 0, 0.7)
    return `M8 ${13 + dy}V${7.5 + dy}A4 4 0 0 1 16 ${7.5 + dy}V${13 + dy}`
  })
  const length = useTransform(t, (v) => lerp(1, SHACKLE_OPEN, stage(v, 0.2, 1)))
  return (
    <Glyph {...props}>

      <defs>
        <mask id={`${id}-body`} maskUnits="userSpaceOnUse" x="0" y="0" width="24" height="24">
          <rect width="24" height="24" fill="#fff" />
          <rect x="4.5" y="10" width="15" height="11.5" rx="4" fill="#000" stroke="none" />
        </mask>
      </defs>
      <g mask={`url(#${id}-body)`}>
        <motion.path d={shackle} pathLength={length} />
      </g>
      <rect x="4.5" y="10" width="15" height="11.5" rx="4" />
      <path d="M12 14.75V16.75" />
      {burst > 0 && (
        <g key={burst} fill="currentColor" stroke="none">
          {SPARKS.map((spark, k) => (
            <motion.circle
              key={k}
              initial={{ cx: spark.from[0], cy: spark.from[1], r: 1.35, opacity: 1 }}
              animate={{ cx: spark.to[0], cy: spark.to[1], r: 0.7, opacity: [1, 1, 0] }}
              transition={SPARK}
            />
          ))}
        </g>
      )}
    </Glyph>
  )
}

const SPEAKER =
  'M11 4.702a.705.705 0 0 0-1.203-.498L6.413 7.587A1.4 1.4 0 0 1 5.416 8H3a1 1 0 0 0-1 1v6a1 1 0 0 0 1 1h2.416a1.4 1.4 0 0 1 .997.413l3.383 3.384A.705.705 0 0 0 11 19.298z'
const WAVE_INNER = 'M16 9a5 5 0 0 1 0 6'
const WAVE_OUTER = 'M19.364 18.364a9 9 0 0 0 0-12.728'
const SLASH = 'M2 2 22 22'

function VolumeIcon({ muted = false, ...props }: MorphingIconProps & { muted?: boolean }) {
  const id = useId()
  return (
    <Glyph data-muted={muted} {...props}>

      <mask id={`${id}-slash`}>
        <rect width="24" height="24" fill="white" />
        <path className="sound-slash" d={SLASH} pathLength={1} stroke="black" strokeWidth={4} />
      </mask>
      <g mask={`url(#${id}-slash)`}>
        <path className="sound-speaker" d={SPEAKER} />
        <path className="sound-wave sound-wave-inner" d={WAVE_INNER} />
        <path className="sound-wave sound-wave-outer" d={WAVE_OUTER} />
      </g>
      <path className="sound-slash" d={SLASH} pathLength={1} />
    </Glyph>
  )
}

const ARROWHEAD: Pt[] = [
  [7.5, 11],
  [12, 15.5],
  [16.5, 11],
]
const TICK: Pt[] = [
  [7, 10.5],
  [10.5, 14],
  [17, 7.5],
]
const TRAY = 'M3 16.5V17a4 4 0 0 0 4 4h10a4 4 0 0 0 4-4v-.5'

function DownloadIcon({ done = false, ...props }: MorphingIconProps & { done?: boolean }) {
  const t = useMorph(done ? 1 : 0, STAGED)
  const bend = useTransform(t, (v) => stage(v, 0.3, 1))
  const head = useTransform(bend, (p) => polyline(lerpPts(ARROWHEAD, TICK, p)))
  const shaft = useTransform([t, bend], ([v, p]: number[]) => {
    const [x, y] = lerpPts(ARROWHEAD, TICK, p!)[1]!
    return line([x, lerp(3, y, stage(v!, 0, 0.6))], [x, y])
  })
  const shaftOpacity = useTransform(t, (v) => 1 - stage(v, 0.45, 0.6))
  return (
    <Glyph {...props}>
      <path d={TRAY} />
      <motion.path d={shaft} opacity={shaftOpacity} />
      <motion.path d={head} />
    </Glyph>
  )
}

const TILE = 7
const TILE_RADIUS = 2.2

function LayoutRow({ rows, y, delay }: { rows: boolean; y: number; delay: number }) {
  const t = useMorph(rows ? 1 : 0, MORPH, delay)
  const width = useTransform(t, (v) => lerp(TILE, 18, v))

  const fold = useTransform(t, (v) => stage(v, 0, 0.6))
  const partnerX = useTransform(fold, (f) => lerp(14, 20.5, f))
  const partnerWidth = useTransform(fold, (f) => lerp(TILE, 0.5, f))
  const partnerRadius = useTransform(partnerWidth, (w) => Math.min(TILE_RADIUS, w / 2))
  const partnerOpacity = useTransform(t, (v) => 1 - stage(v, 0.2, 0.55))
  return (
    <>
      <motion.rect x={3} y={y} width={width} height={TILE} rx={TILE_RADIUS} />
      <motion.rect
        x={partnerX}
        y={y}
        width={partnerWidth}
        height={TILE}
        rx={partnerRadius}
        opacity={partnerOpacity}
      />
    </>
  )
}

function LayoutIcon({ rows = false, ...props }: MorphingIconProps & { rows?: boolean }) {
  return (
    <Glyph {...props}>
      <LayoutRow rows={rows} y={3} delay={0} />
      <LayoutRow rows={rows} y={14} delay={0.05} />
    </Glyph>
  )
}

const ALIGN_LINES = [
  { y: 4, width: 18 },
  { y: 9.33, width: 12 },
  { y: 14.67, width: 16 },
  { y: 20, width: 9 },
]
const ALIGN_STOPS = { left: 0, center: 1, right: 2 } as const

function AlignLine({
  at,
  y,
  width,
  delay,
}: {
  at: number
  y: number
  width: number
  delay: number
}) {
  const t = useMorph(at, MORPH, delay)

  const d = useTransform(t, (v) => {
    const x = 3 + (v / 2) * (18 - width)
    return line([x, y], [x + width, y])
  })
  return <motion.path d={d} />
}

function AlignIcon({
  align = 'left',
  ...props
}: MorphingIconProps & { align?: keyof typeof ALIGN_STOPS }) {
  return (
    <Glyph {...props}>
      {ALIGN_LINES.map(({ y, width }, i) => (
        <AlignLine key={y} at={ALIGN_STOPS[align]} y={y} width={width} delay={i * 0.04} />
      ))}
    </Glyph>
  )
}

const WAVEFORM = [
  { x: 4, height: 2.5, ring: 2, hz: 1.7, phase: 0.2 },
  { x: 8, height: 5.5, ring: 1, hz: 1.3, phase: 1.9 },
  { x: 16, height: 5.5, ring: 1, hz: 1.5, phase: 3.4 },
  { x: 20, height: 2.5, ring: 2, hz: 1.9, phase: 4.6 },
]

const breathe = (v: number, ms: number, hz: number, phase: number, still: boolean) =>
  still ? 1 : 1 + 0.32 * stage(v, 0.85, 1) * Math.sin((ms / 1000) * Math.PI * 2 * hz + phase)

function WaveBar({
  t,
  time,
  still,
  x,
  height,
  ring,
  hz,
  phase,
}: {
  t: MotionValue<number>
  time: MotionValue<number>
  still: boolean
} & (typeof WAVEFORM)[number]) {
  const from = 0.45 + (ring - 1) * 0.12
  const d = useTransform([t, time], ([v, ms]: number[]) => {
    const half = height * stage(v!, from, from + 0.4) * breathe(v!, ms!, hz, phase, still)
    return line([x, 12 - half], [x, 12 + half])
  })
  const opacity = useTransform(t, (v) => visible(stage(v, from, from + 0.4)))
  return <motion.path d={d} opacity={opacity} />
}

function MicIcon({ listening = false, ...props }: MorphingIconProps & { listening?: boolean }) {
  const t = useMorph(listening ? 1 : 0, LISTEN)
  const time = useTime()
  const still = useReducedMotion() ?? false

  const capsule = useTransform([t, time], ([v, ms]: number[]) => {
    const p = stage(v!, 0.1, 0.7)
    const width = lerp(10, 0.01, p)
    const height = lerp(14, 16 * breathe(v!, ms!, 1.1, 0, still), p)
    const cy = lerp(9, 12, p)
    return { x: 12 - width / 2, y: cy - height / 2, width, height }
  })
  const capX = useTransform(capsule, (c) => c.x)
  const capY = useTransform(capsule, (c) => c.y)
  const capWidth = useTransform(capsule, (c) => c.width)
  const capHeight = useTransform(capsule, (c) => c.height)
  const capRadius = useTransform(capsule, (c) => c.width / 2)
  const holder = useTransform(t, (v) => 1 - stage(v, 0, 0.45))
  const holderOffset = useTransform(holder, (l) => (1 - l) / 2)
  const holderOpacity = useTransform(holder, visible)
  const stand = useTransform(t, (v) => {
    const k = 1 - stage(v, 0, 0.35)
    return `M12 19V${19 + 3 * k}${line([12 - 3 * k, 22], [12 + 3 * k, 22])}`
  })
  const standOpacity = useTransform(t, (v) => 1 - stage(v, 0.15, 0.35))
  return (
    <Glyph {...props}>
      <motion.path
        d="M4 11C4 15.418 7.582 19 12 19C16.418 19 20 15.418 20 11"
        style={{ pathLength: holder, pathOffset: holderOffset, opacity: holderOpacity }}
      />
      <motion.path d={stand} opacity={standOpacity} />
      <motion.rect x={capX} y={capY} width={capWidth} height={capHeight} rx={capRadius} />
      {WAVEFORM.map((bar) => (
        <WaveBar key={bar.x} t={t} time={time} still={still} {...bar} />
      ))}
    </Glyph>
  )
}

const BUBBLE = { x: 3, y: 4.5, width: 18, height: 12.5, rx: 4.5 }

const DOTS = [
  { cx: 6.5, from: 0.12, phase: 0 },
  { cx: 12, from: 0.2, phase: 0.9 },
  { cx: 17.5, from: 0.28, phase: 1.8 },
] as const
const DOT = 2.4
const DOT_Y = 11

function TypingDot({
  t,
  time,
  still,
  cx,
  from,
  phase,
}: {
  t: MotionValue<number>
  time: MotionValue<number>
  still: boolean
} & (typeof DOTS)[number]) {
  const box = useTransform([t, time], ([v, ms]: number[]) => {
    const p = stage(v!, from, from + 0.5)

    const hop = still
      ? 0
      : -1.5 * stage(v!, 0.82, 1) * Math.max(0, Math.sin((ms! / 1000) * Math.PI * 2.2 - phase))
    const width = lerp(BUBBLE.width, DOT, p)
    const height = lerp(BUBBLE.height, DOT, p)
    const x = lerp(BUBBLE.x, cx - DOT / 2, p)
    const y = lerp(BUBBLE.y, DOT_Y - DOT / 2, p) + hop
    return { x, y, width, height, rx: lerp(BUBBLE.rx, DOT / 2, p) }
  })
  const x = useTransform(box, (b) => b.x)
  const y = useTransform(box, (b) => b.y)
  const width = useTransform(box, (b) => b.width)
  const height = useTransform(box, (b) => b.height)
  const rx = useTransform(box, (b) => b.rx)

  const fill = useTransform(t, (v) => stage(v, from + 0.35, from + 0.5))
  return (
    <motion.rect
      x={x}
      y={y}
      width={width}
      height={height}
      rx={rx}
      fill="currentColor"
      style={{ fillOpacity: fill }}
    />
  )
}

function MessageIcon({ typing = false, ...props }: MorphingIconProps & { typing?: boolean }) {
  const t = useMorph(typing ? 1 : 0, LISTEN)
  const time = useTime()
  const still = useReducedMotion() ?? false
  const tail = useTransform(t, (v) => 1 - stage(v, 0, 0.3))
  const tailOpacity = useTransform(tail, visible)
  return (
    <Glyph {...props}>

      <motion.path d="M10 17L6.5 20.5V17" style={{ pathLength: tail, opacity: tailOpacity }} />
      {DOTS.map((dot) => (
        <TypingDot key={dot.cx} t={t} time={time} still={still} {...dot} />
      ))}
    </Glyph>
  )
}

export {
  AlignIcon,
  CopyIcon,
  DownloadIcon,
  EyeIcon,
  LayoutIcon,
  LockIcon,
  MenuIcon,
  MessageIcon,
  MicIcon,
  PlayPauseIcon,
  ThemeIcon,
  VolumeIcon,
  type MorphingIconProps,
}
