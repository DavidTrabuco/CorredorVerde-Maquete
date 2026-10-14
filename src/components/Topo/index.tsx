import { useControleSimulacao } from '../../hooks/useControleSimulacao'
import { Estilo } from '../../share/estilos'
import { useSimulacaoStore } from '../../store/useSimulacaoStore'
import { fmtT } from '../../utils/formato'
import { TopoStyles } from './styles'

interface TopoProps {
  aoVerRequisitos: () => void
}

export default function Topo({ aoVerRequisitos }: TopoProps) {
  const estado = useSimulacaoStore((s) => s.estado)
  const { controlar, reiniciar } = useControleSimulacao()
  const pausado = estado?.pausado ?? false
  const velocidade = estado?.velocidade ?? 1

  return (
    <header className={TopoStyles.topo}>
      <div className={TopoStyles.marca}>
        <div className={TopoStyles.sinal} aria-hidden="true">
          <i className={TopoStyles.luz} />
          <i className={TopoStyles.luz} />
          <i className={TopoStyles.luzVerde} />
        </div>
        <div>
          <h1 className={TopoStyles.titulo}>Maquete Corredor Verde</h1>
          <p className={TopoStyles.subtitulo}>Gestão Dinâmica de Tráfego e Preferência para Emergências · A3</p>
        </div>
      </div>

      <div className={TopoStyles.relogioBox}>
        <span className={TopoStyles.rotulo}>Tempo simulado</span>
        <b className={TopoStyles.relogio}>{fmtT(estado?.tempoSeg ?? 0)}</b>
        <button type="button" className={Estilo.bt} onClick={() => controlar(!pausado, velocidade)}>
          {pausado ? 'Continuar' : 'Pausar'}
        </button>
        <select
          className={Estilo.bt}
          aria-label="Velocidade da simulação"
          value={velocidade}
          onChange={(e) => {
            controlar(pausado, Number(e.target.value))
            e.target.blur()
          }}
        >
          <option value={1}>1×</option>
          <option value={2}>2×</option>
          <option value={4}>4×</option>
        </select>
        <button type="button" className={Estilo.bt} onClick={reiniciar}>
          Reiniciar
        </button>
        <button type="button" className={`${Estilo.bt} ${TopoStyles.verRequisitos}`} onClick={aoVerRequisitos}>
          Ver requisitos ↓
        </button>
      </div>
    </header>
  )
}
