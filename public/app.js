/**
 * RIZZBOTT PANEL - Frontend (Auth + Bugs)
 */
const TOKEN_KEY = 'rizzbott_token';
const USER_KEY = 'rizzbott_user';
let token = localStorage.getItem(TOKEN_KEY) || '';
let user = JSON.parse(localStorage.getItem(USER_KEY) || 'null');
let socket = null;
const state = { devices: [], bugs: [], status: null };

const el = {
  loginScreen: document.getElementById('loginScreen'),
  appScreen: document.getElementById('appScreen'),
  loginForm: document.getElementById('loginForm'),
  loginUser: document.getElementById('loginUser'),
  loginPass: document.getElementById('loginPass'),
  loginError: document.getElementById('loginError'),
  btnLogin: document.getElementById('btnLogin'),
  btnLogout: document.getElementById('btnLogout'),
  userChip: document.getElementById('userChip'),
  serverStatus: document.getElementById('serverStatus'),
  statDevices: document.getElementById('statDevices'),
  statConnected: document.getElementById('statConnected'),
  statUptime: document.getElementById('statUptime'),
  statRole: document.getElementById('statRole'),
  deviceGrid: document.getElementById('deviceGrid'),
  bugGrid: document.getElementById('bugGrid'),
  bugDevice: document.getElementById('bugDevice'),
  bugTarget: document.getElementById('bugTarget'),
  bugLog: document.getElementById('bugLog'),
  msgLog: document.getElementById('msgLog'),
  settingsInfo: document.getElementById('settingsInfo'),
  modalAuth: document.getElementById('modalAuth'),
  modalAdd: document.getElementById('modalAdd'),
  qrImage: document.getElementById('qrImage'),
  pairingBox: document.getElementById('pairingBox'),
  pairingCode: document.getElementById('pairingCode'),
  modalHint: document.getElementById('modalHint'),
  modalTitle: document.getElementById('modalTitle'),
  phoneWrap: document.getElementById('phoneWrap')
};

function authHeaders() {
  return { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token };
}

async function api(path, opts = {}) {
  const res = await fetch(path, { ...opts, headers: { ...authHeaders(), ...(opts.headers || {}) } });
  if (res.status === 401) { doLogout(); throw new Error('unauthorized'); }
  return res;
}

el.loginForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  el.loginError.hidden = true;
  el.btnLogin.disabled = true;
  try {
    const res = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: el.loginUser.value.trim(), password: el.loginPass.value })
    });
    const data = await res.json();
    if (!res.ok) {
      el.loginError.textContent = data.error || 'Login gagal';
      el.loginError.hidden = false;
      return;
    }
    token = data.token;
    user = { username: data.username, role: data.role, label: data.label };
    localStorage.setItem(TOKEN_KEY, token);
    localStorage.setItem(USER_KEY, JSON.stringify(user));
    enterApp();
  } catch (err) {
    el.loginError.textContent = 'Server offline / error';
    el.loginError.hidden = false;
  } finally {
    el.btnLogin.disabled = false;
  }
});

el.btnLogout?.addEventListener('click', async () => {
  try { await api('/api/auth/logout', { method: 'POST' }); } catch (_) {}
  doLogout();
});

function doLogout() {
  token = ''; user = null;
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(USER_KEY);
  if (socket) { socket.disconnect(); socket = null; }
  el.appScreen.hidden = true;
  el.loginScreen.hidden = false;
  el.loginPass.value = '';
}

function enterApp() {
  el.loginScreen.hidden = true;
  el.appScreen.hidden = false;
  el.userChip.textContent = user.label + ' (' + user.role + ')';
  el.statRole.textContent = user.role;
  connectSocket();
  refreshStatus();
  refreshDevices();
  loadBugs();
}

function connectSocket() {
  if (socket) socket.disconnect();
  socket = io({ auth: { token } });
  socket.on('connect', () => { el.serverStatus.textContent = '● online'; el.serverStatus.classList.add('online'); });
  socket.on('disconnect', () => { el.serverStatus.textContent = '● offline'; el.serverStatus.classList.remove('online'); });
  socket.on('connect_error', () => { el.serverStatus.textContent = '● auth error'; el.serverStatus.classList.remove('online'); });
  socket.on('device:created', () => refreshDevices());
  socket.on('device:deleted', () => refreshDevices());
  socket.on('device:update', (d) => {
    const idx = state.devices.findIndex(x => x.id === d.id);
    if (idx >= 0) { state.devices[idx] = { ...state.devices[idx], ...d }; renderDevices(); fillBugDevices(); }
    if (d.status === 'connected') {
      el.modalHint.textContent = 'Connected · ' + (d.phone || '');
      setTimeout(() => { el.modalAuth.hidden = true; }, 1200);
    }
  });
  socket.on('device:qr', (d) => {
    el.qrImage.src = d.qr; el.qrImage.hidden = false; el.pairingBox.hidden = true;
    el.modalHint.textContent = 'Scan QR dengan WhatsApp';
  });
  socket.on('device:pairing', (d) => {
    el.pairingCode.textContent = d.code; el.pairingBox.hidden = false; el.qrImage.hidden = true;
    el.modalHint.textContent = 'Masukkan kode di Linked Devices';
  });
  socket.on('message:incoming', (m) => {
    const row = document.createElement('div');
    row.className = 'msg-item';
    row.innerHTML = '<div class="meta">' + esc(m.deviceId) + ' · ' + esc(m.from) + ' · ' + new Date(m.timestamp * 1000).toLocaleTimeString() + '</div><div>' + esc(m.body) + '</div>';
    el.msgLog.prepend(row);
  });
  socket.on('bug:executed', (m) => { appendBugLog('OK ' + m.bugId + ' → ' + m.target + ' by ' + m.user); });
}

document.querySelectorAll('.nav-item').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.nav-item').forEach(b => b.classList.remove('active'));
    document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
    btn.classList.add('active');
    document.getElementById('view-' + btn.dataset.view).classList.add('active');
    if (btn.dataset.view === 'settings') loadSettings();
    if (btn.dataset.view === 'bugs') { fillBugDevices(); loadBugs(); }
  });
});

async function refreshStatus() {
  try {
    const res = await api('/api/status');
    const data = await res.json();
    state.status = data;
    el.serverStatus.textContent = '● online';
    el.serverStatus.classList.add('online');
    el.statDevices.textContent = data.devices;
    el.statConnected.textContent = data.connected ?? 0;
    el.statUptime.textContent = formatUptime(data.uptime);
    el.statRole.textContent = data.role || user?.role || '—';
  } catch {
    el.serverStatus.textContent = '● offline';
    el.serverStatus.classList.remove('online');
  }
}

async function refreshDevices() {
  try {
    const res = await api('/api/devices');
    const data = await res.json();
    state.devices = data.devices || [];
    renderDevices();
    fillBugDevices();
    el.statConnected.textContent = state.devices.filter(d => d.status === 'connected').length;
    el.statDevices.textContent = state.devices.length;
  } catch (e) { console.error(e); }
}

function renderDevices() {
  if (!state.devices.length) {
    el.deviceGrid.innerHTML = '<div class="card" style="grid-column:1/-1;text-align:center;color:var(--muted)">Belum ada device. Klik "+ Device Baru".</div>';
    return;
  }
  el.deviceGrid.innerHTML = state.devices.map(d =>
    '<div class="device-card" data-id="' + d.id + '"><div class="top"><div><div class="device-name">' + esc(d.name) + '</div><div class="device-phone">' + (d.phone || '—') + '</div></div><span class="badge ' + d.status + '">' + d.status + '</span></div><div class="device-actions"><button class="btn ghost" onclick="startDevice(\'' + d.id + '\')">Connect</button><button class="btn ghost" onclick="showQR(\'' + d.id + '\')">QR / Code</button><button class="btn danger" onclick="deleteDevice(\'' + d.id + '\')">Hapus</button></div></div>'
  ).join('');
}

function fillBugDevices() {
  const connected = state.devices.filter(d => d.status === 'connected');
  el.bugDevice.innerHTML = connected.length
    ? connected.map(d => '<option value="' + d.id + '">' + esc(d.name) + ' (' + (d.phone || d.id) + ')</option>').join('')
    : '<option value="">— tidak ada device connected —</option>';
}

async function loadBugs() {
  try {
    const res = await api('/api/bugs');
    const data = await res.json();
    state.bugs = data.bugs || [];
    renderBugs();
  } catch (e) { console.error(e); }
}

function renderBugs() {
  el.bugGrid.innerHTML = state.bugs.map(b =>
    '<div class="bug-card"><div style="display:flex;justify-content:space-between;align-items:center;gap:8px"><div class="bug-name">' + esc(b.name) + '</div><span class="risk ' + b.risk + '">' + b.risk + '</span></div><div class="bug-desc">' + esc(b.description) + '</div><button class="btn primary" onclick="runBug(\'' + b.id + '\')">Execute</button></div>'
  ).join('');
}

async function runBug(bugId) {
  const deviceId = el.bugDevice.value;
  const target = el.bugTarget.value.trim();
  if (!deviceId) { appendBugLog('ERROR: pilih device connected'); return; }
  if (!target) { appendBugLog('ERROR: isi target nomor/jid'); return; }
  appendBugLog('RUNNING ' + bugId + ' → ' + target + ' ...');
  try {
    const res = await api('/api/bugs/execute', {
      method: 'POST',
      body: JSON.stringify({ bugId, deviceId, target })
    });
    const data = await res.json();
    if (!res.ok) { appendBugLog('FAIL ' + bugId + ': ' + (data.error || res.status)); return; }
    appendBugLog('OK ' + bugId + ' → ' + data.target);
  } catch (e) { appendBugLog('FAIL ' + bugId + ': ' + e.message); }
}

function appendBugLog(text) {
  const row = document.createElement('div');
  row.className = 'msg-item bug';
  row.innerHTML = '<div class="meta">' + new Date().toLocaleTimeString() + '</div><div>' + esc(text) + '</div>';
  el.bugLog.prepend(row);
}

document.getElementById('btnQuickAdd')?.addEventListener('click', async () => {
  const name = document.getElementById('quickName').value.trim();
  if (!name) return;
  await createDevice(name);
  document.getElementById('quickName').value = '';
});
document.getElementById('btnAddDevice')?.addEventListener('click', () => { el.modalAdd.hidden = false; });
document.getElementById('modalAddClose')?.addEventListener('click', () => { el.modalAdd.hidden = true; });
document.getElementById('inputAuthMethod')?.addEventListener('change', (e) => { el.phoneWrap.hidden = e.target.value !== 'pairing'; });
document.getElementById('btnCreateDevice')?.addEventListener('click', async () => {
  const name = document.getElementById('inputDeviceName').value.trim();
  if (!name) return;
  const method = document.getElementById('inputAuthMethod').value;
  const phone = document.getElementById('inputPhone').value.trim();
  el.modalAdd.hidden = true;
  const device = await createDevice(name);
  if (device) {
    socket?.emit('device:start', { id: device.id, method, phone });
    openAuthModal(device.id, method);
  }
});
document.getElementById('modalClose')?.addEventListener('click', () => { el.modalAuth.hidden = true; });

async function createDevice(name) {
  const res = await api('/api/devices', { method: 'POST', body: JSON.stringify({ name }) });
  if (!res.ok) { const err = await res.json(); alert(err.error || 'Gagal'); return null; }
  const device = await res.json();
  await refreshDevices();
  return device;
}
async function deleteDevice(id) {
  if (!confirm('Hapus device ini? Session akan hilang.')) return;
  await api('/api/devices/' + id, { method: 'DELETE' });
  await refreshDevices();
}
function startDevice(id) { socket?.emit('device:start', { id }); openAuthModal(id, 'qr'); }
async function showQR(id) {
  const res = await api('/api/devices/' + id + '/qr');
  const data = await res.json();
  openAuthModal(id, data.pairingCode ? 'pairing' : 'qr');
  if (data.qr) { el.qrImage.src = data.qr; el.qrImage.hidden = false; el.pairingBox.hidden = true; }
  if (data.pairingCode) { el.pairingCode.textContent = data.pairingCode; el.pairingBox.hidden = false; el.qrImage.hidden = true; }
}
function openAuthModal(id, method) {
  el.modalAuth.hidden = false;
  el.modalTitle.textContent = method === 'pairing' ? 'Pairing Code' : 'Scan QR';
  el.qrImage.hidden = method !== 'qr';
  el.pairingBox.hidden = method !== 'pairing';
  el.modalHint.textContent = 'Menunggu...';
}
async function loadSettings() {
  try {
    const res = await api('/api/status');
    const data = await res.json();
    el.settingsInfo.textContent = JSON.stringify({ ...data, user }, null, 2);
  } catch { el.settingsInfo.textContent = 'Gagal load status'; }
}
function esc(s) { const d = document.createElement('div'); d.textContent = s ?? ''; return d.innerHTML; }
function formatUptime(sec) {
  if (!sec && sec !== 0) return '—';
  const h = Math.floor(sec / 3600); const m = Math.floor((sec % 3600) / 60);
  return h + 'h ' + m + 'm';
}
window.startDevice = startDevice;
window.showQR = showQR;
window.deleteDevice = deleteDevice;
window.runBug = runBug;

if (token && user) enterApp();
else { el.loginScreen.hidden = false; el.appScreen.hidden = true; }
setInterval(() => { if (token) refreshStatus(); }, 15000);
