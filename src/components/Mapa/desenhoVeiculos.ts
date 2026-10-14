import type { TipoViatura } from '../../share/tipos'
import type { CarroComum } from '../../utils/movimento'
import { posicaoNaFaixa } from '../../utils/movimento'
import type { Ponto } from '../../utils/geometria'

export function desenharCarroComum(ctx: CanvasRenderingContext2D, c: CarroComum) {
  const p = posicaoNaFaixa(c)
  ctx.save()
  ctx.translate(p.x, p.y)
  ctx.rotate(c.eixo === 'H' ? (c.sentido > 0 ? 0 : Math.PI) : c.sentido > 0 ? Math.PI / 2 : -Math.PI / 2)
  ctx.fillStyle = 'rgba(0,0,0,.18)'
  ctx.beginPath()
  ctx.roundRect(-8, -4, 17, 10, 3)
  ctx.fill()
  ctx.fillStyle = c.cor
  ctx.beginPath()
  ctx.roundRect(-8.5, -5, 17, 10, 3)
  ctx.fill()
  ctx.fillStyle = 'rgba(20,30,40,.45)'
  ctx.fillRect(1.5, -3.6, 3.5, 7.2)
  ctx.restore()
}

export interface ViaturaDesenho {
  tipo: TipoViatura
  pos: Ponto
  ang: number
  emergencia: boolean
  corAnel: string
}

// Ambulância branca com faixa vermelha, caminhão vermelho; giroflex pisca só em emergência ou atendimento.
export function desenharViatura(ctx: CanvasRenderingContext2D, v: ViaturaDesenho, tAnim: number, tReal: number, reduzMov: boolean) {
  const { pos: p, emergencia: emerg } = v
  ctx.save()
  ctx.translate(p.x, p.y)
  ctx.rotate(v.ang)
  const len = v.tipo === 'Bombeiros' ? 26 : 23
  const lar = 12
  ctx.fillStyle = 'rgba(0,0,0,.25)'
  ctx.beginPath()
  ctx.roundRect(-len / 2 + 1, -lar / 2 + 1.5, len, lar, 3)
  ctx.fill()
  ctx.fillStyle = v.tipo === 'Bombeiros' ? '#c8321f' : '#f4f6f7'
  ctx.beginPath()
  ctx.roundRect(-len / 2, -lar / 2, len, lar, 3)
  ctx.fill()
  ctx.strokeStyle = 'rgba(0,0,0,.35)'
  ctx.lineWidth = 0.8
  ctx.stroke()
  if (v.tipo === 'Ambulancia') {
    ctx.fillStyle = '#d0263f'
    ctx.fillRect(-len / 2 + 2, -1.3, len - 9, 2.6)
  } else {
    ctx.fillStyle = '#f2f2f2'
    ctx.fillRect(-len / 2 + 3, -lar / 2 + 2, len - 10, 1.6)
    ctx.fillRect(-len / 2 + 3, lar / 2 - 3.6, len - 10, 1.6)
  }
  ctx.fillStyle = 'rgba(25,40,55,.75)'
  ctx.fillRect(len / 2 - 6, -lar / 2 + 1.5, 3.5, lar - 3)
  const pisca = Math.floor(tAnim * 6) % 2 === 0
  ctx.fillStyle = emerg ? (pisca ? '#2f7bff' : '#ff3341') : '#7f8a92'
  ctx.fillRect(-1, -lar / 2 + 1, 3, lar / 2 - 1)
  ctx.fillStyle = emerg ? (pisca ? '#ff3341' : '#2f7bff') : '#7f8a92'
  ctx.fillRect(-1, 0, 3, lar / 2 - 1)
  ctx.restore()

  if (emerg && !reduzMov) {
    ctx.strokeStyle = v.corAnel
    ctx.globalAlpha = 0.35 + 0.25 * Math.sin(tReal * 6)
    ctx.lineWidth = 2
    ctx.beginPath()
    ctx.arc(p.x, p.y, 17, 0, Math.PI * 2)
    ctx.stroke()
    ctx.globalAlpha = 1
  }
}
