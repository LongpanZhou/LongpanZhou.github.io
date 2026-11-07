import { useEffect, useRef, useState, type ReactNode } from 'react'
import gsap from 'gsap'
import './DrawFrame.css'

// Reusable draw-in wrapper. Elements inside the wrapper marked with data-draw
// get a wireframe box drawn around them by up to three agent cursors, lock
// gold, and then the overlay fades out. The overlay never takes pointer
// events, so the children stay visible and clickable the whole time.

interface DrawFrameProps {
  children: ReactNode
  ready?: boolean // hold the drawing until the page's content has loaded
}

// Map vocabulary for targets: towers and nexus get their own look and order.
type TargetKind = 'minion' | 'tower' | 'nexus'

interface Target {
  kind: TargetKind
  label: string
  x: number // relative to the wrapper's top-left
  y: number
  w: number
  h: number
  el: HTMLElement // the real element, hidden until its box has been drawn
}

const MAX_AGENTS = 3
const KIND_RANK: Record<TargetKind, number> = { tower: 0, minion: 1, nexus: 2 }
const KIND_NAME: Record<TargetKind, string> = { minion: 'MINION', tower: 'TOWER', nexus: 'NEXUS' }
const AGENT_NAMES = ['agent.grid', 'agent.dom', 'agent.render']
const CURSOR_SVG =
  '<svg width="18" height="22" viewBox="0 0 18 22"><path d="M1 1 L1 17 L5.2 13.2 L8 19.6 L10.6 18.5 L7.9 12.2 L13.6 12.2 Z" fill="#0AC8FF" stroke="#010a13" stroke-width="1.2" stroke-linejoin="round"/></svg>'

// Timeline constants (seconds)
const FIRST = 0.3 // delay before the first agent moves
const LANE_GAP = 0.15 // stagger between agents
const FLY_FIRST = 0.45 // flight from the wrapper edge to the first target
const BUDGET = 2.4 // time one agent spends on its targets; each step is BUDGET / count
const STEP_MIN = 0.45 // a step shorter than this is too fast to read as drawing
const STEP_MAX = 1.0
const HOLD = 0.3 // locked boxes stay up this long before the fade
const FADE = 0.4

function prefersReducedMotion(): boolean {
  return typeof window !== 'undefined' && !!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
}

function clamp(v: number, lo: number, hi: number): number {
  return Math.min(hi, Math.max(lo, v))
}

// Unknown or missing data-draw-kind values fall back to a minion.
function parseKind(value: string | null): TargetKind {
  return value === 'tower' || value === 'nexus' ? value : 'minion'
}

// Reads target rectangles once, relative to the wrapper's own rectangle.
function measure(wrap: HTMLElement): Target[] {
  const origin = wrap.getBoundingClientRect()
  const targets: Target[] = []
  wrap.querySelectorAll<HTMLElement>('[data-draw]').forEach((el) => {
    const r = el.getBoundingClientRect()
    if (r.width === 0 || r.height === 0) return
    const attr = el.getAttribute('data-draw')
    targets.push({
      kind: parseKind(el.getAttribute('data-draw-kind')),
      label: attr && attr !== 'true' ? attr : `target.${targets.length + 1}`,
      x: r.left - origin.left,
      y: r.top - origin.top,
      w: r.width,
      h: r.height,
      el,
    })
  })
  return targets
}

// Agents enter from the wrapper's left, right, or top edge.
function spawnPoint(i: number, W: number, H: number): { x: number; y: number } {
  switch (i % 3) {
    case 0: return { x: -40, y: H / 2 }
    case 1: return { x: W + 40, y: H / 2 }
    default: return { x: W / 2, y: -40 }
  }
}

function makeCursor(name: string): HTMLDivElement {
  const cursor = document.createElement('div')
  cursor.className = 'draw-frame__cursor'
  cursor.innerHTML = CURSOR_SVG
  const tag = document.createElement('span')
  tag.className = 'draw-frame__tag'
  tag.textContent = name
  cursor.appendChild(tag)
  return cursor
}

function makeBox(target: Target): HTMLDivElement {
  const box = document.createElement('div')
  box.className = `draw-frame__box draw-frame__box--${target.kind}`
  box.style.left = `${target.x}px`
  box.style.top = `${target.y}px`
  for (const corner of ['tl', 'tr', 'bl', 'br']) {
    const i = document.createElement('i')
    i.className = `draw-frame__corner draw-frame__corner--${corner}`
    box.appendChild(i)
  }
  const label = document.createElement('span')
  label.className = 'draw-frame__label'
  label.textContent = `${KIND_NAME[target.kind]} // ${target.label}`
  box.appendChild(label)
  return box
}

// Calls done once the element's height has stayed the same for a few checks,
// or after a cap. Projects swaps in live GitHub data after mount, so the boxes
// should wait for that layout instead of measuring the placeholder list.
function whenLayoutSettles(el: HTMLElement, done: () => void): () => void {
  const CHECK_MS = 150
  const MAX_MS = 4000
  let last = -1
  let stable = 0
  let elapsed = 0
  let timer = 0
  const tick = () => {
    const h = el.getBoundingClientRect().height
    stable = h === last ? stable + 1 : 0
    last = h
    elapsed += CHECK_MS
    if (stable >= 2 || elapsed >= MAX_MS) done()
    else timer = window.setTimeout(tick, CHECK_MS)
  }
  timer = window.setTimeout(tick, CHECK_MS)
  return () => window.clearTimeout(timer)
}

// Types a revealed element's text out character by character, like an agent typing it in, with a
// blinking caret and the agent's name at the end of the typed text.
//
// The untyped rest of each text node stays in the layout as invisible text (a "ghost"), so the
// block keeps its final size and shape from the first frame instead of growing as text arrives.
interface TypedNode {
  node: Text
  full: string
  ghost?: HTMLSpanElement
}
function collectText(el: HTMLElement): TypedNode[] {
  const out: TypedNode[] = []
  const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT)
  for (let n = walker.nextNode(); n; n = walker.nextNode()) {
    const node = n as Text
    // Text inside a nested target belongs to that target, which types it at its own time. Typing
    // it here too made nested boxes (the profile card holds the name and links) type twice.
    if (node.parentElement?.closest('[data-draw], [data-draw-type]') !== el) continue
    if (node.nodeValue && node.nodeValue.trim()) out.push({ node, full: node.nodeValue })
  }
  return out
}
// Puts every node back to its full text and removes the ghosts
function restoreText(nodes: TypedNode[]) {
  for (const t of nodes) {
    t.ghost?.remove()
    t.ghost = undefined
    t.node.nodeValue = t.full
  }
}
function makeCaret(name: string): HTMLDivElement {
  const caret = document.createElement('div')
  caret.className = 'draw-frame__caret'
  const tag = document.createElement('span')
  tag.className = 'draw-frame__caret-tag'
  tag.textContent = name
  caret.appendChild(tag)
  caret.style.opacity = '0'
  return caret
}
function typeText(
  nodes: TypedNode[],
  tl: gsap.core.Timeline,
  at: number,
  duration: number,
  ctx: { wrap: HTMLElement; overlay: HTMLElement; name: string },
): number {
  const total = nodes.reduce((sum, t) => sum + t.full.length, 0)
  if (total === 0) return at
  const state = { p: 0 }
  const caret = makeCaret(ctx.name)
  ctx.overlay.appendChild(caret)
  const show = (typed: number) => {
    let left = typed
    let last = nodes[0]
    for (const t of nodes) {
      const take = Math.min(left, t.full.length)
      t.node.nodeValue = t.full.slice(0, take)
      if (t.ghost) t.ghost.textContent = t.full.slice(take)
      left -= take
      if (take > 0) last = t
    }
    // The caret sits right after the last typed character, or at the start of the first ghost
    const origin = ctx.wrap.getBoundingClientRect()
    let rect: DOMRect | null = null
    const len = last.node.nodeValue?.length ?? 0
    if (len > 0) {
      const range = document.createRange()
      range.setStart(last.node, len - 1)
      range.setEnd(last.node, len)
      const r = range.getBoundingClientRect()
      if (r.height > 0) rect = new DOMRect(r.right, r.top, 0, r.height)
    }
    if (!rect && last.ghost) {
      const r = last.ghost.getBoundingClientRect()
      rect = new DOMRect(r.left, r.top, 0, r.height || 16)
    }
    if (rect) {
      caret.style.transform = `translate(${rect.x - origin.left}px, ${rect.y - origin.top}px)`
      caret.style.height = `${rect.height}px`
    }
  }
  tl.call(
    () => {
      // Each text node keeps its full text in the layout as an invisible ghost
      for (const t of nodes) {
        const ghost = document.createElement('span')
        ghost.style.visibility = 'hidden'
        ghost.textContent = t.full
        t.node.nodeValue = ''
        t.node.parentNode?.insertBefore(ghost, t.node.nextSibling)
        t.ghost = ghost
      }
      show(0)
      caret.style.opacity = '1'
    },
    undefined,
    at,
  )
  tl.to(state, { p: 1, duration, ease: 'none', onUpdate: () => show(Math.round(state.p * total)) }, at)
  tl.call(
    () => {
      restoreText(nodes)
      caret.remove()
    },
    undefined,
    at + duration + 0.01,
  )
  return at + duration + 0.01
}

// Resolves once every image under `el` has loaded (or failed), capped at two seconds. Images that
// arrive after the boxes were measured shift the layout and put the boxes in the wrong place.
function imagesReady(el: HTMLElement): Promise<void> {
  const pending = Array.from(el.querySelectorAll('img')).filter((img) => !img.complete)
  if (pending.length === 0) return Promise.resolve()
  const loaded = Promise.all(
    pending.map(
      (img) =>
        new Promise<void>((resolve) => {
          img.addEventListener('load', () => resolve(), { once: true })
          img.addEventListener('error', () => resolve(), { once: true })
        }),
    ),
  ).then(() => undefined)
  return Promise.race([loaded, new Promise<void>((resolve) => window.setTimeout(resolve, 2000))])
}

function DrawFrame({ children, ready = true }: DrawFrameProps) {
  // Decided once per mount. Under reduced motion nothing is rendered extra.
  const [animate] = useState(() => !prefersReducedMotion())
  const wrapRef = useRef<HTMLDivElement>(null)
  const overlayRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    // Pages that load content (GitHub projects) pass ready={false} until it is on screen, so the
    // agents draw the real layout once instead of the placeholder.
    if (!animate || !ready) return
    const wrap = wrapRef.current
    const overlay = overlayRef.current
    if (!wrap || !overlay) return
    // Hide the marked elements again on every run. React's dev double-mount runs the cleanup,
    // which lifts the hiding, and the second run would otherwise start with everything visible.
    wrap.classList.add('draw-frame--pending')

    let running: gsap.core.Timeline | null = null
    let allTexts: TypedNode[] = []
    let cancelled = false
    let stopWaiting: () => void = () => {}

    const start = () => {
    // Towers first, minions next, nexus last so the nexus locks at the end.
    const targets = measure(wrap).sort((a, b) => KIND_RANK[a.kind] - KIND_RANK[b.kind])
    if (targets.length === 0) {
      wrap.classList.remove('draw-frame--pending')
      return
    }

    const origin = wrap.getBoundingClientRect()
    const W = origin.width
    const H = origin.height

    // Round-robin the targets across up to three agents.
    const laneCount = Math.min(MAX_AGENTS, targets.length)
    const lanes: Target[][] = Array.from({ length: laneCount }, () => [])
    targets.forEach((t, i) => lanes[i % laneCount].push(t))
    const perLane = Math.max(...lanes.map((lane) => lane.length))
    const step = clamp(BUDGET / perLane, STEP_MIN, STEP_MAX)

    const tl = gsap.timeline()
    running = tl
    let laneEnd = 0
    let typeEnd = 0 // when the last text finishes typing
    allTexts = []
    gsap.set(overlay, { opacity: 1 })

    lanes.forEach((lane, a) => {
      const cursor = makeCursor(AGENT_NAMES[a])
      overlay.appendChild(cursor)
      const spawn = spawnPoint(a, W, H)
      gsap.set(cursor, { x: spawn.x, y: spawn.y, opacity: 0 })

      let t = FIRST + a * LANE_GAP
      lane.forEach((target, k) => {
        const box = makeBox(target)
        overlay.appendChild(box)

        // 1. Agent flies to the target's top-left corner.
        const fly = k === 0 ? FLY_FIRST : Math.max(0.25, step * 0.4)
        tl.to(cursor, { x: target.x, y: target.y, opacity: 1, duration: fly, ease: 'power3.out' }, t)

        // 2. The box grows from the top-left corner while the agent rides its bottom-right corner.
        const drawAt = t + fly
        const draw = Math.max(0.3, step * 0.6)
        tl.set(box, { opacity: 1 }, drawAt)
        tl.fromTo(
          box,
          { width: 0, height: 0 },
          { width: target.w, height: target.h, duration: draw, ease: 'power2.inOut' },
          drawAt,
        )
        tl.to(
          cursor,
          { x: target.x + target.w, y: target.y + target.h, duration: draw, ease: 'power2.inOut' },
          drawAt,
        )

        // 3. Lock: the box turns gold.
        const lockAt = drawAt + draw
        tl.call(() => box.classList.add('is-locked'), undefined, lockAt)
        // The real element appears only once its box has been drawn around it
        tl.call(() => target.el.classList.add('draw-revealed'), undefined, drawAt)
        const texts = collectText(target.el)
        allTexts.push(...texts)
        typeEnd = Math.max(
          typeEnd,
          typeText(texts, tl, drawAt, clamp(texts.reduce((n, t) => n + t.full.length, 0) * 0.012, 0.4, 1.6), {
            wrap,
            overlay,
            name: AGENT_NAMES[a],
          }),
        )
        t = lockAt
      })

      tl.to(cursor, { opacity: 0, duration: 0.2, ease: 'power1.in' }, t)
      laneEnd = Math.max(laneEnd, t)
    })

    // Text marked data-draw-type is typed in without a box, starting with the first agent.
    wrap.querySelectorAll<HTMLElement>('[data-draw-type]').forEach((el) => {
      const texts = collectText(el)
      allTexts.push(...texts)
      tl.call(() => el.classList.add('draw-revealed'), undefined, FIRST)
      typeEnd = Math.max(
        typeEnd,
        typeText(texts, tl, FIRST, clamp(texts.reduce((n, t) => n + t.full.length, 0) * 0.012, 0.4, 1.6), {
          wrap,
          overlay,
          name: AGENT_NAMES[0],
        }),
      )
    })

    // 4. Everything fades out, then the overlay is emptied.
    // The overlay (with the typing carets) stays until the last text has finished typing
    const fadeAt = Math.max(laneEnd, typeEnd) + HOLD
    tl.to(overlay, { opacity: 0, duration: FADE, ease: 'power1.in' }, fadeAt)
    tl.call(() => overlay.replaceChildren(), undefined, fadeAt + FADE)
    tl.call(() => wrap.classList.remove('draw-frame--pending'), undefined, fadeAt + FADE)

    }

    // Wait for fonts, then for the layout to stop changing, then run once.
    document.fonts.ready.then(() => imagesReady(wrap)).then(() => {
      if (cancelled) return
      stopWaiting = whenLayoutSettles(wrap, () => {
        if (!cancelled) start()
      })
    })

    return () => {
      cancelled = true
      stopWaiting()
      running?.kill()
      restoreText(allTexts)
      overlay.replaceChildren()
      wrap.classList.remove('draw-frame--pending')
    }
  }, [animate, ready])

  if (!animate) return <>{children}</>

  return (
    <div className="draw-frame draw-frame--pending" ref={wrapRef}>
      {children}
      <div className="draw-frame__overlay" ref={overlayRef} aria-hidden="true" />
    </div>
  )
}

// ---------------------------------------------------------------------------
// HudDraw: the home page variant. Every element on the page marked
// data-hud-draw="Label" (nav bar, HUD panels, the profile panel) gets a box.
// One HudDrawer owns one requestAnimationFrame loop for all of them and at most
// two agent cursors. The loop runs only while boxes are being drawn: it stops
// when every box is locked, when the document is hidden, and before the rift is
// ready. Layout is read on start, on resize, when a target's own size changes,
// and when a new target is mounted under the rift root. The animation writes
// transform and opacity only.

// Four agents, each entering from a different screen edge. They share one loop, so
// the extra cursors cost almost nothing, and they draw different boxes at the same time.
const HUD_AGENTS = ['agent.grid', 'agent.dom', 'agent.render', 'agent.theme']
const HUD_SETTLE_MS = 150 // layout is sampled at this interval
const HUD_SETTLE_MAX_MS = 4000
const HUD_FIRST = 0.2 // seconds before the first agent moves
const HUD_LANE_GAP = 0.08 // stagger between agents, small so they visibly work together
const HUD_FLY_FIRST = 0.45 // from the viewport edge to the first target
const HUD_FLY = 0.3 // between targets
const HUD_DRAW = 0.7 // time to draw one box
const HUD_TYPE_CHAR = 0.045 // seconds per typed character
const HUD_TYPE_MIN = 0.3
const HUD_TYPE_MAX = 1.2
const HUD_TYPE_GAP = 0.12 // pause between the typed pieces of one box

interface HudBox {
  target: HTMLElement
  node: HTMLDivElement
  fill: HTMLDivElement
  edgeT: HTMLElement
  edgeR: HTMLElement
  edgeB: HTMLElement
  edgeL: HTMLElement
  label: HTMLElement
  typed: HTMLElement[] // data-hud-type inside the target: typed out after the lock
  fades: HTMLElement[] // data-hud-fade inside the target: faded in on the lock
  x: number // viewport coordinates, from the last measure
  y: number
  w: number
  h: number
  progress: number // 0..1, how far the box has been drawn
  started: boolean
  lockAt: number // clock time at which the box locks; inner boxes wait for their parent's
  lane?: HudLane // the agent that draws this box
}

interface HudLane {
  name: string
  tag: HTMLElement // the cursor's name tag, which also shows what the agent is doing
  node: HTMLDivElement // agent cursor
  anchor: HudBox | null // the box this agent drew last
  free: number // clock time at which this agent's queued work ends
  visible: boolean
}

interface HudStep {
  start: number
  dur: number
  run: (p: number) => void
  done: boolean
}

const easeOutCubic = (p: number) => 1 - (1 - p) ** 3
const easeInOutQuad = (p: number) => (p < 0.5 ? 2 * p * p : 1 - (-2 * p + 2) ** 2 / 2)
const lerp = (a: number, b: number, t: number) => a + (b - a) * t

function makeHudCursor(name: string): HTMLDivElement {
  const cursor = document.createElement('div')
  cursor.className = 'hud-draw__cursor'
  cursor.innerHTML = CURSOR_SVG
  const tag = document.createElement('span')
  tag.className = 'hud-draw__tag'
  tag.textContent = name
  cursor.appendChild(tag)
  // Dashed crosshair lines through the cursor, as if the agent is measuring the layout
  for (const axis of ['h', 'v']) {
    const guide = document.createElement('i')
    guide.className = `hud-draw__guide hud-draw__guide--${axis}`
    cursor.appendChild(guide)
  }
  return cursor
}

// Built detached; the drawer attaches it once the target has a real size.
function makeHudBox(target: HTMLElement): HudBox {
  const node = document.createElement('div')
  node.className = 'hud-draw__box'
  // A box drawn inside another panel's box is an inner box: lighter, with smaller corners
  if (target.parentElement?.closest('[data-hud-draw]')) node.classList.add('is-inner')
  const fill = document.createElement('div')
  fill.className = 'hud-draw__fill'
  node.appendChild(fill)
  const edge = (side: string) => {
    const i = document.createElement('i')
    i.className = `hud-draw__edge hud-draw__edge--${side}`
    node.appendChild(i)
    return i
  }
  const edgeT = edge('top')
  const edgeR = edge('right')
  const edgeB = edge('bottom')
  const edgeL = edge('left')
  for (const corner of ['tl', 'tr', 'bl', 'br']) {
    const i = document.createElement('i')
    i.className = `hud-draw__corner hud-draw__corner--${corner}`
    node.appendChild(i)
  }
  const label = document.createElement('span')
  label.className = 'hud-draw__label'
  // The name is not drawn on the box. It stays detached and only feeds the agent's tag.
  label.textContent = (target.getAttribute('data-hud-draw') || 'HUD').toUpperCase()
  // Ring that bursts from the final corner when the box locks
  const ping = document.createElement('i')
  ping.className = 'hud-draw__ping'
  node.appendChild(ping)
  return {
    target,
    node,
    fill,
    edgeT,
    edgeR,
    edgeB,
    edgeL,
    label,
    typed: [],
    fades: [],
    x: 0,
    y: 0,
    w: 0,
    h: 0,
    progress: 0,
    started: false,
    lockAt: 0,
  }
}

// A small agent cursor for typing: a flashing caret, the arrow cursor under it and the agent's name
function makeTyper(name: string): HTMLDivElement {
  const typer = document.createElement('div')
  typer.className = 'hud-draw__typer'
  typer.innerHTML =
    '<svg class="hud-draw__typer-arrow" width="11" height="14" viewBox="0 0 18 22"><path d="M1 1 L1 17 L5.2 13.2 L8 19.6 L10.6 18.5 L7.9 12.2 L13.6 12.2 Z" fill="#0AC8FF" stroke="#010a13" stroke-width="1.4" stroke-linejoin="round"/></svg>'
  const tag = document.createElement('span')
  tag.className = 'hud-draw__typer-tag'
  tag.textContent = name
  typer.appendChild(tag)
  return typer
}

class HudDrawer {
  // null while a target is still settling after it was found
  private boxes = new Map<HTMLElement, HudBox | null>()
  private lanes: HudLane[] = []
  private steps: HudStep[] = []
  private clock = 0 // seconds of animation time; advances only inside frame()
  private raf = 0
  private lastTs = 0
  private timers = new Set<number>()
  private resizeTimer = 0
  private disposed = false
  private overlay: HTMLElement
  private root: HTMLElement
  private reduced: boolean
  private mutations: MutationObserver | null = null
  private sizes: ResizeObserver | null = null
  private claimed = new WeakSet<HTMLElement>() // typed/fade items already owned by a target
  private seen = new Set<string>() // panel names this drawer has already drawn
  private instant = new WeakSet<HTMLElement>() // panels that came back: boxed at once, no effects
  private touched: HTMLElement[] = [] // every claimed item, cleared on dispose
  private parts = new Map<HTMLElement, { typed: HTMLElement[]; fades: HTMLElement[] }>()
  private restores: Array<() => void> = [] // put typed text back if the drawer goes away mid-typing

  constructor(overlay: HTMLElement, root: HTMLElement, reduced: boolean) {
    this.overlay = overlay
    this.root = root
    this.reduced = reduced
  }

  start() {
    if (!this.reduced) {
      this.lanes = HUD_AGENTS.map((name) => {
        const node = makeHudCursor(name)
        node.style.opacity = '0'
        this.overlay.appendChild(node)
        const tag = node.querySelector<HTMLElement>('.hud-draw__tag') as HTMLElement
        return { name, tag, node, anchor: null, free: 0, visible: false }
      })
    }
    this.sizes = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const box = this.boxes.get(entry.target as HTMLElement)
        if (box) this.place(box)
      }
    })
    // New HUD panels are mounted directly under the rift root (no subtree
    // observation, so the per-frame text updates inside panels do not fire it).
    this.mutations = new MutationObserver(() => {
      this.prune()
      this.admit(this.scan())
    })
    this.mutations.observe(this.root, { childList: true })
    window.addEventListener('resize', this.onResize)
    document.addEventListener('visibilitychange', this.onVisibility)
    document.fonts.ready.then(() => {
      if (!this.disposed) this.admit(this.scan())
    })
  }

  dispose() {
    this.disposed = true
    cancelAnimationFrame(this.relayoutRaf)
    cancelAnimationFrame(this.raf)
    this.raf = 0
    for (const id of this.timers) window.clearTimeout(id)
    this.timers.clear()
    window.clearTimeout(this.resizeTimer)
    window.removeEventListener('resize', this.onResize)
    document.removeEventListener('visibilitychange', this.onVisibility)
    this.mutations?.disconnect()
    this.sizes?.disconnect()
    for (const restore of this.restores) restore()
    this.restores = []
    this.unclaim(this.touched)
    this.touched = []
    this.parts.clear()
    this.overlay.replaceChildren()
    this.boxes.clear()
    this.lanes = []
    this.steps = []
  }

  private onResize = () => {
    window.clearTimeout(this.resizeTimer)
    this.resizeTimer = window.setTimeout(() => {
      for (const box of this.boxes.values()) if (box) this.place(box)
    }, 150)
  }

  private onVisibility = () => {
    if (document.hidden) {
      cancelAnimationFrame(this.raf)
      this.raf = 0
    } else {
      this.kick()
    }
  }

  private later(ms: number, fn: () => void) {
    const id = window.setTimeout(() => {
      this.timers.delete(id)
      fn()
    }, ms)
    this.timers.add(id)
  }

  private scan(): HTMLElement[] {
    return Array.from(document.querySelectorAll<HTMLElement>('[data-hud-draw]')).filter(
      (el) => !this.boxes.has(el),
    )
  }

  private relayoutRaf = 0

  // Moves every box to where its panel is now, at most once per frame. Panels being dragged ask
  // for this on every pointer move, so their boxes follow them.
  relayout() {
    if (this.relayoutRaf || this.disposed) return
    this.relayoutRaf = requestAnimationFrame(() => {
      this.relayoutRaf = 0
      for (const box of this.boxes.values()) if (box) this.place(box)
    })
  }

  // Marks panels as not drawn yet, so the next time one appears it is drawn by the agents even
  // though a panel of that name was drawn before. Used when the view changes: the layout editor is
  // drawn once per visit to the home view, not every time it is opened and closed within one.
  forgetSeen(names: string[]) {
    for (const name of names) this.seen.delete(name)
  }

  // Forgets the boxes drawn for the panels matching `selector` (and the boxes inside them) and
  // draws them again with the agents, as if they had just appeared. Used for panels that stay
  // mounted when the view changes (the music player). They need data-hud-always, or the
  // second drawing is skipped as already seen.
  redraw(selector: string) {
    if (this.disposed) return
    // Panels that stopped being HUD boxes (the music player when it moves into the 3D scene) lose
    // their drawn box
    for (const [target, box] of this.boxes) {
      if (!box || target.hasAttribute('data-hud-draw')) continue
      box.node.remove()
      this.sizes?.unobserve(target)
      this.unclaim([target, ...box.typed, ...box.fades])
      target.classList.remove('hud-revealed')
      this.boxes.delete(target)
    }
    const all = new Set<HTMLElement>()
    document.querySelectorAll<HTMLElement>(selector).forEach((el) => {
      all.add(el)
      el.querySelectorAll<HTMLElement>('[data-hud-draw]').forEach((inner) => all.add(inner))
    })
    for (const target of all) {
      const box = this.boxes.get(target)
      if (!box) continue
      box.node.remove()
      this.sizes?.unobserve(target)
      this.unclaim([target, ...box.typed, ...box.fades])
      target.classList.remove('hud-revealed')
      this.boxes.delete(target)
    }
    this.admit(this.scan())
  }

  // Called when a panel appears outside the rift root (the layout editor), where the mutation
  // observer cannot see it.
  rescan() {
    if (!this.disposed) this.admit(this.scan())
  }

  private admit(targets: HTMLElement[]) {
    for (const target of targets) {
      this.boxes.set(target, null)
      // A panel that comes back (the reopened profile) is not drawn again
      const name = target.getAttribute('data-hud-draw') ?? ''
      // data-hud-always: a panel mounted per view (Position, Controls, README, Projects) is
      // drawn again every time its view opens
      if (this.seen.has(name) && !target.hasAttribute('data-hud-always')) this.instant.add(target)
      this.seen.add(name)
      this.prepare(target)
      this.settle(target, () => this.finish(target))
    }
  }

  // Samples the target's rectangle until it stops changing (fonts, fade-ins),
  // then calls done. Bounded by HUD_SETTLE_MAX_MS.
  private settle(target: HTMLElement, done: () => void) {
    // data-hud-fixed: a panel whose size is set by CSS, not by its content, needs no waiting
    if (target.hasAttribute('data-hud-fixed')) {
      this.later(50, done)
      return
    }
    let last = ''
    let stable = 0
    let elapsed = 0
    const check = () => {
      const r = target.getBoundingClientRect()
      const sig = `${r.left},${r.top},${r.width},${r.height}`
      stable = sig === last ? stable + 1 : 0
      last = sig
      elapsed += HUD_SETTLE_MS
      if (stable >= 2 || elapsed >= HUD_SETTLE_MAX_MS) done()
      else this.later(HUD_SETTLE_MS, check)
    }
    this.later(HUD_SETTLE_MS, check)
  }

  private finish(target: HTMLElement) {
    if (this.disposed) return
    const parts = this.parts.get(target) ?? { typed: [], fades: [] }
    this.parts.delete(target)
    if (!target.isConnected) {
      this.boxes.delete(target)
      return
    }
    const box = makeHudBox(target)
    box.typed = parts.typed
    box.fades = parts.fades
    if (!this.measure(box)) {
      // Hidden or empty: show its text again and forget it so a later scan can admit it.
      this.unclaim([target, ...parts.typed, ...parts.fades])
      this.boxes.delete(target)
      return
    }
    this.overlay.appendChild(box.node)
    this.sizes?.observe(target)
    this.boxes.set(target, box)
    if (target.closest('.panel-min')) {
      // Minimized (or inside a minimized panel): nothing is drawn. The box is settled and hidden,
      // and the panel's items are released so they show normally when it is restored.
      this.settleInstantly(box)
    } else if (this.reduced || this.instant.has(target)) {
      // No agents: the box appears locked in its final place.
      box.progress = 1
      box.started = true
      box.node.classList.add('is-on', 'is-locked', 'is-instant')
      this.apply(box)
    } else {
      this.apply(box)
      this.schedule(box)
    }
  }

  // Locks a box without any drawing: used for panels that are minimized, including one that is
  // minimized while the agents are still working on it. Its items are released, and the box node
  // stays hidden while the panel is collapsed (place() hides it).
  private settleInstantly(box: HudBox) {
    if (box.node.classList.contains('is-locked')) return
    box.progress = 1
    box.started = true
    box.node.classList.add('is-on', 'is-instant')
    this.lock(box)
    box.typed.forEach((el) => el.classList.remove('hud-pending'))
    this.place(box)
  }

  // Queues one box on whichever agent frees up first.
  private schedule(box: HudBox) {
    // An inner box (the Keys list in the Controls box) is drawn by the agent that drew the box
    // around it, so one cursor does the whole panel instead of a second one arriving.
    const parentTarget = box.target.parentElement?.closest<HTMLElement>('[data-hud-draw]')
    const parentBox = parentTarget ? this.boxes.get(parentTarget) : null
    let pick = 0
    const parentLane = parentBox?.lane ? this.lanes.indexOf(parentBox.lane) : -1
    if (parentLane >= 0) {
      pick = parentLane
    } else {
      for (let i = 1; i < this.lanes.length; i++) {
        if (Math.max(this.lanes[i].free, this.clock) < Math.max(this.lanes[pick].free, this.clock)) pick = i
      }
    }
    const lane = this.lanes[pick]
    box.lane = lane
    // Do not start from a box that is gone: come in from the screen edge instead
    if (lane.anchor && !lane.anchor.target.isConnected) lane.anchor = null
    let from: { x: number; y: number }
    if (lane.anchor) {
      from = { x: lane.anchor.x + lane.anchor.w, y: lane.anchor.y + lane.anchor.h }
    } else {
      // Enter from the left, right, top or bottom edge, depending on the agent
      const w = window.innerWidth
      const h = window.innerHeight
      const edges = [
        { x: -40, y: h * 0.4 },
        { x: w + 40, y: h * 0.6 },
        { x: w * 0.6, y: -40 },
        { x: w * 0.4, y: h + 40 },
      ]
      from = edges[pick % edges.length]
    }
    const fly = lane.anchor ? HUD_FLY : HUD_FLY_FIRST
    let flyAt = Math.max(lane.free, this.clock + HUD_FIRST + pick * HUD_LANE_GAP)
    // An inner box waits until the panel around it has locked and appeared
    if (parentBox) flyAt = Math.max(flyAt, parentBox.lockAt + 0.15 - fly)
    const drawAt = flyAt + fly
    box.lockAt = drawAt + HUD_DRAW

    // 1. The agent flies to the box's top-left corner.
    this.steps.push({
      start: flyAt,
      dur: fly,
      done: false,
      run: (p) => {
        // A box whose panel was removed (the view changed) is not drawn: the agent leaves
        if (!box.target.isConnected) {
          this.hideLane(lane)
          return
        }
        // A minimized panel is not drawn: the agent skips it
        if (box.target.closest('.panel-min')) {
          this.hideLane(lane)
          return
        }
        const e = easeOutCubic(p)
        this.showLane(lane)
        this.setTag(lane, `${lane.name} → ${box.label.textContent}`)
        this.moveLane(lane, lerp(from.x, box.x, e), lerp(from.y, box.y, e))
      },
    })
    // 2. The box grows from its top-left corner while the agent rides its bottom-right corner.
    this.steps.push({
      start: drawAt,
      dur: HUD_DRAW,
      done: false,
      run: (p) => {
        if (!box.target.isConnected) {
          this.hideLane(lane)
          return
        }
        if (box.target.closest('.panel-min')) {
          this.settleInstantly(box)
          this.hideLane(lane)
          return
        }
        const e = easeInOutQuad(p)
        if (!box.started) {
          box.started = true
          box.node.classList.add('is-on')
        }
        this.paint(box, e)
        this.setTag(lane, `${lane.name} · ${Math.round(box.w * e)}×${Math.round(box.h * e)}`)
        this.moveLane(lane, box.x + box.w * e, box.y + box.h * e)
        // 3. Lock: the box turns gold and its items fade in.
        if (p >= 1) {
          this.setTag(lane, `${lane.name} ✓ locked`)
          this.lock(box)
        }
      },
    })
    // 4. The label, then the text inside the box, types out after the lock.
    let typeAt = drawAt + HUD_DRAW
    // Texts marked data-hud-type-together (the repo cards) are typed in parallel: each group
    // (one card) gets its own agent cursor, and all the groups start a moment apart, so many
    // agents are typing at once.
    const groups = new Map<Element, HTMLElement[]>()
    for (const el of box.typed) {
      if (el.hasAttribute('data-hud-type-together')) {
        const key = el.closest('[data-hud-group]') ?? el
        groups.set(key, [...(groups.get(key) ?? []), el])
      } else {
        typeAt += this.typeElement(el, typeAt) + HUD_TYPE_GAP
      }
    }
    let g = 0
    for (const els of groups.values()) {
      this.typeGroup(els, drawAt + HUD_DRAW + g * 0.1, g)
      g++
    }
    lane.anchor = box
    lane.free = drawAt + HUD_DRAW
    this.kick()
  }

  // Claims the typed text and fade items inside a target before it is drawn.
  // They are hidden straight away so they cannot show ahead of their box.
  private prepare(target: HTMLElement) {
    const pick = (selector: string): HTMLElement[] => {
      const found: HTMLElement[] = []
      target.querySelectorAll<HTMLElement>(selector).forEach((el) => {
        if (this.claimed.has(el)) return
        this.claimed.add(el)
        found.push(el)
      })
      return found
    }
    const typed = pick('[data-hud-type]')
    const fades = pick('[data-hud-fade]')
    const mine = [...typed, ...fades]
    this.touched.push(...mine)
    if (!this.reduced && !this.instant.has(target)) {
      for (const el of mine) el.classList.add('hud-pending')
      // Hold the panel itself hidden, whenever it appeared, until its box locks
      target.classList.add('hud-hold')
      this.touched.push(target)
    }
    this.parts.set(target, { typed, fades })
  }

  private unclaim(els: HTMLElement[]) {
    for (const el of els) {
      this.claimed.delete(el)
      el.classList.remove('hud-pending', 'hud-typing', 'hud-fade', 'hud-hold')
    }
  }

  private lock(box: HudBox) {
    box.node.classList.add('is-locked')
    // The panel itself stays hidden until its box is drawn around it
    // Removing the hold restarts the panel's own animations, so it fades in from here
    box.target.classList.remove('hud-hold')
    box.target.classList.add('hud-revealed')
    box.fades.forEach((el, i) => {
      el.style.animationDelay = `${(i * 0.035).toFixed(3)}s`
      el.classList.remove('hud-pending')
      el.classList.add('hud-fade')
    })
  }

  // Types the text nodes directly inside el, one character per step, on the
  // shared clock. Returns how long the typing takes.
  private typeElement(el: HTMLElement, start: number): number {
    const nodes = Array.from(el.childNodes).filter(
      (n): n is Text => n.nodeType === Node.TEXT_NODE && (n.nodeValue ?? '').trim() !== '',
    )
    if (nodes.length === 0) return 0
    const full = nodes.map((n) => n.nodeValue ?? '')
    const total = full.reduce((sum, s) => sum + s.length, 0)
    // Many agents type at once (the repo cards), so each text is quick: a card is done in about a
    // second instead of two or three
    const dur = el.hasAttribute('data-hud-type-together')
      ? clamp(total * 0.014, 0.25, 0.8)
      : clamp(total * HUD_TYPE_CHAR, HUD_TYPE_MIN, HUD_TYPE_MAX)
    const written = [...full]
    this.restores.push(() =>
      nodes.forEach((n, i) => {
        if (n.nodeValue === written[i]) n.nodeValue = full[i]
      }),
    )
    let started = false
    let aborted = false
    this.steps.push({
      start,
      dur,
      done: false,
      run: (p) => {
        if (aborted) return
        // React owns text that changes (the track title). Leave it alone if it changed.
        if (nodes.some((n, i) => n.nodeValue !== written[i])) {
          aborted = true
          el.classList.remove('hud-pending', 'hud-typing')
          return
        }
        if (!started) {
          started = true
          el.classList.remove('hud-pending')
          el.classList.add('hud-typing')
        }
        const shown = p >= 1 ? total : Math.max(1, Math.round(p * total))
        let consumed = 0
        nodes.forEach((n, i) => {
          const take = Math.min(full[i].length, Math.max(0, shown - consumed))
          consumed += full[i].length
          written[i] = full[i].slice(0, take)
          n.nodeValue = written[i]
        })
        if (p >= 1) el.classList.remove('hud-typing')
      },
    })
    return dur
  }

  // Types the texts of one group one after another while an agent cursor, with its name tag and a
  // flashing caret, rides the end of the text being typed.
  private typeGroup(els: HTMLElement[], start: number, index: number) {
    const typer = makeTyper(HUD_AGENTS[index % HUD_AGENTS.length])
    typer.style.opacity = '0'
    this.overlay.appendChild(typer)
    // The nearest ancestor that clips its content (the scrolling list the card is in). A card
    // scrolled out of view is typed, but its cursor stays hidden instead of floating outside the box.
    let clip: HTMLElement | null = null
    for (let p = els[0].parentElement; p && p !== document.body; p = p.parentElement) {
      const overflow = getComputedStyle(p).overflowY
      if (overflow === 'auto' || overflow === 'scroll' || overflow === 'hidden') {
        clip = p
        break
      }
    }
    const windows: Array<{ el: HTMLElement; from: number }> = []
    let t = start
    for (const el of els) {
      windows.push({ el, from: t })
      t += this.typeElement(el, t) + 0.06
    }
    this.steps.push({
      start,
      dur: Math.max(t - start, 0.01),
      done: false,
      run: (p) => {
        if (p >= 1) {
          typer.remove()
          return
        }
        let active = windows[0]
        for (const w of windows) if (this.clock >= w.from) active = w
        // Nothing to type into while the panel is collapsed
        if (active.el.closest('.panel-min') || !active.el.isConnected) {
          typer.style.opacity = '0'
          return
        }
        this.placeTyper(typer, active.el)
        const bounds = clip?.getBoundingClientRect()
        const at = active.el.getBoundingClientRect()
        const hidden = !!bounds && (at.bottom < bounds.top || at.top > bounds.bottom)
        typer.style.opacity = hidden ? '0' : '1'
      },
    })
  }

  // Puts the typing cursor right after the last typed character of el
  private placeTyper(typer: HTMLElement, el: HTMLElement) {
    let x = 0
    let y = 0
    let h = 16
    const node = Array.from(el.childNodes).find(
      (n): n is Text => n.nodeType === Node.TEXT_NODE && (n.nodeValue ?? '').trim() !== '',
    )
    const len = node?.nodeValue?.length ?? 0
    let rect: DOMRect | null = null
    if (node && len > 0) {
      const range = document.createRange()
      range.setStart(node, len - 1)
      range.setEnd(node, len)
      const r = range.getBoundingClientRect()
      if (r.height > 0) rect = new DOMRect(r.right, r.top, 0, r.height)
    }
    if (!rect) {
      const r = el.getBoundingClientRect()
      rect = new DOMRect(r.left, r.top, 0, Math.min(r.height, 18))
    }
    x = rect.x
    y = rect.y
    h = rect.height
    typer.style.transform = `translate3d(${x}px, ${y}px, 0)`
    typer.style.setProperty('--typer-h', `${h}px`)
  }

  private frame = (ts: number) => {
    this.raf = 0
    const dt = this.lastTs ? Math.min(0.05, (ts - this.lastTs) / 1000) : 0
    this.lastTs = ts
    this.clock += dt
    this.steps = this.steps.filter((s) => !s.done)
    let busy = false
    for (const s of this.steps) {
      if (this.clock < s.start) {
        busy = true
        continue
      }
      const p = s.dur > 0 ? Math.min(1, (this.clock - s.start) / s.dur) : 1
      s.run(p)
      if (p >= 1) s.done = true
      else busy = true
    }
    // An agent with nothing queued any more leaves its last box while the text is still typing
    for (const lane of this.lanes) {
      if (lane.visible && this.clock > lane.free + 0.6) this.hideLane(lane)
    }
    if (busy) this.raf = requestAnimationFrame(this.frame)
    else this.idle()
  }

  // Called once, when the drawing has finished.
  onDone: (() => void) | null = null

  // Nothing left to draw: stop the loop. Boxes stay where they are.
  private idle() {
    this.steps = []
    this.lastTs = 0
    for (const lane of this.lanes) this.hideLane(lane)
    const done = this.onDone
    this.onDone = null
    done?.()
  }

  private kick() {
    if (this.raf || this.disposed || document.hidden || this.steps.length === 0) return
    this.lastTs = 0
    this.raf = requestAnimationFrame(this.frame)
  }

  // Only writes when the text changed, so a steady tag costs nothing per frame.
  private setTag(lane: HudLane, text: string) {
    if (lane.tag.textContent !== text) lane.tag.textContent = text
  }

  private showLane(lane: HudLane) {
    if (!lane.visible) {
      lane.visible = true
      lane.node.style.opacity = '1'
    }
  }

  private hideLane(lane: HudLane) {
    if (lane.visible) {
      lane.visible = false
      lane.node.style.opacity = '0'
    }
  }

  private moveLane(lane: HudLane, x: number, y: number) {
    // Keep the cursor and its name tag on screen, e.g. on the controls box in the bottom-left
    // corner, where the tag would otherwise hang below or beside the viewport.
    const margin = 6
    const maxX = window.innerWidth - lane.tag.offsetWidth - 16 - margin
    const maxY = window.innerHeight - lane.tag.offsetHeight - 16 - margin
    const cx = Math.min(Math.max(x, margin), Math.max(margin, maxX))
    const cy = Math.min(Math.max(y, margin), Math.max(margin, maxY))
    lane.node.style.transform = `translate3d(${cx}px, ${cy}px, 0)`
  }

  // Draws the box's four sides with scaleX/scaleY so the 1px stroke keeps its
  // width. Right and bottom sides travel with the growing corner.
  private paint(box: HudBox, p: number) {
    box.progress = p
    box.fill.style.transform = `scale(${p})`
    box.edgeT.style.transform = `scaleX(${p})`
    box.edgeL.style.transform = `scaleY(${p})`
    box.edgeR.style.transform = `translate3d(${p * box.w - 1}px, 0, 0) scaleY(${p})`
    box.edgeB.style.transform = `translate3d(0, ${p * box.h - 1}px, 0) scaleX(${p})`
  }

  // Reads the target's rectangle. Returns false when it has no size.
  private measure(box: HudBox): boolean {
    const r = box.target.getBoundingClientRect()
    box.x = r.left
    box.y = r.top
    box.w = r.width
    box.h = r.height
    return r.width > 0 && r.height > 0
  }

  private place(box: HudBox) {
    // A collapsed panel is just a small pill with its own border, so it gets no drawn box on top
    if (box.target.classList.contains('panel-min')) {
      box.node.style.display = 'none'
      return
    }
    if (this.measure(box)) this.apply(box)
    else box.node.style.display = 'none'
  }

  // Writes the box's geometry (one layout set, outside the loop) and its paint.
  private apply(box: HudBox) {
    const s = box.node.style
    s.display = ''
    s.left = `${box.x}px`
    s.top = `${box.y}px`
    s.width = `${box.w}px`
    s.height = `${box.h}px`
    this.paint(box, box.progress)
  }

  private prune() {
    for (const [target, box] of this.boxes) {
      if (target.isConnected) continue
      if (box) {
        box.node.remove()
        this.sizes?.unobserve(target)
      }
      this.boxes.delete(target)
      this.parts.delete(target)
    }
  }
}

// Mount inside the rift root. `ready` turns true when the model has loaded;
// nothing is measured or animated before that.
export function HudDraw({ ready, onDone }: { ready: boolean; onDone?: () => void }) {
  const overlayRef = useRef<HTMLDivElement>(null)
  const doneRef = useRef(onDone)
  doneRef.current = onDone

  useEffect(() => {
    const overlay = overlayRef.current
    const root = overlay?.parentElement
    if (!ready || !overlay || !root) return
    const reduced = prefersReducedMotion()
    const drawer = new HudDrawer(overlay, root, reduced)
    drawer.onDone = () => doneRef.current?.()
    drawer.start()
    // Reduced motion draws instantly and has no loop to report back from
    if (reduced) doneRef.current?.()
    const onRescan = () => drawer.rescan()
    window.addEventListener('hud-rescan', onRescan)
    const onRelayout = () => drawer.relayout()
    window.addEventListener('hud-relayout', onRelayout)
    const onRedraw = (e: Event) => {
      const selector = (e as CustomEvent<{ selector?: string }>).detail?.selector
      if (selector) drawer.redraw(selector)
    }
    window.addEventListener('hud-redraw', onRedraw)
    const onForget = (e: Event) => drawer.forgetSeen((e as CustomEvent<{ names?: string[] }>).detail?.names ?? [])
    window.addEventListener('hud-forget', onForget)
    return () => {
      window.removeEventListener('hud-forget', onForget)
      window.removeEventListener('hud-redraw', onRedraw)
      window.removeEventListener('hud-rescan', onRescan)
      window.removeEventListener('hud-relayout', onRelayout)
      drawer.dispose()
    }
  }, [ready])

  return <div className="hud-draw" ref={overlayRef} aria-hidden="true" />
}

export default DrawFrame
