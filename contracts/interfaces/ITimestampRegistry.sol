// SPDX-License-Identifier: GPL-3.0-only

pragma solidity ^0.8.13;

/// @title A generic timestamp registry interface
/// @author mfw78 <mfw78@protonmail.com>
/// @notice Use this timestamp registry to assert when a document existed.
interface ITimestampRegistry {
    /// @notice Register the hash at the current `block.timestamp`.
    /// @param hash of the document being stamped.
    function chop(bytes32 hash) external;

    /// @notice Get the timestamp of the information's hash.
    /// @param hash of the document being queried
    /// @return The timestamp for the document, or 0 if not valid.
    function when(bytes32 hash) external returns (uint256);
}
