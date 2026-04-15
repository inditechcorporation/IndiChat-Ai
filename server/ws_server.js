/**
 * WebSocket Voice Server - Complete Implementation
 * 
 * Fast pipeline:
 *   ESP32 mic → OPUS audio → STT (Groq ~300ms) → LLM stream → TTS stream → OPUS → ESP32 speaker
 * 
 * Total latency target: < 1.5 seconds (vs xiaozhi ~3-4 seconds)
 * 
 * Key optimizations:
 * 1. Streaming LLM - start TTS on first sentence, don't wait for full response
 * 2. Groq Whisper - fastest STT available
 * 3. Edge TTS - zero cost, fast enough
 * 4. Parallel TTS encoding while LLM still generating
 */

const WebSocket = require('ws');
const { get }   = require('./db');
const { transcribe } = require('./stt');
const { synthesize } = require('./tts');
const { streamResponse } = require('./llm');

function createWsServer(serverOrPort) {
  // Accept either HTTP server (for shared port) or port number
  const wss = typeof serverOrPort === 'number'
    ? new WebSocket.Server({ port: serverOrPort })
    : new WebSocket.Server({ server: serverOrPort, path: '/ws' });

  console.log(`[WS] Voice server ready`);

  wss.on('connection', async (ws, req) => {
    const url    = new URL(req.url, 'http://localhost');
    const token  = url.searchParams.get('token') || url.searchParams.get('device_id');

    if (!token) { ws.close(1008, 'Missing token'); return; }

    const device = await get(
      'SELECT * FROM devices WHERE device_id = ? AND activated = 1', [token]
    );
    if (!device) { ws.close(1008, 'Device not activated'); return; }

    const config = await get(
      'SELECT * FROM device_config WHERE device_id = ?', [token]
    ) || {};

    console.log(`[WS] Connected: ${device.name} (${token})`);

    const session = {
      deviceId : token,
      config,
      audioChunks : [],
      listening   : false,
      processing  : false,
      aborted     : false,
    };

    // ── Server Hello ──────────────────────────────────────────────
    send(ws, {
      type      : 'hello',
      version   : 3,
      transport : 'websocket',
      audio_params: {
        format         : 'opus',
        sample_rate    : 16000,
        channels       : 1,
        frame_duration : 60,
      }
    });

    // ── Message Handler ───────────────────────────────────────────
    ws.on('message', async (data, isBinary) => {
      if (isBinary) {
        // Raw OPUS audio frame from ESP32
        if (session.listening) {
          session.audioChunks.push(Buffer.from(data));
        }
        return;
      }

      let msg;
      try { msg = JSON.parse(data.toString()); }
      catch { return; }

      await handleMessage(ws, session, msg);
    });

    ws.on('close', () => {
      console.log(`[WS] Disconnected: ${device.name}`);
      session.aborted = true;
    });

    ws.on('error', err => console.error(`[WS] Error:`, err.message));
  });

  return wss;
}

// ── Message Handler ──────────────────────────────────────────────────
async function handleMessage(ws, session, msg) {
  switch (msg.type) {

    case 'hello':
      // Client hello - already sent server hello on connect
      break;

    case 'listen':
      if (msg.state === 'start' || msg.state === 'detect') {
        session.listening   = true;
        session.audioChunks = [];
        session.aborted     = false;
        console.log(`[WS] Listening started`);

      } else if (msg.state === 'stop') {
        session.listening = false;
        console.log(`[WS] Listening stopped, chunks: ${session.audioChunks.length}`);

        if (session.audioChunks.length > 0 && !session.processing) {
          await runPipeline(ws, session);
        }
      }
      break;

    case 'abort':
      session.aborted     = true;
      session.listening   = false;
      session.audioChunks = [];
      send(ws, { type: 'tts', state: 'stop' });
      console.log(`[WS] Aborted`);
      break;

    case 'wake_word_detected':
      // Wake word detected - start listening
      session.listening   = true;
      session.audioChunks = [];
      session.aborted     = false;
      break;
  }
}

// ── Main AI Pipeline ─────────────────────────────────────────────────
async function runPipeline(ws, session) {
  if (session.processing) return;
  session.processing = true;

  const t_start = Date.now();
  const { config } = session;

  try {
    // ── Step 1: STT ──────────────────────────────────────────────
    console.log(`[Pipeline] STT start...`);
    const t_stt = Date.now();

    let userText;
    try {
      // Use device's own STT API key if set, else fall back to server .env
      const sttKey = config.stt_api_key || '';
      if (sttKey) {
        process.env._TEMP_GROQ = sttKey; // pass to stt module temporarily
      }
      userText = await transcribe(session.audioChunks, config.speak_language);
      delete process.env._TEMP_GROQ;
    } catch (e) {
      console.error('[Pipeline] STT failed:', e.message);
      sendAlert(ws, 'STT Error', e.message);
      return;
    }

    console.log(`[Pipeline] STT done in ${Date.now() - t_stt}ms: "${userText}"`);

    if (!userText || userText.trim().length < 2) {
      console.log('[Pipeline] Empty STT result, ignoring');
      return;
    }

    // Send STT result to display on OLED
    send(ws, { type: 'stt', text: userText });

    if (session.aborted) return;

    // ── Step 2: LLM + TTS streaming (parallel) ───────────────────
    send(ws, { type: 'llm', emotion: 'thinking' });

    send(ws, { type: 'llm', emotion: 'thinking' });
    send(ws, { type: 'tts', state: 'start' });

    const t_llm = Date.now();
    let firstSentence = true;
    let fullResponse  = '';
    let detectedEmotion = 'neutral';

    // Stream sentences from LLM, synthesize each immediately
    for await (const sentence of streamResponse(userText, config)) {
      if (session.aborted) break;

      fullResponse += sentence + ' ';
      console.log(`[Pipeline] LLM sentence: "${sentence}"`);

      // Detect emotion from text
      detectedEmotion = detectEmotion(sentence);

      // Show text on OLED - caption language me (ASCII only for OLED)
      const caption = toAsciiCaption(sentence, config.caption_language);
      send(ws, { type: 'tts', state: 'sentence_start', text: caption });
      // Send emotion for display
      send(ws, { type: 'llm', emotion: detectedEmotion });

      if (firstSentence) {
        console.log(`[Pipeline] First sentence in ${Date.now() - t_llm}ms`);
        firstSentence = false;
      }

      // Synthesize this sentence to OPUS
      try {
        const opusFrames = await synthesize(
          sentence,
          config.speak_language || 'en-US',
          config.voice_gender   || 'female'
        );

        // Stream OPUS frames to ESP32
        for (const frame of opusFrames) {
          if (session.aborted) break;
          if (ws.readyState === WebSocket.OPEN) {
            ws.send(frame); // binary frame
          }
        }
      } catch (e) {
        console.error('[Pipeline] TTS error:', e.message);
      }
    }

    if (!session.aborted) {
      send(ws, { type: 'tts', state: 'stop' });
      send(ws, { type: 'llm', emotion: 'happy' });
    }

    console.log(`[Pipeline] Total: ${Date.now() - t_start}ms | Response: "${fullResponse.trim()}"`);

  } catch (e) {
    console.error('[Pipeline] Unexpected error:', e);
    sendAlert(ws, 'Error', 'Something went wrong. Please try again.');
  } finally {
    session.processing  = false;
    session.audioChunks = [];
  }
}

// ── Helpers ──────────────────────────────────────────────────────────
function send(ws, obj) {
  if (ws.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify(obj));
  }
}

function sendAlert(ws, status, message) {
  send(ws, { type: 'alert', status, message, emotion: 'sad' });
}

// ── Emotion detection from text ──────────────────────────────────────
function detectEmotion(text) {
  const t = text.toLowerCase();
  if (/happy|great|wonderful|excellent|amazing|love|joy|glad|yay|haha/.test(t)) return 'happy';
  if (/sad|sorry|unfortunate|bad|terrible|awful|miss|cry/.test(t)) return 'sad';
  if (/angry|frustrated|annoyed|upset|hate/.test(t)) return 'angry';
  if (/wow|incredible|surprised|really\?|omg/.test(t)) return 'surprised';
  if (/think|consider|perhaps|maybe|hmm|let me/.test(t)) return 'thinking';
  if (/excited|fantastic|awesome|yes|absolutely/.test(t)) return 'excited';
  return 'neutral';
}

// ── Caption: convert to ASCII-safe text for OLED display ─────────────
// OLED 0.96" only supports ASCII (font5x7)
// Hindi/other scripts → show transliterated or English fallback
function toAsciiCaption(text, captionLang) {
  if (!text) return '';
  // Remove non-ASCII characters (Hindi, Chinese, etc.)
  // Keep only printable ASCII (32-126)
  const ascii = text.replace(/[^\x20-\x7E]/g, '?');
  // Truncate to 80 chars (4 lines of 20 chars on OLED)
  return ascii.substring(0, 80);
}

// ── Emotion to OLED symbol ────────────────────────────────────────────
function emotionToSymbol(emotion) {
  const map = {
    'happy'    : ':)',
    'sad'      : ':(',
    'thinking' : '...',
    'excited'  : ':D',
    'angry'    : '>:(',
    'neutral'  : ':-|',
    'surprised': ':O',
    'love'     : '<3',
  };
  return map[emotion] || ':-|';
}

module.exports = { createWsServer };
