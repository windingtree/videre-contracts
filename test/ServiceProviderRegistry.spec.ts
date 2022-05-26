import { ethers, getNamedAccounts, deployments, getUnnamedAccounts, network } from 'hardhat'

import { setupUser, setupUsers } from './utils'

import { expect } from './chai-setup'
import { utils } from 'ethers'
import { ServiceProviderRegistry } from '../typechain'
import { Receipt } from 'hardhat-deploy/types'
import { getRole } from './utils/helpers'

const WHITELIST_ROLE = utils.keccak256(utils.toUtf8Bytes('videre.roles.whitelist'))
const API_ROLE = 1
const BIDDER_ROLE = 2
const MANAGER_ROLE = 3
const STAFF_ROLE = 4
const ROLES = [API_ROLE, BIDDER_ROLE, MANAGER_ROLE, STAFF_ROLE]

const setup = deployments.createFixture(async () => {
  await deployments.fixture('Videre')
  const { deployer, alice, bob, manager, staff } = await getNamedAccounts()
  const contracts = {
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

describe('ServiceProviderRegistry', function () {
  let deployer: { address: string } & { spRegistry: ServiceProviderRegistry }
  let alice: { address: string } & { spRegistry: ServiceProviderRegistry }
  let bob: { address: string } & { spRegistry: ServiceProviderRegistry }
  let manager: { address: string } & { spRegistry: ServiceProviderRegistry }
  let staff: { address: string } & { spRegistry: ServiceProviderRegistry }

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
    serviceProviderId = await bob.spRegistry.callStatic.enroll(SP_SALT, SP_URI)
  })

  context('Service Provider Functions', async () => {
    context('#enroll', async () => {
      it('cannot register zero length dataURI', async () => {
        await expect(bob.spRegistry.enroll(SP_SALT, '')).to.be.revertedWith('registry/require-uri')
      })
      it('can enroll a provider', async () => {
        await expect(bob.spRegistry.enroll(SP_SALT, SP_URI))
          .to.emit(bob.spRegistry, 'ServiceProviderRegistered')
          .withArgs(serviceProviderId, bob.address)
        expect(await alice.spRegistry.datastores(serviceProviderId)).to.be.eq(SP_URI)
      })
      it('enrolling with the same salt from different users does not have hash collission', async () => {
        // try to enroll the second time
        expect(await deployer.spRegistry.callStatic.enroll(SP_SALT, SP_URI))
          .to.not.be.eq(serviceProviderId)
      })
      it('cannot enroll the same provider twice', async () => {
        await bob.spRegistry.enroll(SP_SALT, SP_URI)
        await expect(bob.spRegistry.enroll(SP_SALT, SP_URI))
          .to.be.revertedWith('registry/provider-exists')
      })
      it('sets the role admins', async () => {
        await bob.spRegistry.enroll(SP_SALT, SP_URI)
        const adminRole = getRole(serviceProviderId, 0)
        expect(await bob.spRegistry.hasRole(adminRole, bob.address)).to.be.eq(true)
        expect(await bob.spRegistry.getRoleAdmin(adminRole))
          .to.be.eq(adminRole)

        for await (const role of ROLES) {
          expect(await bob.spRegistry.getRoleAdmin(getRole(serviceProviderId, role)))
            .to.be.eq(adminRole)
        }
      })
    })
    context('#file', async () => {
      beforeEach('register service provider', async () => {
        await bob.spRegistry.enroll(SP_SALT, SP_URI)
        await bob.spRegistry.grantRole(getRole(serviceProviderId, MANAGER_ROLE), manager.address)
        await bob.spRegistry.grantRole(getRole(serviceProviderId, STAFF_ROLE), staff.address)
      })

      it('files data uri', async () => {
        const what = utils.formatBytes32String('dataURI')
        // test doing this with a staff member first
        await expect(staff.spRegistry['file(bytes32,bytes32,string)'](serviceProviderId, what, 'new-uri-here'))
          .to.be.revertedWith('registry/write-not-authorized')
        // test doing this with a manager
        await expect(manager.spRegistry['file(bytes32,bytes32,string)'](serviceProviderId, what, 'new-uri-here'))
          .to.emit(bob.spRegistry, 'ServiceProviderUpdated')
          .withArgs(serviceProviderId, what)
      })
      it('cannot file blank data uri', async () => {
        await expect(bob.spRegistry['file(bytes32,bytes32,string)'](serviceProviderId, utils.formatBytes32String('dataURI'), ''))
          .to.be.revertedWith('registry/require-uri')
      })
      it('cannot file unknown string parameter', async () => {
        await expect(bob.spRegistry['file(bytes32,bytes32,string)'](serviceProviderId, utils.formatBytes32String('random-param'), 'some random param here'))
          .to.be.revertedWith('registry/file-unrecognized-param')
      })
      it('files max TTL', async () => {
        const what = utils.formatBytes32String('maxTTL')
        const currentMaxTTL = await manager.spRegistry.maxTTL(serviceProviderId)
        await expect(manager.spRegistry['file(bytes32,bytes32,uint256)'](serviceProviderId, what, 1))
          .to.be.revertedWith('registry/admin-not-authorized')
        expect(await manager.spRegistry.maxTTL(serviceProviderId)).to.be.eq(currentMaxTTL)
        await expect(bob.spRegistry['file(bytes32,bytes32,uint256)'](serviceProviderId, what, 1200))
          .to.emit(bob.spRegistry, 'ServiceProviderUpdated')
          .withArgs(serviceProviderId, what)
        expect(await bob.spRegistry.maxTTL(serviceProviderId)).to.be.eq(1200)
      })
      it('cannot file unknown uint256 parameter', async () => {
        await expect(bob.spRegistry['file(bytes32,bytes32,uint256)'](serviceProviderId, utils.formatBytes32String('random-param'), 1))
          .to.be.revertedWith('registry/file-unrecognized-param')
      })
    })
    context('#could', async () => {
      beforeEach('register service provider', async () => {
        await bob.spRegistry.enroll(SP_SALT, SP_URI)
      })
      it('returns false for non-existant roles / users', async () => {
        expect(await deployer.spRegistry.could(serviceProviderId, 5, alice.address, 1)).to.be.eq(false)
      })
      it('follows correct flow with grant / revoke', async () => {
        const timestampBefore = Math.floor(Date.now() / 1000)
        const timestampWhenGranted = timestampBefore + 1000
        const timestampWhenRevoked = timestampWhenGranted + 1000
        const timestampAfter = timestampWhenRevoked + 1000
        await network.provider.send('evm_setNextBlockTimestamp', [timestampWhenGranted])
        await bob.spRegistry.grantRole(getRole(serviceProviderId, MANAGER_ROLE), manager.address)
        await network.provider.send('evm_setNextBlockTimestamp', [timestampWhenRevoked])
        await bob.spRegistry.revokeRole(getRole(serviceProviderId, MANAGER_ROLE), manager.address)
        expect(await bob.spRegistry.could(serviceProviderId, MANAGER_ROLE, manager.address, timestampBefore)).to.be.eq(false)
        expect(await bob.spRegistry.could(serviceProviderId, MANAGER_ROLE, manager.address, timestampWhenGranted)).to.be.eq(true)
        // we return true for could at the time that it was revoked as other blocks may be included before it was revoked
        expect(await bob.spRegistry.could(serviceProviderId, MANAGER_ROLE, manager.address, timestampWhenRevoked)).to.be.eq(true)
        expect(await bob.spRegistry.could(serviceProviderId, MANAGER_ROLE, manager.address, timestampWhenRevoked + 1)).to.be.eq(false)
        expect(await bob.spRegistry.could(serviceProviderId, MANAGER_ROLE, manager.address, timestampAfter)).to.be.eq(false)
      })
    })
  })

  context('Timestamped AccessControl', async () => {
    const role = utils.formatBytes32String('test role')

    it('records timestamps', async () => {
      let chops = await deployer.spRegistry.watchkeeper(alice.address, role)
      expect(chops[0]).to.be.eq(0)
      expect(chops[1]).to.be.eq(0)
      expect(await deployer.spRegistry.hasRole(role, alice.address)).to.be.eq(false)
      const grantTx = await deployer.spRegistry.grantRole(role, alice.address)
      const grantReceipt = await grantTx.wait()
      const grantBlock = await alice.spRegistry.provider.getBlock(grantReceipt.blockNumber)
      const grantTimestamp = grantBlock.timestamp
      expect(await deployer.spRegistry.hasRole(role, alice.address)).to.be.eq(true)
      chops = await deployer.spRegistry.watchkeeper(alice.address, role)
      expect(chops[0]).to.be.eq(grantTimestamp)
      expect(chops[1]).to.be.eq(0)
      const revokeTx = await deployer.spRegistry.revokeRole(role, alice.address)
      const revokeReceipt = await revokeTx.wait()
      const revokeBlock = await alice.spRegistry.provider.getBlock(revokeReceipt.blockNumber)
      const revokeTimestamp = revokeBlock.timestamp
      chops = await deployer.spRegistry.watchkeeper(alice.address, role)
      expect(chops[0]).to.be.eq(grantTimestamp)
      expect(chops[1]).to.be.eq(revokeTimestamp)
      expect(await deployer.spRegistry.hasRole(role, alice.address)).to.be.eq(false)
      await expect(deployer.spRegistry.grantRole(role, alice.address)).to.be.revertedWith('timestamp/previously-granted')
      expect(await deployer.spRegistry.hadRole(role, alice.address, revokeTimestamp - 1)).to.be.eq(true)
      expect(await deployer.spRegistry.hadRole(role, alice.address, grantTimestamp - 1)).to.be.eq(false)
      expect(await deployer.spRegistry.hadRole(role, alice.address, revokeTimestamp + 1000)).to.be.eq(false)
    })

    it('cannot revoke when not previously granted', async () => {
      await expect(deployer.spRegistry.revokeRole(role, alice.address)).to.be.revertedWith('timestamp/role-not-active')
    })
  })

  context('Expirying whitelist', async () => {
    let timestamp: number
    const TTL = (60 * 60 * 24 * 180)

    beforeEach('Get deployment timestamp', async () => {
      const d = await deployments.get('ServiceProviderRegistry')
      const txReceipt = d.receipt as Receipt
      const block = await deployer.spRegistry.provider.getBlock(txReceipt.blockNumber)
      timestamp = block.timestamp
    })

    it('Cannot enroll without being whitelist', async () => {
      await expect(alice.spRegistry.enroll(SP_SALT, SP_URI)).to.be.revertedWith('whitelist/not-authorized')
      await deployer.spRegistry.grantRole(WHITELIST_ROLE, alice.address)
      await expect(alice.spRegistry.enroll(SP_SALT, SP_URI)).to.not.be.reverted
    })

    it('Can enroll once enough time has passed', async () => {
      // fast forward by 1s beyond the time limit
      await network.provider.send('evm_setNextBlockTimestamp', [timestamp + TTL + 1])
      await expect(alice.spRegistry.enroll(SP_SALT, SP_URI)).to.not.be.reverted
    })

    context('#file', async () => {
      it('cannot set the time further into the future', async () => {
        await expect(deployer.spRegistry['file(bytes32,uint256)'](utils.formatBytes32String('end'), (timestamp + TTL + 1))).to.be.revertedWith('registry/whitelist-later')
      })
      it('bring the expiry forward', async () => {
        await expect(deployer.spRegistry['file(bytes32,uint256)'](utils.formatBytes32String('end'), (timestamp + 1)))
          .to.emit(deployer.spRegistry, 'WhitelistChanged')
          .withArgs(timestamp + 1)
        await network.provider.send('evm_setNextBlockTimestamp', [timestamp + 60])
        await expect(alice.spRegistry.enroll(SP_SALT, SP_URI)).to.not.be.reverted
      })
    })
  })

  context('Protocol governance', async () => {
    context('#file', async () => {
      it('fails if called by non-governance', async () => {
        await expect(alice.spRegistry['file(bytes32,uint256)'](utils.formatBytes32String('end'), 1))
          .to.be.revertedWith('registry/root-not-authorized')
      })
      it('fails if specifying invalid parameter', async () => {
        await expect(deployer.spRegistry['file(bytes32,uint256)'](utils.formatBytes32String('wrong-param'), 1))
          .to.be.revertedWith('registry/file-unrecognized-param')
      })
      it('can set minimum TTL', async () => {
        // default setting from deployment
        expect(await alice.spRegistry.minTTL()).to.be.eq(0)
        await expect(deployer.spRegistry['file(bytes32,uint256)'](utils.formatBytes32String('minTTL'), 1200))
          .to.not.be.reverted
        expect(await alice.spRegistry.minTTL()).to.be.eq(1200)
      })
    })
  })
})
