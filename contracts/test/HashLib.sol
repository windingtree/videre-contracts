// SPDX-License-Identifier: GPL-3.0-only

pragma solidity ^0.8.13;

import {LibVidere} from "../libraries/LibVidere.sol";

/// @title Test contract for verifying LibVidere hash functions
contract HashLib {

    /// @dev tests the BidHash
    function bidhash(
        LibVidere.Bid memory bid
    ) public pure returns(bytes32) {
       return LibVidere.hash(bid); 
    }

    /// @dev tests the StubState
    function stubHash(
        LibVidere.StubState memory stub
    ) public pure returns (bytes32) {
        return LibVidere.hash(stub);
    }

    /// @dev test adding some optional items
    function addOptions(
        bytes32[] memory currentItems,
        LibVidere.BidOptionItem[] memory newItems,
        LibVidere.ERC20Native memory currentCost
    ) public pure returns (bytes32[] memory items, LibVidere.ERC20Native memory cost) {
        return LibVidere.addOptions(currentItems, newItems, currentCost);
    }

    /// @dev test adding some optional terms
    function addOptions(
        LibVidere.BidTerm[] memory currentTerms,
        LibVidere.BidOptionTerm[] memory newTerms,
        LibVidere.ERC20Native memory currentCost
    ) public pure returns (LibVidere.BidTerm[] memory terms, LibVidere.ERC20Native memory cost) {
        return LibVidere.addOptions(currentTerms, newTerms, currentCost);
    }

}