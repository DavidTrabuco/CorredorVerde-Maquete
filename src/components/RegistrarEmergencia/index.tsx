import { useEmergencia } from '../../hooks/useEmergencia'
import { Estilo } from '../../share/estilos'
import { useSimulacaoStore } from '../../store/useSimulacaoStore'
import { RegistrarEmergenciaStyles as S } from './styles'

// RNF09: escolher o tipo e clicar no mapa são no máximo 2 cliques.
export default function RegistrarEmergencia() {
  const modoClique = useSimulacaoStore((s) => s.modoClique)
  const criticidade = useSimulacaoStore((s) => s.criticidade)
  const setCriticidade = useSimulacaoStore((s) => s.setCriticidade)
  const { alternarModo } = useEmergencia()

  return (
    <div className={Estilo.bloco}>
      <div className={Estilo.blocoTit}>Registrar emergência</div>
      <label className={S.campo} htmlFor="selCrit">
        Criticidade
        <select
          id="selCrit"
          className={Estilo.bt}
          value={criticidade}
          onChange={(e) => {
            setCriticidade(Number(e.target.value))
            e.target.blur()
          }}
        >
          <option value={1}>1 · Risco de vida</option>
          <option value={2}>2 · Urgente</option>
          <option value={3}>3 · Padrão</option>
        </select>
      </label>
      <div className={S.botoes}>
        <button
          type="button"
          className={Estilo.btPrim}
          aria-pressed={modoClique === 'Ambulancia'}
          onClick={() => alternarModo('Ambulancia')}
        >
          Emergência da ambulância
        </button>
        <button
          type="button"
          className={Estilo.btPrim}
          aria-pressed={modoClique === 'Bombeiros'}
          onClick={() => alternarModo('Bombeiros')}
        >
          Emergência dos bombeiros
        </button>
      </div>
      <p className={Estilo.dica}>
        Depois do botão, clique no cruzamento da ocorrência. Vai a viatura livre mais perto do local: a da patrulha ou,
        se for perto da base, a de reserva.
      </p>
    </div>
  )
}
