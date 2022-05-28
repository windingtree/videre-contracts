/* eslint-disable camelcase */
import { HardhatRuntimeEnvironment } from 'hardhat/types'
import { DeployFunction } from 'hardhat-deploy/types'
import { network } from 'hardhat'

const WHITELIST_TTL = 60 * 60 * 24 * 180
const LINE_REGISTRY_SELF_REGISTER = 1 // allows enrolling one's self in the line registry

const GEMJOIN_EIP712_NAME = 'MockERC20GemJoin'
const GEMJOIN_EIP712_VERSION = '1'

const func: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
  const { deployments, getNamedAccounts } = hre
  const { deploy } = deployments

  const { deployer } = await getNamedAccounts()

  console.log('Deployer address:', deployer)

  // --- Deploy the registries
  await deploy('TimestampRegistry', {
    from: deployer,
    log: true,
    autoMine: true
  })

  const serviceProviderRegistryDeploy = await deploy('ServiceProviderRegistry', {
    from: deployer,
    log: true,
    autoMine: true,
    args: [WHITELIST_TTL.toString()]
  })

  await deploy('LineRegistry', {
    from: deployer,
    log: true,
    autoMine: true,
    args: [serviceProviderRegistryDeploy.address, LINE_REGISTRY_SELF_REGISTER]
  })

  const vatDeploy = await deploy('Vat', {
    from: deployer,
    log: true,
    autoMine: true
  })

  if (!network.live) {
    await deploy('HashLib', {
      from: deployer,
      log: true,
      autoMine: true
    })
  }

  if (!network.tags.production) {
    const mockERC20Deploy = await deploy('MockERC20', {
      from: deployer,
      log: true,
      autoMine: true
    })

    if (mockERC20Deploy.newlyDeployed) {
      await deploy('GemJoin', {
        from: deployer,
        log: true,
        autoMine: true,
        args: [
          GEMJOIN_EIP712_NAME,
          GEMJOIN_EIP712_VERSION,
          vatDeploy.address,
          mockERC20Deploy.address
        ]
      })
    }
  }
}

export default func
func.tags = ['Videre']
