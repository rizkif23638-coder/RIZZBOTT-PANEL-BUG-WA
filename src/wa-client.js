/**
 * RIZZBOTT PANEL - WhatsApp Client Module
 * Uses @whiskeysockets/baileys for multi-device support
 *
 * This is the core connection handler.
 * Pair via QR or Pairing Code.
 */

const {
  default: makeWASocket,
  useMultiFileAuthState,
  DisconnectReason,
  fetchLatestBaileysVersion,
  makeCacheableSignalKeyStore,
  Browsers
} = require('@whiskeysockets/baileys');
const pino = require('pino');
const path = require('path');
const fs = require('fs-extra');
const QRCode = require('qrcode');
const config = require('../config/config.json');

const logger = pino({ level: 'silent' }); // quiet Baileys noise

class WAClient {
  constructor(deviceId, deviceName, io) {
    this.deviceId = deviceId;
    this.deviceName = deviceName;
    this.io = io;
    this.sock = null;
    this.status = 'idle';
    this.phone = null;
    this.qr = null;
    this.pairingCode = null;
    this.sessionDir = path.resolve(config.sessionPath || './sessions', deviceId);
  }

  async start() {
    await fs.ensureDir(this.sessionDir);
    const { state, saveCreds } = await useMultiFileAuthState(this.sessionDir);
    const { version } = await fetchLatestBaileysVersion();

    this.sock = makeWASocket({
      version,
      auth: {
        creds: state.creds,
        keys: makeCacheableSignalKeyStore(state.keys, logger)
      },
      printQRInTerminal: false,
      logger,
      browser: Browsers.ubuntu('Chrome'),
      syncFullHistory: false,
      markOnlineOnConnect: false,
      generateHighQualityLinkPreview: false
    });

    this.sock.ev.on('creds.update', saveCreds);

    this.sock.ev.on('connection.update', async (update) => {
      const { connection, lastDisconnect, qr } = update;

      if (qr) {
        this.qr = await QRCode.toDataURL(qr);
        this.status = 'qr';
        this.io.emit('device:qr', {
          id: this.deviceId,
          qr: this.qr,
          status: 'qr'
        });
      }

      if (connection === 'open') {
        this.status = 'connected';
        this.phone = this.sock.user?.id?.split(':')[0] || null;
        this.qr = null;
        this.io.emit('device:update', {
          id: this.deviceId,
          status: 'connected',
          phone: this.phone
        });
      }

      if (connection === 'close') {
        const code = lastDisconnect?.error?.output?.statusCode;
        const shouldReconnect = code !== DisconnectReason.loggedOut;

        this.status = shouldReconnect ? 'reconnecting' : 'logged_out';
        this.io.emit('device:update', {
          id: this.deviceId,
          status: this.status
        });

        if (shouldReconnect && config.features.autoReconnect) {
          setTimeout(() => this.start(), config.reconnectInterval || 5000);
        }
      }
    });

    this.sock.ev.on('messages.upsert', (m) => {
      if (!config.features.messageLogger) return;
      const msg = m.messages[0];
      if (!msg || msg.key.fromMe) return;
      this.io.emit('message:incoming', {
        deviceId: this.deviceId,
        from: msg.key.remoteJid,
        body: msg.message?.conversation ||
              msg.message?.extendedTextMessage?.text ||
              '[media/other]',
        timestamp: msg.messageTimestamp
      });
    });

    return this;
  }

  async requestPairingCode(phoneNumber) {
    // phoneNumber format: countrycode + number, no + or spaces
    // e.g. 6281234567890
    if (!this.sock) throw new Error('Socket not started');
    const code = await this.sock.requestPairingCode(phoneNumber);
    this.pairingCode = code;
    this.status = 'pairing';
    this.io.emit('device:pairing', {
      id: this.deviceId,
      code,
      status: 'pairing'
    });
    return code;
  }

  async sendText(jid, text) {
    if (!this.sock || this.status !== 'connected') {
      throw new Error('Device not connected');
    }
    return this.sock.sendMessage(jid, { text });
  }

  async logout() {
    if (this.sock) {
      await this.sock.logout();
      this.sock = null;
    }
    await fs.remove(this.sessionDir);
    this.status = 'logged_out';
    this.phone = null;
    this.qr = null;
    this.pairingCode = null;
  }

  getInfo() {
    return {
      id: this.deviceId,
      name: this.deviceName,
      status: this.status,
      phone: this.phone,
      qr: this.qr,
      pairingCode: this.pairingCode
    };
  }
}

module.exports = { WAClient };
