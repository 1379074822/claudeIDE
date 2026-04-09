# Claude IDE

一个基于 Electron + React 的 Cursor-like IDE，集成 Claude Code AI 编程助手。

## 功能特性

- 📁 **文件资源管理器** - 可展开的文件树，支持打开任意项目目录
- ✏️ **Monaco 代码编辑器** - VS Code 同款编辑器，支持语法高亮、代码补全
- 💬 **Claude AI 聊天面板** - 与 Claude Code 实时对话，支持流式输出
- 🔧 **工具调用可视化** - 实时查看 AI 执行的每个工具调用（bash、文件读写等）
- 📊 **Diff 视图** - AI 修改文件时自动显示代码差异
- 🎨 **Catppuccin 主题** - 精美的暗色主题

## 快速开始

### 前置要求

1. Node.js 18+
2. Claude Code CLI 已安装：`npm install -g @anthropic-ai/claude-code`

### 安装和运行

```bash
cd claude-ide
npm install
npm run dev
```

### 连接到 Claude

1. 启动应用后，点击右侧聊天面板的 ⚙️ 图标
2. 确认端口（默认 3500）和 Auth Token
3. 点击 "Start & Connect"
4. 等待服务器启动（约 2 秒）
5. 开始对话！

## 架构说明

```
claude-ide/
├── src/
│   ├── main/           # Electron 主进程
│   │   └── index.js    # 窗口管理、文件系统 IPC、Claude 服务器进程管理
│   ├── preload/        # Electron 预加载脚本（安全桥梁）
│   └── renderer/       # React 前端
│       ├── components/
│       │   ├── TitleBar/   # 标题栏 + 窗口控制
│       │   ├── FileTree/   # 文件树
│       │   ├── Editor/     # Monaco 编辑器
│       │   ├── Chat/       # Claude 聊天面板
│       │   ├── DiffViewer/ # 代码 Diff 显示
│       │   └── ToolCall/   # 工具调用面板
│       ├── store/      # Zustand 状态管理
│       └── utils/
│           ├── claudeConnection.ts  # Claude WebSocket 连接
│           └── fileUtils.ts         # 文件工具函数
```

## Claude Code 集成原理

基于 `open-claude-code` 源码的服务器模式：

1. **主进程**启动 `claude --server --port=N --auth-token=TOKEN`
2. **前端**发起 `POST /api/sessions` 创建会话，获取 WebSocket URL
3. **WebSocket** 实时接收 SDK 消息（assistant、tool_use、tool_result 等）
4. **工具调用**自动显示在面板中，文件修改自动更新编辑器并显示 Diff
