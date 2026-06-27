# 📋 AI Desktop 实现路线图

## Phase 1: 项目基础 ✅ 已部分完成
| # | 步骤 | 内容 | 状态 |
|---|------|------|:---:|
| 1 | 仓库初始化 | GitHub + README + LICENSE (AGPL-3.0) | ✅ |
| 2 | Rust 项目骨架 | Cargo.toml + 目录结构 + CI | ✅ |
| 3 | TODO | 补充 `.github/workflows/` 自动构建 | 🔲 |

## Phase 2: Tauri 窗口系统（后端主导）
| # | 步骤 | 内容 | 状态 |
|---|------|------|:---:|
| 4 | Tauri v2 初始化 | `cargo tauri init` + 设置窗口属性 | 🔲 |
| 5 | 浮动窗口创建 | 无边框、异形区域捕获、毛玻璃（`backdrop-filter`） | 🔲 |
| 6 | 快捷键绑定 | `Super+Space` 唤起/隐藏窗口逻辑 | 🔲 |

## Phase 3: 前端 UI 层
| # | 步骤 | 内容 | 状态 |
|---|------|------|:---:|
| 7 | React + Vite 项目初始化 | `npm create vite@latest` + 基础组件 | 🔲 |
| 8 | AI Sidebar 布局 | 侧边栏容器 + 顶部/Header + 底部输入框 | 🔲 |
| 9 | 聊天气泡组件 | 用户消息/AI 消息 + 头像 + 状态指示 | 🔲 |
| 10 | 快捷操作卡片 | 可点击的动作选项（如"打包""移动"） | 🔲 |
| 11 | 确认弹窗 | 执行命令前确认 UI | 🔲 |

## Phase 4: AI 对话集成
| # | 步骤 | 内容 | 状态 |
|---|------|------|:---:|
| 12 | llama.cpp API 连接 | HTTP 客户端 + 流式输出处理 | 🔲 |
| 13 | 消息发送/接收 | 前端状态 → 后端转发 → ai.rs 解析 | 🔲 |
| 14 | 对话历史存储 | `IndexedDB` + 持久化 | 🔲 |

## Phase 5: 系统交互层
| # | 步骤 | 内容 | 状态 |
|---|------|------|:---:|
| 15 | 文件操作 | `find` 桌面文件 + `xdg-open` 打开 | 🔲 |
| 16 | 命令解析 | 意图识别 → 推荐操作（sidebar.rs） | 🔲 |
| 17 | 沙箱执行系统 | 安全容器内执行，用户需确认 | 🔲 |

## Phase 6: 收尾与发布
| # | 步骤 | 内容 | 状态 |
|---|------|------|:---:|
| 18 | 主题适配 | 深色/浅色模式切换 | 🔲 |
| 19 | 通知系统集成 | 桌面通知代理 | 🔲 |
| 20 | 打包发布 | `cargo tauri build` → AppImage/DEB/RPM | 🔲 |

---

### 🔄 小步慢跑建议

**Phase 1 已完成，Phase 2 才开始。**

**下一步推荐**：先做 **4. `cargo tauri init` 初始化窗口**，然后再做 UI 组件。

---

## 🛠️ 环境准备清单

需要安装的依赖：

```bash
# Rust 工具链
curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh
source $HOME/.cargo/env
rustup default stable

# Tauri CLI
cargo install tauri-cli --version "^2"

# Node.js (建议 >=18)
# 使用 system package manager 安装

# 系统依赖（Ubuntu/Debian）
sudo apt update
sudo apt install -y libwebkit2gtk-4.1-dev \
  build-essential \
  curl \
  wget \
  file \
  libssl-dev \
  libgtk-3-dev \
  libayatana-appindicator3-dev \
  librsvg2-dev
```

> ⚠️ **注意**：你需要先安装 Rust 和依赖，然后我才能执行 `cargo tauri init` 和后续开发。

---

## 📅 预估时间

| 阶段 | 预估工时 | 说明 |
|:---|:---|:---|
| Phase 1 | 已完成 | 项目骨架 |
| Phase 2 | 2-3 天 | 窗口 + 快捷键 |
| Phase 3 | 3-4 天 | 前端 UI 完整 |
| Phase 4 | 2-3 天 | AI 对话集成 |
| Phase 5 | 3-4 天 | 系统交互 |
| Phase 6 | 1-2 天 | 收尾与发布 |

> **总计：约 2-3 周完成 MVP。**
