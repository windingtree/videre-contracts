import { ethers, getNamedAccounts, deployments, getUnnamedAccounts } from 'hardhat'

import { setupUser, setupUsers } from './utils'

import { expect } from './chai-setup'
import { BigNumber, constants, utils } from 'ethers'
import { MockERC20, Vat } from '../typechain'

const STUB_1 = utils.keccak256(utils.toUtf8Bytes('Stub1'))
const STUB_2 = utils.keccak256(utils.toUtf8Bytes('Stub2'))

const SERVICE_PROVIDER_1 = utils.keccak256(utils.toUtf8Bytes('ServiceProvider1'))
const SERVICE_PROVIDER_2 = utils.keccak256(utils.toUtf8Bytes('ServiceProvider2'))

const setup = deployments.createFixture(async () => {
  await deployments.fixture('Videre')
  const { deployer, alice, bob } = await getNamedAccounts()
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
    ...contracts
  }
})

describe('Vat', function () {
  let deployer: { address: string } & { vat: Vat, erc20: MockERC20 }
  let alice: { address: string } & { vat: Vat, erc20: MockERC20 }
  let bob: { address: string } & { vat: Vat, erc20: MockERC20 }

  beforeEach('load fixture', async () => {
    // eslint-disable-next-line @typescript-eslint/no-extra-semi
    ;({ deployer, alice, bob } = await setup())
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
      await expect(deployer.vat.rely(alice.address))
        .to.be.revertedWith('Vat/not-live')
      await expect(deployer.vat.deny(alice.address))
        .to.be.revertedWith('Vat/not-live')
    })
  })

  context('Account permissions', async () => {
    beforeEach('give alice permission on bob', async () => {
      await bob.vat.hope(alice.address)
    })
    it('can give permission to another account', async () => {
      await alice.vat.hope(bob.address)
      expect(await bob.vat.can(alice.address, bob.address)).to.be.eq(1)
    })
    it('can revoke permission of an account', async () => {
      expect(await bob.vat.can(bob.address, alice.address)).to.be.eq(1)
      await bob.vat.nope(alice.address)
      expect(await bob.vat.can(bob.address, alice.address)).to.be.eq(0)
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

  /**
   * Allow one account to transfer their token balance to another account.
   *
   * This is a permissionless function that allows any **normal**, ie. EOA
   * account to move their tokens to another EOA account.
   *
   * Authorization required: **NO**
   */
  context('#flux', async () => {
    beforeEach('make deposit for alice', async () => {
      // use slip for the deposit
      await deployer.vat['slip(address,address,int256)'](
        alice.address,
        alice.erc20.address,
        utils.parseEther('100')
      )
    })

    it('can transfer from alice to bob', async () => {
      const aliceBalance = await alice.vat.gems(alice.address, alice.erc20.address)
      const bobBalance = await bob.vat.gems(bob.address, bob.erc20.address)
      // transfer from alice to bob
      await alice.vat.flux(
        alice.address,
        bob.address,
        alice.erc20.address,
        utils.parseEther('100')
      )
      expect(await alice.vat.gems(alice.address, alice.erc20.address))
        .to.be.eq(aliceBalance.sub(utils.parseEther('100')))
      expect(await bob.vat.gems(bob.address, bob.erc20.address))
        .to.be.eq(bobBalance.add(utils.parseEther('100')))
    })

    it('cannot flux more than is in src account to own account', async () => {
      await expect(alice.vat.flux(
        alice.address,
        bob.address,
        alice.erc20.address,
        utils.parseEther('150')
      )).to.be.reverted
    })

    it('can permit another user to flux your account', async () => {
      const aliceBalance = await alice.vat.gems(
        alice.address,
        alice.erc20.address
      )
      const bobBalance = await bob.vat.gems(
        bob.address,
        bob.erc20.address
      )
      await expect(bob.vat.flux(
        alice.address,
        bob.address,
        bob.erc20.address,
        utils.parseEther('100')
      )).to.be.revertedWith('Vat/not-allowed')
      expect(await alice.vat.gems(alice.address, alice.erc20.address)).to.be.eq(aliceBalance)
      expect(await bob.vat.gems(bob.address, bob.erc20.address)).to.be.eq(bobBalance)
      // alice gives permission to bob to use her tokens
      await alice.vat.hope(bob.address)
      await bob.vat.flux(
        alice.address,
        bob.address,
        bob.erc20.address,
        utils.parseEther('100')
      )
      expect(await alice.vat.gems(alice.address, alice.erc20.address))
        .to.be.eq(aliceBalance.sub(utils.parseEther('100')))
      expect(await bob.vat.gems(bob.address, bob.erc20.address))
        .to.be.eq(bobBalance.add(utils.parseEther('100')))
    })
  })

  /**
   * Do a deal and create a stub.
   *
   * Authorization requird: **YES**
   */
  context('#deal', async () => {
    it('is guarded', async () => {
      await expect(
        alice.vat.deal(
          STUB_1,
          alice.address,
          alice.erc20.address,
          utils.parseEther('100'),
          0
        )
      ).to.be.revertedWith('Vat/not-authorized')
    })

    it('cannot deal if not live', async () => {
      await deployer.vat.cage()
      await expect(
        deployer.vat.deal(
          STUB_1,
          alice.address,
          alice.erc20.address,
          utils.parseEther('100'),
          0
        )
      ).to.be.revertedWith('Vat/not-live')
    })

    it('must be a non zero address', async () => {
      await expect(
        deployer.vat.deal(
          STUB_1,
          constants.AddressZero,
          alice.erc20.address,
          utils.parseEther('100'),
          0
        )
      ).to.be.revertedWith('Vat/invalid-usr')
    })

    it('must have enough funds to pay', async () => {
      await expect(
        deployer.vat.deal(
          STUB_1,
          alice.address,
          alice.erc20.address,
          utils.parseEther('100'),
          0
        )
      ).to.be.revertedWith('Vat/insufficient-funds')
    })

    it('cannot have protocol fee higher than total cost', async () => {
      // add some funds to pay for the service
      await deployer.vat['slip(address,address,int256)'](
        alice.address,
        alice.erc20.address,
        utils.parseEther('100')
      )
      await expect(
        deployer.vat.deal(
          STUB_1,
          alice.address,
          alice.erc20.address,
          utils.parseEther('100'),
          utils.parseEther('101')
        )
      ).to.be.revertedWith('Vat/fee-too-high')
    })

    it('can make booking and not make the same booking twice', async() => {
      // add some funds to pay for the service
      await deployer.vat['slip(address,address,int256)'](
        alice.address,
        alice.erc20.address,
        utils.parseEther('100')
      )
      const balance = await alice.vat.gems(alice.address, alice.erc20.address)
      await expect(deployer.vat.deal(
        STUB_1,
        alice.address,
        alice.erc20.address,
        utils.parseEther('100'),
        utils.parseEther('10')
      )).to.not.be.reverted
      // make sure that the total cost has been deducted from the purchaser
      expect(await deployer.vat.gems(alice.address, alice.erc20.address))
        .to.be.eq(balance.sub(utils.parseEther('100')))
      // make sure that the stub has been collateralised
      expect(await deployer.vat.bags(STUB_1, alice.erc20.address))
        .to.be.eq(utils.parseEther('90'))
      // make sure that the protocol fee has been paid
      expect(await deployer.vat.gems(deployer.address, alice.erc20.address))
        .to.be.eq(utils.parseEther('10'))
      // make sure that alice got her stub
      expect(await deployer.vat.owns(STUB_1)).to.be.eq(alice.address)

      // cannot register the same stub again
      await expect(deployer.vat.deal(
        STUB_1,
        alice.address,
        alice.erc20.address,
        utils.parseEther('100'),
        utils.parseEther('10')
      )).to.be.revertedWith('Vat/stub-exists')
    })
  })

  /**
   * Allow swapping a stub from source to dest, collecting a fee
   *
   * This checks for basic math errors.
   *
   * **WARNING**: This *may* result in a case where the stub has multiple
   *              types of collateral deposited. If the `swap` is conducted
   *              with a different collateral type to the original purchase,
   *              the fee that is added is the collateral type in which the
   *              swap was funded.
   */
  context('#swap', async () => {
    beforeEach('alice makes a deal', async () => {
      // add some funds to pay for the service
      await deployer.vat['slip(address,address,int256)'](
        alice.address,
        alice.erc20.address,
        utils.parseEther('100')
      )
      // bob will buy from alice so give him some dosh
      await deployer.vat['slip(address,address,int256)'](
        bob.address,
        bob.erc20.address,
        utils.parseEther('150')
      )
      // make a deal that we can swap later
      await deployer.vat.deal(
        STUB_1,
        alice.address,
        alice.erc20.address,
        utils.parseEther('100'),
        utils.parseEther('10')
      )
    })

    it('is guarded', async () => {
      await expect(
        alice.vat.swap(
          STUB_1,
          alice.address,
          bob.address,
          bob.erc20.address,
          0,
          0
        )
      ).to.be.revertedWith('Vat/not-authorized')
    })

    it('cannot swap if not live', async () => {
      await deployer.vat.cage()
      await expect(deployer.vat.swap(
        STUB_1,
        alice.address,
        bob.address,
        bob.erc20.address,
        0,
        0
      )).to.be.revertedWith('Vat/not-live')
    })

    it('cannot move stub if src is not the owner', async () => {
      await expect(deployer.vat.swap(
        STUB_1,
        bob.address,
        bob.address,
        bob.erc20.address,
        0,
        0
      )).to.be.revertedWith('Vat/not-allowed')
    })

    it('bob must have enough to pay', async () => {
      await expect(deployer.vat.swap(
        STUB_1,
        alice.address,
        bob.address,
        bob.erc20.address,
        utils.parseEther('160'),
        0
      )).to.be.revertedWith('Vat/insufficient-funds')
    })

    it('cannot charge more fees than cost', async () => {
      await expect(deployer.vat.swap(
        STUB_1,
        alice.address,
        bob.address,
        bob.erc20.address,
        utils.parseEther('150'),
        utils.parseEther('160')
      )).to.be.revertedWith('Vat/fee-too-high')
    })

    it('cannot send to zero address', async () => {
      await expect(deployer.vat.swap(
        STUB_1,
        alice.address,
        constants.AddressZero,
        deployer.erc20.address,
        utils.parseEther('150'),
        0
      )).to.be.revertedWith('Vat/invalid-dst')
    })

    it('can swap from alice to bob', async () => {
      // record the total balances in the system
      const aliceBalance = await alice.vat.gems(alice.address, alice.erc20.address)
      const bobBalance = await bob.vat.gems(bob.address, bob.erc20.address)
      const stubBalance = await deployer.vat.bags(STUB_1, deployer.erc20.address)
      const lineBalance = await deployer.vat.gems(deployer.address, deployer.erc20.address)
      const systemBalance = aliceBalance.add(bobBalance).add(stubBalance).add(lineBalance)

      const SWAP_COST = utils.parseEther('150')
      const SWAP_FEE = utils.parseEther('10')

      // do the swap
      await deployer.vat.swap(
        STUB_1,
        alice.address,
        bob.address,
        bob.erc20.address,
        SWAP_COST, // total cost, inclusive of protocol fee
        SWAP_FEE // protocol fee to be added to `lineBalance`
      )

      const newAliceBalance = await alice.vat.gems(alice.address, alice.erc20.address)
      const newBobBalance = await bob.vat.gems(bob.address, bob.erc20.address)
      const newStubBalance = await deployer.vat.bags(STUB_1, deployer.erc20.address)
      const newLineBalance = await deployer.vat.gems(deployer.address, deployer.erc20.address)
      const newSystemBalance = newAliceBalance.add(newBobBalance).add(newStubBalance).add(newLineBalance)

      // make sure that bob paid
      expect(newBobBalance).to.be.eq(bobBalance.sub(SWAP_COST))
      // make sure that alice received the swap cost less fees
      expect(newAliceBalance).to.be.eq(aliceBalance.add(SWAP_COST.sub(SWAP_FEE)))
      // make sure that the stub has been credited with the fee
      expect(newStubBalance).to.be.eq(stubBalance.add(SWAP_FEE))
      // make sure that there was no change to the line balance
      expect(newLineBalance).to.be.eq(lineBalance)
      // make sure that the system's total balance is the same as before
      expect(systemBalance).to.be.eq(newSystemBalance)

      // make sure that the stub is now owned by bob
      expect(await bob.vat.owns(STUB_1)).to.be.eq(bob.address)
    })
  })

  /**
   * Stub settlement
   *
   * Settle (ie. transfer) the value from a stub to a service provider.
   *
   * This checks for basic math errors.
   *
   * **WARNING**: This *may* result in funds being 'stuck' in the vat contract
   *              where a stub has multiple types of gems, and therefore when
   *              paying out, this is not taken into account, leaving an imbalance.
   */
  context('#move', async () => {
    beforeEach('alice makes a deal', async () => {
      // add some funds to pay for the service
      await deployer.vat['slip(address,address,int256)'](
        alice.address,
        alice.erc20.address,
        utils.parseEther('100')
      )
      // make a deal that we can settle later
      await deployer.vat.deal(
        STUB_1,
        alice.address,
        alice.erc20.address,
        utils.parseEther('100'),
        utils.parseEther('10')
      )
    })

    it('is guarded', async () => {
      await expect(
        alice.vat.move(
          STUB_1,
          SERVICE_PROVIDER_1,
          bob.erc20.address,
          utils.parseEther('100'),
          0
        )
      ).to.be.revertedWith('Vat/not-authorized')
    })

    it('cannot move if not live', async () => {
      await deployer.vat.cage()
      await expect(deployer.vat.move(
        STUB_1,
        SERVICE_PROVIDER_1,
        alice.erc20.address,
        utils.parseEther('100'),
        0
      )).to.be.revertedWith('Vat/not-live')
    })

    it('cannot charge more fees than cost', async () => {
      await expect(deployer.vat.move(
        STUB_1,
        SERVICE_PROVIDER_1,
        alice.erc20.address,
        utils.parseEther('100'),
        utils.parseEther('110')
      )).to.be.revertedWith('Vat/fee-too-high')
    })

    it('src must NOT be a service provider', async () => {
      // first put some funds in the service provider for testing
      await deployer.vat['slip(bytes32,address,int256)'](
        SERVICE_PROVIDER_2,
        deployer.erc20.address,
        utils.parseEther('100')
      )

      const sp1Balance = await deployer.vat.bags(SERVICE_PROVIDER_1, deployer.erc20.address)
      const sp2Balance = await deployer.vat.bags(SERVICE_PROVIDER_2, deployer.erc20.address)

      // try use 'move' to send funds between service providers
      await expect(deployer.vat.move(
        SERVICE_PROVIDER_2,
        SERVICE_PROVIDER_1,
        alice.erc20.address,
        utils.parseEther('100'),
        0
      )).to.be.revertedWith('Vat/not-stub')

      expect(await deployer.vat.bags(SERVICE_PROVIDER_1, deployer.erc20.address))
        .to.be.eq(sp1Balance)
      expect(await deployer.vat.bags(SERVICE_PROVIDER_2, deployer.erc20.address))
        .to.be.eq(sp2Balance)
    })

    it('cannot settle more than what is in the stub', async () => {
      const stubBalance = await deployer.vat.bags(STUB_1, deployer.erc20.address)
      const spBalance = await deployer.vat.bags(SERVICE_PROVIDER_1, deployer.erc20.address)

      // try overflow and get more money from stub than exists
      await expect(deployer.vat.move(
        STUB_1,
        SERVICE_PROVIDER_1,
        deployer.erc20.address,
        stubBalance.mul(2),
        0
      )).to.be.revertedWith('Vat/insufficient-funds')

      expect(await deployer.vat.bags(STUB_1, deployer.erc20.address))
        .to.be.eq(stubBalance)
      expect(await deployer.vat.bags(SERVICE_PROVIDER_1, deployer.erc20.address))
        .to.be.eq(spBalance)
    })

    it('can partially settle stubs', async () => {
      await deployer.vat.move(
        STUB_1,
        SERVICE_PROVIDER_1,
        deployer.erc20.address,
        utils.parseEther('80'),
        0
      )

      // make sure there's something left over
      expect(await deployer.vat.bags(STUB_1, deployer.erc20.address))
        .to.be.eq(utils.parseEther('10'))
      // make sure ownership of the stub is preserved
      expect(await deployer.vat.owns(STUB_1)).to.be.eq(alice.address)
      // make sure that the service provider got partial settlement
      expect(await deployer.vat.bags(SERVICE_PROVIDER_1, deployer.erc20.address))
        .to.be.eq(utils.parseEther('80'))
    })

    it('can settle the stub', async () => {
      const stubBalance = await deployer.vat.bags(STUB_1, deployer.erc20.address)
      const spBalance = await deployer.vat.bags(SERVICE_PROVIDER_1, deployer.erc20.address)
      const lineBalance = await deployer.vat.gems(deployer.address, deployer.erc20.address)
      const systemBalance = stubBalance.add(spBalance).add(lineBalance)

      const fee = stubBalance.mul(10).div(100) // 10%

      await deployer.vat.move(
        STUB_1,
        SERVICE_PROVIDER_1,
        deployer.erc20.address,
        stubBalance,
        fee
      )

      const newStubBalance = await deployer.vat.bags(STUB_1, deployer.erc20.address)
      const newSpBalance = await deployer.vat.bags(SERVICE_PROVIDER_1, deployer.erc20.address)
      const newLineBalance = await deployer.vat.gems(deployer.address, deployer.erc20.address)
      const newSystemBalance = newStubBalance.add(newSpBalance).add(newLineBalance)

      // stub should no longer exist
      expect(await deployer.vat.owns(STUB_1)).to.be.eq(constants.AddressZero)
      // stub should have no collateral (from move)
      expect(newStubBalance).to.be.eq(0)
      // protocol fees should have accumulated
      expect(newLineBalance).to.be.eq(lineBalance.add(fee))
      // the service provider should have received collateral less fees
      expect(newSpBalance).to.be.eq(spBalance.add(stubBalance.sub(fee)))
      // make sure the system is still in balance
      expect(systemBalance).to.be.eq(newSystemBalance)
    })
  })

  /**
   * Service provider settlement
   *
   * Settle (ie. transfer) the value from the service provider to an EOA address.
   *
   * This checks for basic math errors.
   */
  context('#suck', async () => {
    beforeEach('give some funds to the service provider', async () => {
      await deployer.vat['slip(bytes32,address,int256)'](
        SERVICE_PROVIDER_1,
        deployer.erc20.address,
        utils.parseEther('100')
      )
    })

    it('is guarded', async () => {
      await expect(bob.vat.suck(
        SERVICE_PROVIDER_1,
        bob.address,
        bob.erc20.address,
        utils.parseEther('100'),
        0)
      ).to.be.revertedWith('Vat/not-authorized')
    })

    it('cannot suck if not live', async () => {
      await deployer.vat.cage()
      await expect(deployer.vat.suck(
        SERVICE_PROVIDER_1,
        bob.address,
        bob.erc20.address,
        utils.parseEther('100'),
        0
      )).to.be.revertedWith('Vat/not-live')
    })

    it('cannot charge more fees than cost', async () => {
      await expect(deployer.vat.suck(
        SERVICE_PROVIDER_1,
        bob.address,
        bob.erc20.address,
        utils.parseEther('100'),
        utils.parseEther('110')
      )).to.be.revertedWith('Vat/fee-too-high')
    })

    it('cannot settle more than what the service provider has', async () => {
      const spBalance = await deployer.vat.bags(SERVICE_PROVIDER_1, deployer.erc20.address)
      const bobBalance = await deployer.vat.gems(bob.address, bob.erc20.address)

      // try overflow and get more money from stub than exists
      await expect(deployer.vat.suck(
        SERVICE_PROVIDER_1,
        bob.address,
        bob.erc20.address,
        spBalance.mul(2),
        0
      )).to.be.revertedWith('Vat/insufficient-funds')

      expect(await deployer.vat.bags(SERVICE_PROVIDER_1, deployer.erc20.address))
        .to.be.eq(spBalance)
      expect(await deployer.vat.gems(bob.address, deployer.erc20.address))
        .to.be.eq(bobBalance)
    })

    it('cannot settle from a stub', async () => {
      // add some funds to pay for the service
      await deployer.vat['slip(address,address,int256)'](
        alice.address,
        alice.erc20.address,
        utils.parseEther('100')
      )
      // make a deal that we can settle later
      await deployer.vat.deal(
        STUB_1,
        alice.address,
        alice.erc20.address,
        utils.parseEther('100'),
        utils.parseEther('10')
      )

      const stubBalance = await deployer.vat.bags(STUB_1, deployer.erc20.address)
      const bobBalance = await bob.vat.gems(bob.address, bob.erc20.address)

      await expect(deployer.vat.suck(
        STUB_1,
        bob.address,
        bob.erc20.address,
        utils.parseEther('10'),
        0
      )).to.be.revertedWith('Vat/not-service-provider')

      expect(await deployer.vat.bags(STUB_1, deployer.erc20.address))
        .to.be.eq(stubBalance)
      expect(await bob.vat.gems(bob.address, bob.erc20.address))
        .to.be.eq(bobBalance)
    })

    it('can settle from service provider to eoa account', async () => {
      const lineBalance = await deployer.vat.gems(deployer.address, deployer.erc20.address)
      const spBalance = await deployer.vat.bags(SERVICE_PROVIDER_1, deployer.erc20.address)
      const bobBalance = await bob.vat.gems(bob.address, bob.erc20.address)
      const systemBalance = lineBalance.add(spBalance).add(bobBalance)

      await deployer.vat.suck(
        SERVICE_PROVIDER_1,
        bob.address,
        bob.erc20.address,
        utils.parseEther('100'),
        utils.parseEther('10')
      )

      const newLineBalance = await deployer.vat.gems(deployer.address, deployer.erc20.address)
      const newSpBalance = await deployer.vat.bags(SERVICE_PROVIDER_1, deployer.erc20.address)
      const newBobBalance = await bob.vat.gems(bob.address, bob.erc20.address)
      const newSystemBalance = newLineBalance.add(newSpBalance).add(newBobBalance)

      expect(newLineBalance).to.be.eq(utils.parseEther('10'))
      expect(newSpBalance).to.be.eq(0)
      expect(newBobBalance).to.be.eq(utils.parseEther('90'))
      expect(newSystemBalance).to.be.eq(systemBalance)
    })
  })
})
