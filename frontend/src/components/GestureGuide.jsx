import React from 'react';

export default function GestureGuide() {
  return (
    <div style={{
      position: 'absolute', top: 16, right: 16, background: 'rgba(0,0,0,0.6)', 
      padding: '12px 16px', borderRadius: 8, color: '#fff', fontSize: '14px',
      border: '1px solid rgba(0,245,255,0.2)'
    }}>
      <h4 style={{ margin: '0 0 8px 0', color: '#00f5ff' }}>Gestures</h4>
      <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: '4px' }}>
        <li>☝️ Draw</li>
        <li>✊ Pause</li>
        <li>✌️ Erase</li>
        <li>🖐 Clear</li>
        <li>🤏 Drag</li>
      </ul>
    </div>
  );
}
