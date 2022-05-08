// SPDX-License-Identifier: GPL-3.0-only

pragma solidity ^0.8.13;

/// @title Registry of industrial lines served by Videre.
/// @author mfw78 <mfw78@protonmail.com>
interface ILineRegistry {
    // --- auth

    /// @notice Get service provider's permissions on an industry
    /// @param line of industry to check permissions on
    /// @param which service provider's permissions to check
    /// @return true if which service provider is authorised on line industry
    function can(bytes32 line, bytes32 which) external view returns (bool);

    /// @notice Root method to add a service provider's authorisation
    /// @param line of industry to hope privileges on
    /// @param which service provider to hope
    function hope(bytes32 line, bytes32 which) external;

    /// @notice Root method to remove a service provider's authorisation
    /// @param line of industry to deny privileges on
    /// @param which service provider to deny
    function nope(bytes32 line, bytes32 which) external;

    // --- setters

    /// @notice set a specific address parameter on the registry
    /// @param what data to set
    /// @param line on which to set address data (optional depending on `what`)
    /// @param data address to set
    function file(
        bytes32 what,
        bytes32 line,
        address data
    ) external;

    /// @notice set a specific uint parameter on the registry
    /// @param what data to set
    /// @param line on which to set uint data (option depending on `what`)
    /// @param data uint to set
    function file(
        bytes32 what,
        bytes32 line,
        uint256 data
    ) external;

    // --- getters
    /// @notice Protocol fee levied on industrial line
    /// @param line of industry for protocol fee
    /// @return protocol fee levied in milli basis points
    function cut(bytes32 line) external view returns (uint256);

    /// @notice Pointer to the industry-specific terms contract.
    /// @param line of industry for which contract to get
    /// @return address of contract
    function terms(bytes32 line) external view returns (address);

    /// @notice Whether an industrial line exists
    /// @param line of industry to check the existance of
    /// @return true if the line of industry exists in videre
    function exists(bytes32 line) external view returns (bool);

    // --- user facing functions / interactions

    /// @notice Register a service provider for an industry
    /// @param line of industry to register on
    /// @param which service provider to register
    /// @dev only allowed by authorised admins on service provider
    function register(bytes32 line, bytes32 which) external;

    /// @notice Deregister a service provider for an industry
    /// @param line of industry to deregister from
    /// @param which service provider to deregitser
    /// @dev only allowed by authorised admins on service provider
    function deregister(bytes32 line, bytes32 which) external;
}
