import { readdir, readFile, stat } from 'fs/promises'
import { homedir } from 'os'
import { join } from 'path'

function getConfigDir(): string {
  return process.env.CLAUDE_CONFIG_DIR ?? join(homedir(), '.cocodeai')
}

export type CostEntry = {
  date: string   // YYYY-MM-DD
  projectPath: string
  sessionId: string
  costUSD: number
  inputTokens: number
  outputTokens: number
  model: string
}

export type DashboardSummary = {
  totalCostUSD: number
  byDate: Record<string, number>
  byProject: Record<string, number>
  byModel: Record<string, number>
  entries: CostEntry[]
}

type CostCalculator = (model: string, tokens: { inputTokens: number; outputTokens: number; cacheReadInputTokens: number; cacheCreationInputTokens: number }) => number

type RawEntry = {
  type?: string
  message?: {
    model?: string
    usage?: {
      input_tokens?: number
      output_tokens?: number
      cache_read_input_tokens?: number
      cache_creation_input_tokens?: number
    }
  }
  timestamp?: string
}

async function extractCostFromSession(
  filePath: string,
  projectPath: string,
  sessionId: string,
  calcCost: CostCalculator,
): Promise<CostEntry[]> {
  const raw = await readFile(filePath, 'utf-8')
  const entries: CostEntry[] = []
  for (const line of raw.split('\n')) {
    if (!line.trim()) continue
    let entry: RawEntry
    try { entry = JSON.parse(line) as RawEntry } catch { continue }
    if (entry.type !== 'assistant') continue
    const usage = entry.message?.usage
    const model = entry.message?.model
    if (!usage || !model) continue
    const inputTokens = usage.input_tokens ?? 0
    const outputTokens = usage.output_tokens ?? 0
    const cacheRead = usage.cache_read_input_tokens ?? 0
    const cacheCreate = usage.cache_creation_input_tokens ?? 0
    const costUSD = calcCost(model, { inputTokens, outputTokens, cacheReadInputTokens: cacheRead, cacheCreationInputTokens: cacheCreate })
    const date = entry.timestamp
      ? new Date(entry.timestamp).toISOString().slice(0, 10)
      : new Date().toISOString().slice(0, 10)
    entries.push({ date, projectPath, sessionId, costUSD, inputTokens, outputTokens, model })
  }
  return entries
}

export async function buildCostDashboard(
  sinceDate?: string,
  calcCost?: CostCalculator,
): Promise<DashboardSummary> {
  // Default: lazy-import so production uses real costs; tests can inject a stub
  const computeCost: CostCalculator = calcCost ?? await (async () => {
    const { calculateCostFromTokens } = await import('./modelCost.js')
    return calculateCostFromTokens
  })()

  const projectsDir = join(getConfigDir(), 'projects')
  const allEntries: CostEntry[] = []

  let projectDirs: import('fs').Dirent[]
  try {
    projectDirs = await readdir(projectsDir, { withFileTypes: true })
  } catch {
    return { totalCostUSD: 0, byDate: {}, byProject: {}, byModel: {}, entries: [] }
  }

  await Promise.all(projectDirs.map(async (pDir) => {
    if (!pDir.isDirectory()) return
    const pPath = join(projectsDir, pDir.name)
    let files: import('fs').Dirent[]
    try { files = await readdir(pPath, { withFileTypes: true }) } catch { return }
    await Promise.all(files.map(async (f) => {
      if (!f.isFile() || !f.name.endsWith('.jsonl')) return
      const sessionId = f.name.slice(0, -6)
      const filePath = join(pPath, f.name)
      if (sinceDate) {
        const s = await stat(filePath).catch(() => null)
        if (s && s.mtime.toISOString().slice(0, 10) < sinceDate) return
      }
      const entries = await extractCostFromSession(filePath, pDir.name, sessionId, computeCost).catch(() => [])
      allEntries.push(...entries.filter(e => !sinceDate || e.date >= sinceDate))
    }))
  }))

  const summary: DashboardSummary = {
    totalCostUSD: 0,
    byDate: {},
    byProject: {},
    byModel: {},
    entries: allEntries,
  }

  for (const e of allEntries) {
    summary.totalCostUSD += e.costUSD
    summary.byDate[e.date] = (summary.byDate[e.date] ?? 0) + e.costUSD
    summary.byProject[e.projectPath] = (summary.byProject[e.projectPath] ?? 0) + e.costUSD
    summary.byModel[e.model] = (summary.byModel[e.model] ?? 0) + e.costUSD
  }

  return summary
}
