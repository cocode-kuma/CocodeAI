import { describe, it, expect, beforeEach, afterEach } from 'bun:test'
import * as fs from 'node:fs/promises'
import * as path from 'node:path'
import * as os from 'node:os'
import { addTemplate, deleteTemplate, getTemplate, listTemplates, updateTemplate } from '../promptTemplates.js'

let tmpDir: string

beforeEach(async () => {
  tmpDir = path.join(os.tmpdir(), `pt-test-${Date.now()}`)
  await fs.mkdir(tmpDir, { recursive: true })
  process.env.CLAUDE_CONFIG_DIR = tmpDir
})

afterEach(async () => {
  await fs.rm(tmpDir, { recursive: true, force: true })
  delete process.env.CLAUDE_CONFIG_DIR
})

describe('promptTemplates', () => {
  it('starts with an empty list', async () => {
    expect(await listTemplates()).toEqual([])
  })

  it('adds and retrieves a template', async () => {
    const t = await addTemplate('Write unit tests', 'Write tests for {{code}}')
    expect(t.id).toBeString()
    expect(t.name).toBe('Write unit tests')
    expect(t.content).toBe('Write tests for {{code}}')
    expect(await getTemplate(t.id)).toEqual(t)
  })

  it('lists multiple templates', async () => {
    await addTemplate('A', 'content A')
    await addTemplate('B', 'content B')
    const list = await listTemplates()
    expect(list).toHaveLength(2)
    expect(list.map(t => t.name)).toEqual(['A', 'B'])
  })

  it('deletes a template', async () => {
    const t = await addTemplate('Delete me', 'body')
    expect(await deleteTemplate(t.id)).toBe(true)
    expect(await getTemplate(t.id)).toBeUndefined()
  })

  it('returns false when deleting non-existent template', async () => {
    expect(await deleteTemplate('non-existent-id')).toBe(false)
  })

  it('updates a template', async () => {
    const t = await addTemplate('Old name', 'old content')
    const updated = await updateTemplate(t.id, { name: 'New name' })
    expect(updated?.name).toBe('New name')
    expect(updated?.content).toBe('old content')
  })

  it('returns undefined when updating non-existent template', async () => {
    expect(await updateTemplate('missing', { name: 'x' })).toBeUndefined()
  })

  it('rejects empty name', async () => {
    expect(addTemplate('', 'content')).rejects.toThrow('empty')
  })

  it('rejects empty content', async () => {
    expect(addTemplate('name', '')).rejects.toThrow('empty')
  })
})
