export async function loadPersistentMemory(callTauriTool) {
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
      
      return normalizedData;
    }
    
    return null;
  } catch (err) {
    console.error("加载持久化记忆失败:", err);
    return null;
  }
}
