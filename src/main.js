import './style.css';
import BitokRPC from './bitokRpc.js';
import { RPC_CONFIG } from './config.js';

class BitokExplorer {
  constructor() {
    this.rpc = new BitokRPC(RPC_CONFIG.url, RPC_CONFIG.username, RPC_CONFIG.password);
    this.currentPage = 'home';
    this.blocksPage = 1;
    this.blocksPerPage = 20;
    this.maxBlocks = 0;
    this.networkInfo = null;
    this.init();
  }

  async init() {
    await this.loadNetworkInfo();
    this.setupNavigation();
    this.setupSearchHandlers();
    this.handleRoute();
    window.addEventListener('hashchange', () => this.handleRoute());
    setInterval(() => this.loadNetworkInfo(), 30000);
  }

  async loadNetworkInfo() {
    try {
      this.networkInfo = await this.rpc.getInfo();
      this.maxBlocks = this.networkInfo.blocks;
    } catch (error) {
      console.error('Error loading network info:', error);
    }
  }

  setupNavigation() {
    document.querySelectorAll('.nav-link').forEach(link => {
      link.addEventListener('click', (e) => {
        e.preventDefault();
        const page = link.dataset.page;
        window.location.hash = `#/${page}`;
      });
    });
  }

  setupSearchHandlers() {
    const blockSearch = document.getElementById('block-search');
    if (blockSearch) {
      blockSearch.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') this.searchBlock();
      });
    }

    const txSearch = document.getElementById('tx-search');
    if (txSearch) {
      txSearch.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') this.searchTransaction();
      });
    }

    const addressSearch = document.getElementById('address-search');
    if (addressSearch) {
      addressSearch.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') this.searchAddress();
      });
    }
  }

  handleRoute() {
    const hash = window.location.hash.slice(1) || '/home';
    const parts = hash.split('/').filter(p => p);
    const page = parts[0] || 'home';
    const param = parts[1];

    this.navigateTo(page, param);
  }

  async navigateTo(page, param) {
    document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
    document.querySelectorAll('.nav-link').forEach(l => l.classList.remove('active'));

    const pageEl = document.getElementById(`page-${page}`);
    if (pageEl) {
      pageEl.classList.add('active');
      const navLink = document.querySelector(`[data-page="${page}"]`);
      if (navLink) navLink.classList.add('active');
    }

    this.currentPage = page;

    switch (page) {
      case 'home':
        break;
      case 'dashboard':
        await this.loadDashboard();
        break;
      case 'blocks':
        if (param) {
          await this.showBlockDetails(param);
        } else {
          await this.loadBlocksPage();
        }
        break;
      case 'transactions':
        if (param) {
          await this.showTransactionDetails(param);
        }
        break;
      case 'addresses':
        if (param) {
          await this.showAddressDetails(param);
        }
        break;
    }
  }

  async loadDashboard() {
    await this.updateNetworkStats();
    await this.loadRecentBlocks();
  }

  async updateNetworkStats() {
    if (!this.networkInfo) return;

    const difficulty = this.networkInfo.difficulty || 0;
    const blockTime = 600;
    const hashrate = (difficulty * Math.pow(2, 32)) / blockTime;

    const statBlocks = document.getElementById('stat-blocks');
    const statDifficulty = document.getElementById('stat-difficulty');
    const statHashrate = document.getElementById('stat-hashrate');
    const statPeers = document.getElementById('stat-peers');

    if (statBlocks) statBlocks.textContent = this.networkInfo.blocks.toLocaleString();
    if (statDifficulty) statDifficulty.textContent = difficulty.toFixed(8);
    if (statHashrate) statHashrate.textContent = this.formatHashrate(hashrate);
    if (statPeers) statPeers.textContent = this.networkInfo.connections;
  }

  async loadRecentBlocks() {
    const container = document.getElementById('recent-blocks-list');
    if (!container) return;

    container.innerHTML = '<div class="loading">Loading recent blocks...</div>';

    try {
      const blocks = [];
      const startBlock = Math.max(0, this.maxBlocks - 9);

      for (let height = this.maxBlocks; height >= startBlock; height--) {
        try {
          const hash = await this.rpc.getBlockHash(height);
          const block = await this.rpc.getBlock(hash);
          blocks.push({ height, ...block });
        } catch (e) {
          console.error(`Error loading block ${height}:`, e);
        }
      }

      container.innerHTML = this.renderBlocksTable(blocks);
    } catch (error) {
      container.innerHTML = '<div class="message message-error">Error loading blocks</div>';
    }
  }

  async loadBlocksPage() {
    const container = document.getElementById('all-blocks-list');
    if (!container) return;

    container.innerHTML = '<div class="loading">Loading blocks...</div>';

    try {
      const endBlock = this.maxBlocks - ((this.blocksPage - 1) * this.blocksPerPage);
      const startBlock = Math.max(0, endBlock - this.blocksPerPage + 1);

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

      container.innerHTML = this.renderBlocksTable(blocks);
      this.updateBlocksPagination();
    } catch (error) {
      container.innerHTML = '<div class="message message-error">Error loading blocks</div>';
    }
  }

  renderBlocksTable(blocks) {
    if (blocks.length === 0) {
      return '<div class="empty-state-text">No blocks found</div>';
    }

    return `
      <table class="data-table">
        <thead>
          <tr>
            <th>Height</th>
            <th>Hash</th>
            <th>Time</th>
            <th>Transactions</th>
            <th>Difficulty</th>
          </tr>
        </thead>
        <tbody>
          ${blocks.map(block => `
            <tr onclick="window.location.hash = '#/blocks/${block.height}'" class="clickable-row">
              <td><strong>${block.height.toLocaleString()}</strong></td>
              <td class="mono">${this.truncateHash(block.hash)}</td>
              <td>${this.formatTime(block.time)}</td>
              <td>${block.tx.length}</td>
              <td>${block.difficulty.toFixed(2)}</td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    `;
  }

  updateBlocksPagination() {
    const container = document.getElementById('blocks-pagination');
    const pageNum = document.getElementById('blocks-page-num');
    if (!container) return;

    const totalPages = Math.ceil(this.maxBlocks / this.blocksPerPage);
    if (pageNum) pageNum.textContent = this.blocksPage;

    container.innerHTML = `
      <button class="btn btn-secondary" ${this.blocksPage === 1 ? 'disabled' : ''} onclick="app.prevBlocksPage()">← Previous</button>
      <span class="pagination-info">Page ${this.blocksPage.toLocaleString()} of ${totalPages.toLocaleString()}</span>
      <button class="btn btn-secondary" ${this.blocksPage >= totalPages ? 'disabled' : ''} onclick="app.nextBlocksPage()">Next →</button>
    `;
  }

  prevBlocksPage() {
    if (this.blocksPage > 1) {
      this.blocksPage--;
      this.loadBlocksPage();
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  }

  nextBlocksPage() {
    const totalPages = Math.ceil(this.maxBlocks / this.blocksPerPage);
    if (this.blocksPage < totalPages) {
      this.blocksPage++;
      this.loadBlocksPage();
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  }

  async searchBlock() {
    const input = document.getElementById('block-search');
    const container = document.getElementById('block-search-result');
    const query = input.value.trim();

    if (!query) {
      container.innerHTML = '';
      return;
    }

    if (/^\d+$/.test(query)) {
      const height = parseInt(query);
      window.location.hash = `#/blocks/${height}`;
    } else if (/^[0-9a-fA-F]{64}$/.test(query)) {
      window.location.hash = `#/blocks/${query}`;
    } else {
      container.innerHTML = '<div class="message message-error">Invalid block height or hash</div>';
    }
  }

  async searchTransaction() {
    const input = document.getElementById('tx-search');
    const query = input.value.trim();

    if (!query) return;

    if (/^[0-9a-fA-F]{64}$/.test(query)) {
      window.location.hash = `#/transactions/${query}`;
    } else {
      const container = document.getElementById('tx-search-result');
      container.innerHTML = '<div class="message message-error">Invalid transaction hash</div>';
    }
  }

  async searchAddress() {
    const input = document.getElementById('address-search');
    const query = input.value.trim();

    if (!query) return;

    if (query.length >= 26 && query.length <= 35) {
      window.location.hash = `#/addresses/${query}`;
    } else {
      const container = document.getElementById('address-search-result');
      container.innerHTML = '<div class="message message-error">Invalid address format</div>';
    }
  }

  async showBlockDetails(hashOrHeight) {
    const container = document.getElementById('block-search-result');
    if (!container) return;

    container.innerHTML = '<div class="loading">Loading block details...</div>';

    try {
      let hash = hashOrHeight;
      if (/^\d+$/.test(hashOrHeight)) {
        hash = await this.rpc.getBlockHash(parseInt(hashOrHeight));
      }

      const block = await this.rpc.getBlock(hash);
      let height = hashOrHeight;
      if (!/^\d+$/.test(hashOrHeight)) {
        height = await this.getBlockHeight(hash);
      }

      container.innerHTML = `
        <div class="detail-card">
          <div class="detail-header">
            <h2>Block #${parseInt(height).toLocaleString()}</h2>
            <button class="btn btn-secondary" onclick="window.location.hash = '#/blocks'">Back to Blocks</button>
          </div>

          <div class="detail-grid">
            <div class="detail-row">
              <div class="detail-label">Block Hash</div>
              <div class="detail-value mono">${block.hash}</div>
            </div>
            <div class="detail-row">
              <div class="detail-label">Height</div>
              <div class="detail-value">${parseInt(height).toLocaleString()}</div>
            </div>
            <div class="detail-row">
              <div class="detail-label">Timestamp</div>
              <div class="detail-value">${new Date(block.time * 1000).toLocaleString()}</div>
            </div>
            <div class="detail-row">
              <div class="detail-label">Difficulty</div>
              <div class="detail-value">${block.difficulty.toFixed(8)}</div>
            </div>
            <div class="detail-row">
              <div class="detail-label">Nonce</div>
              <div class="detail-value">${block.nonce}</div>
            </div>
            ${block.previousblockhash ? `
            <div class="detail-row">
              <div class="detail-label">Previous Block</div>
              <div class="detail-value mono link" onclick="window.location.hash = '#/blocks/${block.previousblockhash}'">${this.truncateHash(block.previousblockhash)}</div>
            </div>
            ` : '<div class="detail-row"><div class="detail-label">Previous Block</div><div class="detail-value">Genesis Block</div></div>'}
            <div class="detail-row">
              <div class="detail-label">Merkle Root</div>
              <div class="detail-value mono">${block.merkleroot}</div>
            </div>
          </div>

          <h3>Transactions (${block.tx.length})</h3>
          <div class="transactions-list">
            ${block.tx.map((txid, idx) => `
              <div class="tx-row" onclick="window.location.hash = '#/transactions/${txid}'">
                <span class="tx-index">${idx === 0 ? 'Coinbase' : `TX ${idx}`}</span>
                <span class="tx-hash mono">${this.truncateHash(txid)}</span>
              </div>
            `).join('')}
          </div>
        </div>
      `;
    } catch (error) {
      container.innerHTML = `<div class="message message-error">Error loading block: ${error.message}</div>`;
    }
  }

  async showTransactionDetails(txid) {
    const container = document.getElementById('tx-search-result');
    if (!container) return;

    container.innerHTML = '<div class="loading">Loading transaction details...</div>';

    try {
      const tx = await this.rpc.getTransaction(txid);

      container.innerHTML = `
        <div class="detail-card">
          <div class="detail-header">
            <h2>Transaction Details</h2>
            <button class="btn btn-secondary" onclick="window.location.hash = '#/transactions'">Back</button>
          </div>

          <div class="detail-grid">
            <div class="detail-row">
              <div class="detail-label">Transaction ID</div>
              <div class="detail-value mono">${tx.txid}</div>
            </div>
            <div class="detail-row">
              <div class="detail-label">Amount</div>
              <div class="detail-value ${tx.amount >= 0 ? 'success' : 'error'}">${tx.amount.toFixed(8)} BITOK</div>
            </div>
            <div class="detail-row">
              <div class="detail-label">Confirmations</div>
              <div class="detail-value">${tx.confirmations || 0}</div>
            </div>
            <div class="detail-row">
              <div class="detail-label">Timestamp</div>
              <div class="detail-value">${tx.time ? new Date(tx.time * 1000).toLocaleString() : 'Unconfirmed'}</div>
            </div>
            <div class="detail-row">
              <div class="detail-label">Fee</div>
              <div class="detail-value">${tx.fee ? tx.fee.toFixed(8) + ' BITOK' : 'N/A'}</div>
            </div>
            ${tx.blockhash ? `
            <div class="detail-row">
              <div class="detail-label">Block Hash</div>
              <div class="detail-value mono link" onclick="window.location.hash = '#/blocks/${tx.blockhash}'">${this.truncateHash(tx.blockhash)}</div>
            </div>
            ` : ''}
          </div>

          ${tx.details && tx.details.length > 0 ? `
            <h3>Details</h3>
            <table class="data-table">
              <thead>
                <tr>
                  <th>Category</th>
                  <th>Address</th>
                  <th>Amount</th>
                </tr>
              </thead>
              <tbody>
                ${tx.details.map(detail => `
                  <tr>
                    <td><span class="badge">${detail.category}</span></td>
                    <td class="mono">${detail.address || 'N/A'}</td>
                    <td class="amount">${detail.amount.toFixed(8)} BITOK</td>
                  </tr>
                `).join('')}
              </tbody>
            </table>
          ` : ''}
        </div>
      `;
    } catch (error) {
      container.innerHTML = `
        <div class="message message-error">
          <strong>Transaction not found in wallet</strong>
          <p>In Bitcoin 0.3.19, you can only query transactions from your own wallet. This is Satoshi's privacy-by-design.</p>
          <button class="btn-link" onclick="app.showPrivacyInfo()">Learn more</button>
        </div>
      `;
    }
  }

  async showAddressDetails(address) {
    const container = document.getElementById('address-search-result');
    if (!container) return;

    container.innerHTML = '<div class="loading">Loading address details...</div>';

    try {
      const validation = await this.rpc.validateAddress(address);
      if (!validation.isvalid) {
        container.innerHTML = '<div class="message message-error">Invalid address</div>';
        return;
      }

      const isWalletAddress = validation.ismine || false;
      let balance = null;
      let received0 = 0;
      let received6 = 0;
      let utxos = [];

      try {
        received0 = await this.rpc.getReceivedByAddress(address, 0);
        received6 = await this.rpc.getReceivedByAddress(address, 6);

        if (isWalletAddress) {
          utxos = await this.rpc.listUnspent(0, 999999, [address]);
          balance = utxos.reduce((sum, u) => sum + u.amount, 0);
        }
      } catch (e) {
        console.error('Error fetching address data:', e);
      }

      container.innerHTML = `
        <div class="detail-card">
          <div class="detail-header">
            <h2>Address Details</h2>
            <button class="btn btn-secondary" onclick="window.location.hash = '#/addresses'">Back</button>
          </div>

          ${!isWalletAddress ? `
            <div class="info-box warning">
              <strong>🔒 Privacy-by-Design</strong>
              <p>This address is not in the connected wallet. You can see the total received, but full balance and UTXO details are only available for your own addresses.</p>
              <button class="btn-link" onclick="app.showPrivacyInfo()">Learn why</button>
            </div>
          ` : ''}

          <div class="detail-grid">
            <div class="detail-row full">
              <div class="detail-label">Address</div>
              <div class="detail-value mono">${address}</div>
            </div>
            ${balance !== null ? `
            <div class="detail-row">
              <div class="detail-label">Current Balance</div>
              <div class="detail-value success large">${balance.toFixed(8)} BITOK</div>
            </div>
            ` : ''}
            <div class="detail-row">
              <div class="detail-label">Total Received (0+ conf)</div>
              <div class="detail-value">${received0.toFixed(8)} BITOK</div>
            </div>
            <div class="detail-row">
              <div class="detail-label">Total Received (6+ conf)</div>
              <div class="detail-value">${received6.toFixed(8)} BITOK</div>
            </div>
            <div class="detail-row">
              <div class="detail-label">In Wallet</div>
              <div class="detail-value">${isWalletAddress ? '✅ Yes' : '❌ No'}</div>
            </div>
          </div>

          ${utxos.length > 0 ? `
            <h3>Unspent Outputs (${utxos.length})</h3>
            <table class="data-table">
              <thead>
                <tr>
                  <th>Transaction</th>
                  <th>Vout</th>
                  <th>Confirmations</th>
                  <th>Amount</th>
                </tr>
              </thead>
              <tbody>
                ${utxos.map(utxo => `
                  <tr class="clickable-row" onclick="window.location.hash = '#/transactions/${utxo.txid}'">
                    <td class="mono">${this.truncateHash(utxo.txid)}</td>
                    <td>${utxo.vout}</td>
                    <td>${utxo.confirmations}</td>
                    <td class="amount">${utxo.amount.toFixed(8)} BITOK</td>
                  </tr>
                `).join('')}
              </tbody>
            </table>
          ` : (isWalletAddress ? '<p class="empty-state-text">No unspent outputs</p>' : '')}
        </div>
      `;
    } catch (error) {
      container.innerHTML = `<div class="message message-error">Error: ${error.message}</div>`;
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
    if (diff < 2592000) return `${Math.floor(diff / 86400)}d ago`;
    return new Date(timestamp * 1000).toLocaleDateString();
  }

  truncateHash(hash) {
    if (!hash) return '';
    return `${hash.substring(0, 10)}...${hash.substring(hash.length - 10)}`;
  }
}

document.addEventListener('DOMContentLoaded', () => {
  window.app = new BitokExplorer();
});
