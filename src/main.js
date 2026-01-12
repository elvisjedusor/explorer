import './style.css';
import BitokRPC from './bitokRpc.js';
import { RPC_CONFIG } from './config.js';

class BitokExplorer {
  constructor() {
    this.rpc = new BitokRPC(RPC_CONFIG.url, RPC_CONFIG.username, RPC_CONFIG.password);
    this.pollInterval = null;
    this.isConnected = false;
    this.networkData = null;

    this.init();
  }

  async init() {
    this.setupNavigation();
    this.setupEventListeners();
    this.setupLightbox();
    await this.fetchData();
    this.handleRoute();
    window.addEventListener('hashchange', () => this.handleRoute());
    this.startPolling();
  }

  setupNavigation() {
    const navLinks = document.querySelectorAll('.nav-link');
    navLinks.forEach(link => {
      link.addEventListener('click', (e) => {
        e.preventDefault();
        const page = link.dataset.page;
        window.location.hash = '';
        this.navigateTo(page);
      });
    });
  }

  navigateTo(page) {
    document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
    document.querySelectorAll('.nav-link').forEach(l => l.classList.remove('active'));

    document.getElementById(`page-${page}`).classList.add('active');
    const navLink = document.querySelector(`[data-page="${page}"]`);
    if (navLink) navLink.classList.add('active');

    this.renderPage(page);
  }

  handleRoute() {
    const hash = window.location.hash.slice(1);

    if (!hash) {
      this.navigateTo('home');
      return;
    }

    const parts = hash.split('/').filter(p => p);

    if (parts.length === 0) {
      this.navigateTo('home');
      return;
    }

    const type = parts[0];
    const id = parts[1];

    switch (type) {
      case 'block':
        if (id) {
          this.navigateTo('blocks');
          this.viewBlock(id);
        } else {
          this.navigateTo('blocks');
        }
        break;
      case 'tx':
        if (id) {
          this.navigateTo('transactions');
          this.viewTransaction(id);
        } else {
          this.navigateTo('transactions');
        }
        break;
      case 'address':
        if (id) {
          this.navigateTo('addresses');
          this.searchAddressDirect(id);
        } else {
          this.navigateTo('addresses');
        }
        break;
      default:
        this.navigateTo('home');
    }
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
      await this.updateDashboard();
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

  async renderPage(page) {
    if (!this.networkData) return;

    switch (page) {
      case 'home':
        break;
      case 'dashboard':
        await this.updateDashboard();
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

  async updateDashboard() {
    if (!this.networkData) return;

    const { blocks, difficulty } = this.networkData;
    const maxHeight = blocks - 1;

    document.getElementById('stat-blocks').textContent = maxHeight.toLocaleString();
    document.getElementById('stat-difficulty').textContent = difficulty.toFixed(8);

    try {
      const mempoolTxs = await this.rpc.getRawMempool();
      document.getElementById('stat-mempool').textContent = mempoolTxs.length;
    } catch (e) {
      document.getElementById('stat-mempool').textContent = '0';
    }

    const hashrate = await this.calculateNetworkHashrate(blocks, difficulty);
    const miningEl = document.getElementById('stat-mining');
    miningEl.textContent = this.formatHashrate(hashrate);
    miningEl.className = `stat-value mining`;

    await this.renderHomeBlocks();
  }

  async renderHomeBlocks() {
    const container = document.getElementById('home-blocks-list');
    if (!container) return;

    const { blocks: currentHeight } = this.networkData;
    const maxHeight = currentHeight - 1;

    try {
      const blocksList = [];
      const limit = Math.min(10, currentHeight);

      for (let i = 0; i < limit; i++) {
        const height = maxHeight - i;
        if (height < 0) break;

        const hash = await this.rpc.getBlockHash(height);
        const block = await this.rpc.getBlock(hash);
        blocksList.push({ height, ...block });
      }

      container.innerHTML = blocksList.map(block => `
        <div class="block-item" onclick="window.location.hash='#/block/${block.hash}'">
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
    const hash = window.location.hash;

    if (hash.includes('/block/')) {
      const blockId = hash.split('/block/')[1];
      container.innerHTML = '<div class="message message-loading">Loading block...</div>';
      container.innerHTML = await this.renderBlockDetails(blockId);
    } else {
      const { blocks: currentHeight } = this.networkData;
      const maxHeight = currentHeight - 1;
      const blocksList = [];

      try {
        container.innerHTML = '<div class="message message-loading">Loading blocks...</div>';

        const limit = Math.min(20, currentHeight);
        for (let i = 0; i < limit; i++) {
          const height = maxHeight - i;
          if (height < 0) break;

          const hash = await this.rpc.getBlockHash(height);
          const block = await this.rpc.getBlock(hash);
          blocksList.push({ height, ...block });
        }

        container.innerHTML = `
          <div class="section-header">
            <h2 class="section-title">Latest Blocks</h2>
          </div>
          <div class="blocks-list">
            ${blocksList.map(block => `
              <div class="block-item" onclick="window.location.hash='#/block/${block.hash}'">
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

  async renderBlockDetails(blockId) {
    try {
      let block;
      let height;

      if (blockId.match(/^\d+$/)) {
        height = parseInt(blockId);
        const hash = await this.rpc.getBlockHash(height);
        block = await this.rpc.getBlock(hash);
      } else {
        block = await this.rpc.getBlock(blockId);
        const currentHeight = await this.rpc.getBlockCount();
        height = currentHeight - 1;

        let testBlock = await this.rpc.getBlock(await this.rpc.getBestBlockHash());
        let count = 0;
        while (testBlock.hash !== block.hash && count < 10000) {
          if (!testBlock.previousblockhash) break;
          testBlock = await this.rpc.getBlock(testBlock.previousblockhash);
          height--;
          count++;
        }
      }

      const shareUrl = `${window.location.origin}${window.location.pathname}#/block/${block.hash}`;

      return `
        <button class="back-btn" onclick="window.location.hash=''; window.explorer.renderBlocks();">← Back to Blocks</button>

        <div class="detail-card">
          <h3 class="detail-title">Block #${height.toLocaleString()}</h3>
          <div style="margin-top: 8px; font-size: 12px; color: #666;">
            <a href="${shareUrl}" style="color: #0066cc;">Share this block</a>
          </div>

          <div class="detail-grid">
            <div class="detail-item full-width">
              <div class="detail-label">Hash</div>
              <div class="detail-value mono">${block.hash}</div>
            </div>
            <div class="detail-item full-width">
              <div class="detail-label">Previous Block</div>
              ${block.previousblockhash ?
                `<div class="detail-value mono clickable" onclick="window.location.hash='#/block/${block.previousblockhash}'" style="color: #0066cc; cursor: pointer;">${block.previousblockhash}</div>` :
                '<div class="detail-value">Genesis Block</div>'
              }
            </div>
            <div class="detail-item full-width">
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
            <div class="detail-item">
              <div class="detail-label">Transactions</div>
              <div class="detail-value">${block.tx?.length || 0}</div>
            </div>
          </div>

          <h3 class="detail-subtitle">Transactions</h3>
          <div class="tx-list">
            ${(block.tx || []).map(txid => `
              <div class="tx-item clickable" onclick="window.location.hash='#/tx/${txid}'">
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
    const hash = window.location.hash;

    if (hash.includes('/tx/')) {
      const txid = hash.split('/tx/')[1];
      container.innerHTML = '<div class="message message-loading">Loading transaction...</div>';
      container.innerHTML = await this.renderTransactionDetails(txid);
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

      let totalIn = 0;
      const vins = [];

      for (const input of (tx.vin || [])) {
        if (input.coinbase) {
          vins.push({ ...input, value: 0 });
        } else if (input.txid) {
          try {
            const prevTx = await this.rpc.getRawTransaction(input.txid, true);
            const prevOut = prevTx.vout[input.vout];
            const value = prevOut.value || 0;
            totalIn += value;
            vins.push({ ...input, value, address: prevOut.scriptPubKey?.addresses?.[0] });
          } catch (e) {
            vins.push({ ...input, value: 0 });
          }
        }
      }

      const totalOut = tx.vout?.reduce((sum, output) => {
        return sum + (output.value || 0);
      }, 0) || 0;

      const shareUrl = `${window.location.origin}${window.location.pathname}#/tx/${txid}`;

      return `
        <button class="back-btn" onclick="window.location.hash=''; window.explorer.renderTransactions();">← Back</button>

        <div class="detail-card">
          <h3 class="detail-title">Transaction Details</h3>
          <div style="margin-top: 8px; font-size: 12px; color: #666;">
            <a href="${shareUrl}" style="color: #0066cc;">Share this transaction</a>
          </div>

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
              ${tx.blockhash ?
                `<div class="detail-value mono clickable" onclick="window.location.hash='#/block/${tx.blockhash}'" style="color: #0066cc; cursor: pointer;">${this.truncateHash(tx.blockhash)}</div>` :
                '<div class="detail-value">Unconfirmed</div>'
              }
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
              <h4>Inputs (${vins.length})</h4>
              <div class="tx-io-list">
                ${vins.map((input, idx) => `
                  <div class="tx-io-item">
                    <div class="tx-io-label">#${idx}</div>
                    <div class="tx-io-content">
                      ${input.coinbase ?
                        '<div class="tx-coinbase">Coinbase (Mining Reward)</div>' :
                        `<div class="tx-io-hash mono clickable" onclick="window.location.hash='#/tx/${input.txid}'" style="color: #0066cc; cursor: pointer;">${this.truncateHash(input.txid || 'N/A')}</div>
                         ${input.address ? `<div class="tx-io-address mono clickable" onclick="window.location.hash='#/address/${input.address}'" style="color: #0066cc; cursor: pointer;">${input.address}</div>` : ''}
                         <div class="tx-io-value">${input.value.toFixed(8)} BITOK</div>`
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
                      ${output.scriptPubKey?.addresses?.[0] ?
                        `<div class="tx-io-address mono clickable" onclick="window.location.hash='#/address/${output.scriptPubKey.addresses[0]}'" style="color: #0066cc; cursor: pointer;">${output.scriptPubKey.addresses[0]}</div>` :
                        '<div class="tx-io-address mono">Unknown</div>'
                      }
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
            <div class="tx-item clickable" onclick="window.location.hash='#/tx/${txid}'">
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
    const hash = window.location.hash;

    if (hash.includes('/address/')) {
      const address = hash.split('/address/')[1];
      container.innerHTML = '<div class="message message-loading">Loading address...</div>';
      await this.searchAddressDirect(address);
    } else {
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
        window.location.hash = `#/block/${query}`;
        resultContainer.innerHTML = '';
        return;
      } catch (e) {
        try {
          await this.rpc.getRawTransaction(query, true);
          window.location.hash = `#/tx/${query}`;
          resultContainer.innerHTML = '';
          return;
        } catch (e2) {}
      }
    }

    if (query.match(/^\d+$/)) {
      try {
        const height = parseInt(query);
        const hash = await this.rpc.getBlockHash(height);
        window.location.hash = `#/block/${hash}`;
        resultContainer.innerHTML = '';
        return;
      } catch (e) {
        this.showMessage(resultContainer, `Block #${query} not found`, 'error');
        return;
      }
    }

    if (query.length >= 26 && query.length <= 35) {
      window.location.hash = `#/address/${query}`;
      resultContainer.innerHTML = '';
      return;
    }

    this.showMessage(resultContainer, 'No results found', 'error');
  }

  async searchTransaction() {
    const input = document.getElementById('tx-search');
    const txid = input.value.trim();

    if (txid) {
      window.location.hash = `#/tx/${txid}`;
    }
  }

  async searchAddress() {
    const input = document.getElementById('addr-search');
    const address = input.value.trim();

    if (address) {
      window.location.hash = `#/address/${address}`;
    }
  }

  async searchAddressDirect(address) {
    const container = document.getElementById('addr-content');

    try {
      const validation = await this.rpc.validateAddress(address);
      if (!validation.isvalid) {
        container.innerHTML = '<div class="message message-error">Invalid address</div>';
        return;
      }

      let balance = null;
      let received0 = 0;
      let received6 = 0;
      let addressUtxos = [];
      let isWalletAddress = validation.ismine || false;

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

      const shareUrl = `${window.location.origin}${window.location.pathname}#/address/${address}`;

      container.innerHTML = `
        <div class="detail-card">
          <h3 class="detail-title">Address Details</h3>
          <div style="margin-top: 8px; font-size: 12px; color: #666;">
            <a href="${shareUrl}" style="color: #0066cc;">Share this address</a>
          </div>

          ${!isWalletAddress ? `
            <div style="background: #fff3cd; border: 1px solid #ffc107; padding: 12px; margin: 16px 0; border-radius: 4px;">
              <strong>Note:</strong> This address is not in the connected wallet. Only total received amounts are available. Current balance and UTXOs require the address to be in the wallet.
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
              <div class="detail-label">Total Received (0 conf)</div>
              <div class="detail-value">${received0.toFixed(8)} BITOK</div>
            </div>
            <div class="detail-item">
              <div class="detail-label">Total Received (6+ conf)</div>
              <div class="detail-value">${received6.toFixed(8)} BITOK</div>
            </div>
            <div class="detail-item">
              <div class="detail-label">In Wallet</div>
              <div class="detail-value">${isWalletAddress ? 'Yes' : 'No'}</div>
            </div>
          </div>

          ${addressUtxos.length > 0 ? `
            <h3 class="detail-subtitle">Unspent Outputs (${addressUtxos.length})</h3>
            <div class="utxo-list">
              ${addressUtxos.map(utxo => `
                <div class="utxo-item">
                  <div class="utxo-info">
                    <div class="utxo-hash mono clickable" onclick="window.location.hash='#/tx/${utxo.txid}'" style="color: #0066cc; cursor: pointer;">${this.truncateHash(utxo.txid)}</div>
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
      container.innerHTML = `<div class="message message-error">Error: ${error.message}</div>`;
    }
  }

  viewBlock(hash) {
    window.location.hash = `#/block/${hash}`;
  }

  viewTransaction(txid) {
    window.location.hash = `#/tx/${txid}`;
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

  async calculateNetworkHashrate(currentHeight, globalDifficulty) {
    try {
      if (currentHeight < 2) {
        return 0;
      }

      const maxHeight = currentHeight - 1;
      const blocksToFetch = Math.min(100, currentHeight);
      const blocks = [];

      for (let i = 0; i < blocksToFetch; i++) {
        const height = maxHeight - i;
        if (height < 0) break;

        try {
          const hash = await this.rpc.getBlockHash(height);
          const block = await this.rpc.getBlock(hash);
          if (block && block.time) {
            blocks.push(block);
          }
        } catch (e) {
          console.error(`Failed to fetch block at height ${height}:`, e);
          break;
        }
      }

      if (blocks.length < 2) {
        return 0;
      }

      const oldestBlock = blocks[blocks.length - 1];
      const newestBlock = blocks[0];
      const timeDiff = newestBlock.time - oldestBlock.time;
      const heightDiff = blocks.length - 1;

      if (timeDiff <= 0 || heightDiff === 0) {
        return 0;
      }

      const avgBlockTime = timeDiff / heightDiff;
      const difficulty = globalDifficulty || 1.0;

      const hashrate = (difficulty * Math.pow(2, 32)) / avgBlockTime;

      return hashrate > 0 ? hashrate : 0;
    } catch (error) {
      console.error('Failed to calculate hashrate:', error);
      return 0;
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
