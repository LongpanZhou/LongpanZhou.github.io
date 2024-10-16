import { useEffect } from 'react'

import './profile.css'
//@ts-ignore
import AnimalClicks from '../animalclicks/index.js';
import gsap from 'gsap'
import src from './profile_bgrmeoved.png'
import Linkedin from './icons/linkedin.svg'
import Github from './icons/github.svg'
import Leetcode from './icons/leetcode.svg'
import Email from './icons/gmail.svg'
import Reusme from './Longpan_Zhou__Internship_.pdf'

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

const Projects = () => {
    alert('Projects page is under construction. You can check out my projects on my GitHub page for now.')
}

function profile() {
    useEffect(() => {
      const tl = gsap.timeline({ repeat: -1, repeatDelay: 1 });
      tl.to(".lp-aboutme-title-anime", {
          backgroundPosition: "-960px 100px",
          duration: 30,
          ease: "linear"
      });
  }, []);

  return (
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
                  <li><a href="https://www.linkedin.com/in/longpan-zhou/" target="_blank" title="LinkedIn"><img className="lp-icon" src={Linkedin}/></a></li>
                  <li><a href="https://github.com/LongpanZhou" target="_blank" title="GitHub"><img className="lp-icon" src={Github}/></a></li>
                  <li><a href="https://leetcode.com/u/longpanzhou/" target="_blank" title="LeetCode"><img className="lp-icon" src={Leetcode}/></a></li>
                  <li><a href="mailto:patrickzhoul123@gmail.com" title="patrickzhoul123@gmail.com"><img className="lp-icon" src={Email}/></a></li>
              </ul>
          </div>
          <div className='lp-bigger-card'>
              <h1 className="lp-aboutme-title-anime">About Me</h1>
              <h1 className="lp-aboutme-subtitle">Here's a brief description about myself...</h1>
              <p className="lp-aboutme-text">I am a Software Developer with experience in Python, Java, C++, C, Rust, JavaScript, and React. My expertise spans a range of technologies and programming languages, allowing me to build diverse applications from low-level systems applications to dynamic web interfaces. I am passionate about learning, reading and coding :)</p>
              <div className="lp-button-container text-center">
                  <a href={Reusme} className="lp-btn lp-btn-primary">Resume</a>
                  <a href="https://github.com/LongpanZhou" onClick={Projects} className="lp-btn lp-btn-tertiary">Projects</a>
              </div>
          </div>
      </div>
    </div>
  )
}
export default profile