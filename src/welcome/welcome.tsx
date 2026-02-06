import { useEffect, useState } from 'react'
import './welcome.css'
import '../profile/profile.css'
import TypeIt from 'typeit-react'
import MetaballBackground from '../components/MetaballBackground'
import AnimalClicks from '../animalclicks/index.js'
import gsap from 'gsap'
import ProfileCard from '../components/ProfileCard'

function Welcome() {
  const [phase, setPhase] = useState<'welcome' | 'profile'>('welcome')

  useEffect(() => {
    // @ts-ignore
    const instance = new AnimalClicks(
      ['🦝'], 2000, 10, 180, 2.5, 4.5, 0.075, 10, 10,
      { random: false, physics: true, fade: true, hideCursor: true }
    )

    return () => {
      instance.shutdown()
    }
  }, [])

  useEffect(() => {
    const timer = setTimeout(() => {
      setPhase('profile')
    }, 3000)

    return () => clearTimeout(timer)
  }, [])

  useEffect(() => {
    if (phase === 'profile') {
      gsap.fromTo(".lp-profile-container",
        { opacity: 0, y: 20 },
        { opacity: 1, y: 0, duration: 1, ease: "power2.out" }
      )

      const tl = gsap.timeline({ repeat: -1, repeatDelay: 1 })
      tl.to(".lp-aboutme-title-anime", {
        backgroundPosition: "-960px 100px",
        duration: 30,
        ease: "linear"
      })

      return () => { tl.kill() }
    }
  }, [phase])

  return (
    <>
      <MetaballBackground />
      {phase === 'welcome' && (
        <div className="welcome-container">
          <TypeIt className="welcome-title">Welcome!</TypeIt>
        </div>
      )}
      {phase === 'profile' && <ProfileCard showGoBack />}
    </>
  )
}

export default Welcome
