import os


class Config:
    RPC_HOST = os.environ.get('BITOK_RPC_HOST', '127.0.0.1')
    RPC_PORT = int(os.environ.get('BITOK_RPC_PORT', 8332))
    RPC_USER = os.environ.get('BITOK_RPC_USER', '')
    RPC_PASSWORD = os.environ.get('BITOK_RPC_PASSWORD', '')

    DATABASE_URL = os.environ.get(
        'DATABASE_URL',
        'postgresql://bitok:bitok@localhost:5432/bitok_explorer'
    )

    DB_POOL_SIZE = int(os.environ.get('DB_POOL_SIZE', 10))
    DB_MAX_OVERFLOW = int(os.environ.get('DB_MAX_OVERFLOW', 20))
    DB_POOL_TIMEOUT = int(os.environ.get('DB_POOL_TIMEOUT', 30))
    DB_POOL_RECYCLE = int(os.environ.get('DB_POOL_RECYCLE', 1800))

    SECRET_KEY = os.environ.get('SECRET_KEY', 'change-this-secret-key')

    SYNC_INTERVAL = int(os.environ.get('SYNC_INTERVAL', 10))
    SYNC_BATCH_SIZE = int(os.environ.get('SYNC_BATCH_SIZE', 100))

    ITEMS_PER_PAGE = int(os.environ.get('ITEMS_PER_PAGE', 50))

    COIN_NAME = 'Bitok'
    COIN_SYMBOL = 'BITOK'
    COIN_DECIMALS = 8

    DEBUG = os.environ.get('DEBUG', 'false').lower() == 'true'
