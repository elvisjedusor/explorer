#!/usr/bin/env python3
"""Quick script to check RPC values for debugging"""

import sys
import json
from rpc_client import BitokRPC
from config import Config

config = Config()
rpc = BitokRPC(
    host=config.RPC_HOST,
    port=config.RPC_PORT,
    user=config.RPC_USER,
    password=config.RPC_PASSWORD
)

print("Checking Bitok RPC...")
print("-" * 50)

try:
    info = rpc.getinfo()
    print(f"getinfo() blocks: {info.get('blocks')}")
    print(f"getinfo() difficulty: {info.get('difficulty')}")
    print(f"getinfo() connections: {info.get('connections')}")
except Exception as e:
    print(f"getinfo() error: {e}")

try:
    blockcount = rpc.getblockcount()
    print(f"getblockcount(): {blockcount}")
except Exception as e:
    print(f"getblockcount() error: {e}")

try:
    blocknumber = rpc.getblocknumber()
    print(f"getblocknumber(): {blocknumber}")
except Exception as e:
    print(f"getblocknumber() error: {e}")

try:
    besthash = rpc.getbestblockhash()
    print(f"getbestblockhash(): {besthash}")

    bestblock = rpc.getblock(besthash)
    print(f"Best block height: {bestblock.get('height')}")
except Exception as e:
    print(f"getbestblockhash() error: {e}")

print("-" * 50)

# Check database sync status
from models import init_db, ChainState, Block
from sqlalchemy import desc

engine, SessionFactory = init_db(config.DATABASE_URL)
session = SessionFactory()

try:
    synced_height = session.query(ChainState).filter_by(key='synced_height').first()
    print(f"DB synced_height: {synced_height.value if synced_height else 'None'}")

    latest_block = session.query(Block).order_by(desc(Block.height)).first()
    print(f"DB latest block height: {latest_block.height if latest_block else 'None'}")

    total_blocks = session.query(Block).count()
    print(f"DB total blocks: {total_blocks}")
finally:
    session.close()

print("-" * 50)
print("Checking coinbase transaction format...")

try:
    blockhash = rpc.getblockhash(1)
    block = rpc.getblock(blockhash)
    print(f"Block 1 hash: {blockhash}")
    print(f"Block 1 txs: {block.get('tx', [])}")

    if block.get('tx'):
        txid = block['tx'][0]
        print(f"\nCoinbase txid: {txid}")
        tx = rpc.getrawtransaction(txid, 1)
        print(f"\nFull transaction response:")
        print(json.dumps(tx, indent=2))

        if 'vout' in tx:
            print(f"\nOutputs (vout):")
            for i, vout in enumerate(tx['vout']):
                print(f"  vout[{i}]: {json.dumps(vout)}")
                if 'address' in vout:
                    print(f"    -> ADDRESS FOUND: {vout['address']}")
                else:
                    print(f"    -> NO ADDRESS FIELD!")
except Exception as e:
    print(f"Error checking coinbase tx: {e}")

print("-" * 50)
print("Checking address database...")

from models import Address, TxOutput

session = SessionFactory()
try:
    total_addresses = session.query(Address).count()
    print(f"Total addresses in DB: {total_addresses}")

    top_addresses = session.query(Address).order_by(desc(Address.balance)).limit(5).all()
    print(f"\nTop 5 addresses by balance:")
    for addr in top_addresses:
        print(f"  {addr.address}: {addr.balance / 100000000:.8f} (received: {addr.total_received / 100000000:.8f})")

    outputs_with_address = session.query(TxOutput).filter(TxOutput.address != None).count()
    outputs_without_address = session.query(TxOutput).filter(TxOutput.address == None).count()
    print(f"\nOutputs with address: {outputs_with_address}")
    print(f"Outputs without address: {outputs_without_address}")

    if len(sys.argv) > 1:
        check_addr = sys.argv[1]
        print(f"\nChecking specific address: {check_addr}")
        addr = session.query(Address).filter_by(address=check_addr).first()
        if addr:
            print(f"  Found in DB: balance={addr.balance / 100000000:.8f}")
        else:
            print(f"  NOT FOUND in addresses table")

        outputs = session.query(TxOutput).filter_by(address=check_addr).all()
        print(f"  Outputs for this address: {len(outputs)}")
        for out in outputs[:5]:
            print(f"    txid={out.txid[:16]}... vout={out.vout} value={out.value / 100000000:.8f} spent={out.spent}")
finally:
    session.close()
