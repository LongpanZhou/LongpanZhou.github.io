import { useEffect, useRef } from 'react'
import './MarqueeDraw.css'

// Shift + drag draws a cyan selection frame with live dimensions, as if an agent is
// marking an area. Plain clicks and drags are left alone. Touch devices are skipped.
export default function MarqueeDraw() {
  const boxRef = useRef<HTMLDivElement>(null)
  const labelRef = useRef<HTMLSpanElement>(null)

  useEffect(() => {
    const box = boxRef.current
    const label = labelRef.current
    if (!box || !label) return
    if (window.matchMedia('(pointer: coarse)').matches) return

    let anchor: { x: number; y: number } | null = null
    let fadeTimer = 0
    let pickTimer = 0

    // Target-lock cards that the frame covers get their brackets locked on
    const clearPicks = () => {
      document.querySelectorAll('.target-lock.is-picked').forEach((el) => el.classList.remove('is-picked'))
    }
    const pickTargets = (x: number, y: number, w: number, h: number) => {
      document.querySelectorAll<HTMLElement>('.target-lock').forEach((el) => {
        const r = el.getBoundingClientRect()
        const hit = r.left < x + w && r.right > x && r.top < y + h && r.bottom > y
        el.classList.toggle('is-picked', hit)
      })
    }

    const onDown = (e: PointerEvent) => {
      if (!e.shiftKey || e.button !== 0) return
      anchor = { x: e.clientX, y: e.clientY }
      clearPicks()
      window.clearTimeout(fadeTimer)
      box.classList.remove('is-fading')
      // Stop the drag from selecting text while the frame is being drawn
      document.body.style.userSelect = 'none'
      e.preventDefault()
    }

    const onMove = (e: PointerEvent) => {
      if (!anchor) return
      const x = Math.min(anchor.x, e.clientX)
      const y = Math.min(anchor.y, e.clientY)
      const w = Math.abs(e.clientX - anchor.x)
      const h = Math.abs(e.clientY - anchor.y)
      box.style.transform = `translate(${x}px, ${y}px)`
      box.style.width = `${w}px`
      box.style.height = `${h}px`
      label.textContent = `${Math.round(w)} × ${Math.round(h)}`
      box.classList.add('is-active')
      pickTargets(x, y, w, h)
    }

    const onUp = () => {
      if (!anchor) return
      anchor = null
      document.body.style.userSelect = ''
      box.classList.add('is-fading')
      fadeTimer = window.setTimeout(() => box.classList.remove('is-active', 'is-fading'), 450)
      // Picked brackets stay locked for a moment after the frame is released
      pickTimer = window.setTimeout(clearPicks, 2500)
    }

    window.addEventListener('pointerdown', onDown)
    window.addEventListener('pointermove', onMove)
    window.addEventListener('pointerup', onUp)
    window.addEventListener('pointercancel', onUp)
    return () => {
      window.removeEventListener('pointerdown', onDown)
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('pointerup', onUp)
      window.removeEventListener('pointercancel', onUp)
      window.clearTimeout(fadeTimer)
      window.clearTimeout(pickTimer)
      clearPicks()
      document.body.style.userSelect = ''
    }
  }, [])

  return (
    <div className="marquee-draw" ref={boxRef} aria-hidden="true">
      <span className="marquee-draw__label" ref={labelRef} />
    </div>
  )
}
