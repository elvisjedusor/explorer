import requests
import json
from typing import Any, Optional, List, Dict


class BitokRPC:
    def __init__(self, host: str = '127.0.0.1', port: int = 8332,
                 user: str = '', password: str = ''):
        self.url = f'http://{host}:{port}/'
        self.auth = (user, password) if user and password else None
        self.headers = {'content-type': 'application/json'}
        self._id = 0

    def _call(self, method: str, params: List = None) -> Any:
        self._id += 1
        payload = {
            'jsonrpc': '1.0',
            'id': self._id,
            'method': method,
            'params': params or []
        }
        try:
            response = requests.post(
                self.url,
                data=json.dumps(payload),
                headers=self.headers,
                auth=self.auth,
                timeout=30
            )
            response.raise_for_status()
            result = response.json()
            if result.get('error'):
                raise Exception(result['error'])
            return result.get('result')
        except requests.exceptions.ConnectionError:
            raise Exception('Cannot connect to Bitok daemon')
        except requests.exceptions.Timeout:
            raise Exception('Connection to Bitok daemon timed out')

    def getinfo(self) -> Dict:
        return self._call('getinfo')

    def getblockcount(self) -> int:
        return self._call('getblockcount')

    def getblocknumber(self) -> int:
        return self._call('getblocknumber')

    def getbestblockhash(self) -> str:
        return self._call('getbestblockhash')

    def getblockhash(self, height: int) -> str:
        return self._call('getblockhash', [height])

    def getblock(self, blockhash: str) -> Dict:
        return self._call('getblock', [blockhash])

    def gettransaction(self, txid: str) -> Dict:
        return self._call('gettransaction', [txid])

    def getrawtransaction(self, txid: str, verbose: int = 1) -> Dict:
        return self._call('getrawtransaction', [txid, verbose])

    def getdifficulty(self) -> float:
        return self._call('getdifficulty')

    def getconnectioncount(self) -> int:
        return self._call('getconnectioncount')

    def getrawmempool(self) -> List[str]:
        return self._call('getrawmempool')

    def validateaddress(self, address: str) -> Dict:
        return self._call('validateaddress', [address])

    def is_connected(self) -> bool:
        try:
            self.getblockcount()
            return True
        except:
            return False
