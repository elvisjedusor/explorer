# Bitok Blockchain Explorer

A lightweight blockchain explorer for Bitok, inspired by the original Bitcoin-Abe explorer. Designed to run on a single VPS alongside bitokd.

## Features

- Browse blocks, transactions, and addresses
- Search by block hash, height, transaction ID, or address
- Real-time blockchain sync from bitokd RPC
- REST API for programmatic access
- SQLite (default) or PostgreSQL database
- Responsive dark-themed UI
- Low resource usage

## Requirements

- Ubuntu 20.04+ (or similar Linux)
- Python 3.8+
- Running bitokd with RPC enabled
- 1GB RAM minimum (2GB recommended)

## Quick Start

### 1. Setup

```bash
cd explorer
chmod +x setup.sh
./setup.sh
```

### 2. Configure

Edit `.env` with your bitokd RPC credentials:

```bash
nano .env
```

```
BITOK_RPC_HOST=127.0.0.1
BITOK_RPC_PORT=8332
BITOK_RPC_USER=yourusername
BITOK_RPC_PASSWORD=yourpassword
DATABASE_URL=sqlite:///bitok_explorer.db
```

### 3. Start bitokd

```bash
./bitokd -rpcuser=yourusername -rpcpassword=yourpassword -server -daemon
```

### 4. Run the Explorer

Development mode (two terminals):

```bash
# Terminal 1: Start blockchain sync
./run.sh sync

# Terminal 2: Start web server
./run.sh web
```

Open http://localhost:5000 in your browser.

## Production Deployment

### Install as Services

```bash
# Copy service files
sudo cp systemd/*.service /etc/systemd/system/

# Create user
sudo useradd -r -s /bin/false bitok

# Copy explorer to /opt
sudo mkdir -p /opt/bitok-explorer
sudo cp -r . /opt/bitok-explorer/
sudo chown -R bitok:bitok /opt/bitok-explorer

# Enable and start services
sudo systemctl daemon-reload
sudo systemctl enable bitok-sync bitok-explorer
sudo systemctl start bitok-sync bitok-explorer
```

### Nginx Reverse Proxy

```nginx
server {
    listen 80;
    server_name explorer.yourdomain.com;

    location / {
        proxy_pass http://127.0.0.1:5000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    }
}
```

## Configuration

| Variable | Default | Description |
|----------|---------|-------------|
| BITOK_RPC_HOST | 127.0.0.1 | Bitok daemon host |
| BITOK_RPC_PORT | 8332 | Bitok daemon RPC port |
| BITOK_RPC_USER | | RPC username |
| BITOK_RPC_PASSWORD | | RPC password |
| DATABASE_URL | sqlite:///bitok_explorer.db | Database connection string |
| SYNC_INTERVAL | 10 | Seconds between sync checks |
| ITEMS_PER_PAGE | 50 | Items per page in lists |
| DEBUG | false | Enable debug mode |

## Using PostgreSQL

For better performance with large blockchains:

```bash
# Install PostgreSQL
sudo apt install postgresql postgresql-contrib

# Create database
sudo -u postgres createdb bitok_explorer
sudo -u postgres createuser bitok_user -P

# Grant permissions
sudo -u postgres psql -c "GRANT ALL PRIVILEGES ON DATABASE bitok_explorer TO bitok_user;"

# Update .env
DATABASE_URL=postgresql://bitok_user:password@localhost/bitok_explorer
```

## API Endpoints

### GET /api/stats
Returns network statistics.

### GET /api/block/<hash_or_height>
Returns block details.

### GET /api/tx/<txid>
Returns transaction details.

### GET /api/address/<address>
Returns address balance and stats.

## Project Structure

```
explorer/
├── app.py           # Flask web application
├── sync.py          # Blockchain sync engine
├── models.py        # SQLAlchemy database models
├── rpc_client.py    # Bitok RPC client
├── config.py        # Configuration
├── requirements.txt # Python dependencies
├── setup.sh         # Setup script
├── run.sh           # Run script
├── templates/       # HTML templates
│   ├── base.html
│   ├── index.html
│   ├── blocks.html
│   ├── block.html
│   ├── transaction.html
│   └── address.html
└── systemd/         # Systemd service files
    ├── bitok-explorer.service
    └── bitok-sync.service
```

## Troubleshooting

### Cannot connect to bitokd

Make sure bitokd is running with RPC enabled:
```bash
./bitokd -rpcuser=user -rpcpassword=pass -server -daemon
./bitokd -rpcuser=user -rpcpassword=pass getinfo
```

### Sync is slow

- Increase SYNC_INTERVAL for less frequent checks
- Use PostgreSQL instead of SQLite for better write performance
- Run `sync.py --once` initially to catch up, then start continuous sync

### Web server not accessible

- Check if port 5000 is open: `sudo ufw allow 5000`
- For remote access, bind to 0.0.0.0 or use nginx reverse proxy

## License

MIT License - Same as Bitok
