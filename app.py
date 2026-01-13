from flask import Flask, render_template, request, jsonify, abort, redirect, url_for
from sqlalchemy import desc, func
from sqlalchemy.orm import scoped_session
from datetime import datetime
from contextlib import contextmanager
import logging

from config import Config
from models import init_db, Block, Transaction, TxInput, TxOutput, Address, ChainState
from rpc_client import BitokRPC

app = Flask(__name__)
app.config.from_object(Config)

logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
app.logger.setLevel(logging.INFO)

config = Config()
engine, SessionFactory = init_db(
    config.DATABASE_URL,
    pool_size=config.DB_POOL_SIZE,
    max_overflow=config.DB_MAX_OVERFLOW,
    pool_timeout=config.DB_POOL_TIMEOUT,
    pool_recycle=config.DB_POOL_RECYCLE
)

Session = scoped_session(SessionFactory)

rpc = BitokRPC(
    host=config.RPC_HOST,
    port=config.RPC_PORT,
    user=config.RPC_USER,
    password=config.RPC_PASSWORD
)

COIN = 100000000


@app.template_filter('coin')
def coin_filter(value):
    """Convert satoshis to coins"""
    if value is None:
        return '0.00000000'
    return '{:.8f}'.format(value / COIN)


@app.template_filter('timestamp')
def timestamp_filter(value):
    """Convert unix timestamp to readable date"""
    if value is None:
        return 'N/A'
    return datetime.fromtimestamp(value).strftime('%Y-%m-%d %H:%M:%S')


@contextmanager
def get_session():
    session = Session()
    try:
        yield session
    finally:
        session.close()
        Session.remove()


def format_coin(satoshis):
    if satoshis is None or satoshis == 0:
        return '0.00000000'
    try:
        return f'{satoshis / COIN:.8f}'
    except (TypeError, ValueError):
        return '0.00000000'


def format_timestamp(ts):
    if ts is None:
        return ''
    return datetime.utcfromtimestamp(ts).strftime('%Y-%m-%d %H:%M:%S UTC')


def format_age(ts):
    if ts is None:
        return ''
    now = datetime.utcnow()
    then = datetime.utcfromtimestamp(ts)
    diff = now - then

    if diff.days > 0:
        return f'{diff.days}d ago'
    hours = diff.seconds // 3600
    if hours > 0:
        return f'{hours}h ago'
    minutes = (diff.seconds % 3600) // 60
    return f'{minutes}m ago'


app.jinja_env.filters['coin'] = format_coin
app.jinja_env.filters['timestamp'] = format_timestamp
app.jinja_env.filters['age'] = format_age
app.jinja_env.globals['max'] = max
app.jinja_env.globals['min'] = min


@app.teardown_appcontext
def shutdown_session(exception=None):
    Session.remove()


def get_network_stats():
    with get_session() as session:
        synced_height = session.query(ChainState).filter_by(key='synced_height').first()
        synced = int(synced_height.value) if synced_height else 0

        latest_block = session.query(Block).order_by(desc(Block.height)).first()

        total_txs = session.query(func.count(Transaction.id)).scalar() or 0
        total_addresses = session.query(func.count(Address.id)).scalar() or 0

        try:
            info = rpc.getinfo()
            difficulty = info.get('difficulty', 0)
            connections = info.get('connections', 0)
            try:
                chain_height = rpc.getblocknumber()
            except:
                chain_height = info.get('blocks', synced)
        except:
            difficulty = 0
            connections = 0
            chain_height = synced

        return {
            'height': synced,
            'chain_height': chain_height,
            'difficulty': difficulty,
            'connections': connections,
            'total_txs': total_txs,
            'total_addresses': total_addresses,
            'latest_block': latest_block
        }


@app.route('/')
def index():
    with get_session() as session:
        stats = get_network_stats()

        recent_blocks = session.query(Block).order_by(
            desc(Block.height)
        ).limit(10).all()

        recent_txs = session.query(Transaction).order_by(
            desc(Transaction.id)
        ).limit(10).all()

        return render_template('index.html',
            stats=stats,
            recent_blocks=recent_blocks,
            recent_txs=recent_txs,
            config=config
        )


@app.route('/blocks')
@app.route('/blocks/<int:page>')
def blocks(page=1):
    try:
        with get_session() as session:
            per_page = config.ITEMS_PER_PAGE
            total = session.query(func.count(Block.id)).scalar() or 0
            total_pages = max(1, (total + per_page - 1) // per_page)

            if page < 1 or page > total_pages:
                page = 1

            blocks_list = session.query(Block).order_by(
                desc(Block.height)
            ).offset((page - 1) * per_page).limit(per_page).all()

            app.logger.info(f'Blocks page {page}: Found {len(blocks_list)} blocks')

            # Log first block for debugging
            if blocks_list:
                b = blocks_list[0]
                app.logger.info(f'First block: height={b.height}, hash={b.hash}, tx_count={b.tx_count}, total_value={b.total_value}, timestamp={b.timestamp}')

            return render_template('blocks.html',
                blocks=blocks_list,
                page=page,
                total_pages=total_pages,
                total=total,
                config=config
            )
    except Exception as e:
        app.logger.error(f'Error in blocks route: {e}', exc_info=True)
        return render_template('500.html', config=config), 500


@app.route('/block/<block_id>')
def block(block_id):
    with get_session() as session:
        if len(block_id) == 64:
            block = session.query(Block).filter_by(hash=block_id).first()
        else:
            try:
                height = int(block_id)
                block = session.query(Block).filter_by(height=height).first()
            except ValueError:
                abort(404)

        if not block:
            abort(404)

        txs = session.query(Transaction).filter_by(
            block_id=block.id
        ).all()

        prev_block = session.query(Block).filter_by(height=block.height - 1).first() if block.height > 0 else None
        next_block = session.query(Block).filter_by(height=block.height + 1).first()

        return render_template('block.html',
            block=block,
            transactions=txs,
            prev_block=prev_block,
            next_block=next_block,
            config=config
        )


@app.route('/tx/<txid>')
def transaction(txid):
    with get_session() as session:
        tx = session.query(Transaction).filter_by(txid=txid).first()
        if not tx:
            abort(404)

        inputs = session.query(TxInput).filter_by(tx_id=tx.id).all()
        outputs = session.query(TxOutput).filter_by(tx_id=tx.id).all()

        input_details = []
        for inp in inputs:
            detail = {
                'coinbase': inp.coinbase,
                'prev_txid': inp.prev_txid,
                'prev_vout': inp.prev_vout,
                'address': None,
                'value': 0
            }
            if inp.prev_txid:
                prev_out = session.query(TxOutput).filter_by(
                    txid=inp.prev_txid,
                    vout=inp.prev_vout
                ).first()
                if prev_out:
                    detail['address'] = prev_out.address
                    detail['value'] = prev_out.value
            input_details.append(detail)

        return render_template('transaction.html',
            tx=tx,
            inputs=input_details,
            outputs=outputs,
            config=config
        )


@app.route('/address/<address>')
@app.route('/address/<address>/<int:page>')
def address_page(address, page=1):
    with get_session() as session:
        addr = session.query(Address).filter_by(address=address).first()
        if not addr:
            valid = rpc.validateaddress(address)
            if not valid.get('isvalid'):
                abort(404)
            addr = Address(
                address=address,
                total_received=0,
                total_sent=0,
                balance=0,
                tx_count=0
            )

        per_page = config.ITEMS_PER_PAGE

        output_txids = session.query(TxOutput.txid).filter_by(address=address).distinct()

        all_txids = set()
        for row in output_txids:
            all_txids.add(row[0])

        spent_outputs = session.query(TxOutput).filter(
            TxOutput.address == address,
            TxOutput.spent == True
        ).all()
        for out in spent_outputs:
            if out.spent_by_txid:
                all_txids.add(out.spent_by_txid)

        total = len(all_txids)
        total_pages = max(1, (total + per_page - 1) // per_page)

        transactions = session.query(Transaction).filter(
            Transaction.txid.in_(all_txids)
        ).order_by(desc(Transaction.block_height)).offset(
            (page - 1) * per_page
        ).limit(per_page).all()

        tx_details = []
        for tx in transactions:
            received = 0
            sent = 0

            outputs = session.query(TxOutput).filter_by(tx_id=tx.id).all()
            for out in outputs:
                if out.address == address:
                    received += out.value

            inputs = session.query(TxInput).filter_by(tx_id=tx.id).all()
            for inp in inputs:
                if inp.prev_txid:
                    prev_out = session.query(TxOutput).filter_by(
                        txid=inp.prev_txid,
                        vout=inp.prev_vout
                    ).first()
                    if prev_out and prev_out.address == address:
                        sent += prev_out.value

            tx_details.append({
                'tx': tx,
                'received': received,
                'sent': sent,
                'net': received - sent
            })

        return render_template('address.html',
            address=addr,
            transactions=tx_details,
            page=page,
            total_pages=total_pages,
            total=total,
            config=config
        )


@app.route('/search')
def search():
    query = request.args.get('q', '').strip()
    if not query:
        return redirect(url_for('index'))

    with get_session() as session:
        if len(query) == 64:
            block = session.query(Block).filter_by(hash=query).first()
            if block:
                return redirect(url_for('block', block_id=query))

            tx = session.query(Transaction).filter_by(txid=query).first()
            if tx:
                return redirect(url_for('transaction', txid=query))

        try:
            height = int(query)
            block = session.query(Block).filter_by(height=height).first()
            if block:
                return redirect(url_for('block', block_id=str(height)))
        except ValueError:
            pass

        if len(query) >= 26 and len(query) <= 35:
            try:
                valid = rpc.validateaddress(query)
                if valid.get('isvalid'):
                    return redirect(url_for('address_page', address=query))
            except:
                pass

        return render_template('search_results.html',
            query=query,
            results=[],
            config=config
        )


@app.route('/api/stats')
def api_stats():
    stats = get_network_stats()
    return jsonify({
        'height': stats['height'],
        'chain_height': stats['chain_height'],
        'difficulty': stats['difficulty'],
        'connections': stats['connections'],
        'total_txs': stats['total_txs'],
        'total_addresses': stats['total_addresses']
    })


@app.route('/api/block/<block_id>')
def api_block(block_id):
    with get_session() as session:
        if len(block_id) == 64:
            block = session.query(Block).filter_by(hash=block_id).first()
        else:
            block = session.query(Block).filter_by(height=int(block_id)).first()

        if not block:
            return jsonify({'error': 'Block not found'}), 404

        txs = session.query(Transaction.txid).filter_by(block_id=block.id).all()

        return jsonify({
            'hash': block.hash,
            'height': block.height,
            'version': block.version,
            'prev_hash': block.prev_hash,
            'merkle_root': block.merkle_root,
            'timestamp': block.timestamp,
            'bits': block.bits,
            'nonce': block.nonce,
            'tx_count': block.tx_count,
            'total_value': format_coin(block.total_value),
            'transactions': [t[0] for t in txs]
        })


@app.route('/api/tx/<txid>')
def api_transaction(txid):
    with get_session() as session:
        tx = session.query(Transaction).filter_by(txid=txid).first()
        if not tx:
            return jsonify({'error': 'Transaction not found'}), 404

        inputs = []
        for inp in session.query(TxInput).filter_by(tx_id=tx.id).all():
            inp_data = {'coinbase': inp.coinbase}
            if inp.prev_txid:
                inp_data['txid'] = inp.prev_txid
                inp_data['vout'] = inp.prev_vout
                prev_out = session.query(TxOutput).filter_by(
                    txid=inp.prev_txid, vout=inp.prev_vout
                ).first()
                if prev_out:
                    inp_data['address'] = prev_out.address
                    inp_data['value'] = format_coin(prev_out.value)
            inputs.append(inp_data)

        outputs = []
        for out in session.query(TxOutput).filter_by(tx_id=tx.id).all():
            outputs.append({
                'n': out.vout,
                'value': format_coin(out.value),
                'address': out.address,
                'spent': out.spent
            })

        return jsonify({
            'txid': tx.txid,
            'block_hash': tx.block_hash,
            'block_height': tx.block_height,
            'is_coinbase': tx.is_coinbase,
            'total_input': format_coin(tx.total_input),
            'total_output': format_coin(tx.total_output),
            'fee': format_coin(tx.fee),
            'inputs': inputs,
            'outputs': outputs
        })


@app.route('/api/address/<address>')
def api_address(address):
    with get_session() as session:
        addr = session.query(Address).filter_by(address=address).first()
        if not addr:
            return jsonify({
                'address': address,
                'total_received': '0',
                'total_sent': '0',
                'balance': '0',
                'tx_count': 0
            })

        return jsonify({
            'address': addr.address,
            'total_received': format_coin(addr.total_received),
            'total_sent': format_coin(addr.total_sent),
            'balance': format_coin(addr.balance),
            'tx_count': addr.tx_count,
            'first_seen_block': addr.first_seen_block,
            'last_seen_block': addr.last_seen_block
        })


@app.errorhandler(404)
def not_found(e):
    return render_template('404.html', config=config), 404


@app.errorhandler(500)
def server_error(e):
    app.logger.error(f'500 error: {str(e)}', exc_info=True)
    return render_template('500.html', config=config), 500


if __name__ == '__main__':
    app.run(host='0.0.0.0', port=5000, debug=config.DEBUG)
