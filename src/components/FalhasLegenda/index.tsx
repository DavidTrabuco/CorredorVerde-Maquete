import { useFalha } from '../../hooks/useFalha'
import { Estilo } from '../../share/estilos'
import { useSimulacaoStore } from '../../store/useSimulacaoStore'
import { FalhasLegendaStyles as S } from './styles'

// RNF10: rota, corredor, ocorrência e falha têm cor própria e aparecem na legenda.
export default function FalhasLegenda() {
  const modoClique = useSimulacaoStore((s) => s.modoClique)
  const { alternarModo, desligarTodas } = useFalha()

  return (
    <div className={Estilo.bloco}>
      <div className={Estilo.blocoTit}>Falhas e legenda</div>
      <div className={S.botoes}>
        <button type="button" className={Estilo.bt} aria-pressed={modoClique === 'falha'} onClick={alternarModo}>
          Simular falha
        </button>
        <button type="button" className={Estilo.bt} onClick={desligarTodas}>
          Desligar todas
        </button>
      </div>
      <ul className={S.legenda}>
        <li className={S.item}>
          <span className={`${S.faixa} ${S.verde}`} />
          Faixa verde
        </li>
        <li className={S.item}>
          <span className={`${S.faixa} ${S.vermelha}`} />
          Faixa vermelha
        </li>
        <li className={S.item}>
          <span className={`${S.faixa} ${S.rotaAmb}`} />
          Rota da ambulância
        </li>
        <li className={S.item}>
          <span className={`${S.faixa} ${S.rotaBom}`} />
          Rota dos bombeiros
        </li>
        <li className={S.item}>
          <span className={S.anel} />
          Corredor aberto
        </li>
        <li className={S.item}>
          <span className={S.pino} />
          Ocorrência
        </li>
        <li className={S.item}>
          <span className={S.losango} />
          Semáforo em falha
        </li>
        <li className={S.item}>
          <span className={`${S.faixa} ${S.trecho}`} />
          Trecho até o hospital
        </li>
      </ul>
    </div>
  )
}
