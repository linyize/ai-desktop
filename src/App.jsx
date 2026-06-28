import { useState, useEffect, useRef } from "react";

export default function App() {
  const [show, setShow] = useState(true);
  const [input, setInput] = useState("");
  const [mode, setMode] = useState("teach");
  const [messages, setMessages] = useState([
    { id: 1, sender: "ai", text: "你好！我是你的 AI 助手。需要什么帮助？" }
  ]);
  const [isSending, setIsSending] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [settings, setSettings] = useState({
    provider: localStorage.getItem('ai_provider') || 'mock',
    apiKey: localStorage.getItem('api_key') || '',
    apiUrl: localStorage.getItem('api_url') || ''
  });
  const [showWelcome, setShowWelcome] = useState(!localStorage.getItem('ai_provider'));
  const [systemPrompt, setSystemPrompt] = useState(getModePrompt("teach"));
  const [error, setError] = useState(null);

  const getModePrompt = (mode) => {
    const prompts = {
      teach: "你是一个耐心的 AI 教师，擅长用简洁明了的方式讲解知识点，提供示例代码和最佳实践。",
      auto: "你是一个高效的 AI 编程助手，专注于自动完成编程任务、生成代码、修复 bug 和优化实现。直接给出解决方案。",
      monitor: "你是一个系统监控专家，负责分析日志、诊断问题、提供运维建议，并帮助理解系统状态。"
    };
    return prompts[mode] || prompts.teach;
  };

  const handleModeChange = (newMode) => {
    setMode(newMode);
    localStorage.setItem('ai_mode', newMode);
    setSystemPrompt(getModePrompt(newMode));
  };
  const chatRef = useRef(null);

  useEffect(() => {
    const savedMode = localStorage.getItem('ai_mode');
    if (savedMode && ['teach', 'auto', 'monitor'].includes(savedMode)) {
      setMode(savedMode);
      setSystemPrompt(getModePrompt(savedMode));
    }
    
    // 开始->被ana的热启动调用，activate时直接focus到前端
    import("@tauri-apps/plugin-shell")
      .then((module) => module.listenShortcut({ combo: "Super+Space" }))
      .catch(() => { /* 自动隐藏 */ });
    
    // 滚动到底部
    if (chatRef.current) {
      chatRef.current.scrollTop = chatRef.current.scrollHeight;
    }
  }, []);

  const handleSend = async () => {
    if (!input.trim()) return;

    const userMsg = { id: Date.now(), sender: "user", text: input.trim() };
    setMessages(prev => [...prev, userMsg]);
    setInput("");
    setIsSending(true);
    setError(null);

    try {
      const apiUrl = settings.apiUrl || 'http://127.0.0.1:8082/v1/chat/completions';
      const model = 'coder-next';
      const messagesToSend = [
        { role: "system", content: systemPrompt },
        ...messages,
        userMsg
      ].map(m => ({
        role: m.sender === "user" ? "user" : "assistant",
        content: m.text
      }));

      const response = await fetch(apiUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(settings.apiKey && { Authorization: `Bearer ${settings.apiKey}` })
        },
        body: JSON.stringify({
          model: model,
          messages: messagesToSend,
          stream: true
        })
      });

      if (!response.ok) {
        throw new Error(`API 请求失败: ${response.statusText}`);
      }

      const aiMsgId = Date.now() + 1;
      setMessages(prev => [...prev, { id: aiMsgId, sender: "ai", text: "" }]);
      
      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let fullResponse = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value, { stream: true });
        const lines = chunk.split('\n').filter(line => line.trim() !== '');

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            const data = line.slice(6);
            if (data === '[DONE]') break;

            try {
              const parsed = JSON.parse(data);
              const content = parsed.choices?.[0]?.delta?.content || '';
              fullResponse += content;
              
              setMessages(prev => 
                prev.map(msg => 
                  msg.id === aiMsgId ? { ...msg, text: fullResponse } : msg
                )
              );
            } catch (e) {
              console.error('解析响应失败:', e);
            }
          }
        }
      }
    } catch (error) {
      console.error("发送失败:", error);
      setError(error.message || '请求失败，请检查配置');
      
      setMessages(prev => [
        ...prev,
        { id: Date.now() + 1, sender: "ai", text: `❌ 错误：${error.message || '请求失败'}` }
      ]);
    } finally {
      setIsSending(false);
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleSaveSettings = (e) => {
    e.preventDefault();
    localStorage.setItem('ai_provider', settings.provider);
    localStorage.setItem('api_key', settings.apiKey);
    localStorage.setItem('api_url', settings.apiUrl);
    setShowSettings(false);
    setShowWelcome(false);
    alert('配置已保存！');
  };

  const closeError = () => setError(null);

  // 简单设置弹窗
  const SettingsModal = () => (
    <div style={{
      position: 'fixed',
      top: 0, left: 0, right: 0, bottom: 0,
      background: 'rgba(0,0,0,0.5)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 1000
    }}>
      <div style={{
        background: 'white',
        borderRadius: '16px',
        padding: '30px',
        width: '400px',
        maxWidth: '90%'
      }}>
        <h2 style={{ marginBottom: '20px' }}>⚙️ AI 设置</h2>
        
        <form onSubmit={handleSaveSettings}>
          <div style={{ marginBottom: '15px' }}>
            <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold' }}>
              AI 提供商
            </label>
            <select
              value={settings.provider}
              onChange={(e) => setSettings({...settings, provider: e.target.value})}
              style={{ width: '100%', padding: '8px', borderRadius: '6px', border: '1px solid #ddd' }}
            >
              <option value="mock">模拟（测试用）</option>
              <option value="deepseek">DeepSeek</option>
              <option value="openai">OpenAI</option>
              <option value="ollama">Ollama (本地)</option>
              <option value="llama-cpp">llama.cpp (本地)</option>
            </select>
          </div>

          {settings.provider !== 'mock' && (
            <>
              <div style={{ marginBottom: '15px' }}>
                <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold' }}>
                  API Key
                </label>
                <input
                  type="password"
                  value={settings.apiKey}
                  onChange={(e) => setSettings({...settings, apiKey: e.target.value})}
                  placeholder="sk-***"
                  style={{ width: '100%', padding: '8px', borderRadius: '6px', border: '1px solid #ddd' }}
                />
              </div>

              <div style={{ marginBottom: '15px' }}>
                <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold' }}>
                  API URL
                </label>
                <input
                  type="url"
                  value={settings.apiUrl}
                  onChange={(e) => setSettings({...settings, apiUrl: e.target.value})}
                  placeholder="http://127.0.0.1:8082/v1/chat/completions"
                  style={{ width: '100%', padding: '8px', borderRadius: '6px', border: '1px solid #ddd' }}
                />
              </div>
            </>
          )}

          <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
            {error && (
              <span style={{
                padding: '8px 16px',
                color: '#e74c3c',
                fontSize: '14px'
              }}>
                错误：{error}
              </span>
            )}
            <button
              type="button"
              onClick={() => setShowSettings(false)}
              style={{
                padding: '8px 16px',
                borderRadius: '6px',
                border: '1px solid #ddd',
                cursor: 'pointer'
              }}
            >
              取消
            </button>
            <button
              type="submit"
              style={{
                padding: '8px 16px',
                borderRadius: '6px',
                background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                color: 'white',
                border: 'none',
                cursor: 'pointer'
              }}
            >
              保存配置
            </button>
          </div>
        </form>

        {error && (
          <div style={{ 
            marginTop: '15px', 
            padding: '10px', 
            background: '#fde8e8', 
            borderRadius: '6px',
            color: '#c0392b',
            fontSize: '14px'
          }}>
            {error}
            <button 
              onClick={closeError} 
              style={{ 
                marginLeft: '10px', 
                background: 'none', 
                border: 'none', 
                cursor: 'pointer', 
                color: '#c0392b',
                fontWeight: 'bold'
              }}
            >
              ×
            </button>
          </div>
        )}
      </div>
    </div>
  );

  // 欢迎向导
  const WelcomeWizard = () => (
    <div style={{
      position: 'fixed',
      top: 0, left: 0, right: 0, bottom: 0,
      background: 'rgba(0,0,0,0.5)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 1000
    }}>
      <div style={{
        background: 'white',
        borderRadius: '16px',
        padding: '30px',
        width: '400px',
        maxWidth: '90%'
      }}>
        <h2 style={{ marginBottom: '15px' }}>🤖 欢迎使用 AI Desktop</h2>
        <p style={{ marginBottom: '20px', color: '#666' }}>
          在开始之前，请先配置你的 AI 接口。
        </p>
        
        <div style={{ marginBottom: '20px', padding: '15px', background: '#f0f9ff', borderRadius: '8px' }}>
          <h3 style={{ fontSize: '14px', marginBottom: '10px' }}>推荐配置：</h3>
          <ul style={{ fontSize: '12px', color: '#666', margin: 0, paddingLeft: '20px' }}>
            <li><strong>AI 提供商：</strong> Ollama</li>
            <li><strong>API URL：</strong> http://127.0.0.1:8082/v1/chat/completions</li>
            <li><strong>API Key：</strong> （空）</li>
          </ul>
        </div>

        <button
          onClick={() => {
            setShowWelcome(false);
            setShowSettings(true);
          }}
          style={{
            width: '100%',
            padding: '12px',
            borderRadius: '8px',
            background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
            color: 'white',
            border: 'none',
            fontSize: '16px',
            cursor: 'pointer'
          }}
        >
          开始配置
        </button>
      </div>
    </div>
  );

  return (
    <div className="ai-sidebar" style={{ display: show ? "flex" : "none" }}>
      {showSettings && <SettingsModal />}
      {showWelcome && <WelcomeWizard />}
      
      <div className="header">
        <span className="logo">🤖</span>
        <span className="title">AI Desktop</span>
        
        <div style={{
          display: 'flex',
          background: 'rgba(255,255,255,0.1)',
          borderRadius: '8px',
          padding: '4px',
          margin: '0 12px'
        }}>
          {[
            { id: 'teach', label: 'Teach', icon: '📚' },
            { id: 'auto', label: 'Auto', icon: '⚙️' },
            { id: 'monitor', label: 'Monitor', icon: '👁️' }
          ].map((m) => (
            <button
              key={m.id}
              onClick={() => handleModeChange(m.id)}
              style={{
                background: mode === m.id ? '#667eea' : 'transparent',
                color: mode === m.id ? 'white' : '#ccc',
                border: 'none',
                padding: '6px 12px',
                borderRadius: '4px',
                cursor: 'pointer',
                fontSize: '13px',
                display: 'flex',
                alignItems: 'center',
                gap: '4px'
              }}
            >
              <span>{m.icon}</span>
              {m.label}
            </button>
          ))}
        </div>
        
        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
          <span className="status-dot" style={{ background: error ? '#e74c3c' : '#27ae60' }} title={error ? '错误' : '在线'} />
          <button
            onClick={() => setShowSettings(true)}
            style={{
              background: 'transparent',
              border: 'none',
              color: 'white',
              fontSize: '20px',
              cursor: 'pointer',
              padding: '4px 8px'
            }}
            title="设置"
          >
            ⚙️
          </button>
        </div>
      </div>
      <div className="chat-area" ref={chatRef}>
        {messages.map((msg) => (
          <div key={msg.id} className={`message ${msg.sender}`}>
            <span className="avatar">{msg.sender === "ai" ? "🤖" : "👤"}</span>
            <div className="bubble">{msg.text}</div>
          </div>
        ))}
        {error && (
          <div className="message ai">
            <span className="avatar">🤖</span>
            <div className="bubble" style={{ color: '#e74c3c' }}>{error}</div>
          </div>
        )}
      </div>
      <div className="input-area">
        <input
          type="text"
          placeholder="输入指令..."
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          disabled={isSending}
        />
        <button onClick={handleSend} disabled={isSending}>
          {isSending ? "..." : "→"}
        </button>
      </div>
    </div>
  );
}
