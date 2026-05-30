# Claude Code Desktop 类似产品 — 完整开发文档

> 基于对 cc-haha 项目的完整分析，指导从零实现一个类似的 AI Coding Agent 桌面客户端。

---

## 目录

1. [产品定义与整体架构](#1-产品定义与整体架构)
2. [技术选型](#2-技术选型)
3. [后端详细设计](#3-后端详细设计)
4. [前端 UI/UX 详细设计](#4-前端-uiux-详细设计)
5. [聊天消息系统设计](#5-聊天消息系统设计)
6. [开发阶段规划](#6-开发阶段规划)

---

## 1. 产品定义与整体架构

### 1.1 产品定位

一个本地桌面 AI Coding Agent 客户端，核心价值：

- 给 Claude Code CLI（或任何 AI Agent CLI）提供图形界面
- 多会话管理，按项目组织
- 完整的 Agent 交互体验（工具调用可视化、权限确认、思考过程展示）
- 内嵌终端
- 计划任务、MCP 配置、多 Provider 支持

### 1.2 整体架构

```
┌─────────────────────────────────────────────────────┐
│                   桌面应用（Tauri）                    │
│  ┌─────────────────────────────────────────────────┐ │
│  │              React 前端 (WebView)                │ │
│  │  Sidebar │ TabBar │ ChatView │ Settings │ Terminal│ │
│  └──────────────────┬──────────────────────────────┘ │
│                     │ HTTP REST + WebSocket           │
│  ┌──────────────────▼──────────────────────────────┐ │
│  │           本地后端服务 (Bun/Node)                 │ │
│  │  Sessions │ Chat │ MCP │ Providers │ Tasks       │ │
│  └──────────────────┬──────────────────────────────┘ │
│                     │ spawn / IPC                     │
│  ┌──────────────────▼──────────────────────────────┐ │
│  │           AI Agent 进程 (Claude Code CLI)        │ │
│  └─────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────┘
```

**关键设计原则：**
- 前端不直接调用 AI API，全部通过本地后端代理
- 本地后端负责管理 Agent 进程生命周期
- WebSocket 负责实时流式消息推送
- Tauri 提供原生能力（文件对话框、系统通知、自动更新）

### 1.3 数据流

```
用户输入
  → 前端 ChatInput
  → WebSocket send_message
  → 后端 WS Handler
  → AgentRunner.send(message)
  → Claude Code CLI (stdin)
  → CLI 输出 NDJSON 流
  → AgentOutputParser
  → 后端广播 WS 事件
  → 前端 chatStore 更新
  → React 重渲染消息列表
```

---

## 2. 技术选型

### 2.1 技术栈

| 层 | 选型 | 理由 |
|---|---|---|
| 桌面框架 | **Tauri 2** | 包体积小、内存低、原生集成好 |
| 前端框架 | **React 18** + TypeScript | 生态成熟、并发特性适合流式渲染 |
| 构建工具 | **Vite 6** | 极快的 HMR |
| 样式 | **Tailwind CSS v4** | 原子化、设计 token 支持好 |
| 状态管理 | **Zustand** | 轻量、无 boilerplate |
| 后端运行时 | **Bun** | 比 Node 快、原生 TypeScript |
| 数据库 | **SQLite**（Bun 内置） | 本地持久化，无需外部依赖 |
| 实时通信 | **WebSocket**（ws 库） | 流式消息推送 |
| Markdown | **marked** + **shiki**（代码高亮） | 性能好 |
| 图表 | **mermaid** | 懒加载，避免包体积膨胀 |
| 数学公式 | **KaTeX** | 轻量 |
| 终端 | **xterm.js** + @xterm/addon-fit | 业界标准 |
| 图标 | **lucide-react** + Material Symbols | 统一风格 |
| 测试 | **Vitest** + Testing Library | 与 Vite 生态一致 |

### 2.2 项目结构

```
project-root/
├── src/                        # 后端（Bun）
│   ├── server/
│   │   ├── index.ts            # 入口，启动 HTTP + WS 服务
│   │   ├── routes/             # REST 路由处理器
│   │   │   ├── sessions.ts
│   │   │   ├── providers.ts
│   │   │   ├── mcp.ts
│   │   │   ├── tasks.ts
│   │   │   └── settings.ts
│   │   └── ws/
│   │       ├── handler.ts      # WS 连接管理
│   │       └── broadcaster.ts  # 事件广播
│   ├── agent/
│   │   ├── runner.ts           # Agent 进程生命周期
│   │   ├── parser.ts           # NDJSON 输出解析
│   │   └── protocol.ts         # 事件类型定义
│   ├── sessions/
│   │   ├── store.ts            # 会话 CRUD
│   │   └── checkpoint.ts       # Turn checkpoint / Rewind
│   ├── providers/
│   │   └── store.ts            # Provider 配置管理
│   ├── mcp/
│   │   └── manager.ts          # MCP 服务器管理
│   ├── tasks/
│   │   ├── scheduler.ts        # Cron 调度
│   │   └── store.ts
│   └── db/
│       ├── index.ts            # SQLite 连接
│       └── schema.ts           # 建表 SQL
├── desktop/                    # 前端（React + Tauri）
│   ├── src/
│   │   ├── api/                # HTTP/WS 客户端封装
│   │   ├── stores/             # Zustand stores
│   │   ├── components/
│   │   │   ├── chat/           # 聊天相关组件
│   │   │   ├── layout/         # 布局组件
│   │   │   ├── controls/       # 控件（ModelSelector 等）
│   │   │   ├── settings/       # 设置页组件
│   │   │   ├── tasks/          # 计划任务组件
│   │   │   └── shared/         # 通用组件
│   │   ├── pages/              # 页面级组件
│   │   ├── hooks/              # 自定义 hooks
│   │   ├── i18n/               # 国际化
│   │   └── types/              # TypeScript 类型定义
│   ├── src-tauri/              # Rust/Tauri 配置
│   │   ├── src/main.rs
│   │   └── tauri.conf.json
│   └── package.json
└── adapters/                   # IM 适配器（可选扩展）
    ├── telegram/
    ├── feishu/
    └── common/
```

### 2.3 Zustand Store 划分

| Store | 职责 |
|---|---|
| `tabStore` | 标签页状态（打开/关闭/切换） |
| `sessionStore` | 会话列表（来自服务器，定期刷新） |
| `chatStore` | 实时聊天状态（WS 连接、消息流） |
| `settingsStore` | 应用配置（来自服务器） |
| `uiStore` | 纯 UI 状态（侧边栏开关、Toast、弹窗） |
| `openTargetStore` | 外部打开目标（Finder、编辑器等） |
| `workspaceChatContextStore` | 聊天引用上下文（选中文字引用） |
| `teamStore` | 团队/成员会话（多人协作） |

---

## 3. 后端详细设计

### 3.1 数据库 Schema

```sql
CREATE TABLE sessions (
  id            TEXT PRIMARY KEY,
  title         TEXT NOT NULL DEFAULT '',
  work_dir      TEXT,
  project_root  TEXT,
  created_at    TEXT NOT NULL,
  modified_at   TEXT NOT NULL,
  message_count INTEGER DEFAULT 0,
  metadata      TEXT DEFAULT '{}'
);

CREATE TABLE messages (
  id                 TEXT PRIMARY KEY,
  session_id         TEXT NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
  type               TEXT NOT NULL,
  role               TEXT,
  content            TEXT,
  tool_use_id        TEXT,
  tool_name          TEXT,
  parent_tool_use_id TEXT,
  sequence           INTEGER NOT NULL,
  created_at         TEXT NOT NULL,
  metadata           TEXT DEFAULT '{}'
);
CREATE INDEX idx_messages_session ON messages(session_id, sequence);

CREATE TABLE providers (
  id         TEXT PRIMARY KEY,
  name       TEXT NOT NULL,
  type       TEXT NOT NULL,
  api_key    TEXT,
  base_url   TEXT,
  model      TEXT,
  is_default INTEGER DEFAULT 0,
  config     TEXT DEFAULT '{}'
);

CREATE TABLE scheduled_tasks (
  id          TEXT PRIMARY KEY,
  name        TEXT NOT NULL,
  prompt      TEXT NOT NULL,
  cron        TEXT NOT NULL,
  work_dir    TEXT,
  provider_id TEXT,
  enabled     INTEGER DEFAULT 1,
  last_run_at TEXT,
  next_run_at TEXT,
  created_at  TEXT NOT NULL
);

CREATE TABLE task_runs (
  id          TEXT PRIMARY KEY,
  task_id     TEXT NOT NULL REFERENCES scheduled_tasks(id),
  session_id  TEXT,
  status      TEXT NOT NULL,
  started_at  TEXT NOT NULL,
  finished_at TEXT,
  error       TEXT
);

CREATE TABLE turn_checkpoints (
  id                 TEXT PRIMARY KEY,
  session_id         TEXT NOT NULL,
  user_message_id    TEXT NOT NULL,
  user_message_index INTEGER NOT NULL,
  files_changed      TEXT NOT NULL,
  git_stash_ref      TEXT,
  work_dir           TEXT,
  created_at         TEXT NOT NULL
);
```

### 3.2 REST API

```
# Sessions
GET    /api/sessions
POST   /api/sessions                    { workDir? }
GET    /api/sessions/:id
PATCH  /api/sessions/:id                { title?, workDir? }
DELETE /api/sessions/:id
DELETE /api/sessions                    { ids: string[] }

GET    /api/sessions/:id/messages
POST   /api/sessions/:id/stop
POST   /api/sessions/:id/reload
POST   /api/sessions/:id/branch         { transcriptMessageId }
POST   /api/sessions/:id/rewind         { targetUserMessageId, userMessageIndex, expectedContent }
GET    /api/sessions/:id/checkpoints
GET    /api/sessions/:id/workspace

# Providers
GET/POST     /api/providers
PATCH/DELETE /api/providers/:id
GET          /api/providers/:id/models
POST         /api/providers/test

# MCP
GET/POST     /api/mcp/servers
PATCH/DELETE /api/mcp/servers/:id
POST         /api/mcp/servers/:id/restart
GET          /api/mcp/servers/:id/tools

# Settings
GET/PATCH    /api/settings
GET/PATCH    /api/settings/ui-preferences

# Scheduled Tasks
GET/POST     /api/tasks
PATCH/DELETE /api/tasks/:id
POST         /api/tasks/:id/run
GET          /api/tasks/:id/runs

# 其他
GET  /api/models
GET  /api/search?q=&type=
GET  /api/diagnostics
GET  /api/filesystem/browse?path=
POST /api/filesystem/open
```

### 3.3 WebSocket 协议

**连接：** `ws://localhost:PORT/ws?sessionId=<id>`

**客户端 → 服务端：**

```typescript
{ type: 'send_message', content: string, attachments?: Attachment[] }
{ type: 'stop' }
{ type: 'permission_response', requestId: string, decision: 'allow' | 'deny' | 'allow_session' }
{ type: 'ask_user_response', toolUseId: string, answer: string | string[] }
```

**服务端 → 客户端：**

```typescript
{ type: 'connected', sessionId: string, chatState: ChatState }
{ type: 'text_delta', content: string, messageId: string }
{ type: 'thinking_delta', content: string, thinkingId: string }
{ type: 'tool_use_start', toolUseId: string, toolName: string, parentToolUseId?: string }
{ type: 'tool_input_delta', toolUseId: string, partialInput: string }
{ type: 'tool_use_complete', toolUseId: string, input: unknown }
{ type: 'tool_result', toolUseId: string, content: unknown, isError: boolean }
{ type: 'permission_request', requestId: string, toolName: string, input: unknown, description?: string }
{ type: 'state_change', chatState: 'idle' | 'streaming' | 'thinking' | 'tool_executing' | 'compacting' }
{ type: 'error', code: string, message: string }
{ type: 'compact_summary', phase: 'compacting' | 'complete', title: string, summary?: string, preTokens?: number, messagesSummarized?: number, trigger: 'auto' | 'manual' }
{ type: 'memory_event', event: 'saved', files: Array<{ path: string; summary?: string }>, message?: string }
{ type: 'background_task', task: BackgroundTask }
{ type: 'goal_event', action: string, objective?: string, status?: string, message?: string }
{ type: 'turn_complete', messageCount: number }
```

### 3.4 Agent 进程管理

```typescript
// src/agent/runner.ts
class AgentRunner {
  private processes = new Map<string, ChildProcess>()

  async start(sessionId: string, opts: {
    workDir: string
    provider: ProviderConfig
    message: string
  }) {
    const proc = spawn('claude', [
      '--output-format', 'stream-json',
      '--no-interactive',
      '--print', opts.message,
    ], {
      cwd: opts.workDir,
      env: { ...process.env, ANTHROPIC_API_KEY: opts.provider.apiKey },
    })

    const parser = new AgentOutputParser()
    proc.stdout.pipe(parser)
    parser.on('event', (event) => {
      broadcast(sessionId, event)
      persist(sessionId, event)
    })
    proc.on('exit', () => {
      broadcast(sessionId, { type: 'state_change', chatState: 'idle' })
      this.processes.delete(sessionId)
    })

    this.processes.set(sessionId, proc)
    broadcast(sessionId, { type: 'state_change', chatState: 'streaming' })
  }

  stop(sessionId: string) {
    this.processes.get(sessionId)?.kill('SIGTERM')
  }
}
```

### 3.5 NDJSON 输出解析

```typescript
// src/agent/parser.ts
class AgentOutputParser extends Transform {
  private buffer = ''

  _transform(chunk: Buffer, _: string, cb: () => void) {
    this.buffer += chunk.toString()
    const lines = this.buffer.split('\n')
    this.buffer = lines.pop() ?? ''
    for (const line of lines) {
      if (!line.trim()) continue
      try { this.emit('event', this.normalize(JSON.parse(line))) } catch {}
    }
    cb()
  }

  // 将 CLI 原始输出映射为统一 AgentEvent 格式
  private normalize(raw: Record<string, unknown>): AgentEvent {
    switch (raw.type) {
      case 'assistant': return this.parseAssistantBlock(raw)
      case 'tool_result': return {
        type: 'tool_result',
        toolUseId: raw.tool_use_id as string,
        content: raw.content,
        isError: Boolean(raw.is_error),
      }
      default: return { type: 'unknown', raw }
    }
  }
}
```

### 3.6 Turn Checkpoint 与 Rewind

```typescript
// 每轮 turn_complete 后调用
async function createCheckpoint(sessionId: string, userMessageId: string, index: number, workDir: string) {
  if (!await isGitRepo(workDir)) return
  const changed = await exec('git diff --name-only HEAD', { cwd: workDir })
  if (!changed.trim()) return
  db.run('INSERT INTO turn_checkpoints VALUES (?,?,?,?,?,?,?,?)', [
    uuid(), sessionId, userMessageId, index,
    JSON.stringify(changed.trim().split('\n')), null, workDir, now(),
  ])
}

// Rewind 到某轮
async function rewind(sessionId: string, targetUserMessageId: string) {
  agentRunner.stop(sessionId)
  db.run(
    'DELETE FROM messages WHERE session_id=? AND sequence > (SELECT sequence FROM messages WHERE id=?)',
    [sessionId, targetUserMessageId],
  )
  const cp = getCheckpoint(sessionId, targetUserMessageId)
  if (cp?.workDir) await exec('git checkout HEAD -- .', { cwd: cp.workDir })
  return { content: getUserMessageContent(targetUserMessageId) }
}
```

### 3.7 服务启动

```typescript
// src/server/index.ts
Bun.serve({
  port: process.env.SERVER_PORT ?? 3456,
  fetch(req, server) {
    if (req.headers.get('upgrade') === 'websocket') {
      const sessionId = new URL(req.url).searchParams.get('sessionId')
      if (server.upgrade(req, { data: { sessionId } })) return
    }
    return router.handle(req)
  },
  websocket: wsHandler,
})

---

## 4. 前端 UI/UX 详细设计

### 4.1 设计 Token

```css
:root {
  /* 颜色 */
  --color-surface: #ffffff;
  --color-surface-sidebar: #f8f8f8;
  --color-surface-container-low: #f4f4f5;
  --color-surface-container-lowest: #fafafa;
  --color-surface-hover: rgba(0,0,0,0.04);
  --color-border: rgba(0,0,0,0.10);
  --color-border-focus: #6366f1;

  --color-text-primary: #111827;
  --color-text-secondary: #6b7280;
  --color-text-tertiary: #9ca3af;

  --color-brand: #6366f1;
  --color-primary-container: #a5b4fc;
  --color-success: #22c55e;
  --color-error: #ef4444;
  --color-error-container: #fef2f2;
  --color-warning: #f59e0b;
  --color-accent: #8b5cf6;

  --color-sidebar-item-hover: rgba(0,0,0,0.05);
  --color-sidebar-item-active: rgba(99,102,241,0.10);
  --color-sidebar-search-bg: rgba(0,0,0,0.04);
  --color-sidebar-search-border: rgba(0,0,0,0.08);

  --color-code-bg: #f8fafc;
  --color-code-fg: #1e293b;
  --color-terminal-fg: #e2e8f0;
  --color-terminal-bg: #0f172a;
  --color-terminal-accent: #4ade80;

  --color-memory-surface: #fefce8;
  --color-memory-border: #fde68a;
  --color-memory-accent: #d97706;

  --radius-sm: 6px;
  --radius-md: 10px;
  --radius-lg: 14px;

  --font-sans: 'Inter', system-ui, sans-serif;
  --font-mono: 'JetBrains Mono', 'Fira Code', monospace;
  --font-headline: 'Manrope', 'Inter', sans-serif;

  --shadow-dropdown: 0 8px 24px rgba(0,0,0,0.12), 0 2px 6px rgba(0,0,0,0.06);
}

[data-theme="dark"] {
  --color-surface: #1a1a1a;
  --color-surface-sidebar: #141414;
  --color-surface-container-low: #222222;
  --color-surface-container-lowest: #1e1e1e;
  --color-surface-hover: rgba(255,255,255,0.05);
  --color-border: rgba(255,255,255,0.10);
  --color-text-primary: #f1f5f9;
  --color-text-secondary: #94a3b8;
  --color-text-tertiary: #64748b;
  --color-code-bg: #0d1117;
  --color-code-fg: #e6edf3;
  --color-memory-surface: #1c1a0a;
  --color-memory-border: #44380a;
}
```

### 4.2 整体布局

```
┌──────────────────────────────────────────────────────────────┐
│  TitleBar（macOS 留出 traffic lights 空间 pt-[44px]）         │
├──────────┬───────────────────────────────────────────────────┤
│          │  TabBar（多标签页，可关闭，运行中显示绿色脉冲点）   │
│ Sidebar  ├───────────────────────────────────────────────────┤
│          │                                                   │
│ 240px    │           ContentRouter                          │
│ 可折叠   │   ActiveSession / Settings / ScheduledTasks /    │
│ 至 56px  │   Terminal / EmptySession                        │
│          │                                                   │
│ [⚙设置]  │                                                   │
└──────────┴───────────────────────────────────────────────────┘
```

**Sidebar 折叠：**
- 展开 240px：图标 + 文字
- 折叠 56px：仅图标，hover 显示 tooltip
- 动画：`transition: width 200ms ease`，文字用 `opacity + max-width` 过渡

**TabBar：**
- 每个 tab：图标 + 标题（截断）+ 关闭按钮（hover 显示）
- 运行中 session：标题左侧绿色脉冲点 `animate-pulse`
- 右键菜单：关闭、关闭其他、关闭全部

### 4.3 Sidebar 详细

```
┌─────────────────────────────┐
│ [🤖] Claude Code  [GH] [←] │  Logo + GitHub + 折叠按钮
├─────────────────────────────┤
│ [+] New Session             │
│ [⏰] Scheduled              │
├─────────────────────────────┤
│ [🔍 Search...] [↻] [☰]     │  搜索 + 刷新 + 批量管理
├─────────────────────────────┤
│ PROJECTS          [⋯] [📁+] │
│                             │
│ ▼ 📁 my-project  [📌][⋯]   │  可折叠，可拖拽排序
│   ● session-1    2m ago     │  ● = 运行中（绿色转圈）
│   ○ session-2    1h ago     │
│   ○ session-3    2d ago     │
│   [Show 3 more]             │  超过6个折叠
│                             │
│ ▶ 📁 another-project        │  折叠状态
├─────────────────────────────┤
│ [⚙] Settings                │  底部固定
└─────────────────────────────┘
```

**交互细节：**
- 项目组拖拽排序：拖拽时显示蓝色插入线（`h-0.5 bg-brand`）
- 右键项目组菜单：置顶/取消置顶、在 Finder 打开、隐藏
- 右键会话菜单：重命名（inline input）、删除（确认弹窗）
- 批量模式：checkbox 多选，Shift+Click 范围选，Ctrl+A 全选，批量删除

### 4.4 ActiveSession 页面

```
┌─────────────────────────────────────────────────────┐
│  SessionTaskBar                                     │
│  [模型选择▾] [权限模式▾]  [████░░ 45k/200k]  [■停止] │
├─────────────────────────────────────────────────────┤
│                                                     │
│  MessageList（虚拟滚动，max-width: 860px 居中）       │
│                                                     │
│                              [↓ Jump to Latest]    │
├─────────────────────────────────────────────────────┤
│  ChatInput                                          │
│  ┌───────────────────────────────────────────────┐ │
│  │ [🖼 img.png ×]  [📄 file.ts ×]               │ │  附件预览
│  ├───────────────────────────────────────────────┤ │
│  │                                               │ │
│  │  输入消息...（自动增高，最大 40vh）             │ │
│  │                                               │ │
│  ├───────────────────────────────────────────────┤ │
│  │ [📎] [@文件] [/命令]            [发送 ⏎]      │ │
│  └───────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────┘
```

**ChatInput 交互：**
- `Enter` 发送，`Shift+Enter` 换行
- `/` 触发 Slash 命令浮层（键盘上下导航，Enter 选中）
- `@` 触发文件搜索浮层（模糊搜索工作目录文件）
- 拖拽/粘贴图片自动添加附件
- 生成中：发送按钮变为「■ 停止」

**Slash 命令面板（浮层，输入框上方）：**
```
┌─────────────────────────────┐
│ /compact    压缩上下文       │  ← 高亮选中项
│ /clear      清空对话         │
│ /model      切换模型         │
│ /help       帮助             │
└─────────────────────────────┘
```

**文件搜索面板（@ 触发）：**
```
┌─────────────────────────────┐
│ 🔍 src/components/          │
│ 📄 src/App.tsx              │
│ 📄 src/index.ts             │
│ 📁 src/utils/               │
└─────────────────────────────┘
```

### 4.5 Settings 页面结构

```
Settings
├── General（主题、语言、字体大小）
├── Providers（API Key、模型配置）
├── Models（默认模型、参数）
├── MCP Servers（添加/管理 MCP 服务器）
├── Skills（自定义 Slash 命令）
├── Plugins（插件管理）
├── Memory（Memory 文件管理）
├── Terminal（终端字体、颜色）
├── About（版本、更新）
└── Doctor（系统诊断）
```

### 4.6 计划任务页面

```
┌─────────────────────────────────────────────────────┐
│  Scheduled Tasks                    [+ New Task]    │
├─────────────────────────────────────────────────────┤
│  ┌─────────────────────────────────────────────┐   │
│  │ ● Daily Code Review          每天 09:00      │   │
│  │   上次运行: 2h ago  下次: 明天 09:00  [▶][✏][🗑]│   │
│  └─────────────────────────────────────────────┘   │
│  ┌─────────────────────────────────────────────┐   │
│  │ ○ Weekly Summary             每周一 10:00    │   │
│  │   已禁用                              [✏][🗑] │   │
│  └─────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────┘
```

**New Task 弹窗：**
```
┌─────────────────────────────────────────────────────┐
│  New Scheduled Task                            [×]  │
├─────────────────────────────────────────────────────┤
│  Name:    [Daily Review                        ]    │
│  Prompt:  [Review today's code changes and...  ]    │
│           [                                    ]    │
│  Schedule: [每天▾] [09] : [00]                      │
│            ☑Mon ☑Tue ☑Wed ☑Thu ☑Fri ☐Sat ☐Sun      │
│  Work Dir: [/Users/me/project          ] [Browse]   │
│  Provider: [Claude Opus 4 ▾]                        │
├─────────────────────────────────────────────────────┤
│                              [Cancel]  [Create]     │
└─────────────────────────────────────────────────────┘
```

---

## 5. 聊天消息系统设计

### 5.1 UIMessage 类型定义

```typescript
type UIMessage =
  | { type: 'user_text'; id: string; content: string; pending?: boolean; transcriptMessageId?: string; modelContent?: string; attachments?: Attachment[] }
  | { type: 'assistant_text'; id: string; content: string; transcriptMessageId?: string }
  | { type: 'thinking'; id: string; content: string }
  | { type: 'tool_use'; id: string; toolUseId: string; toolName: string; input: unknown; isPending?: boolean; partialInput?: string; parentToolUseId?: string }
  | { type: 'tool_result'; id: string; toolUseId: string; content: unknown; isError: boolean; parentToolUseId?: string }
  | { type: 'permission_request'; id: string; requestId: string; toolName: string; input: unknown; description?: string; toolUseId?: string }
  | { type: 'error'; id: string; code?: string; message: string }
  | { type: 'task_summary'; id: string; tasks: TaskItem[] }
  | { type: 'memory_event'; id: string; event: string; files: Array<{ path: string; summary?: string }>; message?: string }
  | { type: 'compact_summary'; id: string; phase?: string; title: string; summary?: string; preTokens?: number; messagesSummarized?: number; trigger?: 'auto' | 'manual' }
  | { type: 'goal_event'; id: string; action: string; objective?: string; status?: string; message?: string; budget?: string; continuations?: string }
  | { type: 'background_task'; id: string; task: BackgroundTask }
  | { type: 'system'; id: string; content: string }
```

### 5.2 每种消息的渲染规范

#### user_text — 用户消息

```
位置：右对齐
最大宽度：80%
背景：var(--color-brand)/10（淡紫色）
圆角：rounded-[20px] rounded-tr-[8px]（右上角小圆角）
内边距：px-4 py-3
字体：text-sm，行高 1.6

图片附件：2列网格缩略图，点击全屏查看
文件附件：文件名 + 图标 chip

底部操作栏（hover 显示）：[复制] [从此分支]
选中文字时：浮动「💬 Add to chat」圆形按钮
```

#### assistant_text — AI 回复

```
位置：左对齐
布局自动切换（任一条件满足则用 document 模式）：
  bubble 模式：最大宽度 72%（短回复）
  document 模式：全宽（含代码块/标题/列表/多段落）
    触发条件：含 ``` | 含 # - > | | | 段落≥2 | 非空行≥8

背景：var(--color-surface)，细边框 + 轻阴影
圆角：rounded-[20px] rounded-tl-[8px]

内容渲染：MarkdownRenderer
  - 代码块：shiki 语法高亮 + 复制按钮 + 语言标签
  - 表格：横向滚动容器
  - 数学公式：KaTeX（$inline$ 和 $$block$$）
  - Mermaid 图表：懒加载渲染
  - 图片：InlineImageGallery（识别 markdown 图片 URL）

流式输出：末尾闪烁光标 animate-shimmer
底部操作栏（hover）：[复制] [从此分支]
```

#### thinking — 思考块

```
样式：可折叠卡片，默认折叠
图标：脑袋/思考图标
活跃时（isActive）：标题显示转圈动画
内容：纯文本，等宽字体，不走 Markdown
```

#### tool_use — 工具调用

```
容器：圆角卡片，细边框，bg-surface-container-lowest
标题行（可点击展开）：
  [图标] [工具名] [摘要/文件名]    [状态] [展开▾]

工具图标映射：
  Bash→terminal  Read→description  Write→edit_document
  Edit→edit_note  Glob→search  Grep→find_in_page
  Agent→smart_toy  WebSearch→travel_explore  WebFetch→cloud_download

状态显示：
  isPending + 无结果：转圈 + "Generating..." / "Preparing..."
  有结果 + 无错误：结果摘要文字（灰色）
  有结果 + 有错误：错误首行（红色）+ error 图标

展开后内容（根据工具类型）：
  Edit/Write  → DiffViewer（diff 对比，红绿高亮）
  Bash        → TerminalChrome（终端样式，$ command）
  其他工具    → CodeViewer（JSON input，最多18行）
  有结果时    → 工具输出（CodeViewer，最多18行）+ 复制按钮

多工具分组（ToolCallGroup）：
  - 连续的非 Agent 工具合并为一组，可整体折叠
  - Agent 工具单独一组
  - 子工具调用（parentToolUseId）嵌套在父工具内
```

#### AskUserQuestion — AI 主动提问

```
样式：交互式卡片（特殊的 tool_use）
显示：问题文本 + 选项按钮列表
  单选：radio 样式按钮
  多选：checkbox 样式按钮 + 确认按钮
已回答：显示用户选择，变为只读
```

#### permission_request — 权限请求

```
样式：内联对话框，黄色/橙色边框
显示：工具名 + 操作描述 + 输入参数预览
按钮：[拒绝] [本次允许] [始终允许]
```

#### error — 错误消息

```
样式：红色边框卡片
  border-[var(--color-error)]/20
  bg-[var(--color-error-container)]/28
内容：Error: <message>
有 i18n 错误码映射
```

#### task_summary — 任务进度

```
样式：紧凑列表
每项：状态图标 + 描述文字
  pending：灰色圆圈
  in_progress：蓝色转圈
  completed：绿色勾
```

#### memory_event — Memory 保存

```
样式：居中卡片，书签图标，黄色调
显示：保存的文件名列表（最多3个，超出 +N）
按钮：[Open Settings] 跳转 Memory 设置
```

#### compact_summary — 上下文压缩分割线

```
样式：横跨全宽分割线，中间文字标签
compacting 状态：转圈动画
complete 状态：FileStack 图标
可展开查看：触发方式、压缩前 token 数、压缩消息数、摘要文本
```

#### goal_event — 目标卡片

```
样式：可折叠卡片，Target 图标，紫色调
显示：objective 或 message
元数据 chip：status、budget、continuations
```

#### background_task — 后台任务

```
样式：小型状态卡片
左侧状态图标：
  running  → 转圈（accent 色）
  failed   → XCircle（红色）
  stopped  → CircleStop（灰色）
  success  → CheckCircle2（绿色）
显示：任务类型 + 状态 + token 数 + 耗时
注意：Agent 类型的 background_task 过滤不显示
```

#### system — 系统消息

```
样式：居中小字，text-xs text-tertiary，无装饰
```

### 5.3 消息列表特殊 UI

| 元素 | 触发条件 | 样式 |
|---|---|---|
| StreamingIndicator | tool_executing 或 thinking（无 ThinkingBlock） | 三个跳动的点 |
| 流式光标 | assistant_text 流式输出中 | 末尾闪烁竖线 animate-shimmer |
| CompactStatusDivider compacting | chatState === 'compacting' | 转圈分割线 |
| CurrentTurnChangeCard | 每轮结束后有代码变更 | 文件变更列表 + Undo 按钮 |
| Jump to Latest 按钮 | 用户向上滚动离开底部 | 右下角浮动按钮 |
| 选中文字浮动菜单 | 选中 user/assistant 消息文字 | 「💬 Add to chat」圆形按钮 |

### 5.4 虚拟滚动

```typescript
// 触发条件（任一满足）
const shouldVirtualize =
  renderItems.length >= 120 ||
  totalContentChars >= 120_000

// 参数
const OVERSCAN_PX = 1200          // 上下各保留 1200px 缓冲
const MIN_ITEM_HEIGHT = 48
const MAX_ITEM_HEIGHT = 24_000

// 高度估算（未测量前）
function estimateHeight(message: UIMessage): number {
  switch (message.type) {
    case 'user_text': return estimateTextHeight(message.content, 74)
    case 'assistant_text': return estimateTextHeight(message.content, 96)
    case 'thinking': return estimateTextHeight(message.content, 88)
    case 'tool_use': return clamp(92 + contentWeight / 120 * 18, 72, 2200)
    default: return 110
  }
}

// 用 ResizeObserver 测量真实高度并缓存
// 跨 session 切换时保存/恢复滚动位置
```

### 5.5 渲染模型构建（buildRenderModel）

```
输入：UIMessage[]
输出：RenderItem[]（tool_group | message）

规则：
1. 空白 assistant_text 跳过
2. Agent 类型 background_task 跳过
3. tool_result（有对应 tool_use）跳过（附在 tool_use 上显示）
4. 子工具调用（有 parentToolUseId）嵌套在父工具内
5. 连续的非 Agent tool_use 合并为 tool_group
6. Agent tool_use 单独一个 tool_group
7. AskUserQuestion 特殊处理：只显示最新未回答的那个
```

---

## 6. 开发阶段规划

### Phase 1 — 骨架（1-2周）

- [ ] Tauri 2 + React + Vite 项目初始化
- [ ] 本地后端服务（HTTP + WebSocket）
- [ ] SQLite 数据库 + 基础 Schema
- [ ] AppShell 布局（Sidebar + TabBar + ContentRouter）
- [ ] Zustand stores 骨架
- [ ] WebSocket 客户端连接

### Phase 2 — 会话核心（2-3周）

- [ ] Session CRUD API + 前端 sessionStore
- [ ] ChatInput（文本输入、发送、停止）
- [ ] MessageList（基础渲染，无虚拟滚动）
- [ ] user_text + assistant_text 消息渲染
- [ ] 流式文本更新（text_delta）
- [ ] 侧边栏会话列表（按项目分组）

### Phase 3 — Agent 交互（2周）

- [ ] thinking 块渲染
- [ ] tool_use / tool_result 渲染（ToolCallBlock）
- [ ] ToolCallGroup（多工具分组）
- [ ] permission_request 权限对话框
- [ ] AskUserQuestion 交互组件
- [ ] StreamingIndicator
- [ ] error 消息渲染

### Phase 4 — 富文本（1-2周）

- [ ] MarkdownRenderer（marked + shiki）
- [ ] DiffViewer（Edit/Write 工具预览）
- [ ] Mermaid 图表（懒加载）
- [ ] KaTeX 数学公式
- [ ] 图片附件上传 + InlineImageGallery
- [ ] 文件拖拽上传
- [ ] Context 用量指示器

### Phase 5 — 终端与高级消息（1周）

- [ ] xterm.js 终端集成（TerminalSettings）
- [ ] memory_event 卡片
- [ ] compact_summary 分割线
- [ ] goal_event 卡片
- [ ] background_task 卡片
- [ ] task_summary 进度列表

### Phase 6 — 虚拟滚动与性能（1周）

- [ ] 虚拟滚动（buildVirtualTranscriptWindow）
- [ ] ResizeObserver 高度测量缓存
- [ ] 跨 session 滚动位置保存/恢复
- [ ] Jump to Latest 按钮
- [ ] 选中文字「Add to chat」浮动菜单

### Phase 7 — 设置与配置（1-2周）

- [ ] 模型/Provider 选择器
- [ ] MCP 服务器配置 UI
- [ ] Skills 管理
- [ ] OAuth 登录（Claude / OpenAI）
- [ ] 诊断面板（Doctor）
- [ ] 主题切换（亮/暗）

### Phase 8 — 高级功能（2周）

- [ ] 计划任务系统（Cron + 桌面通知）
- [ ] Turn Checkpoint + Rewind（Undo 功能）
- [ ] Session Branch（从某条消息分支）
- [ ] 批量会话管理
- [ ] 项目拖拽排序 + 置顶/隐藏
- [ ] 键盘快捷键系统
- [ ] 自动更新（Tauri updater）
- [ ] i18n 国际化
- [ ] H5 模式（浏览器直连本地服务）

---

*文档基于 cc-haha v0.3.1 源码分析，2026-05-30*
