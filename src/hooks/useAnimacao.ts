import { useEffect, useRef } from 'react'
import { useSimulacaoStore } from '../store/useSimulacaoStore'

// Laço requestAnimationFrame: respeita pausado e multiplica o dt pela velocidade (1×, 2×, 4×).
export function useAnimacao(passo: (dt: number) => void) {
  const passoRef = useRef(passo)
  useEffect(() => {
    passoRef.current = passo
  }, [passo])

  useEffect(() => {
    let raf = 0
    let anterior = performance.now()

    const quadro = (agora: number) => {
      const delta = Math.min(0.1, (agora - anterior) / 1000)
      anterior = agora
      const estado = useSimulacaoStore.getState().estado
      if (estado && !estado.pausado) passoRef.current(delta * (estado.velocidade || 1))
      raf = requestAnimationFrame(quadro)
    }
    raf = requestAnimationFrame(quadro)
    return () => cancelAnimationFrame(raf)
  }, [])
}
