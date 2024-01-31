import React from 'react'
import ReactDOM from 'react-dom/client'
import Welcome from './welcome/welcome.tsx'
import ChatGPT from './chatGPT/chatgpt.tsx'

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <Welcome />
    <ChatGPT />
  </React.StrictMode>,
)
