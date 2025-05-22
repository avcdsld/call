const fs = require('fs');
const { ethers } = require('ethers');

class CallCompiler {
    constructor() {
        this.bytecode = [];
        this.labels = new Map();
    }

    compile(source) {
        const lines = source.split('\n');

        for (let i = 0; i < lines.length; i++) {
            const line = lines[i].trim();

            // Skip empty lines and comments
            if (!line || line.startsWith('#')) {
                if (!line) {
                    // Poetic spacing - add breath marker
                    this.bytecode.push('ff');
                }
                continue;
            }

            this.compileLine(line, i);
        }

        return '0x' + this.bytecode.join('');
    }

    compileLine(line, lineNumber) {
        // Parse: [label =] <address> <function> [args...]
        const labelMatch = line.match(/^(\w+)\s*=\s*(.+)$/);
        let label = null;
        let rest = line;

        if (labelMatch) {
            label = labelMatch[1];
            rest = labelMatch[2];
        }

        // Parse address and function call
        const parts = rest.trim().split(/\s+/);
        if (parts.length < 2) {
            throw new Error(`Invalid syntax at line ${lineNumber + 1}: ${line}`);
        }

        const address = parts[0];
        const functionSig = parts[1];
        const args = parts.slice(2);

        // Validate address
        if (!address.match(/^0x[a-fA-F0-9]{40}$/)) {
            throw new Error(`Invalid address at line ${lineNumber + 1}: ${address}`);
        }

        // Extract function name and types
        const funcMatch = functionSig.match(/^(\w+)\(([^)]*)\)$/);
        if (!funcMatch) {
            throw new Error(`Invalid function signature at line ${lineNumber + 1}: ${functionSig}`);
        }

        const funcName = funcMatch[1];
        const paramTypes = funcMatch[2] ? funcMatch[2].split(',').map(t => t.trim()) : [];

        // Generate function selector
        const selector = this.getFunctionSelector(funcName, paramTypes);

        // If no label specified, use function name
        if (!label) {
            label = funcName;
        }

        // Encode call data (selector + arguments)
        const argumentData = this.encodeCalldata(selector, paramTypes, args);
        const fullCalldata = selector.slice(2) + argumentData;

        // Add to bytecode
        this.bytecode.push(
            '01', // CALL instruction
            address.slice(2).toLowerCase(), // Address without 0x
            this.encodeLength(fullCalldata.length / 2), // Calldata length in bytes
            fullCalldata
        );

        // Store label
        this.labels.set(label, this.bytecode.length - 1);
    }

    getFunctionSelector(name, types) {
        const signature = `${name}(${types.join(',')})`;
        const hash = ethers.keccak256(ethers.toUtf8Bytes(signature));
        return hash.slice(0, 10); // First 4 bytes + 0x
    }

    encodeCalldata(selector, types, args) {
        if (args.length !== types.length) {
            throw new Error(`Argument count mismatch: expected ${types.length}, got ${args.length}`);
        }

        let encoded = ''; // Don't include selector here

        for (let i = 0; i < args.length; i++) {
            const arg = args[i];
            const type = types[i];

            if (arg === '$') {
                // Reference to previous result - use placeholder that will be replaced
                encoded += 'ffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff';
            } else if (type === 'address') {
                const addr = arg.startsWith('0x') ? arg : '0x' + arg;
                encoded += addr.slice(2).padStart(64, '0');
            } else if (type === 'uint256' || type === 'uint') {
                const num = BigInt(arg);
                encoded += num.toString(16).padStart(64, '0');
            } else if (type === 'bytes32') {
                const bytes = arg.startsWith('0x') ? arg.slice(2) : arg;
                encoded += bytes.padEnd(64, '0');
            } else {
                throw new Error(`Unsupported type: ${type}`);
            }
        }

        return encoded;
    }

    encodeLength(length) {
        return length.toString(16).padStart(8, '0');
    }
}

if (require.main === module) {
    const args = process.argv.slice(2);

    if (args.length === 0) {
        console.log('Usage: node call.js <file.call>');
        process.exit(1);
    }

    const filename = args[0];

    try {
        const source = fs.readFileSync(filename, 'utf8');
        const compiler = new CallCompiler();
        const bytecode = compiler.compile(source);

        console.log('Compiled bytecode:');
        console.log(bytecode);

        // Write to output file
        const outputFile = filename.replace(/\.call$/, '.calldata');
        fs.writeFileSync(outputFile, bytecode);
        console.log(`Output written to: ${outputFile}`);

    } catch (error) {
        console.error('Error:', error.message);
        process.exit(1);
    }
}

module.exports = { CallCompiler };
