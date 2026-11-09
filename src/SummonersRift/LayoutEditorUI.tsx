import { useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react'
import type { CSSProperties } from 'react'
import PanelChrome, { DragBox } from './PanelChrome'
import { getPreview } from './modelPreview'
import { EDITOR_ENABLED, IS_VISITOR, editorStore } from './riftEdit'
import type { InventoryTile } from './riftEdit'

const PREVIEW_HEIGHT = 96

// The size the editor panel was last resized to. PanelChrome keeps it in this browser.
function readPanelSize(): { width: number; height: number } | null {
  try {
    const raw = window.localStorage.getItem('riftPanel:editor')
    const saved = raw ? (JSON.parse(raw) as { w?: number; h?: number }) : null
    return saved?.w && saved?.h ? { width: Math.round(saved.w), height: Math.round(saved.h) } : null
  } catch {
    return null
  }
}

// A model's thumbnail. It is only rendered once it scrolls into view: the champion files are
// 5 to 20 MB each, so rendering all of them up front would stall the page.
function Preview({ url, tint, thumb }: { url: string; tint?: string; thumb?: string }) {
  const box = useRef<HTMLDivElement>(null)
  const [visible, setVisible] = useState(false)
  const [src, setSrc] = useState('')

  useEffect(() => {
    const el = box.current
    if (!el) return
    const watcher = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setVisible(true)
          watcher.disconnect()
        }
      },
      { rootMargin: '120px' },
    )
    watcher.observe(el)
    return () => watcher.disconnect()
  }, [])

  useEffect(() => {
    if (!visible) return
    // A ready-made picture is just shown. Without one the model is loaded and drawn.
    if (thumb) {
      setSrc(thumb)
      return
    }
    let alive = true
    getPreview(url, tint).then((image) => {
      if (alive) setSrc(image)
    })
    return () => {
      alive = false
    }
  }, [visible, url, tint, thumb])

  return (
    <div ref={box} style={{ height: PREVIEW_HEIGHT, display: 'grid', placeItems: 'center' }}>
      {src ? (
        <img src={src} alt="" draggable={false} style={{ display: 'block', width: '100%', height: PREVIEW_HEIGHT, objectFit: 'contain' }} />
      ) : (
        <span style={{ opacity: 0.4, fontSize: 10 }}>{visible ? 'loading…' : ''}</span>
      )}
    </div>
  )
}

// The layout editor's pill and panel, in the page instead of inside the 3D canvas. The canvas
// owns the layout and publishes it to editorStore; this only shows it and sends actions back.
// The resize demo has played in this page load. The editor is rebuilt when the view changes, so
// this lives outside the component: the demo never plays a second time.
let hintPlayed = false

export default function LayoutEditorUI() {
  const snap = useSyncExternalStore(editorStore.subscribe, editorStore.getSnapshot)
  const area = useRef<HTMLTextAreaElement>(null)
  const panel = useRef<HTMLDivElement>(null)
  const [query, setQuery] = useState('')
  const [group, setGroup] = useState('All')
  const [dragging, setDragging] = useState(false)
  const [panelSize, setPanelSize] = useState(readPanelSize)
  useEffect(() => {
    // PanelChrome dispatches a resize event when it finishes resizing the panel
    const update = () => setPanelSize(readPanelSize())
    window.addEventListener('resize', update)
    return () => window.removeEventListener('resize', update)
  }, [])
  // The layout as exported, plus the editor panel's own size, so copying keeps both
  const exportText = useMemo(() => {
    if (!panelSize) return snap.exported
    try {
      return JSON.stringify({ ...JSON.parse(snap.exported), __editorPanel: panelSize }, null, 1)
    } catch {
      return snap.exported
    }
  }, [snap.exported, panelSize])
  const cursorRef = useRef<HTMLDivElement>(null)
  const [hintDone, setHintDone] = useState(hintPlayed)
  // The hint waits for the loading screen and the HUD drawing to finish
  const [pageReady, setPageReady] = useState(false)
  useEffect(() => {
    if (pageReady) return
    const id = window.setInterval(() => {
      // Also not while the HUD is still holding the editor hidden, waiting for its box to be drawn
      const held = panel.current?.classList.contains('hud-hold') ?? true
      if (!held && !document.documentElement.classList.contains('hud-booting') && !document.querySelector('.loading-overlay')) {
        setPageReady(true)
      }
    }, 250)
    return () => window.clearInterval(id)
  }, [pageReady])

  // The resize cursor sits on the panel's bottom-right corner on screen. It is a sibling of the
  // panel, not part of its scrolling content, so it stays visible however far the panel scrolls.
  // It is hidden once the panel has been resized.
  useEffect(() => {
    if (!snap.panelOpen || hintDone || !pageReady) return
    let frame = 0
    const place = () => {
      const el = panel.current
      const cursor = cursorRef.current
      if (!el || !cursor) return
      const r = el.getBoundingClientRect()
      // The cursor tip sits on the bottom-right corner while the panel really resizes.
      const x = Math.min(Math.max(r.right - 4, 8), window.innerWidth - 8)
      const y = Math.min(Math.max(r.bottom - 4, 8), window.innerHeight - 8)
      cursor.style.transform = `translate3d(${x}px, ${y}px, 0)`
      cursor.style.display = el.dataset.resized || r.width === 0 ? 'none' : ''
    }
    const follow = () => {
      place()
      frame = requestAnimationFrame(follow)
    }
    frame = requestAnimationFrame(follow)
    // PanelChrome announces each demo frame so the cursor moves with the panel, not a frame behind
    window.addEventListener('rift-panel-demo-frame', place)
    return () => {
      cancelAnimationFrame(frame)
      window.removeEventListener('rift-panel-demo-frame', place)
    }
  }, [snap.panelOpen, hintDone, pageReady])

  // Once per page load the panel really resizes (PanelChrome does it) while the agent cursor
  // rides its corner, then everything goes back and the hint retires.
  useEffect(() => {
    if (!snap.panelOpen || hintDone || !pageReady) return
    const start = window.setTimeout(() => {
      const el = panel.current
      if (el && !el.dataset.resized) {
        window.dispatchEvent(new CustomEvent('rift-panel-resize-demo', { detail: { id: 'editor' } }))
      }
    }, 1300)
    const end = window.setTimeout(() => {
      hintPlayed = true
      setHintDone(true)
    }, 3300)
    return () => {
      window.clearTimeout(start)
      window.clearTimeout(end)
    }
  }, [snap.panelOpen, hintDone, pageReady])
  if (!EDITOR_ENABLED) return null

  const button: CSSProperties = {
    background: 'rgba(10, 200, 255, 0.12)',
    border: '1px solid #0ac8ff',
    color: '#f0e6d2',
    padding: '6px 10px',
    cursor: 'pointer',
    font: 'inherit',
  }

  // Drag a tile out of the panel and drop it on the map. While dragging, a ghost with the model's
  // preview follows the pointer, a gold ring on the map shows where it would land, and the panel
  // fades so the map is visible. A plain click adds the model at the centre of the view.
  const dragTile = (e: React.PointerEvent<HTMLButtonElement>, tile: InventoryTile) => {
    if (e.button !== 0) return
    e.preventDefault()
    const start = { x: e.clientX, y: e.clientY }
    let ghost: HTMLDivElement | null = null
    let last = { x: e.clientX, y: e.clientY }
    let raf = 0

    const overPanel = (x: number, y: number) => {
      const rect = panel.current?.getBoundingClientRect()
      return !!rect && x >= rect.left && x <= rect.right && y >= rect.top && y <= rect.bottom
    }

    const move = (ev: PointerEvent) => {
      last = { x: ev.clientX, y: ev.clientY }
      if (!ghost) {
        if (Math.hypot(ev.clientX - start.x, ev.clientY - start.y) < 5) return
        ghost = document.createElement('div')
        ghost.style.cssText =
          'position:fixed;left:0;top:0;z-index:4000;pointer-events:none;width:110px;padding:4px;' +
          'background:rgba(1,10,19,0.92);border:1px solid #c8aa6e;color:#c8aa6e;text-align:center;' +
          'font:11px Consolas,monospace;box-shadow:0 0 16px rgba(200,170,110,0.4)'
        const image = document.createElement('img')
        image.style.cssText = 'display:block;width:100%;height:70px;object-fit:contain'
        const caption = document.createElement('div')
        caption.textContent = tile.label
        caption.style.cssText = 'white-space:nowrap;overflow:hidden;text-overflow:ellipsis'
        ghost.append(image, caption)
        document.body.appendChild(ghost)
        getPreview(tile.url, tile.tint).then((src) => {
          if (src) image.src = src
        })
        setDragging(true)
      }
      ghost.style.transform = `translate(${ev.clientX + 14}px, ${ev.clientY + 14}px)`
      // Tell the map where it would land, at most once per frame. Nothing over the panel.
      if (!raf) {
        raf = requestAnimationFrame(() => {
          raf = 0
          if (overPanel(last.x, last.y)) editorStore.actions.dropHover(null)
          else editorStore.actions.dropHover(last.x, last.y)
        })
      }
    }

    const stop = (ev: PointerEvent) => {
      window.removeEventListener('pointermove', move)
      window.removeEventListener('pointerup', stop)
      window.removeEventListener('pointercancel', stop)
      cancelAnimationFrame(raf)
      editorStore.actions.dropHover(null)
      setDragging(false)
      if (!ghost) {
        // A click, not a drag: add it at the centre of the view
        editorStore.actions.addAt(tile.key, window.innerWidth / 2, window.innerHeight / 2)
        return
      }
      ghost.remove()
      if (!overPanel(ev.clientX, ev.clientY)) editorStore.actions.addAt(tile.key, ev.clientX, ev.clientY)
    }
    window.addEventListener('pointermove', move)
    window.addEventListener('pointerup', stop)
    window.addEventListener('pointercancel', stop)
  }

  if (!snap.panelOpen) {
    return (
      <DragBox
        id="edit-pill-right"
        style={{
          position: 'fixed',
          top: 72,
          right: 12,
          zIndex: 1000,
          // Same look as the other minimized boxes, a little wider for the extra button
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          boxSizing: 'border-box',
          width: 148,
          height: 34,
          padding: '0 8px',
          lineHeight: 1,
          background: 'var(--hud-panel-bg)',
          border: '2px solid #C8AA6E',
          borderRadius: 8,
          boxShadow: '0 0 20px rgba(200, 170, 110, 0.3)',
          color: '#c8aa6e',
          font: '10px Consolas, ui-monospace, monospace',
          letterSpacing: '1px',
        }}
      >
        <span>Editor</span>
        <span style={{ display: 'flex', gap: 5 }}>
          <button
            type="button"
            style={{
            background: 'none',
            border: '1px solid rgba(200, 170, 110, 0.7)',
            color: '#c8aa6e',
            padding: '0 7px',
            lineHeight: '16px',
            font: 'inherit',
            cursor: 'pointer',
          }}
            onClick={editorStore.actions.toggleBoxes}
            title={snap.boxes ? 'Hide the floating boxes over the models' : 'Show the floating boxes over the models'}
            aria-label={snap.boxes ? 'Hide the floating boxes' : 'Show the floating boxes'}
          >
            {snap.boxes ? '◉' : '○'}
          </button>
          <button
            type="button"
            style={{
            background: 'none',
            border: '1px solid rgba(200, 170, 110, 0.7)',
            color: '#c8aa6e',
            padding: '0 7px',
            lineHeight: '16px',
            font: 'inherit',
            cursor: 'pointer',
          }}
            onClick={editorStore.actions.toggle}
            aria-label="Expand the editor"
          >
            ▢
          </button>
        </span>
      </DragBox>
    )
  }

  const heading: CSSProperties = { color: '#c8aa6e', marginBottom: 4 }
  const groups = ['All', ...Array.from(new Set(snap.inventory.map((tile) => tile.group)))]
  // How many models each group has, so the totals can be checked against the folder
  const counts: Record<string, number> = { All: snap.inventory.length }
  for (const tile of snap.inventory) counts[tile.group] = (counts[tile.group] ?? 0) + 1
  const needle = query.trim().toLowerCase()
  const visible = snap.inventory.filter(
    (tile) => (group === 'All' || tile.group === group) && tile.label.toLowerCase().includes(needle),
  )

  return (
    <>
    <div
      ref={panel}
      data-hud-draw="Layout editor"
      className="layout-editor hud-box"
      style={{
        position: 'fixed',
        top: 70,
        right: 12,
        width: 'min(820px, calc(100vw - 24px))',
        maxHeight: 'calc(100vh - 90px)',
        padding: 14,
        fontSize: 12,
        zIndex: 1000,
        // Fades while a model is dragged out of it, so the map underneath can be seen
        opacity: dragging ? 0.3 : 1,
        transition: 'opacity 0.15s',
      }}
    >
      <PanelChrome id="editor" label="Editor" onHide={editorStore.actions.toggle} resizable />
      <div data-hud-type style={{ color: '#c8aa6e', letterSpacing: 1, marginBottom: 10 }}>
        LAYOUT EDITOR
      </div>

      <div className="layout-editor__body">
        {/* Inventory */}
        <div data-hud-fade className="layout-editor__inv">
          <div style={heading}>
            Inventory ({visible.length} of {snap.inventory.length})
          </div>
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            // Typing a search must not reach the camera's key controls
            onKeyDown={(e) => e.stopPropagation()}
            placeholder="Search models…"
            spellCheck={false}
            style={{
              width: '100%',
              boxSizing: 'border-box',
              marginBottom: 6,
              padding: '6px 8px',
              background: '#010a13',
              color: '#f0e6d2',
              border: '1px solid #0ac8ff',
              font: 'inherit',
            }}
          />
          <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', marginBottom: 6 }}>
            {groups.map((g) => (
              <button
                key={g}
                type="button"
                onClick={() => setGroup(g)}
                style={{
                  ...button,
                  padding: '4px 10px',
                  fontSize: 11,
                  background: group === g ? 'rgba(200, 170, 110, 0.3)' : button.background,
                  borderColor: group === g ? '#c8aa6e' : '#0ac8ff',
                }}
              >
                {g} ({counts[g]})
              </button>
            ))}
          </div>
          <div style={{ opacity: 0.75, marginBottom: 6 }}>Drag a model onto the map, or click one to add it at the centre.</div>
          <div
            data-nodrag
            className="layout-editor__grid"
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(112px, 1fr))',
              gap: 6,
              overflowY: 'auto',
              padding: 2,
            }}
          >
            {visible.map((tile) => (
              <button
                key={tile.key}
                type="button"
                title={tile.label}
                style={{
                  ...button,
                  padding: 4,
                  touchAction: 'none',
                  userSelect: 'none',
                  textAlign: 'center',
                  background: 'rgba(10, 200, 255, 0.06)',
                  // Team structures carry their team's colour
                  borderColor: tile.team === 'order' ? '#0ac8ff' : tile.team === 'chaos' ? '#ff4d4d' : 'rgba(200, 170, 110, 0.7)',
                }}
                onPointerDown={(e) => dragTile(e, tile)}
              >
                <Preview url={tile.url} tint={tile.tint} thumb={tile.thumb} />
                <div style={{ fontSize: 10, marginTop: 2, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{tile.label}</div>
                {tile.team && (
                  <div style={{ fontSize: 9, color: tile.team === 'order' ? '#0ac8ff' : '#ff6b6b', letterSpacing: 1 }}>{tile.team}</div>
                )}
              </button>
            ))}
            {visible.length === 0 && (
              <div style={{ gridColumn: '1 / -1', opacity: 0.7, padding: 8 }}>
                {snap.inventory.length === 0
                  ? IS_VISITOR
                    ? 'The model list could not be loaded.'
                    : 'No models found. The inventory reads the modelviewer folder in the project root (set LOCAL_MODELS_DIR to use another).'
                  : 'No models match.'}
              </div>
            )}
          </div>
        </div>

        {/* Selection and layout */}
        <div data-hud-fade className="layout-editor__side">
          {snap.download && (
            <div style={{ marginBottom: 10 }}>
              <div style={heading}>
                {snap.download.progress < 0 ? 'Download failed' : 'Downloading'} · {snap.download.name}
              </div>
              <div style={{ height: 6, background: 'rgba(10, 200, 255, 0.15)', border: '1px solid rgba(10, 200, 255, 0.5)' }}>
                <div
                  style={{
                    height: '100%',
                    width: `${Math.max(0, snap.download.progress) * 100}%`,
                    background: snap.download.progress < 0 ? '#ff4d4d' : '#0ac8ff',
                    transition: 'width 0.15s',
                  }}
                />
              </div>
            </div>
          )}
          <button style={{ ...button, width: '100%', marginBottom: 10 }} onClick={editorStore.actions.toggleBoxes}>
            {snap.boxes ? '◉ hide floating boxes' : '○ show floating boxes'}
          </button>
          <div style={heading}>Selected</div>
          {snap.selected && snap.readout ? (
            <>
              <div style={{ marginBottom: 4 }}>{snap.selected}</div>
              <div style={{ opacity: 0.85, marginBottom: 10, whiteSpace: 'pre-line' }}>{snap.readout}</div>
            </>
          ) : (
            <div style={{ marginBottom: 10, opacity: 0.85 }}>Click a model on the map. Its buttons float above it.</div>
          )}
          {snap.deleted > 0 && (
            <button style={{ ...button, width: '100%', marginBottom: 10 }} onClick={editorStore.actions.restore}>
              restore {snap.deleted} deleted
            </button>
          )}
          {!IS_VISITOR && (
            <>
              <div style={heading}>Changed items ({snap.count})</div>
              <textarea
                ref={area}
                readOnly
                value={exportText}
                style={{ width: '100%', height: 150, boxSizing: 'border-box', background: '#010a13', color: '#f0e6d2', border: '1px solid #0ac8ff', font: '11px Consolas, monospace' }}
              />
            </>
          )}
          <div style={{ display: 'flex', gap: 4, marginTop: 6 }}>
            {!IS_VISITOR && (
              <button
                style={button}
                onClick={() => {
                  area.current?.select()
                  navigator.clipboard?.writeText(exportText).catch(() => {})
                }}
              >
                copy layout
              </button>
            )}
            <button style={button} onClick={editorStore.actions.clear}>
              reset to default
            </button>
          </div>
        </div>
      </div>
    </div>
    {/* The resize agent: same drawing-style cursor as the HUD agents, riding the panel's
        bottom-right corner while PanelChrome performs a real resize and back. */}
    {pageReady && !hintDone && <div ref={cursorRef} className="layout-editor__cursor" aria-hidden="true">
      <div className="layout-editor__hint">
        <svg width="18" height="22" viewBox="0 0 18 22">
          <path
            d="M1 1 L1 17 L5.2 13.2 L8 19.6 L10.6 18.5 L7.9 12.2 L13.6 12.2 Z"
            fill="#0AC8FF"
            stroke="#010a13"
            strokeWidth="1.2"
            strokeLinejoin="round"
          />
        </svg>
        <span className="layout-editor__tag">agent.layout</span>
        <i className="layout-editor__guide layout-editor__guide--h" />
        <i className="layout-editor__guide layout-editor__guide--v" />
      </div>
    </div>}
    </>
  )
}
