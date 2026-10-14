import { useEffect, useRef } from 'react'
import { H, W } from '../../share/constantes'
import { useSimulacaoStore } from '../../store/useSimulacaoStore'
import { cruzamentoPerto, desenharCena, lerCores, montarCamadaFixa, type Cores, type ParamsCena } from './desenho'
import { MapaStyles } from './styles'

interface MapaProps {
  aoClicarCruzamento?: (id: string) => void
  // chamado a cada quadro, para as viaturas e os carros desenharem junto
  complementos?: Pick<ParamsCena, 'centroViatura' | 'desenharVeiculos'>
}

export default function Mapa({ aoClicarCruzamento, complementos }: MapaProps) {
  const wrapRef = useRef<HTMLDivElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const modoClique = useSimulacaoStore((s) => s.modoClique)
  const malha = useSimulacaoStore((s) => s.malha)

  // valores que o laço de desenho lê a cada quadro, sem recriar o efeito
  const vivo = useRef({ hoverNo: null as string | null, complementos, modoClique })
  useEffect(() => {
    vivo.current.complementos = complementos
    vivo.current.modoClique = modoClique
    if (!modoClique) vivo.current.hoverNo = null
  }, [complementos, modoClique])

  useEffect(() => {
    const canvas = canvasRef.current
    const wrap = wrapRef.current
    if (!canvas || !wrap || !malha) return
    const ctx = canvas.getContext('2d')!
    const reduzMov = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    const esquemaEscuro = window.matchMedia('(prefers-color-scheme: dark)')

    let escala = 1
    let cores: Cores = lerCores()
    let camada: HTMLCanvasElement | null = null
    let raf = 0

    const ajustar = () => {
      const w = wrap.clientWidth
      if (!w) return
      const dpr = window.devicePixelRatio || 1
      escala = w / W
      canvas.width = Math.round(w * dpr)
      canvas.height = Math.round(((w * H) / W) * dpr)
      cores = lerCores()
      camada = montarCamadaFixa(malha, escala, cores)
    }
    ajustar()

    const observador = new ResizeObserver(ajustar)
    observador.observe(wrap)
    esquemaEscuro.addEventListener('change', ajustar)

    const quadro = (agora: number) => {
      desenharCena({
        ctx,
        camadaFixa: camada,
        malha,
        estado: useSimulacaoStore.getState().estado,
        cores,
        escala,
        tReal: agora / 1000,
        reduzMov,
        modoClique: !!vivo.current.modoClique,
        hoverNo: vivo.current.hoverNo,
        ...vivo.current.complementos,
      })
      raf = requestAnimationFrame(quadro)
    }
    raf = requestAnimationFrame(quadro)

    return () => {
      cancelAnimationFrame(raf)
      observador.disconnect()
      esquemaEscuro.removeEventListener('change', ajustar)
    }
  }, [malha])

  const noDoEvento = (ev: React.MouseEvent<HTMLCanvasElement>) => {
    if (!malha) return null
    const r = ev.currentTarget.getBoundingClientRect()
    return cruzamentoPerto(malha, ((ev.clientX - r.left) / r.width) * W, ((ev.clientY - r.top) / r.height) * H)
  }

  return (
    <div className={MapaStyles.rolagem}>
      <div ref={wrapRef} className={MapaStyles.wrap}>
        <canvas
          ref={canvasRef}
          role="img"
          aria-label="Mapa da cidade com 20 cruzamentos, semáforos, viaturas e ocorrências"
          className={`${MapaStyles.canvas} ${modoClique ? MapaStyles.canvasClicavel : ''}`}
          onMouseMove={(ev) => {
            if (vivo.current.modoClique) vivo.current.hoverNo = noDoEvento(ev)
          }}
          onMouseLeave={() => {
            vivo.current.hoverNo = null
          }}
          onClick={(ev) => {
            if (!vivo.current.modoClique) return
            const no = noDoEvento(ev)
            if (no) aoClicarCruzamento?.(no)
          }}
        />
      </div>
    </div>
  )
}
