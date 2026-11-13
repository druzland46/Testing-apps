# coolify-demo

Aplikasi contoh (Node.js + Express) untuk mencoba deploy dengan Coolify.

- Halaman `/` menampilkan versi, ID container, status database, dan form catatan.
- Tanpa `DATABASE_URL`: catatan disimpan di memori (hilang saat redeploy).
- Dengan `DATABASE_URL` (PostgreSQL): catatan disimpan permanen. Tabel dibuat otomatis.

| Endpoint | Fungsi |
|---|---|
| `GET /` | Halaman info + catatan |
| `GET /health` | Healthcheck (`{"status":"ok"}`) |
| `GET /api/info` | Info runtime dalam JSON |
| `GET /api/notes` / `POST /api/notes` | Baca / tambah catatan (`{"text":"..."}`) |

## Variabel environment

| Nama | Default | Kegunaan |
|---|---|---|
| `PORT` | `3000` | Port aplikasi |
| `APP_VERSION` | `1.0.0` | Ubah untuk melihat efek redeploy / rollback |
| `GREETING` | `Halo dari Coolify!` | Ubah untuk mencoba environment variable |
| `DATABASE_URL` | – | URL PostgreSQL. Kosong = mode memori |

## Jalankan lokal

```bash
npm install
npm start                      # http://localhost:3000
docker compose up --build      # app + PostgreSQL
```

## Deploy di Coolify

### Persiapan (sekali saja)
Server ada di belakang proxy kantor, jadi tambahkan proxy sebagai **Build Variable** di setiap aplikasi (Environment Variables):

```
HTTP_PROXY={{team.HTTP_PROXY}}
HTTPS_PROXY={{team.HTTPS_PROXY}}
NO_PROXY={{team.NO_PROXY}}
http_proxy={{team.http_proxy}}
https_proxy={{team.https_proxy}}
no_proxy={{team.no_proxy}}
```

### Skenario 1: Nixpacks (tanpa Dockerfile)
1. Projects → project → **+ New** → **Public Repository** → isi URL repo GitHub ini.
2. Build Pack: **Nixpacks**. Base directory: `/` (atau `/sample-app` bila repo berisi banyak folder).
3. Kosongkan **Domains**. Isi **Ports Exposes** `3000` dan **Ports Mappings** `3000:3000`.
4. Tambahkan variabel proxy di atas, lalu **Deploy**.
5. Buka `http://<IP-server>:3000`.

### Skenario 2: Dockerfile
Sama seperti skenario 1, tapi Build Pack: **Dockerfile**.

### Skenario 3: Tambah PostgreSQL
1. Di project yang sama: **+ New** → **PostgreSQL** → Start.
2. Salin **Postgres URL (internal)**.
3. Di aplikasi, tambahkan variabel `DATABASE_URL=<url internal>` (runtime), lalu **Redeploy**.
4. Halaman `/` sekarang menampilkan `database: terhubung (PostgreSQL)` dan catatan tetap ada setelah redeploy.

### Skenario 4: Docker Compose (app + DB sekaligus)
Build Pack: **Docker Compose**, file `docker-compose.yml`. Isi `POSTGRES_PASSWORD` di Environment Variables.

### Skenario 5: Redeploy & rollback
1. Ubah `APP_VERSION` menjadi `1.1.0` (atau ubah kode lalu push), **Redeploy**.
2. Buka tab **Deployments** → pilih deployment lama → **Rollback**.
3. Halaman `/` kembali menampilkan versi lama.

## Masalah umum

| Gejala | Penyebab | Solusi |
|---|---|---|
| `npm ERR! code ETIMEDOUT` saat build | Proxy belum terpakai saat build | Pastikan variabel proxy dicentang **Build Variable** |
| `git clone` gagal | Server tidak bisa ke GitHub | Cek proxy Docker daemon dan `/root/.docker/config.json` di server |
| Halaman tidak terbuka dari laptop | Port belum dibuka firewall | Buka port 3000 dari jaringan Anda, atau pasang reverse proxy di nginx |
| `database: gagal terhubung` | `DATABASE_URL` salah | Pakai URL **internal** dari halaman database di Coolify |
