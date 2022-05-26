/* eslint-disable camelcase */
import { HardhatRuntimeEnvironment } from 'hardhat/types'
import { DeployFunction } from 'hardhat-deploy/types'

const func: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
  const { deployments, getNamedAccounts } = hre
  const { deploy } = deployments

  const { deployer } = await getNamedAccounts()

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
    args: [Number(60 * 60 * 24 * 180).toString()]
  })

  await deploy('LineRegistry', {
    from: deployer,
    log: true,
    autoMine: true,
    args: [serviceProviderRegistryDeploy.address, '1']
  })

  const vatDeploy = await deploy('Vat', {
    from: deployer,
    log: true,
    autoMine: true
  })

  const mockERC20Deploy = await deploy('MockERC20', {
    from: deployer,
    log: true,
    autoMine: true
  })

  await deploy('HashLib', {
    from: deployer,
    log: true,
    autoMine: true
  })

  await deploy('GemJoin', {
    from: deployer,
    log: true,
    autoMine: true,
    args: [
      'MockERC20GemJoin',
      '1',
      vatDeploy.address,
      mockERC20Deploy.address
    ]
  })
}

export default func
func.tags = ['Videre']
