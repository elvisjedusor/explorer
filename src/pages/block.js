export function renderBlockDetail(block, height, app) {
  return `
    <div class="breadcrumb">
      <a href="#/blocks">Blocks</a> › Block ${parseInt(height).toLocaleString()}
    </div>

    <div class="detail-card">
      <div class="detail-header">
        <h1>Block ${parseInt(height).toLocaleString()}</h1>
        <a href="#/blocks" class="btn btn-secondary">Back to Blocks</a>
      </div>

      <div class="detail-grid">
        <div class="detail-row full">
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
        <div class="detail-row">
          <div class="detail-label">Transactions</div>
          <div class="detail-value">${block.tx.length}</div>
        </div>
        ${block.previousblockhash ? `
        <div class="detail-row full">
          <div class="detail-label">Previous Block</div>
          <div class="detail-value mono link" onclick="window.location.hash = '#/block/${block.previousblockhash}'">${app.truncateHash(block.previousblockhash)}</div>
        </div>
        ` : '<div class="detail-row full"><div class="detail-label">Previous Block</div><div class="detail-value">Genesis Block</div></div>'}
        <div class="detail-row full">
          <div class="detail-label">Merkle Root</div>
          <div class="detail-value mono">${block.merkleroot}</div>
        </div>
      </div>

      <h3>Transactions (${block.tx.length})</h3>
      <div class="transactions-list">
        ${block.tx.map((txid, idx) => `
          <div class="tx-row" onclick="window.location.hash = '#/tx/${txid}'">
            <span class="tx-index">${idx === 0 ? 'Coinbase' : `TX ${idx}`}</span>
            <span class="tx-hash mono">${app.truncateHash(txid)}</span>
          </div>
        `).join('')}
      </div>
    </div>
  `;
}
