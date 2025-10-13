import { useEffect, useState } from 'react'
import './welcome.css'
import '../profile/profile.css'
import TypeIt from 'typeit-react'
import MetaballBackground from '../components/MetaballBackground'
//@ts-ignore
import AnimalClicks from '../animalclicks/index.js';
import gsap from 'gsap'
import src from '../profile/profile_bgrmeoved.png'
import Email from '../profile/icons/gmail.svg'
import Linkedin from '../profile/icons/linkedin.svg'
import Github from '../profile/icons/github.svg'
import Leetcode from '../profile/icons/leetcode.svg'

// @ts-ignore
const animalClicksInstance = new AnimalClicks(
    ['🦝'],
    2000,
    10,
    180,
    2.5,
    4.5,
    0.075,
    10,
    10,
    {
    random: false,
    physics: true,
    fade: true,
    hideCursor: true,
    }
);

function welcome() {
    const [showWelcome, setShowWelcome] = useState(true)
    const [showProfile, setShowProfile] = useState(false)

    useEffect(() => {
        // Show welcome first, then transition to profile after 3 seconds
        const timer = setTimeout(() => {
            setShowWelcome(false)
            setShowProfile(true)
        }, 3000)

        return () => clearTimeout(timer)
    }, [])

    useEffect(() => {
        if (showProfile) {
            // Fade in the profile content
            gsap.fromTo(".lp-profile-container", 
                { opacity: 0, y: 20 },
                { opacity: 1, y: 0, duration: 1, ease: "power2.out" }
            );
            
            // Start the animated title background
            const tl = gsap.timeline({ repeat: -1, repeatDelay: 1 });
            tl.to(".lp-aboutme-title-anime", {
                backgroundPosition: "-960px 100px",
                duration: 30,
                ease: "linear"
            });
        }
    }, [showProfile])

    return (
        <>
            <MetaballBackground />
            {showWelcome && (
                <div className="welcome-container">
                    <TypeIt className="welcome-title">Welcome!</TypeIt>
                </div>
            )}
            {showProfile && (
                <div className='lp-profile-container'>
                    <div className='lp-card-container'>
                        <div className='lp-small-card'>
                            <div className="lp-rounded-picture" style={{ width: 256, height: 256 }}>
                            <img src={src} alt={'Picture'} className="lp-rounded-image" />
                            </div>
                            <h1 className="lp-name-text">Longpan Zhou</h1>
                            <hr className="lp-horizontal-line" />
                            <h1 className='lp-role-text'>Software Developer</h1>
                            <ul className="lp-icon-list">
                                <li><a href="mailto:patrickzhoul123@gmail.com" title="patrickzhoul123@gmail.com"><img className="lp-icon" src={Email}/></a></li>
                                <li><a href="https://github.com/LongpanZhou" target="_blank" title="GitHub"><img className="lp-icon" src={Github}/></a></li>
                                <li><a href="https://leetcode.com/u/longpanzhou/" target="_blank" title="LeetCode"><img className="lp-icon" src={Leetcode}/></a></li>
                                <li><a href="https://www.linkedin.com/in/longpan-zhou/" target="_blank" title="LinkedIn"><img className="lp-icon" src={Linkedin}/></a></li>
                            </ul>
                        </div>
                        <div className='lp-bigger-card'>
                            <h1 className="lp-aboutme-title-anime">About Me</h1>
                            <h1 className="lp-aboutme-subtitle">Here's a brief description about myself...</h1>
                            <p className="lp-aboutme-text">I'm a Software Developer, I code, sleep, and repeat.</p>
                            <p className="lp-aboutme-text">When I'm not coding, you'll find me at the gym, grinding League, listening to music, or reading economics books. Always fueled by good coffee and great vibes. <span className="coffee-hover">☕️<span className="tooltip">Jokes, I drink white monster</span></span></p>
                            <p className="lp-aboutme-text">Also... How did you get here? <span className="coffee-hover">🤔<span className="tooltip">You found the secret! 🎉</span></span></p>
                            <div className="lp-button-container text-center">
                                <a href="https://github.com/LongpanZhou" className="lp-btn lp-btn-primary">Learn more about what I do</a>
                                <a href="/" className="lp-btn lp-btn-secondary">Go back to main page</a>
                                <a href="https://leetcode.com/u/longpanzhou/" className="lp-btn lp-btn-tertiary">Try to compete with me</a>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </>
    )
}

export default welcome