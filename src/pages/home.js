export function renderHome() {
  return `
    <div class="hero-section">
      <h1>Bitok Block Explorer</h1>
      <p class="hero-subtitle">Browse the blockchain. Search blocks, transactions, addresses.</p>
    </div>

    <div class="content-card">
      <h2>What You're Looking At</h2>
      <p>This is Bitcoin v0.3.19 - the last version Satoshi worked on - with SHA-256 swapped for Yespower.</p>
      <p>New genesis block. Separate network. Same rules otherwise.</p>
    </div>

    <div class="content-card">
      <h2>Why This Exists</h2>
      <p>In 2010, Satoshi wrote: <em>"It's nice how anyone with just a CPU can compete fairly equally right now."</em></p>
      <p>Then GPUs happened. Then ASICs. That stopped being true.</p>
      <p>Yespower is memory-hard. GPUs don't get 1000x advantage. More like 2x, if that. Your laptop can mine this.</p>
    </div>

    <div class="content-card">
      <h2>Specifications</h2>
      <div class="specs-grid">
        <div class="spec-item">
          <div class="spec-label">Algorithm</div>
          <div class="spec-value">Yespower 1.0</div>
        </div>
        <div class="spec-item">
          <div class="spec-label">Block Time</div>
          <div class="spec-value">10 minutes</div>
        </div>
        <div class="spec-item">
          <div class="spec-label">Block Reward</div>
          <div class="spec-value">50 BITOK</div>
        </div>
        <div class="spec-item">
          <div class="spec-label">Max Supply</div>
          <div class="spec-value">21,000,000</div>
        </div>
        <div class="spec-item">
          <div class="spec-label">Difficulty Adjust</div>
          <div class="spec-value">Every 2016 blocks</div>
        </div>
        <div class="spec-item">
          <div class="spec-label">P2P Port</div>
          <div class="spec-value">18333</div>
        </div>
      </div>
    </div>

    <div class="content-card">
      <h2>How This Explorer Works</h2>
      <p><strong>What you CAN query:</strong></p>
      <ul class="feature-list">
        <li>All blocks by height or hash</li>
        <li>Transactions in your wallet</li>
        <li>Your own addresses (balance, UTXOs, history)</li>
        <li>Any address's total received amount</li>
        <li>Network stats (hashrate, difficulty, peers)</li>
      </ul>

      <p><strong>What you CANNOT query:</strong></p>
      <ul class="feature-list">
        <li>Other people's transaction details</li>
        <li>Other people's balances and UTXOs</li>
        <li>Full transaction history for addresses not in your wallet</li>
      </ul>

      <p><strong>Why?</strong> This is not a limitation. It's the original design.</p>
      <p>Bitcoin v0.3.19 doesn't index every address. It tracks what's in YOUR wallet. That's it. Privacy by design.</p>
      <p>Modern explorers build massive databases that scan every block. That's not part of the node software. We're running the actual node, so we see what the node sees.</p>
    </div>

    <div class="content-card">
      <h2>Links</h2>
      <div class="links-grid">
        <a href="https://github.com/elvisjedusor/bitok" target="_blank" class="link-button">
          <span class="link-icon">📦</span>
          <span>Source Code</span>
        </a>
        <a href="https://bitcointalk.org/index.php?topic=5571165.0" target="_blank" class="link-button">
          <span class="link-icon">💬</span>
          <span>Bitcointalk Thread</span>
        </a>
        <a href="https://bitcoin.org/bitcoin.pdf" target="_blank" class="link-button">
          <span class="link-icon">📄</span>
          <span>Bitcoin Whitepaper</span>
        </a>
        <a href="#/blocks" class="link-button">
          <span class="link-icon">⛏️</span>
          <span>Browse Blocks</span>
        </a>
      </div>
    </div>

    <div class="info-card">
      <h3>About Privacy</h3>
      <p>If you try to look up a transaction or address that isn't in the connected wallet, you'll get an error. This is intentional.</p>
      <p>Satoshi designed Bitcoin so nodes don't track everyone's balances. They validate transactions and manage their own wallet. That's it.</p>
      <p>This explorer respects that design. If you want a surveillance system, there are plenty of those already.</p>
    </div>
  `;
}
