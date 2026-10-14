import { Estilo } from '../../share/estilos'
import type { Viatura } from '../../share/tipos'
import { useSimulacaoStore } from '../../store/useSimulacaoStore'
import { PainelViaturasStyles as S } from './styles'

interface PainelViaturasProps {
  // vem da animação: a viatura parada na faixa esperando o verde (RN07)
  esperando: (id: string) => boolean
}

function textoStatus(v: Viatura): [keyof typeof S.pill, string] {
  if (v.modo === 'Reserva') return ['res', 'Reserva na base']
  if (v.modo === 'Retorno') return ['res', 'Voltando à base']
  if (v.modo === 'Atendimento') return ['atend', `Atendimento · ${Math.ceil(v.atendimentoRestanteSeg)} s`]
  if (v.modo === 'Emergencia') {
    if (v.semRota) return ['emerg', 'Sem rota · aguardando']
    return ['emerg', v.trecho === 2 ? `Indo ao ${v.hospital}` : 'Indo ao local']
  }
  return ['ok', 'Patrulhando']
}

function infoDaViatura(v: Viatura, manual: boolean, esperando: boolean) {
  if ((v.modo === 'Emergencia' || v.modo === 'Retorno') && v.rota.length) {
    return (v.ocorrenciaId ? `${v.ocorrenciaId} · ` : '') + v.rota.map((r) => r.cruzamento).join(' → ')
  }
  if (v.modo === 'Patrulha') {
    const onde = v.indoPara ? `${v.cruzamento} → ${v.indoPara}` : `em ${v.cruzamento}`
    return (manual && v.id === 'AMB-01' ? 'Você dirige · ' : '') + onde + (esperando ? ' · esperando o verde' : '')
  }
  return ''
}

export default function PainelViaturas({ esperando }: PainelViaturasProps) {
  const viaturas = useSimulacaoStore((s) => s.estado?.viaturas)
  const manual = useSimulacaoStore((s) => s.manual)

  return (
    <div className={Estilo.bloco}>
      <div className={Estilo.blocoTit}>Viaturas</div>
      <ul className={S.lista}>
        {(viaturas ?? []).map((v) => {
          const [classe, texto] = textoStatus(v)
          return (
            <li key={v.id} className={S.item}>
              <span className={S.id}>{v.id}</span>
              <span className={S.pill[classe]}>{texto}</span>
              <span className={S.info}>{infoDaViatura(v, manual, esperando(v.id))}</span>
            </li>
          )
        })}
      </ul>
    </div>
  )
}
