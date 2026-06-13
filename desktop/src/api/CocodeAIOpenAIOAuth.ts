// desktop/src/api/CocodeAIOpenAIOAuth.ts

import { api, getBaseUrl } from './client'

export type CocodeAIOpenAIOAuthStatus =
  | { loggedIn: false }
  | {
      loggedIn: true
      expiresAt: number | null
      email: string | null
      accountId: string | null
    }

function currentServerPort(): number {
  const port = new URL(getBaseUrl()).port
  const parsed = Number.parseInt(port, 10)
  if (!Number.isFinite(parsed) || parsed <= 0) {
    throw new Error(`Cannot determine server port from baseUrl: ${getBaseUrl()}`)
  }
  return parsed
}

export const CocodeAIOpenAIOAuthApi = {
  start() {
    return api.post<{ authorizeUrl: string; state: string }>(
      '/api/cocodeai-openai-oauth/start',
      { serverPort: currentServerPort() },
    )
  },

  status() {
    return api.get<CocodeAIOpenAIOAuthStatus>('/api/cocodeai-openai-oauth')
  },

  logout() {
    return api.delete<{ ok: true }>('/api/cocodeai-openai-oauth')
  },
}
