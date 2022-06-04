import { ethers, getNamedAccounts, deployments, getUnnamedAccounts } from 'hardhat';

import { setupUser, setupUsers } from './utils';

import { expect } from './chai-setup';
import { BigNumber, constants, utils } from 'ethers';
import { GemJoin, MockERC20, Vat } from '../typechain';

const setup = deployments.createFixture(async () => {
  await deployments.fixture('Videre');
  const { deployer, alice, bob } = await getNamedAccounts();
  const contracts = {
    vat: (await ethers.getContract('Vat')) as Vat,
    join: (await ethers.getContract('GemJoin')) as GemJoin,
    erc20: (await ethers.getContract('MockERC20')) as MockERC20
  };
  const users = await setupUsers(await getUnnamedAccounts(), contracts);

  return {
    users,
    deployer: await setupUser(deployer, contracts),
    alice: await setupUser(alice, contracts),
    bob: await setupUser(bob, contracts),
    ...contracts
  };
});

describe('GemJoin', function () {
  // let users: ({ address: string } & { erc20: IERC20 })[]
  let deployer: { address: string } & { vat: Vat; join: GemJoin; erc20: MockERC20 };
  let alice: { address: string } & { vat: Vat; join: GemJoin; erc20: MockERC20 };
  let bob: { address: string } & { vat: Vat; join: GemJoin; erc20: MockERC20 };

  beforeEach('load fixture', async () => {
    // eslint-disable-next-line @typescript-eslint/no-extra-semi
    ({ deployer, alice, bob } = await setup());

    // authorize the GemJoin on the vat
    await deployer.vat.rely(deployer.join.address);

    // give alice and bob some tokens
    await deployer.erc20.mint(alice.address, utils.parseEther('1000000'));
    await deployer.erc20.mint(bob.address, utils.parseEther('1000000'));
  });

  context('Protocol Governance', async () => {
    it('deployer is authed', async () => {
      expect(await deployer.join.wards(deployer.address)).to.be.eq(1);
    });
    it('rely is guarded', async () => {
      await expect(alice.join.rely(alice.address)).to.be.revertedWith('GemJoin/not-authorized');
    });
    it('can rely', async () => {
      expect(await deployer.join.wards(alice.address)).to.be.eq(0);
      await deployer.join.rely(alice.address);
      expect(await deployer.join.wards(alice.address)).to.be.eq(1);
    });
    it('deny is guarded', async () => {
      await expect(alice.join.deny(deployer.address)).to.be.revertedWith('GemJoin/not-authorized');
    });
    it('can deny', async () => {
      await deployer.join.rely(alice.address);
      const status = await deployer.join.wards(alice.address);
      await expect(alice.join.deny(alice.address)).to.not.be.reverted;
      expect(await alice.join.wards(alice.address)).to.be.eq(status.sub(1));
    });
    it('protects against liveliness', async () => {
      // assumes live on deployment
      expect(await deployer.join.live()).to.be.eq(1);
      await expect(deployer.join.cage()).to.not.be.reverted;
      expect(await deployer.join.live()).to.be.eq(0);
    });
  });

  context('#join', async () => {
    beforeEach('approve gemjoin on mock erc20', async () => {
      await alice.erc20.approve(alice.join.address, utils.parseEther('10000000'));
    });

    it('cannot join when not live', async () => {
      await deployer.join.cage();
      await expect(alice.join.join(alice.address, utils.parseEther('100'))).to.be.revertedWith('GemJoin/not-live');
    });

    it('protects against int256 overflow', async () => {
      await expect(alice.join.join(alice.address, constants.MaxInt256.add(1))).to.be.revertedWith('GemJoin/overflow');
    });

    it('fails if not enough allowance', async () => {
      await expect(bob.join.join(bob.address, utils.parseEther('100'))).to.be.reverted;
    });

    it('fails if trying to join more than erc20 balance', async () => {
      await expect(alice.join.join(alice.address, utils.parseEther('10000000'))).to.be.reverted;
    });

    it('can join collateral', async () => {
      const AMOUNT = utils.parseEther('100');
      const aliceBalance = await alice.erc20.balanceOf(alice.address);
      const aliceVatBalance = await alice.vat.gems(alice.address, alice.erc20.address);
      const bobVatBalance = await bob.vat.gems(bob.address, bob.erc20.address);

      // alice joins collateral to herself
      await alice.join.join(alice.address, AMOUNT);

      // check to make sure alice's balance went down
      expect(await alice.erc20.balanceOf(alice.address)).to.be.eq(aliceBalance.sub(AMOUNT));
      // check to make sure alice's vat balance went up
      expect(await alice.vat.gems(alice.address, alice.erc20.address)).to.be.eq(aliceVatBalance.add(AMOUNT));

      // alice is kind and joins collateral to bob
      await alice.join.join(bob.address, AMOUNT);

      // check to make sure alice's balance went down again
      expect(await alice.erc20.balanceOf(alice.address)).to.be.eq(aliceBalance.sub(AMOUNT.mul(2)));
      // check to make sure alice's vat balance didn't change
      expect(await alice.vat.gems(alice.address, alice.erc20.address)).to.be.eq(aliceVatBalance.add(AMOUNT));
      // check to make sure that bob's balance has gone up
      expect(await bob.vat.gems(bob.address, bob.erc20.address)).to.be.eq(bobVatBalance.add(AMOUNT));
    });
  });

  context('#exit', async () => {
    beforeEach('join in some collateral for exit testing', async () => {
      await alice.erc20.approve(alice.join.address, utils.parseEther('1000'));
      await alice.join.join(alice.address, utils.parseEther('1000'));
    });

    it('protects against overflow', async () => {
      await expect(alice.join.exit(alice.address, BigNumber.from('2').pow(255).add(1))).to.be.revertedWith(
        'GemJoin/overflow'
      );
    });

    it('reverts when balance discrepancy between vat and erc20 balance', async () => {
      await deployer.vat['slip(address,address,int256)'](alice.address, alice.erc20.address, utils.parseEther('100'));

      await expect(alice.join.exit(alice.address, utils.parseEther('1100'))).to.be.reverted;
    });

    it('can exit collateral', async () => {
      const aliceBalance = await alice.erc20.balanceOf(alice.address);
      const bobBalance = await bob.erc20.balanceOf(bob.address);
      const aliceVatBalance = await alice.vat.gems(alice.address, alice.erc20.address);

      // try exit collateral to self
      await alice.join.exit(alice.address, utils.parseEther('500'));

      expect(await alice.erc20.balanceOf(alice.address)).to.be.eq(aliceBalance.add(utils.parseEther('500')));
      expect(await alice.vat.gems(alice.address, alice.erc20.address)).to.be.eq(
        aliceVatBalance.sub(utils.parseEther('500'))
      );

      // try exit collateral to another address
      await alice.join.exit(bob.address, utils.parseEther('500'));

      expect(await alice.erc20.balanceOf(alice.address)).to.be.eq(aliceBalance.add(utils.parseEther('500')));
      expect(await alice.vat.gems(alice.address, alice.erc20.address)).to.be.eq(0);
      expect(await bob.erc20.balanceOf(bob.address)).to.be.eq(bobBalance.add(utils.parseEther('500')));
    });
  });
});
