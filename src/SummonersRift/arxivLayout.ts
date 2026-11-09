import type { Object3D } from 'three'

// The two papers of the arXiv view, as they stand in the 3D scene. Distances are world units from
// the camera in its overview pose (see ARXIV_VIEW in SummonersRift.tsx).
export const ARXIV_LAYOUT = {
  paperHeight: 14, // both papers are this tall; the width follows the page's proportions
  distance: 22, // camera to the papers in the overview, which shows both papers and the map around
  compareDistance: 17.3, // camera to the papers in side-by-side comparison, close but with the controls below still in view
  compareDrop: 2.6, // in the comparison and focus the camera also sinks this far, so the controls under the papers fit
  gap: 6, // space between the papers in the overview
  listGap: 1.2, // and in the list, where they stand one after the other in a long row
  toeDeg: 12, // in the overview each paper turns this far toward the middle, like a half-open book
}

// What the arXiv view is doing, shared by the camera and the papers. The `target`, `focusTarget`
// fields are what the buttons and clicks ask for; `t`, `f` and `fa` are the eased values the camera
// and the papers actually follow (the camera eases them, once per frame).
export interface ArxivViewState {
  target: number // 1 for the list (all the papers in one long row), 0 for the spread-out overview
  t: number // eased `target`
  focusTarget: number // -1 focuses the left paper, 1 the right one, 0 neither
  f: number // eased side of the focused paper (kept while the focus eases away)
  fa: number // how far the focus has been reached: 0 none, 1 fully on the paper
  paperWidth: number // world width of one paper, written by the papers, read by the camera
  // Focus on a panel (the controls or the music player) instead of a paper: where the camera should
  // be in front of, as world units right of and above the middle of the papers, its distance, and
  // the angle the panel is turned by (the camera turns to face it)
  panelTarget: { x: number; y: number; d: number; yaw: number } | null
  pa: number // how far the panel focus has been reached
  px: number // eased panel position, kept while the focus eases away
  py: number
  pd: number
  pyaw: number
  // Where the user has moved the papers and the two panels, in world units right of and above their
  // default places. `x` and `y` are where they were put; `sx` and `sy` are the eased values that are
  // shown, so a reset glides back instead of jumping.
  moves: Record<Movable, Move>
  // The sheets (one per paper, named by the paper's id) in the order they stand in the overview, left
  // to right, and how wide each is. Papers keep these up to date.
  order: string[]
  listOrder: string[] // the sheets chosen for the list, in order (all of them unless some were left out)
  widths: Record<string, number>
  focusId: string | null // the sheet that is (or was last) focused
  meshes: Record<string, Object3D> // each sheet's page, for working out what the pointer is over
  stack: string[] // sheets in the order they were last touched, the latest last; the latest stands in front
  panelFocus: string | null // 'bar' or 'music' while the camera is on that panel
  // How far each box (a sheet, 'bar' or 'music') has come forward for the focus, 0..1, and where it
  // stands among the sheets in depth. Eased per box, so switching the focus from one box to another
  // moves each of them smoothly instead of one jumping.
  lifts: Record<string, number>
  ranks: Record<string, number>
  dragging: boolean // something is being dragged, so the background drag must not tilt the camera
  resetCamera: boolean // set to bring the camera's own tilt and zoom (from dragging and scrolling) back to the default
}

/** What can be moved: 'bar', 'music', or the id of a paper's sheet (the paper's own id). */
export type Movable = string
export interface Move {
  x: number
  y: number
  sx: number
  sy: number
  yaw: number // turned about the vertical axis, in radians; positive turns the front toward the right
  syaw: number
}
const noMove = (): Move => ({ x: 0, y: 0, sx: 0, sy: 0, yaw: 0, syaw: 0 })

/** Turning is limited so a box never turns its back to the viewer. */
export const MAX_TURN = 1.3
export const TURN_PER_PIXEL = 0.005 // radians per pixel of the drag: a long drag, not a flick, for a big turn

/** The turn after dragging `dx` pixels from `startYaw`: limited, and snapped to straight when close to it. */
export function turnTo(startYaw: number, dx: number): number {
  const y = Math.max(-MAX_TURN, Math.min(MAX_TURN, startYaw + dx * TURN_PER_PIXEL))
  return Math.abs(y) < 0.06 ? 0 : y
}

/** The move of a box, made when it is first needed (sheets come and go). */
export const moveOf = (v: ArxivViewState, id: string): Move => (v.moves[id] ??= noMove())

/** Bring a sheet to the front of the others (they stand a hair apart in depth, in this order). */
export function raise(v: ArxivViewState, id: string) {
  const i = v.stack.indexOf(id)
  if (i >= 0) v.stack.splice(i, 1)
  v.stack.push(id)
}

/** Where a sheet stands in the overview before the user moves it: its middle, in world units right of
 *  the middle of the row of sheets, its width, and how far it turns toward the middle (-1..1). */
export function sheetBase(
  v: ArxivViewState,
  id: string,
  gap = ARXIV_LAYOUT.gap,
  ids: string[] = v.order, // the sheets that stand in the row (for the list, only the chosen ones)
): { x: number; w: number; k: number } {
  const fallback = ARXIV_LAYOUT.paperHeight * (8.5 / 11)
  const width = (i: number) => v.widths[ids[i]] ?? fallback
  let total = gap * Math.max(ids.length - 1, 0)
  for (let i = 0; i < ids.length; i++) total += width(i)
  let left = -total / 2
  for (let i = 0; i < ids.length; i++) {
    const w = width(i)
    if (ids[i] === id) {
      const x = left + w / 2
      return { x, w, k: Math.max(-1, Math.min(1, -x / ((w + gap) / 2))) }
    }
    left += w + gap
  }
  return { x: 0, w: fallback, k: 0 }
}

/** Put everything back where it started (the shown positions glide there). */
export function resetMoves(v: ArxivViewState) {
  for (const m of Object.values(v.moves)) {
    m.x = 0
    m.y = 0
    m.yaw = 0
  }
}

/** The quick way back to the default set-up: boxes, turns, camera tilt and zoom. */
export function restoreDefaults(v: ArxivViewState) {
  resetMoves(v)
  v.resetCamera = true
}

/** Things can only be moved in the overview, not while comparing or focused on something. */
export const canMove = (v: ArxivViewState) =>
  v.target < 0.02 && v.focusTarget === 0 && !v.panelTarget && v.fa < 0.02 && v.pa < 0.02

export const initialArxivView = (): ArxivViewState => ({
  target: 0,
  t: 0,
  focusTarget: 0,
  f: 0,
  fa: 0,
  paperWidth: 14 * (8.5 / 11),
  panelTarget: null,
  pa: 0,
  px: 0,
  py: 0,
  pd: 22,
  pyaw: 0,
  moves: { bar: noMove(), music: noMove() },
  order: [],
  listOrder: [],
  widths: {},
  focusId: null,
  meshes: {},
  stack: [],
  panelFocus: null,
  lifts: {},
  ranks: {},
  dragging: false,
  resetCamera: false,
})

export type ArxivMode = 'overview' | 'bar' | 'music' | `focus:${string}` // focus:<sheet id>

/** One paper of the list. */
export interface PaperEntry {
  id: string
  target: string // the PDF's address
  page: number // 1-based
}

/** What a paper reports about itself, for the controls. */
export interface PaperInfo {
  pages: number // 0 until the document has loaded
  error: string | null
}

export const idlePaperInfo = (): PaperInfo => ({ pages: 0, error: null })

/** How far the camera can roam from the arXiv overview pose with the keys: right/left, up/down, and
 *  in/out (world units). Far enough to get close to any paper or to take them all in, no further. */
export const ROAM = { x: 24, yUp: 14, yDown: 7, in: 12, out: 10 }

/** Half the length of the long row of the list, for how far the camera may roam along it. */
export function listHalf(v: ArxivViewState): number {
  const fallback = ARXIV_LAYOUT.paperHeight * (8.5 / 11)
  let total = ARXIV_LAYOUT.listGap * Math.max(v.listOrder.length - 1, 0)
  for (const id of v.listOrder) total += v.widths[id] ?? fallback
  return total / 2
}

/** In the list, a sheet that was not chosen for it is out of the way. */
export const leftOutOfList = (v: ArxivViewState, id: string) => v.t > 0.5 && !v.listOrder.includes(id)
