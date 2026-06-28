export default function SettingsModal({ settings, setSettings, setShowSettings, setShowWelcome, closeError, error }) {
  const handleSaveSettings = (e) => {
    e.preventDefault();
    localStorage.setItem('ai_provider', settings.provider);
    localStorage.setItem('api_key', settings.apiKey);
    localStorage.setItem('api_url', settings.apiUrl);
    setShowSettings(false);
    setShowWelcome(false);
    alert('配置已保存！');
  };

  return (
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
}
