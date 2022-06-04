import { utils } from 'ethers';

export function getRole(providerId: string, roleId: number): string {
  return utils.keccak256(utils.solidityPack(['bytes32', 'uint256'], [providerId, roleId]));
}
