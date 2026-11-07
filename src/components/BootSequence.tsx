import { useEffect, useRef, useState } from 'react'
import gsap from 'gsap'
import './BootSequence.css'

// Once the intro has run to the end (or been skipped) during this page load,
// it stays off for in-app navigation back to the home route. A full reload
// plays it again.
let introPlayed = false

interface Slot {
  label: string
  x: number
  y: number
  w: number
  h: number
  bars: boolean
}

// Wireframe the agents draw, as fractions of the viewport.
const DESKTOP_SLOTS: Slot[] = [
  { label: 'nav.header', x: 0.02, y: 0.09, w: 0.96, h: 0.07, bars: false },
  { label: 'hero.rift', x: 0.03, y: 0.19, w: 0.46, h: 0.58, bars: true },
  { label: 'profile.card', x: 0.52, y: 0.19, w: 0.45, h: 0.27, bars: true },
  { label: 'media.player', x: 0.52, y: 0.49, w: 0.45, h: 0.28, bars: true },
  { label: 'footer.links', x: 0.02, y: 0.81, w: 0.96, h: 0.07, bars: false },
]

const MOBILE_SLOTS: Slot[] = [
  { label: 'nav.header', x: 0.04, y: 0.09, w: 0.92, h: 0.05, bars: false },
  { label: 'hero.rift', x: 0.04, y: 0.16, w: 0.92, h: 0.36, bars: true },
  { label: 'profile.card', x: 0.04, y: 0.55, w: 0.92, h: 0.16, bars: true },
  { label: 'media.player', x: 0.04, y: 0.73, w: 0.92, h: 0.12, bars: true },
  { label: 'footer.links', x: 0.04, y: 0.87, w: 0.92, h: 0.05, bars: false },
]

const AGENTS = ['agent.layout', 'agent.grid', 'agent.dom', 'agent.render', 'agent.theme']
const GLYPHS = '01<>/{}[]#$%&*+'

// Timeline constants (seconds)
const FIRST = 0.5 // delay before the first agent moves
const GAP = 0.22 // stagger between agents
const TRAVEL = 0.7 // cursor flight to a box corner
const DRAW = 0.8 // drag from top-left to bottom-right
const LOCK = 0.6 // label decode after a box locks
const EXIT_AT = 3.9 // CRT collapse starts here

const STAGE_LOG: [number, string][] = [
  [0, 'INITIALIZING LAYOUT ENGINE'],
  [0.5, 'SPAWNING AGENTS'],
  [1.4, 'DRAWING WIREFRAME'],
  [2.9, 'LOCKING COMPONENTS'],
  [3.6, 'RENDER HANDSHAKE OK'],
]

function prefersReducedMotion(): boolean {
  return typeof window !== 'undefined' && !!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
}

function spawnPoint(i: number, vw: number, vh: number) {
  switch (i % 4) {
    case 0: return { x: -40, y: Math.random() * vh }
    case 1: return { x: vw + 40, y: Math.random() * vh }
    case 2: return { x: Math.random() * vw, y: -40 }
    default: return { x: Math.random() * vw, y: vh + 40 }
  }
}

// Decode-style text reveal: glyphs resolve left to right into the final text.
function scrambleTo(tl: gsap.core.Timeline, el: HTMLElement, text: string, at: number, duration: number) {
  const o = { p: 0 }
  tl.to(o, {
    p: 1,
    duration,
    ease: 'none',
    onUpdate: () => {
      const resolved = Math.floor(o.p * text.length)
      let out = ''
      for (let k = 0; k < text.length; k++) {
        out += k < resolved || text[k] === ' ' ? text[k] : GLYPHS[Math.floor(Math.random() * GLYPHS.length)]
      }
      el.textContent = out
    },
    onComplete: () => {
      el.textContent = text
    },
  }, at)
}

function BootSequence() {
  const [slots] = useState(() => (window.innerWidth < 720 ? MOBILE_SLOTS : DESKTOP_SLOTS))
  const [active, setActive] = useState(() => !introPlayed && !prefersReducedMotion())

  const rootRef = useRef<HTMLDivElement>(null)
  const scanRef = useRef<HTMLDivElement>(null)
  const statusRef = useRef<HTMLSpanElement>(null)
  const pctRef = useRef<HTMLSpanElement>(null)
  const barRef = useRef<HTMLDivElement>(null)
  const lineRef = useRef<HTMLDivElement>(null)
  const boxRefs = useRef<(HTMLDivElement | null)[]>([])
  const cursorRefs = useRef<(HTMLDivElement | null)[]>([])
  const skipRef = useRef<() => void>(() => {})

  useEffect(() => {
    if (!active) return
    const root = rootRef.current
    const scan = scanRef.current
    const status = statusRef.current
    const pct = pctRef.current
    const bar = barRef.current
    const line = lineRef.current
    if (!root || !scan || !status || !pct || !bar || !line) return

    const vw = window.innerWidth
    const vh = window.innerHeight
    const finish = () => {
      introPlayed = true
      setActive(false)
    }
    skipRef.current = finish

    gsap.set(root, { clipPath: 'inset(0% 0% 0% 0%)' })

    const tl = gsap.timeline({ onComplete: finish })
    const scanTween = gsap.fromTo(scan, { y: -160 }, { y: vh + 40, duration: 2.2, ease: 'none', repeat: -1 })

    slots.forEach((slot, i) => {
      const box = boxRefs.current[i]
      const cursor = cursorRefs.current[i]
      if (!box || !cursor) return

      const label = box.querySelector<HTMLElement>('.boot__label')
      const dims = box.querySelector<HTMLElement>('.boot__dims')
      const bars = Array.from(box.querySelectorAll<HTMLElement>('.boot__bar'))
      if (!label || !dims) return

      const L = slot.x * vw
      const T = slot.y * vh
      const W = slot.w * vw
      const H = slot.h * vh
      const from = spawnPoint(i, vw, vh)
      const s = FIRST + i * GAP
      const drawAt = s + TRAVEL
      const lockAt = drawAt + DRAW + 0.05

      // 1. Agent flies in from an edge to the box's top-left corner.
      tl.fromTo(
        cursor,
        { x: from.x, y: from.y, opacity: 0 },
        { x: L, y: T, opacity: 1, duration: TRAVEL, ease: 'power3.out' },
        s,
      )
      // 2. Click pulse on the corner.
      tl.fromTo(cursor, { scale: 1 }, { scale: 0.75, duration: 0.08, yoyo: true, repeat: 1, ease: 'power1.inOut' }, drawAt)

      // 3. Drag: the box grows while the agent rides its bottom-right corner.
      const prog = { p: 0 }
      tl.call(() => {
        label.textContent = 'DRAWING'
      }, undefined, drawAt)
      tl.to(
        prog,
        {
          p: 1,
          duration: DRAW,
          ease: 'power2.inOut',
          onStart: () => {
            gsap.set(box, { opacity: 1 })
          },
          onUpdate: () => {
            const w = W * prog.p
            const h = H * prog.p
            gsap.set(box, { width: w, height: h })
            gsap.set(cursor, { x: L + w, y: T + h })
            dims.textContent = `${Math.round(w)} × ${Math.round(h)}`
          },
        },
        drawAt,
      )

      // 4. Lock: box turns gold, label decodes, skeleton bars fill, agent leaves.
      tl.call(() => {
        box.classList.add('is-locked')
      }, undefined, lockAt)
      scrambleTo(tl, label, slot.label, lockAt, LOCK)
      if (bars.length) {
        tl.to(bars, { scaleX: 1, duration: 0.35, stagger: 0.09, ease: 'power2.out' }, lockAt + 0.1)
      }
      tl.to(cursor, { opacity: 0, duration: 0.25, ease: 'power1.in' }, lockAt)
    })

    // Global progress bar, percent counter and status log.
    tl.to(bar, { scaleX: 1, duration: EXIT_AT, ease: 'none' }, 0)
    const counter = { v: 0 }
    tl.to(counter, {
      v: 100,
      duration: EXIT_AT,
      ease: 'none',
      onUpdate: () => {
        pct.textContent = `${Math.round(counter.v)}%`
      },
    }, 0)
    STAGE_LOG.forEach(([t, msg]) => {
      tl.call(() => {
        status.textContent = msg
      }, undefined, t)
    })

    // 5. CRT collapse into a single line, revealing the scene underneath.
    tl.call(() => {
      status.textContent = "ENTERING SUMMONER'S RIFT"
    }, undefined, EXIT_AT)
    tl.to(line, { opacity: 1, duration: 0.05 }, EXIT_AT)
    tl.to(root, { clipPath: 'inset(48% 0% 48% 0%)', duration: 0.28, ease: 'power2.in' }, EXIT_AT + 0.05)
    tl.to(root, { clipPath: 'inset(50% 0% 50% 0%)', duration: 0.12, ease: 'none' })

    const onKey = () => skipRef.current()
    window.addEventListener('keydown', onKey)

    return () => {
      window.removeEventListener('keydown', onKey)
      tl.kill()
      scanTween.kill()
      skipRef.current = () => {}
    }
  }, [active, slots])

  if (!active) return null

  return (
    <div
      className="boot"
      ref={rootRef}
      aria-hidden="true"
      onPointerDown={() => skipRef.current()}
    >
      <div className="boot__grid" />
      <div className="boot__scan" ref={scanRef} />

      <header className="boot__hud">
        <span className="boot__brand">LP//OS <em>v2.6</em></span>
        <span className="boot__status" ref={statusRef}>INITIALIZING LAYOUT ENGINE</span>
        <span className="boot__pct" ref={pctRef}>0%</span>
      </header>
      <div className="boot__progress">
        <div className="boot__progress-fill" ref={barRef} />
      </div>

      {slots.map((slot, i) => (
        <div
          key={slot.label}
          className="boot__box"
          ref={(el) => {
            boxRefs.current[i] = el
          }}
          style={{ left: `${slot.x * 100}%`, top: `${slot.y * 100}%` }}
        >
          <i className="boot__corner boot__corner--tl" />
          <i className="boot__corner boot__corner--tr" />
          <i className="boot__corner boot__corner--bl" />
          <i className="boot__corner boot__corner--br" />
          <span className="boot__label">STANDBY</span>
          <span className="boot__dims">0 × 0</span>
          {slot.bars && (
            <div className="boot__bars">
              <i className="boot__bar" style={{ width: '72%' }} />
              <i className="boot__bar" style={{ width: '46%' }} />
              <i className="boot__bar" style={{ width: '62%' }} />
            </div>
          )}
        </div>
      ))}

      {AGENTS.map((name, i) => (
        <div
          key={name}
          className="boot__cursor"
          ref={(el) => {
            cursorRefs.current[i] = el
          }}
        >
          <svg width="18" height="22" viewBox="0 0 18 22">
            <path
              d="M1 1 L1 17 L5.2 13.2 L8 19.6 L10.6 18.5 L7.9 12.2 L13.6 12.2 Z"
              fill="#0AC8FF"
              stroke="#010a13"
              strokeWidth="1.2"
              strokeLinejoin="round"
            />
          </svg>
          <span className="boot__tag">{name}</span>
        </div>
      ))}

      <div className="boot__line" ref={lineRef} />
      <footer className="boot__skip">CLICK OR PRESS ANY KEY TO SKIP</footer>
    </div>
  )
}

export default BootSequence
