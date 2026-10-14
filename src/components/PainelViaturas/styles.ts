const PILL =
  'inline-flex max-w-full items-center gap-1.5 rounded-full border border-line bg-surface-2 px-2.5 py-0.5 text-[.82rem] font-semibold before:size-[7px] before:rounded-full before:content-[""]'

export const PainelViaturasStyles = {
  lista: 'm-0 flex list-none flex-col gap-2 p-0',
  item: 'flex flex-wrap items-center gap-x-2 gap-y-[3px]',
  id: 'min-w-[5.2ch] font-mono text-[.8rem] font-semibold',
  info: 'basis-full min-w-0 font-mono text-[.76rem] [overflow-wrap:anywhere] text-muted empty:hidden',
  pill: {
    ok: `${PILL} before:bg-sig-verde`,
    res: `${PILL} before:bg-accent`,
    emerg: `${PILL} border-[color-mix(in_srgb,var(--ocorrencia)_45%,var(--line))] bg-[color-mix(in_srgb,var(--ocorrencia)_14%,var(--surface))] before:bg-ocorrencia`,
    atend: `${PILL} border-[color-mix(in_srgb,var(--sig-amarelo)_50%,var(--line))] bg-[color-mix(in_srgb,var(--sig-amarelo)_18%,var(--surface))] before:bg-sig-amarelo`,
  },
}
