// SPDX-License-Identifier: GPL-3.0-only

pragma solidity ^0.8.13;

/// @title Timestamped roles
/// @notice Allows roles to be asserted and avoid intentional revocation / renouncing
///         when trying to disown a signature.
interface ITimestampedAccessControl {
    /// @notice Allow back-in-time on-chain testing of granted role status.
    /// @param role to check was granted
    /// @param account to check the status of
    /// @param when the granted status is being questioned
    /// @return If the account actively had the role at when
    function hadRole(bytes32 role, address account, uint256 when) external returns (bool);
}