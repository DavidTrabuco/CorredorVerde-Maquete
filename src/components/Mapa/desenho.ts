import { B, H, M, RW, W } from '../../share/constantes'
import type { Estado, Luz, Malha } from '../../share/tipos'
import { QUADRA_ESPECIAL, posCruzamento, quadras, type Ponto } from '../../utils/geometria'

export type Cores = Record<string, string>

const NOMES_CORES = [
  'sig-verde',
  'sig-amarelo',
  'sig-vermelho',
  'rota-amb',
  'rota-bom',
  'ocorrencia',
  'map-chao',
  'map-calcada',
  'map-predio',
  'map-predio-2',
  'map-parque',
  'map-arvore',
  'map-asfalto',
  'map-cruz',
  'map-faixa',
  'map-texto',
  'map-especial',
  'accent',
  'fg',
  'bg',
  'surface',
]

const FONTE_DISPLAY = '"Barlow Semi Condensed", "Arial Narrow", sans-serif'
const FONTE_MONO = '"JetBrains Mono", ui-monospace, monospace'

// O canvas lê as cores das variáveis CSS, então acompanha o tema claro e escuro.
export function lerCores(): Cores {
  const cs = getComputedStyle(document.documentElement)
  const cores: Cores = {}
  for (const k of NOMES_CORES) cores[k] = cs.getPropertyValue(`--${k}`).trim()
  return cores
}

export const corViatura = (id: string, cores: Cores) => (id.startsWith('BOM') ? cores['rota-bom'] : cores['rota-amb'])

export function corLuz(luz: Luz, t: number, cores: Cores, reduzMov: boolean) {
  if (luz === 'Verde') return cores['sig-verde']
  if (luz === 'Amarelo') return cores['sig-amarelo']
  if (luz === 'Piscante') return Math.floor(t * 2.2) % 2 === 0 || reduzMov ? cores['sig-amarelo'] : cores['map-asfalto']
  return cores['sig-vermelho']
}

function gerador(semente: number) {
  let s = semente
  return () => {
    s = (s * 16807) % 2147483647
    return s / 2147483647
  }
}

// Tudo o que não muda (ruas, quadras, prédios, faixas): desenhado uma vez fora da tela.
export function montarCamadaFixa(malha: Malha, escala: number, cores: Cores): HTMLCanvasElement {
  const dpr = window.devicePixelRatio || 1
  const cv = document.createElement('canvas')
  cv.width = Math.round(W * escala * dpr)
  cv.height = Math.round(H * escala * dpr)
  const g = cv.getContext('2d')!
  g.setTransform(escala * dpr, 0, 0, escala * dpr, 0, 0)
  g.fillStyle = cores['map-chao']
  g.fillRect(0, 0, W, H)
  const rnd = gerador(3)

  for (const q of quadras(malha)) {
    g.fillStyle = cores['map-calcada']
    g.beginPath()
    g.roundRect(q.x + 2, q.y + 2, q.w - 4, q.h - 4, 6)
    g.fill()
    const esp = QUADRA_ESPECIAL[`${q.i},${q.j}`]
    const ix = q.x + 9
    const iy = q.y + 9
    const iw = q.w - 18
    const ih = q.h - 18
    if (iw < 10 || ih < 10) continue

    if (esp) {
      g.fillStyle = cores['map-especial']
      g.beginPath()
      g.roundRect(ix, iy, iw, ih, 4)
      g.fill()
      g.strokeStyle = esp.tipo === 'hosp' ? cores['ocorrencia'] : esp.tipo === 'quartel' ? cores['rota-bom'] : cores['rota-amb']
      g.lineWidth = 2
      g.stroke()
      const cx = ix + iw / 2
      const cy = iy + ih / 2 - 8
      if (esp.tipo === 'hosp') {
        g.fillStyle = cores['ocorrencia']
        g.fillRect(cx - 5, cy - 15, 10, 30)
        g.fillRect(cx - 15, cy - 5, 30, 10)
      } else {
        g.fillStyle = g.strokeStyle
        g.beginPath()
        g.arc(cx, cy, 13, 0, Math.PI * 2)
        g.fill()
        g.fillStyle = cores['map-especial']
        g.font = `700 12px ${FONTE_DISPLAY}`
        g.textAlign = 'center'
        g.textBaseline = 'middle'
        g.fillText(esp.tipo === 'quartel' ? 'B' : 'S', cx, cy + 1)
      }
      g.fillStyle = cores['map-texto']
      g.textAlign = 'center'
      g.textBaseline = 'middle'
      g.font = `700 11px ${FONTE_DISPLAY}`
      g.fillText(esp.nome, cx, iy + ih - 14)
      continue
    }

    if (rnd() < 0.22) {
      g.fillStyle = cores['map-parque']
      g.beginPath()
      g.roundRect(ix, iy, iw, ih, 4)
      g.fill()
      g.fillStyle = cores['map-arvore']
      const n = Math.max(2, Math.floor((iw * ih) / 1800))
      for (let k = 0; k < n; k++) {
        g.beginPath()
        g.arc(ix + 8 + rnd() * (iw - 16), iy + 8 + rnd() * (ih - 16), 5 + rnd() * 5, 0, Math.PI * 2)
        g.fill()
      }
      continue
    }

    const cols = iw > 70 ? 2 : 1
    const lins = ih > 70 ? 2 : 1
    const gw = (iw - (cols - 1) * 6) / cols
    const gh = (ih - (lins - 1) * 6) / lins
    for (let a = 0; a < cols; a++) {
      for (let b = 0; b < lins; b++) {
        if (rnd() < 0.12) continue
        g.fillStyle = rnd() < 0.5 ? cores['map-predio'] : cores['map-predio-2']
        const enc = rnd() * 6
        g.beginPath()
        g.roundRect(ix + a * (gw + 6) + enc / 2, iy + b * (gh + 6) + enc / 2, gw - enc, gh - enc, 3)
        g.fill()
      }
    }
  }

  // ruas
  g.fillStyle = cores['map-asfalto']
  for (let l = 0; l < malha.linhas; l++) g.fillRect(0, M + l * B - RW / 2, W, RW)
  for (let c = 0; c < malha.colunas; c++) g.fillRect(M + c * B - RW / 2, 0, RW, H)

  // faixa central tracejada
  g.strokeStyle = cores['map-faixa']
  g.lineWidth = 1.4
  g.setLineDash([9, 9])
  g.globalAlpha = 0.65
  for (let l = 0; l < malha.linhas; l++) {
    const y = M + l * B
    for (let c = -1; c < malha.colunas; c++) {
      const x0 = c < 0 ? 0 : M + c * B + RW / 2 + 16
      const x1 = c === malha.colunas - 1 ? W : M + (c + 1) * B - RW / 2 - 16
      g.beginPath()
      g.moveTo(x0, y)
      g.lineTo(x1, y)
      g.stroke()
    }
  }
  for (let c = 0; c < malha.colunas; c++) {
    const x = M + c * B
    for (let l = -1; l < malha.linhas; l++) {
      const y0 = l < 0 ? 0 : M + l * B + RW / 2 + 16
      const y1 = l === malha.linhas - 1 ? H : M + (l + 1) * B - RW / 2 - 16
      g.beginPath()
      g.moveTo(x, y0)
      g.lineTo(x, y1)
      g.stroke()
    }
  }
  g.setLineDash([])
  g.globalAlpha = 1

  // cruzamentos, faixas de pedestre e IDs
  for (const c of malha.cruzamentos) {
    const x = M + c.coluna * B
    const y = M + c.linha * B
    g.fillStyle = cores['map-cruz']
    g.fillRect(x - RW / 2, y - RW / 2, RW, RW)
    g.fillStyle = cores['map-faixa']
    g.globalAlpha = 0.55
    for (let k = -RW / 2 + 3; k < RW / 2 - 2; k += 6) {
      g.fillRect(x + k, y - RW / 2 - 15, 3, 8)
      g.fillRect(x + k, y + RW / 2 + 7, 3, 8)
      g.fillRect(x - RW / 2 - 15, y + k, 8, 3)
      g.fillRect(x + RW / 2 + 7, y + k, 8, 3)
    }
    g.globalAlpha = 1
    g.fillStyle = cores['map-texto']
    g.font = `600 10px ${FONTE_MONO}`
    g.textAlign = 'left'
    g.textBaseline = 'alphabetic'
    g.fillText(c.id, x + RW / 2 + 4, y - RW / 2 - 4)
  }
  return cv
}

export interface ParamsCena {
  ctx: CanvasRenderingContext2D
  camadaFixa: HTMLCanvasElement | null
  malha: Malha
  estado: Estado | null
  cores: Cores
  escala: number
  tReal: number
  reduzMov: boolean
  modoClique: boolean
  hoverNo: string | null
  // posição exata (em px do mapa) de uma viatura animada; usada como início da rota
  centroViatura?: (id: string) => Ponto | null
  // desenhos que entram entre os carros e as ocorrências (carros comuns e viaturas)
  desenharVeiculos?: (ctx: CanvasRenderingContext2D, tReal: number, cores: Cores, reduzMov: boolean) => void
}

export function desenharCena(p: ParamsCena) {
  const { ctx, camadaFixa, malha, estado, cores, escala, tReal, reduzMov } = p
  const dpr = window.devicePixelRatio || 1
  const canvas = ctx.canvas
  ctx.setTransform(1, 0, 0, 1, 0, 0)
  ctx.clearRect(0, 0, canvas.width, canvas.height)
  if (camadaFixa) ctx.drawImage(camadaFixa, 0, 0)
  ctx.setTransform(escala * dpr, 0, 0, escala * dpr, 0, 0)
  const tAnim = reduzMov ? 0 : tReal
  const pos = (id: string) => posCruzamento(id, malha)

  if (estado) {
    // previsão do trecho até o hospital (tracejada)
    for (const v of estado.viaturas) {
      if (v.previsao.length > 1 && v.trecho === 1) {
        ctx.strokeStyle = corViatura(v.id, cores)
        ctx.globalAlpha = 0.45
        ctx.lineWidth = 4
        ctx.setLineDash([7, 7])
        ctx.lineCap = 'round'
        ctx.beginPath()
        v.previsao.forEach((n, i) => {
          const q = pos(n)
          if (i) ctx.lineTo(q.x, q.y)
          else ctx.moveTo(q.x, q.y)
        })
        ctx.stroke()
        ctx.setLineDash([])
        ctx.globalAlpha = 1
      }
    }

    // rota atual: grossa na emergência, fina tracejada na volta
    for (const v of estado.viaturas) {
      if (!v.rota.length || (v.modo !== 'Emergencia' && v.modo !== 'Retorno')) continue
      const volta = v.modo === 'Retorno'
      const ini = p.centroViatura?.(v.id) ?? pos(v.cruzamento)
      ctx.strokeStyle = corViatura(v.id, cores)
      ctx.globalAlpha = volta ? 0.4 : 0.6
      ctx.lineWidth = volta ? 3 : 8
      ctx.lineCap = 'round'
      ctx.lineJoin = 'round'
      if (volta) ctx.setLineDash([3, 7])
      ctx.beginPath()
      ctx.moveTo(ini.x, ini.y)
      for (const r of v.rota) {
        const q = pos(r.cruzamento)
        ctx.lineTo(q.x, q.y)
      }
      ctx.stroke()
      ctx.setLineDash([])
      ctx.globalAlpha = 1
    }

    // anéis do corredor (e anel tracejado de quem perdeu o conflito)
    for (const s of estado.semaforos) {
      if (!s.reservas.length) continue
      const q = pos(s.cruzamento)
      const vencedor = s.vencedor ?? s.reservas[0].viaturaId
      ctx.lineWidth = 3
      ctx.strokeStyle = corViatura(vencedor, cores)
      ctx.beginPath()
      ctx.arc(q.x, q.y, 25, 0, Math.PI * 2)
      ctx.stroke()
      const outros = s.reservas.filter((r) => r.viaturaId !== vencedor)
      if (outros.length) {
        ctx.setLineDash([4, 4])
        ctx.strokeStyle = corViatura(outros[0].viaturaId, cores)
        ctx.beginPath()
        ctx.arc(q.x, q.y, 31, 0, Math.PI * 2)
        ctx.stroke()
        ctx.setLineDash([])
      }
    }

    // faixas de parada coloridas = semáforos
    for (const s of estado.semaforos) {
      const { x, y } = pos(s.cruzamento)
      ctx.fillStyle = corLuz(s.ns, tAnim, cores, reduzMov)
      ctx.fillRect(x - RW / 2, y - RW / 2 - 6, RW / 2, 4)
      ctx.fillRect(x, y + RW / 2 + 2, RW / 2, 4)
      ctx.fillStyle = corLuz(s.lo, tAnim, cores, reduzMov)
      ctx.fillRect(x - RW / 2 - 6, y, 4, RW / 2)
      ctx.fillRect(x + RW / 2 + 2, y - RW / 2, 4, RW / 2)
      if (s.falha) {
        ctx.save()
        ctx.translate(x, y)
        ctx.rotate(Math.PI / 4)
        ctx.fillStyle = corLuz('Piscante', tAnim, cores, reduzMov)
        ctx.fillRect(-8, -8, 16, 16)
        ctx.restore()
        ctx.fillStyle = '#1d1600'
        ctx.font = `800 12px ${FONTE_DISPLAY}`
        ctx.textAlign = 'center'
        ctx.textBaseline = 'middle'
        ctx.fillText('!', x, y + 1)
      }
    }
  }

  p.desenharVeiculos?.(ctx, tReal, cores, reduzMov)

  if (estado) {
    // ocorrências abertas: pino vermelho com criticidade e ID
    for (const o of estado.ocorrencias) {
      if (o.status === 'Encerrada') continue
      const q = pos(o.cruzamento)
      const x = q.x - 22
      const y = q.y + 24
      if (!reduzMov) {
        const k = (tReal * 0.9) % 1
        ctx.strokeStyle = cores['ocorrencia']
        ctx.globalAlpha = 1 - k
        ctx.lineWidth = 2
        ctx.beginPath()
        ctx.arc(x, y, 10 + k * 12, 0, Math.PI * 2)
        ctx.stroke()
        ctx.globalAlpha = 1
      }
      ctx.fillStyle = cores['ocorrencia']
      ctx.beginPath()
      ctx.arc(x, y, 10, 0, Math.PI * 2)
      ctx.fill()
      ctx.fillStyle = '#ffffff'
      ctx.font = `700 12px ${FONTE_DISPLAY}`
      ctx.textAlign = 'center'
      ctx.textBaseline = 'middle'
      ctx.fillText(String(o.criticidade), x, y + 1)
      ctx.fillStyle = cores['map-texto']
      ctx.font = `600 9.5px ${FONTE_MONO}`
      ctx.fillText(o.id, x, y + 19)
    }
  }

  // destaque do cruzamento sob o mouse no modo de clique
  if (p.modoClique && p.hoverNo) {
    const q = pos(p.hoverNo)
    ctx.strokeStyle = cores['accent']
    ctx.lineWidth = 2.5
    ctx.setLineDash([5, 4])
    ctx.beginPath()
    ctx.arc(q.x, q.y, 30, 0, Math.PI * 2)
    ctx.stroke()
    ctx.setLineDash([])
  }
}

// Cruzamento mais perto do clique (até 60 px), em coordenadas do mapa.
export function cruzamentoPerto(malha: Malha, x: number, y: number): string | null {
  let melhor: string | null = null
  let dist = Infinity
  for (const c of malha.cruzamentos) {
    const q = posCruzamento(c.id, malha)
    const d = Math.hypot(q.x - x, q.y - y)
    if (d < dist) {
      dist = d
      melhor = c.id
    }
  }
  return dist < 60 ? melhor : null
}
