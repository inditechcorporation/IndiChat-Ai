/**
 * TTS - Text to Speech
 * Converts AI text response → OPUS audio for ESP32
 * 
 * Providers (in order of speed):
 * 1. Edge TTS (free, Microsoft, no API key) - ~200ms
 * 2. Google Cloud TTS - ~300ms, best quality
 * 3. OpenAI TTS - ~400ms
 * 4. ElevenLabs - ~500ms, most natural
 * 
 * Output: OPUS encoded audio frames (60ms each, 16kHz mono)
 * ESP32 expects: raw OPUS frames as binary WebSocket messages
 */

const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');
const os = require('os');
const { getKey, markExhausted } = require('./keyRotator');

// ── Edge TTS (FREE - Microsoft, no API key needed) ───────────────────
// Uses edge-tts python package OR direct API
async function ttsEdge(text, language, gender) {
  // Map language + gender to Edge TTS voice name
  const voiceMap = {
    'en-US_female': 'en-US-JennyNeural',
    'en-US_male':   'en-US-GuyNeural',
    'hi-IN_female': 'hi-IN-SwaraNeural',
    'hi-IN_male':   'hi-IN-MadhurNeural',
    'zh-CN_female': 'zh-CN-XiaoxiaoNeural',
    'zh-CN_male':   'zh-CN-YunxiNeural',
    'ja-JP_female': 'ja-JP-NanamiNeural',
    'ja-JP_male':   'ja-JP-KeitaNeural',
    'ko-KR_female': 'ko-KR-SunHiNeural',
    'ko-KR_male':   'ko-KR-InJoonNeural',
    'fr-FR_female': 'fr-FR-DeniseNeural',
    'fr-FR_male':   'fr-FR-HenriNeural',
    'de-DE_female': 'de-DE-KatjaNeural',
    'de-DE_male':   'de-DE-ConradNeural',
    'es-ES_female': 'es-ES-ElviraNeural',
    'es-ES_male':   'es-ES-AlvaroNeural',
    'ar-SA_female': 'ar-SA-ZariyahNeural',
    'ar-SA_male':   'ar-SA-HamedNeural',
    'ru-RU_female': 'ru-RU-SvetlanaNeural',
    'ru-RU_male':   'ru-RU-DmitryNeural',
  };

  const lang = language || 'en-US';
  const gen = gender || 'female';
  const key = `${lang}_${gen}`;
  const voice = voiceMap[key] || voiceMap[`${lang.split('-')[0]}-US_${gen}`] || 'en-US-JennyNeural';

  const tmpMp3 = path.join(os.tmpdir(), `tts_${Date.now()}.mp3`);

  // Use edge-tts via Python (pip install edge-tts)
  await new Promise((resolve, reject) => {
    const proc = spawn('edge-tts', [
      '--voice', voice,
      '--text', text,
      '--write-media', tmpMp3
    ]);
    proc.on('close', code => code === 0 ? resolve() : reject(new Error(`edge-tts failed: ${code}`)));
    proc.on('error', reject);
  });

  const mp3Data = fs.readFileSync(tmpMp3);
  try { fs.unlinkSync(tmpMp3); } catch {}
  return mp3Data;
}

// ── Google Cloud TTS ─────────────────────────────────────────────────
async function ttsGoogle(text, language, gender) {
  const apiKey = process.env.GOOGLE_TTS_API_KEY;
  if (!apiKey) throw new Error('GOOGLE_TTS_API_KEY not set');

  const lang = language || 'en-US';
  const ssmlGender = (gender === 'male') ? 'MALE' : 'FEMALE';

  const response = await fetch(
    `https://texttospeech.googleapis.com/v1/text:synthesize?key=${apiKey}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        input: { text },
        voice: { languageCode: lang, ssmlGender },
        audioConfig: { audioEncoding: 'MP3', sampleRateHertz: 16000 }
      })
    }
  );

  if (!response.ok) throw new Error(`Google TTS error: ${response.status}`);
  const data = await response.json();
  return Buffer.from(data.audioContent, 'base64');
}

// ── OpenAI TTS ───────────────────────────────────────────────────────
async function ttsOpenAI(text, language, gender) {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) throw new Error('OPENAI_API_KEY not set');

  const voice = gender === 'male' ? 'onyx' : 'nova';

  const response = await fetch('https://api.openai.com/v1/audio/speech', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      model: 'tts-1',  // tts-1 is faster, tts-1-hd is better quality
      input: text,
      voice,
      response_format: 'mp3',
      speed: 1.0
    })
  });

  if (!response.ok) throw new Error(`OpenAI TTS error: ${response.status}`);
  return Buffer.from(await response.arrayBuffer());
}

// ── ElevenLabs TTS ───────────────────────────────────────────────────
async function ttsElevenLabs(text, language, gender) {
  const apiKey = process.env.ELEVENLABS_API_KEY;
  if (!apiKey) throw new Error('ELEVENLABS_API_KEY not set');

  // Default voices
  const voiceId = gender === 'male' ? 'pNInz6obpgDQGcFmaJgB' : 'EXAVITQu4vr4xnSDxMaL';

  const response = await fetch(
    `https://api.elevenlabs.io/v1/text-to-speech/${voiceId}/stream`,
    {
      method: 'POST',
      headers: {
        'xi-api-key': apiKey,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        text,
        model_id: 'eleven_turbo_v2',  // fastest model
        voice_settings: { stability: 0.5, similarity_boost: 0.75 }
      })
    }
  );

  if (!response.ok) throw new Error(`ElevenLabs TTS error: ${response.status}`);
  return Buffer.from(await response.arrayBuffer());
}

// ── MP3/WAV/PCM → OPUS frames (for ESP32) ───────────────────────────
// ESP32 expects: 16kHz mono OPUS frames, 60ms each
async function audioToOpusFrames(audioBuffer, inputFormat = 'mp3') {
  const tmpIn  = path.join(os.tmpdir(), `tts_in_${Date.now()}.${inputFormat}`);
  const tmpOut = path.join(os.tmpdir(), `tts_out_${Date.now()}.opus`);

  fs.writeFileSync(tmpIn, audioBuffer);

  // For Gemini PCM/WAV output — 24kHz, 16-bit, mono
  const inputArgs = inputFormat === 'wav'
    ? ['-y', '-f', 's16le', '-ar', '24000', '-ac', '1', '-i', tmpIn]
    : ['-y', '-i', tmpIn];

  try {
    await new Promise((resolve, reject) => {
      const ff = spawn('ffmpeg', [
        ...inputArgs,
        '-ar', '16000',
        '-ac', '1',
        '-c:a', 'libopus',
        '-b:a', '32k',
        '-frame_duration', '60',
        '-vbr', 'off',
        '-f', 'opus',
        tmpOut
      ]);
      ff.on('close', code => code === 0 ? resolve() : reject(new Error(`ffmpeg opus encode failed: ${code}`)));
      ff.on('error', reject);
    });

    const opusData = fs.readFileSync(tmpOut);
    return splitOpusFrames(opusData);
  } finally {
    try { fs.unlinkSync(tmpIn); } catch {}
    try { fs.unlinkSync(tmpOut); } catch {}
  }
}

// Split OPUS data into individual frames for streaming
function splitOpusFrames(opusBuffer) {
  // For raw OPUS output from ffmpeg, split into ~4KB chunks
  // ESP32 can handle up to 4KB per WebSocket frame
  const CHUNK_SIZE = 3840; // ~60ms of 32kbps opus
  const frames = [];
  for (let i = 0; i < opusBuffer.length; i += CHUNK_SIZE) {
    frames.push(opusBuffer.slice(i, i + CHUNK_SIZE));
  }
  return frames;
}

// ── Gemini TTS (Primary) ─────────────────────────────────────────────
// Uses gemini-3.1-flash-tts-preview with auto-fallback to Groq
async function ttsGemini(text, language, gender) {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error('GEMINI_API_KEY not set');

  // Pick voice based on gender — warm/soft for female, firm/informative for male
  const voice = gender === 'male' ? 'Charon' : 'Kore';

  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-3.1-flash-tts-preview:generateContent?key=${apiKey}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text }] }],
        generationConfig: {
          responseModalities: ['AUDIO'],
          speechConfig: {
            voiceConfig: {
              prebuiltVoiceConfig: { voiceName: voice }
            }
          }
        }
      })
    }
  );

  if (!response.ok) {
    const err = await response.text();
    throw new Error(`Gemini TTS error: ${response.status} ${err}`);
  }

  const data = await response.json();
  const audioData = data.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
  if (!audioData) throw new Error('Gemini TTS: no audio data in response');

  // Gemini returns PCM audio at 24kHz — convert to buffer
  return Buffer.from(audioData, 'base64');
}

// ── Groq TTS - Orpheus voices ────────────────────────────────────────
async function ttsGroq(text, language, gender) {
  const apiKey = getKey();
  if (!apiKey) throw new Error('No GROQ_API_KEY configured');

  // Orpheus voices: English and Arabic
  const lang = (language || 'en-US').toLowerCase();
  let voice;
  if (lang.startsWith('ar')) {
    voice = gender === 'male' ? 'Ahmad-PlayAI' : 'Nadia-PlayAI'; // Arabic Saudi
  } else {
    voice = gender === 'male' ? 'Fritz-PlayAI' : 'Aaliya-PlayAI'; // English
  }

  // Use orpheus-tts for supported languages, playai-tts for others
  const model = (lang.startsWith('ar') || lang.startsWith('en')) ? 'orpheus-tts-arabic-preview' : 'playai-tts';
  const useModel = lang.startsWith('ar') ? 'orpheus-tts-arabic-preview' : 'playai-tts';

  const response = await fetch('https://api.groq.com/openai/v1/audio/speech', {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ model: useModel, input: text, voice, response_format: 'mp3' })
  });

  if (!response.ok) {
    const err = await response.text();
    if (response.status === 429) markExhausted(apiKey);
    throw new Error(`Groq TTS error: ${err}`);
  }
  return Buffer.from(await response.arrayBuffer());
}

// ── Main synthesize function ─────────────────────────────────────────
async function synthesize(text, language, gender) {
  const provider = process.env.TTS_PROVIDER || 'gemini';
  console.log(`[TTS] Synthesizing with ${provider}: "${text.substring(0, 50)}..."`);
  const t0 = Date.now();

  let audioBuffer;
  let fmt = 'mp3';

  // Try Gemini TTS first (primary)
  if (process.env.GEMINI_API_KEY) {
    try {
      audioBuffer = await ttsGemini(text, language, gender);
      fmt = 'wav'; // Gemini returns PCM/WAV
      console.log(`[TTS] Gemini TTS success in ${Date.now() - t0}ms`);
    } catch (e) {
      console.warn(`[TTS] Gemini TTS failed: ${e.message} — falling back to Groq`);
      audioBuffer = null;
    }
  }

  // Fallback to Groq if Gemini failed or no key
  if (!audioBuffer) {
    try {
      audioBuffer = await ttsGroq(text, language, gender);
      fmt = 'mp3';
      console.log(`[TTS] Groq TTS success in ${Date.now() - t0}ms`);
    } catch (e) {
      console.warn(`[TTS] Groq TTS failed: ${e.message} — trying other providers`);
    }
  }

  // Further fallbacks
  if (!audioBuffer) {
    try {
      switch (provider) {
        case 'google':
          audioBuffer = await ttsGoogle(text, language, gender); break;
        case 'openai':
          audioBuffer = await ttsOpenAI(text, language, gender); break;
        case 'elevenlabs':
          audioBuffer = await ttsElevenLabs(text, language, gender); break;
        default:
          audioBuffer = await ttsEdge(text, language, gender); break;
      }
    } catch (e) {
      console.error('[TTS] All providers failed:', e.message);
      return [];
    }
  }

  console.log(`[TTS] Audio generated in ${Date.now() - t0}ms, size: ${audioBuffer.length} bytes`);

  const t1 = Date.now();
  const frames = await audioToOpusFrames(audioBuffer, fmt);
  console.log(`[TTS] Encoded to ${frames.length} OPUS frames in ${Date.now() - t1}ms`);

  return frames;
}

module.exports = { synthesize };
