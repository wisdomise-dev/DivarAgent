import 'dotenv/config';
import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import path from 'path';
import { AgentRunner } from './agentRunner';

const app = express();
const httpServer = createServer(app);
const io = new Server(httpServer);

app.use(express.json());
app.use(express.static(path.join(__dirname, '../public')));

let runner: AgentRunner | null = null;

io.on('connection', (socket) => {
  if (runner) {
    socket.emit('status', { status: runner.status });
  }
});

function broadcastLog(level: string, msg: string) {
  io.emit('log', { level, msg, ts: new Date().toISOString() });
}
function broadcastStatus(state: any) {
  io.emit('status', state);
}

app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, '../public/index.html'));
});

app.post('/api/start', async (req, res) => {
  if (runner) {
    return res.status(400).json({ error: 'Agent already running' });
  }
  const { url } = req.body || {};
  if (!url || typeof url !== 'string') {
    return res.status(400).json({ error: 'URL required' });
  }

  runner = new AgentRunner();
  runner.onLog((level, msg) => broadcastLog(level, msg));
  runner.onStatus((state) => broadcastStatus(state));

  res.json({ ok: true, message: 'Agent started' });

  runner.run(url).finally(() => {
    runner = null;
  });
});

app.post('/api/login/phone', (req, res) => {
  if (!runner) return res.status(400).json({ error: 'No active agent' });
  const { phone } = req.body || {};
  if (!phone || typeof phone !== 'string') {
    return res.status(400).json({ error: 'Phone number required' });
  }
  runner.providePhone(phone);
  res.json({ ok: true });
});

app.post('/api/login/otp', (req, res) => {
  if (!runner) return res.status(400).json({ error: 'No active agent' });
  const { otp } = req.body || {};
  if (!otp || typeof otp !== 'string') {
    return res.status(400).json({ error: 'OTP required' });
  }
  runner.provideOtp(otp);
  res.json({ ok: true });
});

app.post('/api/stop', (req, res) => {
  if (runner) {
    runner.abort();
    res.json({ ok: true });
  } else {
    res.status(400).json({ error: 'No active agent' });
  }
});

app.get('/api/status', (req, res) => {
  res.json({ running: !!runner });
});

const PORT = process.env.PORT || 3344;
httpServer.listen(PORT, () => {
  console.log(`Divar Agent Dashboard: http://localhost:${PORT}`);
});
