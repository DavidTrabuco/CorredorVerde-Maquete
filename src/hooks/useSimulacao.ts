import { useEffect } from 'react'
import { api } from '../share/api'
import { POLL_ESTADO_MS } from '../share/constantes'
import type { Estado } from '../share/tipos'
import { useSimulacaoStore } from '../store/useSimulacaoStore'

// Polling de GET /estado a cada 250 ms (RNF08).
export function useSimulacao() {
  const setEstado = useSimulacaoStore((s) => s.setEstado)

  useEffect(() => {
    let ativo = true
    let emVoo = false

    const atualizar = async () => {
      if (emVoo) return
      emVoo = true
      try {
        const estado = await api.get<Estado>('/estado')
        if (ativo) setEstado(estado)
      } catch {
        // API fora do ar: tenta de novo no próximo ciclo
      } finally {
        emVoo = false
      }
    }

    void atualizar()
    const timer = setInterval(atualizar, POLL_ESTADO_MS)
    return () => {
      ativo = false
      clearInterval(timer)
    }
  }, [setEstado])
}
