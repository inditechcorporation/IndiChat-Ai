# ESP Voice Assistant - Self-Hosted Platform
### Faster than Xiaozhi | Your own AI voice assistant

---

## Architecture

```
ESP32 DevKit V1
  │
  │ Boot → POST /ota/ → get activation code OR websocket URL
  │ Talk → WebSocket ws://server:8765 → voice pipeline
  │
Server (Node.js)
  ├── HTTP :3000  → Web dashboard + OTA API
  └── WS   :8765  → Voice pipeline
        │
        ├── STT: Groq Whisper (~300ms) ← FASTEST
        ├── LLM: Gemini Flash / DeepSeek (streaming)
        └── TTS: Edge TTS (free) / Google / ElevenLabs
```

## Speed Comparison

| Step | Xiaozhi | This System |
|------|---------|-------------|
| STT  | ~800ms  | ~300ms (Groq) |
| LLM  | ~1500ms | ~400ms (streaming) |
| TTS  | ~600ms  | ~200ms (Edge) |
| **Total** | **~3s** | **~1s** |

---

## Quick Start

### 1. Server
```bash
cd my-platform/server
npm install
cp .env.example .env
# Edit .env - set HOST to your PC's IP address
npm start
```

### 2. Web Dashboard
```bash
cd my-platform/web
npm install
npm run dev        # development
npm run build      # production (copies to server)
```

Open: https://indichat-ai.onrender.com/

### 3. Firmware
```bash
cd xiaozhi-esp32   # root of this repo
idf.py set-target esp32
idf.py menuconfig
  # → Xiaozhi Assistant → Board Type → "My ESP32 Voice Board"
  # → Xiaozhi Assistant → Default OTA URL → http://YOUR_PC_IP:3000/ota/
  # → Xiaozhi Assistant → OLED Type → SSD1306 128*64
idf.py build
idf.py -p COM3 flash
```

---

## API Keys Needed

| Service | Use | Free? | Link |
|---------|-----|-------|------|
| Groq | STT (speech→text) | Yes (free tier) | console.groq.com |
| Gemini | LLM (AI brain) | Yes (free tier) | aistudio.google.com |
| Edge TTS | TTS (text→speech) | Yes (always free) | built-in |

---

## Hardware Wiring

```
INMP441 Mic:    WS→25, SCK→26, SD→32, L/R→GND
MAX98357A Amp:  BCLK→14, LRCLK→27, DIN→33
OLED SSD1306:   SDA→21, SCL→22
Red LED:        GPIO2 → 220Ω → LED → GND
Leaf Button:    GPIO4 → GND
Boot Button:    GPIO0 (on DevKit)
Slide Switch:   middle→GPIO15, one side→GND
Battery:        3.7V LiPo → TP4056 → VIN
```

---

## Usage

| Action | What happens |
|--------|-------------|
| Slide switch ON | Power on |
| First boot | Shows WiFi config mode on OLED |
| Boot button (short) | Toggle talk |
| Leaf button (hold) | Push-to-talk |
| Boot button (long) | Re-enter WiFi config |
| LED ON | Listening |
| LED OFF | Idle / Speaking |
