import { useMemo } from 'react'
import Mapa from '../components/Mapa'
import { useAnimacao } from '../hooks/useAnimacao'
import { useCarrosComuns } from '../hooks/useCarrosComuns'
import { useTeclado } from '../hooks/useTeclado'
import { useViaturas } from '../hooks/useViaturas'
import { useSimulacaoStore } from '../store/useSimulacaoStore'

// Layout final: controles | mapa + faixa de eventos | painel lateral (entra nas próximas etapas).
export default function MaquetePage() {
  const toast = useSimulacaoStore((s) => s.toast)
  const viaturas = useViaturas()
  const carros = useCarrosComuns()

  useAnimacao((dt) => {
    viaturas.passo(dt, carros.carros)
    carros.passo(dt, viaturas.faixas())
  })
  useTeclado(viaturas.comando)

  const complementos = useMemo(
    () => ({
      centroViatura: viaturas.centro,
      desenharVeiculos: (ctx: CanvasRenderingContext2D, tReal: number, cores: Parameters<typeof viaturas.desenhar>[2], reduzMov: boolean) => {
        carros.desenhar(ctx)
        viaturas.desenhar(ctx, tReal, cores, reduzMov)
      },
    }),
    [viaturas, carros],
  )

  return (
    <main className="mx-auto flex max-w-[1480px] flex-col gap-3.5 px-4 pt-3.5 pb-6">
      <h1 className="font-display text-2xl font-bold">Corredor Verde</h1>
      {toast && (
        <p role="status" className="border border-line border-l-4 border-l-sig-amarelo bg-surface px-3 py-2 text-sm">
          {toast}
        </p>
      )}
      <Mapa complementos={complementos} />
    </main>
  )
}
