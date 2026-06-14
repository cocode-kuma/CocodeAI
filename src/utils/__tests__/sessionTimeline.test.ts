import { describe, it, expect, beforeEach, afterEach } from 'bun:test'
import * as fs from 'node:fs/promises'
import * as path from 'node:path'
import * as os from 'node:os'
import { buildSessionTimeline } from '../sessionTimeline.js'

let tmpDir: string

function makeEntry(type: string, role: string, content: unknown, uuid: string, timestamp: string) {
  return JSON.stringify({ type, uuid, timestamp, message: { role, content } })
}

beforeEach(async () => {
  tmpDir = path.join(os.tmpdir(), `st-test-${Date.now()}`)
  await fs.mkdir(tmpDir, { recursive: true })
})

afterEach(async () => {
  await fs.rm(tmpDir, { recursive: true, force: true })
})

async function write(filename: string, lines: string[]) {
  const p = path.join(tmpDir, filename)
  await fs.writeFile(p, lines.join('\n') + '\n', 'utf-8')
  return p
}

describe('buildSessionTimeline', () => {
  it('returns empty for empty transcript', async () => {
    const p = await write('empty.jsonl', [])
    expect(await buildSessionTimeline(p)).toEqual([])
  })

  it('parses user messages', async () => {
    const p = await write('t.jsonl', [
      makeEntry('user', 'user', 'Hello world', 'uuid-1', '2025-01-01T10:00:00.000Z'),
    ])
    const events = await buildSessionTimeline(p)
    expect(events).toHaveLength(1)
    expect(events[0]!.type).toBe('user')
    expect(events[0]!.summary).toBe('Hello world')
    expect(events[0]!.messageId).toBe('uuid-1')
  })

  it('parses assistant messages', async () => {
    const p = await write('t.jsonl', [
      makeEntry('assistant', 'assistant', [{ type: 'text', text: 'Here is the answer' }], 'uuid-2', '2025-01-01T10:01:00.000Z'),
    ])
    const events = await buildSessionTimeline(p)
    expect(events).toHaveLength(1)
    expect(events[0]!.type).toBe('assistant')
    expect(events[0]!.summary).toBe('Here is the answer')
  })

  it('extracts files changed from tool_use blocks', async () => {
    const p = await write('t.jsonl', [
      makeEntry('assistant', 'assistant', [
        { type: 'tool_use', name: 'FileWrite', input: { path: 'src/foo.ts', content: 'x' } },
      ], 'uuid-3', '2025-01-01T10:02:00.000Z'),
    ])
    const events = await buildSessionTimeline(p)
    expect(events[0]!.filesChanged).toEqual(['src/foo.ts'])
  })

  it('sorts events by timestamp', async () => {
    const p = await write('t.jsonl', [
      makeEntry('assistant', 'assistant', 'Second', 'uuid-b', '2025-01-01T10:01:00.000Z'),
      makeEntry('user', 'user', 'First', 'uuid-a', '2025-01-01T10:00:00.000Z'),
    ])
    const events = await buildSessionTimeline(p)
    expect(events[0]!.messageId).toBe('uuid-a')
    expect(events[1]!.messageId).toBe('uuid-b')
  })

  it('skips entries without uuid or timestamp', async () => {
    const p = await write('t.jsonl', [
      JSON.stringify({ type: 'user', message: { role: 'user', content: 'no uuid' } }),
      makeEntry('user', 'user', 'valid', 'uuid-v', '2025-01-01T09:00:00.000Z'),
    ])
    const events = await buildSessionTimeline(p)
    expect(events).toHaveLength(1)
    expect(events[0]!.messageId).toBe('uuid-v')
  })

  it('truncates long summaries to 120 chars', async () => {
    const longText = 'x'.repeat(200)
    const p = await write('t.jsonl', [
      makeEntry('user', 'user', longText, 'uuid-long', '2025-01-01T10:00:00.000Z'),
    ])
    const events = await buildSessionTimeline(p)
    expect(events[0]!.summary.length).toBeLessThanOrEqual(120)
  })
})
