import { useLog } from './hooks/useLog'
import { useMalha } from './hooks/useMalha'
import { useSimulacao } from './hooks/useSimulacao'
import MaquetePage from './pages/MaquetePage'

export default function Maquete() {
  useMalha()
  useSimulacao()
  useLog()
  return <MaquetePage />
}
