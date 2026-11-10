import { useState } from 'react'
import type { CSSProperties } from 'react'
import './Loader.css'

// The full-screen loading screen. It is shown twice in a row on the way to the map: first while the
// page's code downloads (the Suspense fallback in App), then while the map itself loads. Both are this
// one component, and its animations are timed against the clock instead of against when it mounted,
// so the second picks up exactly where the first left off and the two read as one screen.
//
// `progress` (0 to 100) shows the bar; without it the bar is left out. `done` fades the screen away.
function Loader({ label, progress, done = false }: { label: string; progress?: number; done?: boolean }) {
  const [startedAt] = useState(() => performance.now())
  const style = {
    '--loader-spin-delay': `${-(startedAt % 2400)}ms`,
    '--loader-pulse-delay': `${-(startedAt % 2000)}ms`,
  } as CSSProperties
  const hasBar = progress !== undefined
  const shown = Math.max(0, Math.min(progress ?? 0, 100))

  return (
    <div className={`loading-overlay${done ? ' loading-overlay--done' : ''}`} style={style} role="status" aria-label={label}>
      <div className="loading-mark">
        <div className="loading-hexagon">
          <div className="loading-hexagon__inner" />
        </div>
        <div className="loading-core" />
      </div>
      <p className="loading-text">{label}</p>
      <div className="progress-bar" style={hasBar ? undefined : { visibility: 'hidden' }}>
        <div className="progress-fill" style={{ transform: `scaleX(${shown / 100})` }} />
      </div>
      <div className="progress-text" style={hasBar ? undefined : { visibility: 'hidden' }}>
        {Math.round(shown)}%
      </div>
    </div>
  )
}

export default Loader
