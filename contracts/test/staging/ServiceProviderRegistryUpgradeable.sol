// SPDX-License-Identifier: GPL-3.0-only

pragma solidity ^0.8.13;

import "@openzeppelin/contracts/utils/StorageSlot.sol";

import { AbstractWhitelistExpiry } from "../../access/AbstractWhitelistExpiry.sol";
import { ServiceProviderRegistry } from "../../registries/ServiceProviderRegistry.sol";

import "hardhat/console.sol";

contract ServiceProviderRegistryUpgradeable is ServiceProviderRegistry {

  constructor(
    uint256 whitelistTTL
  ) ServiceProviderRegistry(
    whitelistTTL
  ) {}

  function postUpgrade(
    uint256 whitelistTTL
  ) public {
    console.log(msg.sender);
    if (upgrader == address(0)) {
      upgrader = _msgSender();
    }
    require(upgrader == _msgSender(), "postUpgrade/not-deployer");

    // do normal 'constructor stuff'
    _setupRole(DEFAULT_ADMIN_ROLE, _msgSender());
    end = block.timestamp + whitelistTTL;
  }

  uint256[50] private __gap;
  address private upgrader;
}