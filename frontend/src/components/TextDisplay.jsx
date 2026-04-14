import React from 'react';

export default function TextDisplay({ recognizedText, onClearText }) {
  if (!recognizedText) return null;
  return (
    <div style={{
      padding: '20px 30px', 
      background: 'rgba(5, 5, 12, 0.7)', 
      backdropFilter: 'blur(24px)',
      borderRadius: '20px', 
      marginTop: 24, 
      border: '1px solid rgba(0,245,255,0.2)',
      boxShadow: '0 0 30px rgba(0,245,255,0.1), inset 0 0 20px rgba(0,0,0,0.5)',
      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      position: 'relative',
      overflow: 'hidden'
    }}>
      {/* Decorative gradient orb */}
      <div style={{
          position: 'absolute', top: '-50%', left: '-10%', 
          width: '120px', height: '120px', background: 'rgba(0,245,255,0.15)',
          filter: 'blur(40px)', borderRadius: '50%', pointerEvents: 'none'
      }} />

      <div>
        <h3 style={{ margin: '0 0 6px 0', fontSize: '11px', color: 'rgba(255,255,255,0.4)', textTransform: 'uppercase', letterSpacing: '0.2em' }}>
          Recognized Text
        </h3>
        <p style={{ margin: 0, fontSize: '28px', fontWeight: '800', letterSpacing: '0.05em', color: '#fff', textShadow: '0 0 10px rgba(255,255,255,0.3)' }}>
          {recognizedText}
        </p>
      </div>
      <button 
        onClick={onClearText} 
        style={{
          padding: '10px 20px', background: 'rgba(255,0,229,0.08)', 
          border: '1px solid rgba(255,0,229,0.4)', color: '#ff00e5', 
          borderRadius: '10px', cursor: 'pointer', fontWeight: '700',
          transition: 'all 0.2s', textTransform: 'uppercase', fontSize: '12px',
          letterSpacing: '0.1em', boxShadow: '0 0 15px rgba(255,0,229,0.1)'
        }}
        onMouseOver={e => {
            e.currentTarget.style.background = 'rgba(255,0,229,0.2)';
            e.currentTarget.style.boxShadow = '0 0 25px rgba(255,0,229,0.3)';
        }}
        onMouseOut={e => {
            e.currentTarget.style.background = 'rgba(255,0,229,0.08)';
            e.currentTarget.style.boxShadow = '0 0 15px rgba(255,0,229,0.1)';
        }}
      >
        Clear
      </button>
    </div>
  );
}
