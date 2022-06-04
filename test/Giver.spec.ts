import { ethers, getNamedAccounts, deployments, getUnnamedAccounts, network } from 'hardhat';

import { setupUser, setupUsers } from './utils';

import { expect } from './chai-setup';
import { constants, utils } from 'ethers';
import { Giver, MockERC20, ServiceProviderRegistry } from '../typechain';

const WHITELIST_ROLE = utils.keccak256(utils.toUtf8Bytes('videre.roles.whitelist'));

const setup = deployments.createFixture(async () => {
  await deployments.fixture('Videre');
  const { deployer, alice } = await getNamedAccounts();
  const contracts = {
    giver: (await ethers.getContract('Giver')) as Giver,
    erc20: (await ethers.getContract('MockERC20')) as MockERC20,
    spRegistry: (await ethers.getContract('ServiceProviderRegistry')) as ServiceProviderRegistry
  };
  const users = await setupUsers(await getUnnamedAccounts(), contracts);

  return {
    users,
    deployer: await setupUser(deployer, contracts),
    alice: await setupUser(alice, contracts),
    ...contracts
  };
});

describe('Giver', function () {
  let deployer: { address: string } & { giver: Giver; erc20: MockERC20; spRegistry: ServiceProviderRegistry };
  let alice: { address: string } & { giver: Giver; erc20: MockERC20; spRegistry: ServiceProviderRegistry };

  beforeEach('load fixture', async () => {
    // eslint-disable-next-line @typescript-eslint/no-extra-semi
    ({ deployer, alice } = await setup());
  });

  context('Protocol Governance', async () => {
    it('deployer is authed', async () => {
      expect(await deployer.giver.wards(deployer.address)).to.be.eq(1);
    });
    it('rely is guarded', async () => {
      await expect(alice.giver.rely(alice.address)).to.be.revertedWith('Giver/not-authorized');
    });
    it('can rely', async () => {
      expect(await deployer.giver.wards(alice.address)).to.be.eq(0);
      await deployer.giver.rely(alice.address);
      expect(await deployer.giver.wards(alice.address)).to.be.eq(1);
    });
    it('deny is guarded', async () => {
      await expect(alice.giver.deny(deployer.address)).to.be.revertedWith('Giver/not-authorized');
    });
    it('can deny', async () => {
      await deployer.giver.rely(alice.address);
      const status = await deployer.giver.wards(alice.address);
      await expect(alice.giver.deny(alice.address)).to.not.be.reverted;
      expect(await alice.giver.wards(alice.address)).to.be.eq(status.sub(1));
    });
  });

  context('Being charitable', async () => {
    it('functions are guarded', async () => {
      await expect(alice.giver.seed(alice.address, constants.MaxUint256)).to.be.revertedWith('Giver/not-authorized');
      await expect(alice.giver.drip(alice.address, constants.MaxUint256)).to.be.revertedWith('Giver/not-authorized');
      await expect(alice.giver.whitelist(alice.address)).to.be.revertedWith('Giver/not-authorized');
    });

    it('#seed', async () => {
      const gasBalance = await alice.erc20.provider.getBalance(alice.address);
      const gemBalance = await alice.erc20.balanceOf(alice.address);
      expect(await alice.spRegistry.hasRole(WHITELIST_ROLE, alice.address)).to.be.eq(false);
      await deployer.giver.seed(alice.address, utils.parseEther('100'), { value: utils.parseEther('50') });
      expect(await alice.erc20.balanceOf(alice.address)).to.be.eq(gemBalance.add(utils.parseEther('100')));
      expect(await alice.erc20.provider.getBalance(alice.address)).to.be.eq(gasBalance.add(utils.parseEther('50')));
      expect(await alice.spRegistry.hasRole(WHITELIST_ROLE, alice.address)).to.be.eq(true);
    });

    it('#drip', async () => {
      const gemBalance = await alice.erc20.balanceOf(alice.address);
      // first try to drip 0
      await deployer.giver.drip(alice.address, 0);
      expect(await alice.erc20.balanceOf(alice.address)).to.be.eq(gemBalance);
      // actually drip some tokens
      await deployer.giver.drip(alice.address, utils.parseEther('100'));
      expect(await alice.erc20.balanceOf(alice.address)).to.be.eq(gemBalance.add(utils.parseEther('100')));
    });

    it('#whitelist', async () => {
      expect(await alice.spRegistry.hasRole(WHITELIST_ROLE, alice.address)).to.be.eq(false);
      await deployer.giver.whitelist(alice.address);
      expect(await alice.spRegistry.hasRole(WHITELIST_ROLE, alice.address)).to.be.eq(true);
    });
  });
});
