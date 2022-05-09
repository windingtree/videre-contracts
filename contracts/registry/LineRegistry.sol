// SPDX-License-Identifier: GPL-3.0-only

pragma solidity ^0.8.13;

import {Context} from "@openzeppelin/contracts/utils/Context.sol";

import {IServiceProviderRegistry, Role} from '../interfaces/IServiceProviderRegistry.sol';
import {ILineRegistry} from '../interfaces/ILineRegistry.sol';

/// @title Economic line registry (ie. registry of Industries)
/// @author mfw78 <mfw78@protonmail.com>
contract LineRegistry is ILineRegistry, Context {
    // --- Auth
    mapping(address => uint256) public wards;

    function rely(address usr) external auth {
        wards[usr] = 1;
    }

    function deny(address usr) external auth {
        wards[usr] = 0;
    }

    modifier auth() {
        require(wards[msg.sender] == 1, 'Registry/not-authorized');
        _;
    }
    mapping(bytes32 => mapping(bytes32 => uint256)) private gatekeeper;
    uint256 private selfRegister;

    /// @inheritdoc ILineRegistry
    function hope(bytes32 line, bytes32 which) external auth {
        gatekeeper[line][which] = 1;
    }

    /// @inheritdoc ILineRegistry
    function nope(bytes32 line, bytes32 which) external auth {
        gatekeeper[line][which] = 0;
    }

    modifier enabled() {
        require(selfRegister == 1, 'registry/not-authorized');
        _;
    }

    modifier onlyServiceProviderAdmin(bytes32 which) {
        require(serviceProviderRegistry.can(which, Role.ADMIN, _msgSender()), 'registry/not-authorized');
        _;
    }

    /// @inheritdoc ILineRegistry
    function can(bytes32 line, bytes32 which) public view returns (bool) {
        // @dev this requirement allows lines of industries to be removed without removing mapped state
        require(exists(line), 'registry/no-such-line');
        return (gatekeeper[line][which] == 1);
    }

    // --- data
    IServiceProviderRegistry public serviceProviderRegistry;

    struct Line {
        address terms;
        uint96 cut;
    }

    mapping(bytes32 => Line) public lines;

    function terms(bytes32 line) external view returns (address) {
        Line storage l = lines[line];
        return l.terms;
    }

    function cut(bytes32 line) external view returns (uint256) {
        Line storage l = lines[line];
        return uint256(l.cut);
    }

    /// @param registry of service providers conforming to the `IServiceProviderRegistry`
    constructor(IServiceProviderRegistry registry, uint256 _selfRegister) {
        wards[_msgSender()] = 1;
        serviceProviderRegistry = registry;
        selfRegister = _selfRegister;
    }

    /// @inheritdoc ILineRegistry
    function file(
        bytes32 what,
        bytes32 line,
        address data
    ) external auth {
        /// @dev setting address(0) for terms effectively disables an entire line
        if (what == 'terms') lines[line].terms = data;
        else if (what == 'service_provider_registry') serviceProviderRegistry = IServiceProviderRegistry(data);
        else revert('registry/file-unrecognized-param');
    }

    /// @inheritdoc ILineRegistry
    function file(
        bytes32 what,
        bytes32 line,
        uint256 data
    ) external auth {
        if (what == 'self_register') selfRegister = data;
        else if (what == 'cut') lines[line].cut = uint96(data);
        else revert('registry/file-unrecognized-param');
    }

    /// @inheritdoc ILineRegistry
    function exists(bytes32 line) public view returns (bool) {
        return (lines[line].terms != address(0));
    }

    /// @inheritdoc ILineRegistry
    function register(bytes32 line, bytes32 which) public enabled onlyServiceProviderAdmin(which) {
        require(serviceProviderRegistry.exists(which), 'registry/no-such-provider');
        require(exists(line), 'registry/no-such-line');
        gatekeeper[line][which] = 1;
    }

    /// @inheritdoc ILineRegistry
    /// @dev Irrespective, all vouchers issued will remain valid per their terms
    /// @dev does not check if a line exists beforehand!
    function deregister(bytes32 line, bytes32 which) public onlyServiceProviderAdmin(which) {
        require(serviceProviderRegistry.exists(which), 'registry/no-such-provider');
        gatekeeper[line][which] = 0;
    }
}
