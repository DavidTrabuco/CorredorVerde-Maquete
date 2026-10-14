import { useEffect, useMemo } from 'react'
import { classeChip } from '../../share/estilos'
import { useSimulacaoStore } from '../../store/useSimulacaoStore'
import { FaixaEventosStyles as S } from './styles'

const JANELA_FEED_SEG = 12
const TOAST_MS = 4200

const AVISO_MODO = {
  Ambulancia: (c: number) => `Clique no cruzamento da ocorrência (ambulância, criticidade ${c})`,
  Bombeiros: (c: number) => `Clique no cruzamento da ocorrência (bombeiros, criticidade ${c})`,
  falha: () => 'Clique num cruzamento para ligar ou desligar a falha',
}

// Fica ABAIXO do mapa: avisos, mensagens e as 3 regras mais recentes, sem cobrir cruzamentos.
export default function FaixaEventos() {
  const modoClique = useSimulacaoStore((s) => s.modoClique)
  const criticidade = useSimulacaoStore((s) => s.criticidade)
  const setModoClique = useSimulacaoStore((s) => s.setModoClique)
  const toast = useSimulacaoStore((s) => s.toast)
  const setToast = useSimulacaoStore((s) => s.setToast)
  const log = useSimulacaoStore((s) => s.log)
  const tempoSeg = useSimulacaoStore((s) => s.estado?.tempoSeg ?? 0)

  useEffect(() => {
    if (!toast) return
    const timer = setTimeout(() => setToast(null), TOAST_MS)
    return () => clearTimeout(timer)
  }, [toast, setToast])

  const recentes = useMemo(() => {
    const itens = []
    for (let i = log.length - 1; i >= 0 && itens.length < 3; i--) {
      const e = log[i]
      if (tempoSeg - e.tempoSeg > JANELA_FEED_SEG) break
      if (e.tipo === 'Api' || e.tipo === 'Info' || !e.tags.some((t) => /^(RN|UC)/.test(t))) continue
      itens.push(e)
    }
    return itens
  }, [log, tempoSeg])

  return (
    <div className={S.barra}>
      {modoClique && (
        <div className={S.aviso}>
          <span>{AVISO_MODO[modoClique](criticidade)}</span>
          <button type="button" className={S.cancelar} onClick={() => setModoClique(null)}>
            Cancelar
          </button>
        </div>
      )}
      {toast && (
        <p role="status" className={S.toast}>
          {toast}
        </p>
      )}
      <ol className={S.feed} aria-live="polite" aria-label="Regras agindo agora">
        {recentes.length ? (
          recentes.map((e) => (
            <li key={e.seq} className={`${S.item} ${e.tipo === 'Alerta' ? S.itemAlerta : ''}`}>
              <span className={S.tags}>
                {e.tags
                  .filter((t) => t !== 'API')
                  .map((t) => (
                    <span key={t} className={classeChip(t)}>
                      {t}
                    </span>
                  ))}
              </span>
              <span>{e.mensagem.length > 120 ? `${e.mensagem.slice(0, 118)}…` : e.mensagem}</span>
            </li>
          ))
        ) : (
          <li className={S.vazio}>As regras aparecem aqui na hora em que agem. Dirija ou registre uma emergência.</li>
        )}
      </ol>
    </div>
  )
}
