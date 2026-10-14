// Tipos iguais aos DTOs de docs/referencias/contrato-api.md

export type Eixo = 'NS' | 'LO'
export type Direcao = 'N' | 'S' | 'L' | 'O'
export type Luz = 'Verde' | 'Amarelo' | 'Vermelho' | 'Piscante'
export type TipoViatura = 'Ambulancia' | 'Bombeiros'
export type PapelViatura = 'Patrulha' | 'Reserva'
export type ModoViatura = 'Patrulha' | 'Emergencia' | 'Atendimento' | 'Retorno' | 'Reserva'
export type StatusOcorrencia = 'ACaminho' | 'EmAtendimento' | 'ACaminhoHospital' | 'Encerrada'
export type TipoEvento = 'Info' | 'Evento' | 'Alerta' | 'Erro' | 'Api'

export interface Cruzamento {
  id: string
  coluna: number
  linha: number
}

export interface Hospital {
  id: string
  nome: string
  cruzamento: string
}

export interface Base {
  nome: string
  cruzamento: string
  tipo: TipoViatura
}

export interface Malha {
  colunas: number
  linhas: number
  cruzamentos: Cruzamento[]
  hospitais: Hospital[]
  bases: Base[]
}

export interface Reserva {
  viaturaId: string
  eixo: Eixo
}

export interface Semaforo {
  cruzamento: string
  ns: Luz
  lo: Luz
  falha: boolean
  reservas: Reserva[]
  vencedor: string | null
}

export interface PassoRota {
  cruzamento: string
  eixo: Eixo
}

export interface Viatura {
  id: string
  tipo: TipoViatura
  papel: PapelViatura
  base: string
  modo: ModoViatura
  cruzamento: string
  indoPara: string | null
  trecho: number
  destino: string | null
  semRota: boolean
  rota: PassoRota[]
  previsao: string[]
  ocorrenciaId: string | null
  atendimentoRestanteSeg: number
  hospital: string | null
}

export interface Ocorrencia {
  id: string
  cruzamento: string
  criticidade: 1 | 2 | 3
  tipo: TipoViatura
  viaturaId: string
  status: StatusOcorrencia
  registradaEmSeg: number
  encerradaEmSeg: number | null
  hospital: string | null
}

export interface Estado {
  tempoSeg: number
  pausado: boolean
  velocidade: number
  semaforos: Semaforo[]
  viaturas: Viatura[]
  ocorrencias: Ocorrencia[]
}

export interface EventoLog {
  seq: number
  tempoSeg: number
  tags: string[]
  mensagem: string
  tipo: TipoEvento
}

export interface PodeAtravessar {
  pode: boolean
  cautela: boolean
  luz: Luz
}

export interface NovaOcorrencia {
  tipo: TipoViatura
  cruzamento: string
  criticidade: number
}

export interface ProblemDetails {
  status: number
  title?: string
  detail?: string
  instance?: string
}
