const API_BASE = import.meta.env.VITE_API_URL ?? (import.meta.env.DEV ? 'http://localhost:4000' : '/api')

async function parseApiResponse(res: Response) {
  const contentType = res.headers.get('content-type') ?? ''
  const raw = await res.text()

  if (!raw.trim()) {
    if (res.ok) {
      throw new Error('The server returned an empty response.')
    }
    throw new Error(`The server returned an empty response (${res.status}).`)
  }

  if (contentType.includes('application/json')) {
    try {
      return JSON.parse(raw) as { error?: string }
    } catch {
      throw new Error('The server returned invalid JSON.')
    }
  }

  if (!res.ok) {
    const message = raw.trim().slice(0, 200)
    throw new Error(message || `API error ${res.status}`)
  }

  try {
    return JSON.parse(raw) as { error?: string }
  } catch {
    throw new Error('The server returned a non-JSON success response.')
  }
}

export async function apiPost<T>(path: string, body: unknown): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  const data = await parseApiResponse(res)
  if (!res.ok) throw new Error(data.error ?? `API error ${res.status}`)
  return data as T
}

export async function apiPostForm<T>(path: string, form: FormData): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, { method: 'POST', body: form })
  const data = await parseApiResponse(res)
  if (!res.ok) throw new Error(data.error ?? `API error ${res.status}`)
  return data as T
}
