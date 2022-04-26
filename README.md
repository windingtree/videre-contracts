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

**TO BE COMPLETED**

## Deployment

### How to use

Unit testing:

```
yarn test
```

Coverage analysis:

```
yarn hardhat coverage
```

Run deploy scripts and deploy to `mainnet`:

```
yarn hardhat deploy --network mainnet
```

Now verify the contracts on Etherscan:

```
yarn hardhat --network mainnet etherscan-verify
```

**NOTE: Substitute `mainnet` above for the applicable target network.**
