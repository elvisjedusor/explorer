from datetime import datetime, timezone
from sqlalchemy import (
    create_engine, Column, Integer, BigInteger, String, Float,
    DateTime, Text, ForeignKey, Index, Boolean, event
)
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker, relationship
from sqlalchemy.pool import QueuePool

Base = declarative_base()


class Block(Base):
    __tablename__ = 'blocks'

    id = Column(Integer, primary_key=True)
    hash = Column(String(64), unique=True, nullable=False)
    height = Column(Integer, unique=True, nullable=False)
    version = Column(Integer)
    prev_hash = Column(String(64))
    merkle_root = Column(String(64))
    timestamp = Column(Integer)
    bits = Column(BigInteger)
    nonce = Column(BigInteger)
    tx_count = Column(Integer, default=0)
    total_value = Column(BigInteger, default=0)
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))

    transactions = relationship('Transaction', back_populates='block', lazy='dynamic')

    __table_args__ = (
        Index('idx_block_hash', 'hash'),
        Index('idx_block_height', 'height'),
        Index('idx_block_timestamp', 'timestamp'),
        Index('idx_block_prev_hash', 'prev_hash'),
    )


class Transaction(Base):
    __tablename__ = 'transactions'

    id = Column(Integer, primary_key=True)
    txid = Column(String(64), unique=True, nullable=False)
    block_id = Column(Integer, ForeignKey('blocks.id', ondelete='CASCADE'))
    block_hash = Column(String(64))
    block_height = Column(Integer)
    version = Column(Integer)
    locktime = Column(BigInteger, default=0)
    is_coinbase = Column(Boolean, default=False)
    total_input = Column(BigInteger, default=0)
    total_output = Column(BigInteger, default=0)
    fee = Column(BigInteger, default=0)
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))

    block = relationship('Block', back_populates='transactions')
    inputs = relationship('TxInput', back_populates='transaction', lazy='dynamic',
                         cascade='all, delete-orphan')
    outputs = relationship('TxOutput', back_populates='transaction', lazy='dynamic',
                          cascade='all, delete-orphan')

    __table_args__ = (
        Index('idx_tx_txid', 'txid'),
        Index('idx_tx_block_id', 'block_id'),
        Index('idx_tx_block_hash', 'block_hash'),
        Index('idx_tx_block_height', 'block_height'),
    )


class TxInput(Base):
    __tablename__ = 'tx_inputs'

    id = Column(Integer, primary_key=True)
    tx_id = Column(Integer, ForeignKey('transactions.id', ondelete='CASCADE'))
    txid = Column(String(64))
    prev_txid = Column(String(64))
    prev_vout = Column(Integer)
    coinbase = Column(Text)
    script_sig = Column(Text)
    sequence = Column(BigInteger)

    transaction = relationship('Transaction', back_populates='inputs')

    __table_args__ = (
        Index('idx_input_tx_id', 'tx_id'),
        Index('idx_input_txid', 'txid'),
        Index('idx_input_prev_txid', 'prev_txid'),
        Index('idx_input_prev_txid_vout', 'prev_txid', 'prev_vout'),
    )


class TxOutput(Base):
    __tablename__ = 'tx_outputs'

    id = Column(Integer, primary_key=True)
    tx_id = Column(Integer, ForeignKey('transactions.id', ondelete='CASCADE'))
    txid = Column(String(64))
    vout = Column(Integer)
    value = Column(BigInteger)
    address = Column(String(64))
    script_pubkey = Column(Text)
    script_type = Column(String(32))
    spent = Column(Boolean, default=False)
    spent_by_txid = Column(String(64))

    transaction = relationship('Transaction', back_populates='outputs')

    __table_args__ = (
        Index('idx_output_tx_id', 'tx_id'),
        Index('idx_output_txid', 'txid'),
        Index('idx_output_address', 'address'),
        Index('idx_output_txid_vout', 'txid', 'vout'),
        Index('idx_output_spent', 'spent'),
        Index('idx_output_address_spent', 'address', 'spent'),
    )


class Address(Base):
    __tablename__ = 'addresses'

    id = Column(Integer, primary_key=True)
    address = Column(String(64), unique=True, nullable=False)
    total_received = Column(BigInteger, default=0)
    total_sent = Column(BigInteger, default=0)
    balance = Column(BigInteger, default=0)
    tx_count = Column(Integer, default=0)
    first_seen_block = Column(Integer)
    last_seen_block = Column(Integer)
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))
    updated_at = Column(DateTime, default=lambda: datetime.now(timezone.utc), onupdate=lambda: datetime.now(timezone.utc))

    __table_args__ = (
        Index('idx_address_address', 'address'),
        Index('idx_address_balance', 'balance'),
        Index('idx_address_tx_count', 'tx_count'),
    )


class ChainState(Base):
    __tablename__ = 'chain_state'

    id = Column(Integer, primary_key=True)
    key = Column(String(64), unique=True, nullable=False)
    value = Column(Text)
    updated_at = Column(DateTime, default=lambda: datetime.now(timezone.utc), onupdate=lambda: datetime.now(timezone.utc))

    __table_args__ = (
        Index('idx_chain_state_key', 'key'),
    )


def _run_migrations(engine):
    from sqlalchemy import inspect, text as sql_text
    inspector = inspect(engine)
    if 'tx_outputs' in inspector.get_table_names():
        columns = [c['name'] for c in inspector.get_columns('tx_outputs')]
        if 'script_type' not in columns:
            with engine.connect() as conn:
                conn.execute(sql_text(
                    "ALTER TABLE tx_outputs ADD COLUMN script_type VARCHAR(32)"
                ))
                conn.commit()


def init_db(database_url: str, pool_size: int = 10, max_overflow: int = 20,
            pool_timeout: int = 30, pool_recycle: int = 1800):
    engine_kwargs = {
        'echo': False,
        'pool_pre_ping': True,
    }

    if database_url.startswith('postgresql'):
        engine_kwargs.update({
            'poolclass': QueuePool,
            'pool_size': pool_size,
            'max_overflow': max_overflow,
            'pool_timeout': pool_timeout,
            'pool_recycle': pool_recycle,
        })

    engine = create_engine(database_url, **engine_kwargs)
    Base.metadata.create_all(engine)
    try:
        _run_migrations(engine)
    except Exception:
        pass
    Session = sessionmaker(bind=engine)
    return engine, Session


def get_engine_for_bulk(database_url: str):
    return create_engine(
        database_url,
        echo=False,
        pool_pre_ping=True,
        executemany_mode='values_plus_batch'
    )
