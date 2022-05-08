// SPDX-License-Identifier: GPL-3.0-only

pragma solidity ^0.8.13;

interface VatLike {
  function suck(bytes32 src, address dst, address t, uint256 wad, uint256 fee) external;
}
interface GemJoinLike {
  function gem() external view returns (address);
  function exit(address usr, uint wad) external;
}
interface RegistryLike {
  function can(bytes32 which, uint256 what, address who) external view returns (bool);
}

contract VatProviderAdaptor {
  // --- Auth ---
  mapping (address => uint) public wards;
  function rely(address usr) external auth { wards[usr] = 1; }
  function deny(address usr) external auth { wards[usr] = 0; }
  modifier auth {
      require(wards[msg.sender] == 1, "Vat/not-authorized");
      _;
  }

  modifier onlyAdmin(bytes32 sp) {
    require(registry.can(sp, role, msg.sender), "Adaptor/not-authorized");
    _;
  }

  mapping (bytes32 => mapping (address => uint256)) public can;     // service provider => address => 1 or 0
  function hope(bytes32 sp, address usr) external onlyAdmin(sp) { can[sp][usr] = 1; }
  function nope(bytes32 sp, address usr) external onlyAdmin(sp) { can[sp][usr] = 0; }
  function wish(bytes32 bit, address usr) internal view returns (bool) {
    return (can[bit][usr] == 1);
  }

  // --- Data ---
  VatLike public vat;             // Escrow engine
  RegistryLike public registry;   // service provider registry

  uint256 private role;           // adminstrator role on service provider registry

  // --- Events
  event Rely(address indexed usr);
  event Deny(address indexed usr);

  // --- Init
  constructor(VatLike _vat, RegistryLike _registry, uint256 _role) {
    wards[msg.sender] = 1;
    vat = _vat;
    registry = _registry;
    role = _role;
  }

  function exit(bytes32 sp, GemJoinLike join, address dst, uint256 wad) external {
    require(wish(sp, msg.sender), "Adaptor/not-authorized");

    // NOTE: 0 fee set here for testing
    vat.suck(sp, address(this), join.gem(), wad, 0);
    join.exit(dst, wad);
  }
}