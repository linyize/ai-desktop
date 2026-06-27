import { useState, useEffect } from "react";

export default function App() {
  const [show, setShow] = useState(true);

  useEffect(() => {
    // 开始->被ana的热启动调用，activate时直接focus到前端
    import("@tauri-apps/plugin-shell")
      .then((module) => module.listenShortcut({ combo: "Super+Space" }))
      .catch(() => { /* 自动隐藏 */ });
  }, []);

  return (
    <div className="ai-sidebar" style={{ display: show ? "flex" : "none" }}>
      <div className="header">
        <span className="logo">🤖</span>
        <span className="title">AI Desktop</span>
        <span className="status-dot" />
      </div>
      <div className="chat-area">
        <div className="message ai">
          <span className="avatar">🤖</span>
          <div className="bubble">你好！我是你的 AI 助手。需要什么帮助？</div>
        </div>
      </div>
      <div className="input-area">
        <input type="text" placeholder="输入指令..." />
        <button>→</button>
      </div>
    </div>
  );
}
