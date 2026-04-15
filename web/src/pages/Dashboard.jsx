import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../api';
import { s } from '../styles';

export default function Dashboard({ onLogout }) {
  const [devices, setDevices] = useState([]);
  const [showAdd, setShowAdd] = useState(false);
  const [newDeviceName, setNewDeviceName] = useState('');
  const [pendingCode, setPendingCode] = useState(null);
  const [confirmCode, setConfirmCode] = useState('');
  const [msg, setMsg] = useState('');
  const navigate = useNavigate();

  const loadDevices = async () => {
    const { data } = await api.get('/devices');
    setDevices(data);
  };

  useEffect(() => { loadDevices(); }, []);

  const addDevice = async () => {
    if (!newDeviceName.trim()) return;
    const { data } = await api.post('/devices/add', { name: newDeviceName });
    setPendingCode(data.activation_code);
    setNewDeviceName('');
  };

  const confirmActivation = async () => {
    try {
      const { data } = await api.post('/ota/confirm-code', { code: confirmCode });
      setMsg(`✅ Device "${data.device_name}" activated!`);
      setPendingCode(null);
      setConfirmCode('');
      setShowAdd(false);
      loadDevices();
    } catch {
      setMsg('❌ Invalid code. Check the display and try again.');
    }
  };

  const deleteDevice = async (deviceId) => {
    if (!confirm('Delete this device?')) return;
    await api.delete(`/devices/${deviceId}`);
    loadDevices();
  };

  return (
    <div style={s.page}>
      <div style={{ maxWidth: '800px', margin: '0 auto' }}>
        {/* Header */}
        <div style={{ ...s.row, justifyContent: 'space-between', marginBottom: '24px' }}>
          <div>
            <h1 style={s.h1}>🤖 My Devices</h1>
            <p style={{ color: '#888', fontSize: '14px' }}>Manage your ESP32 voice assistants</p>
          </div>
          <div style={s.row}>
            <button style={s.btn} onClick={() => setShowAdd(!showAdd)}>+ Add Device</button>
            <button style={s.btnOutline} onClick={onLogout}>Logout</button>
          </div>
        </div>

        {msg && (
          <div style={{ ...s.card, background: '#1a2a1a', borderColor: '#2a4a2a', marginBottom: '16px' }}>
            {msg}
          </div>
        )}

        {/* Add Device Flow */}
        {showAdd && (
          <div style={s.card}>
            <h2 style={s.h2}>Add New Device</h2>
            {!pendingCode ? (
              <div style={s.row}>
                <input
                  style={{ ...s.input, marginBottom: 0, flex: 1 }}
                  placeholder="Device name (e.g. Living Room Bot)"
                  value={newDeviceName}
                  onChange={e => setNewDeviceName(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && addDevice()}
                />
                <button style={s.btn} onClick={addDevice}>Generate Code</button>
              </div>
            ) : (
              <div>
                <p style={{ marginBottom: '16px', color: '#aaa' }}>
                  Power on your ESP32 and connect it to WiFi. The display will show a 6-digit code.
                  Enter that code below to activate.
                </p>
                <div style={{ textAlign: 'center', marginBottom: '20px' }}>
                  <div style={{ fontSize: '12px', color: '#888', marginBottom: '8px' }}>WAITING FOR DEVICE CODE</div>
                  <div style={{ fontSize: '48px', letterSpacing: '12px', fontWeight: '700', color: '#6c63ff' }}>
                    {pendingCode}
                  </div>
                  <div style={{ fontSize: '12px', color: '#888', marginTop: '8px' }}>
                    This is the code your device will show on its display
                  </div>
                </div>
                <label style={s.label}>Enter code shown on device display</label>
                <div style={s.row}>
                  <input
                    style={{ ...s.input, marginBottom: 0, flex: 1, fontSize: '20px', letterSpacing: '8px', textAlign: 'center' }}
                    placeholder="000000"
                    maxLength={6}
                    value={confirmCode}
                    onChange={e => setConfirmCode(e.target.value.replace(/\D/g, ''))}
                  />
                  <button style={s.btn} onClick={confirmActivation}>Activate</button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Device List */}
        {devices.length === 0 ? (
          <div style={{ ...s.card, textAlign: 'center', padding: '48px' }}>
            <div style={{ fontSize: '48px', marginBottom: '16px' }}>📡</div>
            <p style={{ color: '#888' }}>No devices yet. Add your first ESP32 device above.</p>
          </div>
        ) : (
          devices.map(device => (
            <div key={device.id} style={{ ...s.card, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <div style={{ ...s.row, marginBottom: '6px' }}>
                  <span style={{ fontWeight: '600', fontSize: '16px' }}>{device.name}</span>
                  <span style={s.badge(device.activated)}>{device.activated ? 'Active' : 'Pending'}</span>
                </div>
                <div style={{ fontSize: '12px', color: '#666' }}>
                  {device.bot_name && `Bot: ${device.bot_name} · `}
                  {device.ai_model && `Model: ${device.ai_model} · `}
                  {device.speak_language && `Lang: ${device.speak_language}`}
                </div>
              </div>
              <div style={s.row}>
                {device.activated && (
                  <button style={s.btnOutline} onClick={() => navigate(`/device/${device.device_id}`)}>
                    Configure
                  </button>
                )}
                <button style={s.btnDanger} onClick={() => deleteDevice(device.device_id)}>Delete</button>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
