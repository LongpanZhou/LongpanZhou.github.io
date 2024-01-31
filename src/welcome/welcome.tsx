import React from 'react'
import TypeIt from 'typeit-react'
import './welcome.css'
import './welcome.js'

function welcome() {
  return (
    <>
      <div className='welcome-container'>
          <TypeIt className='welcome-title'>Welcome!</TypeIt>
      </div>
    </>
  )
}

export default welcome