require('dotenv').config();
const express = require('express');
const http    = require('http');
const cors    = require('cors');
const path    = require('path');
const fs      = require('fs');

const { createWsServer } = require('./ws_server');

const app    = express();
const PORT   = process.env.PORT || 3000;

app.use(cors());
app.use(express.json({ limit: '20mb' }));

// ── API Routes ────────────────────────────────────────────────────────
app.use('/api/auth',    require('./routes/auth'));
app.use('/api/auth-sb', require('./routes/auth-supabase'));
app.use('/api/devices', require('./routes/devices'));
app.use('/api/chat',    require('./routes/chat'));
app.use('/api/admin',   require('./routes/admin'));
app.use('/ota',         require('./routes/ota'));

// ── Serve React frontend ──────────────────────────────────────────────
const webBuildPath = path.join(__dirname, '../web/dist');
if (fs.existsSync(webBuildPath)) {
  app.use(express.static(webBuildPath));
  app.get('*', (_req, res) => res.sendFile(path.join(webBuildPath, 'index.html')));
} else {
  app.get('/', (_req, res) => res.json({ status: 'running', note: 'Build web first' }));
}

// ── HTTP server (shared with WebSocket) ──────────────────────────────
const server = http.createServer(app);

server.listen(PORT, '0.0.0.0', () => {
  console.log(`\n🚀 IndiChat-Ai — IndiTech Corporation`);
  console.log(`   Server  →  http://localhost:${PORT}`);
  console.log(`   WS      →  ws://localhost:${PORT}/ws\n`);
});

// ── WebSocket on same port at /ws path ────────────────────────────────
createWsServer(server);
