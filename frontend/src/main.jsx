import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.jsx'
import './index.css'
import { ClerkProvider } from '@clerk/react'
import { clerkAppearance } from './lib/clerkAppearance'

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <ClerkProvider afterSignOutUrl="/" appearance={clerkAppearance}>
      <App />
    </ClerkProvider>
  </React.StrictMode>,
)

