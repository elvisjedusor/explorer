#!/usr/bin/env python3
"""Check database for data issues"""

from models import init_db, Block
from config import Config
from sqlalchemy import desc

config = Config()
engine, SessionFactory = init_db(config.DATABASE_URL)
session = SessionFactory()

print("Checking database for data issues...")
print("-" * 50)

try:
    # Check for blocks with NULL values
    print("\nBlocks with NULL total_value:")
    null_value_blocks = session.query(Block).filter(Block.total_value == None).limit(5).all()
    for b in null_value_blocks:
        print(f"  Height {b.height}: hash={b.hash[:16]}..., tx_count={b.tx_count}, total_value={b.total_value}")

    print(f"\nTotal blocks with NULL total_value: {session.query(Block).filter(Block.total_value == None).count()}")

    print("\nBlocks with NULL tx_count:")
    null_count_blocks = session.query(Block).filter(Block.tx_count == None).limit(5).all()
    for b in null_count_blocks:
        print(f"  Height {b.height}: hash={b.hash[:16]}..., tx_count={b.tx_count}, total_value={b.total_value}")

    print(f"\nTotal blocks with NULL tx_count: {session.query(Block).filter(Block.tx_count == None).count()}")

    print("\nBlocks with NULL timestamp:")
    null_ts_blocks = session.query(Block).filter(Block.timestamp == None).limit(5).all()
    for b in null_ts_blocks:
        print(f"  Height {b.height}: hash={b.hash[:16]}..., timestamp={b.timestamp}")

    print(f"\nTotal blocks with NULL timestamp: {session.query(Block).filter(Block.timestamp == None).count()}")

    # Check recent blocks
    print("\n\nRecent blocks (top 5):")
    recent_blocks = session.query(Block).order_by(desc(Block.height)).limit(5).all()
    for b in recent_blocks:
        print(f"  Height {b.height}:")
        print(f"    hash: {b.hash}")
        print(f"    tx_count: {b.tx_count}")
        print(f"    total_value: {b.total_value}")
        print(f"    timestamp: {b.timestamp}")
        print()

finally:
    session.close()

print("-" * 50)
