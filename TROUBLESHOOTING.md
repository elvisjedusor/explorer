# Explorer Troubleshooting Guide

## Check RPC Status

Run the diagnostic script to check RPC values:

```bash
cd /root/explorer
source venv/bin/activate
python3 check_rpc.py
```

This will show:
- RPC connection status
- Block height from different RPC methods
- Database sync status
- Total blocks in database

## Common Issues

### 1. Blocks Page 500 Error

Check the Flask logs:

```bash
journalctl -u bitok-explorer -n 100 -f
```

Look for error messages with stack traces.

Common causes:
- Database connection issues
- Corrupt block data (NULL values in required fields)
- Template rendering errors

### 2. Sync Status Shows "X/X+1"

This happens when RPC `getinfo().blocks` returns the block COUNT instead of the highest block HEIGHT.

Example:
- Blocks 0-12249 exist (12250 total blocks)
- RPC returns `blocks: 12250` (count)
- Synced height is `12249` (highest block)
- Display shows "12249/12250"

**Fix**: The explorer now uses `getblocknumber()` which returns the highest block height, not the count.

### 3. Restart Services

Restart the explorer after code changes:

```bash
systemctl restart bitok-explorer
systemctl restart bitok-sync
```

Check service status:

```bash
systemctl status bitok-explorer
systemctl status bitok-sync
```

### 4. Check Database

Connect to PostgreSQL:

```bash
sudo -u postgres psql bitok_explorer
```

Check sync status:

```sql
SELECT * FROM chain_state WHERE key = 'synced_height';
```

Check block count:

```sql
SELECT COUNT(*) FROM blocks;
SELECT MAX(height) FROM blocks;
SELECT MIN(height) FROM blocks;
```

Check for blocks with NULL total_value:

```sql
SELECT height, hash, total_value FROM blocks WHERE total_value IS NULL LIMIT 10;
```

### 5. View Logs

Explorer logs:

```bash
journalctl -u bitok-explorer -f
```

Sync logs:

```bash
journalctl -u bitok-sync -f
```

Nginx logs:

```bash
tail -f /var/log/nginx/error.log
tail -f /var/log/nginx/access.log
```

### 6. Test RPC Connection

From the explorer directory:

```bash
cd /root/explorer
source venv/bin/activate
python3 -c "from rpc_client import BitokRPC; from config import Config; c = Config(); r = BitokRPC(c.RPC_HOST, c.RPC_PORT, c.RPC_USER, c.RPC_PASSWORD); print(r.getinfo())"
```

### 7. Manual Sync Trigger

Stop the sync service and run manually to see errors:

```bash
systemctl stop bitok-sync
cd /root/explorer
source venv/bin/activate
python3 sync.py
```

Press Ctrl+C to stop, then restart the service:

```bash
systemctl start bitok-sync
```

## Performance Issues

### Slow Block/Transaction Pages

Add database indexes (should already exist):

```sql
CREATE INDEX IF NOT EXISTS idx_transaction_block_height ON transactions(block_height);
CREATE INDEX IF NOT EXISTS idx_tx_output_address ON tx_outputs(address);
CREATE INDEX IF NOT EXISTS idx_tx_input_prev ON tx_inputs(prev_txid, prev_vout);
```

### High Memory Usage

Check PostgreSQL connection pool settings in `config.py`:

```python
DB_POOL_SIZE = 5
DB_MAX_OVERFLOW = 10
DB_POOL_TIMEOUT = 30
DB_POOL_RECYCLE = 3600
```

Reduce if needed.

## Emergency Recovery

### Reset Sync from Block X

```bash
sudo -u postgres psql bitok_explorer -c "UPDATE chain_state SET value = 'X' WHERE key = 'synced_height';"
systemctl restart bitok-sync
```

Replace `X` with the block height to start from.

### Full Database Reset

**WARNING**: This deletes all explorer data!

```bash
systemctl stop bitok-explorer
systemctl stop bitok-sync

sudo -u postgres psql -c "DROP DATABASE bitok_explorer;"
sudo -u postgres psql -c "CREATE DATABASE bitok_explorer;"

cd /root/explorer
source venv/bin/activate
python3 -c "from models import init_db; from config import Config; init_db(Config().DATABASE_URL)"

systemctl start bitok-sync
systemctl start bitok-explorer
```
