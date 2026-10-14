import { useState } from 'react'
import { corViatura, type Cores } from '../components/Mapa/desenho'
import { desenharViatura } from '../components/Mapa/desenhoVeiculos'
import { api } from '../share/api'
import { TENTATIVA_PODE_MS, VEL_VIATURA } from '../share/constantes'
import type { Direcao, Estado, PodeAtravessar, Viatura } from '../share/tipos'
import { useSimulacaoStore } from '../store/useSimulacaoStore'
import { DIRS, OPOSTO, colunaLinha, direcaoEntre, ladoDaPista, posCruzamento, vagaBase, vizinho, type Ponto } from '../utils/geometria'
import { T_PARE, decidirManual, passear, passoNaRua, type CarroComum, type DirecaoDesejada } from '../utils/movimento'

const ANG: Record<Direcao, number> = { L: 0, S: Math.PI / 2, O: Math.PI, N: -Math.PI / 2 }
const ID_MANUAL = 'AMB-01'
const AVISO_MANUAL = 'Você assumiu a AMB-01. Desmarque "Eu dirijo a AMB-01" para ela voltar a andar sozinha.'

// Estado de animação de uma viatura: só vive na maquete. As regras ficam na API.
export interface VeiculoFront {
  id: string
  tipo: Viatura['tipo']
  no: string
  para: string | null
  t: number
  dir: Direcao
  ang: number
  desejada: DirecaoDesejada
  andando: boolean
  liberado: boolean
  cautela: number
  esperando: boolean
  reserva: boolean
  // há uma chamada saida/chegada em andamento: a viatura não decide nada até ela voltar
  ocupado: boolean
  resposta: Pick<PodeAtravessar, 'pode' | 'cautela'> | null
  respostaEm: number
  consultando: boolean
}

export interface FaixaViatura {
  id: string
  eixo: 'H' | 'V'
  linha: number
  sentido: 1 | -1
  s: number
  ativa: boolean
  emergencia: boolean
}

const lerpAng = (a: number, b: number, k: number) => {
  let d = b - a
  while (d > Math.PI) d -= 2 * Math.PI
  while (d < -Math.PI) d += 2 * Math.PI
  return a + d * k
}

const agora = () => performance.now()

function criarMotor() {
  const veiculos = new Map<string, VeiculoFront>()
  let ultimoTempo = 0
  const store = () => useSimulacaoStore.getState()

  const novo = (vb: Viatura): VeiculoFront => ({
    id: vb.id,
    tipo: vb.tipo,
    no: vb.cruzamento,
    para: null,
    t: 0,
    dir: 'L',
    ang: 0,
    desejada: null,
    andando: false,
    liberado: false,
    cautela: 0,
    esperando: false,
    reserva: vb.modo === 'Reserva',
    ocupado: false,
    resposta: null,
    respostaEm: 0,
    consultando: false,
  })

  const grade = () => store().malha!

  function centro(v: VeiculoFront): Ponto {
    const a = posCruzamento(v.no, grade())
    if (!v.para) return a
    const b = posCruzamento(v.para, grade())
    return { x: a.x + (b.x - a.x) * v.t, y: a.y + (b.y - a.y) * v.t }
  }

  function posicao(v: VeiculoFront): Ponto {
    if (v.reserva) return vagaBase(grade(), v.no)
    return ladoDaPista(centro(v), v.dir)
  }

  function faixa(v: VeiculoFront) {
    const c = centro(v)
    const d = DIRS[v.dir]
    const { coluna, linha } = colunaLinha(v.no, grade().colunas)
    return d.dy === 0
      ? { eixo: 'H' as const, linha, sentido: d.dx as 1 | -1, s: c.x }
      : { eixo: 'V' as const, linha: coluna, sentido: d.dy as 1 | -1, s: c.y }
  }

  function zerar(v: VeiculoFront, vb: Viatura) {
    v.no = vb.cruzamento
    v.para = null
    v.t = 0
    v.liberado = false
    v.cautela = 0
    v.esperando = false
    v.resposta = null
    v.desejada = null
    v.andando = false
  }

  // A viatura sai do cruzamento e entra na rua só depois de a API aceitar a saída.
  function partir(v: VeiculoFront, d: Direcao) {
    const n = vizinho(grade(), v.no, d)
    if (!n) return
    v.ocupado = true
    api
      .post(`/viaturas/${v.id}/saida`, { de: v.no, para: n })
      .then(() => {
        v.para = n
        v.dir = d
        v.t = 0
        v.liberado = false
        v.cautela = 0
        v.resposta = null
      })
      .catch(() => undefined)
      .finally(() => {
        v.ocupado = false
      })
  }

  function inverter(v: VeiculoFront) {
    if (!v.para) return
    ;[v.no, v.para] = [v.para, v.no]
    v.t = 1 - v.t
    v.dir = OPOSTO[v.dir]
    v.liberado = v.t > T_PARE
    v.cautela = 0
    v.resposta = null
    api.post(`/viaturas/${v.id}/saida`, { de: v.no, para: v.para }).catch(() => undefined)
  }

  // Depois do chegada, espera a resposta e um novo GET /estado antes de escolher a próxima rua.
  function chegar(v: VeiculoFront) {
    const alvo = v.para!
    v.no = alvo
    v.para = null
    v.t = 0
    v.liberado = false
    v.cautela = 0
    v.esperando = false
    v.resposta = null
    v.ocupado = true
    api
      .post(`/viaturas/${v.id}/chegada`, { cruzamento: alvo })
      .then(() => api.get<Estado>('/estado'))
      .then((e) => store().setEstado(e))
      .catch(() => undefined)
      .finally(() => {
        v.ocupado = false
      })
  }

  function consultar(v: VeiculoFront) {
    if (v.consultando || !v.para) return
    v.consultando = true
    const eixo = DIRS[v.dir].eixo
    api
      .get<PodeAtravessar>(`/cruzamentos/${v.para}/pode-atravessar?eixo=${eixo}&viaturaId=${v.id}`)
      .then((r) => {
        v.resposta = r
        v.respostaEm = agora()
      })
      .catch(() => undefined)
      .finally(() => {
        v.consultando = false
      })
  }

  function passoUm(v: VeiculoFront, vb: Viatura, dt: number, civis: CarroComum[], manualLigado: boolean) {
    if (vb.modo === 'Reserva') {
      v.reserva = true
      v.no = vb.cruzamento
      v.para = null
      v.t = 0
      v.ang = 0
      v.esperando = false
      return
    }
    if (v.reserva) {
      v.reserva = false
      v.no = vb.cruzamento
      v.para = null
      v.t = 0
    }
    v.ang = lerpAng(v.ang, ANG[v.dir], Math.min(1, dt * 12))
    if (vb.modo === 'Atendimento' || v.ocupado) return

    const manual = v.id === ID_MANUAL && manualLigado
    if (!manual && (v.desejada || v.andando)) {
      v.desejada = null
      v.andando = false
    }

    if (!v.para) {
      let d: Direcao | null = null
      if (manual) {
        const r = decidirManual(grade(), v.no, v.dir, v.desejada, v.andando)
        v.andando = r.andando
        d = r.dir
      } else if (vb.modo === 'Emergencia' || vb.modo === 'Retorno') {
        if (vb.rota.length && !vb.semRota) d = direcaoEntre(grade(), v.no, vb.rota[0].cruzamento)
      } else {
        d = passear(grade(), v.no, v.dir)
      }
      if (d) partir(v, d)
      return
    }

    if (manual && v.desejada && v.desejada !== 'PARAR' && v.desejada === OPOSTO[v.dir]) inverter(v)

    // resposta "não pode" vale por 250 ms: depois pergunta de novo
    if (v.resposta && !v.resposta.pode && agora() - v.respostaEm >= TENTATIVA_PODE_MS) v.resposta = null

    const r = passoNaRua(v, dt, VEL_VIATURA, v.resposta)
    if (r.precisaConsultar) consultar(v)
    let t = r.t
    if (r.liberado) v.resposta = null

    // fora da emergência a viatura fica atrás dos carros comuns
    if (vb.modo === 'Patrulha' || vb.modo === 'Retorno') {
      const f = faixa(v)
      for (const c of civis) {
        if (c.eixo !== f.eixo || c.linha !== f.linha || c.sentido !== f.sentido) continue
        const gap = (c.s - f.s) * f.sentido
        if (gap > 0 && gap < 26) {
          t = v.t
          break
        }
      }
    }

    v.t = t
    v.liberado = r.liberado
    v.cautela = r.cautela
    v.esperando = r.esperando
    if (v.t >= 1) chegar(v)
  }

  return {
    passo(dt: number, civis: CarroComum[]) {
      const { malha, estado, manual } = store()
      if (!malha || !estado) return
      const reiniciou = estado.tempoSeg < ultimoTempo - 1
      ultimoTempo = estado.tempoSeg
      for (const vb of estado.viaturas) {
        let v = veiculos.get(vb.id)
        if (!v) {
          v = novo(vb)
          veiculos.set(vb.id, v)
        }
        if (reiniciou) zerar(v, vb)
        passoUm(v, vb, dt, civis, manual)
      }
    },

    // chamado pelo teclado e pelo D-pad
    comando(d: DirecaoDesejada) {
      const s = store()
      if (!s.manual) {
        s.setManual(true)
        s.setToast(AVISO_MANUAL)
      }
      const amb = veiculos.get(ID_MANUAL)
      if (!amb || !d) return
      amb.desejada = d
      if (d !== 'PARAR') amb.andando = true
    },

    centro(id: string): Ponto | null {
      const v = veiculos.get(id)
      return v && store().malha ? centro(v) : null
    },

    faixas(): FaixaViatura[] {
      const { malha, estado } = store()
      if (!malha || !estado) return []
      return estado.viaturas.flatMap((vb) => {
        const v = veiculos.get(vb.id)
        if (!v || v.reserva) return []
        const f = faixa(v)
        return [{ id: v.id, ...f, ativa: !!v.para || v.esperando, emergencia: vb.modo === 'Emergencia' }]
      })
    },

    desenhar(ctx: CanvasRenderingContext2D, tReal: number, cores: Cores, reduzMov: boolean) {
      const { malha, estado } = store()
      if (!malha || !estado) return
      const tAnim = reduzMov ? 0 : tReal
      for (const vb of estado.viaturas) {
        const v = veiculos.get(vb.id)
        if (!v) continue
        desenharViatura(
          ctx,
          {
            tipo: v.tipo,
            pos: posicao(v),
            ang: v.ang,
            emergencia: vb.modo === 'Emergencia' || vb.modo === 'Atendimento',
            corAnel: corViatura(v.id, cores),
          },
          tAnim,
          tReal,
          reduzMov,
        )
      }
    },
  }
}

export type MotorViaturas = ReturnType<typeof criarMotor>

export function useViaturas(): MotorViaturas {
  const [motor] = useState(criarMotor)
  return motor
}
