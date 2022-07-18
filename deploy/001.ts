/* eslint-disable camelcase */
import { HardhatRuntimeEnvironment } from 'hardhat/types';
import { DeployFunction } from 'hardhat-deploy/types';
import { network } from 'hardhat';
import { constants, utils } from 'ethers';

const WHITELIST_TTL = 60 * 60 * 24 * 180;
const LINE_REGISTRY_SELF_REGISTER = 1; // allows enrolling one's self in the line registry

const GEMJOIN_EIP712_NAME = 'MockERC20GemJoin';
const GEMJOIN_EIP712_VERSION = '1';

// Deployment Logic
//
// The following environments are to be taken into consideration:
// a. Unit / local testing - local blockchain, ephemeral.
//    !network.live && !network.fork
// b. Staging environment - ropsten / sokol
//    network.live && network.tag.staging
// c. Forked production environment
//    !network.live && network.fork
// d. Production environment
//    network.live && network.tag.production

const func: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
  const { deployments, getNamedAccounts } = hre;
  const { deploy, execute } = deployments;

  const { deployer } = await getNamedAccounts();

  console.log('Deployer address:', deployer);

  // Only use proxy for (b)
  const PROXY_SETTINGS_WITH_UPGRADE =
    network.live && network.tags.staging
      ? {
          owner: deployer,
          proxyContract: 'OpenZeppelinTransparentProxy',
          methodName: 'postUpgrade'
        }
      : undefined;
  const PROXY_SETTINGS = network.live && network.tags.staging ? {} : undefined;

  // --- Deploy the registries
  await deploy('TimestampRegistry', {
    from: deployer,
    proxy: PROXY_SETTINGS,
    log: true,
    autoMine: true
  });

  const serviceProviderRegistryDeploy = await deploy('ServiceProviderRegistry', {
    from: deployer,
    contract: !network.tags.staging ? 'ServiceProviderRegistry' : 'ServiceProviderRegistryUpgradeable',
    proxy: PROXY_SETTINGS_WITH_UPGRADE,
    log: true,
    autoMine: true,
    args: [WHITELIST_TTL.toString()]
  });

  await deploy('LineRegistry', {
    from: deployer,
    contract: !network.tags.staging ? 'LineRegistry' : 'LineRegistryUpgradeable',
    proxy: PROXY_SETTINGS_WITH_UPGRADE,
    log: true,
    autoMine: true,
    args: [serviceProviderRegistryDeploy.address, LINE_REGISTRY_SELF_REGISTER]
  });

  const vatDeploy = await deploy('Vat', {
    from: deployer,
    contract: !network.tags.staging ? 'Vat' : 'VatUpgradeable',
    proxy: PROXY_SETTINGS_WITH_UPGRADE,
    log: true,
    autoMine: true
  });

  // hashlib is for unit testing, so this should only be done on a non-live chain
  // ie. only use for (a)
  if (!network.live) {
    await deploy('HashLib', {
      from: deployer,
      proxy: PROXY_SETTINGS,
      log: true,
      autoMine: true
    });
  }

  // mock erc20 and the associated gemjoin are not used in production and therefore
  // should not be used in (c) or (d) cases.
  if (!network.tags.production && !network.tags.forked) {
    const mockERC20Deploy = await deploy('MockERC20', {
      from: deployer,
      contract: !network.tags.staging ? 'MockERC20' : 'MockERC20Upgradeable',
      proxy: network.tags.staging
        ? {
            owner: deployer,
            proxyContract: 'OpenZeppelinTransparentProxy',
            execute: {
              init: {
                methodName: 'initialize',
                args: []
              }
            }
          }
        : false,
      log: true,
      autoMine: true
    });

    if (mockERC20Deploy.newlyDeployed) {
      const mockERC20GemJoinDeploy = await deploy('GemJoin', {
        from: deployer,
        contract: !network.tags.staging ? 'GemJoin' : 'GemJoinUpgradeable',
        proxy: PROXY_SETTINGS_WITH_UPGRADE,
        log: true,
        autoMine: true,
        args: [vatDeploy.address, mockERC20Deploy.address]
      });

      if (mockERC20GemJoinDeploy.newlyDeployed) {
        // make sure that the gemjoin contract is rely'd
        await execute('Vat', { from: deployer, log: true }, 'rely', mockERC20GemJoinDeploy.address);
      }
    }

    // deploy the giver
    const giverDeploy = await deploy('Giver', {
      from: deployer,
      contract: !network.tags.staging ? 'Giver' : 'GiverUpgradeable',
      proxy: PROXY_SETTINGS_WITH_UPGRADE,
      log: true,
      autoMine: true,
      args: [mockERC20Deploy.address, serviceProviderRegistryDeploy.address]
    });
  }
};

export default func;
func.tags = ['Videre'];
