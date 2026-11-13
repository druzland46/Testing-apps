// Aplikasi contoh untuk mencoba Coolify.
// - Tanpa DATABASE_URL: catatan disimpan di memori (hilang saat restart).
// - Dengan DATABASE_URL (PostgreSQL): catatan disimpan permanen di database.
const express = require('express');
const os = require('os');
const { Pool } = require('pg');

const PORT = Number(process.env.PORT || 3000);
const APP_VERSION = process.env.APP_VERSION || '1.0.0';
const GREETING = process.env.GREETING || 'Halo dari Coolify!';
const STARTED_AT = new Date();

// ---------- Penyimpanan catatan ----------
let pool = null;
let dbStatus = 'tidak dipakai (memori)';
const memoryNotes = [];

async function initDb() {
  if (!process.env.DATABASE_URL) return;
  pool = new Pool({ connectionString: process.env.DATABASE_URL });
  try {
    await pool.query(`CREATE TABLE IF NOT EXISTS notes (
      id SERIAL PRIMARY KEY,
      text TEXT NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now()
    )`);
    dbStatus = 'terhubung (PostgreSQL)';
  } catch (err) {
    dbStatus = `gagal terhubung: ${err.message}`;
    console.error('[db]', err.message);
    pool = null;
  }
}

async function listNotes() {
  if (pool) {
    const { rows } = await pool.query('SELECT id, text, created_at FROM notes ORDER BY id DESC LIMIT 50');
    return rows;
  }
  return [...memoryNotes].reverse();
}

async function addNote(text) {
  if (pool) {
    await pool.query('INSERT INTO notes (text) VALUES ($1)', [text]);
    return;
  }
  memoryNotes.push({ id: memoryNotes.length + 1, text, created_at: new Date() });
}

// ---------- Info runtime ----------
function info() {
  return {
    app: 'coolify-demo',
    version: APP_VERSION,
    greeting: GREETING,
    hostname: os.hostname(), // = ID container di Docker
    node: process.version,
    startedAt: STARTED_AT.toISOString(),
    uptimeSeconds: Math.round(process.uptime()),
    database: dbStatus,
    // Variabel yang biasanya disediakan Coolify (tampil bila ada)
    sourceCommit: process.env.SOURCE_COMMIT || null,
    coolifyUrl: process.env.COOLIFY_URL || null,
    coolifyFqdn: process.env.COOLIFY_FQDN || null
  };
}

const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

// ---------- App ----------
const app = express();
app.disable('x-powered-by');
app.use(express.urlencoded({ extended: false }));
app.use(express.json());

// Healthcheck untuk Coolify
app.get('/health', (req, res) => res.json({ status: 'ok' }));

app.get('/api/info', (req, res) => res.json(info()));

app.get('/api/notes', async (req, res, next) => {
  try { res.json(await listNotes()); } catch (e) { next(e); }
});

app.post('/api/notes', async (req, res, next) => {
  const text = String(req.body.text || '').trim();
  if (!text) return res.status(400).json({ error: 'Field "text" wajib diisi.' });
  try { await addNote(text.slice(0, 500)); res.status(201).json({ ok: true }); } catch (e) { next(e); }
});

// Form HTML (tanpa JavaScript)
app.post('/notes', async (req, res, next) => {
  const text = String(req.body.text || '').trim();
  try { if (text) await addNote(text.slice(0, 500)); res.redirect(303, './'); } catch (e) { next(e); }
});

app.get('/', async (req, res, next) => {
  try {
    const i = info();
    const notes = await listNotes();
    const rows = Object.entries(i)
      .filter(([, v]) => v !== null)
      .map(([k, v]) => `<tr><th>${esc(k)}</th><td>${esc(v)}</td></tr>`).join('');
    const items = notes.length
      ? notes.map((n) => `<li>${esc(n.text)} <small>${esc(new Date(n.created_at).toLocaleString('id-ID'))}</small></li>`).join('')
      : '<li class="empty">Belum ada catatan.</li>';
    res.type('html').send(`<!doctype html>
<html lang="id"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>coolify-demo v${esc(APP_VERSION)}</title>
<style>
  body{font-family:system-ui,sans-serif;max-width:720px;margin:32px auto;padding:0 16px;color:#1b1f27;background:#f5f6f8}
  h1{margin:0 0 4px}.v{color:#c2580f;font-weight:600}
  table{width:100%;border-collapse:collapse;background:#fff;margin:16px 0;border-radius:8px;overflow:hidden}
  th,td{text-align:left;padding:8px 12px;border-bottom:1px solid #e3e5ea;font-size:14px;word-break:break-all}
  th{width:35%;color:#5d6474;font-weight:500}
  form{display:flex;gap:8px}input{flex:1;padding:8px;border:1px solid #ccd;border-radius:6px}
  button{padding:8px 16px;border:0;border-radius:6px;background:#c2580f;color:#fff;font-weight:600;cursor:pointer}
  ul{background:#fff;border-radius:8px;padding:12px 28px}li{margin:6px 0}small{color:#8a91a0}.empty{color:#8a91a0;list-style:none}
</style></head><body>
<h1>${esc(GREETING)}</h1>
<p>Versi <span class="v">${esc(APP_VERSION)}</span> · container <code>${esc(i.hostname)}</code></p>
<table>${rows}</table>
<h2>Catatan</h2>
<form method="post" action="notes"><input name="text" placeholder="Tulis catatan…" maxlength="500" required><button>Simpan</button></form>
<ul>${items}</ul>
</body></html>`);
  } catch (e) { next(e); }
});

app.use((err, req, res, next) => {
  console.error('[error]', err);
  res.status(500).json({ error: 'Terjadi kesalahan di server.' });
});

// ---------- Start & shutdown ----------
let server;
initDb().finally(() => {
  server = app.listen(PORT, '0.0.0.0', () => {
    console.log(`coolify-demo v${APP_VERSION} berjalan di port ${PORT} · database: ${dbStatus}`);
  });
});

function shutdown(signal) {
  console.log(`${signal} diterima, mematikan server...`);
  if (!server) process.exit(0);
  server.close(async () => {
    if (pool) await pool.end().catch(() => {});
    process.exit(0);
  });
  setTimeout(() => process.exit(1), 10000).unref();
}
process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));
