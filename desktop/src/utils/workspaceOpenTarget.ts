export type WorkspaceOpenTargetKind = 'browser' | 'workspace-preview' | 'external' | 'blocked'

export type WorkspaceOpenTarget = {
  kind: WorkspaceOpenTargetKind
  value: string
  previewPath?: string
  reason?: string
}

const LOCAL_HOSTS = new Set(['localhost', '127.0.0.1', '::1'])
const PREVIEW_EXTENSIONS = new Set(['md', 'markdown'])
const BROWSER_FILE_EXTENSIONS = new Set(['html', 'htm'])
const TRAILING_PUNCTUATION_RE = /[.,;:!?]+$/
const WINDOWS_ABSOLUTE_PATH_RE = /^[a-zA-Z]:[\\/][\s\S]+/
const UNIX_ABSOLUTE_PATH_RE = /^\/[^\s"'<>]+/

function trimTarget(rawTarget: string) {
  return rawTarget.trim().replace(TRAILING_PUNCTUATION_RE, '')
}

function extensionOfPath(path: string) {
  const clean = path.split(/[?#]/, 1)[0] ?? path
  const match = /\.([a-zA-Z0-9]+)$/.exec(clean)
  return match?.[1]?.toLowerCase() ?? ''
}

function pathToFileUrl(path: string) {
  const normalized = path.replace(/\\/g, '/')
  if (WINDOWS_ABSOLUTE_PATH_RE.test(path)) {
    return `file:///${encodeURI(normalized)}`
  }
  return `file://${encodeURI(normalized)}`
}

function normalizePathForCompare(path: string) {
  return decodeURIComponent(path).replace(/\\/g, '/').replace(/\/+$/, '').toLowerCase()
}

function toWorkspaceRelativePath(path: string, workDir?: string | null) {
  if (!workDir) return null
  const normalizedPath = normalizePathForCompare(path)
  const normalizedWorkDir = normalizePathForCompare(workDir)
  if (normalizedPath === normalizedWorkDir) return ''
  if (!normalizedPath.startsWith(`${normalizedWorkDir}/`)) return null
  return path.replace(/\\/g, '/').slice(workDir.replace(/\\/g, '/').replace(/\/+$/, '').length + 1)
}

function fileUrlToPath(url: URL) {
  const decoded = decodeURIComponent(url.pathname)
  if (/^\/[a-zA-Z]:\//.test(decoded)) return decoded.slice(1)
  return decoded
}

function normalizeRelativePath(target: string, workDir?: string | null) {
  if (!target || /^[a-zA-Z][a-zA-Z0-9+.-]*:/.test(target)) return null
  if (target.startsWith('#')) return null
  if (!/\.(html?|md|markdown)(?:[?#].*)?$/i.test(target)) return null

  const clean = target.replace(/\\/g, '/').replace(/^\.\//, '')
  if (clean.startsWith('../')) return null
  if (workDir && BROWSER_FILE_EXTENSIONS.has(extensionOfPath(clean))) {
    return pathToFileUrl(`${workDir.replace(/[\\/]$/, '')}/${clean}`)
  }
  return clean
}

export function isLocalPreviewUrl(url: string) {
  try {
    const parsed = new URL(url)
    if (parsed.protocol === 'file:') return true
    return (parsed.protocol === 'http:' || parsed.protocol === 'https:') && LOCAL_HOSTS.has(parsed.hostname)
  } catch {
    return false
  }
}

export function normalizeWorkspaceOpenTarget(rawTarget: string, workDir?: string | null): WorkspaceOpenTarget {
  const target = trimTarget(rawTarget)
  if (!target) return { kind: 'blocked', value: target, reason: 'empty' }

  const relativePath = normalizeRelativePath(target, workDir)
  if (relativePath) {
    const ext = extensionOfPath(relativePath)
    if (PREVIEW_EXTENSIONS.has(ext)) {
      return { kind: 'workspace-preview', value: relativePath, previewPath: relativePath }
    }
    return { kind: 'browser', value: relativePath }
  }

  if (WINDOWS_ABSOLUTE_PATH_RE.test(target) || UNIX_ABSOLUTE_PATH_RE.test(target)) {
    const ext = extensionOfPath(target)
    if (PREVIEW_EXTENSIONS.has(ext)) {
      const previewPath = toWorkspaceRelativePath(target, workDir)
      if (previewPath) return { kind: 'workspace-preview', value: target, previewPath }
      return { kind: 'external', value: pathToFileUrl(target) }
    }
    if (BROWSER_FILE_EXTENSIONS.has(ext)) {
      return { kind: 'browser', value: pathToFileUrl(target) }
    }
  }

  let url: URL
  try {
    url = new URL(target)
  } catch {
    return { kind: 'blocked', value: target, reason: 'invalid-url' }
  }

  if (url.protocol === 'file:') {
    const ext = extensionOfPath(url.pathname)
    if (PREVIEW_EXTENSIONS.has(ext)) {
      const path = fileUrlToPath(url)
      const previewPath = toWorkspaceRelativePath(path, workDir)
      if (previewPath) return { kind: 'workspace-preview', value: path, previewPath }
      return { kind: 'external', value: url.toString() }
    }
    if (BROWSER_FILE_EXTENSIONS.has(ext)) {
      return { kind: 'browser', value: url.toString() }
    }
    return { kind: 'blocked', value: target, reason: 'unsupported-file' }
  }

  if (url.protocol === 'http:' || url.protocol === 'https:') {
    if (LOCAL_HOSTS.has(url.hostname)) return { kind: 'browser', value: url.toString() }
    return { kind: 'external', value: url.toString() }
  }

  return { kind: 'blocked', value: target, reason: 'dangerous-protocol' }
}

const URL_RE = /\bhttps?:\/\/(?:localhost|127\.0\.0\.1|\[::1\]|::1)(?::\d+)?[^\s"')<>\]]*/gi
const FILE_URL_RE = /\bfile:\/\/[^\s"')<>]+/gi
const UNIX_LOCAL_FILE_RE = /(?:^|\s)(\/[^\s"']+\.(?:html?|md|markdown))(?:\b|$)/gi
const WINDOWS_LOCAL_FILE_RE = /(?:^|\s)([a-zA-Z]:[\\/][^\s"']+\.(?:html?|md|markdown))(?:\b|$)/gi
const MAX_TARGETS = 3

export function extractWorkspaceOpenTargets(content: string): string[] {
  const targets: string[] = []
  for (const match of content.matchAll(URL_RE)) targets.push(trimTarget(match[0]))
  for (const match of content.matchAll(FILE_URL_RE)) targets.push(trimTarget(match[0]))
  for (const match of content.matchAll(UNIX_LOCAL_FILE_RE)) targets.push(trimTarget(match[1] ?? ''))
  for (const match of content.matchAll(WINDOWS_LOCAL_FILE_RE)) targets.push(trimTarget(match[1] ?? ''))
  return [...new Set(targets.filter(Boolean))].slice(0, MAX_TARGETS)
}
