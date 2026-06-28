export const dangerousPatterns = [/rm /, /dd /, /mkfs/, /format/, /> \/dev/, /> \/etc/, /> \/boot/];

export function isDangerousCommand(command) {
  if (!command) return false;
  for (const pattern of dangerousPatterns) {
    if (pattern.test(command)) return true;
  }
  return false;
}

export async function callTauriTool(toolName, toolArgs, onConfirm = null) {
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
