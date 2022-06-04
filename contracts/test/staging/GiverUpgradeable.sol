// SPDX-License-Identifier: GPL-3.0-only

pragma solidity ^0.8.13;

import {Giver, ERC20MintLike, ServiceProviderRegistryLike} from '../../utils/Giver.sol';

contract GiverUpgradeable is Giver {
    constructor(ERC20MintLike _gem, ServiceProviderRegistryLike _serviceProviderRegistry)
        Giver(_gem, _serviceProviderRegistry)
    {}

    function postUpgrade(ERC20MintLike _gem, ServiceProviderRegistryLike _serviceProviderRegistry) public {
        if (upgrader == address(0)) {
            upgrader = msg.sender;
        }
        require(upgrader == msg.sender, 'postUpgrade/not-deployer');

        // do normal 'constructor stuff'
        wards[msg.sender] = 1;
        gem = _gem;
        serviceProviderRegistry = _serviceProviderRegistry;
    }

    uint256[50] private __gap;
    address private upgrader;
}
