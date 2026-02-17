from flask import Flask, render_template, request, jsonify, abort, redirect, url_for
from sqlalchemy import desc, func
from sqlalchemy.orm import scoped_session
from datetime import datetime
from contextlib import contextmanager
import logging

from config import Config
from models import init_db, Block, Transaction, TxInput, TxOutput, Address, ChainState
from rpc_client import BitokRPC
from script_decoder import (
    decode_script, script_to_asm, classify_script,
    decode_script_sig, format_asm_html, SCRIPT_EXEC_HEIGHT
)

app = Flask(__name__, static_folder='static', static_url_path='/static')
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
BLOCK_TIME = 600
MAX_TARGET = 0x7fffff * (2 ** 216)


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


def calculate_hashrate_from_blocks(session, difficulty):
    """
    Simple hashrate calculation:
    - Get last 30 blocks
    - Calculate time taken
    - Hashrate = (blocks * difficulty * 2^17) / time_elapsed
    Note: Bitok has 17 leading zero bits (not Bitcoin's 32)
    """
    LOOKUP_BLOCKS = 30

    # Get the last N blocks
    best_block = session.query(Block).order_by(desc(Block.height)).first()
    if not best_block or best_block.height < 2:
        return 0, BLOCK_TIME

    best_height = best_block.height
    actual_lookup = min(best_height, LOOKUP_BLOCKS)

    # Get blocks with timestamps
    start_height = best_height - actual_lookup + 1
    blocks = session.query(Block.timestamp).filter(
        Block.height >= start_height,
        Block.height <= best_height,
        Block.timestamp.isnot(None)
    ).order_by(Block.height).all()

    if len(blocks) < 2:
        return 0, BLOCK_TIME

    # Calculate time span
    timestamps = [b.timestamp for b in blocks]
    time_span = timestamps[-1] - timestamps[0]

    if time_span <= 0:
        return 0, BLOCK_TIME

    # Average block time
    avg_block_time = time_span / (len(blocks) - 1)

    # Simple hashrate formula
    # At difficulty D, finding a block takes roughly D * 2^17 hashes (Bitok has 17 leading zero bits)
    # We found N blocks in time_span seconds
    # So hashrate = (N * D * 2^17) / time_span
    if difficulty and difficulty > 0:
        num_blocks = len(blocks) - 1  # Number of intervals
        hashrate = (num_blocks * difficulty * pow(2, 17)) / time_span
    else:
        hashrate = 0

    return hashrate, avg_block_time


def calculate_hashrate(difficulty):
    """Fallback: theoretical hashrate based on difficulty only"""
    if difficulty is None or difficulty <= 0:
        return 0
    hashrate = difficulty * (2 ** 256) / MAX_TARGET / BLOCK_TIME
    return hashrate


def format_hashrate(hashrate):
    if hashrate is None or hashrate <= 0:
        return '0 H/s'
    if hashrate >= 1e12:
        return f'{hashrate / 1e12:.2f} TH/s'
    elif hashrate >= 1e9:
        return f'{hashrate / 1e9:.2f} GH/s'
    elif hashrate >= 1e6:
        return f'{hashrate / 1e6:.2f} MH/s'
    elif hashrate >= 1e3:
        return f'{hashrate / 1e3:.2f} kH/s'
    else:
        return f'{hashrate:.2f} H/s'


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

        hashrate, avg_block_time = calculate_hashrate_from_blocks(session, difficulty)
        hashrate_formatted = format_hashrate(hashrate)

        return {
            'height': synced,
            'chain_height': chain_height,
            'difficulty': difficulty,
            'connections': connections,
            'total_txs': total_txs,
            'hashrate': hashrate,
            'hashrate_formatted': hashrate_formatted,
            'avg_block_time': avg_block_time,
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


@app.route('/download')
def download():
    return render_template('download.html', config=config)


@app.route('/docs')
def docs():
    return render_template('docs.html', config=config)


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

        is_post_exec = tx.block_height >= SCRIPT_EXEC_HEIGHT if tx.block_height else False

        input_details = []
        for inp in inputs:
            detail = {
                'coinbase': inp.coinbase,
                'prev_txid': inp.prev_txid,
                'prev_vout': inp.prev_vout,
                'address': None,
                'value': 0,
                'script_sig_hex': inp.script_sig,
                'script_sig_asm': '',
                'script_sig_html': '',
                'script_sig_decoded': None,
            }
            if inp.script_sig:
                detail['script_sig_asm'] = script_to_asm(inp.script_sig)
                detail['script_sig_html'] = format_asm_html(inp.script_sig, is_scriptsig=True)
                detail['script_sig_decoded'] = decode_script_sig(inp.script_sig)
            if inp.prev_txid:
                prev_out = session.query(TxOutput).filter_by(
                    txid=inp.prev_txid,
                    vout=inp.prev_vout
                ).first()
                if prev_out:
                    detail['address'] = prev_out.address
                    detail['value'] = prev_out.value
            input_details.append(detail)

        output_details = []
        for out in outputs:
            script_info = classify_script(out.script_pubkey)
            output_details.append({
                'vout': out.vout,
                'value': out.value,
                'address': out.address,
                'spent': out.spent,
                'spent_by_txid': out.spent_by_txid,
                'script_pubkey_hex': out.script_pubkey,
                'script_pubkey_asm': script_to_asm(out.script_pubkey) if out.script_pubkey else '',
                'script_pubkey_html': format_asm_html(out.script_pubkey) if out.script_pubkey else '',
                'script_type': script_info.get('type', 'nonstandard'),
                'script_label': script_info.get('label', 'Unknown'),
                'script_info': script_info,
            })

        return render_template('transaction.html',
            tx=tx,
            inputs=input_details,
            outputs=output_details,
            is_post_exec=is_post_exec,
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

        total_received_utxo = session.query(func.coalesce(func.sum(TxOutput.value), 0)).filter(
            TxOutput.address == address
        ).scalar()
        total_sent_utxo = session.query(func.coalesce(func.sum(TxOutput.value), 0)).filter(
            TxOutput.address == address,
            TxOutput.spent == True
        ).scalar()
        balance_utxo = total_received_utxo - total_sent_utxo

        if balance_utxo != addr.balance:
            addr.total_received = total_received_utxo
            addr.total_sent = total_sent_utxo
            addr.balance = balance_utxo

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
        'hashrate': stats['hashrate'],
        'hashrate_formatted': stats['hashrate_formatted'],
        'avg_block_time': round(stats['avg_block_time'], 1),
        'target_block_time': BLOCK_TIME
    })


@app.route('/api/home')
def api_home():
    with get_session() as session:
        stats = get_network_stats()

        recent_blocks = session.query(Block).order_by(
            desc(Block.height)
        ).limit(10).all()

        recent_txs = session.query(Transaction).order_by(
            desc(Transaction.id)
        ).limit(10).all()

        blocks_data = [{
            'height': b.height,
            'hash': b.hash,
            'tx_count': b.tx_count,
            'timestamp': b.timestamp,
            'age': format_age(b.timestamp)
        } for b in recent_blocks]

        txs_data = [{
            'txid': tx.txid,
            'block_height': tx.block_height,
            'total_output': format_coin(tx.total_output)
        } for tx in recent_txs]

        return jsonify({
            'stats': {
                'height': stats['height'],
                'chain_height': stats['chain_height'],
                'difficulty': stats['difficulty'],
                'connections': stats['connections'],
                'total_txs': stats['total_txs'],
                'hashrate': stats['hashrate'],
                'hashrate_formatted': stats['hashrate_formatted'],
                'avg_block_time': round(stats['avg_block_time'], 1),
                'target_block_time': BLOCK_TIME,
                'synced': stats['height'] == stats['chain_height']
            },
            'recent_blocks': blocks_data,
            'recent_txs': txs_data,
            'coin_symbol': config.COIN_SYMBOL
        })


@app.route('/api/blocks')
@app.route('/api/blocks/<int:page>')
def api_blocks(page=1):
    with get_session() as session:
        per_page = config.ITEMS_PER_PAGE
        total = session.query(func.count(Block.id)).scalar() or 0
        total_pages = max(1, (total + per_page - 1) // per_page)

        if page < 1 or page > total_pages:
            page = 1

        blocks_list = session.query(Block).order_by(
            desc(Block.height)
        ).offset((page - 1) * per_page).limit(per_page).all()

        blocks_data = [{
            'height': b.height,
            'hash': b.hash,
            'tx_count': b.tx_count,
            'total_value': format_coin(b.total_value),
            'timestamp': format_timestamp(b.timestamp)
        } for b in blocks_list]

        return jsonify({
            'blocks': blocks_data,
            'page': page,
            'total_pages': total_pages,
            'total': total,
            'coin_symbol': config.COIN_SYMBOL
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
            if inp.script_sig:
                inp_data['script_sig_hex'] = inp.script_sig
                inp_data['script_sig_asm'] = script_to_asm(inp.script_sig)
            inputs.append(inp_data)

        outputs = []
        for out in session.query(TxOutput).filter_by(tx_id=tx.id).all():
            script_info = classify_script(out.script_pubkey) if out.script_pubkey else {}
            out_data = {
                'n': out.vout,
                'value': format_coin(out.value),
                'address': out.address,
                'spent': out.spent,
                'spent_by_txid': out.spent_by_txid,
                'script_type': script_info.get('type', 'nonstandard'),
                'script_label': script_info.get('label', 'Unknown'),
            }
            if out.script_pubkey:
                out_data['script_pubkey_hex'] = out.script_pubkey
                out_data['script_pubkey_asm'] = script_to_asm(out.script_pubkey)
            outputs.append(out_data)

        is_post_exec = tx.block_height >= SCRIPT_EXEC_HEIGHT if tx.block_height else False

        return jsonify({
            'txid': tx.txid,
            'block_hash': tx.block_hash,
            'block_height': tx.block_height,
            'is_coinbase': tx.is_coinbase,
            'is_post_script_exec': is_post_exec,
            'total_input': format_coin(tx.total_input),
            'total_output': format_coin(tx.total_output),
            'fee': format_coin(tx.fee),
            'inputs': inputs,
            'outputs': outputs
        })


@app.route('/api/decodescript', methods=['POST'])
def api_decodescript():
    data = request.get_json()
    if not data or 'hex' not in data:
        return jsonify({'error': 'Missing hex parameter'}), 400

    hex_script = data['hex'].strip()
    if not hex_script:
        return jsonify({'error': 'Empty hex script'}), 400

    try:
        int(hex_script, 16)
    except ValueError:
        return jsonify({'error': 'Invalid hex string'}), 400

    script_info = classify_script(hex_script)
    elements = decode_script(hex_script)
    asm = script_to_asm(hex_script)

    rpc_result = None
    try:
        rpc_result = rpc.decodescript(hex_script)
    except Exception:
        pass

    return jsonify({
        'hex': hex_script,
        'asm': asm,
        'type': script_info.get('type', 'nonstandard'),
        'label': script_info.get('label', 'Unknown'),
        'description': script_info.get('description', ''),
        'elements': [{
            'type': e['type'],
            'value': e.get('hex', e.get('name', '')),
            'name': e.get('name', ''),
            'description': e.get('description', ''),
        } for e in elements],
        'rpc_decode': rpc_result,
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
