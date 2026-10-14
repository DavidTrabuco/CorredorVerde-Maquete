import dados from '../../docs/referencias/requisitos.json'

export interface Requisito {
  id: string
  texto: string
}

export const REQUISITOS = dados
export const RN: Requisito[] = dados.rn
export const UC = dados.uc
export const RNF: Requisito[] = dados.rnf as Requisito[]
