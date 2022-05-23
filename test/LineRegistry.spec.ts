import { ethers, getNamedAccounts, deployments, getUnnamedAccounts } from 'hardhat'

import { setupUser, setupUsers } from './utils'

import { expect } from './chai-setup'
import { BigNumber, constants, utils } from 'ethers'
import { LineRegistry, ServiceProviderRegistry } from '../typechain'
import { getRole } from './utils/helpers'

const WHITELIST_ROLE = utils.keccak256(utils.toUtf8Bytes('videre.roles.whitelist'))
const MANAGER_ROLE = 3

const setup = deployments.createFixture(async () => {
  await deployments.fixture('LineRegistry')
  const { deployer, alice, bob, manager, staff } = await getNamedAccounts()
  const contracts = {
    lRegistry: (await ethers.getContract('LineRegistry')) as LineRegistry,
    spRegistry: (await ethers.getContract('ServiceProviderRegistry')) as ServiceProviderRegistry
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

describe('LineRegistry', function () {
  // let users: ({ address: string } & { erc20: IERC20 })[]
  let deployer: { address: string } & { lRegistry: LineRegistry, spRegistry: ServiceProviderRegistry }
  let alice: { address: string } & { lRegistry: LineRegistry, spRegistry: ServiceProviderRegistry }
  let bob: { address: string } & { lRegistry: LineRegistry, spRegistry: ServiceProviderRegistry }
  let manager: { address: string } & { lRegistry: LineRegistry, spRegistry: ServiceProviderRegistry }
  let staff: { address: string } & { lRegistry: LineRegistry, spRegistry: ServiceProviderRegistry }

  const SP_SALT = utils.keccak256(utils.toUtf8Bytes('salt'))
  const SP_URI = 'some_uri'
  let serviceProviderId: string

  beforeEach('load fixture', async () => {
    // eslint-disable-next-line @typescript-eslint/no-extra-semi
    ;({ deployer, alice, bob, manager, staff } = await setup())

    // give bob the whitelist role so he may register his service
    await deployer.spRegistry.grantRole(WHITELIST_ROLE, deployer.address)
    await deployer.spRegistry.grantRole(WHITELIST_ROLE, bob.address)

    // record what the service provider id will be
    // serviceProviderId = await bob.spRegistry.callStatic.enroll(SP_SALT, SP_URI)
  })

  context('Protocol Governance', async () => {
    it('deployer is authed', async () => {
      expect(await deployer.lRegistry.wards(deployer.address)).to.be.eq(1)
    })
    it('rely is guarded', async () => {
      await expect(alice.lRegistry.rely(alice.address))
        .to.be.revertedWith('registry/not-authorized')
    })
    it('can rely', async () => {
      expect(await deployer.lRegistry.wards(alice.address)).to.be.eq(0)
      await deployer.lRegistry.rely(alice.address)
      expect(await deployer.lRegistry.wards(alice.address)).to.be.eq(1)
    })
    it('deny is guarded', async () => {
      await expect(alice.lRegistry.deny(deployer.address))
        .to.be.revertedWith('registry/not-authorized')
    })
    it('can deny', async () => {
      await deployer.lRegistry.rely(alice.address)
      const status = await deployer.lRegistry.wards(alice.address)
      await expect(alice.lRegistry.deny(alice.address))
        .to.not.be.reverted
      expect(await alice.lRegistry.wards(alice.address)).to.be.eq(status.sub(1))
    })
    context('#file', async () => {
      it('file (uint256 and address) is guarded', async () => {
        await expect(alice.lRegistry['file(bytes32,bytes32,address)'](utils.formatBytes32String('terms'), constants.HashZero, constants.AddressZero))
          .to.be.revertedWith('registry/not-authorized')
        await expect(alice.lRegistry['file(bytes32,bytes32,uint256)'](constants.HashZero, constants.HashZero, 1))
          .to.be.revertedWith('registry/not-authorized')
      })
      it('can file lines and their cuts', async () => {
        const termsAddr = '0x000000000000000000000000000000000000bEEF'
        const line = utils.formatBytes32String('some_line')
        const cut = BigNumber.from(10).pow(20)
        await expect(deployer.lRegistry['file(bytes32,bytes32,address)'](utils.formatBytes32String('terms'), line, termsAddr))
          .to.not.be.reverted
        // line now exists
        expect(await deployer.lRegistry.exists(line)).to.be.eq(true)
        // by default the line starts with a 0 cut (protocol fee)
        expect(await deployer.lRegistry.cut(line)).to.be.eq(0)
        // set some protocol fee
        await expect(deployer.lRegistry['file(bytes32,bytes32,uint256)'](utils.formatBytes32String('cut'), line, BigNumber.from(10).pow(27).add(1)))
          .to.be.revertedWith('registry/invalid-cut')
        await deployer.lRegistry['file(bytes32,bytes32,uint256)'](utils.formatBytes32String('cut'), line, cut)
        expect(await deployer.lRegistry.cut(line)).to.be.eq(cut)
        // test deleting the line
        await expect(deployer.lRegistry['file(bytes32,bytes32,address)'](utils.formatBytes32String('terms'), line, constants.AddressZero))
          .to.not.be.reverted
        expect(await deployer.lRegistry.cut(line)).to.be.eq(0)
        expect(await deployer.lRegistry.terms(line)).to.be.eq(constants.AddressZero)
      })
      it('can file self register', async () => {
        await expect(deployer.lRegistry['file(bytes32,bytes32,uint256)'](utils.formatBytes32String('self_register'), constants.HashZero, 1))
          .to.not.be.reverted
      })
      it('can file a service provider registry', async () => {
        await expect(deployer.lRegistry['file(bytes32,bytes32,address)'](utils.formatBytes32String('service_provider_registry'), constants.HashZero, constants.AddressZero))
          .to.be.revertedWith('registry/invalid-spregistry')
        await expect(deployer.lRegistry['file(bytes32,bytes32,address)'](utils.formatBytes32String('service_provider_registry'), constants.HashZero, manager.address))
          .to.not.be.reverted
      })
      it('cannot specify cut for non-existent line', async () => {
        await expect(deployer.lRegistry['file(bytes32,bytes32,uint256)'](utils.formatBytes32String('cut'), utils.formatBytes32String('random-line'), 1))
          .to.be.revertedWith('registry/line-not-exist')
      })
      it('reverts on invalid uint256 to file', async () => {
        await expect(deployer.lRegistry['file(bytes32,bytes32,uint256)'](utils.formatBytes32String('random-param'), constants.HashZero, 1))
          .to.be.revertedWith('registry/file-unrecognized-param')
      })
      it('reverts on invalid address to file', async () => {
        await expect(deployer.lRegistry['file(bytes32,bytes32,address)'](utils.formatBytes32String('random-param'), constants.HashZero, constants.AddressZero))
          .to.be.revertedWith('registry/file-unrecognized-param')
      })
    })
    context('#hope / #nope', async () => {
      let serviceProviderId: string
      let line: string
      let terms: string

      beforeEach('setup', async () => {
        line = utils.formatBytes32String('some_line')
        terms = '0x000000000000000000000000000000000000bEEF'

        await deployer.lRegistry['file(bytes32,bytes32,address)'](utils.formatBytes32String('terms'), line, terms)
        serviceProviderId = await bob.spRegistry.callStatic.enroll(SP_SALT, SP_URI)
      })
      it('hope is guarded', async () => {
        await expect(alice.lRegistry.hope(line, serviceProviderId))
          .to.be.revertedWith('registry/not-authorized')
        expect(await deployer.lRegistry.can(line, serviceProviderId)).to.be.eq(false)
      })
      it('hope works for permissioned address', async () => {
        await expect(deployer.lRegistry.hope(line, serviceProviderId))
          .to.not.be.reverted
        expect(await deployer.lRegistry.can(line, serviceProviderId)).to.be.eq(true)
      })
      it('nope is guarded', async () => {
        await deployer.lRegistry.hope(line, serviceProviderId)
        await expect(alice.lRegistry.nope(line, serviceProviderId))
          .to.be.revertedWith('registry/not-authorized')
        expect(await deployer.lRegistry.can(line, serviceProviderId))
          .to.be.eq(true)
      })
      it('nope works for permissioned address', async () => {
        await deployer.lRegistry.hope(line, serviceProviderId)
        await expect(deployer.lRegistry.nope(line, serviceProviderId))
          .to.not.be.reverted
        expect(await deployer.lRegistry.can(line, serviceProviderId))
          .to.be.eq(false)
      })
    })
    context('#register / #deregister', async () => {
      let serviceProviderId: string
      let line: string
      let terms: string

      beforeEach('register service provider', async () => {
        serviceProviderId = await bob.spRegistry.callStatic.enroll(SP_SALT, SP_URI)
        line = utils.formatBytes32String('some_line')
        terms = '0x000000000000000000000000000000000000bEEF'
        await bob.spRegistry.enroll(SP_SALT, SP_URI)
      })

      it('register a service provider for an economic line', async () => {
        await deployer.lRegistry['file(bytes32,bytes32,address)'](utils.formatBytes32String('terms'), line, terms)
        await expect(alice.lRegistry.register(line, serviceProviderId))
          .to.be.revertedWith('registry/not-authorized')
        expect(await alice.lRegistry.can(line, serviceProviderId))
          .to.be.eq(false)
        await deployer.lRegistry['file(bytes32,bytes32,uint256)'](utils.formatBytes32String('self_register'), constants.HashZero, 0)
        await expect(bob.lRegistry.register(line, serviceProviderId))
          .to.be.revertedWith('registry/not-authorized')
        await deployer.lRegistry['file(bytes32,bytes32,uint256)'](utils.formatBytes32String('self_register'), constants.HashZero, 1)
        // cannot register a non-existant service provider
        await expect(bob.lRegistry.register(line, utils.formatBytes32String('not-provider-id')))
          .to.be.revertedWith('registry/not-authorized')
        // cannot register service provider for a line that doesn't exist
        await expect(bob.lRegistry.register(utils.formatBytes32String('not-a-line'), serviceProviderId))
          .to.be.revertedWith('registry/no-such-line')
        expect(await bob.lRegistry.can(utils.formatBytes32String('not-a-line'), serviceProviderId))
          .to.be.eq(false)
        await expect(bob.lRegistry.register(line, serviceProviderId))
          .to.not.be.reverted
        expect(await bob.lRegistry.can(line, serviceProviderId))
          .to.be.eq(true)
      })

      it('can deregister a service provider from an economic line', async () => {
        await deployer.lRegistry['file(bytes32,bytes32,address)'](utils.formatBytes32String('terms'), line, terms)
        await bob.lRegistry.register(line, serviceProviderId)
        await bob.spRegistry.grantRole(getRole(serviceProviderId, MANAGER_ROLE), manager.address)
        await expect(manager.lRegistry.deregister(line, serviceProviderId))
          .to.be.revertedWith('registry/not-authorized')
        await expect(bob.lRegistry.deregister(line, serviceProviderId))
          .to.not.be.reverted
      })
    })
  })
})
