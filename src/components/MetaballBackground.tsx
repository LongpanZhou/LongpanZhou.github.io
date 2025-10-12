import { useEffect } from 'react'

function MetaballBackground() {
  useEffect(() => {
    const initMetaball = async () => {
      // Import the metaball script
      await import('../metaball.js')
    }
    
    initMetaball()
    
    // Cleanup function
    return () => {
      // Remove all canvas elements that were added to body by metaball
      const canvases = document.body.querySelectorAll('canvas')
      canvases.forEach(canvas => {
        canvas.remove()
      })
      
      // Remove resize event listener
      window.removeEventListener('resize', (window as any).metaballRerender)
    }
  }, [])
  
  return null
}

export default MetaballBackground

