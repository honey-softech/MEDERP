# MedERP on AWS EC2 — Operations Guide

Practical steps for the production box (`mederp.co.in`).  
Repo path on the server: `~/mederp`  
Compose file: `docker-compose.prod.yml`  
Secrets live only on the server: `apps/web/.env` (never committed to git)

---

## 1. SSH into EC2

```bash
ssh -i YOUR_KEY.pem YOUR_EC2_USER@YOUR_EC2_HOST
cd ~/mederp
```

GitHub Actions deploy uses the same host/user/key from repository secrets:
`EC2_HOST`, `EC2_USER`, `EC2_SSH_KEY`.

---

## 2. Layout (what runs where)

| Piece | Role |
|-------|------|
| `web` | Next.js + Socket.IO custom server (port 3000 on localhost) |
| `db` | Postgres 16 (Docker volume `mederp_pgdata`) |
| `caddy` | HTTPS reverse proxy for `mederp.co.in` / `www` |

Useful commands:

```bash
cd ~/mederp

# Status
sudo docker compose --env-file apps/web/.env -f docker-compose.prod.yml ps

# Logs
sudo docker compose --env-file apps/web/.env -f docker-compose.prod.yml logs --tail=100 web
sudo docker compose --env-file apps/web/.env -f docker-compose.prod.yml logs --tail=50 caddy
sudo docker compose --env-file apps/web/.env -f docker-compose.prod.yml logs --tail=50 db

# Health
curl -fsS http://127.0.0.1:3000/api/health
curl -fsS https://mederp.co.in/api/health
```

---

## 3. Edit environment variables (`apps/web/.env`)

### 3.1 Open the file

```bash
cd ~/mederp
nano apps/web/.env
```

Save in nano: `Ctrl+O` → Enter → `Ctrl+X`.

### 3.2 Required keys (checklist)

Keep values in quotes where shown. Do **not** paste secrets into git or chat logs.

```env
# Database (password must match POSTGRES_PASSWORD below)
DATABASE_URL="postgresql://postgres:YOUR_DB_PASSWORD@db:5432/mederp?schema=public"
POSTGRES_PASSWORD=YOUR_DB_PASSWORD

# Public URLs (HTTPS)
NEXT_PUBLIC_API_URL="https://mederp.co.in"
NEXT_PUBLIC_SOCKET_URL="https://mederp.co.in"
WHATSAPP_MEDIA_BASE_URL="https://mederp.co.in"
COOKIE_SECURE="1"
SITE_ADDRESS="mederp.co.in,www.mederp.co.in"
ACME_EMAIL="admin@mederp.co.in"
NODE_ENV=production
PORT=3000

# Razorpay (Test Mode keys start with rzp_test_)
RAZORPAY_KEY_ID="rzp_test_...."
RAZORPAY_KEY_SECRET="...."
NEXT_PUBLIC_RAZORPAY_KEY_ID="rzp_test_...."

# One Razorpay Plan per MedERP tier (amount = plan fee + 18% GST)
# CLINIC ₹2949 · STARTER ₹5309 · GROWTH ₹7079
RAZORPAY_PLAN_ID_CLINIC="plan_...."
RAZORPAY_PLAN_ID_STARTER="plan_...."
RAZORPAY_PLAN_ID_GROWTH="plan_...."

# REQUIRED for autodebit tracking (Razorpay Dashboard → Webhooks → signing secret)
RAZORPAY_WEBHOOK_SECRET="...."

# WhatsApp / AskEva
ASKEVA_API_URL="https://backend.askeva.io/v1"
ASKEVA_API_TOKEN="...."
WHATSAPP_ACCESS_TOKEN="...."
WHATSAPP_TEMPLATE_LANG="en,en_IN"
WHATSAPP_OTP_TEMPLATE="as"
WHATSAPP_REMINDER_PARAMS="named"
WHATSAPP_REMINDER_TEMPLATE="appointment_reminder1"
WHATSAPP_INVESTIGATION_TEMPLATE="investigation_list"
WHATSAPP_VISIT_SUMMARY_TEMPLATE="visit_summary_"
WHATSAPP_BILL_RECEIPT_TEMPLATE="billpreceipt"
```

### 3.3 Current Razorpay plan IDs (Test Mode)

Update these if you recreate plans in the Razorpay dashboard:

| MedERP tier | Amount (incl. GST) | Env key | Example plan id |
|-------------|--------------------|---------|-----------------|
| CLINIC (Plan 1) | ₹2,949 | `RAZORPAY_PLAN_ID_CLINIC` | `plan_TeJsdSN6PAwtAJ` |
| STARTER (Plan 2) | ₹5,309 | `RAZORPAY_PLAN_ID_STARTER` | `plan_TeJtDouBjTwD2x` |
| GROWTH (Plan 3) | ₹7,079 | `RAZORPAY_PLAN_ID_GROWTH` | `plan_TeJtYuDOAcJnVA` |

If a plan amount does not match, MedERP creates a new plan via API for that payment (works, but clutters the Razorpay Plans list).

### 3.4 Apply env changes

Env is read when the container starts. After editing `.env`:

```bash
cd ~/mederp
sudo docker compose --env-file apps/web/.env -f docker-compose.prod.yml up -d --force-recreate web
curl -fsS http://127.0.0.1:3000/api/health
```

If `NEXT_PUBLIC_*` values changed, you must **rebuild** the image (those are baked at build time):

```bash
sudo docker compose --env-file apps/web/.env -f docker-compose.prod.yml up -d --build
```

---

## 4. Deploy code from GitHub

### Automatic
Push to `main` → workflow **Deploy to EC2** runs:
- `git fetch` + `git reset --hard origin/main`
- `docker compose ... up -d --build`
- waits for `/api/health`

### Manual on the server

```bash
cd ~/mederp
git fetch origin main
git reset --hard origin/main
sudo docker compose --env-file apps/web/.env -f docker-compose.prod.yml up -d --build
curl -fsS http://127.0.0.1:3000/api/health
```

**Important:** deploy does **not** overwrite `apps/web/.env`. Edit env separately (section 3).

---

## 5. Wipe / reset the database (destructive)

This deletes **all** hospitals, users, invoices, sessions, medicine catalog data in Postgres, etc.

### Option A — Drop schema (keeps volume, clears data)

```bash
cd ~/mederp

# Enter Postgres
sudo docker compose --env-file apps/web/.env -f docker-compose.prod.yml exec -T db \
  psql -U postgres -d mederp <<'SQL'
DROP SCHEMA public CASCADE;
CREATE SCHEMA public;
GRANT ALL ON SCHEMA public TO postgres;
GRANT ALL ON SCHEMA public TO public;
SQL
```

Then recreate schema + seed software admin:

```bash
# Migrations + seed run inside the web container
sudo docker compose --env-file apps/web/.env -f docker-compose.prod.yml exec web npx prisma migrate deploy
sudo docker compose --env-file apps/web/.env -f docker-compose.prod.yml exec web npx prisma db seed
```

Or recreate `web` so `start.sh` runs migrate + seed on boot:

```bash
sudo docker compose --env-file apps/web/.env -f docker-compose.prod.yml up -d --force-recreate web
```

### Option B — Delete the Postgres Docker volume (full wipe)

```bash
cd ~/mederp
sudo docker compose --env-file apps/web/.env -f docker-compose.prod.yml down
sudo docker volume rm mederp_mederp_pgdata
# If the name differs, list volumes:
sudo docker volume ls | grep mederp
sudo docker compose --env-file apps/web/.env -f docker-compose.prod.yml up -d --build
```

### After any wipe

1. **Software admin login** (created by seed / startup ensure):  
   - Mobile: `9999999999`  
   - Password: `Software@123`
2. **Drug catalog** is empty — re-import:

```bash
sudo docker compose --env-file apps/web/.env -f docker-compose.prod.yml exec web npm run db:ensure-drugs
```

(or wait for production startup drug ensure if enabled)

3. Re-register hospitals or create them from the SaaS console.  
4. Demo hospitals are **local-only** (`seed-demo-data.ts` is not for production).

---

## 6. Seed / software admin only

If login `9999999999` / `Software@123` fails after a wipe:

```bash
sudo docker compose --env-file apps/web/.env -f docker-compose.prod.yml exec web npx prisma db seed
```

Startup also ensures this admin exists when the server boots.

---

## 7. Razorpay checklist (production / test)

1. Dashboard in **Test Mode** (or Live when you go live — recreate plans + keys).
2. Keys in `apps/web/.env` match the same mode as the plans.
3. Three plan amounts = MedERP totals **including 18% GST**.
4. Webhook (**required** to record monthly autodebit as PAID invoices):

   - URL: `https://mederp.co.in/api/public/razorpay/webhook`
   - Events: `subscription.activated`, `subscription.charged`, `subscription.pending`, `subscription.halted`, `subscription.cancelled`, `subscription.completed`
   - Put signing secret in `RAZORPAY_WEBHOOK_SECRET` on the server, then recreate `web`
   - Without this, card can be linked but MedERP will not create invoices when Razorpay charges the card

5. Register flow: card auth now → ~₹5 token may authorize and **refund** → **no trial invoice** → first plan debit + PAID invoice after 1-month trial (via webhook).

6. Software admin: **Hospital list / detail** shows Razorpay linked status, next charge, and last autodebit.

7. Hospital SUPER_ADMIN: **Subscription** page → **Cancel at period end** stops future auto-debit after the current cycle.

---

## 8. Caddy / HTTPS

Caddyfile: `deploy/Caddyfile` (mounted into the `caddy` service).

After changing Caddyfile:

```bash
sudo docker compose --env-file apps/web/.env -f docker-compose.prod.yml up -d --force-recreate caddy
```

`www.mederp.co.in` redirects to `mederp.co.in`.

---

## 9. Common recovery recipes

### App unhealthy after deploy

```bash
sudo docker compose --env-file apps/web/.env -f docker-compose.prod.yml logs --tail=120 web
sudo docker compose --env-file apps/web/.env -f docker-compose.prod.yml up -d --build web
```

### Env changed but app still uses old values

```bash
sudo docker compose --env-file apps/web/.env -f docker-compose.prod.yml up -d --force-recreate web
```

### `NEXT_PUBLIC_*` wrong on the site

Must rebuild:

```bash
sudo docker compose --env-file apps/web/.env -f docker-compose.prod.yml up -d --build
```

### Disk / rebuild slow

EC2 instance size and free disk matter for `docker compose build`. Clear unused images if needed:

```bash
sudo docker system df
sudo docker image prune -f
```

---

## 10. What is NOT done by deploy

| Item | Who updates it |
|------|----------------|
| `apps/web/.env` secrets & plan IDs | You on EC2 |
| Postgres data | Persists in Docker volume until you wipe |
| Razorpay Dashboard plans/webhooks | You in Razorpay |
| GitHub secrets (`EC2_*`) | GitHub repo Settings → Secrets |

---

## 11. Quick “go live after a code push” checklist

1. Confirm GitHub Action **Deploy to EC2** succeeded.  
2. SSH → confirm `apps/web/.env` has Razorpay keys + three `RAZORPAY_PLAN_ID_*` lines.  
3. If you just edited `.env`: recreate `web` (section 3.4).  
4. `curl https://mederp.co.in/api/health` → `{"ok":true}`.  
5. Test `/register-hospital` → Add card (Razorpay test card).  
6. Login software admin if needed: `9999999999` / `Software@123`.

---

## 12. Daily backup and data protection

Patient, visit, and billing data lives in the Postgres Docker volume `mederp_pgdata`. That volume is **not** copied by git deploy. A disk failure, `docker volume rm`, or a bad wipe deletes it unless a dump exists **off the server**.

What is already in place:

- Postgres has **no public port**. Only the `web` container on the Docker network can reach it.
- The app listens on `127.0.0.1:3000`. The internet only hits Caddy on 80/443 (HTTPS).
- Login cookies are `httpOnly`, `SameSite=strict`, and `COOKIE_SECURE=1` behind HTTPS.

What a daily backup adds: a full database dump every night, kept 30 days on the server, and (when configured) an encrypted copy in S3.

### 12.1 One-time setup on EC2

```bash
ssh -i YOUR_KEY.pem ubuntu@YOUR_EC2_HOST
cd ~/mederp
git pull origin main
chmod +x scripts/backup-db.sh scripts/restore-db.sh

sudo mkdir -p /var/backups/mederp /etc/mederp
sudo chmod 700 /var/backups/mederp /etc/mederp

# Passphrase used to encrypt dumps before they leave the box. Store a copy offline.
openssl rand -base64 32 | sudo tee /etc/mederp/backup.pass >/dev/null
sudo chmod 600 /etc/mederp/backup.pass

sudo tee /etc/mederp/backup.env >/dev/null <<'EOF'
BACKUP_DIR=/var/backups/mederp
BACKUP_RETENTION_DAYS=30
BACKUP_PASSPHRASE_FILE=/etc/mederp/backup.pass
# Uncomment after the S3 bucket exists (section 12.3):
# BACKUP_S3_URI=s3://YOUR-BUCKET/mederp
EOF
sudo chmod 600 /etc/mederp/backup.env

# Prove a dump is created
bash scripts/backup-db.sh
sudo ls -lh /var/backups/mederp
```

### 12.2 Run every day at 02:15 server time

```bash
sudo tee /etc/cron.d/mederp-backup >/dev/null <<'EOF'
SHELL=/bin/bash
PATH=/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin
15 2 * * * ubuntu /bin/bash /home/ubuntu/mederp/scripts/backup-db.sh >> /var/log/mederp-backup.log 2>&1
EOF
sudo chmod 644 /etc/cron.d/mederp-backup
```

Check the next morning:

```bash
sudo tail -n 40 /var/log/mederp-backup.log
sudo ls -lh /var/backups/mederp
```

### 12.3 Copy backups off the EC2 disk (required)

A backup that stays only on the same disk is lost with the disk. Create a **private** S3 bucket (Block Public Access on, versioning on, default encryption on). Lifecycle: keep 90 days, then expire.

Install AWS CLI on the box, attach an IAM role that can `s3:PutObject` only on `s3://YOUR-BUCKET/mederp/*`, then set `BACKUP_S3_URI` in `/etc/mederp/backup.env` and run `bash scripts/backup-db.sh` once.

Optional second copy: an EBS snapshot of the instance volume once a day from the AWS console (Lifecycle Manager). That covers the Docker volume even if the dump script fails.

### 12.4 Restore (only when you mean to replace live data)

```bash
cd ~/mederp
CONFIRM_RESTORE=yes bash scripts/restore-db.sh /var/backups/mederp/mederp-YYYYMMDDTHHMMSSZ.dump.enc
```

Practice this once on a throwaway database or a stopped copy so a real incident is not the first restore.

### 12.5 Extra protection (do these on AWS, not in git)

| Control | Why |
|---------|-----|
| Security group: inbound **22, 80, 443** only. SSH from your IP, not `0.0.0.0/0` if you can avoid it. | Shrinks the attack surface. |
| SSH key only. No password login. | Stolen passwords cannot open the box. |
| Do not publish Postgres (`5432`) in compose or the security group. | The database is reachable only inside Docker. |
| Keep `apps/web/.env` mode `600`. Never commit it. | Keys and the DB password stay on the server. |
| S3 bucket private + versioning + encryption. | A deleted or overwritten dump can be recovered. |
| Keep the backup passphrase **offline** (password manager), not only on EC2. | An attacker who copies the disk still cannot read `.enc` dumps. |
| Test a restore every month. | An untested backup is not a backup. |

Deploy does **not** install the cron job or create `/etc/mederp`. That stays a one-time step on the server (12.1–12.2).

---

*Last aligned with MedERP OPD plans + daily Postgres backup (2026-09).*
