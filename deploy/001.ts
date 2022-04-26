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

  // --- Deploy the contract
  const staysFacilityDeploy = await deploy('StaysFacility', {
    from: deployer,
    log: true,
    autoMine: true, // speed up deployment on local network, no effect on live network.
    args: [
      'videre-stays',
      '1'
    ]
  })

  if (staysFacilityDeploy.newlyDeployed) {
    console.log(
      `Contract StaysFacility deployed at ${staysFacilityDeploy.address} using ${staysFacilityDeploy.receipt?.gasUsed} gas`
    )
  }
}

export default func
func.tags = ['StaysFacility']
