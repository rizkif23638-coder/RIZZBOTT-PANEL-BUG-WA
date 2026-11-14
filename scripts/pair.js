#!/usr/bin/env node
/**
 * CLI helper - request pairing code for a phone number
 * Usage: node scripts/pair.js <deviceId> <phoneNumber>
 * Example: node scripts/pair.js dev_xxx 6281234567890
 */

const path = require('path');
const { WAClient } = require('../src/wa-client');

const [,, deviceId, phone] = process.argv;

if (!deviceId || !phone) {
  console.log('Usage: node scripts/pair.js <deviceId> <phoneNumber>');
  console.log('Example: node scripts/pair.js dev_123 6281234567890');
  process.exit(1);
}

// Minimal fake io for CLI
const fakeIo = {
  emit: (event, data) => {
    if (event === 'device:pairing') {
      console.log('\n[PAIRING CODE]', data.code);
      console.log('Masukkan di WhatsApp → Linked Devices → Link with phone number\n');
    } else if (event === 'device:update') {
      console.log('[STATUS]', data.status, data.phone || '');
    } else if (event === 'device:qr') {
      console.log('[QR] Tersedia — buka panel web untuk scan');
    }
  }
};

(async () => {
  const client = new WAClient(deviceId, 'CLI', fakeIo);
  await client.start();
  // Give socket a moment to init
  setTimeout(async () => {
    try {
      const code = await client.requestPairingCode(phone);
      console.log('Code:', code);
    } catch (e) {
      console.error('Error:', e.message);
    }
  }, 2000);
})();
