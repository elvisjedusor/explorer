# Bitok Block Explorer

**Full-Featured Block Explorer for Bitok Blockchain**

A complete, professional block explorer for Bitok (Bitcoin v0.3.0 resurrected with Yespower PoW). Connects directly to your Bitok node via JSON-RPC - no database required!

## Features

### Dashboard
- **Network Statistics**: Real-time block height, difficulty, peer count, mempool size
- **Mining Status**: Live mining status with CPU count
- **Latest Blocks**: 10 most recent blocks with transaction counts
- **Universal Search**: Search blocks (by hash or height), transactions, or addresses

### Block Explorer
- **Block List**: Browse latest 20 blocks
- **Block Details**: Complete block information including:
  - Block hash, previous hash, merkle root
  - Timestamp, difficulty, nonce
  - Full transaction list (clickable)
  - Navigate between blocks

### Transaction Viewer
- **Transaction Search**: Find any transaction by TXID
- **Complete Details**:
  - Transaction ID, confirmations, block hash
  - Size, timestamp
  - Inputs with previous outputs
  - Outputs with addresses and amounts
  - Transaction fees
- **Visual Flow**: Input → Output visualization
- **Coinbase Detection**: Special display for mining rewards

### Mempool Monitor
- **Live Pending Transactions**: Real-time unconfirmed transactions
- **Transaction Count**: Total pending transactions
- **Quick Access**: Click any transaction to view details

### Address Explorer
- **Address Search**: Lookup any Bitok address
- **Balance Information**:
  - Current balance (from UTXOs)
  - Total received (0 and 6 confirmations)
  - Wallet ownership status
- **UTXO List**: All unspent transaction outputs with:
  - Transaction ID (clickable)
  - Output number
  - Amount
  - Confirmations

### Network Information
- **Connected Peers**: Complete peer list
- **Peer Details**:
  - IP address and port
  - Version, starting height
  - Connection type (inbound/outbound)
  - Connection duration

## Technical Architecture

### Direct RPC Connection
```
Browser → JSON-RPC → Bitok Node (localhost:8332)
```

- No backend server needed
- No database required
- Real-time data from your node
- Lightweight and fast

### Supported RPC Methods

The explorer uses these Bitok RPC endpoints:

**Blockchain:**
- `getinfo` - Network information
- `getblockcount` - Chain height
- `getbestblockhash` - Latest block hash
- `getblockhash` - Block hash by height
- `getblock` - Complete block data

**Transactions:**
- `getrawtransaction` - Transaction details with inputs/outputs
- `gettransaction` - Wallet transaction info
- `getrawmempool` - Pending transactions

**Wallet:**
- `validateaddress` - Address validation
- `getreceivedbyaddress` - Address received amounts
- `listunspent` - UTXO list

**Network:**
- `getconnectioncount` - Peer count
- `getpeerinfo` - Detailed peer information

## Installation

### Prerequisites

1. **Bitok Node**: Running daemon with RPC enabled
2. **Node.js**: Version 14 or higher

### Setup

**Start Bitok Node**

```bash
./bitokd -daemon -server
```

**Configure Explorer**

Edit `src/config.js`:

```javascript
export const RPC_CONFIG = {
  url: 'http://127.0.0.1:8332/',
  username: 'yourusername',
  password: 'yourpassword',
  pollInterval: 10000
};
```

4. **Install Dependencies**

```bash
npm install
```

## Running

### Development Mode

```bash
npm run dev
```

Access at `http://localhost:5173`

### Production Build

```bash
npm run build
npm run preview
```

### Deploy on VPS (Same Server as Node)

1. Build the project:
```bash
npm run build
```

2. Serve the `dist/` folder with any web server:
```bash
# Using Python
cd dist
python3 -m http.server 3000

# Using Node.js serve
npx serve dist -p 3000

# Using nginx
# Point nginx to the dist/ folder
```

## Usage

### Search Capabilities

The universal search bar accepts:
- **Block Hash** (64 characters) - View block details
- **Block Height** (number) - Jump to specific block
- **Transaction ID** (64 characters) - View transaction
- **Address** (26-35 characters) - View address balance & UTXOs

### Navigation

- **Dashboard**: Overview and latest blocks
- **Blocks**: Browse blockchain, click any block for details
- **Transactions**: Search and view transaction details
- **Mempool**: Monitor pending transactions
- **Addresses**: Search addresses, view balances and UTXOs
- **Network**: View connected peers

### Clickable Elements

- Block hashes → View block details
- Transaction IDs → View transaction details
- Previous block → Navigate to previous block
- Addresses in outputs → View address details

## Design

- **Modern Dark Theme**: Professional Bitcoin-orange accents
- **Fully Responsive**: Works on mobile, tablet, desktop
- **Smooth Animations**: Hover effects, transitions
- **Monospace Fonts**: For hashes, addresses, amounts
- **Real-time Updates**: Auto-refresh every 10 seconds

## Security

### Best Practices

1. **Localhost Only**: RPC should only bind to 127.0.0.1
2. **Strong Passwords**: Use 32+ character random passwords
3. **Firewall**: Block port 8332 from external access
4. **Same VPS**: Run explorer on same server as node

### Configuration Example

```ini
# bitok.conf
rpcuser=bitok_rpc_$(openssl rand -hex 16)
rpcpassword=$(openssl rand -hex 32)
rpcallowip=127.0.0.1
rpcbind=127.0.0.1
```

## Troubleshooting

### Connection Failed

**Problem**: Explorer can't connect to node

**Solutions**:
1. Verify node is running: `ps aux | grep bitok`
2. Check RPC credentials match in both files
3. Verify port 8332 is open: `netstat -an | grep 8332`
4. Check node logs for errors

### No Data Showing

**Problem**: Explorer loads but shows no blocks/transactions

**Solutions**:
1. Verify node is fully synced: `./bitokd getinfo`
2. Check node has transactions/blocks
3. Open browser console (F12) for JavaScript errors
4. Verify CORS if accessing remotely

### CORS Errors

**Problem**: Cross-origin request blocked

**Solution**: Access explorer from same domain as node, or:
- Use SSH tunnel: `ssh -L 8332:localhost:8332 user@server`
- Use reverse proxy (nginx) with proper CORS headers

## Project Structure

```
bitok-explorer/
├── index.html              # Main HTML with all pages
├── src/
│   ├── main.js            # Complete application logic
│   ├── bitokRpc.js        # Full RPC client with all methods
│   ├── config.js          # Configuration
│   └── style.css          # Complete styling
├── package.json
└── README.md
```

## Browser Support

- Chrome/Edge 90+
- Firefox 88+
- Safari 14+

## Performance

- Lightweight: ~21KB JS + ~11KB CSS (gzipped)
- Fast: Direct RPC calls, no middleware
- Efficient: Smart caching and polling

## Development

### Adding Features

1. Add RPC method to `src/bitokRpc.js`
2. Add page/section to `index.html`
3. Add render function to `src/main.js`
4. Add styles to `src/style.css`

### RPC Client Extension

```javascript
// In src/bitokRpc.js
async yourNewMethod(param) {
  return await this.call('methodname', [param]);
}
```

## License

MIT

## Credits

- **GitHub**: https://github.com/elvisjedusor/bitok
- **Explorer**: Built for direct node integration

## Support

For issues or questions:
- Check Bitok GitHub: https://github.com/elvisjedusor/bitok/issues
- Review RPC API docs: https://github.com/elvisjedusor/bitok/blob/master/RPC_API.md

---

**Ready to explore the Bitok blockchain!** 🚀
