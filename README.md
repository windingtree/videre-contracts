---
author: mfw78 <mfw78@protonmail.com>
---

# Videre Engine Smart Contract

## Overview

Initial smart contracts for the **Videre Engine** off-chain P2P marketplace.

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

### Sokol

A staging release has been published to `sokol` as follows:

- `TimestampRegistry`: `0xEcfF1da7acD4025c532C04db3B57b454bAB95b4E`
- `ServiceProviderRegistry`: `0xd1c12ca71578c3dbBF9c9011e90A9bbE0A4E2173`
- `LineRegistry`: `0x9a6784b38e8C9249a017099438ab260A678d5263`
- `Vat`: `0xb60A2EdEd40450D5081430D12C2177b99a00dBcf`
- `MockERC20`: `0xdD02B6D40351beeF81bFB303A5936C71D4692ffE`
- `GemJoin`: `0xe0eed2ad2941805b6D955C6274B7c74AEd5d70A3`

All contracts have source code verified via sourcify, with this being accessible via blockscout.

### How to use

Unit testing:

```
yarn test
```

Coverage analysis:

```
yarn hardhat coverage
```

Run deploy scripts and deploy to `gnosis`:

```
yarn hardhat deploy --network gnosis
```

Now verify the contracts on Sourcify:

```
yarn hardhat sourcify --network gnosis
```

**NOTE: Substitute `gnosis` above for the applicable target network.**
