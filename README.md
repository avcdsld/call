# Call

A minimal language that only calls existing smart contracts.

## Syntax

```
[label =] <address> <function> [args...]
```

Use `$` to reference previous result.

Example:
```call
0x88e6A0c2dDD26FEEb64F039a2c41296FcB3f5640 slot0()
0xA0b86a33E6776d0be64e6cC6034C32e5Dd21E294 balanceOf(address) 0x742d35Cc6634C0532925a3b8D4C29C5B4cef4B2F

0x123abc calculate(uint256) $
```

## Structure

```
call/
├── package.json  # Dependencies
├── call.js       # Compiler
├── Call.sol      # Interpreter  
├── examples/     # Samples
└── test/         # Tests
```

## Installation

```bash
npm install
```

## Usage

```bash
node call.js example.call
```

## How it works

The compiler converts Call code to bytecode. The interpreter executes each line as a CALL instruction, storing results and gas usage.

A minimalistic approach to blockchain composability.
