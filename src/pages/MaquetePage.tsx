import { useCallback, useMemo } from 'react'
import ControleDirecao from '../components/ControleDirecao'
import FaixaEventos from '../components/FaixaEventos'
import FalhasLegenda from '../components/FalhasLegenda'
import Mapa from '../components/Mapa'
import PainelLateral from '../components/PainelLateral'
import PainelViaturas from '../components/PainelViaturas'
import RegistrarEmergencia from '../components/RegistrarEmergencia'
import Topo from '../components/Topo'
import { useAnimacao } from '../hooks/useAnimacao'
import { useCarrosComuns } from '../hooks/useCarrosComuns'
import { useEmergencia } from '../hooks/useEmergencia'
import { useFalha } from '../hooks/useFalha'
import { useTeclado } from '../hooks/useTeclado'
import { useViaturas } from '../hooks/useViaturas'
import { useSimulacaoStore } from '../store/useSimulacaoStore'
import type { Cores } from '../components/Mapa/desenho'

// Acima de 1280 px: controles | mapa + faixa de eventos | painel lateral.
// Entre 1080 e 1279 px os controles descem para baixo do mapa; no celular tudo empilha.
export default function MaquetePage() {
  const viaturas = useViaturas()
  const carros = useCarrosComuns()
  const { registrar } = useEmergencia()
  const { alternarFalha } = useFalha()

  useAnimacao((dt) => {
    viaturas.passo(dt, carros.carros)
    carros.passo(dt, viaturas.faixas())
  })
  useTeclado(viaturas.comando)

  const complementos = useMemo(
    () => ({
      centroViatura: viaturas.centro,
      desenharVeiculos: (ctx: CanvasRenderingContext2D, tReal: number, cores: Cores, reduzMov: boolean) => {
        carros.desenhar(ctx)
        viaturas.desenhar(ctx, tReal, cores, reduzMov)
      },
    }),
    [viaturas, carros],
  )

  const aoClicarCruzamento = useCallback(
    (id: string) => {
      if (useSimulacaoStore.getState().modoClique === 'falha') void alternarFalha(id)
      else void registrar(id)
    },
    [alternarFalha, registrar],
  )

  const aoVerRequisitos = useCallback(() => {
    useSimulacaoStore.getState().setAba('Requisitos')
    document.getElementById('painel')?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }, [])

  return (
    <div className="mx-auto flex max-w-[1480px] flex-col gap-3.5 px-4 pt-3.5 pb-6">
      <Topo aoVerRequisitos={aoVerRequisitos} />
      <main className="grid grid-cols-1 gap-3.5 min-[1080px]:grid-cols-[minmax(0,1fr)_minmax(330px,410px)] min-[1080px]:items-start">
        <section
          aria-label="Maquete"
          className="flex min-w-0 flex-col gap-3 min-[1280px]:grid min-[1280px]:grid-cols-[252px_minmax(0,1fr)] min-[1280px]:items-start"
        >
          <div className="flex min-w-0 flex-col gap-2.5">
            <Mapa aoClicarCruzamento={aoClicarCruzamento} complementos={complementos} />
            <FaixaEventos />
          </div>
          <div className="grid grid-cols-[repeat(auto-fit,minmax(230px,1fr))] gap-3 min-[1280px]:order-first min-[1280px]:grid-cols-1">
            <PainelViaturas esperando={viaturas.esperando} />
            <ControleDirecao comando={viaturas.comando} />
            <RegistrarEmergencia />
            <FalhasLegenda />
          </div>
        </section>
        <PainelLateral />
      </main>
    </div>
  )
}
