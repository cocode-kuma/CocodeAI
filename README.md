<div align="center">

```
   ______                      __         ___    ____
  / ____/____  _________  ____/ /__      /   |  /  _/
 / /    / __ \/ ___/ __ \/ __  / _ \    / /| |  / /  
/ /___ / /_/ / /__/ /_/ / /_/ /  __/   / ___ |_/ /   
\____/ \____/\___/\____/\__,_/\___/   /_/  |_/___/   
                                                     
```

# CocodeAI
### 🚀 下一代开发者智能工作区 · AI Coding Agent 桌面客户端

[![License](https://img.shields.io/badge/license-MIT-blue.svg?style=flat-square)](LICENSE)
[![Tauri](https://img.shields.io/badge/Tauri-v2-orange.svg?style=flat-square)](https://tauri.app)
[![React](https://img.shields.io/badge/React-19-61DAFB.svg?style=flat-square)](https://react.dev)
[![Bun](https://img.shields.io/badge/Bun-%23000000.svg?style=flat-square&logo=bun&logoColor=white)](https://bun.sh)
[![TypeScript](https://img.shields.io/badge/TypeScript-5-3178C6.svg?style=flat-square)](https://www.typescriptlang.org)

<p align="center">
  <strong>CocodeAI</strong> 是一款专为开发者设计的本地桌面 AI 编程助理。它基于 <strong>Tauri v2 + React 19 + Bun</strong> 构建，将强大的终端 AI Coding Agent（如 Claude Code CLI）与极具现代感和技术美学的图形用户界面完美融合。
</p>

<h4>
  <a href="#-核心架构与运行原理">架构原理</a> •
  <a href="#-核心技术亮点">技术亮点</a> •
  <a href="#-技术栈清单">技术栈</a> •
  <a href="#-目录结构解密">目录解密</a> •
  <a href="#-快速上手">快速上手</a> •
  <a href="#-安全与权限模式">安全控制</a>
</h4>

</div>

---

## 🎨 设计美学：极简毛玻璃与流线动画

CocodeAI 采用最新的 **HeroUI** 与 **Tailwind CSS v4** 进行视觉重构，深度融合 **Framer Motion** 的物理动效：
*   **毛玻璃美学 (`Glassmorphism`)**：采用 `backdrop-blur-xl` 面板、半透明自适应背景与微型发光边框，呈现悬浮视差感。
*   **沉浸式深浅主题**：全局 300ms 柔和颜色过渡，支持自定义 VSCode 风格的主题着色，黑暗模式下顶部拥有幽蓝微光。
*   **物理动效系统**：所有微交互（侧边栏伸缩、对话弹窗、工具折叠）遵循 `prefers-reduced-motion` 标准，确保操作的流畅与跟手。

---

## 🏗️ 核心架构与运行原理

CocodeAI 采用经典的**客制化混合式架构（Client-Server Hybrid Model）**，将前端的高保真渲染、本地 daemon 服务的计算和运行时管控、以及本地操作系统的原生特权进行了深度隔离与协同：

```
┌──────────────────────────────────────────────────────────┐
│                   桌面应用（Tauri v2 - Rust）            │
│  ┌────────────────────────────────────────────────────┐  │
│  │                React 19 前端 (WebView)             │  │
│  │  Sidebar │ TabBar │ Workspace │ Terminal │ settings│  │
│  └─────────────────────────▲──────────────────────────┘  │
│                            │ HTTP REST / WebSocket       │
│  ┌─────────────────────────▼──────────────────────────┐  │
│  │             本地 Daemon 服务 (Bun 运行时)            │  │
│  │    Sessions    │  MCP Manager  │  Cron Scheduler   │  │
│  │  (SQLite DB)   │ (Stdio/HTTP)  │ (Git Worktrees)   │  │
│  └─────────────────────────▲──────────────────────────┘  │
│                            │ spawn (Stdio Stream)        │
│  ┌─────────────────────────▼──────────────────────────┐  │
│  │            AI Agent 进程 (Claude Code CLI / 等)     │  │
│  └────────────────────────────────────────────────────┘  │
└──────────────────────────────────────────────────────────┘
```

### 🔁 数据流与实时同步循环

1.  **用户输入**：用户在 Web UI 侧边栏或 ChatComposer 输入 Prompt，React 触发 `chatStore` 并通过 WebSocket 发送 `send_message` 事件。
2.  **本地调度**：本地 Bun 进程接收并解析 WS 命令，如果是新对话，则使用 `spawn` 异步调起 AI Agent 命令行实例（例如 `claude --output-format stream-json --no-interactive`）。
3.  **流式流转**：
    *   Agent 命令行向 `stdout` 输出 NDJSON 格式的结构化数据流。
    *   `AgentOutputParser` 进行字节流重组与转换，抽取 `text_delta`（普通文本）、`thinking_delta`（推理过程）以及 `tool_use_start`（工具调用指令）。
    *   Bun Daemon 通过 WebSocket 向 WebView 广播事件流，并实时写盘至 SQLite 缓存。
4.  **智能体控制**：当 Agent 尝试写文件、执行 Shell 或截屏时，Daemon 触发 `permission_request`。前端拦截显示微型交互弹窗，用户点击允许后才返回 `permission_response` 给 Agent，保障本地安全。

---

## ⚡ 核心技术亮点

### 1. 🧬 Git 原生会话回溯 (Turn Checkpoints & Git Rewind)
在长对话中，Agent 的连续修改可能会因为上下文冲突或设计跑偏导致“写崩”。CocodeAI 实现了底层 Git 原生的安全回档技术：
*   在每次用户发出 Turn 的时刻，CocodeAI 都会在 SQLite 中存储当前的会话快照（`turn_checkpoints`）。
*   同时，在本地工作目录中，Daemon 会创建临时 Git Stash 引用（`git_stash_ref`）或轻量 Commit 分支。
*   **会话撤回（Rewind）**：用户在聊天界面可以随时回退到历史任意对话节点，系统将重置 SQLite 状态，并配合 Git 引擎自动将工作区代码、新增文件回滚至该历史时刻的精准状态。

### 2. 🎛️ 企业级权限流控与沙箱防线
为了防止 AI 代理执行任意恶意命令或误删关键路径，CocodeAI 提供了粒度极细的控制机制：
*   **权限拦截器**：拦截所有敏感工具（`execute_command`、`write_file`、`patch_file`）。
*   **五大安全模式**：提供包括“只读规划（Plan）”、“自动应用代码变更但拦截命令行（Accept Edits）”等安全隔离档位。
*   **Computer Use 授权**：精确限制屏幕读取、虚拟点击与剪贴板写操作，并支持原生截图隐私过滤，屏蔽隐私字段。

### 3. 🔌 动态多传输协议 MCP (Model Context Protocol)
原生集成 Model Context Protocol，无缝引入外部上下文生态：
*   **多协议管道**：支持 `stdio` 本地管道、`HTTP` 标准接口与 `SSE` (Server-Sent Events) 协议。
*   **三级作用域隔离**：用户级（User）、项目级（Project）以及本地临时（Local），让不同项目能够关联特定的 MCP Server。
*   **热插拔与 OAuth**：支持在 UI 界面动态启停/新增/删除 MCP 节点，支持 MCP 端的第三方官方授权。

### 4. ⏰ Git Worktree 隔离运行的计划任务
对于需要长时间跑的测试、生成影响报告或周期性 Review 任务，CocodeAI 引入了计划任务（Scheduled Tasks）：
*   基于底层 Cron 表达式进行定时唤醒。
*   **Worktree 隔离**：为了不干扰开发者的当前开发分支，任务会被调度到临时 `git worktree` 目录中执行，自动完成分支克隆、AI 迭代、测试运行与编译。
*   **跨通道通知**：执行完毕后，分析报告通过 IM 机器人适配器（Feishu、Telegram Bot、钉钉）推送到开发者手机端。

### 5. 🧠 项目记忆持久化 (Project Memory System)
*   突破单次会话上下文长度瓶颈，自动识别和抽象出项目相关的架构信息、技术规范、代码约定等。
*   在工作目录内维护一个结构化的本地记忆（Memory）目录，AI 自动进行存取，且支持开发者可视化查看与编辑。

---

## 📦 技术栈清单

| 分层 | 技术选型 | 功能与描述 |
| :--- | :--- | :--- |
| **桌面壳体 (Desktop)** | **Tauri v2 (Rust)** | 处理本地系统通知、系统托盘、系统剪贴板、文件对话框及原生窗口控制。 |
| **运行容器 (Runtime)** | **Bun** | 本地高性能后端运行时，具有极速冷启动和原生的 TypeScript/JSX 支持。 |
| **持久化存储 (Database)** | **SQLite** | 嵌入式单文件数据库，持久化会话记录、Providers、计划任务及回溯 Checkpoint。 |
| **前端框架 (Frontend)** | **React 19 + TS 5** | 高并发渲染流式消息，基于 WebSockets 保持实时一致。 |
| **组件库 (UI Library)** | **HeroUI (@heroui/react)**| 极具科技感的现代化 UI 组件库，支持毛玻璃特性的半透明高保真设计。 |
| **样式体系 (Styling)** | **Tailwind CSS v4** | 原子化样式系统，支持 CSS 变量的主题系统。 |
| **状态管理 (State)** | **Zustand** | 极简的状态管理，分治设计 `chatStore`、`tabStore`、`teamStore`。 |
| **实时通信 (Real-time)** | **WebSocket (ws)** | 基于长连接的 NDJSON 消息包传输与控制流双向打通。 |

---

## 📂 目录结构解密

```
CocodeAI-main/
├── bin/                          # CLI 脚本与应用启动入口
├── desktop/                      # 桌面端 (Tauri v2 + React)
│   ├── src/                      # 前端 React 源代码
│   │   ├── api/                  # REST API 请求与 WebSocket 消息分发
│   │   ├── components/           # UI 模块 (Chat, Tasks, Teams, Workspace, Controls)
│   │   ├── stores/               # Zustand 跨页面状态（sessionStore, chatStore 等）
│   │   ├── i18n/                 # 国际化语言包 (Custom en / zh)
│   │   └── theme/                # 毛玻璃和深色模式视觉主题定义
│   └── src-tauri/                # Tauri v2 后端逻辑 (Rust)
│       ├── src/                  # Rust 源码 (窗口生命周期、特权通道)
│       └── tauri.conf.json       # Tauri 权限与应用配置
├── src/                          # 本地 Web/WebSocket 服务端代码 (Bun)
│   ├── server/                   # HTTP 服务路由、API 接口、WebSocket 消息路由器
│   ├── agent/                    # Agent 命令行进程启动器、NDJSON 解析器
│   ├── sessions/                 # 会话存储与 Git-Native Checkpoint 管理
│   ├── mcp/                      # Model Context Protocol (MCP) 服务器驱动与生命周期管理
│   ├── tasks/                    # 定时任务调度器 (Cron 调度与 Worktree 创建)
│   └── db/                       # 本地 SQLite 数据表 Schema 与连接器
├── adapters/                     # 即时通讯机器人适配器 (Feishu, Telegram, WeChat Work, DingTalk)
└── docs/                         # 基于 Vitepress 编写的高清产品与开发者文档
```

---

## 🚀 快速上手

### 1. 安装环境要求

确保在本地已配置以下工具链：
*   **Node.js** >= 18.0.0
*   **Bun**（推荐，本地 Daemon 拥有最佳速度：[Bun 安装指南](https://bun.sh)）
*   **Rust** 与 Cargo（构建 Tauri 项目的必须项：[Rust 安装指南](https://www.rust-lang.org)）

### 2. 克隆与依赖安装

```bash
# 克隆仓库
git clone https://github.com/cocode-kuma/CocodeAI.git
cd CocodeAI

# 进入 desktop 目录并安装依赖
cd desktop
npm install
```

### 3. 启动开发调试

```bash
# 启动 Tauri 桌面应用进行热重载调试
npm run tauri dev
```

该命令会自动调起底层的本地 Bun 服务（默认监听端口 `3456`），并启动 Tauri WebView 客户端窗口。

### 4. 打包分发包

```bash
# 打包出当前系统平台的原生安装包 (.dmg, .msi, .deb, etc.)
npm run tauri build
```

---

## 🛡️ 安全与权限模式

CocodeAI 针对日常编码场景，提炼出了 5 种不同的权限运行档位，可以在对话区域下方的控件中随时切换：

| 模式 | 核心限制 | 适用场景 |
| :--- | :--- | :--- |
| 🛡️ **Default** | 对所有敏感操作（写文件、执行命令）触发提示框，需手动授权。 | 日常开发、不熟悉或大型的复杂系统变更。 |
| 📝 **Accept Edits** | 自动合并与重写代码文件，但执行 Shell 命令时依然会弹出确认。 | 纯编码与重构任务，无需人工干预频繁点击。 |
| 📖 **Plan (只读)** | 绝对的 Read-Only 模式。AI 只能进行代码检索和阅读，无法执行任何变更。 | 前期架构分析、代码梳理或调试排查。 |
| 🔓 **Bypass** | 跳过所有的拦截与确认，直接执行。 | 经过信任的个人工作区或独立实验项目（**慎用**）。 |
| 🤝 **Don't Ask** | 静默全自动批准（包括命令执行）。 | 跑自动化测试流或定时脚本。 |

---

## 🤝 贡献与反馈

欢迎各位开发者参与到 CocodeAI 的建设中来！如果您有任何想法或遇到了 Bug，请：
1.  Fork 本仓库
2.  创建您的 Feature 分支 (`git checkout -b feature/amazing-feature`)
3.  提交您的修改 (`git commit -m 'Add some amazing feature'`)
4.  Push 到该分支 (`git push origin feature/amazing-feature`)
5.  在 GitHub 提交 Pull Request

*   **项目文档**：可以查看 [DEV_GUIDE.md](file:///C:/Users/SurgeFC/Downloads/CocodeAI-main/DEV_GUIDE.md) 获取更底层的设计细节。

---

<div align="center">

**CocodeAI** - Built with ❤️ by [cocode-kuma](https://github.com/cocode-kuma)

</div>