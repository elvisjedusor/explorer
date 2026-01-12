import './style.css';
import BitokRPC from './bitokRpc.js';
import { RPC_CONFIG } from './config.js';

class BitokExplorer {
  constructor() {
    this.rpc = new BitokRPC(RPC_CONFIG.url, RPC_CONFIG.username, RPC_CONFIG.password);
    this.currentPage = 1;
    this.blocksPerPage = 10;
    this.maxBlocks = 0;
    this.init();
  }

  async init() {
    await this.loadNetworkStats();
    await this.loadBlocks();
    this.setupHashRouter();
    setInterval(() => this.loadNetworkStats(), 30000);
    setInterval(() => this.loadBlocks(), 60000);
  }

  async loadNetworkStats() {
    try {
      const info = await this.rpc.getInfo();
      const difficulty = info.difficulty || 0;
      const blockTime = 600;
      const hashrate = (difficulty * Math.pow(2, 32)) / blockTime;

      this.maxBlocks = info.blocks;

      const statsCards = document.querySelectorAll('#network-stats .stat-card');
      if (statsCards[0]) statsCards[0].querySelector('.stat-value').textContent = info.blocks.toLocaleString();
      if (statsCards[1]) statsCards[1].querySelector('.stat-value').textContent = difficulty.toFixed(8);
      if (statsCards[2]) statsCards[2].querySelector('.stat-value').textContent = this.formatHashrate(hashrate);
      if (statsCards[3]) statsCards[3].querySelector('.stat-value').textContent = `${info.connections} peers`;
    } catch (error) {
      console.error('Error loading network stats:', error);
    }
  }

  async loadBlocks() {
    const container = document.getElementById('blocks-list');
    if (!container) return;

    try {
      const endBlock = this.maxBlocks - ((this.currentPage - 1) * this.blocksPerPage);
      const startBlock = Math.max(0, endBlock - this.blocksPerPage + 1);

      container.innerHTML = '<div class="loading">Loading blocks...</div>';

      const blocks = [];
      for (let height = endBlock; height >= startBlock && height >= 0; height--) {
        try {
          const hash = await this.rpc.getBlockHash(height);
          const block = await this.rpc.getBlock(hash);
          blocks.push({ height, ...block });
        } catch (e) {
          console.error(`Error loading block ${height}:`, e);
        }
      }

      if (blocks.length === 0) {
        container.innerHTML = '<div class="empty-state-text">No blocks found</div>';
        return;
      }

      container.innerHTML = blocks.map(block => `
        <div class="block-card" onclick="app.showBlockDetails('${block.hash}')">
          <div class="block-header">
            <div class="block-height">Block #${block.height.toLocaleString()}</div>
            <div class="block-time">${this.formatTime(block.time)}</div>
          </div>
          <div class="block-hash">${this.truncateHash(block.hash)}</div>
          <div class="block-info">
            <span>${block.tx.length} transaction${block.tx.length !== 1 ? 's' : ''}</span>
            <span>Difficulty: ${block.difficulty.toFixed(2)}</span>
          </div>
        </div>
      `).join('');

      this.updatePagination();
    } catch (error) {
      console.error('Error loading blocks:', error);
      container.innerHTML = '<div class="message message-error">Error loading blocks</div>';
    }
  }

  updatePagination() {
    const totalPages = Math.ceil(this.maxBlocks / this.blocksPerPage);
    const currentPageSpan = document.getElementById('current-page');
    if (currentPageSpan) currentPageSpan.textContent = this.currentPage;

    const controls = document.getElementById('pagination-controls');
    if (!controls) return;

    const hasPrev = this.currentPage > 1;
    const hasNext = this.currentPage < totalPages;

    controls.innerHTML = `
      <button class="btn btn-secondary" ${!hasPrev ? 'disabled' : ''} onclick="app.previousPage()">← Previous</button>
      <span class="pagination-info">Page ${this.currentPage} of ${totalPages.toLocaleString()}</span>
      <button class="btn btn-secondary" ${!hasNext ? 'disabled' : ''} onclick="app.nextPage()">Next →</button>
    `;
  }

  previousPage() {
    if (this.currentPage > 1) {
      this.currentPage--;
      this.loadBlocks();
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  }

  nextPage() {
    const totalPages = Math.ceil(this.maxBlocks / this.blocksPerPage);
    if (this.currentPage < totalPages) {
      this.currentPage++;
      this.loadBlocks();
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  }

  async universalSearch() {
    const input = document.getElementById('universal-search');
    const query = input.value.trim();
    const resultsContainer = document.getElementById('search-results');

    if (!query) {
      resultsContainer.innerHTML = '';
      return;
    }

    resultsContainer.innerHTML = '<div class="loading">Searching...</div>';

    if (/^\d+$/.test(query)) {
      const height = parseInt(query);
      if (height >= 0 && height <= this.maxBlocks) {
        window.location.hash = `#/block/${height}`;
        return;
      } else {
        resultsContainer.innerHTML = '<div class="message message-error">Block height out of range (max: ' + this.maxBlocks + ')</div>';
        return;
      }
    }

    if (/^[0-9a-fA-F]{64}$/.test(query)) {
      try {
        await this.rpc.getBlock(query);
        window.location.hash = `#/block/${query}`;
        return;
      } catch (e) {
        try {
          await this.rpc.getTransaction(query);
          window.location.hash = `#/tx/${query}`;
          return;
        } catch (e2) {
          resultsContainer.innerHTML = '<div class="message message-error">Not found: Could not find block or transaction with this hash</div>';
          return;
        }
      }
    }

    if (query.length >= 26 && query.length <= 35) {
      window.location.hash = `#/address/${query}`;
      return;
    }

    resultsContainer.innerHTML = '<div class="message message-error">Invalid input: Please enter a block height, block hash, transaction hash, or address</div>';
  }

  async showBlockDetails(hashOrHeight) {
    const resultsContainer = document.getElementById('search-results');
    resultsContainer.innerHTML = '<div class="loading">Loading block details...</div>';

    try {
      let hash = hashOrHeight;
      if (/^\d+$/.test(hashOrHeight)) {
        hash = await this.rpc.getBlockHash(parseInt(hashOrHeight));
      }

      const block = await this.rpc.getBlock(hash);
      const height = await this.getBlockHeight(hash);

      resultsContainer.innerHTML = `
        <div class="detail-card">
          <div class="detail-header">
            <h3>Block #${height.toLocaleString()}</h3>
            <button class="btn btn-secondary" onclick="app.closeSearch()">Close</button>
          </div>
          <div class="detail-grid">
            <div class="detail-item full-width">
              <div class="detail-label">Hash</div>
              <div class="detail-value mono">${block.hash}</div>
            </div>
            <div class="detail-item">
              <div class="detail-label">Height</div>
              <div class="detail-value">${height.toLocaleString()}</div>
            </div>
            <div class="detail-item">
              <div class="detail-label">Time</div>
              <div class="detail-value">${new Date(block.time * 1000).toLocaleString()}</div>
            </div>
            <div class="detail-item">
              <div class="detail-label">Difficulty</div>
              <div class="detail-value">${block.difficulty.toFixed(8)}</div>
            </div>
            <div class="detail-item">
              <div class="detail-label">Nonce</div>
              <div class="detail-value">${block.nonce}</div>
            </div>
            ${block.previousblockhash ? `
            <div class="detail-item full-width">
              <div class="detail-label">Previous Block</div>
              <div class="detail-value mono clickable" onclick="app.showBlockDetails('${block.previousblockhash}')">${this.truncateHash(block.previousblockhash)}</div>
            </div>
            ` : '<div class="detail-item full-width"><div class="detail-label">Previous Block</div><div class="detail-value">None (Genesis Block)</div></div>'}
            <div class="detail-item full-width">
              <div class="detail-label">Merkle Root</div>
              <div class="detail-value mono">${block.merkleroot}</div>
            </div>
          </div>

          <h4 class="detail-subtitle">Transactions (${block.tx.length})</h4>
          <div class="tx-list">
            ${block.tx.map((txid, idx) => `
              <div class="tx-item">
                <div class="tx-label">${idx === 0 ? '🪙 Coinbase' : `TX ${idx}`}</div>
                <div class="tx-hash mono clickable" onclick="app.showTxDetails('${txid}')">${this.truncateHash(txid)}</div>
              </div>
            `).join('')}
          </div>
        </div>
      `;
    } catch (error) {
      resultsContainer.innerHTML = `<div class="message message-error">Error: ${error.message}</div>`;
    }
  }

  async showTxDetails(txid) {
    const resultsContainer = document.getElementById('search-results');
    resultsContainer.innerHTML = '<div class="loading">Loading transaction details...</div>';

    try {
      const tx = await this.rpc.getTransaction(txid);

      resultsContainer.innerHTML = `
        <div class="detail-card">
          <div class="detail-header">
            <h3>Transaction Details</h3>
            <button class="btn btn-secondary" onclick="app.closeSearch()">Close</button>
          </div>
          <div class="detail-grid">
            <div class="detail-item full-width">
              <div class="detail-label">Transaction ID</div>
              <div class="detail-value mono">${tx.txid}</div>
            </div>
            <div class="detail-item">
              <div class="detail-label">Amount</div>
              <div class="detail-value ${tx.amount >= 0 ? 'success' : 'error'}">${tx.amount.toFixed(8)} BITOK</div>
            </div>
            <div class="detail-item">
              <div class="detail-label">Confirmations</div>
              <div class="detail-value">${tx.confirmations || 0}</div>
            </div>
            <div class="detail-item">
              <div class="detail-label">Time</div>
              <div class="detail-value">${tx.time ? new Date(tx.time * 1000).toLocaleString() : 'Pending'}</div>
            </div>
            <div class="detail-item">
              <div class="detail-label">Fee</div>
              <div class="detail-value">${tx.fee ? tx.fee.toFixed(8) + ' BITOK' : 'N/A'}</div>
            </div>
            ${tx.blockhash ? `
              <div class="detail-item full-width">
                <div class="detail-label">Block Hash</div>
                <div class="detail-value mono clickable" onclick="app.showBlockDetails('${tx.blockhash}')">${this.truncateHash(tx.blockhash)}</div>
              </div>
            ` : ''}
          </div>

          ${tx.details && tx.details.length > 0 ? `
            <h4 class="detail-subtitle">Transaction Details</h4>
            <div class="tx-details-list">
              ${tx.details.map(detail => `
                <div class="tx-detail-item">
                  <div class="tx-detail-label">${detail.category}</div>
                  <div class="tx-detail-address mono">${detail.address || 'N/A'}</div>
                  <div class="tx-detail-amount">${detail.amount.toFixed(8)} BITOK</div>
                </div>
              `).join('')}
            </div>
          ` : ''}
        </div>
      `;
    } catch (error) {
      resultsContainer.innerHTML = `<div class="message message-error">Transaction not found in wallet. In Bitcoin 0.3.19, you can only query transactions from your own wallet.</div>`;
    }
  }

  async showAddressDetails(address) {
    const resultsContainer = document.getElementById('search-results');
    resultsContainer.innerHTML = '<div class="loading">Loading address details...</div>';

    try {
      const validation = await this.rpc.validateAddress(address);
      if (!validation.isvalid) {
        resultsContainer.innerHTML = '<div class="message message-error">Invalid address</div>';
        return;
      }

      let balance = null;
      let received0 = 0;
      let received6 = 0;
      let addressUtxos = [];
      const isWalletAddress = validation.ismine || false;

      try {
        received0 = await this.rpc.getReceivedByAddress(address, 0);
        received6 = await this.rpc.getReceivedByAddress(address, 6);

        if (isWalletAddress) {
          try {
            addressUtxos = await this.rpc.listUnspent(0, 999999, [address]);
            balance = addressUtxos.reduce((sum, u) => sum + u.amount, 0);
          } catch (e) {
            console.error('Error fetching UTXOs:', e);
          }
        }
      } catch (e) {
        console.error('Error fetching address data:', e);
      }

      resultsContainer.innerHTML = `
        <div class="detail-card">
          <div class="detail-header">
            <h3>Address Details</h3>
            <button class="btn btn-secondary" onclick="app.closeSearch()">Close</button>
          </div>

          ${!isWalletAddress ? `
            <div class="info-box warning">
              <strong>🔒 Satoshi's Privacy-by-Design:</strong> This address is not in the connected wallet.
              In Bitcoin's original design, you can only query balance details for addresses in your own wallet.
              This is a <strong>privacy feature</strong>, not a limitation.
              <button class="btn-link" onclick="app.showPrivacyInfo()">Learn more about this design choice</button>
            </div>
          ` : ''}

          <div class="detail-grid">
            <div class="detail-item full-width">
              <div class="detail-label">Address</div>
              <div class="detail-value mono">${address}</div>
            </div>
            ${balance !== null ? `
              <div class="detail-item">
                <div class="detail-label">Current Balance</div>
                <div class="detail-value success">${balance.toFixed(8)} BITOK</div>
              </div>
            ` : ''}
            <div class="detail-item">
              <div class="detail-label">Total Received (unconfirmed)</div>
              <div class="detail-value">${received0.toFixed(8)} BITOK</div>
            </div>
            <div class="detail-item">
              <div class="detail-label">Total Received (6+ confirmations)</div>
              <div class="detail-value">${received6.toFixed(8)} BITOK</div>
            </div>
            <div class="detail-item">
              <div class="detail-label">In Connected Wallet</div>
              <div class="detail-value">${isWalletAddress ? '✅ Yes' : '❌ No'}</div>
            </div>
          </div>

          ${addressUtxos.length > 0 ? `
            <h4 class="detail-subtitle">Unspent Outputs (${addressUtxos.length})</h4>
            <div class="utxo-list">
              ${addressUtxos.map(utxo => `
                <div class="utxo-item">
                  <div class="utxo-info">
                    <div class="utxo-hash mono clickable" onclick="app.showTxDetails('${utxo.txid}')">${this.truncateHash(utxo.txid)}</div>
                    <div class="utxo-meta">Output #${utxo.vout} • ${utxo.confirmations} confirmations</div>
                  </div>
                  <div class="utxo-amount">${utxo.amount.toFixed(8)} BITOK</div>
                </div>
              `).join('')}
            </div>
          ` : (isWalletAddress ? '<div class="empty-state-text">No unspent outputs (balance is 0)</div>' : '')}
        </div>
      `;
    } catch (error) {
      resultsContainer.innerHTML = `<div class="message message-error">Error: ${error.message}</div>`;
    }
  }

  closeSearch() {
    document.getElementById('search-results').innerHTML = '';
    document.getElementById('universal-search').value = '';
    window.location.hash = '#/';
  }

  showPrivacyInfo() {
    this.showModal('Satoshi\'s Privacy-by-Design Philosophy', `
      <div class="modal-content">
        <h4>Why can't I see other people's balances?</h4>
        <p><strong>This is not a bug or limitation - it's a deliberate privacy feature from Bitcoin's original design.</strong></p>

        <h4>The Original Design (2010)</h4>
        <p>In Bitcoin 0.3.19, the RPC interface only allows you to query addresses that are in <strong>your own wallet</strong>.
        You cannot query arbitrary addresses on the network. This was Satoshi's intentional choice.</p>

        <h4>Why This Design Matters</h4>
        <ul>
          <li><strong>🔒 Privacy First:</strong> Users shouldn't be able to easily spy on other users' balances and spending habits</li>
          <li><strong>📦 No Global Indexing:</strong> The node doesn't maintain a complete index of all addresses (saves resources)</li>
          <li><strong>🤝 Peer-to-Peer:</strong> Each node only tracks what it needs to validate transactions and manage its own wallet</li>
          <li><strong>⚡ Minimalism:</strong> Simpler design = less code = fewer bugs = more security</li>
          <li><strong>🎯 Focused Purpose:</strong> Bitcoin nodes validate transactions, they're not surveillance systems</li>
        </ul>

        <h4>What You CAN Check</h4>
        <ul>
          <li><strong>✅ Your own addresses:</strong> Full balance, UTXOs, and transaction history</li>
          <li><strong>✅ Total received:</strong> For any address, you can see total amount ever received (this data is on the blockchain)</li>
          <li><strong>✅ Blocks & transactions:</strong> All blockchain data is fully transparent and verifiable</li>
          <li><strong>✅ Network stats:</strong> Difficulty, hashrate, block height, etc.</li>
        </ul>

        <h4>Modern Block Explorers Are Different</h4>
        <p>Modern explorers (like Blockchain.com or Blockchair) show balances for any address. How?
        They build their own massive databases by scanning every single block and indexing every transaction.
        This requires:</p>
        <ul>
          <li>Terabytes of storage for the index</li>
          <li>Complex database infrastructure</li>
          <li>Constant processing power</li>
          <li>Not part of the original Bitcoin node design</li>
        </ul>

        <h4>Satoshi's Philosophy</h4>
        <p class="highlight">
          "The design outlines a peer-to-peer network for processing transactions.
          Privacy can be maintained by keeping public keys anonymous."
          <br><em>- Bitcoin Whitepaper, 2008</em>
        </p>

        <p><strong>Bitok maintains this original philosophy:</strong> Simple, privacy-respecting, peer-to-peer electronic cash.</p>

        <div class="info-box" style="margin-top: 20px;">
          <strong>📚 Learn More:</strong> Read about Bitcoin's privacy model in the
          <a href="https://bitcoin.org/bitcoin.pdf" target="_blank">original whitepaper</a>
          or explore the <a href="https://github.com/elvisjedusor/bitok" target="_blank">Bitok source code</a>.
        </div>
      </div>
    `);
  }

  showModal(title, body) {
    document.getElementById('modal-title').textContent = title;
    document.getElementById('modal-body').innerHTML = body;
    document.getElementById('modal-overlay').style.display = 'flex';
  }

  closeModal() {
    document.getElementById('modal-overlay').style.display = 'none';
  }

  setupHashRouter() {
    window.addEventListener('hashchange', () => this.handleRoute());
    this.handleRoute();
  }

  handleRoute() {
    const hash = window.location.hash;

    if (hash.startsWith('#/block/')) {
      const param = hash.replace('#/block/', '');
      this.showBlockDetails(param);
    } else if (hash.startsWith('#/tx/')) {
      const txid = hash.replace('#/tx/', '');
      this.showTxDetails(txid);
    } else if (hash.startsWith('#/address/')) {
      const address = hash.replace('#/address/', '');
      this.showAddressDetails(address);
    } else {
      this.closeSearch();
    }
  }

  async getBlockHeight(hash) {
    for (let height = this.maxBlocks; height >= 0; height--) {
      try {
        const blockHash = await this.rpc.getBlockHash(height);
        if (blockHash === hash) return height;
      } catch (e) {
        continue;
      }
    }
    return 0;
  }

  formatHashrate(hashrate) {
    if (hashrate < 1000) return `${hashrate.toFixed(2)} H/s`;
    if (hashrate < 1000000) return `${(hashrate / 1000).toFixed(2)} KH/s`;
    if (hashrate < 1000000000) return `${(hashrate / 1000000).toFixed(2)} MH/s`;
    return `${(hashrate / 1000000000).toFixed(2)} GH/s`;
  }

  formatTime(timestamp) {
    const now = Date.now() / 1000;
    const diff = now - timestamp;

    if (diff < 60) return `${Math.floor(diff)}s ago`;
    if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
    if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
    return `${Math.floor(diff / 86400)}d ago`;
  }

  truncateHash(hash) {
    if (!hash) return '';
    return `${hash.substring(0, 8)}...${hash.substring(hash.length - 8)}`;
  }
}

document.addEventListener('DOMContentLoaded', () => {
  window.app = new BitokExplorer();

  const searchInput = document.getElementById('universal-search');
  if (searchInput) {
    searchInput.addEventListener('keypress', (e) => {
      if (e.key === 'Enter') {
        window.app.universalSearch();
      }
    });
  }
});
