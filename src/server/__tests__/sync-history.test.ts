/**
 * Unit tests for the syncHistory feature:
 * - Writes always go to ~/.cocodeai/projects/
 * - syncHistory=false: only cocodeai sessions listed
 * - syncHistory=true:  cocodeai + ~/.claude/projects/ merged (deduped)
 */

import { describe, it, expect, beforeEach, afterEach } from 'bun:test'
import * as fs from 'node:fs/promises'
import * as path from 'node:path'
import * as os from 'node:os'
import { SessionService } from '../services/sessionService.js'

// ── helpers ──────────────────────────────────────────────────────────────────

let cocodeDir: string
let claudeDir: string
let service: SessionService & {
  getConfigDir(): string
  getProjectsDir(): string
  getClaudeProjectsDir(): string
}

const PROJECT = 'test-project'

async function writeSession(baseDir: string, projectDir: string, sessionId: string): Promise<void> {
  const dir = path.join(baseDir, 'projects', projectDir)
  await fs.mkdir(dir, { recursive: true })
  await fs.writeFile(path.join(dir, `${sessionId}.jsonl`), '', 'utf-8')
}

// ── setup / teardown ─────────────────────────────────────────────────────────

beforeEach(async () => {
  const base = path.join(os.tmpdir(), `sync-test-${Date.now()}-${Math.random().toString(36).slice(2)}`)
  cocodeDir = path.join(base, 'cocodeai')
  claudeDir = path.join(base, 'claude')
  await fs.mkdir(path.join(cocodeDir, 'projects'), { recursive: true })
  await fs.mkdir(path.join(claudeDir, 'projects'), { recursive: true })

  service = new SessionService() as typeof service
  // Override private methods to point at tmp dirs
  service.getConfigDir = () => cocodeDir
  service.getClaudeProjectsDir = () => path.join(claudeDir, 'projects')
})

afterEach(async () => {
  const base = path.dirname(cocodeDir)
  await fs.rm(base, { recursive: true, force: true })
})

// ── tests ─────────────────────────────────────────────────────────────────────

describe('syncHistory — write path', () => {
  it('getProjectsDir() points to cocodeai, not .claude', () => {
    const dir = service.getProjectsDir()
    expect(dir).toBe(path.join(cocodeDir, 'projects'))
    expect(dir).not.toContain('.claude')
  })
})

describe('syncHistory=false (default)', () => {
  it('lists only cocodeai sessions', async () => {
    await writeSession(cocodeDir, PROJECT, 'session-cocode')
    await writeSession(claudeDir, PROJECT, 'session-claude')

    service.setSyncHistory(false)
    const { sessions } = await service.listSessions()
    const ids = sessions.map((s) => s.id)

    expect(ids).toContain('session-cocode')
    expect(ids).not.toContain('session-claude')
  })

  it('returns empty list when cocodeai has no sessions', async () => {
    await writeSession(claudeDir, PROJECT, 'session-claude')

    service.setSyncHistory(false)
    const { sessions } = await service.listSessions()
    expect(sessions).toHaveLength(0)
  })
})

describe('syncHistory=true', () => {
  it('merges cocodeai and claude sessions', async () => {
    await writeSession(cocodeDir, PROJECT, 'session-cocode')
    await writeSession(claudeDir, PROJECT, 'session-claude')

    service.setSyncHistory(true)
    const { sessions } = await service.listSessions()
    const ids = sessions.map((s) => s.id)

    expect(ids).toContain('session-cocode')
    expect(ids).toContain('session-claude')
  })

  it('deduplicates sessions with the same id', async () => {
    await writeSession(cocodeDir, PROJECT, 'shared-session')
    await writeSession(claudeDir, PROJECT, 'shared-session')

    service.setSyncHistory(true)
    const { sessions } = await service.listSessions()

    expect(sessions.filter((s) => s.id === 'shared-session')).toHaveLength(1)
  })

  it('handles missing claude dir gracefully', async () => {
    await writeSession(cocodeDir, PROJECT, 'session-cocode')
    service.getClaudeProjectsDir = () => '/nonexistent/path/projects'

    service.setSyncHistory(true)
    const { sessions } = await service.listSessions()
    expect(sessions.map((s) => s.id)).toContain('session-cocode')
  })
})
