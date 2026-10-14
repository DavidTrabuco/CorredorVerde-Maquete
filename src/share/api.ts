import type { ProblemDetails } from './tipos'

const BASE = import.meta.env.VITE_API_URL ?? 'http://localhost:5080/api/v1'

export class ApiError extends Error {
  status: number

  constructor(status: number, mensagem: string) {
    super(mensagem)
    this.name = 'ApiError'
    this.status = status
  }
}

async function requisitar<T>(metodo: string, caminho: string, corpo?: unknown): Promise<T> {
  const resposta = await fetch(`${BASE}${caminho}`, {
    method: metodo,
    headers: corpo === undefined ? undefined : { 'Content-Type': 'application/json' },
    body: corpo === undefined ? undefined : JSON.stringify(corpo),
  })

  if (!resposta.ok) {
    const problema = (await resposta.json().catch(() => null)) as ProblemDetails | null
    throw new ApiError(
      resposta.status,
      problema?.detail ?? problema?.title ?? `Erro ${resposta.status} ao chamar a API.`,
    )
  }

  if (resposta.status === 204) return undefined as T
  return (await resposta.json()) as T
}

export const api = {
  get: <T>(caminho: string) => requisitar<T>('GET', caminho),
  post: <T = void>(caminho: string, corpo?: unknown) => requisitar<T>('POST', caminho, corpo),
}
