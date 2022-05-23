// SPDX-License-Identifier: GPL-3.0-only

pragma solidity ^0.8.13;

import {AccessControl} from '@openzeppelin/contracts/access/AccessControl.sol';
import {Multicall} from '@openzeppelin/contracts/utils/Multicall.sol';

import {IServiceProviderRegistry, Role} from '../interfaces/IServiceProviderRegistry.sol';

import {AbstractTimestampedAccessControl} from '../access/AbstractTimestampedAccessControl.sol';
import {AbstractWhitelistExpiry} from '../access/AbstractWhitelistExpiry.sol';

/// @title A source of service providers
/// @author mfw78 <mfw78@protonmail.com>
contract ServiceProviderRegistry is IServiceProviderRegistry, AbstractTimestampedAccessControl, AbstractWhitelistExpiry, Multicall {
    // --- data ---

    // TODO: Analyse setting maximum TTL for accounts to prevent malicious signers granting tickets.
    mapping(bytes32 => string) public datastores;
    mapping(bytes32 => uint256) public maxTTL;
    uint256 public minTTL;

    // --- auth ---

    /// @dev Root access
    modifier auth() {
        require(hasRole(DEFAULT_ADMIN_ROLE, _msgSender()), 'registry/root-not-authorized');
        _;
    }

    modifier onlyAdmin(bytes32 which) {
        require(can(which, Role.ADMIN, _msgSender()), 'registry/admin-not-authorized');
        _;
    }

    /// @dev Only for those with defined write access on the service provider
    modifier onlyWrite(bytes32 which) {
        require(can(which, Role.WRITE, _msgSender()), 'registry/write-not-authorized');
        _;
    }

    /// TODO: Standardise around can() returns to uint for gas savings
    /// TODO: Add hadRole for timestamped access control
    /// @inheritdoc IServiceProviderRegistry
    function can(
        bytes32 which,
        Role what,
        address who
    ) public view returns (bool) {
        // @dev write role can be admins, apis, or managers.
        if (what == Role.WRITE) {
            return (hasRole(_calcRole(which, Role.WRITE), who) ||
                hasRole(_calcRole(which, Role.MANAGER), who) ||
                hasRole(_calcRole(which, Role.API), who) ||
                hasRole(_calcRole(which, Role.ADMIN), who));
        } else {
            return hasRole(_calcRole(which, what), who);
        }
    }

    /// @notice Calculate the role hash for a service provider and specific role type
    /// @param which service provider the role shall exist for
    /// @param what role to calculate for which provider
    /// @return the combined role hash
    function _calcRole(bytes32 which, Role what) internal pure returns (bytes32) {
        return keccak256(abi.encodePacked(which, uint256(what)));
    }

    constructor(uint256 whitelistTTL) AbstractWhitelistExpiry(whitelistTTL) {
        _setupRole(DEFAULT_ADMIN_ROLE, _msgSender());
    }

    /// @dev Addresses subjected to whitelisting for defined period of time.
    /// @inheritdoc IServiceProviderRegistry
    function enroll(bytes32 salt, string calldata dataURI) external override onlyWhitelist returns (bytes32 provider) {
        provider = keccak256(abi.encode(salt, _msgSender()));
        require(!exists(provider), 'registry/provider-exists');
        require(bytes(dataURI).length > 0, 'registry/require-uri');

        /// @dev add data URI and set permissions
        datastores[provider] = dataURI;

        /// @dev setup roles
        bytes32 adminRole = _calcRole(provider, Role.ADMIN);
        _grantRole(adminRole, _msgSender()); // grant admin role to the creator of this provider
        _setRoleAdmin(adminRole, adminRole); // only the admin role can maintain itself

        _setRoleAdmin(_calcRole(provider, Role.API), adminRole);
        _setRoleAdmin(_calcRole(provider, Role.BIDDER), adminRole);
        _setRoleAdmin(_calcRole(provider, Role.MANAGER), adminRole);
        _setRoleAdmin(_calcRole(provider, Role.STAFF), adminRole);
        _setRoleAdmin(_calcRole(provider, Role.WRITE), adminRole);

        emit ServiceProviderRegistered(provider, _msgSender());
    }

    /// @inheritdoc IServiceProviderRegistry
    function exists(bytes32 which) public view returns (bool) {
        return (bytes(datastores[which]).length > 0);
    }

    /// @inheritdoc IServiceProviderRegistry
    function file(
        bytes32 which,
        bytes32 what,
        string calldata data
    ) external override onlyWrite(which) {
        if (what == 'dataURI') {
            require(bytes(data).length > 0, 'registry/require-uri');
            datastores[which] = data;
            emit ServiceProviderUpdated(which);
        } else {
            revert('registry/file-unrecognized-param');
        }
    }

    function file(
        bytes32 which,
        bytes32 what,
        uint256 data
    ) external onlyAdmin(which) {
        if (what == 'maxTTL') maxTTL[which] = data;
        else revert('registry/file-unrecognized-param');
    }

    /// @notice File integer parameters
    /// @param what parameter to file
    /// @param data to set the parameter to
    function file(bytes32 what, uint256 data) external auth {
        /// @dev only allow moving end of whitelist earlier
        if (what == 'end') AbstractWhitelistExpiry.file(data);
        else if (what == 'minTTL') minTTL = data;
        else revert('registry/file-unrecognized-param');
    }

    function _grantRole(bytes32 role, address account) internal override(AccessControl, AbstractTimestampedAccessControl) {
        AbstractTimestampedAccessControl._grantRole(role, account);
    }

    function _revokeRole(bytes32 role, address account) internal override(AccessControl, AbstractTimestampedAccessControl) {
        AbstractTimestampedAccessControl._revokeRole(role, account);
    }
}
