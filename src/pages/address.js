export function renderAddressDetail(address, data, app) {
  const { isWalletAddress, balance, received0, received6, utxos } = data;

  return `
    <div class="breadcrumb">
      Address
    </div>

    <div class="detail-card">
      <div class="detail-header">
        <h1>Address</h1>
      </div>

      ${!isWalletAddress ? `
        <div class="info-box warning">
          <strong>🔒 Not In Wallet</strong>
          <p>This address is not in the connected wallet. You can see the total received, but balance and UTXO details are only available for your own addresses.</p>
          <p>This is Bitcoin v0.3.19 behavior. It's not a limitation - it's privacy by design.</p>
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
              <tr class="clickable-row" onclick="window.location.hash = '#/tx/${utxo.txid}'">
                <td class="mono">${app.truncateHash(utxo.txid)}</td>
                <td>${utxo.vout}</td>
                <td>${utxo.confirmations}</td>
                <td class="amount">${utxo.amount.toFixed(8)} BITOK</td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      ` : (isWalletAddress ? '<p class="empty-state-text">No unspent outputs</p>' : '')}
    </div>

    ${!isWalletAddress ? `
      <div class="info-card">
        <h3>Why Limited Information?</h3>
        <p>In Bitcoin v0.3.19, you can only see full details (balance, UTXOs) for addresses in your own wallet.</p>
        <p>For any address, you CAN see the total received - this data is public and stored in the blockchain.</p>
        <p>But to see the current balance and unspent outputs, the address must be yours. This prevents easy surveillance of other users' holdings.</p>
        <p><strong>This is intentional.</strong> Satoshi didn't want nodes to be surveillance tools.</p>
      </div>
    ` : ''}
  `;
}

export function renderAddressInvalid() {
  return `
    <div class="breadcrumb">
      Address
    </div>

    <div class="message message-error">
      <strong>Invalid Address</strong>
      <p>This doesn't look like a valid Bitok address.</p>
    </div>
  `;
}
