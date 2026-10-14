import { useMemo } from 'react'
import { classeChip } from '../../share/estilos'
import { REQUISITOS } from '../../share/requisitos'
import type { EventoLog } from '../../share/tipos'
import { useSimulacaoStore, type AbaPainel } from '../../store/useSimulacaoStore'
import { fmtT } from '../../utils/formato'
import { PainelLateralStyles as S } from './styles'

const MAX_LINHAS = 250

function classeLinha(tipo: EventoLog['tipo']) {
  if (tipo === 'Alerta') return S.linhaAlerta
  if (tipo === 'Erro') return S.linhaErro
  if (tipo === 'Api') return S.linhaApi
  if (tipo === 'Info') return S.linhaSis
  return ''
}

function classeMsg(tipo: EventoLog['tipo']) {
  if (tipo === 'Api') return `${S.msg} ${S.msgApi}`
  if (tipo === 'Info') return `${S.msg} ${S.msgSis}`
  return S.msg
}

function Chips({ tags, aoClicar }: { tags: string[]; aoClicar: (tag: string) => void }) {
  return (
    <div className={S.tags}>
      {tags.map((t) => (
        <button key={t} type="button" className={classeChip(t)} onClick={() => aoClicar(t)}>
          {t}
        </button>
      ))}
    </div>
  )
}

// UC10: aba Log (filtro e chips de RN/UC) e aba Requisitos (lista com contagem de uso).
export default function PainelLateral() {
  const aba = useSimulacaoStore((s) => s.aba)
  const setAba = useSimulacaoStore((s) => s.setAba)
  const log = useSimulacaoStore((s) => s.log)
  const filtro = useSimulacaoStore((s) => s.filtro)
  const setFiltro = useSimulacaoStore((s) => s.setFiltro)
  const mostrarApi = useSimulacaoStore((s) => s.mostrarApi)
  const setMostrarApi = useSimulacaoStore((s) => s.setMostrarApi)
  const contagem = useSimulacaoStore((s) => s.contagem)

  const filtrarPor = (tag: string) => {
    setFiltro(tag)
    setAba('Log')
  }

  const eventos = useMemo(() => {
    const texto = filtro.trim().toLowerCase()
    const itens: EventoLog[] = []
    for (let i = log.length - 1; i >= 0 && itens.length < MAX_LINHAS; i--) {
      const e = log[i]
      if (e.tipo === 'Api' && !mostrarApi) continue
      if (texto && !`${e.tags.join(' ')} ${e.mensagem}`.toLowerCase().includes(texto)) continue
      itens.push(e)
    }
    return itens
  }, [log, filtro, mostrarApi])

  const totalLog = useMemo(() => log.filter((e) => e.tipo !== 'Api').length, [log])

  const abas: { nome: AbaPainel; rotulo: string }[] = [
    { nome: 'Log', rotulo: 'Log' },
    { nome: 'Requisitos', rotulo: 'Requisitos' },
  ]

  const linhaReq = (id: string, texto: React.ReactNode, extra?: string) => {
    const n = contagem[id] ?? 0
    return (
      <button key={id} type="button" className={S.req} onClick={() => filtrarPor(id)}>
        <span className={S.rid}>{id}</span>
        <span>{texto}</span>
        <span className={S.rst}>
          <span className={`${S.obs} ${n ? S.obsSim : ''}`}>{n ? `${n}× na maquete` : 'ainda não agiu'}</span>
          {extra && <span className={S.manual}>{extra}</span>}
        </span>
      </button>
    )
  }

  return (
    <aside id="painel" className={S.painel} aria-label="Log e requisitos">
      <div className={S.abas} role="tablist">
        {abas.map((a) => (
          <button
            key={a.nome}
            type="button"
            role="tab"
            className={S.aba}
            aria-selected={aba === a.nome}
            aria-controls={`corpo${a.nome}`}
            onClick={() => setAba(a.nome)}
          >
            {a.rotulo}
            {a.nome === 'Log' && <span className={S.cont}>{totalLog}</span>}
          </button>
        ))}
      </div>

      {aba === 'Log' ? (
        <div id="corpoLog" role="tabpanel" className={S.corpo}>
          <div className={S.filtros}>
            <input
              type="search"
              className={S.busca}
              placeholder="Filtrar: RN06, UC04, C13, AMB-01…"
              aria-label="Filtrar o log"
              value={filtro}
              onChange={(e) => setFiltro(e.target.value)}
            />
            <label className={S.chk}>
              <input type="checkbox" checked={mostrarApi} onChange={(e) => setMostrarApi(e.target.checked)} />
              Chamadas da API
            </label>
          </div>
          <div className={S.rolagem}>
            <ol className={S.lista}>
              {eventos.length ? (
                eventos.map((e) => (
                  <li key={e.seq} className={`${S.linha} ${classeLinha(e.tipo)}`}>
                    <time className={S.hora}>{fmtT(e.tempoSeg)}</time>
                    <Chips tags={e.tags} aoClicar={filtrarPor} />
                    <div className={classeMsg(e.tipo)}>{e.mensagem}</div>
                  </li>
                ))
              ) : (
                <li className={S.vazio}>Nenhum evento{filtro.trim() ? ` com "${filtro.trim()}"` : ''} ainda.</li>
              )}
            </ol>
          </div>
        </div>
      ) : (
        <div id="corpoRequisitos" role="tabpanel" className={S.corpo}>
          <p className={S.nota}>
            Mesmos IDs do documento da 1ª entrega. A contagem mostra quantas vezes a regra agiu nesta sessão. Clique numa
            linha para ver os eventos dela no log.
          </p>
          <div className={S.rolagem}>
            <div className={S.grupo}>Regras de negócio</div>
            {REQUISITOS.rn.map((r) => linhaReq(r.id, r.texto))}
            <div className={S.grupo}>Casos de uso</div>
            {REQUISITOS.uc.map((u) =>
              linhaReq(
                u.id,
                <>
                  <b>{u.nome}.</b> {u.resumo}.
                </>,
              ),
            )}
            <div className={S.grupo}>Requisitos não funcionais</div>
            {REQUISITOS.rnf.map((r) =>
              linhaReq(
                r.id,
                <>
                  <b>{r.atributo}.</b> {r.texto}.
                </>,
                r.auto ? undefined : r.id === 'RNF11' ? 'medido no C#' : 'roteiro manual',
              ),
            )}
          </div>
        </div>
      )}
    </aside>
  )
}
