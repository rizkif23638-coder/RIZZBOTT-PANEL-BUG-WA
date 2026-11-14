require('dotenv').config();
/**
 * RIZZBOTT PANEL BUG WA - Main Server
 * Auth (Admin / Developer) + Multi-device + Real bug executor
 */

const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const path = require('path');
const fs = require('fs-extra');
const pino = require('pino');
const config = require('../config/config.json');
const { login, logout, verify, requireAuth, requireRole } = require('./auth');
const { listBugs, executeBug } = require('./bugs');
const { WAClient } = require('./wa-client');

const logger = pino({ level: config.logLevel || 'info' });
const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: '*', methods: ['GET', 'POST'] }
});

app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));
app.use(express.static(path.join(__dirname, '../public')));

const sessionPath = path.resolve(
  process.env.SESSION_PATH ||
  (require('fs').existsSync('/data') ? '/data/sessions' : null) ||
  config.sessionPath ||
  './sessions'
);
fs.ensureDirSync(sessionPath);

const devices = new Map();

// ---------- AUTH ----------
app.post('/api/auth/login', (req, res) => {
  const { username, password } = req.body || {};
  if (!username || !password) {
    return res.status(400).json({ error: 'username & password required' });
  }
  const result = login(username, password);
  if (!result) {
    return res.status(401).json({ error: 'invalid credentials' });
  }
  logger.info({ user: result.username, role: result.role }, 'login');
  res.json(result);
});

app.post('/api/auth/logout', requireAuth, (req, res) => {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : '';
  logout(token);
  res.json({ ok: true });
});

app.get('/api/auth/me', requireAuth, (req, res) => {
  res.json({
    username: req.user.username,
    role: req.user.role,
    label: req.user.label
  });
});

// ---------- STATUS ----------
app.get('/api/status', requireAuth, (req, res) => {
  const connected = [...devices.values()].filter(d => d.client?.status === 'connected').length;
  res.json({
    status: 'online',
    devices: devices.size,
    connected,
    maxDevices: config.maxDevices,
    uptime: process.uptime(),
    version: '1.1.0',
    user: req.user.username,
    role: req.user.role
  });
});

// ---------- DEVICES ----------
app.get('/api/devices', requireAuth, (req, res) => {
  const list = [...devices.values()].map(d => ({
    id: d.id,
    name: d.name,
    status: d.client?.status || d.status || 'idle',
    phone: d.client?.phone || null,
    lastSeen: d.lastSeen || null,
    connectedAt: d.connectedAt || null
  }));
  res.json({ devices: list });
});

app.post('/api/devices', requireAuth, (req, res) => {
  const { name } = req.body || {};
  if (!name) return res.status(400).json({ error: 'name required' });
  if (devices.size >= config.maxDevices) {
    return res.status(429).json({ error: 'max devices reached' });
  }

  const id = `dev_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  const entry = {
    id,
    name,
    status: 'pending',
    lastSeen: null,
    connectedAt: null,
    client: null
  };
  devices.set(id, entry);
  logger.info({ id, name }, 'device created');
  io.emit('device:created', { id, name, status: 'pending' });
  res.json({ id, name, status: 'pending' });
});

app.delete('/api/devices/:id', requireAuth, async (req, res) => {
  const entry = devices.get(req.params.id);
  if (!entry) return res.status(404).json({ error: 'device not found' });
  try {
    if (entry.client) await entry.client.logout();
  } catch (_) {}
  devices.delete(req.params.id);
  fs.removeSync(path.join(sessionPath, req.params.id));
  io.emit('device:deleted', { id: req.params.id });
  res.json({ ok: true });
});

app.get('/api/devices/:id/qr', requireAuth, (req, res) => {
  const entry = devices.get(req.params.id);
  if (!entry) return res.status(404).json({ error: 'device not found' });
  const c = entry.client;
  res.json({
    id: entry.id,
    qr: c?.qr || null,
    pairingCode: c?.pairingCode || null,
    status: c?.status || entry.status
  });
});

app.post('/api/devices/:id/start', requireAuth, async (req, res) => {
  const entry = devices.get(req.params.id);
  if (!entry) return res.status(404).json({ error: 'device not found' });

  try {
    if (!entry.client) {
      entry.client = new WAClient(entry.id, entry.name, io);
    }
    await entry.client.start();
    entry.status = entry.client.status;
    res.json({ ok: true, status: entry.client.status });
  } catch (e) {
    logger.error(e, 'start failed');
    res.status(500).json({ error: e.message });
  }
});

app.post('/api/devices/:id/pair', requireAuth, async (req, res) => {
  const entry = devices.get(req.params.id);
  if (!entry) return res.status(404).json({ error: 'device not found' });
  const { phone } = req.body || {};
  if (!phone) return res.status(400).json({ error: 'phone required' });

  try {
    if (!entry.client) {
      entry.client = new WAClient(entry.id, entry.name, io);
      await entry.client.start();
    }
    const code = await entry.client.requestPairingCode(phone.replace(/\D/g, ''));
    res.json({ ok: true, code });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ---------- BUGS ----------
app.get('/api/bugs', requireAuth, (req, res) => {
  res.json({ bugs: listBugs() });
});

app.post('/api/bugs/execute', requireAuth, async (req, res) => {
  const { bugId, deviceId, target } = req.body || {};
  if (!bugId || !deviceId || !target) {
    return res.status(400).json({ error: 'bugId, deviceId, target required' });
  }

  const entry = devices.get(deviceId);
  if (!entry) return res.status(404).json({ error: 'device not found' });
  if (!entry.client || entry.client.status !== 'connected') {
    return res.status(400).json({ error: 'device not connected' });
  }

  try {
    const result = await executeBug(bugId, entry.client.sock, target);
    logger.info({
      bugId,
      deviceId,
      target,
      user: req.user.username
    }, 'bug executed');
    io.emit('bug:executed', {
      bugId,
      deviceId,
      target,
      user: req.user.username,
      at: Date.now()
    });
    res.json(result);
  } catch (e) {
    logger.error(e, 'bug execute failed');
    res.status(500).json({ error: e.message });
  }
});

// ---------- SOCKET ----------
io.use((socket, next) => {
  const token = socket.handshake.auth?.token || socket.handshake.query?.token;
  const session = verify(token);
  if (!session) return next(new Error('unauthorized'));
  socket.user = session;
  next();
});

io.on('connection', (socket) => {
  logger.info({ user: socket.user.username, sid: socket.id }, 'socket connected');

  socket.on('device:start', async (payload) => {
    const { id, method, phone } = payload || {};
    const entry = devices.get(id);
    if (!entry) {
      socket.emit('error', { message: 'device not found' });
      return;
    }
    try {
      if (!entry.client) {
        entry.client = new WAClient(entry.id, entry.name, io);
      }
      await entry.client.start();
      if (method === 'pairing' && phone) {
        await entry.client.requestPairingCode(phone.replace(/\D/g, ''));
      }
    } catch (e) {
      socket.emit('error', { message: e.message });
    }
  });

  socket.on('device:logout', async (payload) => {
    const entry = devices.get(payload?.id);
    if (!entry?.client) return;
    await entry.client.logout();
    entry.client = null;
    entry.status = 'logged_out';
    io.emit('device:update', { id: entry.id, status: 'logged_out' });
  });

  socket.on('disconnect', () => {
    logger.info({ sid: socket.id }, 'socket disconnected');
  });
});

app.get('*', (req, res) => {
  if (req.path.startsWith('/api')) return res.status(404).json({ error: 'not found' });
  res.sendFile(path.join(__dirname, '../public/index.html'));
});

const PORT = process.env.PORT || config.port || 3000;
const HOST = process.env.HOST || config.host || '0.0.0.0';

server.listen(PORT, HOST, () => {
  logger.info(`RIZZBOTT PANEL v1.1.0 on http://${HOST}:${PORT}`);
});

module.exports = { app, server, io, devices };
