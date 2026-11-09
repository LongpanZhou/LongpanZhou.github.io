import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import type { CSSProperties, ReactNode } from 'react'

// A drag handle and minimize button for a HUD panel. Render it as a child of the panel: it
// finds the panel through its parent element. Dragging uses the CSS `translate` property, which
// stacks with the panel's own `transform` (the profile card centres itself with one). Position
// and minimized state are remembered in this browser, per panel id.

interface Saved {
  x: number
  y: number
  min: boolean
  w?: number // set once the panel has been resized
  h?: number
}

const storageKey = (id: string) => `riftPanel:${id}`

// Ids starting with "tmp:" belong to panels that open where they are dropped (the README panels):
// nothing is remembered for them.
const transient = (id: string) => id.startsWith('tmp:')

function load(id: string): Saved {
  if (transient(id)) return { x: 0, y: 0, min: false }
  try {
    const raw = window.localStorage.getItem(storageKey(id))
    if (raw) return { x: 0, y: 0, min: false, ...(JSON.parse(raw) as Partial<Saved>) }
  } catch {
    // Storage can be blocked. The panel then starts in its default place.
  }
  return { x: 0, y: 0, min: false }
}

function save(id: string, saved: Saved) {
  if (transient(id)) return
  try {
    window.localStorage.setItem(storageKey(id), JSON.stringify(saved))
  } catch {
    // Storage can be blocked. The move still works for this session.
  }
}

const clamp = (v: number, lo: number, hi: number) => Math.min(Math.max(v, lo), Math.max(lo, hi))
const NAV_HEIGHT = 70
const RESIZE_DIRECTIONS = ['n', 's', 'e', 'w', 'ne', 'nw', 'se', 'sw']

// With onHide, the button calls it instead of minimizing the panel in place (the layout editor
// uses this to collapse back into its pill).
//
// With resizable, the panel also gets handles on every edge and corner. It works with any CSS
// anchoring: each move measures the panel after the size change and translates it so the edge
// opposite the one being dragged stays exactly where it was. That also handles the profile
// panel, which is centred with a transform.
export default function PanelChrome({
  id,
  label,
  inside = false,
  onHide,
  onClose,
  resizable = false,
  fit = true,
  noButton = false,
  fillText = false,
  minWidth = 180,
  minHeight = 120,
}: {
  id: string
  label: string
  inside?: boolean
  onHide?: () => void
  onClose?: () => void // adds a close button next to the minimize button
  resizable?: boolean
  fit?: boolean // scale the content with the box (HUD readouts); false for scrolling content
  fillText?: boolean // once resized, make the text as large as the box allows (text-only boxes)
  noButton?: boolean // keep resizing and dragging but show no minimize button
  minWidth?: number
  minHeight?: number
}) {
  const bar = useRef<HTMLDivElement>(null)
  const offset = useRef({ x: 0, y: 0 })
  // The size the user gave the panel, and the inline box styles it had before that
  const sizeRef = useRef<{ w: number; h: number } | null>(null)
  const original = useRef({
    width: '',
    height: '',
    maxHeight: '',
    minWidth: '',
    maxWidth: '',
    minHeight: '',
  })
  const persist = (minValue: boolean) => save(id, { ...offset.current, min: minValue, ...(sizeRef.current ?? {}) })

  // Explicit sizes win over the panel's own width/max-height, so a resized box is exactly the
  // size the user dragged even when the original CSS had min/max constraints.
  const applySize = (panel: HTMLElement, w: number, h: number) => {
    sizeRef.current = { w, h }
    panel.style.width = `${w}px`
    panel.style.height = `${h}px`
    panel.style.minWidth = '0'
    panel.style.maxWidth = 'none'
    panel.style.minHeight = '0'
    panel.style.maxHeight = 'none'
    panel.dataset.fitted = '1'
  }
  // A panel that hides through onHide never minimizes in place, so a minimized state saved under
  // its name by an earlier version must not hide its contents.
  const [min, setMin] = useState(() => (onHide || noButton ? false : load(id).min))

  // Text inside a resizable panel scales with its width. The natural size is captured before a
  // remembered size is restored, so the scale reflects how far the user has shrunk the box.
  useLayoutEffect(() => {
    const panel = bar.current?.parentElement
    if (!panel || !resizable || !fit) return
    // The natural size is taken before a remembered size is restored. A panel that is hidden at
    // mount (width 0) takes it the first time it has a size.
    let base: { w: number; h: number } | null = null
    const natural = panel.getBoundingClientRect()
    if (natural.width > 20 && natural.height > 10) base = { w: natural.width, h: natural.height }
    // Content zooms to fit the box in both directions, so a resized box never needs scrollbars
    if (id !== 'editor') panel.classList.add('panel-fit')
    // Text-only boxes: pick the largest zoom at which the wrapped content still fits the box. The
    // search is monotonic, so the result is stable and the text does not shake.
    const fillFit = () => {
      const fitsAt = (z: number) => {
        panel.style.setProperty('--hud-scale', z.toFixed(3))
        return panel.scrollHeight <= panel.clientHeight + 1 && panel.scrollWidth <= panel.clientWidth + 1
      }
      let lo = 0.2
      let hi = 8
      for (let i = 0; i < 9; i++) {
        const mid = (lo + hi) / 2
        if (fitsAt(mid)) lo = mid
        else hi = mid
      }
      panel.style.setProperty('--hud-scale', (Math.floor(lo * 50) / 50).toFixed(2))
    }
    if (fillText) panel.classList.add('panel-fill')
    const apply = () => {
      if (fillText) {
        // Only a box with an explicit size has a height to fill
        if (panel.dataset.fitted) fillFit()
        else panel.style.setProperty('--hud-scale', '1')
        return
      }
      const rect = panel.getBoundingClientRect()
      if (!base) {
        if (rect.width > 20 && rect.height > 10) base = { w: rect.width, h: rect.height }
        else return
      }
      // Steps of 1/50 keep the zoom from changing on every sub-pixel of a drag
      const raw = clamp(Math.min(rect.width / base.w, rect.height / base.h), 0.25, 2)
      panel.style.setProperty('--hud-scale', (Math.round(raw * 50) / 50).toFixed(2))
    }
    apply()
    const observer = new ResizeObserver(apply)
    observer.observe(panel)
    return () => {
      observer.disconnect()
      panel.classList.remove('panel-fit', 'panel-fill')
      panel.style.removeProperty('--hud-scale')
    }
  }, [resizable, id, fillText, fit])

  // Put the panel back where the user left it
  useLayoutEffect(() => {
    const panel = bar.current?.parentElement
    if (!panel) return
    const saved = load(id)
    offset.current = { x: saved.x, y: saved.y }
    panel.style.translate = `${saved.x}px ${saved.y}px`
    if (resizable) {
      original.current = {
        width: panel.style.width,
        height: panel.style.height,
        maxHeight: panel.style.maxHeight,
        minWidth: panel.style.minWidth,
        maxWidth: panel.style.maxWidth,
        minHeight: panel.style.minHeight,
      }
      if (saved.w && saved.h) {
        applySize(
          panel,
          clamp(saved.w, minWidth, window.innerWidth - 24),
          clamp(saved.h, minHeight, window.innerHeight - NAV_HEIGHT - 8),
        )
      }
    }
    // Leave the panel as it was found. A panel that stays mounted while its chrome is rebuilt (the
    // music player, which has its own state in each view) must not keep the previous instance's
    // position or size.
    return () => {
      panel.style.translate = ''
      if (resizable) {
        panel.style.width = original.current.width
        panel.style.height = original.current.height
        panel.style.maxHeight = original.current.maxHeight
        panel.style.minWidth = original.current.minWidth
        panel.style.maxWidth = original.current.maxWidth
        panel.style.minHeight = original.current.minHeight
        delete panel.dataset.fitted
        delete panel.dataset.resized
      }
    }
  }, [id]) // eslint-disable-line react-hooks/exhaustive-deps

  useLayoutEffect(() => {
    const panel = bar.current?.parentElement
    if (!panel) return
    panel.classList.toggle('panel-min', min)
    // When the panel opens up, make sure it fits: if there is no room to the right or below, it
    // opens to the left or upwards instead, by moving just far enough to stay on screen.
    if (!min) {
      const rect = panel.getBoundingClientRect()
      let dx = 0
      let dy = 0
      if (rect.right > window.innerWidth - 4) dx = window.innerWidth - 4 - rect.right
      if (rect.left + dx < 4) dx = 4 - rect.left
      if (rect.bottom > window.innerHeight - 4) dy = window.innerHeight - 4 - rect.bottom
      if (rect.top + dy < NAV_HEIGHT) dy = NAV_HEIGHT - rect.top
      if (dx !== 0 || dy !== 0) {
        offset.current = { x: offset.current.x + dx, y: offset.current.y + dy }
        panel.style.translate = `${offset.current.x}px ${offset.current.y}px`
        persist(false)
      }
    }
    // The drawn HUD boxes follow at once, so a collapsed panel does not keep its big box
    window.dispatchEvent(new Event('hud-relayout'))
    return () => panel.classList.remove('panel-min')
  }, [min, id])

  const minRef = useRef(min)
  minRef.current = min
  const justDragged = useRef(false) // a drag started on the button must not also toggle it
  // Where the collapsed box sat when it was opened, so closing it puts it back exactly there
  const pillOffset = useRef<{ x: number; y: number } | null>(null)

  // Starts a drag. From the handle it moves at once. From the panel body it waits for a few
  // pixels of movement, so plain clicks on the panel still work.
  const beginDrag = (down: { clientX: number; clientY: number }, fromBody: boolean) => {
    const panel = bar.current?.parentElement
    if (!panel) return
    const start = {
      px: down.clientX,
      py: down.clientY,
      x: offset.current.x,
      y: offset.current.y,
      rect: panel.getBoundingClientRect(),
    }
    let moved = !fromBody
    // The drawn HUD boxes stay hidden while the panel moves, then re-measure at the end
    if (moved) document.documentElement.classList.add('hud-dragging')

    const move = (ev: PointerEvent) => {
      const rawX = ev.clientX - start.px
      const rawY = ev.clientY - start.py
      if (!moved) {
        if (Math.hypot(rawX, rawY) < 4) return
        moved = true
        document.documentElement.classList.add('hud-dragging')
      }
      const dx = clamp(rawX, 4 - start.rect.left, window.innerWidth - 4 - start.rect.right)
      const dy = clamp(rawY, NAV_HEIGHT - start.rect.top, window.innerHeight - 4 - start.rect.bottom)
      offset.current = { x: start.x + dx, y: start.y + dy }
      panel.style.translate = `${offset.current.x}px ${offset.current.y}px`
      window.dispatchEvent(new Event('hud-relayout')) // the drawn HUD boxes follow the panel
    }
    const stop = () => {
      window.removeEventListener('pointermove', move)
      window.removeEventListener('pointerup', stop)
      window.removeEventListener('pointercancel', stop)
      if (!moved) return
      justDragged.current = true
      window.setTimeout(() => {
        justDragged.current = false
      }, 60)
      document.documentElement.classList.remove('hud-dragging')
      persist(minRef.current)
      window.dispatchEvent(new Event('resize')) // the HUD boxes re-measure on resize
    }
    window.addEventListener('pointermove', move)
    window.addEventListener('pointerup', stop)
    window.addEventListener('pointercancel', stop)
  }

  // Pressing anywhere on the panel body drags it, except on controls and links
  useLayoutEffect(() => {
    const panel = bar.current?.parentElement
    if (!panel) return
    const onDown = (e: PointerEvent) => {
      if (e.button !== 0) return
      const target = e.target as Element | null
      if (target?.closest('button, input, textarea, select, a, audio, label, [data-nodrag], .panel-resize')) return
      beginDrag(e, true)
    }
    // Double-clicking the panel body puts it back in its default place
    const onDouble = (e: MouseEvent) => {
      const target = e.target as Element | null
      if (target?.closest('button, input, textarea, select, a, audio, label, [data-nodrag], .panel-resize')) return
      resetPosition()
    }
    // Stops the browser starting a text or element selection from a press on the panel body
    const onMouseDown = (e: MouseEvent) => {
      const target = e.target as Element | null
      if (target?.closest('button, input, textarea, select, a, audio, label, [data-nodrag], .panel-resize')) return
      e.preventDefault()
    }
    panel.addEventListener('pointerdown', onDown)
    panel.addEventListener('mousedown', onMouseDown)
    panel.addEventListener('dblclick', onDouble)
    return () => {
      panel.removeEventListener('pointerdown', onDown)
      panel.removeEventListener('mousedown', onMouseDown)
      panel.removeEventListener('dblclick', onDouble)
    }
  }, [id]) // eslint-disable-line react-hooks/exhaustive-deps

  const resetPosition = () => {
    const panel = bar.current?.parentElement
    if (!panel) return
    offset.current = { x: 0, y: 0 }
    panel.style.translate = '0px 0px'
    if (resizable && sizeRef.current) {
      // Back to the size and constraints it started with
      sizeRef.current = null
      panel.style.width = original.current.width
      panel.style.height = original.current.height
      panel.style.maxHeight = original.current.maxHeight
      panel.style.minWidth = original.current.minWidth
      panel.style.maxWidth = original.current.maxWidth
      panel.style.minHeight = original.current.minHeight
      delete panel.dataset.fitted
      delete panel.dataset.resized
    }
    persist(min)
    window.dispatchEvent(new Event('resize'))
  }

  // Drags one edge or corner. The dragged edge follows the pointer; the opposite edge is kept
  // fixed with a translation after the browser has re-laid out the panel. Measuring is what makes
  // this work for left-, right- and centre-anchored panels alike.
  const beginResize = (e: React.PointerEvent<HTMLElement>, dir: string) => {
    const panel = bar.current?.parentElement
    if (!panel || e.button !== 0) return
    e.preventDefault()
    e.stopPropagation()
    cancelDemo()
    const startRect = panel.getBoundingClientRect()
    const start = { px: e.clientX, py: e.clientY, x: offset.current.x, y: offset.current.y, rect: startRect }

    const move = (ev: PointerEvent) => {
      const dx = ev.clientX - start.px
      const dy = ev.clientY - start.py
      if (dx === 0 && dy === 0) return
      // A size change is a real resize: the layout editor's hint can stop showing after this.
      panel.dataset.resized = '1'
      document.documentElement.classList.add('hud-dragging')
      let w = start.rect.width
      let h = start.rect.height
      if (dir.includes('e')) {
        w = clamp(start.rect.width + dx, minWidth, window.innerWidth - 4 - start.rect.left)
      } else if (dir.includes('w')) {
        w = clamp(start.rect.width - dx, minWidth, start.rect.right - 4)
      }
      if (dir.includes('s')) {
        h = clamp(start.rect.height + dy, minHeight, window.innerHeight - 4 - start.rect.top)
      } else if (dir.includes('n')) {
        h = clamp(start.rect.height - dy, minHeight, start.rect.bottom - NAV_HEIGHT)
      }

      panel.style.width = `${w}px`
      panel.style.height = `${h}px`
      panel.style.minWidth = '0'
      panel.style.maxWidth = 'none'
      panel.style.minHeight = '0'
      panel.style.maxHeight = 'none'
      panel.dataset.fitted = '1'

      // Keep the opposite edge where it was, whatever the panel's CSS anchoring is.
      const after = panel.getBoundingClientRect()
      const fixX = dir.includes('e') ? start.rect.left - after.left : dir.includes('w') ? start.rect.right - after.right : 0
      const fixY = dir.includes('s') ? start.rect.top - after.top : dir.includes('n') ? start.rect.bottom - after.bottom : 0
      const x = start.x + fixX
      const y = start.y + fixY
      offset.current = { x, y }
      panel.style.translate = `${x}px ${y}px`
      sizeRef.current = { w: Math.round(w), h: Math.round(h) }
      window.dispatchEvent(new Event('hud-relayout')) // the drawn HUD box follows
    }
    const stop = () => {
      window.removeEventListener('pointermove', move)
      window.removeEventListener('pointerup', stop)
      window.removeEventListener('pointercancel', stop)
      document.documentElement.classList.remove('hud-dragging')
      persist(minRef.current)
      window.dispatchEvent(new Event('resize'))
    }
    window.addEventListener('pointermove', move)
    window.addEventListener('pointerup', stop)
    window.addEventListener('pointercancel', stop)
  }

  // A real, animated resize of the bottom-right corner and back, used by the layout editor's hint.
  // The panel's own styles are restored exactly when it ends or when the user takes over.
  const demoRaf = useRef(0)
  const demoRestore = useRef<(() => void) | null>(null)
  const cancelDemo = () => {
    cancelAnimationFrame(demoRaf.current)
    demoRestore.current?.()
  }
  useEffect(() => {
    if (!resizable) return
    const onDemo = (event: Event) => {
      if ((event as CustomEvent<{ id?: string }>).detail?.id !== id) return
      const panel = bar.current?.parentElement
      if (!panel || demoRestore.current || panel.dataset.resized || panel.classList.contains('panel-min')) return
      const startRect = panel.getBoundingClientRect()
      if (startRect.width === 0) return
      const snap = {
        width: panel.style.width,
        height: panel.style.height,
        minWidth: panel.style.minWidth,
        maxWidth: panel.style.maxWidth,
        minHeight: panel.style.minHeight,
        maxHeight: panel.style.maxHeight,
        offset: { ...offset.current },
      }
      // Grow if there is room to the right / below; otherwise shrink, so the corner always moves
      const roomRight = window.innerWidth - 4 - startRect.right
      const roomDown = window.innerHeight - 4 - startRect.bottom
      const dw = roomRight >= 32 ? Math.min(72, roomRight - 8) : -Math.min(72, Math.max(0, startRect.width - minWidth))
      const dh = roomDown >= 32 ? Math.min(56, roomDown - 8) : -Math.min(56, Math.max(0, startRect.height - minHeight))
      if (Math.abs(dw) < 8 && Math.abs(dh) < 8) return

      const restore = () => {
        panel.style.width = snap.width
        panel.style.height = snap.height
        panel.style.minWidth = snap.minWidth
        panel.style.maxWidth = snap.maxWidth
        panel.style.minHeight = snap.minHeight
        panel.style.maxHeight = snap.maxHeight
        offset.current = snap.offset
        panel.style.translate = `${snap.offset.x}px ${snap.offset.y}px`
        demoRestore.current = null
        window.dispatchEvent(new Event('hud-relayout'))
      }
      demoRestore.current = restore

      const GROW = 700
      const HOLD = 400
      const SHRINK = 700
      const t0 = performance.now()
      const easeInOut = (p: number) => (p < 0.5 ? 2 * p * p : 1 - (-2 * p + 2) ** 2 / 2)
      // Measure the opposite-edge correction once, at full size. It scales linearly with the size
      // change for every anchoring, so the frames below only write styles (no per-frame reads).
      const setSize = (k: number) => {
        panel.style.width = `${startRect.width + dw * k}px`
        panel.style.height = `${startRect.height + dh * k}px`
        panel.style.minWidth = '0'
        panel.style.maxWidth = 'none'
        panel.style.minHeight = '0'
        panel.style.maxHeight = 'none'
      }
      setSize(1)
      const full = panel.getBoundingClientRect()
      const fixX = startRect.left - full.left
      const fixY = startRect.top - full.top
      setSize(0)
      const apply = (k: number) => {
        setSize(k)
        offset.current = { x: snap.offset.x + fixX * k, y: snap.offset.y + fixY * k }
        panel.style.translate = `${offset.current.x}px ${offset.current.y}px`
        window.dispatchEvent(new Event('rift-panel-demo-frame')) // the cursor follows in the same frame
      }
      const frame = (now: number) => {
        const t = now - t0
        if (t >= GROW + HOLD + SHRINK) {
          restore()
          window.dispatchEvent(new Event('resize'))
          return
        }
        if (t < GROW) apply(easeInOut(t / GROW))
        else if (t < GROW + HOLD) apply(1)
        else apply(1 - easeInOut((t - GROW - HOLD) / SHRINK))
        demoRaf.current = requestAnimationFrame(frame)
      }
      demoRaf.current = requestAnimationFrame(frame)
    }
    window.addEventListener('rift-panel-resize-demo', onDemo)
    return () => {
      window.removeEventListener('rift-panel-resize-demo', onDemo)
      cancelDemo()
    }
  }, [resizable, id, minWidth, minHeight])

  const toggle = () => {
    if (justDragged.current) return
    if (onHide) {
      onHide()
      return
    }
    const next = !min
    const panel = bar.current?.parentElement
    if (!next) {
      // Opening up: the box may be nudged to fit on screen, so remember where the pill was
      pillOffset.current = { ...offset.current }
    } else if (pillOffset.current && panel) {
      // Collapsing again: back to exactly where the pill was before it opened
      offset.current = pillOffset.current
      panel.style.translate = `${offset.current.x}px ${offset.current.y}px`
      pillOffset.current = null
    }
    setMin(next)
    persist(next)
    window.dispatchEvent(new Event('resize'))
  }

  return (
    <>
    <div
      ref={bar}
      className={`panel-chrome${inside ? ' panel-chrome--shifted' : ''}`}
      onPointerDown={(e) => e.stopPropagation()}
    >
      {min && <span className="panel-chrome__label">{label}</span>}
      {!noButton && <button
        type="button"
        onPointerDown={(e) => beginDrag(e, true)}
        onClick={toggle}
        aria-label={onHide ? `Hide ${label}` : min ? `Restore ${label}` : `Minimize ${label}`}
      >
        {min ? '▢' : '—'}
      </button>}
      {onClose && (
        <button
          type="button"
          className="panel-chrome__close"
          onPointerDown={(e) => e.stopPropagation()}
          onClick={onClose}
          aria-label={`Close ${label}`}
        >
          ✕
        </button>
      )}
    </div>
    {resizable &&
      RESIZE_DIRECTIONS.map((dir) => (
        <div key={dir} className={`panel-resize panel-resize--${dir}`} onPointerDown={(e) => beginResize(e, dir)} />
      ))}
    </>
  )
}

// A button that can be dragged anywhere on screen. A plain click still triggers onClick; a drag
// does not. Its position is remembered in this browser under `id`.
export function DragButton({
  id,
  onClick,
  style,
  children,
}: {
  id: string
  onClick: () => void
  style: CSSProperties
  children: ReactNode
}) {
  const ref = useRef<HTMLButtonElement>(null)
  const offset = useRef({ x: 0, y: 0 })
  const justDragged = useRef(false)

  useLayoutEffect(() => {
    const el = ref.current
    if (!el) return
    const saved = load(id)
    offset.current = { x: saved.x, y: saved.y }
    el.style.translate = `${saved.x}px ${saved.y}px`
  }, [id])

  const startDrag = (e: React.PointerEvent<HTMLButtonElement>) => {
    const el = ref.current
    if (!el) return
    const start = { px: e.clientX, py: e.clientY, x: offset.current.x, y: offset.current.y, rect: el.getBoundingClientRect() }
    let moved = false

    const move = (ev: PointerEvent) => {
      const rawX = ev.clientX - start.px
      const rawY = ev.clientY - start.py
      if (!moved && Math.hypot(rawX, rawY) < 4) return // a click, not a drag
      moved = true
      const dx = clamp(rawX, 4 - start.rect.left, window.innerWidth - 4 - start.rect.right)
      const dy = clamp(rawY, NAV_HEIGHT - start.rect.top, window.innerHeight - 4 - start.rect.bottom)
      offset.current = { x: start.x + dx, y: start.y + dy }
      el.style.translate = `${offset.current.x}px ${offset.current.y}px`
    }
    const stop = () => {
      window.removeEventListener('pointermove', move)
      window.removeEventListener('pointerup', stop)
      window.removeEventListener('pointercancel', stop)
      if (!moved) return
      save(id, { ...offset.current, min: false })
      // The click that follows a drag must not fire onClick
      justDragged.current = true
      window.setTimeout(() => {
        justDragged.current = false
      }, 60)
    }
    window.addEventListener('pointermove', move)
    window.addEventListener('pointerup', stop)
    window.addEventListener('pointercancel', stop)
  }

  return (
    <button
      ref={ref}
      type="button"
      style={{ ...style, touchAction: 'none' }}
      title="Click to open, drag to move, double-click to reset"
      onPointerDown={startDrag}
      onDoubleClick={() => {
        const el = ref.current
        if (!el) return
        offset.current = { x: 0, y: 0 }
        el.style.translate = '0px 0px'
        save(id, { x: 0, y: 0, min: false })
      }}
      onClick={() => {
        if (justDragged.current) return
        onClick()
      }}
    >
      {children}
    </button>
  )
}

// A box that can be dragged anywhere on screen by any part that is not a button, so it can hold
// buttons of its own. Its position is remembered in this browser under `id`; double-click resets it.
export function DragBox({ id, style, children }: { id: string; style: CSSProperties; children: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null)
  const offset = useRef({ x: 0, y: 0 })

  useLayoutEffect(() => {
    const el = ref.current
    if (!el) return
    const saved = load(id)
    offset.current = { x: saved.x, y: saved.y }
    el.style.translate = `${saved.x}px ${saved.y}px`
  }, [id])

  const startDrag = (e: React.PointerEvent<HTMLDivElement>) => {
    const el = ref.current
    if (!el || e.button !== 0 || (e.target as Element).closest('button')) return
    e.preventDefault()
    const start = { px: e.clientX, py: e.clientY, x: offset.current.x, y: offset.current.y, rect: el.getBoundingClientRect() }
    const move = (ev: PointerEvent) => {
      const dx = clamp(ev.clientX - start.px, 4 - start.rect.left, window.innerWidth - 4 - start.rect.right)
      const dy = clamp(ev.clientY - start.py, NAV_HEIGHT - start.rect.top, window.innerHeight - 4 - start.rect.bottom)
      offset.current = { x: start.x + dx, y: start.y + dy }
      el.style.translate = `${offset.current.x}px ${offset.current.y}px`
    }
    const stop = () => {
      window.removeEventListener('pointermove', move)
      window.removeEventListener('pointerup', stop)
      window.removeEventListener('pointercancel', stop)
      save(id, { ...offset.current, min: false })
    }
    window.addEventListener('pointermove', move)
    window.addEventListener('pointerup', stop)
    window.addEventListener('pointercancel', stop)
  }

  return (
    <div
      ref={ref}
      style={{ ...style, touchAction: 'none', userSelect: 'none' }}
      onPointerDown={startDrag}
      onDoubleClick={(e) => {
        if ((e.target as Element).closest('button')) return
        const el = ref.current
        if (!el) return
        offset.current = { x: 0, y: 0 }
        el.style.translate = '0px 0px'
        save(id, { x: 0, y: 0, min: false })
      }}
    >
      {children}
    </div>
  )
}
