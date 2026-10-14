import { useCallback } from 'react'
import { api } from '../share/api'
import type { Estado } from '../share/tipos'
import { useSimulacaoStore } from '../store/useSimulacaoStore'

// Pausar, velocidade (1×, 2×, 4×) e Reiniciar: tudo passa pela API.
export function useControleSimulacao() {
  const controlar = useCallback(async (pausado: boolean, velocidade: number) => {
    const { estado, setEstado, setToast } = useSimulacaoStore.getState()
    // atualiza a tela na hora; o polling confirma em seguida
    if (estado) setEstado({ ...estado, pausado, velocidade })
    try {
      await api.post('/simulacao/controle', { pausado, velocidade })
    } catch (e) {
      setToast((e as Error).message)
    }
  }, [])

  const reiniciar = useCallback(async () => {
    const s = useSimulacaoStore.getState()
    try {
      await api.post('/simulacao/reiniciar')
      s.limparLog()
      s.setManual(false)
      s.setModoClique(null)
      s.setToast(null)
      s.setEstado(await api.get<Estado>('/estado'))
    } catch (e) {
      s.setToast((e as Error).message)
    }
  }, [])

  return { controlar, reiniciar }
}
