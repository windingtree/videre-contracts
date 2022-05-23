// SPDX-License-Identifier: GPL-3.0-only

pragma solidity ^0.8.13;

import {AccessControl} from '@openzeppelin/contracts/access/AccessControl.sol';

import {ITimestampedAccessControl} from '../interfaces/ITimestampedAccessControl.sol';

/// @title Access control adaption to with timestamps of grant / revoked.
/// @dev Does **NOT** support second-round grant / revoke.
/// @author mfw78 <mfw78@protonmail.com>
abstract contract AbstractTimestampedAccessControl is AccessControl, ITimestampedAccessControl {
    // --- data
    mapping(address => mapping(bytes32 => Timestamp)) public watchkeeper;

    struct Timestamp {
        uint128 granted;
        uint128 revoked;
    }

    /// @inheritdoc ITimestampedAccessControl
    function hadRole(
        bytes32 role,
        address account,
        uint256 when
    ) public view returns (bool) {
        Timestamp storage chop = watchkeeper[account][role];
        return (chop.granted <= when && (chop.revoked == 0 || when < chop.revoked));
    }

    /// @dev Standard call for OZ access control, followed by timestamping
    /// @inheritdoc AccessControl
    function _grantRole(bytes32 role, address account) internal virtual override(AccessControl) {
        AccessControl._grantRole(role, account);

        // @dev set the timestamp
        Timestamp storage chop = watchkeeper[account][role];
        require(chop.granted == 0, 'timestamp/previously-granted');
        chop.granted = uint128(block.timestamp);
    }

    /// @dev Standard call for OZ access control, followed by timestamping
    /// @inheritdoc AccessControl
    function _revokeRole(bytes32 role, address account) internal virtual override(AccessControl) {
        AccessControl._revokeRole(role, account);

        // @dev set the timestamp
        Timestamp storage chop = watchkeeper[account][role];
        require(chop.granted > 0 && chop.revoked == 0, 'timestamp/role-not-active');
        chop.revoked = uint128(block.timestamp);
    }
}
