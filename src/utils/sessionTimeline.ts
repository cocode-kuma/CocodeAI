import { readFile } from 'fs/promises'

export type TimelineEvent = {
  messageId: string
  timestamp: string
  type: 'user' | 'assistant' | 'tool_use' | 'tool_result'
  summary: string
  filesChanged?: string[]
  toolName?: string
}

type RawEntry = {
  type?: string
  uuid?: string
  timestamp?: string
  message?: {
    role?: string
    content?: unknown
    model?: string
  }
}

function summarizeContent(content: unknown): string {
  if (typeof content === 'string') return content.slice(0, 120).replace(/\s+/g, ' ').trim()
  if (!Array.isArray(content)) return ''
  for (const block of content as { type?: string; text?: string; name?: string; input?: unknown }[]) {
    if (block.type === 'text' && block.text) return block.text.slice(0, 120).replace(/\s+/g, ' ').trim()
    if (block.type === 'tool_use') return `[tool] ${block.name ?? 'unknown'}`
    if (block.type === 'tool_result') return '[tool result]'
  }
  return ''
}

function extractFilesChanged(content: unknown): string[] | undefined {
  if (!Array.isArray(content)) return undefined
  const files: string[] = []
  for (const block of content as { type?: string; name?: string; input?: Record<string, unknown> }[]) {
    if (
      block.type === 'tool_use' &&
      ['write_file', 'edit_file', 'str_replace_editor', 'FileEdit', 'FileWrite'].includes(block.name ?? '') &&
      typeof block.input?.path === 'string'
    ) {
      files.push(block.input.path)
    }
  }
  return files.length > 0 ? files : undefined
}

export async function buildSessionTimeline(transcriptPath: string): Promise<TimelineEvent[]> {
  const raw = await readFile(transcriptPath, 'utf-8')
  const events: TimelineEvent[] = []

  for (const line of raw.split('\n')) {
    if (!line.trim()) continue
    let entry: RawEntry
    try { entry = JSON.parse(line) as RawEntry } catch { continue }

    const role = entry.message?.role
    const content = entry.message?.content
    if (!entry.uuid || !entry.timestamp) continue

    if (entry.type === 'user' && role === 'user') {
      events.push({
        messageId: entry.uuid,
        timestamp: entry.timestamp,
        type: 'user',
        summary: summarizeContent(content),
        filesChanged: extractFilesChanged(content),
      })
    } else if (entry.type === 'assistant' && role === 'assistant') {
      const filesChanged = extractFilesChanged(content)
      events.push({
        messageId: entry.uuid,
        timestamp: entry.timestamp,
        type: 'assistant',
        summary: summarizeContent(content),
        ...(filesChanged ? { filesChanged } : {}),
      })
    }
  }

  return events.sort((a, b) => a.timestamp.localeCompare(b.timestamp))
}
