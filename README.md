# ⚡ Enchant AM Premium Generator

<p align="center">
  <b>High-Performance Automated Alight Motion Premium Account Generator & Verification Service</b><br>
  Built with Custom Cloudflare Turnstile Solvers, Domain Routing, REST API & WhatsApp Bot Integration.
</p>

<p align="center">
  <a href="https://am.enchant.id"><img src="https://img.shields.io/badge/Live_Demo-am.enchant.id-FF512F?style=for-the-badge&logo=googlechrome&logoColor=white" alt="Live Demo" /></a>
  <img src="https://img.shields.io/badge/Node.js-v18+-339933?style=for-the-badge&logo=node.js&logoColor=white" alt="Node.js" />
  <img src="https://img.shields.io/badge/Express.js-4.x-000000?style=for-the-badge&logo=express&logoColor=white" alt="Express" />
  <img src="https://img.shields.io/badge/Python-3.10+-3776AB?style=for-the-badge&logo=python&logoColor=white" alt="Python" />
  <img src="https://img.shields.io/badge/License-MIT-blue?style=for-the-badge" alt="License" />
</p>

---

## 🌐 Live Preview / Demo

> 🔗 **Website**: [https://am.enchant.id](https://am.enchant.id)  
> 📬 **Webmail Viewer**: [https://am.enchant.id/mail.html](https://am.enchant.id/mail.html)

---

## 🌟 Fitur Utama

- ⚡ **Instant AM Premium Generation**: Otomasi pembuatan dan aktivasi lisensi akun Alight Motion Premium secara instan.
- 🛡️ **Intelligent Turnstile Solver**: Bypass Cloudflare Turnstile secara otomatis dengan kombinasi solver lokal berbasis CDP (Chrome DevTools Protocol) dan external fallback API.
- 📧 **Custom Domain Email Pipeline**: Integrasi langsung dengan Cloudflare Email Routing pada domain kustom (`@enchant.id`) untuk menangkap link aktivasi & OTP Firebase secara real-time.
- 💬 **WhatsApp Bot Gateway**: Layanan bot WhatsApp interaktif untuk generate akun, verifikasi pairing token, dan pengiriman kredensial akun ke pelanggan.
- 📊 **Real-time Stats & Account Pool**: Manajemen persediaan akun (account pool), pencatatan statistik penggunaan, dan pemantauan limit request.
- 🔄 **Multi-engine Architecture**: Dilengkapi `amDomainEngine`, `amPremEngine`, `coreEngine`, serta modul worker Python & Puppeteer.

---

## 🛠️ Tech Stack

- **Backend**: Node.js (Express), Python 3
- **Automation & Headless**: Puppeteer, Chrome DevTools Protocol (CDP), Playwright
- **Security & Turnstile**: Custom Turnstile Engine, Native Solver, FlareSolverr
- **Email & Routing**: Cloudflare Email Worker, SMTP Receiver
- **Messaging**: WhatsApp Web JS (`waBotService.js`)
- **Process Manager**: PM2

---

## 🚀 Panduan Instalasi & Menjalankan

### 1. Clone Repository
```bash
git clone https://github.com/callmezext/enchant-am-generator.git
cd enchant-am-generator
```

### 2. Install Dependencies
```bash
# Install Node dependencies
npm install

# Install Python requirements (opsional untuk Python worker)
pip3 install requests
```

### 3. Konfigurasi Environment
Buat atau sesuaikan berkas `.env` / konfigurasi:
```env
PORT=3001
CF_TOKEN=your_cloudflare_api_token
CF_ZONE_ID=your_zone_id
CF_ACCOUNT_ID=your_account_id
```

### 4. Menjalankan Server
```bash
# Mode Development
node server.js

# Mode Production (PM2)
pm2 start server.js --name am-server
pm2 save
```

Layanan akan aktif pada port `3001`: [http://localhost:3001](http://localhost:3001).

---

## 📡 Dokumentasi Endpoint REST API

### 1. Generate Akun Premium Baru
```http
POST /api/generate
Content-Type: application/json

{
  "domain": "enchant.id",
  "plan": "pro"
}
```

### 2. Live Mailbox / Inbox Check
```http
GET /api/mail/inbox?address=user@enchant.id
```

### 3. Generate WhatsApp Pairing Token
```http
POST /api/wa/generate-pair-token
Content-Type: application/json

{
  "userEmail": "customer@gmail.com"
}
```

### 4. Status Server & Metrics
```http
GET /api/stats
```

---

## 📂 Struktur Direktori

```
enchant-am-generator/
├── public/                 # Antarmuka Web & Webmail
│   ├── index.html          # Web generator utama
│   └── mail.html           # Webmail inbox viewer
├── amDomainEngine.js       # Engine pembuatan email & aktivasi domain
├── amPremEngine.js         # Core logic pembuatan AM Premium
├── arkanaEngine.js         # Headless browser automation worker
├── coreEngine.js           # Turnstile solver & orchestration
├── emailStore.js           # In-memory & persistent storage email
├── server.js               # Express API backend server
├── waBotService.js         # WhatsApp Bot integration service
└── .gitignore              # Proteksi berkas sensitif & sesi
```

---

## 📄 Lisensi

Project ini dirilis di bawah lisensi **MIT**. Dikembangkan dengan ❤️ oleh **[Callme Zettx](https://github.com/callmezext)**.
