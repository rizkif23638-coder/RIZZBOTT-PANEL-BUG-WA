/**
 * Auth module - session token based
 * Credentials from config/users.json
 */

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const usersPath = path.join(__dirname, '../config/users.json');
const users = JSON.parse(fs.readFileSync(usersPath, 'utf8')).users;

// token -> { username, role, label, createdAt }
const sessions = new Map();

function login(username, password) {
  const user = users.find(
    u => u.username === username && u.password === password
  );
  if (!user) return null;

  const token = crypto.randomBytes(32).toString('hex');
  sessions.set(token, {
    username: user.username,
    role: user.role,
    label: user.label,
    createdAt: Date.now()
  });
  return { token, username: user.username, role: user.role, label: user.label };
}

function verify(token) {
  if (!token) return null;
  const s = sessions.get(token);
  if (!s) return null;
  // 24h expiry
  if (Date.now() - s.createdAt > 24 * 60 * 60 * 1000) {
    sessions.delete(token);
    return null;
  }
  return s;
}

function logout(token) {
  sessions.delete(token);
}

function requireAuth(req, res, next) {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : (req.query.token || req.body?.token);
  const session = verify(token);
  if (!session) {
    return res.status(401).json({ error: 'unauthorized' });
  }
  req.user = session;
  next();
}

function requireRole(...roles) {
  return (req, res, next) => {
    if (!req.user || !roles.includes(req.user.role)) {
      return res.status(403).json({ error: 'forbidden' });
    }
    next();
  };
}

module.exports = { login, verify, logout, requireAuth, requireRole, sessions };
