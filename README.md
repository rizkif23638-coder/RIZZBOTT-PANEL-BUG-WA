# RIZZBOTT PANEL BUG WA v1.1

Panel multi-device WhatsApp + **real bug executor**.

## Login

| Role | Username | Password |
|------|----------|----------|
| Admin | `Admin` | `RizzBott 1` |
| Developer | `Developer` | `RizzBott1` |

Credentials: `config/users.json`

---

## Fitur

- Login Admin / Developer (token session 24 jam)
- Multi device (Baileys)
- Auth QR + Pairing Code
- **Bug Tools** (payload real, bukan stub):
  - Crash List Overflow
  - Catalog Overflow
  - Document Poison
  - Location Flood
  - Sticker Corrupt
  - Buttons Overflow
  - Reaction Flood
  - Group Invite Poison
  - Call Offer Spam
  - Hard Freeze Combo
- Realtime Socket.IO
- Message logger

---

## Install & Run

```bash
cd "RIZZBOTT PANEL BUG WA"
npm install
node scripts/setup.js
npm start
```

Buka: **http://localhost:3000**

Login dengan akun di atas.

---

## Alur pakai Bug

1. Login
2. Devices → tambah device → Connect (QR / Pairing)
3. Tunggu status `connected`
4. Bug Tools → pilih device connected → isi target (628xxx)
5. Klik **Execute** pada bug yang diinginkan
6. Cek Execution Log

Target format: `6281234567890` atau `6281234567890@s.whatsapp.net`

---

## Struktur

```
config/
  config.json
  users.json          ← kredensial login
src/
  server.js           ← Express + auth + bug API
  auth.js             ← login / token
  bugs.js             ← payload executor (real)
  wa-client.js        ← Baileys wrapper
public/
  index.html / app.js / style.css
scripts/
  setup.js / pair.js
```

---

## API

### Auth
- `POST /api/auth/login` `{ username, password }` → `{ token, role, ... }`
- `POST /api/auth/logout` (Bearer)
- `GET  /api/auth/me` (Bearer)

### Devices
- `GET/POST/DELETE /api/devices`
- `POST /api/devices/:id/start`
- `POST /api/devices/:id/pair` `{ phone }`

### Bugs
- `GET  /api/bugs` → list
- `POST /api/bugs/execute` `{ bugId, deviceId, target }`

Semua endpoint (kecuali login) butuh:
```
Authorization: Bearer <token>
```

---

## Catatan

- Bug module mengirim message constructs valid lewat Baileys. Efek tergantung versi client target.
- Session device di `sessions/<id>/` — jangan dibagikan.
- Ganti password di `config/users.json` sebelum deploy.

## License

MIT

---

## Deploy ke Railway

### 1. Siapkan repo

Upload folder ini ke GitHub (private boleh).

### 2. New project di Railway

1. https://railway.app → **New Project**
2. **Deploy from GitHub repo** → pilih repo panel
3. Railway deteksi Node otomatis (ada `railway.json` / `nixpacks.toml`)

### 3. Variables

Di service → **Variables**:

```
NODE_ENV=production
HOST=0.0.0.0
LOG_LEVEL=info
```

`PORT` di-set Railway sendiri — jangan hardcode. Server sudah baca `process.env.PORT`.

### 4. Volume (penting untuk session WA)

1. Service → **Settings** → **Volumes**
2. Add volume, mount path: `/data`
3. Session akan tersimpan di `/data/sessions` (survive restart)

Tanpa volume = tiap redeploy / restart, QR harus scan ulang.

### 5. Generate domain

Settings → **Networking** → **Generate Domain**

Contoh: `rizzbott-panel-production.up.railway.app`

### 6. Deploy

Railway build → start command:

```
node scripts/setup.js && node src/server.js
```

Buka domain → login:

- Admin / `RizzBott 1`
- Developer / `RizzBott1`

### 7. APK / Capacitor

Set `server.url` ke domain Railway (pakai **https**):

```json
"server": {
  "url": "https://rizzbott-panel-production.up.railway.app",
  "cleartext": false
}
```

### Catatan Railway

- Plan Hobby cukup untuk 1 service kecil
- Jangan biarkan service sleep (pakai plan yang always-on)
- Logs: tab **Deployments** → View Logs
- Ganti password di `config/users.json` sebelum public
