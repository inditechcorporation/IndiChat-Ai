# Server - Deploy karne ke 3 tarike

## Option 1: Render.com (FREE - recommended)
1. github.com pe account banao
2. my-platform folder GitHub pe push karo
3. render.com pe jao → New Web Service → GitHub repo select karo
4. Root directory: `server`
5. Build: `npm install`  Start: `node index.js`
6. Deploy! URL milega: `https://my-voice-server.onrender.com`

## Option 2: Railway.app (FREE tier)
1. railway.app → New Project → GitHub repo
2. Root: server, auto-detect Node.js
3. Add env vars from .env.example

## Option 3: Local PC (simple)
```bash
cd server
npm install
cp .env.example .env
node index.js
```
Server: http://localhost:3000

## Firmware me URL update karo
config.h me:
```c
#define SERVER_HOST  "my-voice-server.onrender.com"
#define SERVER_PORT  443
#define OTA_URL      "https://my-voice-server.onrender.com/ota/"
```
