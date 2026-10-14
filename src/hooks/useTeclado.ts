import { useEffect } from 'react'
import { useSimulacaoStore } from '../store/useSimulacaoStore'
import type { DirecaoDesejada } from '../utils/movimento'

const TECLAS: Record<string, DirecaoDesejada> = {
  ArrowUp: 'N',
  w: 'N',
  W: 'N',
  ArrowDown: 'S',
  s: 'S',
  S: 'S',
  ArrowRight: 'L',
  d: 'L',
  D: 'L',
  ArrowLeft: 'O',
  a: 'O',
  A: 'O',
  ' ': 'PARAR',
}

// Setas, WASD e espaço sempre dirigem a AMB-01 e nunca acionam o último botão clicado.
// O campo de filtro do log é a única exceção. Esc cancela o modo de clique.
export function useTeclado(comando: (d: DirecaoDesejada) => void) {
  useEffect(() => {
    const aoApertar = (ev: KeyboardEvent) => {
      if (ev.key === 'Escape') {
        useSimulacaoStore.getState().setModoClique(null)
        return
      }
      const alvo = ev.target as HTMLElement | null
      if (alvo && (alvo.tagName === 'TEXTAREA' || (alvo.tagName === 'INPUT' && (alvo as HTMLInputElement).type !== 'checkbox'))) return
      const d = TECLAS[ev.key]
      if (!d) return
      ev.preventDefault()
      if (alvo && alvo !== document.body) alvo.blur()
      comando(d)
    }

    // o espaço não "reaperta" o botão que ficou com o foco
    const aoSoltar = (ev: KeyboardEvent) => {
      if (ev.key === ' ' && (ev.target as HTMLElement | null)?.tagName === 'BUTTON') ev.preventDefault()
    }

    // depois do clique de mouse, tira o foco do botão
    const aoClicar = (ev: MouseEvent) => {
      const botao = (ev.target as HTMLElement | null)?.closest('button')
      if (botao && ev.detail > 0) botao.blur()
    }

    document.addEventListener('keydown', aoApertar)
    document.addEventListener('keyup', aoSoltar)
    document.addEventListener('click', aoClicar)
    return () => {
      document.removeEventListener('keydown', aoApertar)
      document.removeEventListener('keyup', aoSoltar)
      document.removeEventListener('click', aoClicar)
    }
  }, [comando])
}
