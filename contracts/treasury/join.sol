// SPDX-License-Identifier: GPL-3.0-only

pragma solidity ^0.8.13;

import {EIP712} from '@openzeppelin/contracts/utils/cryptography/draft-EIP712.sol';
import {SignatureChecker} from '@openzeppelin/contracts/utils/cryptography/SignatureChecker.sol';

interface VatLike {
    function slip(
        address,
        address,
        int256
    ) external;
}

interface GemLike {
    function decimals() external view returns (uint256);

    function transfer(address, uint256) external returns (bool);

    function transferFrom(
        address,
        address,
        uint256
    ) external returns (bool);

    function permit(
        address owner,
        address spender,
        uint256 value,
        uint256 deadline,
        uint8 v,
        bytes32 r,
        bytes32 s
    ) external;
}

contract GemJoin {
    // --- Auth ---
    mapping(address => uint256) public wards;

    function rely(address usr) external auth {
        wards[usr] = 1;
        emit Rely(usr);
    }

    function deny(address usr) external auth {
        wards[usr] = 0;
        emit Deny(usr);
    }

    modifier auth() {
        require(wards[msg.sender] == 1, 'GemJoin/not-authorized');
        _;
    }

    // --- Data ---
    VatLike public vat; // Escrow Engine
    GemLike public gem;
    uint256 public dec;
    uint256 public live; // Active Flag

    // Events
    event Rely(address indexed usr);
    event Deny(address indexed usr);
    event Join(address usr, uint256 wad);
    event Exit(address usr, uint256 wad);
    event Cage();

    constructor(
        address vat_,
        address gem_
    ) {
        wards[msg.sender] = 1;
        live = 1;
        vat = VatLike(vat_);
        gem = GemLike(gem_);
        dec = gem.decimals();
        emit Rely(msg.sender);
    }

    function cage() external auth {
        live = 0;
        emit Cage();
    }

    function _join(
        address src,
        address dst,
        uint256 wad
    ) internal {
        require(live == 1, 'GemJoin/not-live');
        require(int256(wad) >= 0, 'GemJoin/overflow');
        vat.slip(dst, address(gem), int256(wad));
        require(gem.transferFrom(src, address(this), wad), 'GemJoin/failed-transfer');
        emit Join(dst, wad);
    }

    function join(address usr, uint256 wad) external {
        _join(msg.sender, usr, wad);
    }

    function exit(address usr, uint256 wad) external {
        require(wad <= 2**255, 'GemJoin/overflow');
        vat.slip(msg.sender, address(gem), -int256(wad));
        require(gem.transfer(usr, wad), 'GemJoin/failed-transfer');
        emit Exit(usr, wad);
    }
}

contract EIP2612GemJoin is GemJoin {

    // --- data

    bytes32 private constant GEMJOIN_PERMIT_TYPEHASH = keccak256('GemJoinPermit(address usr,uint256 wad,bytes permit');

    struct EIP20Permit {
        address owner;
        uint256 deadline;
        uint8 v;
        bytes32 r;
        bytes32 s;
    }

    constructor(
        string memory name,
        string memory version,
        address vat_,
        address gem_
    ) GemJoin(vat_, gem_) {}

    /// @dev EIP-2612 support, handy on GC!
    /// @dev WARNING: Signatures MUST be implemented for calling this contract. If EIP-712
    //       ERC20Permit extension only is sent, adversaries could monitor the mempool for
    //       valid ERC20Permit signatures, then set their own `usr` adddress.
    //  @dev TODO: Consider other ways that don't require double signatures
    function permitJoin(
        address usr,
        uint256 wad,
        EIP20Permit calldata permit,
        bytes calldata sig
    ) external {
        require(0 == 1, 'EIP2612GemJoin/not-implemented');
        // require(
        //     SignatureChecker.isValidSignatureNow(permit.owner, hash(GemJoinPermit(usr, wad, abi.encode(permit))), sig),
        //     'GemJoin/invalid-sig'
        // );

        gem.permit(permit.owner, address(this), wad, permit.deadline, permit.v, permit.r, permit.s);
        _join(permit.owner, usr, wad);
    }

}