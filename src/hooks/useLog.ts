import { useEffect } from 'react'
import { api } from '../share/api'
import { POLL_LOG_MS } from '../share/constantes'
import type { EventoLog } from '../share/tipos'
import { useSimulacaoStore } from '../store/useSimulacaoStore'

// Polling de GET /log?desde=seq a cada 500 ms (UC10, RN14).
// Depois de "Reiniciar" a store zera o ultimoSeq e o log volta a ser lido do início.
export function useLog() {
  useEffect(() => {
    let ativo = true
    let emVoo = false

    const atualizar = async () => {
      if (emVoo) return
      emVoo = true
      try {
        const { ultimoSeq, addLog } = useSimulacaoStore.getState()
        const caminho = ultimoSeq > 0 ? `/log?desde=${ultimoSeq}` : '/log'
        const eventos = await api.get<EventoLog[]>(caminho)
        if (ativo) addLog(eventos)
      } catch {
        // API fora do ar: tenta de novo no próximo ciclo
      } finally {
        emVoo = false
      }
    }

    void atualizar()
    const timer = setInterval(atualizar, POLL_LOG_MS)
    return () => {
      ativo = false
      clearInterval(timer)
    }
  }, [])
}
