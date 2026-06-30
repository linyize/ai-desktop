import { useState, useEffect, useRef } from "react";
import * as path from "@tauri-apps/api/path";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { version } from "../package.json";

import StepMessage from "./components/StepMessage";
import SettingsModal from "./components/SettingsModal";
import ConfirmationDialog from "./components/ConfirmationDialog";
import WelcomeWizard from "./components/WelcomeWizard";
import AboutDialog from "./components/AboutDialog";

import { dangerousPatterns, isDangerousCommand } from "./utils/tools";
import { callTauriTool } from "./utils/tools";
import { loadPersistentMemory } from "./utils/memory";

function getModePrompt(mode, context = "") {
  const prompts = {
    teach: "你是一个耐心的 AI 教师，擅长用简洁明了的方式讲解知识点，提供示例代码和最佳实践。",
    auto: "你是一个高效的 AI 编程助手，专注于自动完成编程任务、生成代码、修复 bug 和优化实现。直接给出解决方案。",
    monitor: "你是一个系统监控专家，负责分析日志、诊断问题、提供运维建议，并帮助理解系统状态。"
  };
  const modePrompt = prompts[mode] || prompts.teach;
  const toolsInstruction = `\n\n## 可用工具\n你有以下工具可用：\n1. run_command(command: string) - 执行 shell 命令并返回输出\n2. take_screenshot() - 截图保存到 /tmp/screenshot.png\n3. read_dir(path: string) - 列出目录内容（不包含隐藏文件）\n\n当用户请求需要执行命令、截图或查看文件时，使用工具调用。`;
  let finalPrompt = modePrompt + toolsInstruction;
  
  if (context && context.trim()) {
    finalPrompt += `\n\n## 用户上下文\n${context}`;
  }
  
  return finalPrompt;
}

export default function App() {
  const [show, setShow] = useState(true);
  const [input, setInput] = useState("");
  const [mode, setMode] = useState("teach");
  const [messages, setMessages] = useState([
    { id: 1, sender: "ai", text: `你好！我是你的 AI 助手 v${version}。需要什么帮助？` }
  ]);
  const [isSending, setIsSending] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [settings, setSettings] = useState({
    provider: localStorage.getItem('ai_provider') || 'mock',
    apiKey: localStorage.getItem('api_key') || '',
    apiUrl: localStorage.getItem('api_url') || '',
    voiceEnabled: localStorage.getItem('voice_enabled') === 'true',
    voiceGatewayUrl: localStorage.getItem('voice_gateway_url') || 'http://127.0.0.1:8766',
    voiceToken: localStorage.getItem('voice_token') || ''
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
  const [memoryData, setMemoryData] = useState({ os: "", settings: [], habits: [] });
  const [isRecording, setIsRecording] = useState(false);
  const mediaRecorderRef = useRef(null);
  const audioChunksRef = useRef([]);

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

  const handleModeChange = (newMode) => {
    setMode(newMode);
    localStorage.setItem('ai_mode', newMode);
    
    let contextText = "";
    if (memoryData.os || memoryData.settings?.length > 0 || memoryData.habits?.length > 0) {
      const contextSections = [];
      if (memoryData.os) contextSections.push(`操作系统: ${memoryData.os}`);
      if (memoryData.settings && memoryData.settings.length > 0) contextSections.push(`偏好设置: ${memoryData.settings.join(", ")}`);
      if (memoryData.habits && memoryData.habits.length > 0) contextSections.push(`用户习惯: ${memoryData.habits.slice(-5).join("；")}`);
      
      contextText = contextSections.join("\n");
    }
    
    setSystemPrompt(getModePrompt(newMode, contextText));
    if (newMode !== 'teach') {
      setSteps([]);
      setCurrentStepIndex(-1);
    }
  };
  
  const chatRef = useRef(null);

  useEffect(() => {
    const loadPersistentMemoryWrapper = async () => {
      try {
        let data;
        
        try {
          const configDirResult = await callTauriTool("run_command", { command: "echo -n ~/.config/ai-desktop" });
          if (configDirResult && configDirResult.stdout) {
            const configDir = configDirResult.stdout.trim();
            
            try {
              const memoryFileContent = await callTauriTool("run_command", { 
                command: `cat ${configDir}/memory.json 2>/dev/null` 
              });
              
              if (memoryFileContent && memoryFileContent.stdout) {
                data = JSON.parse(memoryFileContent.stdout.trim());
              }
            } catch (err) {}
          }
        } catch (fileErr) {}
        
        const configDirResult = await callTauriTool("run_command", { command: "echo -n ~/.config/ai-desktop" });
        if (configDirResult && configDirResult.stdout) {
          const configDir = configDirResult.stdout.trim();
          
          try {
            const mkdirResult = await callTauriTool("run_command", { 
              command: `mkdir -p ${configDir}` 
            });
          } catch (err) {}
        }
        
        let loadedFromLocalStorage = false;
        if (!data && typeof window.__TAURI_IPC__ !== 'undefined') {
          try {
            const stored = localStorage.getItem('ai_memory');
            if (stored) {
              data = JSON.parse(stored);
              loadedFromLocalStorage = true;
            }
          } catch (parseErr) {}
        }
        
        if (data) {
          let normalizedData = data;
          
          if (loadedFromLocalStorage && !data.settings) {
            normalizedData = {
              os: data.os || "",
              settings: Array.isArray(data.tools) ? data.tools.map(t => `工具偏好: ${t}`) : [],
              habits: Array.isArray(data.projects) ? data.projects.map(p => `项目相关: ${p}`) : []
            };
          }
          
          setMemoryData(normalizedData);
          
          if ((normalizedData.os || normalizedData.settings?.length > 0 || normalizedData.habits?.length > 0)) {
            const contextSections = [];
            if (normalizedData.os) contextSections.push(`操作系统: ${normalizedData.os}`);
            if (normalizedData.settings && normalizedData.settings.length > 0) contextSections.push(`偏好设置: ${normalizedData.settings.join(", ")}`);
            if (normalizedData.habits && normalizedData.habits.length > 0) contextSections.push(`用户习惯: ${normalizedData.habits.slice(-5).join("；")}`);
            
            setSystemPrompt(prev => {
              const contextText = contextSections.length > 0 ? contextSections.join("\n") : "";
              return getModePrompt(mode, contextText);
            });
          }
        }
      } catch (err) {
        console.error("加载持久化记忆失败:", err);
      }
    };
    
    loadPersistentMemoryWrapper();
    
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
    
    if (trimmedInput.startsWith("/clear")) {
      handleClearConversation(trimmedInput);
      setInput("");
      return;
    }

    if (mode === 'teach' && currentStepIndex >= 0 && currentStepIndex < steps.length) {
      await executeCurrentStep();
      return;
    }

    const userMsg = { id: Date.now(), sender: "user", text: input.trim() };
    
    if (messages.length > 60) {
      await checkAndSummarize();
    }
    
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

  const checkAndSummarize = async () => {
    const recentMessages = messages.filter(m => m.sender === "user" || m.sender === "ai");
    
    if (messages.length > 60) {
      await summarizeConversation();
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };
  
  const saveMemory = async () => {
    try {
      const osInfoResult = await callTauriTool("run_command", { command: "uname -a" });
      const osInfo = (osInfoResult && osInfoResult.stdout) ? osInfoResult.stdout.trim() : window.navigator.userAgent;
      
      let newSettings = [];
      let newHabits = [];
      
      for (const msg of messages.slice(-10)) {
        if (msg.sender === "user" || msg.sender === "ai") {
          const textLower = msg.text.toLowerCase();
          
          if (/设置|config|偏好|preference/i.test(textLower) && settings.provider !== 'mock') {
            if (!newSettings.includes(`AI提供商: ${settings.provider}`)) {
              newSettings.push(`AI提供商: ${settings.provider}`);
            }
          }
          
          const habitKeywords = ["习惯", "经常", "通常", "偏好", "喜欢"];
          for (const keyword of habitKeywords) {
            if (textLower.includes(keyword)) {
              const extractedHabit = msg.text.trim().substring(0, 100);
              if (extractedHabit && !newHabits.includes(extractedHabit)) {
                newHabits.push(extractedHabit);
              }
            }
          }
        }
      }
      
      const combinedSettings = Array.from(new Set([...(memoryData.settings || []), ...newSettings])).slice(-10);
      const combinedHabits = Array.from(new Set([...(memoryData.habits || []), ...newHabits])).slice(-5);
      
      const memorySummary = {
        os: osInfo,
        settings: combinedSettings,
        habits: combinedHabits,
        updatedAt: new Date().toISOString()
      };
      
      try {
        const configDirResult = await callTauriTool("run_command", { command: "echo -n ~/.config/ai-desktop" });
        if (configDirResult && configDirResult.stdout) {
          const configDir = configDirResult.stdout.trim();
          
          try {
            await callTauriTool("run_command", { 
              command: `mkdir -p ${configDir}` 
            });
          } catch (err) {}
          
          const memoryFileContent = JSON.stringify(memorySummary, null, 2);
          
          if (memoryFileContent.split('\n').length > 50) {
            memorySummary.habits = memorySummary.habits.slice(-3);
            memorySummary.settings = memorySummary.settings.slice(-5);
            memorySummary.updatedAt = new Date().toISOString();
          }
          
          const escapedConfigDir = configDir.replace(/'/g, "'\"'\"'");
          await callTauriTool("run_command", {
            command: `cat > ${escapedConfigDir}/memory.json << 'MEMORYEOF'\n${JSON.stringify(memorySummary, null, 2)}\nMEMORYEOF`
          });
        }
      } catch (err) {
        console.error("写入持久化记忆失败:", err);
        try {
          const stored = localStorage.getItem('ai_memory');
          if (!stored) {
            localStorage.setItem('ai_memory', JSON.stringify(memorySummary));
          }
        } catch (localErr) {}
      }
    } catch (err) {
      console.error("保存记忆失败:", err);
    }
  };

  const summarizeConversation = async () => {
    try {
      const keepMessages = messages.slice(-20);
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
            ...keepMessages
          ]);
        }
      }
    } catch (error) {
      console.error("对话总结失败:", error);
    }
  };

  const handleClearConversation = (inputText) => {
    setShowWelcome(!localStorage.getItem('ai_provider'));
    
    if (inputText.toLowerCase() === '/clear' || inputText.toLowerCase().startsWith('/clear ')) {
      let contextText = "";
      if (memoryData.os || memoryData.settings?.length > 0 || memoryData.habits?.length > 0) {
        const contextSections = [];
        if (memoryData.os) contextSections.push(`操作系统: ${memoryData.os}`);
        if (memoryData.settings && memoryData.settings.length > 0) contextSections.push(`偏好设置: ${memoryData.settings.join(", ")}`);
        if (memoryData.habits && memoryData.habits.length > 0) contextSections.push(`用户习惯: ${memoryData.habits.slice(-5).join("；")}`);
        
        contextText = contextSections.join("\n");
      }
      
      setSystemPrompt(getModePrompt(mode, contextText));
      setMessages([
        { id: Date.now(), sender: "ai", text: "对话已清空。你好！我是你的 AI 助手。需要什么帮助？" }
      ]);
      setInput("");
      setError(null);
      
      if (mode === 'teach') {
        setSteps([]);
        setCurrentStepIndex(-1);
      }
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

  // 语音输入
  async function startRecording() {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream, { mimeType: 'audio/webm' });
      audioChunksRef.current = [];
      recorder.ondataavailable = e => audioChunksRef.current.push(e.data);
      recorder.onstop = async () => {
        const blob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
        const formData = new FormData();
        formData.append('audio', blob, 'voice.webm');
        const headers = {};
        if (settings.voiceToken) headers['Authorization'] = `Bearer ${settings.voiceToken}`;
        try {
          const res = await fetch(`${settings.voiceGatewayUrl}/v1/asr`, {
            method: 'POST',
            headers,
            body: formData
          });
          if (res.ok) {
            const data = await res.json();
            if (data.text) setInput(data.text);
          } else {
            console.error('ASR 请求失败:', res.statusText);
          }
        } catch (err) {
          console.error('ASR 请求出错:', err);
        }
        stream.getTracks().forEach(t => t.stop());
      };
      recorder.start();
      setIsRecording(true);
      mediaRecorderRef.current = recorder;
    } catch (err) {
      console.error('麦克风访问失败:', err);
      setError('无法访问麦克风，请检查权限');
    }
  }

  function stopRecording() {
    mediaRecorderRef.current?.stop();
    setIsRecording(false);
  }

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

  return (
      <div className="ai-sidebar" style={{ display: show ? "flex" : "none" }}>
        {showAbout && <AboutDialog showAbout={showAbout} setShowAbout={setShowAbout} />}
        {showSettings && <SettingsModal settings={settings} setSettings={setSettings} setShowSettings={setShowSettings} setShowWelcome={setShowWelcome} closeError={closeError} error={error} />}
        {showWelcome && <WelcomeWizard showWelcome={showWelcome} setShowWelcome={setShowWelcome} setShowSettings={setShowSettings} />}
        {pendingToolCall && <ConfirmationDialog pendingToolCall={pendingToolCall} confirmedToolCall={confirmedToolCall} setConfirmedToolCall={setConfirmedToolCall} setPendingToolCall={setPendingToolCall} />}

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
        <div className="header-drag" style={{ display: 'flex', alignItems: 'center', flex: 1, gap: '8px' }}>
          <span className="logo">🤖</span>
          <span className="title">AI Desktop</span>
        </div>
        
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <select
            value={mode}
            onChange={(e) => handleModeChange(e.target.value)}
            style={{
              background: 'rgba(255,255,255,0.1)',
              color: 'white',
              border: 'none',
              padding: '6px 10px',
              borderRadius: '8px',
              fontSize: '13px',
              cursor: 'pointer',
              outline: 'none',
              width: '90px'
            }}
          >
            <option value="teach" style={{ background: '#2d2f46', color: 'white' }}>📚 Teach</option>
            <option value="auto" style={{ background: '#2d2f46', color: 'white' }}>⚙️ Auto</option>
            <option value="monitor" style={{ background: '#2d2f46', color: 'white' }}>👁️ Monitor</option>
          </select>
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
          <div className="window-controls">
            <button
              onClick={() => { try { getCurrentWindow().minimize(); } catch(e) {} }}
              className="win-btn"
              title="最小化"
            >
              ─
            </button>
            <button
              onClick={() => { try { getCurrentWindow().close(); } catch(e) {} }}
              className="win-btn win-close"
              title="关闭"
            >
              ✕
            </button>
          </div>
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
        {settings.voiceEnabled && (
          <button
            onClick={isRecording ? stopRecording : startRecording}
            disabled={isSending}
            className={isRecording ? "mic-btn recording" : "mic-btn"}
            title={isRecording ? "停止录音" : "语音输入"}
          >
            🎤
          </button>
        )}
        <button onClick={handleSend} disabled={isSending}>
          {isSending ? "..." : "→"}
        </button>
      </div>
    </div>
  );
}
