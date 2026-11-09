# Worker Registration (MVP)

A small mobile-first app for registering daily wage workers.

- **`/`**: public registration form. The QR code points here, so workers can scan it and register themselves.
- **`/admin`**: password-protected dashboard with totals, a searchable worker list, add/edit/delete, click-to-call, a QR code to download, and CSV export.

Stack: React + Vite (frontend), Bun + Hono (backend), SQLite via `bun:sqlite`, photos on local disk (resized to 800px JPEG with `sharp`, which also strips EXIF/GPS data).

## Project layout

```
server/index.ts   API routes, validation, auth, photo handling, serves web/dist
server/db.ts      All SQL (the only file to change when moving to MySQL)
web/src/          React app (PublicRegister, Admin, WorkerForm)
data/             SQLite file + photos (created on first run, git-ignored)
```

## Run locally

Requires [Bun](https://bun.sh) 1.1+.

```bash
cp .env.example .env        # set ADMIN_PASSWORD and JWT_SECRET
bun install
bun run build               # builds the React app into web/dist
bun run start               # http://localhost:3090
```

For frontend development with hot reload, run `bun run dev` (API on :3090) and `bun run dev:web` (Vite on :5173, which proxies `/api`).

## Deploy (Linux server with nginx + pm2)

```bash
git clone https://github.com/Devcoder980/worker-new.git ~/worker-new
cd ~/worker-new
cp .env.example .env        # set a strong ADMIN_PASSWORD, random JWT_SECRET, DATA_DIR=/home/ec2-user/worker-data
bun install && bun run build
pm2 start "bun server/index.ts" --name worker-new && pm2 save
```

nginx site (`/etc/nginx/conf.d/worker.conf`):

```nginx
server {
    listen 80;
    server_name worker.revnextrelation.com;
    client_max_body_size 12m;
    location / {
        proxy_pass http://127.0.0.1:3090;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

Then `sudo nginx -t && sudo systemctl reload nginx` and `sudo certbot --nginx -d worker.revnextrelation.com` for HTTPS. The phone camera needs HTTPS to work in the browser.

**Update:** `git pull && bun install && bun run build && pm2 restart worker-new`

**Backup:** copy `DATA_DIR` (the `workers.db*` files and the `photos/` folder).

## API

| Method | Path | Auth |
|---|---|---|
| POST | `/api/register` | public (multipart; source = `qr`) |
| POST | `/api/login`, `/api/logout` | none |
| GET | `/api/admin/stats` | admin |
| GET | `/api/admin/workers?search=&category=` | admin |
| POST | `/api/admin/workers` | admin (source = `admin`) |
| PUT / DELETE | `/api/admin/workers/:id` | admin |
| GET | `/api/admin/photos/:file` | admin |
| GET | `/api/admin/export.csv` | admin |

Public users can only submit the form; they cannot read any worker data or photos.

## Notes

- Mobile numbers are stored as 10 digits (`+91`, `0` and spaces are removed). Each number can be registered only once.
- "Today" is counted in India time (UTC+5:30).
- Login is rate-limited (10 tries per 15 min per IP); public sign-up is limited to 60 per 10 min per IP.
