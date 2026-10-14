import { B, FAIXA, H, M, RW, W } from '../share/constantes'
import type { Direcao, Eixo, Malha } from '../share/tipos'

type Grade = Pick<Malha, 'colunas' | 'linhas'>

export interface Ponto {
  x: number
  y: number
}

export interface Quadra {
  i: number
  j: number
  x: number
  y: number
  w: number
  h: number
}

export const DIRS: Record<Direcao, { dx: number; dy: number; eixo: Eixo }> = {
  N: { dx: 0, dy: -1, eixo: 'NS' },
  S: { dx: 0, dy: 1, eixo: 'NS' },
  L: { dx: 1, dy: 0, eixo: 'LO' },
  O: { dx: -1, dy: 0, eixo: 'LO' },
}

export const OPOSTO: Record<Direcao, Direcao> = { N: 'S', S: 'N', L: 'O', O: 'L' }

export const TODAS_DIRECOES: Direcao[] = ['N', 'L', 'S', 'O']

// id = linha * colunas + coluna + 1 (contrato-api.md)
export const idDe = (coluna: number, linha: number, colunas: number) => `C${linha * colunas + coluna + 1}`

export function colunaLinha(id: string, colunas: number) {
  const n = Number(id.slice(1)) - 1
  return { coluna: n % colunas, linha: Math.floor(n / colunas) }
}

export function posCruzamento(id: string, malha: Pick<Malha, 'colunas'>): Ponto {
  const { coluna, linha } = colunaLinha(id, malha.colunas)
  return { x: M + coluna * B, y: M + linha * B }
}

export function vizinho(malha: Grade, id: string, dir: Direcao): string | null {
  const { coluna, linha } = colunaLinha(id, malha.colunas)
  const c = coluna + DIRS[dir].dx
  const l = linha + DIRS[dir].dy
  if (c < 0 || l < 0 || c >= malha.colunas || l >= malha.linhas) return null
  return idDe(c, l, malha.colunas)
}

export function direcaoEntre(malha: Grade, de: string, para: string): Direcao | null {
  return TODAS_DIRECOES.find((d) => vizinho(malha, de, d) === para) ?? null
}

// Pista da mão direita: o veículo anda deslocado do centro da rua.
export function ladoDaPista(centro: Ponto, dir: Direcao, lado = FAIXA): Ponto {
  const d = DIRS[dir]
  return { x: centro.x - d.dy * lado, y: centro.y + d.dx * lado }
}

export function quadras(malha: Grade): Quadra[] {
  const xs = [0]
  const ys = [0]
  for (let c = 0; c < malha.colunas; c++) xs.push(M + c * B)
  xs.push(W)
  for (let l = 0; l < malha.linhas; l++) ys.push(M + l * B)
  ys.push(H)

  const out: Quadra[] = []
  for (let i = 0; i < xs.length - 1; i++) {
    for (let j = 0; j < ys.length - 1; j++) {
      const x0 = i === 0 ? 0 : xs[i] + RW / 2
      const x1 = i === xs.length - 2 ? W : xs[i + 1] - RW / 2
      const y0 = j === 0 ? 0 : ys[j] + RW / 2
      const y1 = j === ys.length - 2 ? H : ys[j + 1] - RW / 2
      out.push({ i, j, x: x0, y: y0, w: x1 - x0, h: y1 - y0 })
    }
  }
  return out
}

// Quadra (coluna,linha) que abriga cada edifício especial do mapa.
export const QUADRA_ESPECIAL: Record<string, { tipo: 'hosp' | 'base' | 'quartel'; nome: string }> = {
  '3,1': { tipo: 'hosp', nome: 'HOSPITAL NORTE' },
  '2,3': { tipo: 'hosp', nome: 'HOSPITAL SUL' },
  '1,2': { tipo: 'base', nome: 'BASE SAMU' },
  '4,3': { tipo: 'quartel', nome: 'BOMBEIROS' },
}

const QUADRA_BASE: Record<string, string> = { C11: '1,2', C20: '4,3' }

// Onde a viatura de reserva fica estacionada: dentro do prédio da base.
export function vagaBase(malha: Grade, no: string): Ponto {
  const q = quadras(malha).find((b) => `${b.i},${b.j}` === QUADRA_BASE[no])
  if (!q) return posCruzamento(no, malha)
  const iy = q.y + 9
  const ih = q.h - 18
  return { x: q.x + q.w / 2 - 33, y: iy + ih / 2 - 8 }
}
