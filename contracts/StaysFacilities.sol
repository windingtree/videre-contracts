// SPDX-License-Identifier: GPL-3.0-only
pragma solidity ^0.8.0;

import {IERC20} from '@openzeppelin/contracts/interfaces/IERC20.sol';

import {Context} from '@openzeppelin/contracts/utils/Context.sol';
import {AccessControl} from '@openzeppelin/contracts/access/AccessControl.sol';
import {EIP712} from '@openzeppelin/contracts/utils/cryptography/draft-EIP712.sol';
import {ECDSA} from '@openzeppelin/contracts/utils/cryptography/ECDSA.sol';

// @title StaysFacility
// @dev `dataURI` in the below structs specifies a URI to a JSON conforming to a defined JSON
//      standard, signed by an API key certified for this facility.
contract StaysFacility is Context, AccessControl, EIP712 {
    // --- structs

    // @dev A simple facility (providing accommodation)
    struct Facility {
        bool active;
        string dataURI;
        string geohash;
    }

    // @dev A space (such as a room)
    struct Space {
        bytes32 facilityId;
        bool active;
        string dataURI;
    }

    // @dev A bid a facility to provide accommodation the guest has asked for
    struct Bid {
        bytes32 facilityHash;
        bytes32 spaceHash;
        bytes32 askDigest;
        bytes32 termsHash;
        uint64 expiry;
        address costToken;
        uint256 costAtoms;
    }

    // --- enums
    enum Role {
        ADMIN,
        API,
        BIDDER,
        MANAGER,
        STAFF
    }

    // constants
    bytes32 constant BID_TYPE =
        keccak256(
            'Bid(bytes32 facilityHash,bytes32 spaceHash,bytes32 askDigest,bytes32 termsHash,uint64 expiry,address costToken,uint256 costAtoms)'
        );

    // facility 'id' to facilities
    mapping(bytes32 => Facility) public facilities;

    // facility 'id' to 'spaceId' to 'Space'
    mapping(bytes32 => mapping(bytes32 => Space)) public spaces;

    modifier onlyAdmin(bytes32 facility) {
        require(hasRole(calcRole(facility, Role.ADMIN), _msgSender()), 'facility/not-admin');
        _;
    }

    modifier onlyWriteAccess(bytes32 facilityHash) {
        require(hasWriteAccess(facilityHash, _msgSender()), 'facility/no-write-access');
        _;
    }

    // --- events
    event FacilityCreated(bytes32 indexed facility, address creator);
    event SpaceCreated(bytes32 indexed facility, bytes32 indexed space);
    // TODO: think more carefully about deal event for proper indexing and alerting
    event Deal(
        bytes32 indexed facility,
        bytes32 indexed spaceHash,
        bytes32 indexed askDigest,
        bytes32 termsHash,
        address costToken,
        uint256 costAtoms
    );

    constructor(string memory name, string memory version) EIP712(name, version) {}

    /**
     * Register a facility
     * @param salt A salt (random or not) used to create the hash for the facility's id.
     * @param _newFacility The facility's data to be stored.
     * @return facilityId The new facility id.
     */
    function registerFacility(bytes32 salt, Facility calldata _newFacility) public returns (bytes32 facilityId) {
        require(bytes(_newFacility.dataURI).length > 0, 'facility/uri-required');
        require(bytes(_newFacility.geohash).length > 0, 'facility/geohash-required');

        // create facility id
        facilityId = keccak256(abi.encodePacked(salt, abi.encode(_newFacility), _msgSender()));

        Facility storage _facility = facilities[facilityId];
        require(bytes(_facility.dataURI).length == 0, 'facility/already-exists');

        // store the facility
        facilities[facilityId] = _newFacility;

        // setup roles
        bytes32 adminRole = calcRole(facilityId, Role.ADMIN);
        _grantRole(adminRole, _msgSender()); // grant admin role to the creator of this facility
        _setRoleAdmin(adminRole, adminRole); // only the admin role can maintain itself
        _setRoleAdmin(calcRole(facilityId, Role.API), adminRole); // api for delegating automated changing of data
        _setRoleAdmin(calcRole(facilityId, Role.BIDDER), adminRole); // all authorised bidders have this role
        _setRoleAdmin(calcRole(facilityId, Role.MANAGER), adminRole); // tbd
        _setRoleAdmin(calcRole(facilityId, Role.STAFF), adminRole); // tbd
        emit FacilityCreated(facilityId, _msgSender());
    }

    /**
     * Register a space
     */
    function registerSpace(bytes32 facilityHash, Space calldata _newSpace)
        public
        onlyWriteAccess(facilityHash)
        returns (bytes32 spaceId)
    {
        require(bytes(_newSpace.dataURI).length > 0, 'facility/space-uri-required');

        // create space id
        // only do the _newSpace, as it already includes the facilityId.
        spaceId = keccak256(abi.encode(_newSpace));

        Space storage _space = spaces[facilityHash][spaceId];
        require(bytes(_space.dataURI).length == 0, 'facility/space-exists');

        // store the space
        spaces[facilityHash][spaceId] = _newSpace;
        emit SpaceCreated(facilityHash, spaceId);
    }

    /**
     * Deal on the bid that's been supplied by the service provider.
     * @param bid struct to purchase with this deal
     * @param signature an authorised bidder for this facility
     */
    function deal(Bid calldata bid, bytes calldata signature) external payable {
        bytes32 digest = _hashTypedDataV4(
            keccak256(
                abi.encode(
                    bytes32(BID_TYPE),
                    bid.facilityHash,
                    bid.spaceHash,
                    bid.askDigest,
                    bid.termsHash,
                    bid.expiry,
                    bid.costToken,
                    bid.costAtoms
                )
            )
        );
        address signer = ECDSA.recover(digest, signature);
        require(isBidder(bid.facilityHash, signer), 'facilities/not-bidder');
        require(block.timestamp <= bid.expiry, 'facilities/bid-expired');

        // zero address is shortcut trick for native token
        if (bid.costToken == address(0)) {
            require(msg.value >= bid.costAtoms, 'facilities/insufficient-funds');
        } else {
            require(
                IERC20(bid.costToken).allowance(_msgSender(), address(this)) >= bid.costAtoms,
                'facilities/insufficient-erc20-allowance'
            );
        }

        emit Deal(bid.facilityHash, bid.spaceHash, bid.askDigest, bid.termsHash, bid.costToken, bid.costAtoms);
    }

    /**
     * Determine if an address has write access to a facility
     *
     * This is also handy to use to check recovered signatures of typed data to see if the specific
     * address indeed does have write privileges. Only JSON that is signed by an address from which
     * this function returns `true` should be taken as valid. This is to prevent MITM rewrite
     * attacks, but does not prevent censorship.
     *
     * @param which facility to check for write access to
     * @param who to check has write access
     * @return true if who has write access to which facility
     */
    function hasWriteAccess(bytes32 which, address who) public view returns (bool) {
        return (hasRole(calcRole(which, Role.MANAGER), who) ||
            hasRole(calcRole(which, Role.API), who) ||
            hasRole(calcRole(which, Role.ADMIN), who));
    }

    /**
     * Determine if an address is an authorised bidder for a facility
     *
     * This is a handy function to make client implementation easier so that the access role
     * doesn't need to be calculated.
     *
     * @param which facility to check this bidder against
     * @param who to check is an authorised bidder for which facility
     * @return true if who is an authorised bidder for which facility
     */
    function isBidder(bytes32 which, address who) public view returns (bool) {
        return hasRole(calcRole(which, Role.BIDDER), who);
    }

    /**
     * Calculate the role hash for a facility and specific role type.
     * @param which facility the role shall exist for
     * @param what role to calculate for which facility
     * @return what role shall exist on which facility
     */
    function calcRole(bytes32 which, Role what) internal pure returns (bytes32) {
        return keccak256(abi.encodePacked(which, uint256(what)));
    }
}
