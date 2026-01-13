#!/usr/bin/env python3
"""Quick script to check RPC values for debugging"""

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
