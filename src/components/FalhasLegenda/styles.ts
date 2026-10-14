const SW = 'block flex-none rounded-sm'

export const FalhasLegendaStyles = {
  botoes: 'flex flex-wrap gap-2',
  legenda:
    'm-0 grid list-none grid-cols-[repeat(auto-fill,minmax(140px,1fr))] gap-x-2.5 gap-y-[5px] p-0 text-[.82rem] text-muted',
  item: 'flex items-center gap-[7px]',
  faixa: `${SW} h-1.5 w-[18px]`,
  anel: 'block size-[13px] flex-none rounded-full border-[2.5px] border-sig-verde bg-transparent',
  pino: 'block size-3 flex-none rounded-full bg-ocorrencia',
  losango: `${SW} mx-1 size-2.5 rotate-45 bg-sig-amarelo`,
  verde: 'bg-sig-verde',
  vermelha: 'bg-sig-vermelho',
  rotaAmb: 'bg-rota-amb',
  rotaBom: 'bg-rota-bom',
  trecho: 'bg-rota-amb opacity-45',
}
