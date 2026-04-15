// IndiChat - DeepSeek-style dark theme
export const t = {
  bg:       '#0d0d0d',
  bg2:      '#141414',
  bg3:      '#1a1a1a',
  border:   '#2a2a2a',
  accent:   '#4f8ef7',
  accent2:  '#7c6af7',
  text:     '#e8e8e8',
  text2:    '#888',
  text3:    '#555',
  success:  '#22c55e',
  danger:   '#ef4444',
  grad:     'linear-gradient(135deg, #4f8ef7, #7c6af7)',
};

export const c = {
  page:    { minHeight: '100vh', background: t.bg, color: t.text, fontFamily: "'Inter', -apple-system, sans-serif" },
  card:    { background: t.bg2, border: `1px solid ${t.border}`, borderRadius: '12px', padding: '20px' },
  input:   { width: '100%', padding: '10px 14px', background: t.bg3, border: `1px solid ${t.border}`, borderRadius: '8px', color: t.text, fontSize: '14px', outline: 'none', boxSizing: 'border-box', transition: 'border .2s' },
  btn:     { padding: '10px 20px', background: t.grad, color: '#fff', border: 'none', borderRadius: '8px', cursor: 'pointer', fontSize: '14px', fontWeight: '600' },
  btnGhost:{ padding: '10px 20px', background: 'transparent', color: t.text2, border: `1px solid ${t.border}`, borderRadius: '8px', cursor: 'pointer', fontSize: '14px' },
  label:   { display: 'block', fontSize: '12px', color: t.text2, marginBottom: '6px' },
};
