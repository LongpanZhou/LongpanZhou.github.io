import '../profile/profile.css'
import src from '../profile/profile_bgrmeoved.png'
import Email from '../profile/icons/gmail.svg'
import Linkedin from '../profile/icons/linkedin.svg'
import Github from '../profile/icons/github.svg'
import Leetcode from '../profile/icons/leetcode.svg'

function ProfileCard({ showGoBack = false }: { showGoBack?: boolean }) {
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
            <li><a href="mailto:patrickzhoul123@gmail.com" title="patrickzhoul123@gmail.com"><img className="lp-icon" src={Email} alt="Email" /></a></li>
            <li><a href="https://github.com/LongpanZhou" target="_blank" rel="noopener noreferrer" title="GitHub"><img className="lp-icon" src={Github} alt="GitHub" /></a></li>
            <li><a href="https://leetcode.com/u/longpanzhou/" target="_blank" rel="noopener noreferrer" title="LeetCode"><img className="lp-icon" src={Leetcode} alt="LeetCode" /></a></li>
            <li><a href="https://www.linkedin.com/in/longpan-zhou/" target="_blank" rel="noopener noreferrer" title="LinkedIn"><img className="lp-icon" src={Linkedin} alt="LinkedIn" /></a></li>
          </ul>
        </div>
        <div className='lp-bigger-card'>
          <h1 className="lp-aboutme-title-anime">About Me</h1>
          <h1 className="lp-aboutme-subtitle">Here's a brief description about myself...</h1>
          <p className="lp-aboutme-text">I'm a Software Developer, I code, sleep, and repeat.</p>
          <p className="lp-aboutme-text">When I'm not coding, you'll find me at the gym, grinding League, listening to music, or reading economics books. Always fueled by good coffee and great vibes. <span className="coffee-hover">☕️<span className="tooltip">Jokes, I drink white monster</span></span></p>
          <p className="lp-aboutme-text">Also... How did you get here? <span className="coffee-hover">🤔<span className="tooltip">You found the secret! 🎉</span></span></p>
          <div className="lp-button-container text-center">
            <a href="https://github.com/LongpanZhou" className="lp-btn lp-btn-primary" target="_blank" rel="noopener noreferrer">Learn more about what I do</a>
            {showGoBack && <a href="/" className="lp-btn lp-btn-secondary">Go back to main page</a>}
            <a href="https://leetcode.com/u/longpanzhou/" className="lp-btn lp-btn-tertiary" target="_blank" rel="noopener noreferrer">Try to compete with me</a>
          </div>
        </div>
      </div>
    </div>
  )
}

export default ProfileCard
