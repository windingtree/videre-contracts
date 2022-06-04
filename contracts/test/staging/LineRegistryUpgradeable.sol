// SPDX-License-Identifier: GPL-3.0-only

pragma solidity ^0.8.13;

import '@openzeppelin/contracts/utils/StorageSlot.sol';

import {IServiceProviderRegistry} from '../../interfaces/IServiceProviderRegistry.sol';
import {LineRegistry} from '../../registries/LineRegistry.sol';

contract LineRegistryUpgradeable is LineRegistry {
    constructor(IServiceProviderRegistry registry, uint256 _selfRegister) LineRegistry(registry, _selfRegister) {}

    function postUpgrade(IServiceProviderRegistry registry, uint256 _selfRegister) public {
        if (upgrader == address(0)) {
            upgrader = _msgSender();
        }
        require(upgrader == _msgSender(), 'postUpgrade/not-deployer');

        // do normal 'constructor stuff'
        wards[_msgSender()] = 1;
        serviceProviderRegistry = registry;
        StorageSlot
            .getUint256Slot(0x0000000000000000000000000000000000000000000000000000000000000002)
            .value = _selfRegister;
    }

    uint256[50] private __gap;
    address private upgrader;
}
