import { create } from 'zustand'
import type { Estado, EventoLog, Malha, TipoViatura } from '../share/tipos'

export type ModoClique = TipoViatura | null

interface SimulacaoState {
  malha: Malha | null
  estado: Estado | null
  log: EventoLog[]
  modoClique: ModoClique
  manual: boolean
  toast: string | null
  setMalha: (malha: Malha) => void
  setEstado: (estado: Estado) => void
  addLog: (eventos: EventoLog[]) => void
  limparLog: () => void
  setModoClique: (modo: ModoClique) => void
  setManual: (manual: boolean) => void
  setToast: (toast: string | null) => void
}

const LIMITE_LOG = 300

export const useSimulacaoStore = create<SimulacaoState>((set) => ({
  malha: null,
  estado: null,
  log: [],
  modoClique: null,
  manual: false,
  toast: null,
  setMalha: (malha) => set({ malha }),
  setEstado: (estado) => set({ estado }),
  addLog: (eventos) => set((s) => (eventos.length ? { log: [...s.log, ...eventos].slice(-LIMITE_LOG) } : s)),
  limparLog: () => set({ log: [] }),
  setModoClique: (modoClique) => set({ modoClique }),
  setManual: (manual) => set({ manual }),
  setToast: (toast) => set({ toast }),
}))
