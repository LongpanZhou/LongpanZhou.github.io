import { useEffect } from 'react'

function MetaballBackground() {
  useEffect(() => {
    const initMetaball = async () => {
      // Import the metaball script
      await import('../metaball.js')
      
      // Ensure canvas is properly positioned for mobile
      const canvases = document.body.querySelectorAll('canvas')
      canvases.forEach(canvas => {
        // Set canvas styles for proper mobile positioning
        canvas.style.position = 'fixed'
        canvas.style.top = '0'
        canvas.style.left = '0'
        canvas.style.width = '100vw'
        canvas.style.height = '100vh'
        canvas.style.zIndex = '-1'
        canvas.style.pointerEvents = 'none'
        
        // Ensure canvas covers full viewport on mobile
        canvas.width = window.innerWidth
        canvas.height = window.innerHeight
      })
    }
    
    initMetaball()
    
    // Handle viewport changes (mobile orientation, etc.)
    const handleViewportChange = () => {
      const canvases = document.body.querySelectorAll('canvas')
      canvases.forEach(canvas => {
        canvas.width = window.innerWidth
        canvas.height = window.innerHeight
      })
    }
    
    // Add viewport change listeners
    window.addEventListener('resize', handleViewportChange)
    window.addEventListener('orientationchange', handleViewportChange)
    
    // Cleanup function
    return () => {
      // Remove all canvas elements that were added to body by metaball
      const canvases = document.body.querySelectorAll('canvas')
      canvases.forEach(canvas => {
        canvas.remove()
      })
      
      // Remove event listeners
      window.removeEventListener('resize', handleViewportChange)
      window.removeEventListener('orientationchange', handleViewportChange)
      
      // Remove resize event listener if it exists
      if ((window as any).metaballRerender) {
        window.removeEventListener('resize', (window as any).metaballRerender)
      }
      
      // Clear any animation frames
      if ((window as any).metaballAnimationFrame) {
        cancelAnimationFrame((window as any).metaballAnimationFrame)
      }
    }
  }, [])
  
  return null
}

export default MetaballBackground

