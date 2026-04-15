/**
 * STT - Speech to Text
 * Converts OPUS audio chunks from ESP32 → text
 * 
 * Pipeline: OPUS frames → PCM WAV → Groq/OpenAI Whisper → text
 * 
 * Groq Whisper is ~300ms latency (fastest available)
 */

const { execSync, spawn } = require('child_process');
const fs = require('fs');
const path = require('path');
const os = require('os');
const { getKey, markExhausted } = require('./keyRotator');

// ── OPUS → WAV conversion using ffmpeg ──────────────────────────────
async function opusChunksToWav(opusChunks) {
  const tmpDir = os.tmpdir();
  const opusFile = path.join(tmpDir, `stt_${Date.now()}.opus`);
  const wavFile = path.join(tmpDir, `stt_${Date.now()}.wav`);

  // Write raw OPUS frames to file
  // ESP32 sends raw OPUS frames (not OGG container)
  // We need to wrap in OGG container first
  const oggFile = path.join(tmpDir, `stt_${Date.now()}.ogg`);

  try {
    // Concatenate all OPUS chunks
    const combined = Buffer.concat(opusChunks);
    fs.writeFileSync(opusFile, combined);

    // Use ffmpeg to convert: raw opus → wav (16kHz mono)
    // ffmpeg handles raw opus with -f opus flag
    await new Promise((resolve, reject) => {
      const ff = spawn('ffmpeg', [
        '-y',
        '-f', 'opus',
        '-i', opusFile,
        '-ar', '16000',
        '-ac', '1',
        '-f', 'wav',
        wavFile
      ]);
      ff.on('close', (code) => {
        if (code === 0) resolve();
        else reject(new Error(`ffmpeg exited with code ${code}`));
      });
      ff.on('error', reject);
    });

    const wavData = fs.readFileSync(wavFile);
    return wavData;
  } finally {
    // Cleanup temp files
    [opusFile, wavFile, oggFile].forEach(f => {
      try { fs.unlinkSync(f); } catch {}
    });
  }
}

// ── Groq Whisper STT (fastest ~300ms) ───────────────────────────────
async function transcribeWithGroq(wavBuffer, language) {
  const apiKey = getKey();
  if (!apiKey) throw new Error('No GROQ_API_KEY configured');

  const FormData = require('form-data');
  const form = new FormData();
  form.append('file', wavBuffer, { filename: 'audio.wav', contentType: 'audio/wav' });
  form.append('model', process.env.STT_MODEL || 'whisper-large-v3-turbo');
  // whisper-large-v3-turbo = faster, whisper-large-v3 = more accurate
  form.append('response_format', 'json');
  if (language) form.append('language', language.split('-')[0]); // 'hi-IN' → 'hi'

  const response = await fetch('https://api.groq.com/openai/v1/audio/transcriptions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      ...form.getHeaders()
    },
    body: form
  });

  if (!response.ok) {
    const err = await response.text();
    if (response.status === 429) markExhausted(apiKey);
    throw new Error(`Groq STT error: ${err}`);
  }

  const data = await response.json();
  return data.text?.trim() || '';
}

// ── OpenAI Whisper STT (fallback) ───────────────────────────────────
async function transcribeWithOpenAI(wavBuffer, language) {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) throw new Error('OPENAI_API_KEY not set');

  const FormData = require('form-data');
  const form = new FormData();
  form.append('file', wavBuffer, { filename: 'audio.wav', contentType: 'audio/wav' });
  form.append('model', 'whisper-1');
  if (language) form.append('language', language.split('-')[0]);

  const response = await fetch('https://api.openai.com/v1/audio/transcriptions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      ...form.getHeaders()
    },
    body: form
  });

  if (!response.ok) throw new Error(`OpenAI STT error: ${response.status}`);
  const data = await response.json();
  return data.text?.trim() || '';
}

// ── Main transcribe function ─────────────────────────────────────────
async function transcribe(opusChunks, language = 'en') {
  if (!opusChunks || opusChunks.length === 0) return '';

  console.log(`[STT] Converting ${opusChunks.length} OPUS chunks to WAV...`);
  const t0 = Date.now();

  let wavBuffer;
  try {
    wavBuffer = await opusChunksToWav(opusChunks);
  } catch (e) {
    console.error('[STT] OPUS→WAV conversion failed:', e.message);
    // Fallback: try sending raw data directly
    wavBuffer = Buffer.concat(opusChunks);
  }

  console.log(`[STT] WAV ready in ${Date.now() - t0}ms, size: ${wavBuffer.length} bytes`);

  // Try Groq first (fastest), fallback to OpenAI
  try {
    if (process.env.GROQ_API_KEY) {
      const t1 = Date.now();
      const text = await transcribeWithGroq(wavBuffer, language);
      console.log(`[STT] Groq result in ${Date.now() - t1}ms: "${text}"`);
      return text;
    }
  } catch (e) {
    console.warn('[STT] Groq failed, trying OpenAI:', e.message);
  }

  try {
    if (process.env.OPENAI_API_KEY) {
      const t1 = Date.now();
      const text = await transcribeWithOpenAI(wavBuffer, language);
      console.log(`[STT] OpenAI result in ${Date.now() - t1}ms: "${text}"`);
      return text;
    }
  } catch (e) {
    console.error('[STT] OpenAI also failed:', e.message);
  }

  throw new Error('No STT provider available. Set GROQ_API_KEY or OPENAI_API_KEY in .env');
}

module.exports = { transcribe };
