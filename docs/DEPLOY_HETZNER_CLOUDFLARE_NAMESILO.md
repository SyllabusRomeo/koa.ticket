# LogIt — Production deploy: Namesilo + Cloudflare + Hetzner + GitHub

**Audience:** you are going live on a Hetzner VPS, with the domain at **NameSilo**, DNS/WAF at **Cloudflare**, and app code from **GitHub** (`SyllabusRomeo/koa.ticket`).

**Goal:** `https://logit.koaimpact.app` serves LogIt (Nginx → web/api/worker) with TLS, secure cookies, and a repeatable `git pull` + Compose deploy.

**Complements:** [PRODUCTION.md](./PRODUCTION.md) · [SOP-05](./sops/05-hetzner-production.md) · [infra/hetzner/README.md](../infra/hetzner/README.md)

**Production hostname (this project):** `logit.koaimpact.app` (subdomain of `koaimpact.app`).

---

## 0. How the three systems fit together

```text
User browser
    │
    ▼
NameSilo          →  domain registration only (optional NS → Cloudflare)
    │
    ▼
Cloudflare        →  DNS for subdomain + proxy (orange cloud) + WAF / firewall rules
    │  (HTTPS to visitor; connects to origin on 80/443)
    ▼
Hetzner VPS       →  Docker Compose: Nginx (TLS) → web + api + worker
                     Postgres + Redis private; uploads volume
    │
    ▼
GitHub            →  source of truth; server pulls main/master (or CI deploys over SSH)
```

| System | You configure | You do **not** need |
| --- | --- | --- |
| **NameSilo** | Domain ownership; nameservers → Cloudflare (recommended) **or** a DNS record if NS stay at NameSilo | App hosting |
| **Cloudflare** | A/AAAA (or CNAME) for subdomain; SSL mode; WAF/firewall; (optional) page rules | Running containers |
| **Hetzner** | VPS, firewall, Docker, `.env`, Compose, certs, backups | Domain registrar UI |
| **GitHub** | Repo access (deploy key / PAT); pushes to `main`/`master` | Cloudflare DNS |

**Example throughout:** this project’s production values (replace only if you fork the hostname).

| Placeholder | This deployment |
| --- | --- |
| Apex domain | `koaimpact.app` |
| Subdomain host | `logit` → public URL **`https://logit.koaimpact.app`** |
| Hetzner public IPv4 | *(keep in private ops notes — do not commit)* |
| Admin email (Let’s Encrypt) | your ops mailbox on `koaimpact.app` (or any reachable inbox) |
| SSH user | `romeo` (or `deploy`) — not root day-to-day |

---

## 1. Decide DNS ownership (do this first)

You said the domain is at NameSilo and “has a firewall on Cloudflare.” That usually means one of:

### Option A — Cloudflare is authoritative DNS (recommended)

1. In Cloudflare: add site `koaimpact.app` → copy the two Cloudflare **nameservers**.
2. In NameSilo → **Domain Manager** → your domain → **NameServers** → change from NameSilo defaults to those Cloudflare NS.
3. Wait until Cloudflare shows the zone **Active** (can take minutes–hours).
4. Manage **all** DNS (including the new subdomain) **only in Cloudflare**.

### Option B — NameSilo stays authoritative; only some records point at Cloudflare

Possible but awkward (partial proxy). Prefer Option A for a clean WAF + DNS setup.

> If the apex already uses Cloudflare NS, skip NameSilo DNS for the subdomain — create the record in Cloudflare only.

---

## 2. Create the subdomain (Cloudflare DNS)

In **Cloudflare → DNS → Records → Add record**:

| Field | Value |
| --- | --- |
| Type | `A` |
| Name | `logit` → resolves as **`logit.koaimpact.app`** |
| IPv4 | your Hetzner server public IP *(private ops notes)* |
| Proxy status | **DNS only (grey cloud)** for first TLS bootstrap *(see §6)* |
| TTL | Auto |

Optional IPv6: add `AAAA` for `logit` pointing at the VPS IPv6 if Hetzner assigned one and you want dual-stack.

**Do not** create a conflicting `A` for the same name at NameSilo if Cloudflare owns the zone.

Verify from your laptop (after DNS propagates):

```bash
# Should eventually show Cloudflare IPs if orange-cloud, or Hetzner IP if grey-cloud
nslookup logit.koaimpact.app
dig +short logit.koaimpact.app
```

---

## 3. Cloudflare SSL / TLS and firewall (before go-live traffic)

### 3.1 SSL/TLS mode

**Cloudflare → SSL/TLS → Overview**

| Mode | When to use |
| --- | --- |
| **Full (strict)** | **Recommended** once the origin has a valid cert (Let’s Encrypt or Cloudflare Origin CA) covering `logit.koaimpact.app` |
| Full | Temporary only (origin self-signed) — not for long-term |
| Flexible | **Avoid** — HTTPS to Cloudflare, HTTP to origin (breaks secure cookies / `COOKIE_SECURE`) |

### 3.2 Always Use HTTPS

**SSL/TLS → Edge Certificates** → enable **Always Use HTTPS**.

### 3.3 Firewall / WAF (Cloudflare)

**Security → WAF** (plan-dependent) and/or **Security → WAF → Tools / Custom rules**:

Suggested starter rules (adjust to your threat model):

1. **Allow** known admin IPs to `/login` if you want tighter lock-down (optional).
2. **Block** or **Managed Challenge** countries you never serve (optional).
3. **Rate limiting** (if available) on `/api/v1/auth/login` and `/login`.
4. Keep **Bot Fight Mode** / managed rules on “essentially off” for API webhooks until you whitelist Slack/Teams/GitHub callbacks — otherwise inbound integrations may get challenged.

**Webhook / IMAP note:** Slack, Teams, and email inbound hit your **public hostname**. If Cloudflare challenges those POSTs, add WAF exceptions for:

- `/api/v1/integrations/*` (exact paths from [INTEGRATIONS_SLACK_TEAMS.md](./INTEGRATIONS_SLACK_TEAMS.md))
- Email inbound route if used ([INTEGRATIONS_EMAIL.md](./INTEGRATIONS_EMAIL.md))

### 3.4 Cloudflare → origin ports

Cloudflare proxy only forwards **80/443** to the origin. Your Hetzner firewall should expose **only 22 (SSH), 80, 443** publicly — matching [infra/hetzner/README.md](../infra/hetzner/README.md).

---

## 4. Prepare the Hetzner server

### 4.1 Create an SSH key on your PC (Windows) and add it in Hetzner

Do this **before** creating the VPS so the server is born with key auth (no password root login).

Hetzner Cloud UI: **Security → SSH Keys → Add SSH key** (dialog: “Add an SSH key”). The key must be **OpenSSH format**.

#### A. Generate the keypair (PowerShell on your laptop)

OpenSSH Client is included with modern Windows (`C:\Windows\System32\OpenSSH\`).

```powershell
# Create ~/.ssh if needed, then generate Ed25519 (recommended)
New-Item -ItemType Directory -Force -Path "$env:USERPROFILE\.ssh" | Out-Null
ssh-keygen -t ed25519 -C "logit-hetzner" -f "$env:USERPROFILE\.ssh\id_ed25519"
```

- When asked for a passphrase: set one for stronger laptop security, or press Enter for none (simpler; protect the private file).
- This creates:
  - **Public** (safe to paste into Hetzner): `%USERPROFILE%\.ssh\id_ed25519.pub`
  - **Private** (never share / never paste into Hetzner): `%USERPROFILE%\.ssh\id_ed25519`

Show the public key to copy:

```powershell
Get-Content "$env:USERPROFILE\.ssh\id_ed25519.pub"
```

It should look like one line:

```text
ssh-ed25519 AAAAC3NzaC1lZDI1NTE5AAAAI... logit-hetzner
```

#### B. Paste into Hetzner “Add an SSH key”

| Field | What to enter |
| --- | --- |
| **SSH key** * | Entire contents of `id_ed25519.pub` (one line starting with `ssh-ed25519`) |
| **Name** * | Friendly label, e.g. `laptop-logit` or `Jeff-PC` |
| **Set as default key** | Optional — auto-attach this key to new servers |

Click **Add SSH key**. The **Add SSH key** button stays disabled until both required fields are filled.

> Never paste the private key file (`id_ed25519` without `.pub`). Hetzner only needs the public half.

#### C. Connect after the server exists

```powershell
ssh root@YOUR_SERVER_IP
# If needed:
ssh -i $env:USERPROFILE\.ssh\id_ed25519 root@YOUR_SERVER_IP
```

First connect may ask to trust the host fingerprint — type `yes`.

#### D. Separate key for GitHub deploy-from-server (later)

The laptop → Hetzner key (§4.1) is **not** the same as the server → GitHub **deploy key** in §5.1. Create the deploy key on the VPS after the machine exists.

### 4.2 Create the VPS

- Ubuntu **22.04 / 24.04 / 26.04 LTS** (Hetzner Cloud images; verified on **Ubuntu 26.04 LTS** / codename `resolute` in FSN1)
- Size: start ≥ **4 GB RAM** / 2 vCPU for Compose (example host shape: `ubuntu-4gb-fsn1-*`) — Postgres + Redis + api + web + worker + Nginx
- Attach IPv4 (and IPv6 if you use AAAA — Hetzner often assigns both)
- In the create wizard, under **SSH keys**, select the key you added in §4.1 (and/or rely on “default key”)
- Prefer SSH key auth only; disable password root login after first setup

### 4.3 Hardening (first SSH session as `root`)

```bash
apt update && apt upgrade -y
apt install -y git curl ufw fail2ban ca-certificates gnupg

# Firewall: SSH + HTTP/HTTPS only
ufw default deny incoming
ufw default allow outgoing
ufw allow OpenSSH
ufw allow 80/tcp
ufw allow 443/tcp
ufw enable
ufw status
```

Also mirror the same in **Hetzner Cloud Firewall** (attach to the server): allow TCP 22 (preferably your admin IP only), 80, 443. **Do not** open 5432 or 6379.

### 4.4 Create an app operator user (do **not** use `root` day-to-day)

Pick a username (examples: `romeo`, `deploy`). Run as **`root`**:

```bash
# Replace romeo with your chosen username everywhere below
adduser romeo
# Set a password when prompted (used for sudo). SSH login still uses your key.
# Optional GECOS prompts (Full Name, etc.) — Enter to skip or fill as you like.

usermod -aG sudo romeo
```

> **Do not run `usermod -aG docker …` yet.** The `docker` group only exists **after** Docker is installed. If you see `usermod: group 'docker' does not exist`, install Docker next (§4.5), then add the group (§4.6).

Copy your laptop SSH key from `root` onto the new user so you can log in without root:

```bash
mkdir -p /home/romeo/.ssh
cp /root/.ssh/authorized_keys /home/romeo/.ssh/
chown -R romeo:romeo /home/romeo/.ssh
chmod 700 /home/romeo/.ssh
chmod 600 /home/romeo/.ssh/authorized_keys
```

App directory owned by that user:

```bash
mkdir -p /opt/logit
chown -R romeo:romeo /opt/logit
```

### 4.5 Install Docker Engine + Compose plugin (Ubuntu)

Still as **`root`** on Ubuntu (Hetzner). This creates the `docker` group:

```bash
apt update
apt install -y ca-certificates curl gnupg

install -m 0755 -d /etc/apt/keyrings
curl -fsSL https://download.docker.com/linux/ubuntu/gpg | gpg --dearmor -o /etc/apt/keyrings/docker.gpg
chmod a+r /etc/apt/keyrings/docker.gpg

echo \
  "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] https://download.docker.com/linux/ubuntu \
  $(. /etc/os-release && echo "$VERSION_CODENAME") stable" \
  > /etc/apt/sources.list.d/docker.list

apt update
apt install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin

systemctl enable --now docker
docker version
docker compose version
systemctl status docker --no-pager
```

### 4.6 Tie the user to Docker + LogIt files

After Docker install succeeds (`docker.service` **active (running)**):

```bash
usermod -aG docker romeo
usermod -aG sudo romeo   # idempotent if already done
id romeo
# Expect groups to include at least: romeo, sudo, docker
# Example: uid=1000(romeo) gid=1000(romeo) groups=1000(romeo),27(sudo),100(users),983(docker)

mkdir -p /home/romeo/.ssh
cp /root/.ssh/authorized_keys /home/romeo/.ssh/
chown -R romeo:romeo /home/romeo/.ssh
chmod 700 /home/romeo/.ssh
chmod 600 /home/romeo/.ssh/authorized_keys

mkdir -p /opt/logit
chown -R romeo:romeo /opt/logit
```

If you already created `/home/romeo/.ssh` earlier, the `cp` / `chmod` steps are still safe to re-run.

### 4.7 Log in as the operator (required after group changes)

Group membership applies only on a **new** login. Exit root, then from Windows:

```powershell
ssh romeo@YOUR_SERVER_IP
# or explicitly:
ssh -i $env:USERPROFILE\.ssh\id_ed25519 romeo@YOUR_SERVER_IP
```

On the server, verify:

```bash
whoami          # romeo
docker ps       # empty table is OK (no containers yet) — must NOT say permission denied
ls -la /opt/logit
# expect: owner romeo romeo, empty dir until you clone
```

Success looks like:

```text
CONTAINER ID   IMAGE     COMMAND   CREATED   STATUS    PORTS     NAMES
total 8
drwxr-xr-x 2 romeo romeo 4096 ... .
drwxr-xr-x ... root  root  ... ..
```

From here on: clone, `.env`, and `docker compose` as **`romeo`** under `/opt/logit`. Use `sudo` only for OS packages / UFW. Linux user `romeo` is **not** the same as LogIt login `admin@logit.local`.

Optional later: disable root SSH (`PermitRootLogin no`) after confirming `romeo` + sudo works.

### 4.8 Field-verified notes (Hetzner Cloud, 2026-07-24)

Validated end-to-end on a fresh Hetzner VPS (FSN1, ~4 GB, Ubuntu 26.04 LTS):

| Check | Result |
| --- | --- |
| `adduser romeo` + password + GECOS | OK |
| `usermod -aG docker romeo` **before** Docker | Fails: `group 'docker' does not exist` — expected |
| Official Docker apt repo for `$VERSION_CODENAME` (`resolute`) | OK |
| Packages | `docker-ce` **29.6.2**, Compose plugin **v5.3.1**, `containerd.io` 2.2.x |
| `systemctl status docker` | `active (running)`, enabled on boot |
| `usermod -aG docker romeo` **after** install | OK — `id` shows `sudo` + `docker` |
| Copy root `authorized_keys` → `/home/romeo/.ssh` | OK |
| `/opt/logit` owned by `romeo:romeo` | OK |
| `ssh romeo@<server-ip>` from Windows | OK (default `id_ed25519` used) |
| `docker ps` as `romeo` without sudo | OK (empty list) |

**Do not commit** the production server IP, sudo password, or personal GECOS fields into git. Keep them in your private ops notes / password manager.

**Recommended command order** (matches the successful session):

1. `adduser` + `usermod -aG sudo` (skip docker group)  
2. Install Docker (§4.5) + `systemctl enable --now docker`  
3. `usermod -aG docker` + SSH key copy + `/opt/logit` (§4.6)  
4. `exit` root → SSH as `romeo` → `docker ps` (§4.7)  
5. Continue with GitHub clone (§5)

---

## 5. Deploy from GitHub onto the server

### 5.1 Access to the private/public repo

**Public repo:** plain HTTPS clone works.

**Private repo:** use one of:

- **Deploy key** (read-only SSH key on the server, added in GitHub → repo → Settings → Deploy keys)
- Fine-scoped **PAT** over HTTPS (store outside the repo; prefer SSH deploy key)

```bash
# As romeo (or deploy) user on the server
ssh-keygen -t ed25519 -C "logit-hetzner-github" -f ~/.ssh/logit_deploy -N ""
cat ~/.ssh/logit_deploy.pub
# Paste into GitHub → Settings → Deploy keys (read-only)
```

`~/.ssh/config` example:

```text
Host github.com
  HostName github.com
  User git
  IdentityFile ~/.ssh/logit_deploy
  IdentitiesOnly yes
```

### 5.2 Clone

```bash
sudo mkdir -p /opt/logit
sudo chown deploy:deploy /opt/logit
cd /opt/logit
git clone git@github.com:SyllabusRomeo/koa.ticket.git .
git checkout main   # or master — keep both in sync as you do today
git rev-parse --short HEAD
```

### 5.3 Production `.env` (on the server only — never commit)

```bash
cd /opt/logit
cp .env.example .env
nano .env   # or vim
```

**Minimum production values** (adjust secrets):

```env
NODE_ENV=production
APP_NAME=LogIt
APP_URL=https://logit.koaimpact.app
APP_PUBLIC_URL=https://logit.koaimpact.app
API_PUBLIC_URL=https://logit.koaimpact.app/api/v1

# Compose / public URLs
WEB_ORIGIN=https://logit.koaimpact.app

SESSION_SECRET=<generate-long-random-min-32-chars>
COOKIE_SECURE=true
TRUST_PROXY=1
PASSWORD_MIN_LENGTH=12

POSTGRES_USER=logit
POSTGRES_PASSWORD=<strong-unique-password>
POSTGRES_DB=logit
# Inside Compose the services override DB host to "postgres" — keep example URLs
# consistent with docker-compose.yml; do not publish Postgres to the internet.

# Uploads persist in Docker volume; path inside containers is fine as in compose
UPLOAD_DIR=./data/uploads

# Seed passwords: leave EXPOSE_RESET_TOKENS unset/false in prod
EXPOSE_RESET_TOKENS=false
# After first login, change/disable demo seed users — do not leave LogIt-Admin-2026! live

# Optional: SMTP, IMAP, Slack, Teams, Entra — fill when ready
```

Generate secrets:

```bash
openssl rand -base64 48
```

> Compose prod overlay already forces `COOKIE_SECURE=true` and `TRUST_PROXY=1` on the API. Still set them in `.env` for clarity and non-Compose tools.

### 5.4 First container start (before or with TLS bootstrap)

```bash
cd /opt/logit
docker compose -f docker-compose.yml -f docker-compose.prod.yml up -d --build
docker compose -f docker-compose.yml -f docker-compose.prod.yml ps
docker compose -f docker-compose.yml -f docker-compose.prod.yml logs -f api --tail=100
```

API should migrate on start. Confirm locally on the box:

```bash
curl -sS http://127.0.0.1/health/ready || true
# Until Nginx/certs are ready, you can exec into api:
docker compose -f docker-compose.yml -f docker-compose.prod.yml exec api wget -qO- http://127.0.0.1:4000/health/ready
```

---

## 6. TLS on the origin (Let’s Encrypt) **with Cloudflare**

LogIt’s script: `./scripts/init-letsencrypt.sh <domain> <email>` (HTTP-01 via webroot). That needs **port 80** on the origin to answer ACME for `logit.koaimpact.app`.

### Recommended bootstrap order (avoids Cloudflare SSL loops)

1. Cloudflare DNS for `logit` → Hetzner IP, **Proxy = DNS only (grey cloud)**.
2. Hetzner UFW/Cloud Firewall: 80 + 443 open.
3. On server:

```bash
cd /opt/logit
chmod +x scripts/init-letsencrypt.sh
./scripts/init-letsencrypt.sh logit.koaimpact.app ops@koaimpact.app
```

4. Confirm:

```bash
curl -sSI https://logit.koaimpact.app/health/ready
# Expect JSON with database/redis up
```

5. Cloudflare SSL mode → **Full (strict)**.
6. Turn **Proxy = Proxied (orange cloud)** on the `A` record.
7. Re-test in a browser: `https://logit.koaimpact.app/login`.

### If HTTP-01 fails behind orange cloud

- Temporarily switch back to **grey cloud**, re-run the script, then orange again; **or**
- Use **Cloudflare Origin CA** cert installed as `infra/certs/fullchain.pem` + `privkey.pem` (then Full strict works without Let’s Encrypt); **or**
- Use DNS-01 with Cloudflare API (advanced; not in the stock script).

### Renewal

Re-run `./scripts/init-letsencrypt.sh logit.koaimpact.app ops@koaimpact.app` periodically, or automate `certbot renew` + copy live certs into `infra/certs/` and reload Nginx ([PRODUCTION.md](./PRODUCTION.md)).

---

## 7. Post-deploy verification checklist

- [ ] `https://logit.koaimpact.app/health/ready` → `status: ok`, DB + Redis up  
- [ ] Login over HTTPS; session cookie has **Secure**  
- [ ] Create ticket as employee; agent sees queue  
- [ ] Change seed admin password; enable MFA for privileged accounts  
- [ ] Postgres/Redis **not** reachable from the public internet  
- [ ] Cloudflare SSL = **Full (strict)**; orange cloud on  
- [ ] WAF not blocking your own login or planned webhooks  
- [ ] Backup: `./scripts/backup-postgres.sh` (schedule daily + off-server copy) — [SOP-17](./sops/17-backup-and-recovery.md)  
- [ ] CI green on GitHub for the commit you deployed  

Production gate also listed in [infra/hetzner/README.md](../infra/hetzner/README.md).

---

## 8. Ongoing deploys from GitHub (day-2)

### 8.1 Manual pull (simple, reliable)

On the server:

```bash
cd /opt/logit
git fetch origin
git checkout main
git pull --ff-only origin main

docker compose -f docker-compose.yml -f docker-compose.prod.yml up -d --build
docker compose -f docker-compose.yml -f docker-compose.prod.yml exec api npx prisma migrate deploy --schema=prisma/schema.prisma
# (If migrate runs automatically on API start in your image, the exec step may be redundant — check api logs.)

docker compose -f docker-compose.yml -f docker-compose.prod.yml ps
curl -sS https://logit.koaimpact.app/health/ready
```

Keep `main` and `master` aligned if you push both (as in recent releases).

### 8.2 Optional: GitHub Actions deploy over SSH

Not required for go-live. Pattern:

1. Repo secret `HETZNER_SSH_KEY`, `HETZNER_HOST`, `HETZNER_USER`.
2. Workflow on push to `main`: CI job (existing) → deploy job `appleboy/ssh-action` or `rsync` + remote `git pull` + `compose up -d --build`.
3. Restrict SSH to GitHub Actions IPs or a bastion if you harden further.

Keep using the existing CI workflow (`.github/workflows/ci.yml`) as the quality gate before you pull on the server.

### 8.3 Rollback

```bash
cd /opt/logit
git log --oneline -5
git checkout <previous-good-sha>
docker compose -f docker-compose.yml -f docker-compose.prod.yml up -d --build
```

For bad migrations, restore Postgres from backup first ([SOP-17](./sops/17-backup-and-recovery.md)).

---

## 9. NameSilo-only checklist (if you only touch NameSilo once)

1. Log into NameSilo → domain → **NameServers**.  
2. Set Cloudflare nameservers; save.  
3. Do **not** add the subdomain A record at NameSilo afterward (Cloudflare zone owns DNS).  
4. Renew/domain lock/WHOIS privacy stay in NameSilo as usual — unrelated to LogIt.

If you refuse to move NS to Cloudflare: create the subdomain **A** at NameSilo pointing to Hetzner, and put Cloudflare in front only via a CNAME setup that NameSilo/Cloudflare both support — this is more error-prone; Option A is strongly preferred.

---

## 10. Troubleshooting (triad)

| Symptom | Likely cause | Fix |
| --- | --- | --- |
| 525 / 526 in browser | Cloudflare Full strict but origin cert invalid | Grey-cloud → fix LE/Origin CA → Full strict → orange |
| 521 / 522 | Origin down or Hetzner firewall blocking 80/443 | `compose ps`, UFW, Hetzner firewall |
| ACME / Let’s Encrypt fails | Orange cloud or port 80 closed | Grey cloud + open 80; re-run init script |
| Login works then cookie lost | `COOKIE_SECURE` / not HTTPS / wrong `WEB_ORIGIN` | Set URLs to `https://logit.koaimpact.app`, Full strict, `TRUST_PROXY=1` |
| CORS errors | `WEB_ORIGIN` mismatch | Exact public origin, no trailing slash mismatch |
| Slack/Teams webhooks 403 | Cloudflare WAF/Bot challenge | WAF exception for integration paths |
| DB connection errors after reboot | Compose not up / volume issue | `compose up -d`; check `postgres` health |
| Old UI after deploy | Browser cache / web image not rebuilt | `--build`, hard refresh; confirm `git rev-parse HEAD` |

More: [SOP-18](./sops/18-troubleshooting.md).

---

## 11. Suggested go-live order (single afternoon)

1. Create laptop SSH key and add it in Hetzner (**§4.1**).  
2. Create the VPS with that SSH key selected; note the public IP.  
3. As `root`: harden firewall (**§4.3**).  
4. Create operator user e.g. `romeo` + copy SSH keys + `/opt/logit` (**§4.4**).  
5. Install Docker (**§4.5**), then `usermod -aG docker romeo` (**§4.6**).  
6. SSH in as `romeo`; confirm `docker ps` works (**§4.7**).  
7. Cloudflare zone active (NameSilo NS); grey-cloud `A` → Hetzner IP.  
8. As `romeo`: clone repo + `.env` + `compose up -d --build` + Let’s Encrypt.  
9. Verify `/health/ready` on HTTPS (direct to origin).  
10. Cloudflare **Full (strict)** + orange cloud + WAF basics.  
11. Browser login test; rotate seed passwords; MFA.  
12. Schedule backups; next releases via `git pull` as `romeo`.

---

## Related docs

| Doc | Use |
| --- | --- |
| [PRODUCTION.md](./PRODUCTION.md) | TLS script + CI |
| [SOP-04](./sops/04-docker-deployment.md) | Compose services |
| [SOP-05](./sops/05-hetzner-production.md) | Hetzner overview |
| [SOP-17](./sops/17-backup-and-recovery.md) | Backups |
| [USER_AND_DEVELOPER_GUIDE.md](./USER_AND_DEVELOPER_GUIDE.md) | Product ops after go-live |
| [ENTERPRISE_ROADMAP.md](./ENTERPRISE_ROADMAP.md) | What’s next (IMS, polish) |
