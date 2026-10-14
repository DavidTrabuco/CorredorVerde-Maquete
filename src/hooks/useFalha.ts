import { useCallback } from 'react'
import { api } from '../share/api'
import type { Estado } from '../share/tipos'
import { useSimulacaoStore } from '../store/useSimulacaoStore'

async function atualizarEstado() {
  try {
    useSimulacaoStore.getState().setEstado(await api.get<Estado>('/estado'))
  } catch {
    // o polling traz o estado no próximo ciclo
  }
}

// UC09: liga ou desliga a falha de um cruzamento (RN13).
export function useFalha() {
  const alternarModo = useCallback(() => {
    const { modoClique, setModoClique } = useSimulacaoStore.getState()
    setModoClique(modoClique === 'falha' ? null : 'falha')
  }, [])

  // continua no modo falha até o usuário cancelar
  const alternarFalha = useCallback(async (cruzamento: string) => {
    const { estado, setToast } = useSimulacaoStore.getState()
    const atual = estado?.semaforos.find((s) => s.cruzamento === cruzamento)?.falha ?? false
    try {
      await api.post(`/cruzamentos/${cruzamento}/falha`, { ativa: !atual })
    } catch (e) {
      setToast((e as Error).message)
    }
    await atualizarEstado()
  }, [])

  const desligarTodas = useCallback(async () => {
    const { estado, setToast } = useSimulacaoStore.getState()
    const ligadas = estado?.semaforos.filter((s) => s.falha) ?? []
    try {
      await Promise.all(ligadas.map((s) => api.post(`/cruzamentos/${s.cruzamento}/falha`, { ativa: false })))
    } catch (e) {
      setToast((e as Error).message)
    }
    await atualizarEstado()
  }, [])

  return { alternarModo, alternarFalha, desligarTodas }
}
