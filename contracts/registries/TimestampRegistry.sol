// SPDX-License-Identifier: GPL-3.0-only

pragma solidity ^0.8.13;

import {ITimestampRegistry} from '../interfaces/ITimestampRegistry.sol';

/// @title A simple timestamp registry implementation
/// @author mfw78 <mfw78@protonmail.com>
contract TimestampRegistry is ITimestampRegistry {
    // --- data ---
    /// @inheritdoc ITimestampRegistry
    mapping(bytes32 => uint256) public when;

    /// @inheritdoc ITimestampRegistry
    /// @dev Make sure the hash hasn't already been timestamped.
    function chop(bytes32 hash) external override {
        require(when[hash] == 0, 'timestamp/already-stamped');
        when[hash] = block.timestamp;
    }
}
