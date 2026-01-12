export function renderBlocksList() {
  return `
    <h1 class="page-title">Blocks</h1>

    <div class="search-card">
      <input
        type="text"
        class="search-input"
        id="block-search"
        placeholder="Search by block height or hash..."
      >
      <button class="btn btn-primary" onclick="app.searchBlock()">Search</button>
    </div>

    <div class="content-card">
      <div class="card-header">
        <h2>Recent Blocks</h2>
        <span class="page-indicator">Page <span id="blocks-page-num">1</span></span>
      </div>
      <div id="blocks-list" class="blocks-table">
        <div class="loading">Loading blocks...</div>
      </div>
      <div id="blocks-pagination" class="pagination"></div>
    </div>
  `;
}

export function renderBlocksTable(blocks, app) {
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
          <th>Txs</th>
          <th>Difficulty</th>
        </tr>
      </thead>
      <tbody>
        ${blocks.map(block => `
          <tr onclick="window.location.hash = '#/block/${block.hash}'" class="clickable-row">
            <td><strong>${block.height.toLocaleString()}</strong></td>
            <td class="mono">${app.truncateHash(block.hash)}</td>
            <td>${app.formatTime(block.time)}</td>
            <td>${block.tx.length}</td>
            <td>${block.difficulty.toFixed(2)}</td>
          </tr>
        `).join('')}
      </tbody>
    </table>
  `;
}
