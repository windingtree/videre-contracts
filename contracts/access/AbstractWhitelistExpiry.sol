// SPDX-License-Identifier: GPL-3.0-only

pragma solidity ^0.8.13;

import {AccessControl} from "@openzeppelin/contracts/access/AccessControl.sol";

/// @title Enforce whitelisting with an expiration for opening access to all.
/// @author mfw78 <mfw78@protonmail.com>
abstract contract AbstractWhitelistExpiry is AccessControl {
  // --- data
  /// @dev unique hash for whitelist role
  bytes32 private constant WHITELIST_ROLE = keccak256("videre.roles.whitelist");
  /// @dev unix timestamp for the end of the whitelist period
  uint256 internal end;

  // --- events
  event WhitelistChanged(uint256 end);

  // --- auth
  /// @dev Access only for those on the whitelist, or after whitelist time
  modifier onlyWhitelist() {
    require(block.timestamp > end || hasRole(WHITELIST_ROLE, _msgSender()), "whitelist/not-authorized");
    _;
  }

  /// @param expiry for when the whitelist ceases to be a restriction
  constructor(uint256 expiry) {
    require(expiry > block.timestamp, "whitelist/not-future");
    end = expiry;
  }

  /// @notice Set when to end
  /// @param when to end the whitelist period
  /// @dev May only be brought forward in time, cannot continue delaying
  /// @dev Internal function that must be authed in inheriting contract
  function file(uint256 when) internal {
    require(when < end, "registry/whitelist-later");
    end = when;
    emit WhitelistChanged(end);
  }
}