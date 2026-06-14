import { readFile, writeFile } from 'fs/promises'
import { homedir } from 'os'
import { join } from 'path'
import { randomUUID } from 'crypto'

function getConfigDir(): string {
  return (process.env.CLAUDE_CONFIG_DIR ?? join(homedir(), '.cocodeai'))
}

export type PromptTemplate = {
  id: string
  name: string
  content: string
  createdAt: string
}

function templatesPath(): string {
  return join(getConfigDir(), 'prompt-templates.json')
}

export async function listTemplates(): Promise<PromptTemplate[]> {
  try {
    const raw = await readFile(templatesPath(), 'utf-8')
    return JSON.parse(raw) as PromptTemplate[]
  } catch {
    return []
  }
}

export async function getTemplate(id: string): Promise<PromptTemplate | undefined> {
  return (await listTemplates()).find(t => t.id === id)
}

export async function addTemplate(name: string, content: string): Promise<PromptTemplate> {
  if (!name.trim()) throw new Error('Template name cannot be empty')
  if (!content.trim()) throw new Error('Template content cannot be empty')
  const templates = await listTemplates()
  const template: PromptTemplate = { id: randomUUID(), name: name.trim(), content, createdAt: new Date().toISOString() }
  templates.push(template)
  await writeFile(templatesPath(), JSON.stringify(templates, null, 2), { encoding: 'utf-8', mode: 0o600 })
  return template
}

export async function deleteTemplate(id: string): Promise<boolean> {
  const templates = await listTemplates()
  const next = templates.filter(t => t.id !== id)
  if (next.length === templates.length) return false
  await writeFile(templatesPath(), JSON.stringify(next, null, 2), { encoding: 'utf-8', mode: 0o600 })
  return true
}

export async function updateTemplate(id: string, patch: Partial<Pick<PromptTemplate, 'name' | 'content'>>): Promise<PromptTemplate | undefined> {
  const templates = await listTemplates()
  const idx = templates.findIndex(t => t.id === id)
  if (idx < 0) return undefined
  const updated = { ...templates[idx]!, ...patch }
  templates[idx] = updated
  await writeFile(templatesPath(), JSON.stringify(templates, null, 2), { encoding: 'utf-8', mode: 0o600 })
  return updated
}
