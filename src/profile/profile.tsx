import { useEffect } from 'react'
import { motion } from 'framer-motion';

import './profile.css'
import './profile.js'
import gsap from 'gsap'
import src from './profile_bgrmeoved.png'
import Linkedin from './icons/linkedin.svg'
import Github from './icons/github.svg'
import Leetcode from './icons/leetcode.svg'
import Email from './icons/gmail.svg'


const profileVariants = {
    hidden: { opacity: 0, y: 0 },
    visible: { opacity: 1, y: 0 },
  };

const Projects = () => {
    alert('Projects page is under construction. You can check out my projects on my GitHub page for now.')
}

function profile() {
    useEffect(() => {
        const tl = gsap.timeline({ repeat: -1, repeatDelay: 1 });
        tl.to(".aboutme-tittle", {
          backgroundPosition: "-960px 100px",
          duration: 30,
          ease: "linear"
        });
      }, []);

  return (
    <motion.div
      initial="hidden"
      animate="visible"
      transition={{ duration: 0 }}
      variants={profileVariants}
      className="profile-container"
    >
        <div className="profile-container">
            <div className='card-container'>
                <div className='card'>
                    <div className="rounded-picture" style={{ width: 256, height: 256 }}>
                    <img src={src} alt={'Picture'} className="rounded-image" />
                    </div>
                    <h1 className="name-text">Longpan Zhou</h1>
                    <hr className="horizontal-line" />
                    <h1 className='role-text'>Software Developer</h1>
                    <ul className="icon-list">
                        <li><a href="https://www.linkedin.com/in/longpan-zhou/" target="_blank" title="LinkedIn"><img className="icon" src={Linkedin}/><i className="fab fa-linkedin"></i></a></li>
                        <li><a href="https://github.com/LongpanZhou" target="_blank" title="GitHub"><img className="icon" src={Github}/><i className="fab fa-github"></i></a></li>
                        <li><a href="https://leetcode.com/u/longpanzhou/" target="_blank" title="LeetCode"><img className="icon" src={Leetcode}/><i className="fab fa-leetcode"></i></a></li>
                        <li><a href="mailto:patrickzhoul123@gmail.com" title="Email"><img className="icon" src={Email}/><i className="fas fa-envelope"></i></a></li>
                    </ul>
                </div>
                <div className='bigger-card'>
                    <h1 className="aboutme-tittle">About Me</h1>
                    <h1 className="aboutme-subtittle">Here's a brief description about myself...</h1>
                    <p className="aboutme-text">I am a Software Developer with experience in Python, Java, C++, C, Rust, JavaScript, and React. My expertise spans a range of technologies and programming languages, allowing me to build diverse applications from high-performance systems to dynamic web interfaces. I am passionate about learning new technologies and developing solutions that address real-world challenges. My goal is to create innovative software that not only meets user needs but also pushes the boundaries of what’s possible.</p>
                    <div className="button-container text-center">
                        <a href="path-to-resume.pdf" className="btn btn-primary" target="_blank" rel="noopener noreferrer">Resume</a>
                        <a href="https://github.com/LongpanZhou" onClick={Projects} className="btn btn-secondary" target="_blank" rel="noopener noreferrer">Projects</a>
                    </div>
                </div>
            </div>
        </div>
    </motion.div>
  )
}
export default profile