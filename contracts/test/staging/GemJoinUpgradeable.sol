// SPDX-License-Identifier: GPL-3.0-only

pragma solidity ^0.8.13;

import { GemJoin, VatLike, GemLike } from "../../treasury/join.sol";

contract GemJoinUpgradeable is GemJoin {

    constructor(address vat_,address gem_) GemJoin(vat_, gem_) {}

    function postUpgrade(address vat_,address gem_) public {
        if (upgrader == address(0)) {
            upgrader = msg.sender;
        }
        require(upgrader == msg.sender, "postUpgrade/not-deployer");

        // do normal 'constructor stuff'
        wards[msg.sender] = 1;
        live = 1;

        vat = VatLike(vat_);
        gem = GemLike(gem_);
        dec = gem.decimals();
        emit Rely(msg.sender);
  }

  uint256[50] private __gap;
  address private upgrader;

}
