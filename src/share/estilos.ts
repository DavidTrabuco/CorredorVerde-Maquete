// Classes Tailwind usadas por mais de um componente.
export const Estilo = {
  bt: 'cursor-pointer rounded-lg border border-line bg-surface px-3 py-1.5 font-medium leading-tight hover:border-muted aria-pressed:border-sig-amarelo aria-pressed:bg-sig-amarelo aria-pressed:text-[#1d1600]',
  btPrim:
    'cursor-pointer rounded-lg border border-accent bg-accent px-3 py-1.5 font-medium leading-tight text-accent-fg hover:brightness-110 aria-pressed:border-sig-amarelo aria-pressed:bg-sig-amarelo aria-pressed:text-[#1d1600]',
  bloco: 'flex min-w-0 flex-col gap-2.5 rounded-xl border border-line bg-surface px-3.5 py-3',
  blocoTit: 'font-display text-[1.02rem] font-bold tracking-[.02em] uppercase',
  dica: 'm-0 text-[.82rem] text-muted',
}

const CHIP =
  'cursor-pointer rounded border-0 px-1.5 py-px font-mono text-[.7rem] leading-normal font-semibold text-fg'

// Chip de requisito: cor própria para RN, UC e RNF.
export function classeChip(tag: string) {
  if (tag === 'API') return `${CHIP} bg-surface-2 text-muted`
  if (tag.startsWith('RNF')) return `${CHIP} bg-[color-mix(in_srgb,var(--sig-amarelo)_22%,var(--surface))]`
  if (tag.startsWith('RN')) return `${CHIP} bg-[color-mix(in_srgb,var(--sig-verde)_18%,var(--surface))]`
  if (tag.startsWith('UC')) return `${CHIP} bg-[color-mix(in_srgb,var(--rota-amb)_16%,var(--surface))]`
  return `${CHIP} bg-[color-mix(in_srgb,var(--accent)_14%,var(--surface))]`
}
