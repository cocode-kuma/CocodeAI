import { extractWorkspaceOpenTargets } from './workspaceOpenTarget'

export function extractDetectedUrls(content: string): string[] {
  return extractWorkspaceOpenTargets(content)
}
