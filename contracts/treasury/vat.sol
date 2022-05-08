// SPDX-License-Identifier: GPL-3.0-only

pragma solidity ^0.8.13;

/// @title Videre escrow database
/// @author mfw78 <mfw78@protonmail.com>
/// @notice Heavy inspiration from the great work at MakerDAO
contract Vat {
    // --- Auth
    mapping(address => uint256) public wards;

    function rely(address usr) external auth {
        require(live == 1, 'Vat/not-live');
        wards[usr] = 1;
    }

    function deny(address usr) external auth {
        require(live == 1, 'Vat/not-live');
        wards[usr] = 0;
    }

    modifier auth() {
        require(wards[msg.sender] == 1, 'Vat/not-authorized');
        _;
    }

    mapping(address => mapping(address => uint256)) public can;

    function hope(address usr) external {
        can[msg.sender][usr] = 1;
    }

    function nope(address usr) external {
        can[msg.sender][usr] = 0;
    }

    function wish(address bit, address usr) internal view returns (bool) {
        return either(bit == usr, can[bit][usr] == 1);
    }

    // --- data
    mapping(bytes32 => mapping(address => uint256)) public bag; // [wad] - providers & vouchers
    mapping(address => mapping(address => uint256)) public gem; // [wad] - depositors (providers & consumers)

    mapping(bytes32 => address) public own; // owners of vouchers

    uint256 public live; // Active flag

    // --- Init
    constructor() {
        wards[msg.sender] = 1;
        live = 1;
    }

    // --- Math ---
    function _add(uint256 x, int256 y) internal pure returns (uint256 z) {
        z = x + uint256(y);
        require(y >= 0 || z <= x);
        require(y <= 0 || z >= x);
    }

    function _sub(uint256 x, uint256 y) internal pure returns (uint256 z) {
        require((z = x - y) <= x);
    }

    function either(bool x, bool y) internal pure returns (bool z) {
        assembly {
            z := or(x, y)
        }
    }

    function both(bool x, bool y) internal pure returns (bool z) {
        assembly {
            z := and(x, y)
        }
    }

    // --- Administration
    function cage() external auth {
        live = 0;
    }

    // --- Fungibility
    function slip(
        address usr,
        address token,
        int256 wad
    ) external auth {
        gem[usr][token] = _add(gem[usr][token], wad);
    }

    function slip(
        bytes32 who,
        address token,
        int256 wad
    ) external auth {
        bag[who][token] = _add(bag[who][token], wad);
    }

    /// @dev Normal accounts
    function flux(
        address src,
        address dst,
        address token,
        uint256 wad
    ) external {
        require(wish(src, msg.sender), 'Vat/not-allowed');
        gem[src][token] = gem[src][token] - wad;
        gem[dst][token] = gem[dst][token] + wad;
    }

    // --- Voucher Handling
    function deal(
        bytes32 v,
        address u,
        address t,
        uint256 wad,
        uint256 fee
    ) external auth {
        // system is live
        require(live == 1, 'Vat/not-live');
        // voucher does not exist
        require(both(bag[v][t] == 0, own[v] == address(0)), 'Vat/voucher-exists');
        // user has enough funds to pay
        require(gem[u][t] >= wad, 'Vat/insufficient-funds');
        // protocol fee isn't higher than cost
        require(fee <= wad, 'Vat/fee-too-high');

        address i = msg.sender; // the industry

        uint256 net = _sub(wad, fee); // calculate net voucher cost
        gem[u][t] = _sub(gem[u][t], wad); // deduct user's account
        bag[v][t] = net; // capitalise the voucher
        gem[i][t] += fee; // pay the protocol fee

        own[v] = u; // set the voucher's owner
    }

    // --- Voucher fungibility
    function swap(
        bytes32 v,
        address src,
        address dst,
        address t,
        uint256 wad,
        uint256 fee
    ) external auth {
        // system is live
        require(live == 1, 'Vat/not-live');
        // voucher owner is correct
        require(own[v] == src, 'Vat/invalid-src');
        // user has enough funds to pay
        require(gem[dst][t] >= wad, 'Vat/insufficient-funds');
        // protocol fee isn't higher than cost
        require(fee <= wad, 'Vat/fee-too-high');

        uint256 net = _sub(wad, fee); // calculate net voucher cost
        gem[dst][t] = _sub(gem[dst][t], wad); // deduct user's account
        gem[src][t] += net; // pay the seller
        bag[v][t] += fee; // add capital to the voucher

        own[v] = dst; // set the voucher's owner
    }

    // --- Voucher settlement
    function move(
        bytes32 src,
        bytes32 dst,
        address t,
        uint256 wad,
        uint256 fee
    ) external auth {
        // system is live
        require(live == 1, 'Vat/not-live');
        // protocol fee isn't higher than amount
        require(fee <= wad, 'Vat/fee-too-high');

        address i = msg.sender;

        uint256 net = _sub(wad, fee);
        bag[src][t] = _sub(bag[src][t], wad);
        bag[dst][t] += net;

        gem[i][t] += fee;

        // cleanup
        if (bag[src][t] == 0) {
            if (own[src] != address(0)) delete own[src];
            delete bag[src][t];
        }
    }

    function suck(
        bytes32 src,
        address dst,
        address t,
        uint256 wad,
        uint256 fee
    ) external auth {
        // system is live
        require(live == 1, 'Vat/not-live');
        // protocol fee isn't higher than amount
        require(fee <= wad, 'Vat/fee-too-high');

        address i = msg.sender;

        uint256 net = _sub(wad, fee);
        bag[src][t] = _sub(bag[src][t], wad);
        gem[dst][t] += net;

        gem[i][t] += fee;
    }
}
