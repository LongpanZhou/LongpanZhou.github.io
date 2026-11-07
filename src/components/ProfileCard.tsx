import { useEffect, useLayoutEffect, useRef } from 'react'
import type { ReactNode } from 'react'
import '../profile/profile.css'
import DrawFrame from './DrawFrame'
import src from '../profile/profile_bgrmeoved.png'
import Email from '../profile/icons/gmail.svg'
import Linkedin from '../profile/icons/linkedin.svg'
import Github from '../profile/icons/github.svg'
import Leetcode from '../profile/icons/leetcode.svg'

const BOX_KEY = 'profileCardBox'
const MIN_WIDTH = 420
const MIN_HEIGHT = 300
const RESIZE_DIRECTIONS = ['n', 's', 'e', 'w', 'ne', 'nw', 'se', 'sw']

interface SavedBox {
  x: number
  y: number
  w: number
  h: number
}

function loadBox(): SavedBox | null {
  try {
    const raw = window.localStorage.getItem(BOX_KEY)
    if (!raw) return null
    const saved = JSON.parse(raw) as Partial<SavedBox>
    return typeof saved.w === 'number' && typeof saved.h === 'number'
      ? { x: saved.x ?? 0, y: saved.y ?? 0, w: saved.w, h: saved.h }
      : null
  } catch {
    return null
  }
}

function saveBox(box: SavedBox) {
  try {
    window.localStorage.setItem(BOX_KEY, JSON.stringify(box))
  } catch {
    // Storage can be blocked. The card still resizes for this session.
  }
}

const clamp = (v: number, lo: number, hi: number) => Math.min(Math.max(v, lo), Math.max(lo, hi))

// The white profile card can be resized from every edge and corner. It is centred by the page,
// so each move measures the card after the size change and translates it just enough to keep
// the edge opposite the one being dragged in place. Double-clicking a handle clears the size.
function ResizableCard({ children }: { children: ReactNode }) {
  const card = useRef<HTMLDivElement>(null)
  const offset = useRef({ x: 0, y: 0 })
  const size = useRef<{ w: number; h: number } | null>(null)

  const persist = () => {
    if (size.current) saveBox({ ...offset.current, ...size.current })
  }

  useLayoutEffect(() => {
    const el = card.current
    if (!el) return
    const saved = loadBox()
    if (!saved) return
    const w = Math.min(saved.w, window.innerWidth - 24)
    const h = Math.min(saved.h, window.innerHeight - 24)
    size.current = { w, h }
    offset.current = { x: saved.x, y: saved.y }
    el.style.width = `${w}px`
    el.style.height = `${h}px`
    el.style.translate = `${saved.x}px ${saved.y}px`
    el.dataset.sized = '1'
  }, [])

  // Keep a manually sized card inside the window when the window itself gets smaller.
  useEffect(() => {
    const onResize = () => {
      const el = card.current
      if (!el || !size.current) return
      const w = Math.min(size.current.w, window.innerWidth - 24)
      const h = Math.min(size.current.h, window.innerHeight - 24)
      if (w === size.current.w && h === size.current.h) return
      size.current = { w, h }
      el.style.width = `${w}px`
      el.style.height = `${h}px`
      persist()
    }
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [])

  const beginResize = (e: React.PointerEvent<HTMLElement>, dir: string) => {
    const el = card.current
    if (!el || e.button !== 0) return
    e.preventDefault()
    e.stopPropagation()
    const startRect = el.getBoundingClientRect()
    const start = { px: e.clientX, py: e.clientY, x: offset.current.x, y: offset.current.y, rect: startRect }

    const move = (ev: PointerEvent) => {
      const dx = ev.clientX - start.px
      const dy = ev.clientY - start.py
      if (dx === 0 && dy === 0) return
      let w = start.rect.width
      let h = start.rect.height
      if (dir.includes('e')) w = clamp(start.rect.width + dx, MIN_WIDTH, window.innerWidth - 12 - start.rect.left)
      else if (dir.includes('w')) w = clamp(start.rect.width - dx, MIN_WIDTH, start.rect.right - 12)
      if (dir.includes('s')) h = clamp(start.rect.height + dy, MIN_HEIGHT, window.innerHeight - 12 - start.rect.top)
      else if (dir.includes('n')) h = clamp(start.rect.height - dy, MIN_HEIGHT, start.rect.bottom - 12)

      el.style.width = `${w}px`
      el.style.height = `${h}px`
      el.dataset.sized = '1'

      // Keep the opposite edge fixed, whatever the flex centring did to the card.
      const after = el.getBoundingClientRect()
      const fixX = dir.includes('e') ? start.rect.left - after.left : dir.includes('w') ? start.rect.right - after.right : 0
      const fixY = dir.includes('s') ? start.rect.top - after.top : dir.includes('n') ? start.rect.bottom - after.bottom : 0
      offset.current = { x: start.x + fixX, y: start.y + fixY }
      el.style.translate = `${offset.current.x}px ${offset.current.y}px`
      size.current = { w: Math.round(w), h: Math.round(h) }
    }
    const stop = () => {
      window.removeEventListener('pointermove', move)
      window.removeEventListener('pointerup', stop)
      window.removeEventListener('pointercancel', stop)
      persist()
      window.dispatchEvent(new Event('resize'))
    }
    window.addEventListener('pointermove', move)
    window.addEventListener('pointerup', stop)
    window.addEventListener('pointercancel', stop)
  }

  return (
    <div ref={card} className="lp-card-resizer">
      {children}
      {RESIZE_DIRECTIONS.map((dir) => (
        <div
          key={dir}
          className={`profile-resize profile-resize--${dir}`}
          onPointerDown={(e) => beginResize(e, dir)}
          onDoubleClick={() => {
            const el = card.current
            if (!el) return
            size.current = null
            offset.current = { x: 0, y: 0 }
            el.style.width = ''
            el.style.height = ''
            el.style.translate = ''
            delete el.dataset.sized
            try {
              window.localStorage.removeItem(BOX_KEY)
            } catch {
              // Storage can be blocked.
            }
            window.dispatchEvent(new Event('resize'))
          }}
          aria-hidden="true"
        />
      ))}
    </div>
  )
}

function ProfileCard({ showGoBack = false }: { showGoBack?: boolean }) {
  return (
    <DrawFrame>
    <div className='lp-profile-container'>
      <ResizableCard>
      <div className='lp-card-container'>
        <div className='lp-small-card' data-draw="profile.card" data-draw-kind="tower">
          <div className="lp-rounded-picture">
            <img src={src} alt={'Picture'} className="lp-rounded-image" />
          </div>
          <h1 className="lp-name-text" data-draw="profile.name" data-draw-kind="nexus">Longpan Zhou</h1>
          <hr className="lp-horizontal-line" />
          <h1 className='lp-role-text'>Software Developer</h1>
          <ul className="lp-icon-list" data-draw="profile.links" data-draw-kind="minion">
            <li><a href="mailto:patrickzhoul123@gmail.com" title="patrickzhoul123@gmail.com"><img className="lp-icon" src={Email} alt="Email" /></a></li>
            <li><a href="https://github.com/LongpanZhou" target="_blank" rel="noopener noreferrer" title="GitHub"><img className="lp-icon" src={Github} alt="GitHub" /></a></li>
            <li><a href="https://leetcode.com/u/longpanzhou/" target="_blank" rel="noopener noreferrer" title="LeetCode"><img className="lp-icon" src={Leetcode} alt="LeetCode" /></a></li>
            <li><a href="https://www.linkedin.com/in/longpan-zhou/" target="_blank" rel="noopener noreferrer" title="LinkedIn"><img className="lp-icon" src={Linkedin} alt="LinkedIn" /></a></li>
          </ul>
        </div>
        <div className='lp-bigger-card' data-draw="profile.about" data-draw-kind="tower">
          <h1 className="lp-aboutme-title-anime">About Me</h1>
          <h1 className="lp-aboutme-subtitle">Here's a brief description about myself...</h1>
          <p className="lp-aboutme-text">I'm a Software Developer, I code, sleep, and repeat.</p>
          <p className="lp-aboutme-text">When I'm not coding, you'll find me at the gym, grinding League, listening to music, or reading economics books. Always fueled by good coffee and great vibes. <span className="coffee-hover">☕️<span className="tooltip">Jokes, I drink white monster</span></span></p>
          <p className="lp-aboutme-text">Also... How did you get here? <span className="coffee-hover">🤔<span className="tooltip">You found the secret! 🎉</span></span></p>
          <div className="lp-button-container text-center">
            <a href="https://github.com/LongpanZhou" className="lp-btn lp-btn-primary" target="_blank" rel="noopener noreferrer">Learn more about what I do</a>
            {showGoBack && <a href="/" className="lp-btn lp-btn-secondary">Go back to main page</a>}
            <a href="https://leetcode.com/u/longpanzhou/" className="lp-btn lp-btn-tertiary" target="_blank" rel="noopener noreferrer">Try to compete with me</a>
          </div>
        </div>
      </div>
      </ResizableCard>
    </div>
    </DrawFrame>
  )
}

export default ProfileCard
