export function renderTransactionDetail(tx, app) {
  return `
    <div class="breadcrumb">
      ${tx.blockhash ? `<a href="#/block/${tx.blockhash}">Block</a> › ` : ''}Transaction
    </div>

    <div class="detail-card">
      <div class="detail-header">
        <h1>Transaction</h1>
      </div>

      <div class="detail-grid">
        <div class="detail-row full">
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
        <div class="detail-row full">
          <div class="detail-label">Block Hash</div>
          <div class="detail-value mono link" onclick="window.location.hash = '#/block/${tx.blockhash}'">${app.truncateHash(tx.blockhash)}</div>
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
                <td class="mono link" onclick="window.location.hash = '#/address/${detail.address}'">${detail.address || 'N/A'}</td>
                <td class="amount">${detail.amount.toFixed(8)} BITOK</td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      ` : ''}
    </div>
  `;
}

export function renderTransactionNotFound() {
  return `
    <div class="breadcrumb">
      Transaction
    </div>

    <div class="message message-error">
      <strong>Transaction Not In Wallet</strong>
      <p>This node can only look up transactions that are in its wallet. This is Bitcoin v0.3.19 behavior.</p>
    </div>

    <div class="info-card">
      <h3>Why Can't I See This Transaction?</h3>
      <p>Bitcoin v0.3.19 doesn't index every transaction on the blockchain. It only tracks transactions in your wallet.</p>
      <p><strong>This is not a bug. It's the original design.</strong></p>
      <p>To query any transaction, you'd need to:</p>
      <ol>
        <li>Scan every block from genesis</li>
        <li>Build a complete transaction index</li>
        <li>Store terabytes of data</li>
      </ol>
      <p>Modern explorers do this. The original Bitcoin node doesn't. We're running the original node.</p>
      <p>Satoshi didn't build a surveillance system. He built peer-to-peer electronic cash.</p>
    </div>

    <div class="content-card">
      <h3>What You CAN Look Up</h3>
      <ul class="feature-list">
        <li>Any block by height or hash</li>
        <li>Transactions in your own wallet</li>
        <li>Your own addresses and balances</li>
        <li>Total received for any address</li>
      </ul>
    </div>
  `;
}
