export default function WelcomeWizard({ showWelcome, setShowWelcome, setShowSettings }) {
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
  };
