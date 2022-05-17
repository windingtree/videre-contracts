/* eslint-disable camelcase */
import { HardhatRuntimeEnvironment } from 'hardhat/types'
import { DeployFunction } from 'hardhat-deploy/types'

const func: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
  const { deployments, getNamedAccounts } = hre
  const { deploy } = deployments

  const { deployer, alice, bob, carol } = await getNamedAccounts()

  // --- Account listing ---
  console.log(`Deployer: ${deployer}`)
  console.log(`Alice: ${alice}`)
  console.log(`Bob: ${bob}`)
  console.log(`Carol: ${carol}`)

  // --- Deploy the registries
  const timestampRegistryDeploy = await deploy('TimestampRegistry', {
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

  const lineRegistryDeploy = await deploy('LineRegistry', {
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

  const gemJoinDeploy = await deploy('GemJoin', {
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
