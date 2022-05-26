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
    mapping(bytes32 => mapping(address => uint256)) public bags; // [wad] - providers & stubs
    mapping(address => mapping(address => uint256)) public gems; // [wad] - depositors (providers & consumers)

    mapping(bytes32 => address) public owns; // owners of stubs

    uint256 public live; // Active flag

    // --- Init
    constructor() {
        wards[msg.sender] = 1;
        live = 1;
    }

    // --- Math ---
    function _add(uint256 x, int256 y) internal pure returns (uint256 z) {
        unchecked {
            z = x + uint256(y);
            require(y >= 0 || z <= x);
            require(y <= 0 || z >= x);            
        }
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
        address gem,
        int256 wad
    ) external auth {
        gems[usr][gem] = _add(gems[usr][gem], wad);
    }

    function slip(
        bytes32 who,
        address gem,
        int256 wad
    ) external auth {
        bags[who][gem] = _add(bags[who][gem], wad);
    }

    /// @dev Normal accounts
    function flux(
        address src,
        address dst,
        address gem,
        uint256 wad
    ) external {
        require(wish(src, msg.sender), 'Vat/not-allowed');
        gems[src][gem] = gems[src][gem] - wad;
        gems[dst][gem] = gems[dst][gem] + wad;
    }

    // --- Stub Handling
    function deal(
        bytes32 stub,
        address usr,
        address gem,
        uint256 wad,
        uint256 fee
    ) external auth {
        // system is live
        require(live == 1, 'Vat/not-live');
        // stub does not exist
        require(both(bags[stub][gem] == 0, owns[stub] == address(0)), 'Vat/stub-exists');
        // user must not be zero address
        require(usr != address(0), 'Vat/invalid-usr');
        // user has enough funds to pay
        require(gems[usr][gem] >= wad, 'Vat/insufficient-funds');
        // protocol fee isn't higher than cost
        require(fee <= wad, 'Vat/fee-too-high');

        address i = msg.sender; // the industry

        uint256 net = _sub(wad, fee); // calculate net stub cost
        gems[usr][gem] = _sub(gems[usr][gem], wad); // deduct user's account
        bags[stub][gem] = net; // capitalise the stub
        gems[i][gem] += fee; // pay the protocol fee

        owns[stub] = usr; // set the stub's owner
    }

    // --- Stub fungibility
    function swap(
        bytes32 stub,
        address src,
        address dst,
        address gem,
        uint256 wad,
        uint256 fee
    ) external auth {
        // system is live
        require(live == 1, 'Vat/not-live');
        // stub owner is correct
        require(owns[stub] == src, 'Vat/not-allowed');
        // dst must not be zero address
        require(dst != address(0), 'Vat/invalid-dst');
        // user has enough funds to pay
        require(gems[dst][gem] >= wad, 'Vat/insufficient-funds');
        // protocol fee isn't higher than cost
        require(fee <= wad, 'Vat/fee-too-high');

        uint256 net = _sub(wad, fee); // calculate net stub cost
        gems[dst][gem] = _sub(gems[dst][gem], wad); // deduct user's account
        gems[src][gem] += net; // pay the seller
        bags[stub][gem] += fee; // add capital to the stub

        owns[stub] = dst; // set the stub's owner
    }

    // --- Stub settlement
    function move(
        bytes32 src,
        bytes32 dst,
        address gem,
        uint256 wad,
        uint256 fee
    ) external auth {
        // system is live
        require(live == 1, 'Vat/not-live');
        // protocol fee isn't higher than amount
        require(fee <= wad, 'Vat/fee-too-high');
        // make sure there's enough funds to be moved
        require(wad <= bags[src][gem], 'Vat/insufficient-funds');
        // cannot move capital from service provider
        // (a service provider has no owner)
        require(owns[src] != address(0), 'Vat/not-stub');

        address i = msg.sender;

        uint256 net = _sub(wad, fee);
        bags[src][gem] = _sub(bags[src][gem], wad);
        bags[dst][gem] += net;

        gems[i][gem] += fee;

        // cleanup
        if (bags[src][gem] == 0) {
            delete owns[src];
            delete bags[src][gem];
        }
    }

    function suck(
        bytes32 src,
        address dst,
        address gem,
        uint256 wad,
        uint256 fee
    ) external auth {
        // system is live
        require(live == 1, 'Vat/not-live');
        // protocol fee isn't higher than amount
        require(fee <= wad, 'Vat/fee-too-high');
        // make sure enough funds to be sucked
        require(wad <= bags[src][gem], 'Vat/insufficient-funds');
        // make sure it is a service provider (ie. no owns)
        require(owns[src] == address(0), 'Vat/not-service-provider');

        address i = msg.sender;

        uint256 net = _sub(wad, fee);
        bags[src][gem] = _sub(bags[src][gem], wad);
        gems[dst][gem] += net;

        gems[i][gem] += fee;
    }
}
