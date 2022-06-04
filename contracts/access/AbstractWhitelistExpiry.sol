// SPDX-License-Identifier: GPL-3.0-only

pragma solidity ^0.8.13;

import {AccessControl} from '@openzeppelin/contracts/access/AccessControl.sol';

/// @title Enforce whitelisting with an expiration for opening access to all.
/// @author mfw78 <mfw78@protonmail.com>
abstract contract AbstractWhitelistExpiry is AccessControl {
    // --- data
    /// @dev unique hash for whitelist role
    bytes32 private constant WHITELIST_ROLE = keccak256('videre.roles.whitelist');
    /// @dev unix timestamp for the end of the whitelist period
    uint256 public end;

    // --- events
    event WhitelistChanged(uint256);

    // --- auth
    /// @dev Access only for those on the whitelist, or after whitelist time
    modifier onlyWhitelist() {
        require(block.timestamp > end || hasRole(WHITELIST_ROLE, _msgSender()), 'whitelist/not-authorized');
        _;
    }

    /// @param whitelistTTL how long the whitelist should be valid for
    constructor(uint256 whitelistTTL) {
        end = block.timestamp + whitelistTTL;
        emit WhitelistChanged(end);
    }

    /// @notice Set when to end
    /// @param when to end the whitelist period
    /// @dev May only be brought forward in time, cannot continue delaying
    /// @dev Internal function that must be authed in inheriting contract
    function file(uint256 when) internal {
        require(when < end, 'registry/whitelist-later');
        end = when;
        emit WhitelistChanged(end);
    }
}
