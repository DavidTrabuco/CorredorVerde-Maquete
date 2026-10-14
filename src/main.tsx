import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import Maquete from './Maquete'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <Maquete />
  </StrictMode>,
)
