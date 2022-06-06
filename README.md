---
author: mfw78 <mfw78@protonmail.com>
---

# Videre Engine Smart Contract

## Overview

Videre is a collection of contracts that allows for implementation of _real-world_
service marketplaces. Components of the contracts include:

- Registries
- Escrow
- Industry-specific logic

For more information, please see the [docs](https://windingtree.github.io/videre/).

## Usage

First configure a `.env` file. You can copy `.env.template` to `.env` and change the defaults. You
**MUST** specify a `MNEMONIC`.

To compile and run a hardhat test node with the contract deployment:

```bash
yarn #installs packages
yarn hardhat node
```

## Tests

Test contracts are located in `contracts/test`, with unit tests being written in Typescript.
The unit tests are found within `test` and make extensive use of fixtures from `hardhat-deploy`.

## Deployment

The deployment in `videre-contracts` is handled by `hardhat-deploy` which handles deployment
in the following scenarios:

1. Local unit testing - deploy to hardhat local chain.
2. Staging - deploys to live testnet (ie. sokol, goerli, ropsten, etc).
3. Production (forking) - deploy to hardhat local chain forked from production archive node.
4. Production - deploy to live environment.

### CI/CD

All `PR` are linted and subjected to local unit tests. Once a PR is pushed to the `main`
branch, upon successful completion of linting and local unit tests, the contracts are pushed
automatically to the nominated staging testnet (eg. `sokol`).

All staging releases are deployed using _transparent proxy_ contracts, allowing for in-place
upgrading in the development cycle.

**WARNING**: When a smart contract is modified such that it's storage layout changes, this
is grounds for nominating a **breaking change** in the commit message, at which time the
entire staging environment should be redeployed with new addresses published to the in the
release notes.

### Sokol (staging)

- `TimestampRegistry` - `0x24E2208ca60DFF063DA854Edcd2Ed5B0C2Cb6933`
- `ServiceProviderRegistry` - `0xC1A95DD6184C6A37A9Dd7b4b5E7DfBd5065C8Dd5`
- `LineRegistry` - `0xE7de8c7F3F9B24F9b8b519035eC53887BE3f5443`
- `Vat` - `0x47a6ac78e7A2C27A85903b172D32a78F88aac0c9`
- `MockERC20` - `0x344514f61ae62dB6ce7261D0eeb1CbA5a03bCc61`
- `GemJoin` - `0x0190aC9B981Aa9AB7eD645C96D4a403a1c484988`
- `Giver` - `0xb2BF9a28A7f92153686F94C71883f360D546a27C`

All contracts have source code verified via sourcify, with this being accessible via blockscout.

**Developers**: In order to get whitelisted / receive test tokens, please kindly ask for help
in our [discord](https://discord.com/channels/898350336069218334/913063642201722900).

### How to use

Unit testing:

```
yarn test
```

Coverage analysis:

```
yarn hardhat coverage
```

Run deploy scripts and deploy to `sokol`:

```
yarn hardhat deploy --network sokol
```

Now verify the contracts on Sourcify:

```
yarn hardhat sourcify --network sokol
```

**NOTE: Substitute `gnosis` above for the applicable target network.**
