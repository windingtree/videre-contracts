// SPDX-License-Identifier: GPL-3.0-only
pragma solidity ^0.8.13;

// @dev ADMIN full administrative privileges can manage all roles
// @dev API can sign data published in dataURI
// @dev BIDDER can sign bids sent to consumers over the messaging system
// @dev MANAGER can add staff and perform non-critical tasks (no finance access)
// @dev FINANCE can retrieve funds owned by the service provider
// @dev STAFF non-critical tasks
// @dev WRITE = (ADMIN || API || MANAGER || WRITE)
enum Role {
    ADMIN,
    API,
    BIDDER,
    MANAGER,
    FINANCE,
    STAFF,
    WRITE
}

/// @title A generic service provider registry interface
/// @author mfw78 <mfw78@protonmail.com>
/// @notice Use this registry to get information about a service provider
interface IServiceProviderRegistry {
    event ServiceProviderRegistered(bytes32 which, address who);
    event ServiceProviderUpdated(bytes32 which);

    /// @notice Enroll a service provider in the registry
    /// @dev Require the dataURI to be specified
    /// @return The service provider's identifier
    function enroll(bytes32 salt, string memory dataURI) external returns (bytes32);

    /// @notice set a specific string on a service provider
    /// @param which service provider to set the string on
    /// @param what string to set
    /// @param data the string to set
    function file(
        bytes32 which,
        bytes32 what,
        string memory data
    ) external;

    /// @notice Role based access control
    /// @param which service provider to check for RBAC
    /// @param what role or role group to check access for
    /// @param who is trying to request access
    /// @return true if who can access what on which service provider
    function can(
        bytes32 which,
        Role what,
        address who
    ) external view returns (bool);

    /// @notice Does a service provider exist?
    /// @param which service provider to check the existence of
    /// @return true if the service provider exists, false otherwise
    function exists(bytes32 which) external view returns (bool);
}
