import { Estilo } from '../../share/estilos'
import { useSimulacaoStore } from '../../store/useSimulacaoStore'
import type { DirecaoDesejada } from '../../utils/movimento'
import { ControleDirecaoStyles as S } from './styles'

interface ControleDirecaoProps {
  comando: (d: DirecaoDesejada) => void
}

export default function ControleDirecao({ comando }: ControleDirecaoProps) {
  const manual = useSimulacaoStore((s) => s.manual)
  const setManual = useSimulacaoStore((s) => s.setManual)

  const botao = (d: Exclude<DirecaoDesejada, null>, rotulo: string, aria: string, posicao: string) => (
    <button type="button" className={`${S.botao} ${posicao}`} aria-label={aria} onClick={() => comando(d)}>
      {rotulo}
    </button>
  )

  return (
    <div className={Estilo.bloco}>
      <div className={Estilo.blocoTit}>Dirigir a AMB-01</div>
      <div className={S.direcao}>
        <div className={S.dpad} aria-label="Direção da ambulância">
          {botao('N', '↑', 'Norte', S.norte)}
          {botao('O', '←', 'Oeste', S.oeste)}
          {botao('PARAR', 'PARE', 'Parar', S.parar)}
          {botao('L', '→', 'Leste', S.leste)}
          {botao('S', '↓', 'Sul', S.sul)}
        </div>
        <p className={S.dica}>Setas ou WASD assumem a direção. Espaço para no próximo cruzamento.</p>
      </div>
      <label className={S.chk}>
        <input
          type="checkbox"
          checked={manual}
          onChange={(e) => {
            setManual(e.target.checked)
            e.target.blur()
          }}
        />
        Eu dirijo a AMB-01
      </label>
    </div>
  )
}
