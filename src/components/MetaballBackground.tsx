import { useEffect, useRef } from 'react'
// @ts-ignore
import { initMetaball, destroyMetaball } from '../metaball.js'

function MetaballBackground() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null)

  useEffect(() => {
    const canvas = document.createElement('canvas')
    canvas.style.position = 'fixed'
    canvas.style.top = '0'
    canvas.style.left = '0'
    canvas.style.width = '100vw'
    canvas.style.height = '100vh'
    canvas.style.zIndex = '-1'
    canvas.style.pointerEvents = 'none'
    document.body.appendChild(canvas)
    canvasRef.current = canvas

    initMetaball(canvas)

    return () => {
      destroyMetaball()
      canvas.remove()
      canvasRef.current = null
    }
  }, [])

  return null
}

export default MetaballBackground
