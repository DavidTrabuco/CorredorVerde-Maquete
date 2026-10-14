export const FaixaEventosStyles = {
  barra: 'flex flex-col gap-2',
  aviso:
    'flex flex-wrap items-center justify-between gap-x-3 gap-y-2 rounded-[10px] bg-accent py-2 pr-2 pl-3.5 text-[.92rem] font-medium text-accent-fg',
  cancelar: 'cursor-pointer rounded-lg border-0 bg-accent-fg px-3 py-[5px] text-[.85rem] font-semibold text-accent',
  toast: 'border border-l-4 border-line border-l-sig-amarelo bg-surface px-3 py-2 text-[.88rem] text-fg',
  feed: 'm-0 grid list-none grid-cols-[repeat(auto-fill,minmax(210px,1fr))] gap-2 p-0',
  item: 'flex min-w-0 flex-col gap-1 rounded-[10px] border border-line bg-surface px-2.5 py-[7px] text-[.8rem] leading-[1.35] [overflow-wrap:anywhere]',
  itemAlerta: 'border-[color-mix(in_srgb,var(--sig-amarelo)_60%,var(--line))]',
  vazio: 'col-span-full rounded-[10px] border border-line bg-surface px-2.5 py-[7px] text-[.8rem] text-muted',
  tags: 'flex flex-wrap gap-1',
}
