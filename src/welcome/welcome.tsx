import './welcome.css'
import TypeIt from 'typeit-react'

function welcome() {
  return (
    <>
      <div className="welcome-container">
        <TypeIt className="welcome-title">Welcome!</TypeIt>
      </div>
    </>
  )
}

export default welcome