import time
import logging
from datetime import datetime
from typing import Optional, Dict, List
from sqlalchemy.orm import Session as DBSession
from sqlalchemy import text

from models import Block, Transaction, TxInput, TxOutput, Address, ChainState, init_db
from rpc_client import BitokRPC
from config import Config

logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

COIN = 100000000


class BlockchainSync:
    def __init__(self, rpc: BitokRPC, db_session_factory, config: Config):
        self.rpc = rpc
        self.Session = db_session_factory
        self.config = config
        self.batch_size = config.SYNC_BATCH_SIZE
        self.address_cache: Dict[str, Address] = {}
        self.output_cache: Dict[str, TxOutput] = {}

    def get_chain_state(self, session: DBSession, key: str) -> Optional[str]:
        state = session.query(ChainState).filter_by(key=key).first()
        return state.value if state else None

    def set_chain_state(self, session: DBSession, key: str, value: str):
        state = session.query(ChainState).filter_by(key=key).first()
        if state:
            state.value = value
            state.updated_at = datetime.utcnow()
        else:
            state = ChainState(key=key, value=value)
            session.add(state)

    def get_synced_height(self) -> int:
        session = self.Session()
        try:
            height = self.get_chain_state(session, 'synced_height')
            return int(height) if height else -1
        finally:
            session.close()

    def warm_output_cache(self, session: DBSession, txids: List[str]):
        if not txids:
            return
        outputs = session.query(TxOutput).filter(
            TxOutput.txid.in_(txids),
            TxOutput.spent == False
        ).all()
        for out in outputs:
            cache_key = f"{out.txid}:{out.vout}"
            self.output_cache[cache_key] = out

    def get_cached_output(self, session: DBSession, txid: str, vout: int) -> Optional[TxOutput]:
        cache_key = f"{txid}:{vout}"
        if cache_key in self.output_cache:
            return self.output_cache[cache_key]

        output = session.query(TxOutput).filter_by(txid=txid, vout=vout).first()
        if output:
            self.output_cache[cache_key] = output
        return output

    def get_or_create_address(self, session: DBSession, address: str, block_height: int) -> Address:
        if address in self.address_cache:
            return self.address_cache[address]

        addr = session.query(Address).filter_by(address=address).first()
        if not addr:
            addr = Address(
                address=address,
                total_received=0,
                total_sent=0,
                balance=0,
                tx_count=0,
                first_seen_block=block_height,
                last_seen_block=block_height
            )
            session.add(addr)
            session.flush()

        self.address_cache[address] = addr
        return addr

    def sync_block(self, session: DBSession, height: int) -> bool:
        try:
            blockhash = self.rpc.getblockhash(height)
            block_data = self.rpc.getblock(blockhash)

            block = Block(
                hash=block_data['hash'],
                height=block_data['height'],
                version=block_data['version'],
                prev_hash=block_data.get('previousblockhash', '0' * 64),
                merkle_root=block_data['merkleroot'],
                timestamp=block_data['time'],
                bits=block_data['bits'],
                nonce=block_data['nonce'],
                tx_count=len(block_data.get('tx', []))
            )
            session.add(block)
            session.flush()

            txids = block_data.get('tx', [])
            prev_txids = []

            for txid in txids:
                try:
                    tx_data = self.rpc.getrawtransaction(txid, 1)
                    if 'vin' in tx_data:
                        for vin in tx_data['vin']:
                            if vin.get('txid'):
                                prev_txids.append(vin['txid'])
                except:
                    pass

            self.warm_output_cache(session, prev_txids)

            total_block_value = 0
            for txid in txids:
                tx_value = self.sync_transaction(session, txid, block)
                total_block_value += tx_value

            block.total_value = total_block_value
            return True

        except Exception as e:
            logger.error(f'Error syncing block {height}: {e}')
            return False

    def sync_transaction(self, session: DBSession, txid: str, block: Block) -> int:
        try:
            tx_data = self.rpc.getrawtransaction(txid, 1)
        except:
            try:
                tx_data = self.rpc.gettransaction(txid)
            except:
                logger.warning(f'Could not fetch transaction {txid}')
                return 0

        is_coinbase = False
        if 'vin' in tx_data and tx_data['vin']:
            first_input = tx_data['vin'][0]
            is_coinbase = 'coinbase' in first_input

        tx = Transaction(
            txid=tx_data.get('txid', txid),
            block_id=block.id,
            block_hash=block.hash,
            block_height=block.height,
            version=tx_data.get('version', 1),
            locktime=tx_data.get('locktime', 0),
            is_coinbase=is_coinbase
        )
        session.add(tx)
        session.flush()

        total_input = 0
        total_output = 0

        if 'vin' in tx_data:
            for vin in tx_data['vin']:
                tx_input = TxInput(
                    tx_id=tx.id,
                    txid=tx.txid,
                    prev_txid=vin.get('txid'),
                    prev_vout=vin.get('vout'),
                    coinbase=vin.get('coinbase'),
                    script_sig=vin.get('scriptSig'),
                    sequence=vin.get('sequence', 0xFFFFFFFF)
                )
                session.add(tx_input)

                if not is_coinbase and vin.get('txid'):
                    prev_output = self.get_cached_output(session, vin['txid'], vin['vout'])
                    if prev_output:
                        total_input += prev_output.value
                        prev_output.spent = True
                        prev_output.spent_by_txid = tx.txid

                        if prev_output.address:
                            addr = self.get_or_create_address(session, prev_output.address, block.height)
                            addr.total_sent += prev_output.value
                            addr.balance -= prev_output.value
                            addr.tx_count += 1
                            addr.last_seen_block = block.height

        if 'vout' in tx_data:
            for vout in tx_data['vout']:
                value_btc = vout.get('value', 0)
                value_satoshi = int(value_btc * COIN)
                total_output += value_satoshi

                address = vout.get('address')

                tx_output = TxOutput(
                    tx_id=tx.id,
                    txid=tx.txid,
                    vout=vout.get('n', 0),
                    value=value_satoshi,
                    address=address,
                    script_pubkey=vout.get('scriptPubKey')
                )
                session.add(tx_output)

                cache_key = f"{tx.txid}:{vout.get('n', 0)}"
                self.output_cache[cache_key] = tx_output

                if address:
                    addr = self.get_or_create_address(session, address, block.height)
                    addr.total_received += value_satoshi
                    addr.balance += value_satoshi
                    addr.tx_count += 1
                    addr.last_seen_block = block.height

        tx.total_input = total_input
        tx.total_output = total_output
        tx.fee = max(0, total_input - total_output) if not is_coinbase else 0

        return total_output

    def clear_caches(self):
        self.address_cache.clear()
        self.output_cache.clear()

    def sync(self, target_height: Optional[int] = None):
        if not self.rpc.is_connected():
            logger.error('Cannot connect to Bitok daemon')
            return False

        chain_height = self.rpc.getblocknumber()
        if target_height is not None:
            chain_height = min(chain_height, target_height)

        synced_height = self.get_synced_height()
        logger.info(f'Chain height: {chain_height}, Synced height: {synced_height}')

        if synced_height >= chain_height:
            logger.info('Already synced')
            return True

        session = self.Session()
        try:
            blocks_synced = 0
            for height in range(synced_height + 1, chain_height + 1):
                if not self.sync_block(session, height):
                    session.rollback()
                    self.clear_caches()
                    return False

                blocks_synced += 1

                if blocks_synced % self.batch_size == 0:
                    session.commit()
                    self.set_chain_state(session, 'synced_height', str(height))
                    session.commit()
                    logger.info(f'Synced to block {height}/{chain_height} ({blocks_synced} blocks)')
                    self.clear_caches()

            session.commit()
            self.set_chain_state(session, 'synced_height', str(chain_height))
            session.commit()
            logger.info(f'Sync complete at block {chain_height}')
            return True

        except Exception as e:
            logger.error(f'Sync error: {e}')
            session.rollback()
            return False
        finally:
            self.clear_caches()
            session.close()

    def run_continuous(self, interval: int = 10):
        logger.info('Starting continuous sync...')
        while True:
            try:
                self.sync()
            except KeyboardInterrupt:
                logger.info('Stopping sync...')
                break
            except Exception as e:
                logger.error(f'Sync error: {e}')

            time.sleep(interval)


def main():
    config = Config()
    engine, Session = init_db(
        config.DATABASE_URL,
        pool_size=config.DB_POOL_SIZE,
        max_overflow=config.DB_MAX_OVERFLOW,
        pool_timeout=config.DB_POOL_TIMEOUT,
        pool_recycle=config.DB_POOL_RECYCLE
    )

    rpc = BitokRPC(
        host=config.RPC_HOST,
        port=config.RPC_PORT,
        user=config.RPC_USER,
        password=config.RPC_PASSWORD
    )

    syncer = BlockchainSync(rpc, Session, config)

    import sys
    if len(sys.argv) > 1 and sys.argv[1] == '--once':
        syncer.sync()
    else:
        syncer.run_continuous(interval=config.SYNC_INTERVAL)


if __name__ == '__main__':
    main()
