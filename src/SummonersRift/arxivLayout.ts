// The two papers of the arXiv view, as they stand in the 3D scene. Distances are world units from
// the camera in its overview pose (see ARXIV_VIEW in SummonersRift.tsx).
export const ARXIV_LAYOUT = {
  paperHeight: 14, // both papers are this tall; the width follows the page's proportions
  distance: 22, // camera to the papers in the overview, which shows both papers and the map around
  compareDistance: 17.3, // camera to the papers in side-by-side comparison, close but with the controls below still in view
  compareDrop: 2.6, // in the comparison and focus the camera also sinks this far, so the controls under the papers fit
  gap: 6, // space between the papers in the overview
  compareGap: 0.4, // and in the comparison, where they sit edge to edge
  toeDeg: 12, // in the overview each paper turns this far toward the middle, like a half-open book
}

// What the arXiv view is doing, shared by the camera and the papers. The `target`, `focusTarget`
// fields are what the buttons and clicks ask for; `t`, `f` and `fa` are the eased values the camera
// and the papers actually follow (the camera eases them, once per frame).
export interface ArxivViewState {
  target: number // 1 for the side-by-side comparison, 0 for the overview
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
}

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
})

export type ArxivMode = 'overview' | 'compare' | 'left' | 'right' | 'bar' | 'music'

// Translating the paper. The papers do the work and report back; the controls ask for it.
export interface ArxivTranslation {
  state: 'idle' | 'running' | 'done' | 'error'
  done: number // pages translated so far
  total: number // pages in the paper
  error: string | null
  lang: string // the language being translated into
}

export const idleTranslation: ArxivTranslation = { state: 'idle', done: 0, total: 0, error: null, lang: '' }

export interface ArxivCommands {
  translate: (lang: string) => void // start (or restart) translating the whole paper
  stop: () => void // stop, keeping the pages translated so far
  reset: () => void // stop and put the original back on the right paper
}
