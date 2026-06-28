export default function AboutDialog({ showAbout, setShowAbout }) {
  return (
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
}
