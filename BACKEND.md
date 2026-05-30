# 后端详细设计文档

> 本地 AI Coding Agent 桌面客户端 — 后端完整实现指南

---

## 目录

1. [架构概览](#1-架构概览)
2. [目录结构](#2-目录结构)
3. [数据库设计](#3-数据库设计)
4. [服务入口](#4-服务入口)
5. [Sessions API](#5-sessions-api)
6. [Chat 系统（WebSocket）](#6-chat-系统websocket)
7. [AI Provider 调用层](#7-ai-provider-调用层)
8. [Agent 工具执行层](#8-agent-工具执行层)
9. [Providers API](#9-providers-api)
10. [MCP 服务器管理](#10-mcp-服务器管理)
11. [计划任务系统](#11-计划任务系统)
12. [Settings API](#12-settings-api)
13. [文件系统 API](#13-文件系统-api)
14. [Turn Checkpoint & Rewind](#14-turn-checkpoint--rewind)
15. [错误处理规范](#15-错误处理规范)
16. [安全与加密](#16-安全与加密)

---

## 1. 架构概览

```
前端 (React/Tauri WebView)
        │
        │  HTTP REST  /  WebSocket
        ▼
┌─────────────────────────────────────────────────────┐
│                  本地后端服务 (Bun)                   │
│                                                     │
│  ┌──────────┐  ┌──────────┐  ┌──────────────────┐  │
│  │  Router  │  │ WS Hub   │  │  Scheduler       │  │
│  │ (HTTP)   │  │(实时推送) │  │  (Cron Tasks)    │  │
│  └────┬─────┘  └────┬─────┘  └────────┬─────────┘  │
│       │              │                 │             │
│  ┌────▼──────────────▼─────────────────▼──────────┐ │
│  │              Service Layer                      │ │
│  │  SessionService │ ChatService │ ProviderService │ │
│  │  McpService     │ TaskService │ SettingsService │ │
│  └────────────────────────┬────────────────────────┘ │
│                           │                          │
│  ┌────────────────────────▼────────────────────────┐ │
│  │              Data Layer                         │ │
│  │  SQLite (sessions/messages/providers/tasks)     │ │
│  └─────────────────────────────────────────────────┘ │
│                           │                          │
│  ┌────────────────────────▼────────────────────────┐ │
│  │           AI Provider Adapters                  │ │
│  │  AnthropicAdapter │ OpenAIAdapter │ CustomAdapter│ │
│  └─────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────┘
```

**核心设计决策：**
- 后端是纯本地服务，监听 `localhost:3456`，不对外暴露
- 所有 AI 调用通过 Provider Adapter 层，支持多 provider 切换
- WebSocket 连接与 session 绑定，一个 session 可有多个 WS 客户端（多窗口）
- 消息持久化到 SQLite，重启后可恢复历史
- Agent 工具（Bash/Read/Write 等）在后端执行，结果通过 WS 推送给前端

---

## 2. 目录结构

```
src/
├── server/
│   ├── index.ts              # 服务入口，启动 HTTP + WS
│   ├── router.ts             # HTTP 路由注册
│   └── middleware.ts         # CORS、错误处理、日志
│
├── ws/
│   ├── hub.ts                # WS 连接池管理
│   ├── handler.ts            # WS 消息分发
│   └── types.ts              # WS 消息类型定义
│
├── services/
│   ├── session.service.ts    # 会话 CRUD
│   ├── chat.service.ts       # 聊天核心逻辑（AI调用+工具执行）
│   ├── provider.service.ts   # Provider 配置管理
│   ├── mcp.service.ts        # MCP 服务器管理
│   ├── task.service.ts       # 计划任务
│   ├── settings.service.ts   # 应用设置
│   └── checkpoint.service.ts # Turn checkpoint / Rewind
│
├── providers/
│   ├── base.ts               # Provider 基类/接口
│   ├── anthropic.ts          # Anthropic SDK 适配
│   ├── openai.ts             # OpenAI SDK 适配
│   └── registry.ts           # Provider 注册表
│
├── tools/
│   ├── registry.ts           # 工具注册表
│   ├── bash.ts               # Bash 工具
│   ├── read.ts               # Read 文件工具
│   ├── write.ts              # Write 文件工具
│   ├── edit.ts               # Edit 文件工具
│   ├── glob.ts               # Glob 搜索工具
│   ├── grep.ts               # Grep 搜索工具
│   ├── web-search.ts         # WebSearch 工具
│   └── web-fetch.ts          # WebFetch 工具
│
├── mcp/
│   ├── client.ts             # MCP 客户端
│   └── manager.ts            # MCP 服务器生命周期
│
├── scheduler/
│   ├── cron.ts               # Cron 调度器
│   └── runner.ts             # 任务执行器
│
├── db/
│   ├── index.ts              # SQLite 连接单例
│   ├── schema.ts             # 建表 + 迁移
│   └── migrations/           # 版本迁移文件
│       ├── 001_init.sql
│       └── 002_checkpoints.sql
│
├── routes/
│   ├── sessions.ts
│   ├── chat.ts
│   ├── providers.ts
│   ├── mcp.ts
│   ├── tasks.ts
│   ├── settings.ts
│   ├── filesystem.ts
│   ├── models.ts
│   └── diagnostics.ts
│
└── utils/
    ├── crypto.ts             # API Key 加密/解密
    ├── git.ts                # Git 操作工具
    ├── id.ts                 # UUID 生成
    └── logger.ts             # 日志
```

---

## 3. 数据库设计

### 3.1 完整 Schema

```sql
-- db/schema.ts 中执行

-- ============================================================
-- sessions 表
-- ============================================================
CREATE TABLE IF NOT EXISTS sessions (
  id            TEXT PRIMARY KEY,
  title         TEXT NOT NULL DEFAULT '',
  work_dir      TEXT,                    -- 工作目录（绝对路径）
  project_root  TEXT,                    -- 项目根目录（git root 或 work_dir）
  provider_id   TEXT,                    -- 使用的 provider（NULL = 默认）
  model         TEXT,                    -- 使用的模型（NULL = provider 默认）
  created_at    TEXT NOT NULL,
  modified_at   TEXT NOT NULL,
  message_count INTEGER NOT NULL DEFAULT 0,
  metadata      TEXT NOT NULL DEFAULT '{}'  -- JSON，存扩展字段
);

-- ============================================================
-- messages 表（聊天记录）
-- ============================================================
CREATE TABLE IF NOT EXISTS messages (
  id                 TEXT PRIMARY KEY,
  session_id         TEXT NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
  type               TEXT NOT NULL,
  -- 类型枚举：user_text | assistant_text | thinking | tool_use |
  --           tool_result | permission_request | error | task_summary |
  --           memory_event | compact_summary | goal_event |
  --           background_task | system
  role               TEXT,              -- 'user' | 'assistant' | 'tool'
  content            TEXT,              -- 主要内容（纯文本或 JSON 字符串）
  tool_use_id        TEXT,              -- tool_use/tool_result 关联 ID
  tool_name          TEXT,
  parent_tool_use_id TEXT,              -- 子工具调用的父 ID
  transcript_msg_id  TEXT,              -- 对应 AI API 的原始 message ID
  sequence           INTEGER NOT NULL,  -- 消息顺序（单调递增）
  created_at         TEXT NOT NULL,
  metadata           TEXT NOT NULL DEFAULT '{}'
);

CREATE INDEX IF NOT EXISTS idx_messages_session_seq
  ON messages(session_id, sequence);
CREATE INDEX IF NOT EXISTS idx_messages_tool_use_id
  ON messages(tool_use_id) WHERE tool_use_id IS NOT NULL;

-- ============================================================
-- providers 表
-- ============================================================
CREATE TABLE IF NOT EXISTS providers (
  id            TEXT PRIMARY KEY,
  name          TEXT NOT NULL,
  type          TEXT NOT NULL,          -- 'anthropic' | 'openai' | 'custom'
  api_key_enc   TEXT,                   -- 加密后的 API Key
  base_url      TEXT,                   -- 自定义 base URL
  default_model TEXT,                   -- 默认模型
  is_default    INTEGER NOT NULL DEFAULT 0,  -- 1 = 默认 provider
  enabled       INTEGER NOT NULL DEFAULT 1,
  config        TEXT NOT NULL DEFAULT '{}',  -- JSON 扩展配置
  created_at    TEXT NOT NULL,
  updated_at    TEXT NOT NULL
);

-- ============================================================
-- mcp_servers 表
-- ============================================================
CREATE TABLE IF NOT EXISTS mcp_servers (
  id         TEXT PRIMARY KEY,
  name       TEXT NOT NULL,
  type       TEXT NOT NULL DEFAULT 'stdio',  -- 'stdio' | 'sse' | 'http'
  command    TEXT,                           -- stdio 模式：命令
  args       TEXT NOT NULL DEFAULT '[]',     -- JSON array
  env        TEXT NOT NULL DEFAULT '{}',     -- JSON object
  url        TEXT,                           -- sse/http 模式：URL
  enabled    INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

-- ============================================================
-- scheduled_tasks 表
-- ============================================================
CREATE TABLE IF NOT EXISTS scheduled_tasks (
  id          TEXT PRIMARY KEY,
  name        TEXT NOT NULL,
  description TEXT,
  prompt      TEXT NOT NULL,
  cron        TEXT NOT NULL,             -- 标准 5 字段 cron 表达式
  work_dir    TEXT,
  provider_id TEXT REFERENCES providers(id) ON DELETE SET NULL,
  model       TEXT,
  enabled     INTEGER NOT NULL DEFAULT 1,
  last_run_at TEXT,
  next_run_at TEXT,
  created_at  TEXT NOT NULL,
  updated_at  TEXT NOT NULL
);

-- ============================================================
-- task_runs 表（任务执行记录）
-- ============================================================
CREATE TABLE IF NOT EXISTS task_runs (
  id          TEXT PRIMARY KEY,
  task_id     TEXT NOT NULL REFERENCES scheduled_tasks(id) ON DELETE CASCADE,
  session_id  TEXT REFERENCES sessions(id) ON DELETE SET NULL,
  status      TEXT NOT NULL,            -- 'running' | 'success' | 'failed' | 'stopped'
  started_at  TEXT NOT NULL,
  finished_at TEXT,
  error       TEXT,
  token_usage TEXT                      -- JSON: { inputTokens, outputTokens }
);

CREATE INDEX IF NOT EXISTS idx_task_runs_task_id
  ON task_runs(task_id, started_at DESC);

-- ============================================================
-- turn_checkpoints 表（Rewind 功能）
-- ============================================================
CREATE TABLE IF NOT EXISTS turn_checkpoints (
  id                 TEXT PRIMARY KEY,
  session_id         TEXT NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
  user_message_id    TEXT NOT NULL,
  user_message_index INTEGER NOT NULL,
  files_changed      TEXT NOT NULL DEFAULT '[]',  -- JSON array of file paths
  git_commit_before  TEXT,                        -- rewind 前的 git commit hash
  work_dir           TEXT,
  created_at         TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_checkpoints_session
  ON turn_checkpoints(session_id, user_message_index);

-- ============================================================
-- settings 表（键值对）
-- ============================================================
CREATE TABLE IF NOT EXISTS settings (
  key        TEXT PRIMARY KEY,
  value      TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

-- ============================================================
-- ui_preferences 表（前端 UI 偏好，按用户/设备存储）
-- ============================================================
CREATE TABLE IF NOT EXISTS ui_preferences (
  key        TEXT PRIMARY KEY,
  value      TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
```

### 3.2 数据库连接单例

```typescript
// db/index.ts
import { Database } from 'bun:sqlite'
import { readFileSync } from 'fs'
import { join } from 'path'

const DB_PATH = process.env.DB_PATH
  ?? join(process.env.HOME ?? '.', '.claude', 'cc-haha', 'data.db')

let _db: Database | null = null

export function getDb(): Database {
  if (_db) return _db
  _db = new Database(DB_PATH, { create: true })
  _db.run('PRAGMA journal_mode = WAL')   // 写入性能优化
  _db.run('PRAGMA foreign_keys = ON')    // 启用外键约束
  _db.run('PRAGMA synchronous = NORMAL') // 平衡性能与安全
  runMigrations(_db)
  return _db
}

function runMigrations(db: Database) {
  db.run(`CREATE TABLE IF NOT EXISTS schema_migrations (
    version INTEGER PRIMARY KEY,
    applied_at TEXT NOT NULL
  )`)

  const applied = new Set(
    db.query('SELECT version FROM schema_migrations').all().map((r: any) => r.version)
  )

  const migrations = [
    { version: 1, sql: readFileSync(join(__dirname, 'migrations/001_init.sql'), 'utf8') },
    { version: 2, sql: readFileSync(join(__dirname, 'migrations/002_checkpoints.sql'), 'utf8') },
  ]

  for (const { version, sql } of migrations) {
    if (applied.has(version)) continue
    db.transaction(() => {
      db.run(sql)
      db.run('INSERT INTO schema_migrations VALUES (?, ?)', [version, new Date().toISOString()])
    })()
  }
}
```

---

## 4. 服务入口

```typescript
// server/index.ts
import { getDb } from '../db'
import { router } from './router'
import { wsHub } from '../ws/hub'
import { scheduler } from '../scheduler/cron'

const PORT = Number(process.env.SERVER_PORT ?? 3456)

// 初始化数据库
getDb()

// 启动计划任务调度器
scheduler.start()

const server = Bun.serve({
  port: PORT,
  hostname: '127.0.0.1',  // 只监听本地，不对外暴露

  fetch(req, server) {
    const url = new URL(req.url)

    // CORS 预检
    if (req.method === 'OPTIONS') {
      return new Response(null, { headers: corsHeaders() })
    }

    // WebSocket 升级
    if (req.headers.get('upgrade') === 'websocket') {
      const sessionId = url.searchParams.get('sessionId')
      if (!sessionId) return new Response('Missing sessionId', { status: 400 })
      const ok = server.upgrade(req, { data: { sessionId, connectedAt: Date.now() } })
      return ok ? undefined : new Response('WS upgrade failed', { status: 500 })
    }

    // HTTP 路由
    return router.handle(req).then(addCorsHeaders)
  },

  websocket: {
    open(ws) { wsHub.add(ws) },
    message(ws, data) { wsHub.dispatch(ws, data) },
    close(ws) { wsHub.remove(ws) },
    perMessageDeflate: true,
  },

  error(err) {
    console.error('[server error]', err)
    return new Response('Internal Server Error', { status: 500 })
  },
})

console.log(`[backend] listening on http://127.0.0.1:${PORT}`)

function corsHeaders() {
  return {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET,POST,PATCH,DELETE,OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  }
}

function addCorsHeaders(res: Response): Response {
  const headers = new Headers(res.headers)
  for (const [k, v] of Object.entries(corsHeaders())) headers.set(k, v)
  return new Response(res.body, { status: res.status, headers })
}
```

```typescript
// server/router.ts
import { sessionsRouter } from '../routes/sessions'
import { chatRouter } from '../routes/chat'
import { providersRouter } from '../routes/providers'
import { mcpRouter } from '../routes/mcp'
import { tasksRouter } from '../routes/tasks'
import { settingsRouter } from '../routes/settings'
import { filesystemRouter } from '../routes/filesystem'
import { modelsRouter } from '../routes/models'
import { diagnosticsRouter } from '../routes/diagnostics'

// 极简路由器（不引入框架，保持轻量）
export const router = {
  async handle(req: Request): Promise<Response> {
    const url = new URL(req.url)
    const path = url.pathname
    const method = req.method

    try {
      // Sessions
      if (path.startsWith('/api/sessions')) return sessionsRouter(req, path, method)
      // Chat（stop/reload）
      if (path.startsWith('/api/chat')) return chatRouter(req, path, method)
      // Providers
      if (path.startsWith('/api/providers')) return providersRouter(req, path, method)
      // MCP
      if (path.startsWith('/api/mcp')) return mcpRouter(req, path, method)
      // Tasks
      if (path.startsWith('/api/tasks')) return tasksRouter(req, path, method)
      // Settings
      if (path.startsWith('/api/settings')) return settingsRouter(req, path, method)
      // Filesystem
      if (path.startsWith('/api/filesystem')) return filesystemRouter(req, path, method)
      // Models
      if (path === '/api/models') return modelsRouter(req)
      // Diagnostics
      if (path === '/api/diagnostics') return diagnosticsRouter(req)

      return json({ error: 'Not Found' }, 404)
    } catch (err) {
      console.error('[router]', err)
      return json({ error: err instanceof Error ? err.message : 'Internal error' }, 500)
    }
  },
}

export function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}
```
