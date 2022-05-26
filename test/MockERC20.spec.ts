import { ethers, getNamedAccounts, deployments, getUnnamedAccounts } from 'hardhat'

import { setupUser, setupUsers } from './utils'

import { MockERC20 } from '../typechain'
import { expect } from './chai-setup'
import { utils } from 'ethers'

const setup = deployments.createFixture(async () => {
  await deployments.fixture('Videre')
  const { deployer, alice, bob, carol } = await getNamedAccounts()
  const contracts = {
    erc20: (await ethers.getContract('MockERC20')) as MockERC20
  }
  const users = await setupUsers(await getUnnamedAccounts(), contracts)

  return {
    users,
    deployer: await setupUser(deployer, contracts),
    alice: await setupUser(alice, contracts),
    bob: await setupUser(bob, contracts),
    carol: await setupUser(carol, contracts),
    ...contracts
  }
})

describe('MockERC20', function () {
  let deployer: { address: string } & { erc20: MockERC20 }
  let alice: { address: string } & { erc20: MockERC20 }
  let bob: { address: string } & { erc20: MockERC20 }
  let carol: { address: string } & { erc20: MockERC20 }

  beforeEach('load fixture', async () => {
    // eslint-disable-next-line @typescript-eslint/no-extra-semi
    ;({ deployer, alice, bob, carol } = await setup())

    await deployer.erc20.mint(alice.address, utils.parseEther('1000000'))
    await deployer.erc20.mint(bob.address, utils.parseEther('1000000'))
    await deployer.erc20.mint(carol.address, utils.parseEther('1000000'))
  })

  context('Metadata', async () => {
    it('sets symbol correctly', async () => {
      expect(await alice.erc20.name()).to.be.eq('MockERC20')
      expect(await alice.erc20.symbol()).to.be.eq('MTK')
    })
  })

  context('Allocations', async () => {
    it('gives correct amount to alice', async () => {
      expect(await alice.erc20.balanceOf(alice.address)).to.be.eq(utils.parseEther('1000000'))
    })
    it('gives correct amount to bob', async () => {
      expect(await bob.erc20.balanceOf(alice.address)).to.be.eq(utils.parseEther('1000000'))
    })
    it('gives correct amount to carol', async () => {
      expect(await carol.erc20.balanceOf(alice.address)).to.be.eq(utils.parseEther('1000000'))
    })
  })
})
