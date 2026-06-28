# 🤖 AI Desktop

> Linux 新手的桌面管家——用对话降低系统操作门槛。

一个**模式化**的 AI 原生 Linux 桌面助手，不是聊天窗口，而是三种工作模式：

| 模式 | 适用 | 做法 |
|------|------|------|
| **📖 教我** | Linux 新手 | 分步解释，用户确认后执行 |
| **⚡ 帮我** | 想省事的用户 | AI 全自动执行，给最终结果 |
| **👀 监控** | 所有人 | 后台监听日志/报错，异常主动弹窗 |

## 它能帮你什么

| 场景 | 你只需说 | AI Desktop 会 |
|------|----------|---------------|
| 装软件 | "装个微信" | 判断分发方式 → 加仓库 → 安装 → 配置 |
| 修报错 | 截个图 | 识别错误 → 查原因 → 给修复命令 |
| 管文件 | "把下载目录的截图整理到桌面" | 筛选文件 → 分类 → 移动 |
| 配系统 | "设好代理，终端和浏览器都走" | 写环境变量 → 配代理 → 验证连通 |
| 学操作 | "怎么装显卡驱动" | 解释每一步原理 → 演示执行 → 你学会 |

## 产品理念

> **不是替代终端，而是降低终端门槛。**
> 开发者会一直用命令行。但对刚接触 Linux 的人来说，AI Desktop 是翻译层——你的自然语言 → 对应的 Linux 操作。

## 快速开始

### 前提

- 本地运行一个 **OpenAI 兼容的 API 服务**（如 `llama.cpp` 的 `llama-server`）
- 默认地址 `http://localhost:8080/v1`（可在设置中修改）

### 启动

```bash
# 1. 克隆
git clone https://github.com/linyize/ai-desktop.git
cd ai-desktop

# 2. 安装前端依赖
npm install

# 3. 开发模式运行
cargo tauri dev
```

### 构建

```bash
cargo tauri build
```

产物在 `src-tauri/target/release/bundle/` 下：
- `.AppImage` — 通用 Linux 包
- `.deb` — Debian/Ubuntu
- `.rpm` — Fedora/RHEL

## 配置

启动后点 ⚙️ 进入设置：

| 选项 | 默认值 | 说明 |
|------|--------|------|
| AI 提供商 | `llama.cpp` | 可选 Mock（测试）/ DeepSeek / OpenAI |
| API URL | `http://localhost:8080/v1` | 你的 LLM 服务地址 |
| API Key | 空 | 本地模型不需要 |

## 项目结构

```
ai-desktop/
├── src/                     # React 前端
│   ├── App.jsx              # 主聊天界面 + 设置/向导
│   ├── main.jsx             # 渲染入口
│   └── index.css            # 侧边栏样式
├── src-tauri/               # Rust 后端
│   ├── src/main.rs          # 窗口管理 + 系统命令
│   ├── Cargo.toml           # Rust 依赖
│   └── tauri.conf.json      # Tauri 配置
├── package.json             # Node 依赖
├── vite.config.js           # Vite 配置
└── README.md                # 本文件
```

## 开发

### 环境要求

- Rust >= 1.70
- Node.js >= 18
- Tauri CLI v2: `cargo install tauri-cli --version "^2"`
- 系统依赖（Ubuntu/Debian）：

```bash
sudo apt install -y libwebkit2gtk-4.1-dev build-essential \
  libssl-dev libgtk-3-dev libayatana-appindicator3-dev librsvg2-dev
```

### 常用命令

```bash
cargo tauri dev       # 开发模式，热重载
cargo tauri build     # 构建发布版
npm run dev           # 单独启动前端（端口 1420）
```

## 路线图

详见 [ROADMAP.md](./ROADMAP.md)，当前处于 Phase 1→2 过渡。

## License

AGPL-3.0 — [查看详情](./LICENSE)

## 交流

- GitHub Issues — 反馈/需求/讨论
- PRs Welcome — 见 [CONTRIBUTING.md](./CONTRIBUTING.md)（TODO）
