import { ethers, getNamedAccounts, deployments, getUnnamedAccounts } from 'hardhat'

import { setupUser, setupUsers } from './utils'

import { expect } from './chai-setup'
import { BigNumber, utils } from 'ethers'
import { MockERC20, Vat } from '../typechain'

const STUB_1 = utils.keccak256(utils.toUtf8Bytes('Stub1'))
const STUB_2 = utils.keccak256(utils.toUtf8Bytes('Stub2'))

const setup = deployments.createFixture(async () => {
  await deployments.fixture('LineRegistry')
  const { deployer, alice, bob, manager, staff } = await getNamedAccounts()
  const contracts = {
    vat: (await ethers.getContract('Vat')) as Vat,
    erc20: (await ethers.getContract('MockERC20')) as MockERC20
  }
  const users = await setupUsers(await getUnnamedAccounts(), contracts)

  return {
    users,
    deployer: await setupUser(deployer, contracts),
    alice: await setupUser(alice, contracts),
    bob: await setupUser(bob, contracts),
    manager: await setupUser(manager, contracts),
    staff: await setupUser(staff, contracts),
    ...contracts
  }
})

describe('Vat', function () {
  // let users: ({ address: string } & { erc20: IERC20 })[]
  let deployer: { address: string } & { vat: Vat, erc20: MockERC20 }
  let alice: { address: string } & { vat: Vat, erc20: MockERC20 }
  let bob: { address: string } & { vat: Vat, erc20: MockERC20 }
  let manager: { address: string } & { vat: Vat, erc20: MockERC20 }
  let staff: { address: string } & { vat: Vat, erc20: MockERC20 }

  beforeEach('load fixture', async () => {
    // eslint-disable-next-line @typescript-eslint/no-extra-semi
    ;({ deployer, alice, bob, manager, staff } = await setup())

    // give bob the whitelist role so he may register his service
    // await deployer.spRegistry.grantRole(WHITELIST_ROLE, deployer.address)
    // await deployer.spRegistry.grantRole(WHITELIST_ROLE, bob.address)

    // record what the service provider id will be
    // serviceProviderId = await bob.spRegistry.callStatic.enroll(SP_SALT, SP_URI)
  })

  context('Protocol Governance', async () => {
    it('deployer is authed', async () => {
      expect(await deployer.vat.wards(deployer.address)).to.be.eq(1)
    })
    it('rely is guarded', async () => {
      await expect(alice.vat.rely(alice.address))
        .to.be.revertedWith('Vat/not-authorized')
    })
    it('can rely', async () => {
      expect(await deployer.vat.wards(alice.address)).to.be.eq(0)
      await deployer.vat.rely(alice.address)
      expect(await deployer.vat.wards(alice.address)).to.be.eq(1)
    })
    it('deny is guarded', async () => {
      await expect(alice.vat.deny(deployer.address))
        .to.be.revertedWith('Vat/not-authorized')
    })
    it('can deny', async () => {
      await deployer.vat.rely(alice.address)
      const status = await deployer.vat.wards(alice.address)
      await expect(alice.vat.deny(alice.address))
        .to.not.be.reverted
      expect(await alice.vat.wards(alice.address)).to.be.eq(status.sub(1))
    })
    it('protects against liveliness', async () => {
      // assumes live on deployment
      expect(await deployer.vat.live()).to.be.eq(1)
      await expect(deployer.vat.cage()).to.not.be.reverted
      expect(await deployer.vat.live()).to.be.eq(0)
      await expect(deployer.vat.rely(manager.address))
        .to.be.revertedWith('Vat/not-live')
      await expect(deployer.vat.deny(manager.address))
        .to.be.revertedWith('Vat/not-live')
    })
  })
  // fungibility of deposits

  /**
   * Allow an authorized module to change the amount of tokens held by
   * a 'normal' ethereum account.
   *
   * Only checks performed here are basic math to make sure there is no
   * underflow / overflow for int256.
   *
   * Authorization required: **YES**
   */
  context('#slip', async () => {
    it('is guarded', async () => {
      await expect(
        alice.vat['slip(address,address,int256)'](
          alice.address,
          alice.erc20.address,
          utils.parseEther('10000')
        )
      ).to.be.revertedWith('Vat/not-authorized')
    })
    it('protected against overflow / underflow', async () => {
      // Despite the Vat being implemented in Solidity 0.8.0 that has built in underflow/overflow
      // detection, we will check that the math is protected here.

      // overflow - ram up to the maximum before overflow attempt
      for await (const i of [0, 1]) {
        await deployer.vat['slip(address,address,int256)'](
          alice.address,
          alice.erc20.address,
          BigNumber.from('57896044618658097711785492504343953926634992332820282019728792003956564819967')
        )
      }
      await deployer.vat['slip(address,address,int256)'](
        alice.address,
        alice.erc20.address,
        1
      )

      const balance = await alice.vat.gems(alice.address, alice.erc20.address)
      // attempt the overflow
      await expect(
        deployer.vat['slip(address,address,int256)'](
          alice.address,
          alice.erc20.address,
          1
        )
      ).to.be.reverted

      expect(await alice.vat.gems(alice.address, alice.erc20.address)).to.be.eq(balance)

      // underflow
      await expect(
        deployer.vat['slip(address,address,int256)'](
          bob.address,
          bob.erc20.address,
          -1
        )
      ).to.be.reverted
      expect(await bob.vat.gems(bob.address, bob.erc20.address)).to.be.eq(0)
    })
    it('can add to an account', async () => {
      const balance = await alice.vat.gems(alice.address, alice.erc20.address)
      expect(balance).to.be.eq(0)
      await deployer.vat['slip(address,address,int256)'](alice.address, alice.erc20.address, utils.parseEther('1'))
      expect(await alice.vat.gems(alice.address, alice.erc20.address)).to.be.eq(balance.add(utils.parseEther('1')))
    })
    it('can subtract from an account', async () => {
      await deployer.vat['slip(address,address,int256)'](alice.address, alice.erc20.address, utils.parseEther('1'))
      const balance = await alice.vat.gems(alice.address, alice.erc20.address)
      await deployer.vat['slip(address,address,int256)'](alice.address, alice.erc20.address, utils.parseEther('-0.5'))
      expect(await alice.vat.gems(alice.address, alice.erc20.address)).to.be.eq(balance.sub(utils.parseEther('0.5')))
    })
  })

  /**
   * Allow an authorized module to change the amount of tokens held by
   * a 'bytes32' account (ie. service provider, or stub).
   *
   * Only checks performed here are basic math to make sure there is no
   * underflow / overflow for int256.
   *
   * Authorization required: **YES**
   */
  context('#slip', async () => {
    it('is guarded', async () => {
      await expect(
        alice.vat['slip(bytes32,address,int256)'](
          STUB_1,
          alice.erc20.address,
          utils.parseEther('10000')
        )
      ).to.be.revertedWith('Vat/not-authorized')
    })
    it('protected against overflow / underflow', async () => {
      // Despite the Vat being implemented in Solidity 0.8.0 that has built in underflow/overflow
      // detection, we will check that the math is protected here.

      // overflow - ram up to the maximum before overflow attempt
      for await (const i of [0, 1]) {
        await deployer.vat['slip(bytes32,address,int256)'](
          STUB_1,
          deployer.erc20.address,
          BigNumber.from('57896044618658097711785492504343953926634992332820282019728792003956564819967')
        )
      }
      await deployer.vat['slip(bytes32,address,int256)'](
        STUB_1,
        deployer.erc20.address,
        1
      )

      const balance = await deployer.vat.bags(STUB_1, deployer.erc20.address)
      // attempt the overflow
      await expect(
        deployer.vat['slip(bytes32,address,int256)'](
          STUB_1,
          deployer.erc20.address,
          1
        )
      ).to.be.reverted

      expect(await deployer.vat.bags(STUB_1, deployer.erc20.address)).to.be.eq(balance)

      // underflow
      await expect(
        deployer.vat['slip(bytes32,address,int256)'](
          STUB_2,
          deployer.erc20.address,
          -1
        )
      ).to.be.reverted
      expect(await deployer.vat.bags(STUB_2, deployer.erc20.address)).to.be.eq(0)
    })
    it('can add to an account', async () => {
      const balance = await deployer.vat.bags(STUB_1, deployer.erc20.address)
      expect(balance).to.be.eq(0)
      await deployer.vat['slip(bytes32,address,int256)'](STUB_1, deployer.erc20.address, utils.parseEther('1'))
      expect(await alice.vat.bags(STUB_1, deployer.erc20.address)).to.be.eq(balance.add(utils.parseEther('1')))
    })
    it('can subtract from an account', async () => {
      await deployer.vat['slip(bytes32,address,int256)'](STUB_1, deployer.erc20.address, utils.parseEther('1'))
      const balance = await deployer.vat.bags(STUB_1, deployer.erc20.address)
      await deployer.vat['slip(bytes32,address,int256)'](STUB_1, deployer.erc20.address, utils.parseEther('-0.5'))
      expect(await deployer.vat.bags(STUB_1, deployer.erc20.address)).to.be.eq(balance.sub(utils.parseEther('0.5')))
    })
  })
})
