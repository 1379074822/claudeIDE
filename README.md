# Claude IDE

一个基于 Electron + React 的轻量级 AI 编程 IDE，集成 Claude AI 助手。**无需安装 Claude CLI 即可使用**，直接填入 API Key 开始对话。

![Electron](https://img.shields.io/badge/Electron-36-47848F?logo=electron)
![React](https://img.shields.io/badge/React-18-61DAFB?logo=react)
![TypeScript](https://img.shields.io/badge/TypeScript-5-3178C6?logo=typescript)

## 功能特性

### 核心编辑器
- **Monaco 代码编辑器** - VS Code 同款编辑器，语法高亮、代码补全、多标签页
- **文件资源管理器** - 可展开的文件树，右键菜单支持新建/重命名/删除/发送到聊天
- **编辑器自动保存** - 停止编辑 3 秒后自动保存，无需手动 Ctrl+S
- **Monaco 右键 AI 菜单** - 选中代码后右键可直接触发 AI 解释/重构/生成测试

### AI 聊天
- **流式输出** - 逐字实时显示 AI 回复
- **多标签页对话** - 同时维护多个独立会话
- **文件引用 Chip** - 拖拽文件或右键"发送到聊天"将文件作为上下文附加，不直接提交
- **图片粘贴** - 支持直接粘贴截图到对话框
- **工具调用可视化** - 实时查看 AI 执行的 bash、文件读写等工具调用
- **Diff 视图** - AI 修改文件时自动显示代码差异

### 生产力工具
- **全局搜索** (`Ctrl+Shift+F`) - 正则搜索代码库，结果按文件分组，点击跳转
- **快速打开** (`Ctrl+P`) - 模糊搜索文件名，快速打开
- **集成终端** (`` Ctrl+` ``) - 内置终端面板，基于 node-pty + xterm.js
- **命令面板** (`Ctrl+Shift+P`) - 快速执行常用操作

### 其他
- **多主题** - Catppuccin Mocha / Latte、Ayu Dark 等
- **中英双语** - 界面语言可在设置中切换
- **自定义模型** - 支持添加任意 OpenAI 兼容 API 模型
- **ErrorBoundary** - 组件级错误捕获，崩溃后可一键重试

## 快速开始

### 前置要求

- Node.js 18+
- Anthropic API Key（在 [console.anthropic.com](https://console.anthropic.com) 获取）

### 安装和运行

```bash
git clone https://github.com/1379074822/claudeIDE.git
cd claudeIDE
npm install
npm run dev
```

### 配置 API Key

1. 启动应用后点击左侧活动栏底部的 **Settings（齿轮图标）**
2. 在 **API Configuration** 中填入 `sk-ant-...` 格式的 API Key
3. 确认 **Request Mode** 选择 `API`
4. 打开一个项目文件夹，开始对话

## 连接模式

| 模式 | 说明 | 是否需要 Claude CLI |
|------|------|-------------------|
| **API 模式** | 直接通过 Anthropic SDK 调用，支持流式输出 | 不需要 |
| **Server 模式** | 通过 `claude --server` WebSocket 连接，支持完整工具调用 | 需要 |

> 推荐新用户使用 **API 模式**，开箱即用。

## 快捷键

| 快捷键 | 功能 |
|--------|------|
| `Ctrl+P` | 快速打开文件 |
| `Ctrl+Shift+F` | 全局搜索 |
| `Ctrl+Shift+P` | 命令面板 |
| `` Ctrl+` `` | 切换终端 |
| `Ctrl+B` | 切换侧边栏 |
| `Ctrl+J` | 切换聊天面板 |
| `Ctrl+S` | 保存文件 |

## 项目结构

```
claude-ide/
├── src/
│   ├── main/                  # Electron 主进程
│   │   ├── index.js           # 窗口、IPC、终端、文件系统
│   │   ├── configManager.js   # 配置/CLAUDE.md/MCP 管理
│   │   └── serverManager.js   # Claude Server 进程管理
│   ├── preload/
│   │   └── index.js           # 安全桥梁，暴露 electronAPI
│   └── renderer/              # React 前端
│       ├── components/
│       │   ├── Chat/          # 聊天面板（虚拟滚动、文件 Chip）
│       │   ├── Editor/        # Monaco 编辑器 + 自动保存
│       │   ├── FileTree/      # 文件树 + 右键菜单
│       │   ├── Search/        # 全局搜索面板
│       │   ├── QuickOpen/     # 快速打开文件
│       │   ├── Terminal/      # 集成终端
│       │   ├── Settings/      # 设置面板
│       │   └── ...
│       ├── store/             # Zustand 状态管理
│       ├── locales/           # 中英双语 i18n
│       └── utils/
│           ├── claudeClient.ts  # API 模式客户端
│           └── serverClient.ts  # Server 模式 WebSocket 客户端
```

## 技术栈

- **Electron** - 跨平台桌面应用框架
- **React 18 + TypeScript** - 前端 UI
- **Monaco Editor** - VS Code 同款编辑器内核
- **Zustand** - 轻量状态管理
- **Vite** - 构建工具
- **xterm.js + node-pty** - 集成终端
- **react-virtuoso** - 消息列表虚拟滚动
- **Anthropic SDK** - API 模式直接调用
