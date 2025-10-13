import { useEffect, useState } from 'react'
import './welcome.css'
import TypeIt from 'typeit-react'
import MetaballBackground from '../components/MetaballBackground'

function welcome() {
  const [isAnimalClicksActive, setIsAnimalClicksActive] = useState(false)

  useEffect(() => {
    // Check if AnimalClicks instance is active by looking for the hide-cursor class
    const checkAnimalClicks = () => {
      const hasHideCursor = document.body.classList.contains('hide-cursor')
      setIsAnimalClicksActive(hasHideCursor)
    }

    // Check initially
    checkAnimalClicks()

    // Set up interval to check periodically
    const interval = setInterval(checkAnimalClicks, 100)

    // Cleanup function
    return () => {
      clearInterval(interval)
    }
  }, [])

  return (
    <>
      <MetaballBackground />
      <div className="welcome-container">
        <TypeIt className="welcome-title">Welcome!</TypeIt>
      </div>
    </>
  )
}

export default welcome