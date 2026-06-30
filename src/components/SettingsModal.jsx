export default function SettingsModal({ settings, setSettings, setShowSettings, setShowWelcome, closeError, error }) {
  const defaultUrls = {
    mock: "",
    deepseek: "https://api.deepseek.com/v1/chat/completions",
    openai: "https://api.openai.com/v1/chat/completions",
    "llama-cpp": "http://127.0.0.1:8082/v1/chat/completions",
    ollama: "http://127.0.0.1:11434/v1/chat/completions",
  };

  const handleSaveSettings = (e) => {
    e.preventDefault();
    localStorage.setItem('ai_provider', settings.provider);
    localStorage.setItem('api_key', settings.apiKey);
    localStorage.setItem('api_url', settings.apiUrl);
    localStorage.setItem('voice_enabled', settings.voiceEnabled ? 'true' : 'false');
    localStorage.setItem('voice_gateway_url', settings.voiceGatewayUrl || '');
    localStorage.setItem('voice_token', settings.voiceToken || '');
    setShowSettings(false);
    setShowWelcome(false);
    alert('配置已保存！');
  };

  const toggleStyle = (enabled) => ({
    width: '44px',
    height: '24px',
    borderRadius: '12px',
    border: 'none',
    background: enabled ? 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)' : '#3e415c',
    cursor: 'pointer',
    position: 'relative',
    transition: 'all 0.3s ease',
    flexShrink: 0
  });

  const toggleKnobStyle = (enabled) => ({
    width: '18px',
    height: '18px',
    borderRadius: '50%',
    background: '#ffffff',
    position: 'absolute',
    top: '3px',
    left: enabled ? '23px' : '3px',
    transition: 'all 0.3s ease',
    boxShadow: '0 2px 4px rgba(0,0,0,0.3)'
  });

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
              onChange={(e) => {
                const provider = e.target.value;
                setSettings({...settings, provider, apiUrl: defaultUrls[provider] || settings.apiUrl});
              }}
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

          <div style={{ marginTop: '24px', marginBottom: '18px', borderTop: '1px solid #3e415c', paddingTop: '20px' }}>
            <h3 style={{ marginBottom: '16px', fontSize: '16px', color: '#a9b1d6', fontWeight: 600 }}>🎤 语音输入</h3>
            
            <div style={{ marginBottom: '18px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <label style={{ fontWeight: 600, fontSize: 14, color: '#a9b1d6' }}>
                启用语音输入
              </label>
              <button
                type="button"
                onClick={() => setSettings({...settings, voiceEnabled: !settings.voiceEnabled})}
                style={toggleStyle(settings.voiceEnabled)}
              >
                <div style={toggleKnobStyle(settings.voiceEnabled)} />
              </button>
            </div>

            {settings.voiceEnabled && (
              <>
                <div style={{ marginBottom: '18px' }}>
                  <label style={{ display: 'block', marginBottom: 8, fontWeight: 600, fontSize: 14, color: '#a9b1d6' }}>
                    语音网关地址
                  </label>
                  <input
                    type="url"
                    value={settings.voiceGatewayUrl}
                    onChange={(e) => setSettings({...settings, voiceGatewayUrl: e.target.value})}
                    placeholder="http://127.0.0.1:8766"
                    style={{ width: '100%', padding: '12px 16px', borderRadius: '8px', border: '1px solid #3e415c', background: '#1a1b2e', color: '#ffffff' }}
                  />
                </div>

                <div style={{ marginBottom: '18px' }}>
                  <label style={{ display: 'block', marginBottom: 8, fontWeight: 600, fontSize: 14, color: '#a9b1d6' }}>
                    Token（可选）
                  </label>
                  <input
                    type="password"
                    value={settings.voiceToken}
                    onChange={(e) => setSettings({...settings, voiceToken: e.target.value})}
                    placeholder="Bearer token"
                    style={{ width: '100%', padding: '12px 16px', borderRadius: '8px', border: '1px solid #3e415c', background: '#1a1b2e', color: '#ffffff' }}
                  />
                </div>
              </>
            )}
          </div>

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
