# mobile-acp PRD

## 产品概述

**mobile-acp** 是一个 Android 原生 ACP 客户端，通过 SSH 连接远程服务器上的 AI coding agent（支持所有兼容 ACP 协议的 agent：Claude Code、Codex、Gemini CLI 等）。服务端零部署，只需 sshd。设计参考 Zed，针对手机触屏重新组织布局。

---

## 导航结构总览

```
启动页
└── 服务器列表（Home）
    ├── 添加服务器（QR 扫码 / 手动配置）
    └── 进入服务器
        ├── Project 选择页（选择工作目录）
        ├── Agent 管理页（安装 / 配置 agent）
        └── 主界面（4 Tab）
            ├── Agent Tab
            ├── Project Tab
            ├── Git Tab
            └── Files Tab
```

---

## 页面详细说明

### 1. 服务器列表（Home）

启动落点。列出所有已配对服务器：

- 服务器卡片：名称、主机地址、在线状态、最近访问时间
- 右上角：「+ 添加服务器」入口
- 长按卡片：编辑 / 删除

---

### 2. 添加服务器

两种方式，Tab 切换：

**方式 A：扫码（推荐）**

用户在服务器执行：
```
curl -fsSL https://mobile-acp.dev/setup.sh | bash
```
终端显示二维码（5 分钟有效）→ app 扫码 → 自动完成密钥交换 → 脚本退出

**方式 B：手动配置**

表单字段：
- 名称（显示用，自定义）
- Host
- Port（默认 22）
- 用户名
- 认证方式：密码 / 导入私钥文件 / app 生成密钥（推荐，存 Android Keystore）
- 测试连接按钮

---

### 3. 服务器详情页

进入服务器后的落点，两个入口：

#### 3a. Project 列表

选择工作目录（即 session 的 working directory）：

- 列出已保存的目录（带备注名）
- 「+ 添加」：在远端目录树中浏览选择，或手动输入路径
- 选择后进入主界面，Git panel 等均以此目录为根
- 支持多个 project 快速切换（顶部 dropdown，在主界面内也可切换）

#### 3b. Agent 管理

每台服务器的 agent 安装在该服务器本地，需独立管理：

**已安装 agent 列表**
- agent 名称、对应命令（如 `claude --acp`、`codex`）
- 状态：可用 / 命令不存在
- 点击：编辑配置
- 长按：删除

**安装新 agent**
- 从 ACP 兼容 agent 列表选择（参考 Zed 支持的列表）
- 每个 agent 显示：名称、安装命令（如 `npm install -g @anthropic/claude-code`）
- 点击安装 → app 通过 SSH 在服务器上执行安装命令，显示实时输出 log
- 安装完成后自动填入启动命令，可手动修改
- 支持自定义 agent（手动填命令）

**Agent 配置项**
- 显示名称
- 启动命令（如 `claude --acp`）
- 环境变量（如 `ANTHROPIC_API_KEY=xxx`，加密存储在 app 本地）
- 启动目录（留空则跟随 project 目录）

---

### 4. 主界面（4 Tab）

进入后顶部显示：服务器名 · project 名 · 当前 agent，可点击切换。

底部 Tab 导航：

```
[ Agent ]  [ Project ]  [ Git ]  [ Files ]
```

#### Tab 1：Agent（默认落点）

- 顶部：Thread 列表（横向可滚动 chip，或下拉选择），「+ 新 Thread」
- 对话主区：消息流，Markdown + 代码块渲染（代码块横向可滚动）
- 工具调用卡片：展示 agent 正在执行的操作（读文件、运行命令、写文件等），可展开查看详情和输出
- 权限弹窗：敏感操作需确认（Approve / Deny / Always Allow）
- 底部输入框：多行，@ 提及文件（从 Project / Files 选），发送按钮

#### Tab 2：Project

文件树浏览：

- 目录树（可折叠展开）
- 点击文件：跳转到 Files Tab 预览
- 长按文件：复制路径 / @ 提及到输入框 / 在 Git 中查看变更
- 顶部搜索：按文件名搜索

#### Tab 3：Git

- 当前分支 + 切换入口
- 变更文件分组：Staged / Unstaged / Untracked
- 点击文件：查看 diff（unified diff，语法高亮，横向可滚动）
- 操作：Stage / Unstage / Discard
- Commit：输入 message → 提交
- 未来扩展：push / pull / log（当前范围外）

#### Tab 4：Files

文件预览，按文件类型渲染：

| 类型 | 支持格式 | 渲染方式 |
|---|---|---|
| 代码 / 文本 | 主流语言、txt、yaml、json、toml… | 语法高亮（tree-sitter），只读 |
| Markdown | `.md` | 渲染预览（支持切换原文） |
| 图片 | png / jpg / gif / svg / webp | 图片查看器，双指缩放 |
| PDF | `.pdf` | 系统 PDF 渲染，分页 |
| 二进制 / 未知 | 其他 | 显示「无法预览，文件大小 XX KB」 |

其他功能：
- 面包屑导航
- 文本文件内搜索

---

## 设计要求

**视觉风格**
- 深色主题优先（参考 Zed One Dark）
- Monospace 字体用于代码、路径、命令
- 克制的 UI：少装饰，信息密度适中

**交互**
- 主要操作区在屏幕下半部（单手友好）
- 代码块、diff 支持水平滚动
- 长列表使用虚拟列表
- SSH 操作有延迟，所有异步操作需要 loading 状态
- 权限弹窗醒目但不遮挡对话内容

**状态**
- 连接断开时顶部 banner 提示，自动重连
- Agent 安装 log 实时滚动显示

---

## 超出当前范围（不做）

- iOS 版
- 文件编辑（只读预览）
- 语音输入
- 推送通知
- Git push / pull / log
- 多人协作
