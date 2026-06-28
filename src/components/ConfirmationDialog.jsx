export default function ConfirmationDialog({ pendingToolCall, confirmedToolCall, setConfirmedToolCall, setPendingToolCall }) {
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
