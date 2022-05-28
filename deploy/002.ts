/* eslint-disable camelcase */
import { HardhatRuntimeEnvironment } from 'hardhat/types'
import { DeployFunction } from 'hardhat-deploy/types'
import { utils } from 'ethers'
import { ServiceProviderRegistry__factory } from '../typechain'

const TEAM_1 = '0xcF76325B47a0edF0723DC4071A73C41B4FBc44eA'
const TEAM_2 = '0xb9C79303DC35548bCc9dDf7cF324bBdBC824F2E7'
const TEAM_3 = '0x6633773ad50794aF5c577566D9b94991E7Abdb7B'

const DEFAULT_ADMIN_ROLE = '0x0000000000000000000000000000000000000000000000000000000000000000'
const WHITELIST_ROLE = '0xc47988f847a97765b43d54e7729b079892810861c3449fdf92db036b5afa0504'
const NUM_TEST_TOKENS = utils.parseEther('1000000000')

const func: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
  const { deployments, getNamedAccounts, network } = hre
  const { execute, read } = deployments

  const { deployer } = await getNamedAccounts()

  const TEST_WALLETS = [deployer, TEAM_1, TEAM_2, TEAM_3]

  const serviceProviderRegistryDeploy = await hre.deployments.get('ServiceProviderRegistry')
  const vatDeploy = await hre.deployments.get('Vat')
  const mockERC20GemJoinDeploy = await hre.deployments.get('GemJoin')

  // only do these actions if deploying to a non-local blockchain (ie. live)
  if (network.live) {
    // If this is a staging (ie. non production environment)
    if (!network.tags.production) {
      // set access requirements
      const iface = ServiceProviderRegistry__factory.createInterface()
      const calls: string[] = []

      for (const wallet of TEST_WALLETS) {
        for (const role of [WHITELIST_ROLE, DEFAULT_ADMIN_ROLE]) {
          const hasRole = await read(
            'ServiceProviderRegistry',
            {},
            'hasRole',
            role, wallet
          )
          if (!hasRole) calls.push(iface.encodeFunctionData('grantRole', [role, wallet]))
        }
      }

      // no problems executing this all the time, just wastes test gas.
      if (calls.length > 0) {
        await execute(
          'ServiceProviderRegistry',
          { from: deployer, log: true },
          'multicall',
          calls
        )
      }

      // everytime this runs we will gift tokens
      // mint test tokens to team testing wallets
      for await (const wallet of TEST_WALLETS) {
        await execute(
          'MockERC20',
          { from: deployer, log: true },
          'mint', wallet, NUM_TEST_TOKENS
        )
      }

      // make sure that the gemjoin contract is rely'd
      await execute(
        'Vat',
        { from: deployer, log: true },
        'rely',
        mockERC20GemJoinDeploy.address
      )
    }
  }
}
export default func
func.tags = ['StagingEnv']
func.dependencies = ['Videre']
