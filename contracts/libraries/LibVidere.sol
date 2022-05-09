// SPDX-License-Identifier: GPL-3.0-only

pragma solidity ^0.8.13;

import {EIP712} from "@openzeppelin/contracts/utils/cryptography/draft-EIP712.sol";
import {ECDSA} from "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";

/// @title Videre Library for structs / EIP712 signing
library LibVidere {

  bytes32 private constant ERC20NATIVE_TYPEHASH = keccak256('ERC20Native(address gem,uint256 wad)');
  bytes32 private constant BIDTERM_TYPEHASH = keccak256('BidTerm(bytes32 term,address impl,bytes payload)');
  bytes32 private constant BIDOPTION_ITEM_TYPEHASH = keccak256('BidOptionItem(bytes32 item,ERC20Native[] cost)ERC20Native(address gem,uint256 wad)');
  bytes32 private constant BIDOPTION_TERM_TYPEHASH = keccak256('BidOptionTerm(BidTerm term,ERC20Native[] cost)BidTerm(bytes32 term,address impl,bytes payload)ERC20Native(address gem,uint256 wad)');
  bytes32 private constant BIDOPTIONS_TYPEHASH = keccak256('BidOptions(BidOptionItem[] items,BidOptionTerm[] terms)BidOptionItem(bytes32 item,ERC20Native[] cost)BidOptionTerm(BidTerm term,ERC20Native[] cost)BidTerm(bytes32 term,address impl,bytes payload)ERC20Native(address gem,uint256 wad)');
  bytes32 private constant BID_TYPEHASH = keccak256('Bid(bytes32 salt,uint128 limit,uint128 expiry,bytes32 which,bytes32 params,bytes32[] items,BidTerm[] terms,BidOptions options,ERC20Native[] cost)BidOptionItem(bytes32 item,ERC20Native[] cost)BidOptionTerm(BidTerm term,ERC20Native[] cost)BidOptions(BidOptionItem[] items,BidOptionTerm[] terms)BidTerm(bytes32 term,address impl,bytes payload)ERC20Native(address gem,uint256 wad)');
  bytes32 private constant VOUCHER_STATE_TYPEHASH = keccak256('VoucherState(bytes32 which,bytes32 params,bytes32[] items,BidTerm[] terms,ERC20Native cost)BidTerm(bytes32 term,address impl,bytes payload)ERC20Native(address gem,uint256 wad)');

  // --- ERC20 Native messages
  struct ERC20Native {
    address gem;
    uint256 wad;
  }

  function hash(ERC20Native memory a) internal pure returns (bytes32) {
    return keccak256(
      abi.encode(
        ERC20NATIVE_TYPEHASH,
        a.gem,
        a.wad
      )
    );
  }

  // arrays
  function hash(ERC20Native[] memory a) internal pure returns (bytes32) {
    bytes32[] memory hashes = new bytes32[](a.length);

    // iterate through each ERC20Native and get hash
    for (uint256 i = 0; i < a.length; i++) {
      hashes[i] = hash(a[i]);
    }

    return keccak256(abi.encodePacked(hashes));
  }

  // --- BidTerm messages
  struct BidTerm {
    bytes32 term;
    address impl;
    bytes payload;
  }

  function hash(BidTerm memory a) internal pure returns (bytes32) {
    return keccak256(
      abi.encode(
        BIDTERM_TYPEHASH,
        a.term,
        a.impl,
        keccak256(a.payload)
    ));
  }

  // arrays
  function hash(BidTerm[] memory a) internal pure returns (bytes32) {
    bytes32[] memory hashes = new bytes32[](a.length);

    // iterate through each ERC20BidTermNative and get hash
    for (uint256 i = 0; i < a.length; i++) {
      hashes[i] = hash(a[i]);
    }

    return keccak256(abi.encodePacked(hashes));
  }

  // --- BidOptionItem messages
  struct BidOptionItem {
    bytes32 item;
    ERC20Native[] cost;
  }

  function hash(BidOptionItem memory a) internal pure returns (bytes32) {
    return keccak256(
      abi.encode(
        BIDOPTION_ITEM_TYPEHASH,
        a.item,
        hash(a.cost)
      )
    );
  }

  // arrays
  function hash(BidOptionItem[] memory a) internal pure returns (bytes32) {
    bytes32[] memory hashes = new bytes32[](a.length);

    // iterate through each BidOptionItem and get hash
    for (uint256 i = 0; i < a.length; i++) {
      hashes[i] = hash(a[i]);
    }

    return keccak256(abi.encodePacked(hashes));
  }

  // --- BidOptionTerm messages
  struct BidOptionTerm {
    BidTerm term;
    ERC20Native[] cost;
  }

  function hash(BidOptionTerm memory a) internal pure returns (bytes32) {
    return keccak256(
      abi.encode(
        BIDOPTION_TERM_TYPEHASH,
        hash(a.term),
        hash(a.cost)
      )
    );
  }

  // arrays
  function hash(BidOptionTerm[] memory a) internal pure returns (bytes32) {
    bytes32[] memory hashes = new bytes32[](a.length);

    // iterate through each BidOptionTerm and get hash
    for (uint256 i = 0; i < a.length; i++) {
      hashes[i] = hash(a[i]);
    }

    return keccak256(abi.encodePacked(hashes));
  }

  // --- BidOptions message
  struct BidOptions {
    BidOptionItem[] items;
    BidOptionTerm[] terms;
  }

  function hash(BidOptions memory a) internal pure returns (bytes32) {
    return keccak256(
      abi.encode(
        BIDOPTIONS_TYPEHASH,
        hash(a.items),
        hash(a.terms)
      )
    );
  }

  // --- Bid messge
  struct Bid {
    bytes32 salt;
    uint128 limit;
    uint128 expiry;
    bytes32 which;
    bytes32 params;
    bytes32[] items;
    BidTerm[] terms;
    BidOptions options;
    ERC20Native[] cost;
  }

  function hash(Bid memory a) internal pure returns (bytes32) {
    return keccak256(
      abi.encode(
        BID_TYPEHASH,
        a.salt,
        a.limit,
        a.expiry,
        a.which,
        a.params,
        hash(a.items),
        hash(a.terms),
        hash(a.options),
        hash(a.cost)
      )
    );
  }

  // --- Voucher state
  struct VoucherState {
    bytes32 which;
    bytes32 params;
    bytes32[] items;
    BidTerm[] terms;
    ERC20Native cost;
  }

  struct VoucherStorage {
    bytes32 provider;                 // facility
    bytes32 state;                    // eip712 signed hash of voucher's state
    uint256 step;                     // what step in the lifecycle the voucher is at
    mapping (address => bytes) terms; // term => 1/0 or payload
  }

  function hash(VoucherState memory a) internal pure returns (bytes32) {
    return keccak256(
      abi.encode(
        VOUCHER_STATE_TYPEHASH,
        a.which,
        a.params,
        hash(a.items),
        hash(a.terms),
        hash(a.cost)
      )
    );
  }

  // --- Utility hash functions
  function hash(bytes32[] memory a) internal pure returns (bytes32) {
    return keccak256(abi.encodePacked(a));
  }

  function hash(address[] memory a) internal pure returns (bytes32) {
    return keccak256(abi.encodePacked(a));
  }

  function hash(uint256[] memory a) internal pure returns (bytes32) {
    return keccak256(abi.encodePacked(a));
  }

  function hash(bytes[] memory a) internal pure returns (bytes32) {
    bytes32[] memory hashes = new bytes32[](a.length);

    // iterate through each BidOptionTerm and get hash
    for (uint256 i = 0; i < a.length; i++) {
      hashes[i] = keccak256(a[i]);
    }

    return keccak256(abi.encodePacked(hashes));
  }

  // --- Option processing functions

  function addOptions(
    bytes32[] memory currentItems,
    BidOptionItem[] memory newItems,
    ERC20Native memory currentCost
  ) internal pure returns (bytes32[] memory items, ERC20Native memory cost) {
    items = new bytes32[](currentItems.length + newItems.length);
    cost = currentCost;

    // add all the current items to the items array
    for (uint256 i = 0; i < currentItems.length; i++) {
      items[i] = currentItems[i];
    }

    // add new items to the items array and add cost
    for (uint256 i = 0; i < newItems.length; i++) {
      items[currentItems.length + i] = newItems[i].item;
      cost.wad += wadCost(currentCost.gem, newItems[i].cost);
    }
  }

  function addOptions(
    BidTerm[] memory currentTerms,
    BidOptionTerm[] memory newTerms,
    ERC20Native memory currentCost
  ) internal pure returns (BidTerm[] memory terms, ERC20Native memory cost) {
    terms = new BidTerm[](currentTerms.length + newTerms.length);
    cost = currentCost;

    // add all the current terms to the terms array
    for (uint256 i = 0; i < currentTerms.length; i++) {
      terms[i] = currentTerms[i];
    }

    // add new terms to the terms array and add cost
    for (uint256 i = 0; i < newTerms.length; i++) {
      terms[currentTerms.length + i] = newTerms[i].term;
      cost.wad += wadCost(currentCost.gem, newTerms[i].cost);
    }
  }

  function wadCost(
    address gem,
    ERC20Native[] memory costs
  ) internal pure returns (uint256 wad) {
    uint256 found;
    for (uint256 i = 0; i < costs.length; i++) {
      if (costs[i].gem == gem) {
        found = 1;
        wad = costs[i].wad;
        break;
      }
    }
    require(found == 1, "LibVidere/gem-not-found");
  }

  function gemCost(
    address gem,
    ERC20Native[] memory costs
  ) internal pure returns (ERC20Native memory cost) {
    uint256 found;
    for (uint256 i = 0; i < costs.length; i++) {
      if (costs[i].gem == gem) {
        found = 1;
        cost = costs[i];
        break;
      }
    }
    require(found == 1, "LibVidere/gem-not-found");
  }

}