# Bitok Explorer - Full Deployment Guide for Ubuntu 24.04 VPS

Complete guide to deploy the Bitok blockchain explorer on Ubuntu 24.04 with PostgreSQL, Nginx, SSL (Certbot), and systemd services.

**Domain:** bitokd.run
**User:** root

---

## Table of Contents

1. [Initial Server Setup](#1-initial-server-setup)
2. [Install System Dependencies](#2-install-system-dependencies)
3. [Install and Configure PostgreSQL](#3-install-and-configure-postgresql)
4. [Setup Bitok Node](#4-setup-bitok-node)
5. [Install Explorer Application](#5-install-explorer-application)
6. [Configure Gunicorn](#6-configure-gunicorn)
7. [Setup Systemd Services](#7-setup-systemd-services)
8. [Install and Configure Nginx](#8-install-and-configure-nginx)
9. [Setup SSL with Certbot](#9-setup-ssl-with-certbot)
10. [Configure Firewall](#10-configure-firewall)
11. [PostgreSQL Performance Tuning](#11-postgresql-performance-tuning)
12. [Maintenance Commands](#12-maintenance-commands)
13. [Troubleshooting](#13-troubleshooting)

---

## 1. Initial Server Setup

### 1.1 Connect to your VPS

```bash
ssh root@YOUR_VPS_IP
```

### 1.2 Update system

```bash
apt update && apt upgrade -y
```

### 1.3 Set timezone (optional)

```bash
timedatectl set-timezone UTC
```

---

## 2. Install System Dependencies

```bash
apt install -y \
    python3 \
    python3-pip \
    python3-venv \
    python3-dev \
    build-essential \
    libpq-dev \
    git \
    curl \
    wget \
    htop \
    ufw \
    nginx \
    certbot \
    python3-certbot-nginx
```

---

## 3. Install and Configure PostgreSQL

### 3.1 Install PostgreSQL 16

```bash
apt install -y postgresql postgresql-contrib
```

### 3.2 Start and enable PostgreSQL

```bash
systemctl start postgresql
systemctl enable postgresql
```

### 3.3 Create database and user

```bash
sudo -u postgres psql
```

In PostgreSQL shell:
```sql
CREATE USER bitok WITH PASSWORD 'YOUR_SECURE_PASSWORD_HERE';
CREATE DATABASE bitok_explorer OWNER bitok;
GRANT ALL PRIVILEGES ON DATABASE bitok_explorer TO bitok;

\c bitok_explorer

GRANT ALL ON SCHEMA public TO bitok;
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO bitok;
GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO bitok;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO bitok;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON SEQUENCES TO bitok;

\q
```

### 3.4 Test connection

```bash
psql -U bitok -d bitok_explorer -h localhost
```

If it works, type `\q` to exit.

---

## 4. Setup Bitok Node

### 4.1 Create directories

```bash
mkdir -p /root/bitok
mkdir -p /root/.bitok
```

### 4.2 Build or copy Bitok binary

Either build from source following BUILD_UNIX.md, or copy pre-built binary to `/root/bitok/bitokd`

**IMPORTANT:** Bitok v0.3.19 has NO config file. All settings must be passed via command line arguments.

### 4.3 Create Bitok systemd service

```bash
nano /etc/systemd/system/bitokd.service
```

Add (replace RPC credentials):
```ini
[Unit]
Description=Bitok Daemon
After=network.target

[Service]
Type=forking
User=root
Group=root
ExecStart=/root/bitok/bitokd -daemon -server -rpcuser=bitok_rpc -rpcpassword=YOUR_SECURE_RPC_PASSWORD_HERE
ExecStop=/root/bitok/bitokd -rpcuser=bitok_rpc -rpcpassword=YOUR_SECURE_RPC_PASSWORD_HERE stop
Restart=on-failure
RestartSec=30
TimeoutStartSec=60
TimeoutStopSec=60

[Install]
WantedBy=multi-user.target
```

**IMPORTANT:** Replace `YOUR_SECURE_RPC_PASSWORD_HERE` with a strong password. Use the same credentials in the explorer .env file.

### 4.4 Start Bitok daemon

```bash
systemctl daemon-reload
systemctl enable bitokd
systemctl start bitokd
```

### 4.5 Verify Bitok is running

```bash
/root/bitok/bitokd -rpcuser=bitok_rpc -rpcpassword=YOUR_SECURE_RPC_PASSWORD_HERE getinfo
```

Wait for blockchain sync before proceeding.

---

## 5. Install Explorer Application

### 5.1 Create explorer directory

```bash
mkdir -p /root/explorer
cd /root/explorer
```

### 5.2 Copy explorer files

Copy all explorer files to `/root/explorer/`:
- app.py
- models.py
- sync.py
- config.py
- rpc_client.py
- requirements.txt
- templates/ (folder)

### 5.3 Create Python virtual environment

```bash
cd /root/explorer
python3 -m venv venv
source venv/bin/activate
```

### 5.4 Install Python dependencies

```bash
pip install --upgrade pip
pip install -r requirements.txt
```

### 5.5 Create environment file

```bash
nano /root/explorer/.env
```

Add:
```bash
DATABASE_URL=postgresql://bitok:YOUR_SECURE_PASSWORD_HERE@localhost:5432/bitok_explorer

DB_POOL_SIZE=10
DB_MAX_OVERFLOW=20
DB_POOL_TIMEOUT=30
DB_POOL_RECYCLE=1800

BITOK_RPC_HOST=127.0.0.1
BITOK_RPC_PORT=8332
BITOK_RPC_USER=bitok_rpc
BITOK_RPC_PASSWORD=YOUR_SECURE_RPC_PASSWORD_HERE

SECRET_KEY=PASTE_YOUR_GENERATED_KEY_HERE
DEBUG=false

SYNC_INTERVAL=10
SYNC_BATCH_SIZE=100

ITEMS_PER_PAGE=50
```

### 5.6 Generate secret key

```bash
python3 -c "import secrets; print(secrets.token_hex(32))"
```

Copy the output and paste it as SECRET_KEY in .env file.

**IMPORTANT:** Make sure the RPC credentials in .env match exactly what you used in the bitokd.service file.

### 5.7 Initialize database tables

```bash
cd /root/explorer
source venv/bin/activate
export $(cat .env | xargs)
python3 -c "from models import init_db; from config import Config; init_db(Config.DATABASE_URL)"
```

---

## 6. Configure Gunicorn

### 6.1 Create Gunicorn configuration

```bash
nano /root/explorer/gunicorn.conf.py
```

Add:
```python
import multiprocessing

bind = "127.0.0.1:5000"
workers = multiprocessing.cpu_count() * 2 + 1
worker_class = "sync"
worker_connections = 1000
timeout = 30
keepalive = 2

errorlog = "/root/explorer/logs/gunicorn-error.log"
accesslog = "/root/explorer/logs/gunicorn-access.log"
loglevel = "info"

capture_output = True
enable_stdio_inheritance = True

preload_app = True
```

### 6.2 Create logs directory

```bash
mkdir -p /root/explorer/logs
```

---

## 7. Setup Systemd Services

### 7.1 Create Explorer Web Service

```bash
nano /etc/systemd/system/bitok-explorer.service
```

Add:
```ini
[Unit]
Description=Bitok Explorer Web Application
After=network.target postgresql.service bitokd.service
Wants=postgresql.service

[Service]
Type=notify
User=root
Group=root
WorkingDirectory=/root/explorer
EnvironmentFile=/root/explorer/.env
ExecStart=/root/explorer/venv/bin/gunicorn \
    --config /root/explorer/gunicorn.conf.py \
    app:app
ExecReload=/bin/kill -s HUP $MAINPID
Restart=on-failure
RestartSec=10
KillMode=mixed
TimeoutStopSec=5

[Install]
WantedBy=multi-user.target
```

### 7.2 Create Blockchain Sync Service

```bash
nano /etc/systemd/system/bitok-sync.service
```

Add:
```ini
[Unit]
Description=Bitok Explorer Blockchain Sync
After=network.target postgresql.service bitokd.service
Wants=postgresql.service bitokd.service

[Service]
Type=simple
User=root
Group=root
WorkingDirectory=/root/explorer
EnvironmentFile=/root/explorer/.env
ExecStart=/root/explorer/venv/bin/python3 sync.py
Restart=always
RestartSec=30

[Install]
WantedBy=multi-user.target
```

### 7.3 Enable and start services

```bash
systemctl daemon-reload
systemctl enable bitok-explorer
systemctl enable bitok-sync
systemctl start bitok-explorer
systemctl start bitok-sync
```

### 7.4 Check service status

```bash
systemctl status bitok-explorer
systemctl status bitok-sync
```

---

## 8. Configure Nginx

Nginx was already installed in section 2.

### 8.1 Start and enable Nginx

```bash
systemctl start nginx
systemctl enable nginx
```

### 8.2 Verify Nginx is running

```bash
systemctl status nginx
```

### 8.3 Create Nginx configuration

```bash
nano /etc/nginx/sites-available/bitokd.run
```

Add:
```nginx
server {
    listen 80;
    listen [::]:80;
    server_name bitokd.run www.bitokd.run;

    location / {
        proxy_pass http://127.0.0.1:5000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;

        proxy_connect_timeout 60s;
        proxy_send_timeout 60s;
        proxy_read_timeout 60s;
    }

    location /static {
        alias /root/explorer/static;
        expires 30d;
        add_header Cache-Control "public, immutable";
    }

    client_max_body_size 10M;
}
```

### 8.4 Enable the site

```bash
ln -s /etc/nginx/sites-available/bitokd.run /etc/nginx/sites-enabled/
rm -f /etc/nginx/sites-enabled/default
```

### 8.5 Test Nginx configuration

```bash
nginx -t
```

### 8.6 Reload Nginx

```bash
systemctl reload nginx
```

---

## 9. Setup SSL with Certbot

Certbot was already installed in section 2.

### 9.1 Point your domain to the VPS

Before running Certbot, configure DNS:
- A record: `bitokd.run` -> YOUR_VPS_IP
- A record: `www.bitokd.run` -> YOUR_VPS_IP

Verify DNS propagation:
```bash
dig bitokd.run +short
dig www.bitokd.run +short
```

### 9.2 Obtain SSL certificate

```bash
certbot --nginx -d bitokd.run -d www.bitokd.run
```

Follow prompts:
1. Enter email address
2. Agree to terms
3. Choose to redirect HTTP to HTTPS (recommended: Yes)

### 9.3 Verify auto-renewal

```bash
certbot renew --dry-run
```

### 9.4 Updated Nginx config (after Certbot)

Certbot auto-updates the config. Final version should look like:

```bash
nano /etc/nginx/sites-available/bitokd.run
```

```nginx
server {
    listen 80;
    listen [::]:80;
    server_name bitokd.run www.bitokd.run;
    return 301 https://$server_name$request_uri;
}

server {
    listen 443 ssl http2;
    listen [::]:443 ssl http2;
    server_name bitokd.run www.bitokd.run;

    ssl_certificate /etc/letsencrypt/live/bitokd.run/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/bitokd.run/privkey.pem;
    include /etc/letsencrypt/options-ssl-nginx.conf;
    ssl_dhparam /etc/letsencrypt/ssl-dhparams.pem;

    location / {
        proxy_pass http://127.0.0.1:5000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;

        proxy_connect_timeout 60s;
        proxy_send_timeout 60s;
        proxy_read_timeout 60s;

        proxy_buffering on;
        proxy_buffer_size 4k;
        proxy_buffers 8 4k;
    }

    location /static {
        alias /root/explorer/static;
        expires 30d;
        add_header Cache-Control "public, immutable";
    }

    gzip on;
    gzip_vary on;
    gzip_min_length 1024;
    gzip_proxied any;
    gzip_types text/plain text/css application/json application/javascript text/xml application/xml;

    client_max_body_size 10M;
}
```

Restart Nginx:
```bash
nginx -t && systemctl restart nginx
```

---

## 10. Configure Firewall

### 10.1 Setup UFW

```bash
ufw default deny incoming
ufw default allow outgoing

ufw allow 22/tcp
ufw allow 80/tcp
ufw allow 443/tcp
ufw allow 8333/tcp

ufw enable
```

### 10.2 Verify firewall

```bash
ufw status verbose
```

---

## 11. PostgreSQL Performance Tuning

### 11.1 Edit PostgreSQL configuration

```bash
nano /etc/postgresql/16/main/postgresql.conf
```

**For 4GB RAM VPS:**
```ini
shared_buffers = 1GB
effective_cache_size = 3GB
work_mem = 64MB
maintenance_work_mem = 256MB
checkpoint_completion_target = 0.9
wal_buffers = 64MB
min_wal_size = 1GB
max_wal_size = 4GB
random_page_cost = 1.1
effective_io_concurrency = 200
max_connections = 100
```

**For 8GB RAM VPS:**
```ini
shared_buffers = 2GB
effective_cache_size = 6GB
work_mem = 128MB
maintenance_work_mem = 512MB
checkpoint_completion_target = 0.9
wal_buffers = 64MB
min_wal_size = 2GB
max_wal_size = 8GB
random_page_cost = 1.1
effective_io_concurrency = 200
max_connections = 200
```

### 11.2 Restart PostgreSQL

```bash
systemctl restart postgresql
```

### 11.3 Create additional indexes (after initial sync)

```bash
sudo -u postgres psql bitok_explorer
```

```sql
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_tx_outputs_address_value ON tx_outputs(address, value);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_transactions_block_height_desc ON transactions(block_height DESC);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_blocks_height_desc ON blocks(height DESC);

ANALYZE blocks;
ANALYZE transactions;
ANALYZE tx_inputs;
ANALYZE tx_outputs;
ANALYZE addresses;

\q
```

---

## 12. Maintenance Commands

### 12.1 View logs

```bash
journalctl -u bitok-explorer -f
journalctl -u bitok-sync -f
journalctl -u bitokd -f

tail -f /var/log/nginx/access.log
tail -f /var/log/nginx/error.log

tail -f /root/explorer/logs/gunicorn-access.log
tail -f /root/explorer/logs/gunicorn-error.log
```

### 12.2 Restart services

```bash
systemctl restart bitok-explorer
systemctl restart bitok-sync
systemctl restart nginx
systemctl restart postgresql
systemctl restart bitokd
```

### 12.3 Check sync status

```bash
sudo -u postgres psql bitok_explorer -c "SELECT value FROM chain_state WHERE key='synced_height';"

/root/bitok/bitokd -rpcuser=bitok_rpc -rpcpassword=YOUR_SECURE_RPC_PASSWORD_HERE getinfo
```

### 12.4 Database maintenance

```bash
sudo -u postgres psql bitok_explorer

SELECT
    relname as table,
    pg_size_pretty(pg_total_relation_size(relid)) as total_size
FROM pg_catalog.pg_statio_user_tables
ORDER BY pg_total_relation_size(relid) DESC;

VACUUM ANALYZE;

\q
```

### 12.5 Backup database

```bash
mkdir -p /root/backups
pg_dump -U bitok -h localhost bitok_explorer > /root/backups/explorer_$(date +%Y%m%d_%H%M%S).sql
```

### 12.6 Update explorer

```bash
systemctl stop bitok-explorer
systemctl stop bitok-sync

cd /root/explorer
source venv/bin/activate
pip install -r requirements.txt

systemctl start bitok-sync
systemctl start bitok-explorer
```

---

## 13. Troubleshooting

### 13.1 Explorer not loading

```bash
systemctl status bitok-explorer
ss -tlnp | grep 5000
curl http://127.0.0.1:5000/
```

### 13.2 Sync not working

```bash
systemctl status bitok-sync
/root/bitok/bitokd -rpcuser=bitok_rpc -rpcpassword=YOUR_SECURE_RPC_PASSWORD_HERE getinfo
```

### 13.3 Database connection issues

```bash
systemctl status postgresql
psql -U bitok -h localhost -d bitok_explorer -c "SELECT 1;"
tail -f /var/log/postgresql/postgresql-16-main.log
```

### 13.4 SSL issues

```bash
certbot certificates
certbot renew --force-renewal
nginx -t
```

### 13.5 Check all services at once

```bash
systemctl status bitokd bitok-explorer bitok-sync postgresql nginx
```

---

## Quick Reference

| Service | Start | Stop | Restart | Logs |
|---------|-------|------|---------|------|
| Bitok Node | `systemctl start bitokd` | `systemctl stop bitokd` | `systemctl restart bitokd` | `journalctl -u bitokd -f` |
| Explorer | `systemctl start bitok-explorer` | `systemctl stop bitok-explorer` | `systemctl restart bitok-explorer` | `journalctl -u bitok-explorer -f` |
| Sync | `systemctl start bitok-sync` | `systemctl stop bitok-sync` | `systemctl restart bitok-sync` | `journalctl -u bitok-sync -f` |
| PostgreSQL | `systemctl start postgresql` | `systemctl stop postgresql` | `systemctl restart postgresql` | `/var/log/postgresql/` |
| Nginx | `systemctl start nginx` | `systemctl stop nginx` | `systemctl restart nginx` | `/var/log/nginx/` |

---

## Directory Structure

```
/root/
├── bitok/
│   └── bitokd             # Bitok daemon binary
├── .bitok/                # Bitok data directory (wallet.dat, blocks, etc)
├── explorer/
│   ├── venv/              # Python virtual environment
│   ├── templates/         # HTML templates
│   ├── logs/              # Gunicorn logs
│   ├── app.py
│   ├── models.py
│   ├── sync.py
│   ├── config.py
│   ├── rpc_client.py
│   ├── requirements.txt
│   ├── gunicorn.conf.py
│   └── .env               # Environment variables
└── backups/               # Database backups
```

---

## Checklist

- [ ] System updated
- [ ] PostgreSQL installed and configured
- [ ] Database and user created
- [ ] Bitok node running and synced
- [ ] Explorer files copied to /root/explorer
- [ ] Python venv created and dependencies installed
- [ ] .env file configured with secure password and secret key
- [ ] Database tables initialized
- [ ] Gunicorn configured
- [ ] Systemd services created and enabled
- [ ] Nginx configured
- [ ] DNS A records pointing to VPS IP
- [ ] SSL certificate obtained with Certbot
- [ ] Firewall configured
- [ ] All services running

---

## Minimum Requirements

- 2 CPU cores
- 4 GB RAM
- 50 GB SSD
- Ubuntu 24.04

**Recommended:** 4 cores, 8 GB RAM, 100 GB SSD
