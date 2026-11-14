#!/usr/bin/env node
/**
 * RIZZBOTT PANEL - Setup script
 * Creates session folder + copies .env
 */

const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const sessions = path.join(root, 'sessions');
const envExample = path.join(root, '.env.example');
const envFile = path.join(root, '.env');

if (!fs.existsSync(sessions)) {
  fs.mkdirSync(sessions, { recursive: true });
  console.log('[+] sessions/ created');
}

if (!fs.existsSync(envFile) && fs.existsSync(envExample)) {
  fs.copyFileSync(envExample, envFile);
  console.log('[+] .env created from .env.example');
}

console.log('[+] Setup done. Run: npm install && npm start');
