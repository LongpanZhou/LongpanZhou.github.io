// A short fade-out of everything the old view has on screen, before the app switches to the next one.
// Without it the boxes, panels and papers of the view you leave are simply gone on the click.
//
// `leaveThen` puts the class `view-leaving` on <html> (the CSS for it is in DrawFrame.css, and the 3D
// sheets read it in ArxivPapers), waits for the fade, then runs `go`, and takes the class off again a
// moment later: what the new view brings draws itself in, and anything that stays comes back.

const FADE_MS = 240

let leaving = false

// Returns false when a change of view is already under way (the call is then ignored).
export function leaveThen(go: () => void): boolean {
  if (leaving) return false
  leaving = true
  const root = document.documentElement
  root.classList.add('view-leaving')
  window.setTimeout(() => {
    go()
    window.setTimeout(() => {
      root.classList.remove('view-leaving')
      leaving = false
    }, 140)
  }, FADE_MS)
  return true
}
