export const s = {
  page: { minHeight: '100vh', background: '#0f0f1a', color: '#e0e0e0', padding: '24px' },
  card: { background: '#1a1a2e', borderRadius: '12px', padding: '24px', marginBottom: '16px', border: '1px solid #2a2a4a' },
  input: {
    width: '100%', padding: '10px 14px', background: '#0f0f1a', border: '1px solid #3a3a5a',
    borderRadius: '8px', color: '#e0e0e0', fontSize: '14px', marginBottom: '12px', outline: 'none'
  },
  label: { display: 'block', fontSize: '12px', color: '#888', marginBottom: '4px', textTransform: 'uppercase', letterSpacing: '0.5px' },
  btn: {
    padding: '10px 20px', background: '#6c63ff', color: '#fff', border: 'none',
    borderRadius: '8px', cursor: 'pointer', fontSize: '14px', fontWeight: '600'
  },
  btnDanger: {
    padding: '8px 16px', background: '#ff4444', color: '#fff', border: 'none',
    borderRadius: '8px', cursor: 'pointer', fontSize: '13px'
  },
  btnOutline: {
    padding: '8px 16px', background: 'transparent', color: '#6c63ff', border: '1px solid #6c63ff',
    borderRadius: '8px', cursor: 'pointer', fontSize: '13px'
  },
  h1: { fontSize: '24px', fontWeight: '700', marginBottom: '8px' },
  h2: { fontSize: '18px', fontWeight: '600', marginBottom: '16px' },
  row: { display: 'flex', gap: '12px', alignItems: 'center' },
  select: {
    padding: '10px 14px', background: '#0f0f1a', border: '1px solid #3a3a5a',
    borderRadius: '8px', color: '#e0e0e0', fontSize: '14px', marginBottom: '12px', width: '100%'
  },
  textarea: {
    width: '100%', padding: '10px 14px', background: '#0f0f1a', border: '1px solid #3a3a5a',
    borderRadius: '8px', color: '#e0e0e0', fontSize: '14px', marginBottom: '12px',
    minHeight: '80px', resize: 'vertical', outline: 'none'
  },
  badge: (active) => ({
    display: 'inline-block', padding: '2px 10px', borderRadius: '20px', fontSize: '12px',
    background: active ? '#1a4a1a' : '#4a1a1a', color: active ? '#4caf50' : '#f44336'
  })
};
