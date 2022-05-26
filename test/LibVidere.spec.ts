import { ethers, getNamedAccounts, deployments, getUnnamedAccounts } from 'hardhat'

import { setupUser, setupUsers } from './utils'

import { expect } from './chai-setup'
import { BigNumber, constants, utils } from 'ethers'
import { eip712 } from '@windingtree/videre-sdk'
import { HashLib, LibVidere } from '../typechain/contracts/test/HashLib'
import { ERC20Native } from '@windingtree/videre-sdk/dist/cjs/proto/token'

const setup = deployments.createFixture(async () => {
  await deployments.fixture('Videre')
  const { deployer } = await getNamedAccounts()
  const contracts = {
    hashlib: (await ethers.getContract('HashLib')) as HashLib
  }
  const users = await setupUsers(await getUnnamedAccounts(), contracts)

  return {
    users,
    deployer: await setupUser(deployer, contracts),
    ...contracts
  }
})

describe('Hash Library', function () {
  let deployer: { address: string } & { hashlib: HashLib }
  let bid: any
  let stub: any

  beforeEach('load fixture', async () => {
    // eslint-disable-next-line @typescript-eslint/no-extra-semi
    ;({ deployer } = await setup())

    bid = {
      salt: utils.formatBytes32String('SALT'),
      limit: 10,
      expiry: BigNumber.from(Math.floor(Date.now() / 1000) + 1200),
      which: utils.formatBytes32String('SOME_SERVICE_PROVIDER'),
      params: utils.keccak256(utils.toUtf8Bytes('params, ie. hash from ask struct')),
      items: [
        utils.keccak256(utils.toUtf8Bytes('ITEM_1')),
        utils.keccak256(utils.toUtf8Bytes('ITEM_2'))
      ],
      terms: [
        {
          term: utils.keccak256(utils.toUtf8Bytes('TERM_1')),
          impl: constants.AddressZero,
          txPayload: '0x'
        }
      ],
      options: {
        items: [
          {
            item: utils.keccak256(utils.toUtf8Bytes('SOME_OPTIONAL_ITEM')),
            cost: [
              {
                wad: utils.parseEther('100').toString(),
                gem: constants.AddressZero
              }
            ],
            signature: utils.arrayify(utils.toUtf8Bytes('this should be a signature'))
          }
        ],
        terms: [
          {
            term: {
              term: utils.keccak256(utils.toUtf8Bytes('SOME_OPTIONAL_TERM')),
              impl: constants.AddressZero,
              txPayload: '0x'
            },
            cost: [
              {
                wad: utils.parseEther('10').toString(),
                gem: constants.AddressZero
              }
            ],
            signature: utils.arrayify(utils.toUtf8Bytes('this should be a signture for the term'))
          }
        ]
      },
      cost: [
        {
          wad: utils.parseEther('1000').toString(),
          gem: constants.AddressZero
        }
      ]
    }

    stub = {
      which: utils.formatBytes32String('SOME_SERVICE_PROVIDER'),
      params: utils.keccak256(utils.toUtf8Bytes('params, ie. hash from ask struct')),
      items: [
        utils.keccak256(utils.toUtf8Bytes('SOME_ITEM'))
      ],
      terms: [
        {
          term: utils.keccak256(utils.toUtf8Bytes('SOME_TERM')),
          impl: constants.AddressZero,
          txPayload: '0x'
        }
      ],
      cost: {
        gem: constants.AddressZero,
        wad: utils.parseEther('1000').toString()
      }
    }
  })

  context('BidHash', async () => {
    it('SDK hash matches', async () => {
      const t = utils._TypedDataEncoder
      expect(await deployer.hashlib.bidhash(bid))
        .to.be.eq(t.hashStruct('Bid', eip712.bidask.Bid, bid))
    })
  })

  context('StubState', async () => {
    it('SDK hash matches', async () => {
      const t = utils._TypedDataEncoder
      expect(await deployer.hashlib.stubHash(stub))
        .to.be.eq(t.hashStruct('StubState', eip712.stub.StubState, stub))
    })
  })

  context('Can add optional items / terms', async () => {
    let currentCosts: ERC20Native

    beforeEach('setup current costs', async () => {
      currentCosts = {
        gem: constants.AddressZero,
        wad: utils.parseEther('2000').toString()
      }
    })

    it('can add items', async () => {
      const currentItems: utils.BytesLike[] = [
        utils.formatBytes32String('ITEM_1'),
        utils.formatBytes32String('ITEM_2')
      ]

      const addItems: LibVidere.BidOptionItemStruct[] = [
        {
          item: utils.formatBytes32String('ITEM_3'),
          cost: [
            {
              gem: '0x0000000000000000000000000000000000000001',
              wad: utils.parseEther('2000')
            },
            {
              gem: constants.AddressZero,
              wad: utils.parseEther('1000')
            }
          ]
        }
      ]

      // add options with bad costings
      await expect(deployer.hashlib['addOptions(bytes32[],(bytes32,(address,uint256)[])[],(address,uint256))'](
        currentItems,
        addItems,
        {
          gem: '0x0000000000000000000000000000000000000002',
          wad: utils.parseEther('2000').toString()
        }
      )).to.be.revertedWith('LibVidere/gem-not-found')

      // add the options
      const { items, cost } = await deployer.hashlib['addOptions(bytes32[],(bytes32,(address,uint256)[])[],(address,uint256))'](
        currentItems,
        addItems,
        currentCosts
      )

      // check the new item exists
      currentItems.push(addItems[0].item)
      expect(items.length).to.be.eq(currentItems.length)
      expect(items).to.be.deep.eq(currentItems)

      // add the cost and confirm
      expect(cost.wad).to.be.eq(BigNumber.from(currentCosts.wad).add(addItems[0].cost[1].wad))
    })

    it('can add terms', async () => {
      const currentTerms: LibVidere.BidTermStruct[] = [
        {
          term: utils.formatBytes32String('TERM_1'),
          impl: constants.AddressZero,
          txPayload: '0x'
        },
        {
          term: utils.formatBytes32String('TERM_2'),
          impl: constants.AddressZero,
          txPayload: '0x'
        }
      ]
      const addTerms: LibVidere.BidOptionTermStruct[] = [
        {
          term: {
            term: utils.formatBytes32String('TERM_3'),
            impl: constants.AddressZero,
            txPayload: '0x'
          },
          cost: [
            {
              gem: '0x0000000000000000000000000000000000000001',
              wad: utils.parseEther('2000')
            },
            {
              gem: constants.AddressZero,
              wad: utils.parseEther('1000')
            }
          ]
        }
      ]

      // add options with bad costings
      await expect(deployer.hashlib['addOptions((bytes32,address,bytes)[],((bytes32,address,bytes),(address,uint256)[])[],(address,uint256))'](
        currentTerms,
        addTerms,
        {
          gem: '0x0000000000000000000000000000000000000002',
          wad: utils.parseEther('2000').toString()
        }
      )).to.be.revertedWith('LibVidere/gem-not-found')

      // add the options
      const { terms, cost } = await deployer.hashlib['addOptions((bytes32,address,bytes)[],((bytes32,address,bytes),(address,uint256)[])[],(address,uint256))'](
        currentTerms,
        addTerms,
        currentCosts
      )

      // check the new term exists
      currentTerms.push(addTerms[0].term)
      expect(terms.length).to.eq(currentTerms.length)
      expect(terms[terms.length - 1][0]).to.be.eq(addTerms[0].term.term)
      expect(terms[terms.length - 1][1]).to.be.eq(addTerms[0].term.impl)
      expect(terms[terms.length - 1][2]).to.be.eq(addTerms[0].term.txPayload)

      // add the cost and confirm
      expect(cost.wad).to.be.eq(BigNumber.from(currentCosts.wad).add(addTerms[0].cost[1].wad))
    })
  })
})
