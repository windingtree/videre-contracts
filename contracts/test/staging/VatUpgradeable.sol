// SPDX-License-Identifier: GPL-3.0-only

pragma solidity ^0.8.13;

import {Vat} from '../../treasury/vat.sol';

contract VatUpgradeable is Vat {
    constructor() Vat() {}

    function postUpgrade() public {
        if (upgrader == address(0)) {
            upgrader = msg.sender;
        }
        require(upgrader == msg.sender, 'postUpgrade/not-deployer');

        // do normal 'constructor stuff'
        wards[msg.sender] = 1;
        live = 1;
    }

    uint256[50] private __gap;
    address public upgrader;
}
