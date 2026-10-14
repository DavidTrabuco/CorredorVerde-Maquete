import { create } from 'zustand'
import type { Estado, EventoLog, Malha, TipoViatura } from '../share/tipos'

export type ModoClique = TipoViatura | 'falha' | null
export type AbaPainel = 'Log' | 'Requisitos'

interface SimulacaoState {
  malha: Malha | null
  estado: Estado | null
  log: EventoLog[]
  ultimoSeq: number
  // quantas vezes cada RN, UC ou RNF apareceu no log desta sessão
  contagem: Record<string, number>
  modoClique: ModoClique
  criticidade: number
  manual: boolean
  toast: string | null
  aba: AbaPainel
  filtro: string
  mostrarApi: boolean
  setMalha: (malha: Malha) => void
  setEstado: (estado: Estado) => void
  addLog: (eventos: EventoLog[]) => void
  limparLog: () => void
  setModoClique: (modo: ModoClique) => void
  setCriticidade: (criticidade: number) => void
  setManual: (manual: boolean) => void
  setToast: (toast: string | null) => void
  setAba: (aba: AbaPainel) => void
  setFiltro: (filtro: string) => void
  setMostrarApi: (mostrar: boolean) => void
}

const LIMITE_LOG = 300

export const useSimulacaoStore = create<SimulacaoState>((set) => ({
  malha: null,
  estado: null,
  log: [],
  ultimoSeq: 0,
  contagem: {},
  modoClique: null,
  criticidade: 2,
  manual: false,
  toast: null,
  aba: 'Log',
  filtro: '',
  mostrarApi: false,
  setMalha: (malha) => set({ malha }),
  setEstado: (estado) => set({ estado }),
  addLog: (eventos) =>
    set((s) => {
      const novos = eventos.filter((e) => e.seq > s.ultimoSeq)
      if (!novos.length) return s
      const contagem = { ...s.contagem }
      for (const e of novos) for (const t of e.tags) contagem[t] = (contagem[t] ?? 0) + 1
      return {
        log: [...s.log, ...novos].slice(-LIMITE_LOG),
        ultimoSeq: novos[novos.length - 1].seq,
        contagem,
      }
    }),
  limparLog: () => set({ log: [], ultimoSeq: 0, contagem: {} }),
  setModoClique: (modoClique) => set({ modoClique }),
  setCriticidade: (criticidade) => set({ criticidade }),
  setManual: (manual) => set({ manual }),
  setToast: (toast) => set({ toast }),
  setAba: (aba) => set({ aba }),
  setFiltro: (filtro) => set({ filtro }),
  setMostrarApi: (mostrarApi) => set({ mostrarApi }),
}))
