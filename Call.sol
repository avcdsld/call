// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

contract Call {
    event Execution(
        address indexed target,
        bytes4 selector,
        uint256 gasUsed,
        bool success
    );
    event Result(string label, bytes data);

    struct CallResult {
        bool success;
        bytes data;
        uint256 gasUsed;
    }

    mapping(string => bytes) public results;
    CallResult[] public history;

    function call(bytes calldata bytecode) external returns (bool) {
        uint256 pos = 0;
        bytes memory previousResult;

        while (pos < bytecode.length) {
            // Parse instruction
            if (bytecode[pos] == 0x01) {
                // CALL instruction
                pos++;

                // Parse address (20 bytes)
                address target = address(bytes20(bytecode[pos:pos + 20]));
                pos += 20;

                // Parse calldata length (4 bytes)
                uint32 dataLength = uint32(bytes4(bytecode[pos:pos + 4]));
                pos += 4;

                // Parse call data
                bytes memory callData = new bytes(dataLength);
                for (uint i = 0; i < dataLength; i++) {
                    callData[i] = bytecode[pos + i];
                }

                // Replace $ placeholders with previous result
                callData = replacePlaceholders(callData, previousResult);
                pos += dataLength;

                // Execute call
                uint256 gasBefore = gasleft();
                (bool success, bytes memory returnData) = target.call(callData);
                uint256 gasUsed = gasBefore - gasleft();

                // Store result
                history.push(CallResult(success, returnData, gasUsed));
                previousResult = returnData;

                // Extract selector for event
                bytes4 selector = bytes4(callData);

                // Emit events
                emit Execution(target, selector, gasUsed, success);
            } else if (bytecode[pos] == 0xff) {
                // Breath marker
                pos++;
                // Poetic pause - do nothing
            } else {
                revert("Invalid instruction");
            }
        }

        return true;
    }

    function replacePlaceholders(
        bytes memory data,
        bytes memory replacement
    ) internal pure returns (bytes memory) {
        // Replace 32-byte sequences of 0xff with previous result
        bytes32 placeholder = 0xffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff;

        if (data.length >= 32 && replacement.length >= 32) {
            for (uint i = 0; i <= data.length - 32; i++) {
                bytes32 chunk;
                assembly {
                    chunk := mload(add(add(data, 0x20), i))
                }

                if (chunk == placeholder) {
                    // Replace with first 32 bytes of previous result
                    bytes32 replacementChunk;
                    assembly {
                        replacementChunk := mload(add(replacement, 0x20))
                    }

                    assembly {
                        mstore(add(add(data, 0x20), i), replacementChunk)
                    }
                }
            }
        }

        return data;
    }

    function getResult(
        uint256 index
    ) external view returns (CallResult memory) {
        require(index < history.length, "Index out of bounds");
        return history[index];
    }

    function getLastResult() external view returns (CallResult memory) {
        require(history.length > 0, "No results");
        return history[history.length - 1];
    }

    function getResultCount() external view returns (uint256) {
        return history.length;
    }
}
