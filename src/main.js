import './style.css';
import BitokRPC from './bitokRpc.js';
import { RPC_CONFIG } from './config.js';

class BitokExplorer {
  constructor() {
    this.rpc = new BitokRPC(RPC_CONFIG.url, RPC_CONFIG.username, RPC_CONFIG.password);
    this.pollInterval = null;
    this.isConnected = false;
    this.currentPage = 'home';
    this.networkData = null;
    this.currentBlock = null;
    this.currentTx = null;

    this.init();
  }

  async init() {
    this.setupNavigation();
    this.setupEventListeners();
    this.setupLightbox();
    await this.fetchData();
    this.startPolling();
  }

  setupNavigation() {
    const navLinks = document.querySelectorAll('.nav-link');
    navLinks.forEach(link => {
      link.addEventListener('click', (e) => {
        e.preventDefault();
        const page = link.dataset.page;
        this.navigateTo(page);
      });
    });
  }

  navigateTo(page) {
    document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
    document.querySelectorAll('.nav-link').forEach(l => l.classList.remove('active'));

    document.getElementById(`page-${page}`).classList.add('active');
    document.querySelector(`[data-page="${page}"]`).classList.add('active');

    this.currentPage = page;
    this.renderCurrentPage();
  }

  setupEventListeners() {
    document.getElementById('global-search-btn')?.addEventListener('click', () => this.globalSearch());
    document.getElementById('global-search')?.addEventListener('keypress', (e) => {
      if (e.key === 'Enter') this.globalSearch();
    });

    document.getElementById('tx-search-btn')?.addEventListener('click', () => this.searchTransaction());
    document.getElementById('tx-search')?.addEventListener('keypress', (e) => {
      if (e.key === 'Enter') this.searchTransaction();
    });

    document.getElementById('addr-search-btn')?.addEventListener('click', () => this.searchAddress());
    document.getElementById('addr-search')?.addEventListener('keypress', (e) => {
      if (e.key === 'Enter') this.searchAddress();
    });
  }

  setupLightbox() {
    const lightbox = document.createElement('div');
    lightbox.className = 'lightbox';
    lightbox.innerHTML = '<button class="lightbox-close">&times;</button><img src="" alt="Screenshot">';
    document.body.appendChild(lightbox);

    const lightboxImg = lightbox.querySelector('img');
    const closeBtn = lightbox.querySelector('.lightbox-close');

    const closeLightbox = () => {
      lightbox.classList.remove('active');
    };

    lightbox.addEventListener('click', (e) => {
      if (e.target === lightbox) {
        closeLightbox();
      }
    });

    closeBtn.addEventListener('click', closeLightbox);

    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && lightbox.classList.contains('active')) {
        closeLightbox();
      }
    });

    document.addEventListener('click', (e) => {
      if (e.target.closest('.screenshots-grid img')) {
        const img = e.target;
        lightboxImg.src = img.src;
        lightbox.classList.add('active');
      }
    });
  }

  async fetchData() {
    try {
      const info = await this.rpc.getInfo();
      this.networkData = info;
      this.isConnected = true;
      this.updateConnectionStatus(true);
      await this.renderCurrentPage();
    } catch (error) {
      this.isConnected = false;
      this.updateConnectionStatus(false, error.message);
      console.error('Failed to fetch data:', error);
    }
  }

  updateConnectionStatus(connected, errorMsg = '') {
    const statusDot = document.querySelector('.status-dot');
    const statusText = document.querySelector('.status-text');

    if (connected) {
      statusDot.classList.add('connected');
      statusText.textContent = 'Connected';
    } else {
      statusDot.classList.remove('connected');
      statusText.textContent = errorMsg || 'Disconnected';
    }
  }

  async renderCurrentPage() {
    if (!this.networkData) return;

    switch (this.currentPage) {
      case 'home':
        break;
      case 'dashboard':
        await this.renderHome();
        break;
      case 'blocks':
        await this.renderBlocks();
        break;
      case 'transactions':
        await this.renderTransactions();
        break;
      case 'mempool':
        await this.renderMempool();
        break;
      case 'addresses':
        await this.renderAddresses();
        break;
    }
  }

  async renderHome() {
    const { blocks, difficulty, connections, generate, genproclimit } = this.networkData;

    document.getElementById('stat-blocks').textContent = blocks.toLocaleString();
    document.getElementById('stat-difficulty').textContent = difficulty.toFixed(8);

    const mempoolTxs = await this.rpc.getRawMempool();
    document.getElementById('stat-mempool').textContent = mempoolTxs.length;

    const hashrate = await this.calculateNetworkHashrate(blocks, difficulty);
    const miningEl = document.getElementById('stat-mining');
    miningEl.textContent = this.formatHashrate(hashrate);
    miningEl.className = `stat-value mining`;

    await this.renderHomeBlocks();
  }

  async renderHomeBlocks() {
    const container = document.getElementById('home-blocks-list');
    const { blocks: currentHeight } = this.networkData;

    try {
      const blocksList = [];
      for (let i = 0; i < Math.min(10, currentHeight); i++) {
        const hash = await this.rpc.getBlockHash(currentHeight - i);
        const block = await this.rpc.getBlock(hash);
        blocksList.push({ height: currentHeight - i, ...block });
      }

      container.innerHTML = blocksList.map(block => `
        <div class="block-item" onclick="window.explorer.viewBlock('${block.hash}')">
          <div class="block-info">
            <div class="block-height">Block #${block.height.toLocaleString()}</div>
            <div class="block-meta">${block.tx?.length || 0} transactions • ${this.formatTime(block.time)}</div>
          </div>
          <div class="activity-meta">
            <div class="block-hash">${this.truncateHash(block.hash)}</div>
          </div>
        </div>
      `).join('');
    } catch (error) {
      container.innerHTML = '<div class="empty-state-text">Failed to load blocks</div>';
      console.error('Failed to fetch blocks:', error);
    }
  }

  async renderBlocks() {
    const container = document.getElementById('blocks-content');

    if (this.currentBlock) {
      container.innerHTML = await this.renderBlockDetails(this.currentBlock);
    } else {
      const { blocks: currentHeight } = this.networkData;
      const blocksList = [];

      try {
        for (let i = 0; i < Math.min(20, currentHeight); i++) {
          const hash = await this.rpc.getBlockHash(currentHeight - i);
          const block = await this.rpc.getBlock(hash);
          blocksList.push({ height: currentHeight - i, ...block });
        }

        container.innerHTML = `
          <div class="section-header">
            <h2 class="section-title">Latest Blocks</h2>
          </div>
          <div class="blocks-list">
            ${blocksList.map(block => `
              <div class="block-item" onclick="window.explorer.viewBlock('${block.hash}')">
                <div class="block-info">
                  <div class="block-height">Block #${block.height.toLocaleString()}</div>
                  <div class="block-meta">${block.tx?.length || 0} transactions</div>
                </div>
                <div class="activity-meta">
                  <div class="block-hash">${this.truncateHash(block.hash)}</div>
                  <div class="block-time">${this.formatTime(block.time)}</div>
                </div>
              </div>
            `).join('')}
          </div>
        `;
      } catch (error) {
        container.innerHTML = '<div class="empty-state-text">Failed to load blocks</div>';
      }
    }
  }

  async renderBlockDetails(blockHash) {
    try {
      const block = await this.rpc.getBlock(blockHash);
      const height = await this.rpc.getBlockCount();

      return `
        <button class="back-btn" onclick="window.explorer.currentBlock = null; window.explorer.renderBlocks();">← Back to Blocks</button>

        <div class="detail-card">
          <h3 class="detail-title">Block #${height - (block.height || 0)}</h3>

          <div class="detail-grid">
            <div class="detail-item">
              <div class="detail-label">Hash</div>
              <div class="detail-value mono">${block.hash}</div>
            </div>
            <div class="detail-item">
              <div class="detail-label">Previous Block</div>
              <div class="detail-value mono clickable" onclick="window.explorer.viewBlock('${block.previousblockhash}')">${block.previousblockhash || 'Genesis'}</div>
            </div>
            <div class="detail-item">
              <div class="detail-label">Merkle Root</div>
              <div class="detail-value mono">${block.merkleroot}</div>
            </div>
            <div class="detail-item">
              <div class="detail-label">Time</div>
              <div class="detail-value">${this.formatFullTime(block.time)}</div>
            </div>
            <div class="detail-item">
              <div class="detail-label">Difficulty</div>
              <div class="detail-value">${block.difficulty || 'N/A'}</div>
            </div>
            <div class="detail-item">
              <div class="detail-label">Nonce</div>
              <div class="detail-value">${block.nonce}</div>
            </div>
          </div>

          <h3 class="detail-subtitle">Transactions (${block.tx?.length || 0})</h3>
          <div class="tx-list">
            ${(block.tx || []).map(txid => `
              <div class="tx-item clickable" onclick="window.explorer.viewTransaction('${txid}')">
                <div class="tx-icon">TX</div>
                <div class="tx-hash">${this.truncateHash(txid)}</div>
              </div>
            `).join('')}
          </div>
        </div>
      `;
    } catch (error) {
      return `<div class="message message-error">Failed to load block: ${error.message}</div>`;
    }
  }

  async renderTransactions() {
    const container = document.getElementById('tx-content');

    if (this.currentTx) {
      container.innerHTML = await this.renderTransactionDetails(this.currentTx);
    } else {
      container.innerHTML = `
        <div class="empty-state">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/>
          </svg>
          <div class="empty-state-title">Search for a Transaction</div>
          <div class="empty-state-text">Enter a transaction ID above to view details</div>
        </div>
      `;
    }
  }

  async renderTransactionDetails(txid) {
    try {
      const tx = await this.rpc.getRawTransaction(txid, true);

      const totalIn = tx.vin?.reduce((sum, input) => {
        return sum + (input.value || 0);
      }, 0) || 0;

      const totalOut = tx.vout?.reduce((sum, output) => {
        return sum + (output.value || 0);
      }, 0) || 0;

      return `
        <button class="back-btn" onclick="window.explorer.currentTx = null; window.explorer.renderTransactions();">← Back</button>

        <div class="detail-card">
          <h3 class="detail-title">Transaction Details</h3>

          <div class="detail-grid">
            <div class="detail-item full-width">
              <div class="detail-label">Transaction ID</div>
              <div class="detail-value mono">${tx.txid}</div>
            </div>
            <div class="detail-item">
              <div class="detail-label">Confirmations</div>
              <div class="detail-value">${tx.confirmations || 0}</div>
            </div>
            <div class="detail-item">
              <div class="detail-label">Block Hash</div>
              <div class="detail-value mono clickable" onclick="window.explorer.viewBlock('${tx.blockhash}')">${this.truncateHash(tx.blockhash || 'Unconfirmed')}</div>
            </div>
            <div class="detail-item">
              <div class="detail-label">Time</div>
              <div class="detail-value">${tx.time ? this.formatFullTime(tx.time) : 'Pending'}</div>
            </div>
            <div class="detail-item">
              <div class="detail-label">Size</div>
              <div class="detail-value">${tx.size || 0} bytes</div>
            </div>
          </div>

          <div class="tx-flow">
            <div class="tx-flow-section">
              <h4>Inputs (${tx.vin?.length || 0})</h4>
              <div class="tx-io-list">
                ${(tx.vin || []).map((input, idx) => `
                  <div class="tx-io-item">
                    <div class="tx-io-label">#${idx}</div>
                    <div class="tx-io-content">
                      ${input.coinbase ?
                        '<div class="tx-coinbase">Coinbase (Mining Reward)</div>' :
                        `<div class="tx-io-hash mono">${this.truncateHash(input.txid || 'N/A')}</div>
                         <div class="tx-io-value">${(input.value || 0).toFixed(8)} BITOK</div>`
                      }
                    </div>
                  </div>
                `).join('')}
              </div>
              <div class="tx-total">Total: ${totalIn.toFixed(8)} BITOK</div>
            </div>

            <div class="tx-flow-arrow">→</div>

            <div class="tx-flow-section">
              <h4>Outputs (${tx.vout?.length || 0})</h4>
              <div class="tx-io-list">
                ${(tx.vout || []).map((output, idx) => `
                  <div class="tx-io-item">
                    <div class="tx-io-label">#${idx}</div>
                    <div class="tx-io-content">
                      <div class="tx-io-address mono">${output.scriptPubKey?.addresses?.[0] || 'Unknown'}</div>
                      <div class="tx-io-value">${output.value.toFixed(8)} BITOK</div>
                    </div>
                  </div>
                `).join('')}
              </div>
              <div class="tx-total">Total: ${totalOut.toFixed(8)} BITOK</div>
            </div>
          </div>

          ${totalIn > 0 ? `<div class="tx-fee">Fee: ${(totalIn - totalOut).toFixed(8)} BITOK</div>` : ''}
        </div>
      `;
    } catch (error) {
      return `<div class="message message-error">Failed to load transaction: ${error.message}</div>`;
    }
  }

  async renderMempool() {
    const container = document.getElementById('mempool-list');
    const countEl = document.getElementById('mempool-count');

    try {
      const txids = await this.rpc.getRawMempool();
      countEl.textContent = txids.length;

      if (txids.length === 0) {
        container.innerHTML = `
          <div class="empty-state">
            <div class="empty-state-title">Mempool Empty</div>
            <div class="empty-state-text">No pending transactions</div>
          </div>
        `;
        return;
      }

      container.innerHTML = `
        <div class="mempool-list">
          ${txids.slice(0, 50).map(txid => `
            <div class="tx-item clickable" onclick="window.explorer.viewTransaction('${txid}')">
              <div class="tx-icon pending">⏳</div>
              <div class="tx-info">
                <div class="tx-hash">${this.truncateHash(txid)}</div>
                <div class="tx-meta">Unconfirmed</div>
              </div>
            </div>
          `).join('')}
        </div>
        ${txids.length > 50 ? `<div class="tx-meta" style="text-align:center;margin-top:16px;">Showing 50 of ${txids.length} transactions</div>` : ''}
      `;
    } catch (error) {
      container.innerHTML = `<div class="empty-state-text">Failed to load mempool</div>`;
      console.error('Failed to fetch mempool:', error);
    }
  }

  async renderAddresses() {
    const container = document.getElementById('addr-content');

    container.innerHTML = `
      <div class="empty-state">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/>
        </svg>
        <div class="empty-state-title">Search for an Address</div>
        <div class="empty-state-text">Enter an address above to view balance and transactions</div>
      </div>
    `;
  }

  async renderNetwork() {
    const container = document.getElementById('peers-list');
    const countEl = document.getElementById('peers-count');

    try {
      const peers = await this.rpc.getPeerInfo();
      countEl.textContent = peers.length;

      if (peers.length === 0) {
        container.innerHTML = `
          <div class="empty-state">
            <div class="empty-state-title">No Peers Connected</div>
            <div class="empty-state-text">Node is not connected to any peers</div>
          </div>
        `;
        return;
      }

      container.innerHTML = peers.map(peer => `
        <div class="peer-item">
          <div class="peer-icon">🌐</div>
          <div class="peer-info">
            <div class="peer-addr">${peer.addr}</div>
            <div class="peer-meta">
              Version: ${peer.version || 'N/A'} •
              Height: ${peer.startingheight || 0} •
              ${peer.inbound ? 'Inbound' : 'Outbound'}
            </div>
          </div>
          <div class="peer-time">${this.formatDuration(peer.conntime)}</div>
        </div>
      `).join('');
    } catch (error) {
      container.innerHTML = `<div class="empty-state-text">Failed to load peers</div>`;
      console.error('Failed to fetch peers:', error);
    }
  }

  async globalSearch() {
    const input = document.getElementById('global-search');
    const resultContainer = document.getElementById('global-search-result');
    const query = input.value.trim();

    if (!query) {
      this.showMessage(resultContainer, 'Please enter a search term', 'error');
      return;
    }

    resultContainer.innerHTML = '<div class="message message-loading">Searching...</div>';

    if (query.length === 64) {
      try {
        await this.rpc.getBlock(query);
        this.viewBlock(query);
        resultContainer.innerHTML = '';
        return;
      } catch (e) {
        try {
          await this.rpc.getRawTransaction(query, true);
          this.viewTransaction(query);
          resultContainer.innerHTML = '';
          return;
        } catch (e2) {}
      }
    }

    if (!isNaN(query)) {
      try {
        const hash = await this.rpc.getBlockHash(parseInt(query));
        this.viewBlock(hash);
        resultContainer.innerHTML = '';
        return;
      } catch (e) {}
    }

    if (query.length >= 26 && query.length <= 35) {
      this.searchAddressDirect(query);
      resultContainer.innerHTML = '';
      return;
    }

    this.showMessage(resultContainer, 'No results found', 'error');
  }

  async searchTransaction() {
    const input = document.getElementById('tx-search');
    const txid = input.value.trim();

    if (txid) {
      this.viewTransaction(txid);
    }
  }

  async searchAddress() {
    const input = document.getElementById('addr-search');
    const address = input.value.trim();

    if (address) {
      await this.searchAddressDirect(address);
    }
  }

  async searchAddressDirect(address) {
    const container = document.getElementById('addr-content');

    try {
      container.innerHTML = '<div class="message message-loading">Loading...</div>';

      const validation = await this.rpc.validateAddress(address);
      if (!validation.isvalid) {
        container.innerHTML = '<div class="message message-error">Invalid address</div>';
        return;
      }

      const [received0, received6, utxos] = await Promise.all([
        this.rpc.getReceivedByAddress(address, 0),
        this.rpc.getReceivedByAddress(address, 6),
        this.rpc.listUnspent(0, 999999).catch(() => [])
      ]);

      const addressUtxos = utxos.filter(u => u.address === address);
      const balance = addressUtxos.reduce((sum, u) => sum + u.amount, 0);

      container.innerHTML = `
        <div class="detail-card">
          <h3 class="detail-title">Address Details</h3>

          <div class="detail-grid">
            <div class="detail-item full-width">
              <div class="detail-label">Address</div>
              <div class="detail-value mono">${address}</div>
            </div>
            <div class="detail-item">
              <div class="detail-label">Balance</div>
              <div class="detail-value success">${balance.toFixed(8)} BITOK</div>
            </div>
            <div class="detail-item">
              <div class="detail-label">Total Received</div>
              <div class="detail-value">${received0.toFixed(8)} BITOK</div>
            </div>
            <div class="detail-item">
              <div class="detail-label">Confirmed Received</div>
              <div class="detail-value">${received6.toFixed(8)} BITOK</div>
            </div>
            <div class="detail-item">
              <div class="detail-label">Is Mine</div>
              <div class="detail-value">${validation.ismine ? 'Yes' : 'No'}</div>
            </div>
          </div>

          ${addressUtxos.length > 0 ? `
            <h3 class="detail-subtitle">Unspent Outputs (${addressUtxos.length})</h3>
            <div class="utxo-list">
              ${addressUtxos.map(utxo => `
                <div class="utxo-item">
                  <div class="utxo-info">
                    <div class="utxo-hash mono clickable" onclick="window.explorer.viewTransaction('${utxo.txid}')">${this.truncateHash(utxo.txid)}</div>
                    <div class="utxo-meta">Output #${utxo.vout} • ${utxo.confirmations} confirmations</div>
                  </div>
                  <div class="utxo-amount">${utxo.amount.toFixed(8)} BITOK</div>
                </div>
              `).join('')}
            </div>
          ` : '<div class="empty-state-text">No unspent outputs</div>'}
        </div>
      `;

      this.navigateTo('addresses');
    } catch (error) {
      container.innerHTML = `<div class="message message-error">Error: ${error.message}</div>`;
    }
  }

  viewBlock(hash) {
    this.currentBlock = hash;
    this.navigateTo('blocks');
  }

  viewTransaction(txid) {
    this.currentTx = txid;
    this.navigateTo('transactions');
  }

  showMessage(container, message, type) {
    container.innerHTML = `<div class="message message-${type}">${message}</div>`;
  }

  truncateHash(hash) {
    if (!hash || hash.length <= 20) return hash;
    return `${hash.substring(0, 10)}...${hash.substring(hash.length - 10)}`;
  }

  formatTime(timestamp) {
    const date = new Date(timestamp * 1000);
    const now = new Date();
    const diff = Math.floor((now - date) / 1000);

    if (diff < 60) return `${diff}s ago`;
    if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
    if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
    return `${Math.floor(diff / 86400)}d ago`;
  }

  formatFullTime(timestamp) {
    return new Date(timestamp * 1000).toLocaleString();
  }

  formatDuration(seconds) {
    if (seconds < 60) return `${seconds}s`;
    if (seconds < 3600) return `${Math.floor(seconds / 60)}m`;
    if (seconds < 86400) return `${Math.floor(seconds / 3600)}h`;
    return `${Math.floor(seconds / 86400)}d`;
  }

  async calculateNetworkHashrate(currentHeight, difficulty) {
    try {
      if (currentHeight < 10) {
        return difficulty * Math.pow(2, 32) / 600;
      }

      const blocks = [];
      for (let i = 0; i < 10; i++) {
        const hash = await this.rpc.getBlockHash(currentHeight - i);
        const block = await this.rpc.getBlock(hash);
        blocks.push(block);
      }

      let totalTime = 0;
      for (let i = 0; i < blocks.length - 1; i++) {
        totalTime += blocks[i].time - blocks[i + 1].time;
      }
      const avgBlockTime = totalTime / (blocks.length - 1);

      const hashrate = (difficulty * Math.pow(2, 32)) / avgBlockTime;
      return hashrate;
    } catch (error) {
      console.error('Failed to calculate hashrate:', error);
      return difficulty * Math.pow(2, 32) / 600;
    }
  }

  formatHashrate(hashrate) {
    const units = ['H/s', 'KH/s', 'MH/s', 'GH/s', 'TH/s', 'PH/s', 'EH/s'];
    let unitIndex = 0;
    let value = hashrate;

    while (value >= 1000 && unitIndex < units.length - 1) {
      value /= 1000;
      unitIndex++;
    }

    return `${value.toFixed(2)} ${units[unitIndex]}`;
  }

  startPolling() {
    if (this.pollInterval) clearInterval(this.pollInterval);

    this.pollInterval = setInterval(async () => {
      await this.fetchData();
    }, RPC_CONFIG.pollInterval);
  }
}

window.explorer = new BitokExplorer();
