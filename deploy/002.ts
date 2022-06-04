/* eslint-disable camelcase */
import { HardhatRuntimeEnvironment } from 'hardhat/types';
import { DeployFunction } from 'hardhat-deploy/types';
import { utils } from 'ethers';
import { ServiceProviderRegistry__factory } from '../typechain';

const MINION = '0xcF76325B47a0edF0723DC4071A73C41B4FBc44eA';

// roles
const DEFAULT_ADMIN_ROLE = '0x0000000000000000000000000000000000000000000000000000000000000000';
const WHITELIST_ROLE = '0xc47988f847a97765b43d54e7729b079892810861c3449fdf92db036b5afa0504';

const func: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
  const { deployments, getNamedAccounts, network } = hre;
  const { execute, read } = deployments;

  const { deployer } = await getNamedAccounts();

  const vatDeploy = await hre.deployments.get('Vat');
  const mockERC20GemJoinDeploy = await hre.deployments.get('GemJoin');
  const giverDeploy = await hre.deployments.get('Giver');

  const DELEGATE_WALLETS = [giverDeploy.address];

  // only do these actions on a staging network
  if (network.tags.staging || (!network.live && !network.tags.fork)) {
    // set access requirements
    const iface = ServiceProviderRegistry__factory.createInterface();
    const calls: string[] = [];

    for (const wallet of DELEGATE_WALLETS) {
      for (const role of [WHITELIST_ROLE, DEFAULT_ADMIN_ROLE]) {
        const hasRole = await read('ServiceProviderRegistry', {}, 'hasRole', role, wallet);
        if (!hasRole) calls.push(iface.encodeFunctionData('grantRole', [role, wallet]));
      }

      await execute('MockERC20', { from: deployer, log: true }, 'grantRole', utils.keccak256(utils.toUtf8Bytes('MINTER_ROLE')), wallet)
    }

    await execute('Giver', { from: deployer, log: true }, 'rely', MINION)

    // no problems executing this all the time, just wastes test gas.
    if (calls.length > 0) {
      await execute('ServiceProviderRegistry', { from: deployer, log: true }, 'multicall', calls);
    }
  }
};
export default func;
func.tags = ['Videre','StagingEnv'];
//func.dependencies = ['Videre'];
