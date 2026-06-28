import { useState, useEffect, useRef } from "react";
import * as path from "@tauri-apps/api/path";

const dangerousPatterns = [/rm /, /dd /, /mkfs/, /format/, /> \/dev/, /> \/etc/, /> \/boot/];

function isDangerousCommand(command) {
  if (!command) return false;
  for (const pattern of dangerousPatterns) {
    if (pattern.test(command)) return true;
  }
  return false;
}

function StepMessage({ message, mode }) {
  const { steps } = message;
  
  if (mode !== 'teach' || !steps || steps.length === 0) {
    return null;
  }

    return (
      <div style={{
        marginTop: '12px',
        padding: '16px',
        background: 'rgba(50, 52, 74, 0.8)',
        borderRadius: '12px'
      }}>
        {steps.map((step, idx) => {
          const stepStatus = step;
          
          return (
            <div key={idx} style={{
              padding: '16px',
              marginBottom: '12px',
              background: idx === 0 && stepStatus.status === 'pending' 
                ? 'rgba(54, 87, 197, 0.1)' 
                : stepStatus.status === 'executing'
                  ? 'rgba(54, 87, 197, 0.2)'
                  : stepStatus.status === 'done'
                    ? 'rgba(39, 174, 96, 0.1)'
                    : stepStatus.status === 'skipped'
                      ? 'rgba(189, 195, 199, 0.1)'
                      : stepStatus.status === 'failed'
                        ? 'rgba(231, 76, 60, 0.1)'
                        : '#3e415c',
              borderRadius: '8px',
              borderLeft: idx === 0 && stepStatus.status === 'pending'
                ? '4px solid #667eea'
                : stepStatus.status === 'done'
                  ? '4px solid #27ae60'
                  : stepStatus.status === 'skipped'
                    ? '4px solid #95a5a6'
                    : stepStatus.status === 'failed'
                      ? '4px solid #e74c3c'
                      : '4px solid #3e415c',
              animation: idx === 0 && stepStatus.status !== 'pending' 
                ? 'none' 
                : undefined
            }}>
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              marginBottom: '8px'
            }}>
              <span style={{
                fontSize: '12px',
                fontWeight: 600,
                color: idx === 0 && stepStatus.status === 'pending' ? '#667eea' : '#a9b1d6',
                background: idx === 0 && stepStatus.status === 'pending'
                  ? 'rgba(102, 126, 234, 0.15)'
                  : undefined,
                padding: '2px 8px',
                borderRadius: '4px'
              }}>
                {idx + 1}
              </span>
              <span style={{
                fontSize: '14px',
                color: stepStatus.status === 'failed' ? '#e74c3c' : '#a9b1d6',
                lineHeight: 1.5
              }}>
                {step.text}
              </span>
            </div>
            
            {(stepStatus.status === 'pending' || stepStatus.status === 'executing') && (
              <div style={{
                display: 'flex',
                gap: '8px',
                marginTop: '8px'
              }}>
                <button
                  onClick={() => {
                    const event = new CustomEvent('executeStep', { detail: { idx } });
                    window.dispatchEvent(event);
                  }}
                  disabled={stepStatus.status === 'executing'}
                  style={{
                    padding: '6px 12px',
                    borderRadius: '4px',
                    border: 'none',
                    background: stepStatus.status === 'pending' ? '#667eea' : '#3e415c',
                    color: 'white',
                    fontSize: '12px',
                    cursor: stepStatus.status === 'executing' ? 'not-allowed' : 'pointer',
                    transition: 'all 0.2s ease'
                  }}
                >
                  {stepStatus.status === 'pending' ? '执行' : '执行中...'}
                </button>
                
                <button
                  onClick={() => {
                    const event = new CustomEvent('skipStep', { detail: { idx } });
                    window.dispatchEvent(event);
                  }}
                  disabled={stepStatus.status === 'executing'}
                  style={{
                    padding: '6px 12px',
                    borderRadius: '4px',
                    border: 'none',
                    background: stepStatus.status === 'pending' ? '#3e415c' : '#95a5a6',
                    color: '#a9b1d6',
                    fontSize: '12px',
                    cursor: stepStatus.status === 'executing' ? 'not-allowed' : 'pointer'
                  }}
                >
                  跳过
                </button>
                
                <button
                  onClick={() => {
                    const event = new CustomEvent('explainStep', { detail: { text: step.text } });
                    window.dispatchEvent(event);
                  }}
                  disabled={stepStatus.status === 'executing'}
                  style={{
                    padding: '6px 12px',
                    borderRadius: '4px',
                    border: 'none',
                    background: stepStatus.status === 'pending' ? '#7f8c8d' : '#95a5a6',
                    color: '#ecf0f1',
                    fontSize: '12px',
                    cursor: stepStatus.status === 'executing' ? 'not-allowed' : 'pointer'
                  }}
                >
                  说明
                </button>
              </div>
            )}
            
            {stepStatus.status === 'done' && (
              <span style={{
                fontSize: '12px',
                color: '#27ae60',
                padding: '4px 8px',
                background: 'rgba(39, 174, 96, 0.15)',
                borderRadius: '4px'
              }}>
                ✓ 已完成
              </span>
            )}
            
            {stepStatus.status === 'skipped' && (
              <span style={{
                fontSize: '12px',
                color: '#95a5a6',
                padding: '4px 8px',
                background: 'rgba(149, 165, 166, 0.15)',
                borderRadius: '4px'
              }}>
                ↪ 已跳过
              </span>
            )}
            
            {stepStatus.status === 'failed' && (
              <span style={{
                fontSize: '12px',
                color: '#e74c3c',
                padding: '4px 8px',
                background: 'rgba(231, 76, 60, 0.15)',
                borderRadius: '4px'
              }}>
                ✗ 失败
              </span>
            )}
          </div>
        );
      })}
    </div>
  );
}

async function callTauriTool(toolName, toolArgs, onConfirm = null) {
  const payload = {
    cmd: toolName,
    args: toolArgs
  };
  
  if (typeof window.__TAURI_IPC__ !== 'undefined') {
    return await window.__TAURI_IPC__(payload);
  }
  
  try {
    const response = await fetch('http://127.0.0.1:1430', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    
    if (!response.ok) {
      throw new Error(`Tool ${toolName} failed: ${response.statusText}`);
    }
    
    const result = await response.json();
    return result;
  } catch (error) {
    throw error;
  }
}

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
  const [showAbout, setShowAbout] = useState(false);
  const [contextMenu, setContextMenu] = useState({ visible: false, x: 0, y: 0 });
  const [confirmedToolCall, setConfirmedToolCall] = useState(null);
  const [pendingToolCall, setPendingToolCall] = useState(null);
  const [retryCounts, setRetryCounts] = useState({});
  const [steps, setSteps] = useState([]);
  const [currentStepIndex, setCurrentStepIndex] = useState(-1);
  const [memoryData, setMemoryData] = useState({ os: "", tools: [], projects: [] });

  const tools = [
    {
      type: "function",
      function: {
        name: "run_command",
        description: "Run a shell command and return the output. Useful for executing system commands.",
        parameters: {
          type: "object",
          properties: {
            command: {
              type: "string",
              description: "The shell command to execute"
            }
          },
          required: ["command"]
        }
      }
    },
    {
      type: "function",
      function: {
        name: "take_screenshot",
        description: "Take a screenshot using gnome-screenshot and save it to /tmp/screenshot.png. Returns the file path.",
        parameters: {
          type: "object",
          properties: {}
        }
      }
    },
    {
      type: "function",
      function: {
        name: "read_dir",
        description: "Read a directory and return a list of entry names (excluding hidden files). Useful for exploring filesystem.",
        parameters: {
          type: "object",
          properties: {
            path: {
              type: "string",
              description: "The directory path to read"
            }
          },
          required: ["path"]
        }
      }
    }
  ];

  const getModePrompt = (mode) => {
    const prompts = {
      teach: "你是一个耐心的 AI 教师，擅长用简洁明了的方式讲解知识点，提供示例代码和最佳实践。",
      auto: "你是一个高效的 AI 编程助手，专注于自动完成编程任务、生成代码、修复 bug 和优化实现。直接给出解决方案。",
      monitor: "你是一个系统监控专家，负责分析日志、诊断问题、提供运维建议，并帮助理解系统状态。"
    };
    const modePrompt = prompts[mode] || prompts.teach;
    const toolsInstruction = `\n\n## 可用工具\n你有以下工具可用：\n1. run_command(command: string) - 执行 shell 命令并返回输出\n2. take_screenshot() - 截图保存到 /tmp/screenshot.png\n3. read_dir(path: string) - 列出目录内容（不包含隐藏文件）\n\n当用户请求需要执行命令、截图或查看文件时，使用工具调用。`;
    return modePrompt + toolsInstruction;
  };

  const handleModeChange = (newMode) => {
    setMode(newMode);
    localStorage.setItem('ai_mode', newMode);
    setSystemPrompt(getModePrompt(newMode));
    if (newMode !== 'teach') {
      setSteps([]);
      setCurrentStepIndex(-1);
    }
  };
  const chatRef = useRef(null);

  useEffect(() => {
    const loadMemoryFromStorage = async () => {
      try {
        let data;
        
        try {
          const stored = localStorage.getItem('ai_memory');
          if (stored) {
            data = JSON.parse(stored);
          }
        } catch (parseErr) {}
        
        if (data) {
          setMemoryData(data);
          
          if ((data.os || data.tools?.length > 0 || data.projects?.length > 0)) {
            setSystemPrompt(prev => {
              const contextSections = [];
              if (data.os) contextSections.push("操作系统: " + data.os);
              if (data.tools && data.tools.length > 0) contextSections.push("偏好工具: " + data.tools.join(", "));
              if (data.projects && data.projects.length > 0) contextSections.push("最近项目: " + data.projects.slice(-3).join("，"));
              
              return contextSections.length > 0 ? prev + "\n\n## 用户上下文\n" + contextSections.join("\n") : prev;
            });
          }
        }
      } catch (err) {
        console.error("加载记忆失败:", err);
      }
    };
    
    loadMemoryFromStorage();
    
    const savedMode = localStorage.getItem('ai_mode');
    if (savedMode && ['teach', 'auto', 'monitor'].includes(savedMode)) {
      setMode(savedMode);
      setSystemPrompt(getModePrompt(savedMode));
    }
    
    // 开始->被ana的热启动调用，activate时直接focus到前端
    import("@tauri-apps/plugin-shell")
      .then((module) => module.listenShortcut({ combo: "Super+Space" }))
      .catch(() => { /* 自动隐藏 */ });
    
    const savedTheme = localStorage.getItem('theme');
    if (savedTheme && ['dark', 'light'].includes(savedTheme)) {
      document.documentElement.setAttribute('data-theme', savedTheme);
    } else if (!savedTheme) {
      document.documentElement.setAttribute('data-theme', 'dark');
    }
    
    // 滚动到底部
    if (chatRef.current) {
      chatRef.current.scrollTop = chatRef.current.scrollHeight;
    }
  }, []);

  useEffect(() => {
    const handleExecute = (e) => {
      e.stopPropagation();
      if (mode !== 'teach') return;
      
      const { idx } = e.detail;
      setSteps(prevSteps => {
        if (idx < 0 || idx >= prevSteps.length) return prevSteps;
        
        setCurrentStepIndex(idx);
        
        const step = prevSteps[idx];
        if (!step || !step.toolCall) return prevSteps;
        
        executeStep(idx, step.toolCall).then(() => {
          setSteps(currentSteps => {
            currentSteps[idx] = { ...currentSteps[idx], status: 'done' };
            
            if (idx < currentSteps.length - 1) {
              const nextIdx = idx + 1;
              setCurrentStepIndex(nextIdx);
              
              return currentSteps.map((s, i) =>
                i === nextIdx ? { ...s, status: 'pending' } : s
              );
            }
            
            return [...currentSteps];
          });
        }).catch(() => {
          console.error('Execution failed');
        });
        
        return prevSteps.map((s, i) =>
          i === idx ? { ...s, status: 'executing' } : s
        );
      });
    };

    const handleSkip = (e) => {
      e.stopPropagation();
      if (mode !== 'teach') return;
      
      const { idx } = e.detail;
      setSteps(prevSteps => prevSteps.map((s, i) =>
        i === idx ? { ...s, status: 'skipped' } : s
      ));
    };

    window.addEventListener('executeStep', handleExecute);
    window.addEventListener('skipStep', handleSkip);

    return () => {
      window.removeEventListener('executeStep', handleExecute);
      window.removeEventListener('skipStep', handleSkip);
    };
  }, [mode]);

  const handleSend = async () => {
    if (!input.trim()) return;

    const trimmedInput = input.trim();
    
    if (trimmedInput === "/clear") {
      handleClearConversation();
      setInput("");
      return;
    }

    if (mode === 'teach' && currentStepIndex >= 0 && currentStepIndex < steps.length) {
      await executeCurrentStep();
      return;
    }

    const userMsg = { id: Date.now(), sender: "user", text: input.trim() };
    setMessages(prev => [...prev, userMsg]);
    setInput("");
    setIsSending(true);
    setError(null);

    try {
      let messagesToSend = [
        { role: "system", content: systemPrompt },
        ...messages,
        userMsg
      ].map(m => ({
        role: m.sender === "user" ? "user" : "assistant",
        content: m.text
      }));

      while (true) {
        const apiUrl = settings.apiUrl || 'http://127.0.0.1:8082/v1/chat/completions';
        const model = 'coder-next';

        const response = await fetch(apiUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...(settings.apiKey && { Authorization: `Bearer ${settings.apiKey}` })
          },
          body: JSON.stringify({
            model: model,
            messages: messagesToSend,
            stream: true,
            tools: tools
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
        let toolCalls = null;

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
                
                const newToolCalls = parsed.choices?.[0]?.delta?.tool_calls;
                if (newToolCalls) {
                  toolCalls = newToolCalls;
                }
                
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

        if (toolCalls && toolCalls.length > 0) {
          for (const toolCall of toolCalls) {
            const toolId = toolCall.id;
            const toolName = toolCall.function.name;
            let toolArgs = {};
            
            try {
              toolArgs = JSON.parse(toolCall.function.arguments || '{}');
            } catch (e) {
              console.error('解析工具参数失败:', e);
              continue;
            }

            if (toolName === 'run_command' && isDangerousCommand(toolArgs.command)) {
              setPendingToolCall({ toolName, toolArgs });
              
              while (pendingToolCall !== null) {
                await new Promise(resolve => setTimeout(resolve, 50));
              }
              
              if (confirmedToolCall === false) {
                return { cancelled: true, reason: 'USER_CANCELLED' };
              }
            }

            let result = null;
            let lastError = null;

            const retryCount = retryCounts[toolId] || 0;

            try {
              result = await callTauriTool(toolName, toolArgs);
            } catch (error) {
              console.error(`工具 ${toolName} 执行失败:`, error);
              
              if (retryCount >= 1) {
                setMessages(prev => [
                  ...prev,
                  { 
                    id: Date.now(), 
                    sender: "tool", 
                    text: `❌ 工具 ${toolName} 执行失败: ${error.message}` 
                  }
                ]);
                
                setError(error.message || '工具执行失败');
                
                messagesToSend = [
                  ...messagesToSend,
                  {
                    role: "assistant",
                    content: fullResponse,
                    tool_calls: [toolCall]
                  },
                  {
                    role: "tool",
                    name: toolName,
                    content: `Error: ${error.message}`
                  }
                ];
                
                setRetryCounts(prev => ({ ...prev, [toolId]: retryCount + 1 }));
                continue;
              }

              setMessages(prev => [
                ...prev,
                { 
                  id: Date.now(), 
                  sender: "tool", 
                    text: `❌ 工具 ${toolName} 执行失败，正在重试...` 
                }
              ]);

              lastError = error;

              if (lastError.message === 'CANCELLED') {
                messagesToSend = [
                  ...messagesToSend,
                  {
                    role: "assistant",
                    content: fullResponse,
                    tool_calls: [toolCall]
                  },
                  {
                    role: "tool",
                    name: toolName,
                    content: `Tool execution was cancelled by the user.`
                  }
                ];
              } else {
                messagesToSend = [
                  ...messagesToSend,
                  {
                    role: "assistant",
                    content: fullResponse,
                    tool_calls: [toolCall]
                  },
                  {
                    role: "user",
                    content: `The tool ${toolName} failed: ${lastError.message}. Try a different approach.`
                  }
                ];
              }

              setRetryCounts(prev => ({ ...prev, [toolId]: retryCount + 1 }));
              continue;
            }

            setRetryCounts(prev => {
              const newCounts = { ...prev };
              delete newCounts[toolId];
              return newCounts;
            });

            if (result) {
              setMessages(prev => [
                ...prev,
                { 
                  id: Date.now(), 
                  sender: "tool", 
                  text: `🛠️ 工具 ${toolName} 结果:\n\`\`\`json\n${JSON.stringify(result, null, 2)}\n\`\`\`` 
                }
              ]);

              messagesToSend = [
                ...messagesToSend,
                {
                  role: "assistant",
                  content: fullResponse,
                  tool_calls: [toolCall]
                },
                {
                  role: "tool",
                  name: toolName,
                  content: JSON.stringify(result)
                }
              ];
            }
          }
          
          continue;
        }

        if (mode === 'teach' && fullResponse.trim()) {
          const stepPattern = /(\d+)\.\s+(.+?)(?=\n\d+\.|\n\n|$)/g;
          let match;
          const parsedSteps = [];
          
          while ((match = stepPattern.exec(fullResponse)) !== null) {
            parsedSteps.push({
              number: parseInt(match[1]),
              text: match[2].trim(),
              status: 'pending'
            });
          }

          if (parsedSteps.length > 0 && toolCalls) {
            toolCalls.forEach((tc, idx) => {
              if (idx < parsedSteps.length) {
                parsedSteps[idx] = { ...parsedSteps[idx], toolCall: tc };
              }
            });
          }

          if (parsedSteps.length > 0) {
            setSteps(parsedSteps);
            setCurrentStepIndex(0);
            
            const stepMsg = { 
              id: Date.now(), 
              sender: "ai", 
              text: fullResponse,
              steps: parsedSteps
            };
            
            setMessages(prev => [...prev, stepMsg]);
          }
        }

        break;
      }
      
      await checkAndSummarize();
      
      const aiMessage = messages.find(m => m.sender === "ai" && !m.steps);
      if (aiMessage) {
        await saveMemory();
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
  
  const checkAndSummarize = async () => {
    const totalMessages = messages.filter(m => m.sender === "user" || m.sender === "ai").length;
    
    if (totalMessages >= 60) {
      await summarizeConversation();
    }
  };

  const saveMemory = async () => {
    try {
      const osInfo = window.navigator.userAgent;
      const currentTools = [...(memoryData.tools || [])];
      const newProjects = [];
      
      for (const msg of messages.slice(-5)) {
        if (msg.sender === "ai" && msg.text) {
          const textLower = msg.text.toLowerCase();
          
          if (/项目|project|workspace|repo/i.test(textLower)) {
            const projectMatch = msg.text.match(/(['"`]\/[\s\S]+?['"`])|(\w+\/\w+)/);
            if (projectMatch && projectMatch[0]) {
              newProjects.push(projectMatch[0].replace(/['"`]/g, ""));
            }
          }
          
          if (/工具|package|npm|pip|cargo/i.test(textLower)) {
            const toolMatches = msg.text.matchAll(/(['"`]\w+['"`]|\b(react|vue|angular|nextjs|nodejs|python|go|Rust)\b)/gi);
            for (const match of toolMatches) {
              if (match[0] && !currentTools.includes(match[0].replace(/['"`]/g, ""))) {
                currentTools.push(match[0].replace(/['"`]/g, ""));
              }
            }
          }
        }
      }
      
      const memorySummary = {
        os: osInfo,
        tools: Array.from(new Set(currentTools.slice(-10))),
        projects: newProjects.slice(-5),
        updatedAt: new Date().toISOString()
      };
      
      try {
        const configDir = await path.appConfigDir("ai-desktop");
        
        if (typeof window.__TAURI_IPC__ !== 'undefined') {
          // Try using Tauri IPC to write to file
          try {
            const fsModule = await import("@tauri-apps/plugin-fs");
            
            try {
              await fsModule.mkdir(configDir, { recursive: true });
            } catch (err) {}
            
            await fsModule.writeFile(
              configDir + "/memory.json",
              new TextEncoder().encode(JSON.stringify(memorySummary, null, 2))
            );
          } catch (fsErr) {
            localStorage.setItem('ai_memory', JSON.stringify(memorySummary));
          }
        } else {
          localStorage.setItem('ai_memory', JSON.stringify(memorySummary));
        }
      } catch (err) {
        localStorage.setItem('ai_memory', JSON.stringify(memorySummary));
      }
    } catch (err) {
      console.error("保存记忆失败:", err);
    }
  };

  const summarizeConversation = async () => {
    try {
      const recentMessages = messages.slice(-20);
      const oldMessages = messages.slice(0, -20);
      
      let summaryContext = "";
      for (const msg of oldMessages) {
        if (msg.sender === "user" || msg.sender === "ai") {
          summaryContext += msg.sender === "user" ? "用户: " + msg.text : "AI: " + msg.text;
          summaryContext += "\n";
        }
      }
      
      const apiUrl = settings.apiUrl || 'http://127.0.0.1:8082/v1/chat/completions';
      
      const response = await fetch(apiUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(settings.apiKey && { Authorization: `Bearer ${settings.apiKey}` })
        },
        body: JSON.stringify({
          model: 'coder-next',
          messages: [
            { 
              role: "system", 
              content: "请将以下对话历史总结为一条简洁的系统上下文消息，保留关键信息。输出应为一段连贯的文字：" 
            },
            { 
              role: "user", 
              content: summaryContext 
            }
          ],
          stream: false
        })
      });
      
      if (response.ok) {
        const data = await response.json();
        const summaryText = data.choices?.[0]?.message?.content || "";
        
        if (summaryText.trim()) {
          setMessages(prev => [
            { id: Date.now(), sender: "system", text: "## 历史对话总结\n" + summaryText },
            ...recentMessages
          ]);
        }
      }
    } catch (error) {
      console.error("对话总结失败:", error);
    }
  };

  const handleClearConversation = () => {
    setMessages([
      { id: Date.now(), sender: "ai", text: "你好！我是你的 AI 助手。需要什么帮助？" }
    ]);
    setInput("");
    setError(null);
    
    if (mode === 'teach') {
      setSteps([]);
      setCurrentStepIndex(-1);
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

  const toggleDarkMode = () => {
    const currentTheme = document.documentElement.getAttribute('data-theme');
    const newTheme = currentTheme === 'dark' ? 'light' : 'dark';
    document.documentElement.setAttribute('data-theme', newTheme);
    localStorage.setItem('theme', newTheme);
  };

  const executeStep = async (stepIndex, toolCall) => {
    if (!toolCall || !toolCall.function || !toolCall.function.arguments) return;
    
    setSteps(prevSteps => prevSteps.map((s, i) => 
      i === stepIndex ? { ...s, status: 'executing' } : s
    ));
    
    try {
      const toolArgs = JSON.parse(toolCall.function.arguments);
      const result = await callTauriTool(
        toolCall.function.name,
        toolArgs
      );
      
      setSteps(prevSteps => prevSteps.map((s, i) => 
        i === stepIndex ? { ...s, status: 'done' } : s
      ));
      
      if (stepIndex < steps.length - 1 && mode === 'teach') {
        await new Promise(resolve => setTimeout(resolve, 500));
        const nextStep = steps[stepIndex + 1];
        setSteps(prevSteps => prevSteps.map((s, i) =>
          i === stepIndex + 1 ? { ...s, status: 'pending' } : s
        ));
      }
      
      return result;
    } catch (error) {
      console.error(`Step ${stepIndex} failed:`, error);
      
      setSteps(prevSteps => prevSteps.map((s, i) =>
        i === stepIndex ? { ...s, status: 'failed' } : s
      ));
      
      throw error;
    }
  };

  const skipStep = (stepIndex) => {
    setSteps(prevSteps => prevSteps.map((s, i) =>
      i === stepIndex ? { ...s, status: 'skipped' } : s
    ));
    
    if (stepIndex < steps.length - 1 && mode === 'teach') {
      const nextStep = steps[stepIndex + 1];
      setSteps(prevSteps => prevSteps.map((s, i) =>
        i === stepIndex + 1 ? { ...s, status: 'pending' } : s
      ));
    }
  };

  const executeCurrentStep = async () => {
    if (currentStepIndex < 0 || currentStepIndex >= steps.length) return;
    
    setSteps(prevSteps => prevSteps.map((s, i) =>
      i === currentStepIndex ? { ...s, status: 'executing' } : s
    ));
    
    try {
      const step = steps[currentStepIndex];
      if (step && step.toolCall) {
        await executeStep(currentStepIndex, step.toolCall);
      }
      
      setSteps(prevSteps => prevSteps.map((s, i) =>
        i === currentStepIndex ? { ...s, status: 'done' } : s
      ));
      
      setCurrentStepIndex(prev => prev + 1);
    } catch (error) {
      console.error('Step execution failed:', error);
    }
  };

  const closeError = () => setError(null);

  const showContextResponseMenu = (x, y) => {
    setContextMenu({ visible: true, x, y });
  };

  const closeContextMenu = () => {
    setContextMenu({ visible: false, x: 0, y: 0 });
  };

  const handleRightClick = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setShowSettings(true);
  };

   // 简单设置弹窗
  const SettingsModal = () => (
    <div style={{
      position: 'fixed',
      top: 0, left: 0, right: 0, bottom: 0,
      background: 'rgba(12,12,20,0.85)',
      backdropFilter: 'blur(6px)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 1000
    }}>
      <div style={{
        background: '#2d2f46',
        borderRadius: '20px',
        padding: '40px',
        width: '450px',
        maxWidth: '90%',
        boxShadow: '0 12px 48px rgba(0,0,0,0.6), inset 1px 0 0 rgba(255,255,255,0.05)',
        border: '1px solid #3e415c'
      }}>
         <h2 style={{ marginBottom: '28px', fontSize: '22px', background: 'linear-gradient(135deg, #ffffff 0%, #a9b1d6 100%)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>⚙️ AI 设置</h2>
         
        <form onSubmit={handleSaveSettings}>
          <div style={{ marginBottom: '18px' }}>
            <label style={{ display: 'block', marginBottom: 8, fontWeight: 600, fontSize: 14, color: '#a9b1d6' }}>
              AI 提供商
            </label>
            <select
              value={settings.provider}
              onChange={(e) => setSettings({...settings, provider: e.target.value})}
              style={{ width: '100%', padding: '12px 16px', borderRadius: '8px', border: '1px solid #3e415c', background: '#1a1b2e', color: '#ffffff' }}
            >
               <option value="mock">模拟（测试用）</option>
              <option value="deepseek">DeepSeek</option>
              <option value="openai">OpenAI</option>
              <option value="llama-cpp" selected>llama.cpp (本地)</option>
              <option value="ollama">Ollama (本地)</option>
            </select>
          </div>

          {settings.provider !== 'mock' && (
            <>
              <div style={{ marginBottom: '18px' }}>
                <label style={{ display: 'block', marginBottom: 8, fontWeight: 600, fontSize: 14, color: '#a9b1d6' }}>
                  API Key
                </label>
                <input
                  type="password"
                  value={settings.apiKey}
                  onChange={(e) => setSettings({...settings, apiKey: e.target.value})}
                  placeholder="sk-***"
                  style={{ width: '100%', padding: '12px 16px', borderRadius: '8px', border: '1px solid #3e415c', background: '#1a1b2e', color: '#ffffff' }}
                />
              </div>

              <div style={{ marginBottom: '18px' }}>
                <label style={{ display: 'block', marginBottom: 8, fontWeight: 600, fontSize: 14, color: '#a9b1d6' }}>
                  API URL
                </label>
                <input
                  type="url"
                  value={settings.apiUrl}
                  onChange={(e) => setSettings({...settings, apiUrl: e.target.value})}
                  placeholder="http://127.0.0.1:8082/v1/chat/completions"
                  style={{ width: '100%', padding: '12px 16px', borderRadius: '8px', border: '1px solid #3e415c', background: '#1a1b2e', color: '#ffffff' }}
                />
              </div>
            </>
          )}

          <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
            {error && (
              <span style={{
                padding: '10px 16px',
                background: 'rgba(239,68,68,0.1)',
                color: '#ef4444',
                fontSize: '14px',
                borderRadius: '6px'
              }}>
                错误：{error}
              </span>
            )}
            <button
              type="button"
              onClick={() => setShowSettings(false)}
              style={{
                padding: '10px 24px',
                borderRadius: '8px',
                border: 'none',
                background: '#3e415c',
                color: '#a9b1d6',
                cursor: 'pointer'
              }}
            >
              取消
            </button>
            <button
              type="submit"
              style={{
                padding: '10px 24px',
                borderRadius: '8px',
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
            padding: '12px 16px', 
            background: 'rgba(239,68,68,0.1)', 
            borderRadius: '8px',
            color: '#ef4444',
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
                color: '#ef4444',
                fontWeight: 600
              }}
            >
              ×
            </button>
          </div>
        )}
      </div>
    </div>
  );

  // About dialog
  const AboutDialog = () => (
    <div style={{
      position: 'fixed',
      top: 0, left: 0, right: 0, bottom: 0,
      background: 'rgba(12,12,20,0.8)',
      backdropFilter: 'blur(6px)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 2000
    }}>
      <div style={{
        background: 'var(--bg-panel-dark)',
        borderRadius: '24px',
        padding: '48px',
        width: '360px',
        maxWidth: '90%',
        boxShadow: '0 16px 64px rgba(0,0,0,0.7)'
      }}>
        <h3 style={{ fontSize: '28px', marginBottom: '16px', background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
          AI Desktop
        </h3>
        <p style={{ color: '#a9b1d6', marginBottom: '8px' }}>版本信息</p>
        <div style={{ fontSize: '24px', fontWeight: 'bold', background: 'linear-gradient(135deg, #ffffff 0%, #a9b1d6 100%)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
          v0.1.0
        </div>
        <p style={{ color: '#a9b1d6', fontSize: '14px', marginTop: '24px' }}>AI 桌面助手</p>
        <button
          onClick={() => setShowAbout(false)}
          style={{
            marginTop: '32px',
            width: '100%',
            padding: '12px 32px',
            borderRadius: '8px',
            background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
            color: 'white',
            border: 'none',
            fontSize: '15px',
            fontWeight: 'bold',
            cursor: 'pointer'
          }}
        >
          关闭
        </button>
      </div>
    </div>
  );

  const ConfirmationDialog = () => {
    if (!pendingToolCall) return null;
    
    const handleConfirm = (confirmed) => {
      setConfirmedToolCall(confirmed ? pendingToolCall : false);
      setPendingToolCall(null);
    };

    const command = pendingToolCall.toolArgs.command || '';
    
    return (
      <div style={{
        position: 'fixed',
        top: 0, left: 0, right: 0, bottom: 0,
        background: 'rgba(12,12,20,0.85)',
        backdropFilter: 'blur(6px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 4000
      }}>
        <div style={{
          background: '#2d2f46',
          borderRadius: '20px',
          padding: '40px',
          width: '500px',
          maxWidth: '90%',
          boxShadow: '0 12px 48px rgba(0,0,0,0.6), inset 1px 0 0 rgba(255,255,255,0.05)',
          border: '1px solid #3e415c'
        }}>
           <h2 style={{ marginBottom: '20px', fontSize: '22px', background: 'linear-gradient(135deg, #ffffff 0%, #a9b1d6 100%)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>⚠️ 确认危险操作</h2>
          <p style={{ color: '#ef4444', marginBottom: '24px', fontSize: '15px' }}>
            AI 想要执行以下危险命令，这可能造成数据丢失或系统损坏：
          </p>
          
          <div style={{
            marginBottom: '30px',
            padding: '20px 24px',
            background: 'rgba(239,68,68,0.1)',
            borderRadius: '12px',
            borderLeft: '4px solid #ef4444'
          }}>
            <code style={{ color: '#a9b1d6', fontFamily: '"Fira Code", "Consolas", monospace' }}>{command}</code>
          </div>

          <p style={{ color: '#a9b1d6', marginBottom: '32px', fontSize: '14px', lineHeight: 1.5 }}>
            是否继续执行？如果不确定，请取消操作。
          </p>

          <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
            <button
              onClick={() => handleConfirm(false)}
              style={{
                padding: '12px 32px',
                borderRadius: '8px',
                border: 'none',
                background: '#3e415c',
                color: '#a9b1d6',
                cursor: 'pointer',
                fontSize: '15px'
              }}
            >
              取消
            </button>
            <button
              onClick={() => handleConfirm(true)}
              style={{
                padding: '12px 32px',
                borderRadius: '8px',
                background: '#ef4444',
                color: 'white',
                border: 'none',
                cursor: 'pointer',
                fontSize: '15px'
              }}
            >
              继续执行
            </button>
          </div>
        </div>
      </div>
    );
  };

   // 欢迎向导
  const WelcomeWizard = () => (
    <div style={{
      position: 'fixed',
      top: 0, left: 0, right: 0, bottom: 0,
      background: 'rgba(12,12,20,0.85)',
      backdropFilter: 'blur(6px)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 1000
    }}>
      <div style={{
        background: '#2d2f46',
        borderRadius: '20px',
        padding: '40px',
        width: '450px',
        maxWidth: '90%',
        boxShadow: '0 12px 48px rgba(0,0,0,0.6), inset 1px 0 0 rgba(255,255,255,0.05)',
        border: '1px solid #3e415c'
      }}>
         <h2 style={{ marginBottom: '16px', fontSize: '24px', background: 'linear-gradient(135deg, #ffffff 0%, #a9b1d6 100%)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>🤖 欢迎使用 AI Desktop</h2>
        <p style={{ marginBottom: '24px', color: '#a9b1d6' }}>
          在开始之前，请先配置你的 AI 接口。
        </p>
        
<div style={{ marginBottom: '28px', padding: '20px 24px', background: 'linear-gradient(135deg, rgba(102,126,234,0.1) 0%, rgba(118,75,162,0.1) 100%)', borderRadius: '16px' }}>
          <h3 style={{ fontSize: '15px', marginBottom: '12px', color: '#ffffff', fontWeight: 600 }}>推荐配置：</h3>
          <ul style={{ fontSize: '14px', color: '#a9b1d6', margin: 0, paddingLeft: '24px' }}>
            <li><strong>AI 提供商：</strong> llama.cpp</li>
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
            padding: '16px',
            borderRadius: '12px',
            background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
            color: 'white',
            border: 'none',
            fontSize: '16px',
            fontWeight: 600,
            cursor: 'pointer',
            boxShadow: '0 8px 24px rgba(102,126,234,0.35)'
          }}
        >
          开始配置
        </button>
      </div>
    </div>
  );

    return (
      <div className="ai-sidebar" style={{ display: show ? "flex" : "none" }}>
        {showAbout && <AboutDialog />}
        {showSettings && <SettingsModal />}
        {showWelcome && <WelcomeWizard />}
        {pendingToolCall && <ConfirmationDialog />}

      {contextMenu.visible && (
        <div
          style={{
            position: 'fixed',
            top: contextMenu.y,
            left: contextMenu.x - 150,
            background: 'rgba(26, 27, 46, 0.98)',
            borderRadius: '12px',
            padding: '8px 0',
            boxShadow: '0 8px 32px rgba(0, 0, 0, 0.5)',
            zIndex: 3000,
            minWidth: '160px'
          }}
          onClick={closeContextMenu}
        >
          <button
            onClick={(e) => {
              e.stopPropagation();
              toggleDarkMode();
              closeContextMenu();
            }}
            style={{
              width: '100%',
              padding: '12px 20px',
              background: 'none',
              border: 'none',
              color: '#a9b1d6',
              fontSize: '14px',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '8px'
            }}
          >
            🌗 切换深色模式
          </button>
          <div style={{
            height: '1px',
            background: '#3e415c',
            margin: '4px 0'
          }} />
          <button
            onClick={(e) => {
              e.stopPropagation();
              setShowAbout(true);
              closeContextMenu();
            }}
            style={{
              width: '100%',
              padding: '12px 20px',
              background: 'none',
              border: 'none',
              color: '#a9b1d6',
              fontSize: '14px',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '8px'
            }}
          >
            ℹ️ 关于
          </button>
        </div>
      )}
      
      <div className="header" onContextMenu={handleRightClick}>
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
        
        <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
          <span className="status-dot" style={{ background: error ? '#e74c3c' : '#27ae60' }} title={error ? '错误' : '在线'} />
          <button
            onClick={toggleDarkMode}
            style={{
              background: 'transparent',
              border: 'none',
              color: 'white',
              fontSize: '20px',
              cursor: 'pointer',
              padding: '4px 8px',
              borderRadius: '6px',
              transition: 'all 0.3s ease'
            }}
            title="切换深色模式"
          >
            🌗
          </button>
          <button
            onClick={() => setShowSettings(true)}
            onContextMenu={(e) => {
              e.preventDefault();
              const rect = e.currentTarget.getBoundingClientRect();
              showContextResponseMenu(rect.right, rect.top);
            }}
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
          <div key={`${msg.id}`} className={`message ${msg.sender}`}>
            <span className="avatar">{msg.sender === "ai" ? "🤖" : "👤"}</span>
            <div className="bubble">
              {mode === 'teach' && msg.steps ? (
                <>
                  <StepMessage message={msg} mode={mode} />
                  <p style={{ color: '#a9b1d6', marginBottom: 0 }}>{msg.text}</p>
                </>
              ) : (
                msg.text
              )}
            </div>
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
