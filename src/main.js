import './style.css';
import BitokRPC from './bitokRpc.js';
import { RPC_CONFIG } from './config.js';
import { renderHome } from './pages/home.js';
import { renderBlocksList, renderBlocksTable } from './pages/blocks.js';
import { renderBlockDetail } from './pages/block.js';
import { renderTransactionDetail, renderTransactionNotFound } from './pages/transaction.js';
import { renderAddressDetail, renderAddressInvalid } from './pages/address.js';

class BitokExplorer {
  constructor() {
    this.rpc = new BitokRPC(RPC_CONFIG.url, RPC_CONFIG.username, RPC_CONFIG.password);
    this.blocksPage = 1;
    this.blocksPerPage = 20;
    this.maxBlocks = 0;
    this.networkInfo = null;
    this.init();
  }

  async init() {
    await this.loadNetworkInfo();
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

  async handleRoute() {
    const hash = window.location.hash.slice(1) || '/';
    const parts = hash.split('/').filter(p => p);
    const route = parts[0] || 'home';
    const param = parts[1];

    this.updateActiveNav(route);

    const container = document.getElementById('page-container');
    if (!container) return;

    switch (route) {
      case 'home':
      case '':
        container.innerHTML = renderHome();
        document.title = 'Bitok Explorer';
        break;

      case 'blocks':
        container.innerHTML = renderBlocksList();
        document.title = 'Blocks - Bitok Explorer';
        await this.loadBlocksPage();
        this.setupBlocksSearch();
        break;

      case 'block':
        if (param) {
          document.title = 'Block - Bitok Explorer';
          await this.showBlockPage(param);
        } else {
          window.location.hash = '#/blocks';
        }
        break;

      case 'tx':
        if (param) {
          document.title = 'Transaction - Bitok Explorer';
          await this.showTransactionPage(param);
        } else {
          container.innerHTML = '<div class="message message-error">No transaction ID provided</div>';
        }
        break;

      case 'address':
        if (param) {
          document.title = 'Address - Bitok Explorer';
          await this.showAddressPage(param);
        } else {
          container.innerHTML = '<div class="message message-error">No address provided</div>';
        }
        break;

      default:
        container.innerHTML = '<div class="message message-error">Page not found</div>';
    }
  }

  updateActiveNav(route) {
    document.querySelectorAll('.nav-link').forEach(link => {
      link.classList.remove('active');
    });

    if (route === 'home' || route === '') {
      document.querySelector('a[href="#/"]')?.classList.add('active');
    } else if (route === 'blocks' || route === 'block') {
      document.querySelector('a[href="#/blocks"]')?.classList.add('active');
    }
  }

  setupBlocksSearch() {
    const input = document.getElementById('block-search');
    if (input) {
      input.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') this.searchBlock();
      });
    }
  }

  async searchBlock() {
    const input = document.getElementById('block-search');
    const query = input?.value.trim();

    if (!query) return;

    if (/^\d+$/.test(query)) {
      const height = parseInt(query);
      try {
        const hash = await this.rpc.getBlockHash(height);
        window.location.hash = `#/block/${hash}`;
      } catch (error) {
        alert('Block not found');
      }
    } else if (/^[0-9a-fA-F]{64}$/.test(query)) {
      window.location.hash = `#/block/${query}`;
    } else {
      alert('Invalid block height or hash');
    }
  }

  async loadBlocksPage() {
    const container = document.getElementById('blocks-list');
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

      container.innerHTML = renderBlocksTable(blocks, this);
      this.updateBlocksPagination();
    } catch (error) {
      container.innerHTML = '<div class="message message-error">Error loading blocks</div>';
    }
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

  async showBlockPage(hashOrHeight) {
    const container = document.getElementById('page-container');
    container.innerHTML = '<div class="loading">Loading block...</div>';

    try {
      let hash = hashOrHeight;
      let height = hashOrHeight;

      if (/^\d+$/.test(hashOrHeight)) {
        hash = await this.rpc.getBlockHash(parseInt(hashOrHeight));
      } else {
        height = await this.getBlockHeight(hash);
      }

      const block = await this.rpc.getBlock(hash);
      container.innerHTML = renderBlockDetail(block, height, this);
    } catch (error) {
      container.innerHTML = '<div class="message message-error">Block not found</div>';
    }
  }

  async showTransactionPage(txid) {
    const container = document.getElementById('page-container');
    container.innerHTML = '<div class="loading">Loading transaction...</div>';

    try {
      const tx = await this.rpc.getTransaction(txid);
      container.innerHTML = renderTransactionDetail(tx, this);
    } catch (error) {
      container.innerHTML = renderTransactionNotFound();
    }
  }

  async showAddressPage(address) {
    const container = document.getElementById('page-container');
    container.innerHTML = '<div class="loading">Loading address...</div>';

    try {
      const validation = await this.rpc.validateAddress(address);
      if (!validation.isvalid) {
        container.innerHTML = renderAddressInvalid();
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

      const data = { isWalletAddress, balance, received0, received6, utxos };
      container.innerHTML = renderAddressDetail(address, data, this);
    } catch (error) {
      container.innerHTML = '<div class="message message-error">Error loading address</div>';
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
