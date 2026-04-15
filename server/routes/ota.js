const express = require('express');
const { run, get } = require('../db');
const router  = express.Router();

const WS_URL = process.env.WS_URL || `ws://${process.env.HOST||'localhost'}:${process.env.WS_PORT||8765}`;

router.post('/', async (req, res) => {
  const deviceId = req.headers['device-id'] || req.headers['client-id'];
  if (!deviceId) return res.status(400).json({ error: 'Missing Device-Id' });

  let device = await get('SELECT * FROM devices WHERE device_id = ?', [deviceId]);

  const response = {
    server_time: { timestamp: Date.now(), timezone_offset: parseInt(process.env.TIMEZONE_OFFSET||330) },
    firmware: { version: '1.0.0' }
  };

  if (device && device.activated) {
    response.websocket = { url: WS_URL, token: deviceId };
  } else {
    // Find oldest pending slot
    const pending = await get(
      "SELECT * FROM devices WHERE activated=0 AND device_id LIKE 'pending_%' ORDER BY created_at ASC LIMIT 1"
    );
    if (pending) {
      await run('UPDATE devices SET device_id=? WHERE id=?', [deviceId, pending.id]);
      response.activation = { code: pending.activation_code, message: 'Enter code on web platform', timeout_ms: 300000 };
    } else {
      response.activation = { code: '------', message: 'Add device on web platform first', timeout_ms: 60000 };
    }
  }
  res.json(response);
});

router.post('/activate', async (req, res) => {
  const deviceId = req.headers['device-id'] || req.headers['client-id'];
  if (!deviceId) return res.status(400).json({ error: 'Missing Device-Id' });
  const device = await get('SELECT * FROM devices WHERE device_id=?', [deviceId]);
  if (!device) return res.status(404).json({ error: 'Not found' });
  if (device.activated) return res.json({ success: true });
  return res.status(202).json({ message: 'Waiting for activation' });
});

router.post('/confirm-code', async (req, res) => {
  const { code } = req.body;
  if (!code) return res.status(400).json({ error: 'Code required' });
  const device = await get('SELECT * FROM devices WHERE activation_code=? AND activated=0', [code]);
  if (!device) return res.status(404).json({ error: 'Invalid or expired code' });
  await run('UPDATE devices SET activated=1 WHERE id=?', [device.id]);
  await run('INSERT OR IGNORE INTO device_config (device_id) VALUES (?)', [device.device_id]);
  res.json({ success: true, device_id: device.device_id, device_name: device.name });
});

module.exports = router;
