class BitokRPC {
  constructor(url = 'http://127.0.0.1:8332/', username = '', password = '') {
    this.url = url;
    this.auth = btoa(`${username}:${password}`);
    this.id = 0;
  }

  async call(method, params = []) {
    this.id++;

    try {
      const response = await fetch(this.url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Basic ${this.auth}`
        },
        body: JSON.stringify({
          jsonrpc: '1.0',
          id: this.id,
          method: method,
          params: params
        })
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const data = await response.json();

      if (data.error) {
        throw new Error(data.error.message || 'RPC Error');
      }

      return data.result;
    } catch (error) {
      console.error(`RPC call ${method} failed:`, error);
      throw error;
    }
  }

  async getInfo() {
    return await this.call('getinfo');
  }

  async getBlockCount() {
    return await this.call('getblockcount');
  }

  async getBestBlockHash() {
    return await this.call('getbestblockhash');
  }

  async getBlockHash(height) {
    return await this.call('getblockhash', [height]);
  }

  async getBlock(hash) {
    return await this.call('getblock', [hash]);
  }

  async getTransaction(txid) {
    return await this.call('gettransaction', [txid]);
  }

  async getRawTransaction(txid, verbose = true) {
    return await this.call('getrawtransaction', [txid, verbose ? 1 : 0]);
  }

  async getRawMempool() {
    return await this.call('getrawmempool');
  }

  async validateAddress(address) {
    return await this.call('validateaddress', [address]);
  }

  async getConnectionCount() {
    return await this.call('getconnectioncount');
  }

  async getPeerInfo() {
    return await this.call('getpeerinfo');
  }

  async getDifficulty() {
    return await this.call('getdifficulty');
  }

  async getBalance() {
    return await this.call('getbalance');
  }

  async getNewAddress(label = '') {
    return await this.call('getnewaddress', label ? [label] : []);
  }

  async setLabel(address, label) {
    return await this.call('setlabel', [address, label]);
  }

  async getLabel(address) {
    return await this.call('getlabel', [address]);
  }

  async getAddressesByLabel(label) {
    return await this.call('getaddressesbylabel', [label]);
  }

  async sendToAddress(address, amount, comment = '', commentTo = '') {
    const params = [address, amount];
    if (comment) params.push(comment);
    if (commentTo) params.push(commentTo);
    return await this.call('sendtoaddress', params);
  }

  async listTransactions(count = 10, includeGenerated = false) {
    return await this.call('listtransactions', [count, includeGenerated]);
  }

  async listUnspent(minconf = 1, maxconf = 999999) {
    return await this.call('listunspent', [minconf, maxconf]);
  }

  async getReceivedByAddress(address, minconf = 1) {
    return await this.call('getreceivedbyaddress', [address, minconf]);
  }

  async listReceivedByAddress(minconf = 0, includeEmpty = true) {
    return await this.call('listreceivedbyaddress', [minconf, includeEmpty]);
  }

  async getGenerate() {
    return await this.call('getgenerate');
  }

  async setGenerate(generate, genproclimit = -1) {
    return await this.call('setgenerate', [generate, genproclimit]);
  }
}

export default BitokRPC;
