import { useEffect } from 'react'
import { api } from '../share/api'
import type { Malha } from '../share/tipos'
import { useSimulacaoStore } from '../store/useSimulacaoStore'

// A malha só muda se a API reiniciar com outra configuração: lê uma vez ao abrir.
export function useMalha() {
  const malha = useSimulacaoStore((s) => s.malha)
  const setMalha = useSimulacaoStore((s) => s.setMalha)
  const setToast = useSimulacaoStore((s) => s.setToast)

  useEffect(() => {
    let ativo = true
    api
      .get<Malha>('/malha')
      .then((m) => {
        if (ativo) setMalha(m)
      })
      .catch((e: Error) => {
        if (ativo) setToast(`Não foi possível carregar a malha: ${e.message}`)
      })
    return () => {
      ativo = false
    }
  }, [setMalha, setToast])

  return malha
}
