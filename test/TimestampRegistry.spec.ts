import { ethers, getNamedAccounts, deployments, getUnnamedAccounts } from 'hardhat'

import { setupUser, setupUsers } from './utils'

import { expect } from './chai-setup'
import { utils } from 'ethers'
import { ITimestampRegistry } from '../typechain'

const setup = deployments.createFixture(async () => {
  await deployments.fixture('TimestampRegistry')
  const { deployer } = await getNamedAccounts()
  const contracts = {
    tsRegistry: (await ethers.getContract('TimestampRegistry')) as ITimestampRegistry
  }
  const users = await setupUsers(await getUnnamedAccounts(), contracts)

  return {
    users,
    deployer: await setupUser(deployer, contracts),
    ...contracts
  }
})

describe('TimestampRegistry', function () {
  // let users: ({ address: string } & { erc20: IERC20 })[]
  let deployer: { address: string } & { tsRegistry: ITimestampRegistry }
  const hash = utils.keccak256(utils.toUtf8Bytes('TEST'))

  beforeEach('load fixture', async () => {
    // eslint-disable-next-line @typescript-eslint/no-extra-semi
    ;({ deployer } = await setup())
  })

  context('#chop', async () => {
    it('registers the hash', async () => {
      expect(await deployer.tsRegistry.when(hash)).to.eq(0)
      const tx = await deployer.tsRegistry.chop(hash)
      const receipt = await tx.wait()
      const block = await deployer.tsRegistry.provider.getBlock(receipt.blockNumber)
      const timestamp = block.timestamp
      expect(await deployer.tsRegistry.when(hash)).to.be.eq(timestamp)
    })
    it('prevents the user from trying to change the timestamp', async () => {
      expect(await deployer.tsRegistry.when(hash)).to.eq(0)
      const tx = await deployer.tsRegistry.chop(hash)
      const receipt = await tx.wait()
      const block = await deployer.tsRegistry.provider.getBlock(receipt.blockNumber)
      const timestamp = block.timestamp
      expect(await deployer.tsRegistry.when(hash)).to.be.eq(timestamp)
      await expect(deployer.tsRegistry.chop(hash)).to.be.revertedWith('timestamp/already-stamped')
      expect(await deployer.tsRegistry.when(hash)).to.be.eq(timestamp)
    })
  })
})
