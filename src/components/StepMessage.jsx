export default function StepMessage({ message, mode }) {
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
