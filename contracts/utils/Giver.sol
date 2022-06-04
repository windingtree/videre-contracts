// SPDX-License-Identifier: GPL-3.0-only

pragma solidity ^0.8.13;

import '@openzeppelin/contracts/utils/Address.sol';
import '@openzeppelin/contracts/token/ERC20/ERC20.sol';

interface ERC20MintLike {
    function mint(address to, uint256 amount) external;
}

interface ServiceProviderRegistryLike {
    function grantRole(bytes32 role, address account) external;
}

bytes32 constant WHITELIST_ROLE = keccak256('videre.roles.whitelist');

/// @title Give some gas and tokens
/// @dev Distribution contract used for minting test tokens and allocating privileges
contract Giver {

    // --- Auth
    mapping(address => uint256) public wards;

    function rely(address usr) external auth {
        wards[usr] = 1;
    }

    function deny(address usr) external auth {
        wards[usr] = 0;
    }

    modifier auth() {
        require(wards[msg.sender] == 1, 'Giver/not-authorized');
        _;
    }

    /// @dev the token that will be minted to the user, must support MintLike
    ERC20MintLike internal gem;   // token to be minted

    /// @dev registry to which to authorize the user on the whitelist
    ServiceProviderRegistryLike internal serviceProviderRegistry;

    constructor(
        ERC20MintLike _gem,
        ServiceProviderRegistryLike _serviceProviderRegistry
    ) {
        // add deployer to auth list
        wards[msg.sender] = 1;

        // set parameters
        gem = _gem;

        // set the registry
        serviceProviderRegistry = _serviceProviderRegistry;
    }

    /// @dev atomically seed a new guesthouse
    function seed(address payable to, uint256 wadGem) external payable auth {
        // ensure on the whitelist
        _whitelist(to);

        // give some tokens
        _drip(to, wadGem);

        // give some gas (that was paid to this function)
        if (msg.value != 0) Address.sendValue(to, msg.value);
    }

    /// @dev just drip some tokens from the faucet
    function drip(address payable to, uint256 wad) external auth {
        _drip(to, wad);
    }

    /// @dev just add to the whitelist
    function whitelist(address who) external auth {
        _whitelist(who);
    }

    // --- internal helpers

    function _whitelist(address who) internal {
        serviceProviderRegistry.grantRole(WHITELIST_ROLE, who);
    }

    function _drip(address payable to, uint256 wad) internal {
        // give some tokens
        if (wad != 0) {
            gem.mint(to, wad);
        }
    }

}