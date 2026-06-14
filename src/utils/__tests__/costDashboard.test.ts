import { describe, it, expect, beforeEach, afterEach } from 'bun:test'
import * as fs from 'node:fs/promises'
import * as path from 'node:path'
import * as os from 'node:os'
import { buildCostDashboard } from '../costDashboard.js'

const stubCalcCost = (_model: string, tokens: { inputTokens: number; outputTokens: number }) =>
  (tokens.inputTokens + tokens.outputTokens) * 0.000001

let tmpDir: string

function entry(model: string, inputTokens: number, outputTokens: number, timestamp: string) {
  return JSON.stringify({
    type: 'assistant',
    uuid: crypto.randomUUID(),
    timestamp,
    message: {
      role: 'assistant',
      model,
      usage: { input_tokens: inputTokens, output_tokens: outputTokens, cache_read_input_tokens: 0, cache_creation_input_tokens: 0 },
    },
  })
}

async function writeSession(projectName: string, sessionId: string, lines: string[]) {
  const dir = path.join(tmpDir, 'projects', projectName)
  await fs.mkdir(dir, { recursive: true })
  await fs.writeFile(path.join(dir, `${sessionId}.jsonl`), lines.join('\n') + '\n', 'utf-8')
}

beforeEach(async () => {
  tmpDir = path.join(os.tmpdir(), `cd-test-${Date.now()}`)
  await fs.mkdir(tmpDir, { recursive: true })
  process.env.CLAUDE_CONFIG_DIR = tmpDir
})

afterEach(async () => {
  await fs.rm(tmpDir, { recursive: true, force: true })
  delete process.env.CLAUDE_CONFIG_DIR
})

describe('buildCostDashboard', () => {
  it('returns empty summary when no projects', async () => {
    const result = await buildCostDashboard(undefined, stubCalcCost)
    expect(result.totalCostUSD).toBe(0)
    expect(result.entries).toHaveLength(0)
  })

  it('aggregates cost entries from multiple sessions', async () => {
    const ts = '2025-01-15T10:00:00.000Z'
    await writeSession('proj1', 'sess1', [entry('claude-sonnet-4-5', 1000, 200, ts)])
    await writeSession('proj2', 'sess2', [entry('claude-haiku', 500, 100, ts)])
    const result = await buildCostDashboard(undefined, stubCalcCost)
    expect(result.entries.length).toBe(2)
    expect(result.totalCostUSD).toBeCloseTo((1000 + 200 + 500 + 100) * 0.000001)
    expect(Object.keys(result.byDate)).toContain('2025-01-15')
    expect(Object.keys(result.byProject)).toContain('proj1')
    expect(Object.keys(result.byProject)).toContain('proj2')
  })

  it('groups entries by model', async () => {
    const ts = '2025-02-01T09:00:00.000Z'
    await writeSession('p', 's1', [
      entry('claude-sonnet-4-5', 100, 50, ts),
      entry('claude-sonnet-4-5', 200, 80, ts),
    ])
    const result = await buildCostDashboard(undefined, stubCalcCost)
    expect(Object.keys(result.byModel)).toContain('claude-sonnet-4-5')
  })

  it('filters entries by sinceDate', async () => {
    await writeSession('p', 's1', [entry('m', 100, 50, '2024-12-01T00:00:00.000Z')])
    await writeSession('p', 's2', [entry('m', 100, 50, '2025-06-01T00:00:00.000Z')])
    const result = await buildCostDashboard('2025-01-01', stubCalcCost)
    for (const e of result.entries) {
      expect(e.date >= '2025-01-01').toBe(true)
    }
  })

  it('skips non-assistant entries', async () => {
    await writeSession('p', 's', [
      JSON.stringify({ type: 'user', uuid: '1', timestamp: '2025-01-01T00:00:00.000Z', message: { role: 'user', content: 'hi' } }),
    ])
    const result = await buildCostDashboard(undefined, stubCalcCost)
    expect(result.entries).toHaveLength(0)
  })
})
