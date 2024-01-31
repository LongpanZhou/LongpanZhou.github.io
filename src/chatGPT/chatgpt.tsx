import React from 'react'
import './chatgpt.css'
import 'bootstrap/dist/css/bootstrap.min.css'

function ChatGPT() {
  return (
    <div className='gpt-background'>
        <div className='gpt-inputbox'>
            <img src='../src/assets/chatbox.png'></img>
            <input className='gpt-input' type='text' placeholder='Type your message here...'></input>
            
        </div>
    </div>
  )
}

export default ChatGPT