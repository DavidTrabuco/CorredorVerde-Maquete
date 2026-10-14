import { B, CAUTELA_SEG, DISTANCIA_CARRO, FAIXA, H, M, PARE, W } from '../share/constantes'
import type { Direcao, Eixo, Luz, Malha, PodeAtravessar } from '../share/tipos'
import { OPOSTO, TODAS_DIRECOES, idDe, vizinho } from './geometria'

type Grade = Pick<Malha, 'colunas' | 'linhas'>

// ---------- patrulha e direção manual ----------

// Em cada cruzamento escolhe uma rua ao acaso, sem meia-volta (salvo beco sem saída).
export function passear(malha: Grade, no: string, dir: Direcao, rnd: () => number = Math.random): Direcao {
  const opcoes = TODAS_DIRECOES.filter((d) => vizinho(malha, no, d) && d !== OPOSTO[dir])
  if (!opcoes.length) return OPOSTO[dir]
  if (opcoes.includes(dir) && rnd() < 0.5) return dir
  return opcoes[Math.floor(rnd() * opcoes.length)]
}

export type DirecaoDesejada = Direcao | 'PARAR' | null

export function decidirManual(
  malha: Grade,
  no: string,
  dir: Direcao,
  desejada: DirecaoDesejada,
  andando: boolean,
): { dir: Direcao | null; andando: boolean } {
  if (desejada === 'PARAR') return { dir: null, andando: false }
  if (desejada && vizinho(malha, no, desejada)) return { dir: desejada, andando: true }
  if (andando && vizinho(malha, no, dir)) return { dir, andando }
  return { dir: null, andando: false }
}

// ---------- viatura na rua ----------

export interface EstadoRua {
  t: number // 0..1 ao longo da rua
  liberado: boolean // já passou pela faixa de parada
  cautela: number // segundos esperados no piscante
  esperando: boolean
}

export interface ResultadoPasso extends EstadoRua {
  // true quando chegou na faixa e ainda não há resposta de pode-atravessar
  precisaConsultar: boolean
}

export const T_PARE = 1 - PARE / B

export function passoNaRua(
  estado: EstadoRua,
  dt: number,
  velocidade: number,
  resposta: Pick<PodeAtravessar, 'pode' | 'cautela'> | null,
): ResultadoPasso {
  const { t } = estado
  let { liberado, cautela, esperando } = estado
  let precisaConsultar = false
  let novo = t + (velocidade * dt) / B

  if (!liberado && t <= T_PARE + 1e-6 && novo >= T_PARE) {
    if (!resposta) {
      novo = T_PARE
      esperando = true
      precisaConsultar = true
    } else if (!resposta.pode) {
      novo = T_PARE
      esperando = true
    } else if (resposta.cautela && cautela < CAUTELA_SEG) {
      cautela += dt
      novo = T_PARE
      esperando = true
    } else {
      liberado = true
      esperando = false
    }
  }

  return { t: Math.min(1, novo), liberado, cautela, esperando, precisaConsultar }
}

// ---------- carros comuns ----------

export interface CarroComum {
  eixo: 'H' | 'V'
  linha: number
  sentido: 1 | -1
  s: number
  cor: string
  vel: number
  liberadoNo: string | null
  cautela: number
  desvio: number
}

export interface ContextoCarro {
  malha: Grade
  luzDe: (cruzamento: string, eixo: Eixo) => Luz | undefined
  // posições (s) de quem está à frente na mesma faixa: outros carros e viaturas
  frente: number[]
  // posições (s) de viaturas em emergência na mesma faixa
  emergencia: number[]
}

export function nosDaLinha(carro: Pick<CarroComum, 'eixo' | 'linha'>, malha: Grade) {
  const out: { p: number; id: string; ex: Eixo }[] = []
  if (carro.eixo === 'H') {
    for (let c = 0; c < malha.colunas; c++) out.push({ p: M + c * B, id: idDe(c, carro.linha, malha.colunas), ex: 'LO' })
  } else {
    for (let l = 0; l < malha.linhas; l++) out.push({ p: M + l * B, id: idDe(carro.linha, l, malha.colunas), ex: 'NS' })
  }
  return out
}

export function passoCarroComum(carro: CarroComum, dt: number, ctx: ContextoCarro): CarroComum {
  const limite = carro.eixo === 'H' ? W : H
  let { liberadoNo, cautela } = carro
  let novo = carro.s + carro.sentido * carro.vel * dt

  for (const n of nosDaLinha(carro, ctx.malha)) {
    const dAgora = (n.p - carro.s) * carro.sentido
    const dDepois = (n.p - novo) * carro.sentido
    if (dAgora >= PARE - 0.5 && dDepois < PARE && liberadoNo !== n.id) {
      const luz = ctx.luzDe(n.id, n.ex) ?? 'Vermelho'
      let pode = luz === 'Verde'
      if (luz === 'Piscante') {
        cautela += dt
        pode = cautela >= CAUTELA_SEG
      }
      if (pode) {
        liberadoNo = n.id
        cautela = 0
      } else {
        novo = n.p - carro.sentido * PARE
      }
    }
  }

  for (const s of ctx.frente) {
    const gap = (s - carro.s) * carro.sentido
    if (gap > 0 && (s - novo) * carro.sentido < DISTANCIA_CARRO) novo = s - carro.sentido * DISTANCIA_CARRO
  }
  if ((novo - carro.s) * carro.sentido < 0) novo = carro.s

  // encosta para a viatura em emergência que vem atrás
  let encosta = 0
  for (const s of ctx.emergencia) {
    const atras = (novo - s) * carro.sentido
    if (atras > 0 && atras < 95) encosta = 6
  }
  const desvio = carro.desvio + (encosta - carro.desvio) * Math.min(1, dt * 6)

  if (carro.sentido > 0 && novo > limite + 20) {
    novo = -20
    liberadoNo = null
  }
  if (carro.sentido < 0 && novo < -20) {
    novo = limite + 20
    liberadoNo = null
  }

  return { ...carro, s: novo, liberadoNo, cautela, desvio }
}

export function posicaoNaFaixa(carro: Pick<CarroComum, 'eixo' | 'linha' | 'sentido' | 's' | 'desvio'>) {
  const lado = FAIXA + carro.desvio
  if (carro.eixo === 'H') return { x: carro.s, y: M + carro.linha * B + (carro.sentido > 0 ? lado : -lado) }
  return { x: M + carro.linha * B + (carro.sentido > 0 ? -lado : lado), y: carro.s }
}

export function criarCarrosComuns(malha: Grade, qtd: number, cores: string[]): CarroComum[] {
  let semente = 7
  const rnd = () => {
    semente = (semente * 16807) % 2147483647
    return semente / 2147483647
  }
  const lista: CarroComum[] = []
  for (let i = 0; i < qtd; i++) {
    const horizontal = i % 2 === 0
    const linha = Math.floor(rnd() * (horizontal ? malha.linhas : malha.colunas))
    const sentido: 1 | -1 = rnd() < 0.5 ? 1 : -1
    const lim = horizontal ? W : H
    let s = 30 + rnd() * (lim - 60)
    const eixo = horizontal ? 'H' : 'V'
    if (lista.some((c) => c.eixo === eixo && c.linha === linha && c.sentido === sentido && Math.abs(c.s - s) < 40)) {
      s = (s + 70) % lim
    }
    lista.push({ eixo, linha, sentido, s, cor: cores[i % cores.length], vel: 52 + rnd() * 26, liberadoNo: null, cautela: 0, desvio: 0 })
  }
  return lista
}
