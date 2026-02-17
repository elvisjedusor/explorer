OPCODES = {
    0x00: 'OP_0', 0x4c: 'OP_PUSHDATA1', 0x4d: 'OP_PUSHDATA2', 0x4e: 'OP_PUSHDATA4',
    0x4f: 'OP_1NEGATE',
    0x51: 'OP_1', 0x52: 'OP_2', 0x53: 'OP_3', 0x54: 'OP_4',
    0x55: 'OP_5', 0x56: 'OP_6', 0x57: 'OP_7', 0x58: 'OP_8',
    0x59: 'OP_9', 0x5a: 'OP_10', 0x5b: 'OP_11', 0x5c: 'OP_12',
    0x5d: 'OP_13', 0x5e: 'OP_14', 0x5f: 'OP_15', 0x60: 'OP_16',
    0x61: 'OP_NOP', 0x63: 'OP_IF', 0x64: 'OP_NOTIF', 0x67: 'OP_ELSE',
    0x68: 'OP_ENDIF', 0x69: 'OP_VERIFY', 0x6a: 'OP_RETURN',
    0x6b: 'OP_TOALTSTACK', 0x6c: 'OP_FROMALTSTACK',
    0x73: 'OP_IFDUP', 0x74: 'OP_DEPTH', 0x75: 'OP_DROP', 0x76: 'OP_DUP',
    0x77: 'OP_NIP', 0x78: 'OP_OVER', 0x79: 'OP_PICK', 0x7a: 'OP_ROLL',
    0x7b: 'OP_ROT', 0x7c: 'OP_SWAP', 0x7d: 'OP_TUCK',
    0x6d: 'OP_2DROP', 0x6e: 'OP_2DUP', 0x6f: 'OP_3DUP',
    0x70: 'OP_2OVER', 0x71: 'OP_2ROT', 0x72: 'OP_2SWAP',
    0x7e: 'OP_CAT', 0x7f: 'OP_SUBSTR', 0x80: 'OP_LEFT', 0x81: 'OP_RIGHT',
    0x82: 'OP_SIZE',
    0x83: 'OP_INVERT', 0x84: 'OP_AND', 0x85: 'OP_OR', 0x86: 'OP_XOR',
    0x87: 'OP_EQUAL', 0x88: 'OP_EQUALVERIFY',
    0x8b: 'OP_1ADD', 0x8c: 'OP_1SUB', 0x8d: 'OP_2MUL', 0x8e: 'OP_2DIV',
    0x8f: 'OP_NEGATE', 0x90: 'OP_ABS', 0x91: 'OP_NOT', 0x92: 'OP_0NOTEQUAL',
    0x93: 'OP_ADD', 0x94: 'OP_SUB', 0x95: 'OP_MUL', 0x96: 'OP_DIV',
    0x97: 'OP_MOD', 0x98: 'OP_LSHIFT', 0x99: 'OP_RSHIFT',
    0x9a: 'OP_BOOLAND', 0x9b: 'OP_BOOLOR',
    0x9c: 'OP_NUMEQUAL', 0x9d: 'OP_NUMEQUALVERIFY',
    0x9e: 'OP_NUMNOTEQUAL',
    0x9f: 'OP_LESSTHAN', 0xa0: 'OP_GREATERTHAN',
    0xa1: 'OP_LESSTHANOREQUAL', 0xa2: 'OP_GREATERTHANOREQUAL',
    0xa3: 'OP_MIN', 0xa4: 'OP_MAX',
    0xa5: 'OP_WITHIN',
    0xa6: 'OP_RIPEMD160', 0xa7: 'OP_SHA1', 0xa8: 'OP_SHA256',
    0xa9: 'OP_HASH160', 0xaa: 'OP_HASH256',
    0xab: 'OP_CODESEPARATOR',
    0xac: 'OP_CHECKSIG', 0xad: 'OP_CHECKSIGVERIFY',
    0xae: 'OP_CHECKMULTISIG', 0xaf: 'OP_CHECKMULTISIGVERIFY',
    0xb0: 'OP_NOP1', 0xb1: 'OP_NOP2', 0xb2: 'OP_NOP3',
    0xb3: 'OP_NOP4', 0xb4: 'OP_NOP5', 0xb5: 'OP_NOP6',
    0xb6: 'OP_NOP7', 0xb7: 'OP_NOP8', 0xb8: 'OP_NOP9', 0xb9: 'OP_NOP10',
    0x62: 'OP_VER', 0x65: 'OP_VERIF', 0x66: 'OP_VERNOTIF',
    0xfd: 'OP_PUBKEYHASH', 0xfe: 'OP_PUBKEY', 0xff: 'OP_INVALIDOPCODE',
}

OPCODE_DESCRIPTIONS = {
    'OP_DUP': 'Duplicates the top stack item',
    'OP_HASH160': 'Input is hashed with SHA-256 then RIPEMD-160',
    'OP_EQUALVERIFY': 'Returns true if inputs are equal, fails otherwise',
    'OP_CHECKSIG': 'Checks signature against public key',
    'OP_CHECKSIGVERIFY': 'Same as CHECKSIG then VERIFY',
    'OP_CHECKMULTISIG': 'Checks m-of-n multi-signature',
    'OP_CHECKMULTISIGVERIFY': 'Same as CHECKMULTISIG then VERIFY',
    'OP_RETURN': 'Marks output as provably unspendable',
    'OP_CAT': 'Concatenates two strings (max 520 bytes)',
    'OP_SUBSTR': 'Returns a section of a string',
    'OP_LEFT': 'Keeps only characters left of the specified point',
    'OP_RIGHT': 'Keeps only characters right of the specified point',
    'OP_SIZE': 'Pushes the string length of the top element',
    'OP_INVERT': 'Flips all of the bits in the input',
    'OP_AND': 'Boolean AND between each bit of the inputs',
    'OP_OR': 'Boolean OR between each bit of the inputs',
    'OP_XOR': 'Boolean XOR between each bit of the inputs',
    'OP_MUL': 'Multiplies top two items (4-byte operands)',
    'OP_DIV': 'Divides top two items (4-byte operands)',
    'OP_MOD': 'Returns remainder of division (4-byte operands)',
    'OP_LSHIFT': 'Left shift (max 31 bits)',
    'OP_RSHIFT': 'Right shift (max 31 bits)',
    'OP_ADD': 'Adds top two items',
    'OP_SUB': 'Subtracts top two items',
    'OP_EQUAL': 'Returns 1 if inputs are equal, 0 otherwise',
    'OP_VERIFY': 'Fails if top value is not true',
    'OP_IF': 'Execute if top stack value is true',
    'OP_NOTIF': 'Execute if top stack value is false',
    'OP_ELSE': 'Execute if previous IF/NOTIF was not executed',
    'OP_ENDIF': 'Ends an IF/ELSE block',
    'OP_0': 'Pushes empty byte array (false)',
    'OP_1': 'Pushes the number 1 (true)',
    'OP_TOALTSTACK': 'Moves top item to alt stack',
    'OP_FROMALTSTACK': 'Moves top item from alt stack',
    'OP_DROP': 'Removes top stack item',
    'OP_SWAP': 'Swaps top two stack items',
    'OP_OVER': 'Copies second-to-top item to top',
    'OP_PICK': 'Copies the nth item to the top',
    'OP_ROLL': 'Moves the nth item to the top',
    'OP_ROT': 'Rotates the top three items',
    'OP_NIP': 'Removes the second-to-top item',
    'OP_TUCK': 'Copies top item behind second-to-top',
    'OP_SHA256': 'Input is hashed with SHA-256',
    'OP_RIPEMD160': 'Input is hashed with RIPEMD-160',
    'OP_SHA1': 'Input is hashed with SHA-1',
    'OP_HASH256': 'Input is hashed twice with SHA-256',
    'OP_CODESEPARATOR': 'Marks boundary for signature checking',
    'OP_DEPTH': 'Pushes the stack size',
    'OP_IFDUP': 'Duplicates top item if it is not zero',
    'OP_1NEGATE': 'Pushes the number -1',
    'OP_ABS': 'Makes the top item positive',
    'OP_NOT': 'Flips the boolean value',
    'OP_0NOTEQUAL': 'Returns 1 if input is not 0',
    'OP_NEGATE': 'Negates the top item',
    'OP_1ADD': 'Adds 1 to the top item',
    'OP_1SUB': 'Subtracts 1 from the top item',
    'OP_BOOLAND': 'Boolean AND of top two items',
    'OP_BOOLOR': 'Boolean OR of top two items',
    'OP_NUMEQUAL': 'Returns 1 if numbers are equal',
    'OP_NUMEQUALVERIFY': 'Same as NUMEQUAL then VERIFY',
    'OP_NUMNOTEQUAL': 'Returns 1 if numbers are not equal',
    'OP_LESSTHAN': 'Returns 1 if a < b',
    'OP_GREATERTHAN': 'Returns 1 if a > b',
    'OP_LESSTHANOREQUAL': 'Returns 1 if a <= b',
    'OP_GREATERTHANOREQUAL': 'Returns 1 if a >= b',
    'OP_MIN': 'Returns the smaller of two items',
    'OP_MAX': 'Returns the larger of two items',
    'OP_WITHIN': 'Returns 1 if x is within range [min, max)',
    'OP_VER': 'DISABLED - Consensus-splitting version check',
    'OP_VERIF': 'DISABLED - Consensus-splitting conditional',
    'OP_VERNOTIF': 'DISABLED - Consensus-splitting conditional',
}

SCRIPT_EXEC_HEIGHT = 18000


def decode_script(hex_script):
    if not hex_script:
        return []

    try:
        raw = bytes.fromhex(hex_script)
    except (ValueError, TypeError):
        return []

    ops = []
    i = 0
    while i < len(raw):
        opcode = raw[i]
        i += 1

        if 1 <= opcode <= 75:
            data = raw[i:i + opcode]
            i += opcode
            ops.append({'type': 'data', 'hex': data.hex(), 'size': opcode})
        elif opcode == 0x4c:
            if i >= len(raw):
                break
            size = raw[i]
            i += 1
            data = raw[i:i + size]
            i += size
            ops.append({'type': 'data', 'hex': data.hex(), 'size': size})
        elif opcode == 0x4d:
            if i + 1 >= len(raw):
                break
            size = raw[i] | (raw[i + 1] << 8)
            i += 2
            data = raw[i:i + size]
            i += size
            ops.append({'type': 'data', 'hex': data.hex(), 'size': size})
        elif opcode == 0x4e:
            if i + 3 >= len(raw):
                break
            size = raw[i] | (raw[i+1] << 8) | (raw[i+2] << 16) | (raw[i+3] << 24)
            i += 4
            data = raw[i:i + size]
            i += size
            ops.append({'type': 'data', 'hex': data.hex(), 'size': size})
        else:
            name = OPCODES.get(opcode, f'OP_UNKNOWN_{opcode:02x}')
            ops.append({'type': 'opcode', 'name': name, 'byte': opcode})

    return ops


def script_to_asm(hex_script):
    ops = decode_script(hex_script)
    parts = []
    for op in ops:
        if op['type'] == 'data':
            parts.append(op['hex'])
        else:
            parts.append(op['name'])
    return ' '.join(parts)


def classify_script(hex_script):
    ops = decode_script(hex_script)
    if not ops:
        return {'type': 'nonstandard', 'label': 'Empty', 'addresses': [], 'req_sigs': 0}

    if (len(ops) == 5
            and ops[0].get('name') == 'OP_DUP'
            and ops[1].get('name') == 'OP_HASH160'
            and ops[2].get('type') == 'data' and ops[2].get('size') == 20
            and ops[3].get('name') == 'OP_EQUALVERIFY'
            and ops[4].get('name') == 'OP_CHECKSIG'):
        return {
            'type': 'pubkeyhash',
            'label': 'P2PKH',
            'description': 'Pay to Public Key Hash',
            'pubkey_hash': ops[2]['hex'],
            'req_sigs': 1,
        }

    if (len(ops) == 2
            and ops[0].get('type') == 'data'
            and ops[0].get('size') in (33, 65)
            and ops[1].get('name') == 'OP_CHECKSIG'):
        return {
            'type': 'pubkey',
            'label': 'P2PK',
            'description': 'Pay to Public Key',
            'pubkey': ops[0]['hex'],
            'req_sigs': 1,
        }

    if (len(ops) >= 4
            and ops[-1].get('name') == 'OP_CHECKMULTISIG'):
        m_op = ops[0]
        n_op = ops[-2]
        if m_op.get('type') == 'opcode' and n_op.get('type') == 'opcode':
            m_byte = m_op.get('byte', 0)
            n_byte = n_op.get('byte', 0)
            if 0x51 <= m_byte <= 0x60 and 0x51 <= n_byte <= 0x60:
                m = m_byte - 0x50
                n = n_byte - 0x50
                pubkeys = []
                for k in range(1, len(ops) - 2):
                    if ops[k].get('type') == 'data':
                        pubkeys.append(ops[k]['hex'])
                return {
                    'type': 'multisig',
                    'label': f'{m}-of-{n} Multisig',
                    'description': f'{m}-of-{n} Multi-Signature',
                    'm': m,
                    'n': n,
                    'pubkeys': pubkeys,
                    'req_sigs': m,
                }

    if ops[0].get('name') == 'OP_RETURN':
        data_parts = []
        for op in ops[1:]:
            if op.get('type') == 'data':
                data_parts.append(op['hex'])
        text = ''
        for part in data_parts:
            try:
                decoded = bytes.fromhex(part).decode('utf-8', errors='replace')
                if all(32 <= ord(c) < 127 or c in '\t\n\r' for c in decoded):
                    text = decoded
            except Exception:
                pass
        return {
            'type': 'nulldata',
            'label': 'OP_RETURN',
            'description': 'Data Carrier (Unspendable)',
            'data_hex': ' '.join(data_parts),
            'data_text': text,
            'req_sigs': 0,
        }

    has_advanced = False
    advanced_ops = {
        'OP_CAT', 'OP_SUBSTR', 'OP_LEFT', 'OP_RIGHT',
        'OP_INVERT', 'OP_AND', 'OP_OR', 'OP_XOR',
        'OP_MUL', 'OP_DIV', 'OP_MOD', 'OP_LSHIFT', 'OP_RSHIFT',
    }
    found_ops = set()
    for op in ops:
        if op.get('name') in advanced_ops:
            has_advanced = True
            found_ops.add(op['name'])

    if has_advanced:
        return {
            'type': 'nonstandard',
            'label': 'Custom Script',
            'description': f'Uses: {", ".join(sorted(found_ops))}',
            'advanced_opcodes': sorted(found_ops),
            'req_sigs': 0,
        }

    return {
        'type': 'nonstandard',
        'label': 'Non-Standard',
        'description': 'Unrecognized script pattern',
        'req_sigs': 0,
    }


def decode_script_sig(hex_script):
    ops = decode_script(hex_script)
    if not ops:
        return {'type': 'empty', 'parts': []}

    parts = []
    for op in ops:
        if op['type'] == 'data':
            size = op['size']
            hex_data = op['hex']
            if size in (71, 72, 73) and hex_data.startswith('30'):
                sighash = int(hex_data[-2:], 16) if len(hex_data) >= 2 else 0
                sighash_name = {1: 'ALL', 2: 'NONE', 3: 'SINGLE'}.get(
                    sighash & 0x1f, f'0x{sighash:02x}'
                )
                if sighash & 0x80:
                    sighash_name += '|ANYONECANPAY'
                parts.append({
                    'type': 'signature',
                    'hex': hex_data,
                    'sighash': sighash_name,
                    'size': size,
                })
            elif size in (33, 65):
                parts.append({
                    'type': 'pubkey',
                    'hex': hex_data,
                    'compressed': size == 33,
                    'size': size,
                })
            else:
                parts.append({
                    'type': 'data',
                    'hex': hex_data,
                    'size': size,
                })
        else:
            parts.append({
                'type': 'opcode',
                'name': op['name'],
            })

    return {'type': 'scriptsig', 'parts': parts}


def format_asm_html(hex_script, is_scriptsig=False):
    if not hex_script:
        return ''

    ops = decode_script(hex_script)
    parts = []
    for op in ops:
        if op['type'] == 'data':
            hex_data = op['hex']
            if len(hex_data) > 64:
                display = hex_data[:32] + '...' + hex_data[-8:]
            else:
                display = hex_data
            parts.append(f'<span class="script-data" title="{hex_data}">{display}</span>')
        else:
            name = op['name']
            desc = OPCODE_DESCRIPTIONS.get(name, '')
            css = 'script-op'
            if name == 'OP_RETURN':
                css = 'script-op script-op-return'
            elif name in ('OP_CHECKSIG', 'OP_CHECKSIGVERIFY', 'OP_CHECKMULTISIG', 'OP_CHECKMULTISIGVERIFY'):
                css = 'script-op script-op-crypto'
            elif name in ('OP_CAT', 'OP_SUBSTR', 'OP_LEFT', 'OP_RIGHT'):
                css = 'script-op script-op-string'
            elif name in ('OP_MUL', 'OP_DIV', 'OP_MOD', 'OP_LSHIFT', 'OP_RSHIFT',
                          'OP_ADD', 'OP_SUB'):
                css = 'script-op script-op-math'
            elif name in ('OP_AND', 'OP_OR', 'OP_XOR', 'OP_INVERT'):
                css = 'script-op script-op-bitwise'
            elif name in ('OP_IF', 'OP_NOTIF', 'OP_ELSE', 'OP_ENDIF'):
                css = 'script-op script-op-flow'
            elif name in ('OP_DUP', 'OP_DROP', 'OP_SWAP', 'OP_OVER', 'OP_ROT',
                          'OP_PICK', 'OP_ROLL', 'OP_2DUP', 'OP_3DUP'):
                css = 'script-op script-op-stack'
            elif name in ('OP_HASH160', 'OP_SHA256', 'OP_RIPEMD160', 'OP_SHA1', 'OP_HASH256'):
                css = 'script-op script-op-hash'
            elif name in ('OP_EQUAL', 'OP_EQUALVERIFY'):
                css = 'script-op script-op-compare'
            elif name in ('OP_VERIFY',):
                css = 'script-op script-op-verify'
            elif name in ('OP_VER', 'OP_VERIF', 'OP_VERNOTIF'):
                css = 'script-op script-op-disabled'
            parts.append(f'<span class="{css}" title="{desc}">{name}</span>')

    return ' '.join(parts)
