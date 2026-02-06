import { useEffect } from 'react'
import './profile.css'
import AnimalClicks from '../animalclicks/index.js'
import gsap from 'gsap'
import ProfileCard from '../components/ProfileCard'

function Profile() {
  useEffect(() => {
    // @ts-ignore
    const instance = new AnimalClicks(
      ['🦝'], 2000, 10, 180, 2.5, 4.5, 0.075, 10, 10,
      { random: false, physics: true, fade: true, hideCursor: true }
    )

    const tl = gsap.timeline({ repeat: -1, repeatDelay: 1 })
    tl.to(".lp-aboutme-title-anime", {
      backgroundPosition: "-960px 100px",
      duration: 30,
      ease: "linear"
    })

    return () => {
      instance.shutdown()
      tl.kill()
    }
  }, [])

  return <ProfileCard />
}

export default Profile
