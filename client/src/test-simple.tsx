import React from 'react';

export default function TestSimple() {
  return (
    <div style={{ 
      background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
      height: '100vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      color: 'white',
      fontSize: '24px',
      fontFamily: 'Arial, sans-serif'
    }}>
      <div>
        <h1>✅ React Works!</h1>
        <p>Це тестовий компонент</p>
        <p>Час: {new Date().toLocaleTimeString()}</p>
      </div>
    </div>
  );
}
