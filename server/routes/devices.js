const express       = require('express');
const { v4: uuidv4 } = require('uuid');
const { run, get, all } = require('../db');
const { syncDeviceToSupabase, syncDeviceConfigToSupabase } = require('../supabase');
const authMiddleware = require('../middleware/auth');
const router        = express.Router();

function genCode() { return String(Math.floor(100000 + Math.random() * 900000)); }

router.get('/', authMiddleware, async (req, res) => {
  const devices = await all(`
    SELECT d.*, dc.ai_model, dc.bot_name, dc.voice_gender, dc.speak_language
    FROM devices d LEFT JOIN device_config dc ON d.device_id = dc.device_id
    WHERE d.user_id = ?`, [req.user.id]);
  res.json(devices);
});

router.post('/add', authMiddleware, async (req, res) => {
  const { name } = req.body;
  const code   = genCode();
  const tempId = 'pending_' + uuidv4();
  const result = await run('INSERT INTO devices (user_id, device_id, name, activation_code, activated) VALUES (?, ?, ?, ?, 0)',
    [req.user.id, tempId, name || 'My Device', code]);
  syncDeviceToSupabase({ id: result.lastID, user_id: req.user.id, device_id: tempId, name: name || 'My Device', activation_code: code, activated: 0 });
  res.json({ activation_code: code });
});

router.get('/:deviceId/config', authMiddleware, async (req, res) => {
  const device = await get('SELECT * FROM devices WHERE device_id = ? AND user_id = ?',
    [req.params.deviceId, req.user.id]);
  if (!device) return res.status(404).json({ error: 'Device not found' });
  const config = await get('SELECT * FROM device_config WHERE device_id = ?', [req.params.deviceId]) || {};

  // Never send actual API keys to browser — mask them
  const safe = { ...config };
  if (safe.api_key)     safe.api_key     = safe.api_key     ? '••••••••' : '';
  if (safe.stt_api_key) safe.stt_api_key = safe.stt_api_key ? '••••••••' : '';
  if (safe.tts_api_key) safe.tts_api_key = safe.tts_api_key ? '••••••••' : '';

  res.json(safe);
});

router.post('/:deviceId/config', authMiddleware, async (req, res) => {
  const device = await get('SELECT * FROM devices WHERE device_id = ? AND user_id = ?',
    [req.params.deviceId, req.user.id]);
  if (!device) return res.status(404).json({ error: 'Device not found' });

  const { ai_model, api_key, stt_provider, stt_api_key, tts_provider, tts_api_key,
    bot_name, bot_intro, creator_name, creator_intro, speak_language,
    caption_language, voice_gender, behavior, max_words, min_words } = req.body;

  // If masked value sent back, keep existing key (don't overwrite)
  const existing = await get('SELECT * FROM device_config WHERE device_id = ?', [req.params.deviceId]) || {};
  const finalApiKey    = (api_key     && api_key     !== '••••••••') ? api_key     : (existing.api_key     || '');
  const finalSttKey    = (stt_api_key && stt_api_key !== '••••••••') ? stt_api_key : (existing.stt_api_key || '');
  const finalTtsKey    = (tts_api_key && tts_api_key !== '••••••••') ? tts_api_key : (existing.tts_api_key || '');

  await run(`INSERT INTO device_config
    (device_id,ai_model,api_key,stt_provider,stt_api_key,tts_provider,tts_api_key,
     bot_name,bot_intro,creator_name,creator_intro,speak_language,caption_language,
     voice_gender,behavior,max_words,min_words)
    VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
    ON CONFLICT(device_id) DO UPDATE SET
      ai_model=excluded.ai_model, api_key=excluded.api_key,
      stt_provider=excluded.stt_provider, stt_api_key=excluded.stt_api_key,
      tts_provider=excluded.tts_provider, tts_api_key=excluded.tts_api_key,
      bot_name=excluded.bot_name, bot_intro=excluded.bot_intro,
      creator_name=excluded.creator_name, creator_intro=excluded.creator_intro,
      speak_language=excluded.speak_language, caption_language=excluded.caption_language,
      voice_gender=excluded.voice_gender, behavior=excluded.behavior,
      max_words=excluded.max_words, min_words=excluded.min_words`,
    [req.params.deviceId, ai_model, finalApiKey, stt_provider||'groq', finalSttKey,
     tts_provider||'groq', finalTtsKey, bot_name, bot_intro, creator_name,
     creator_intro, speak_language, caption_language, voice_gender, behavior,
     max_words||80, min_words||10]);

  // Sync to Supabase (API keys masked)
  syncDeviceConfigToSupabase({
    device_id: req.params.deviceId, ai_model, api_key: finalApiKey,
    stt_provider: stt_provider||'groq', stt_api_key: finalSttKey,
    tts_provider: tts_provider||'groq', tts_api_key: finalTtsKey,
    bot_name, bot_intro, creator_name, creator_intro,
    speak_language, caption_language, voice_gender, behavior,
    max_words: max_words||80, min_words: min_words||10
  });

  res.json({ success: true });
});

router.delete('/:deviceId', authMiddleware, async (req, res) => {
  await run('DELETE FROM device_config WHERE device_id = ?', [req.params.deviceId]);
  await run('DELETE FROM devices WHERE device_id = ? AND user_id = ?', [req.params.deviceId, req.user.id]);
  res.json({ success: true });
});

module.exports = router;
