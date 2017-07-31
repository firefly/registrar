Firefly Registrar
=================

The firefly registrar is a simple ENS registrar contract to make registering
sub-names on the ENS name **firefly.eth** quick and easy.

This document is very much in its early stages. It will get more details as
time goes on, such as API and CLI interfaces.


Running Example
---------------

- Front End -- [Ethers.io](https://ethers.io/#!/app-link/contribute.firefly.city/)
- Contract -- [Etherscan.io](https://etherscan.io/address/0x6fc21092da55b392b045ed78f4732bff3c580e2c)


Contracts
---------

Most of the contracts are simply copies of the existing ENS contracts for
testing purposes (the test cases re-create the ENS system in TestRPC).

- **FireflyRegistrar.sol** -- The Firefly Registrar contract


Front End
---------

The front end is a simple Ethers app. To run locally, install [ethers-cli](https://www.npmjs.com/package/ethers-cli)
and from the ethers-app directory:

```bash
/Users/ethers/firefly-registrar/ethers-app> ethers serve
Serving content from file:///Users/ethers/firefly-registrar/ethers-app
Listening on port: 8080
Server Ethers app: http://localhost:8080/_/#!/app-link-insecure/localhost:8080/
```


Tools
-----

The `/scripts/` directory contains a serias of scripts to help manage an ENS
name with this registrar. Currently `firefly.eth` is hard-coded in several
places, but this package will eventually be more general purpose so anyone
with an ENS name can easily deploy and amange this registrar.

- **admin.js** -- Query the contract config and stats and update admin properties
- **test.js** -- Run the entire test suite (launches TestRPC)
- **deploy.js** -- Deploy an instance of the registrar on a network


Trust
-----

For now there is a fairly high level of trust, as the owner of a name can
re-call `finalize-auction` to reclaim ownership. Soon we hope to have better
holding contracts in place to reduce the level of trust required (or remove
it entirely).


Testnet
-------

The Firefly Registrar has been deployed to both mainnet and ropsten at the same
address.


License
-------

MIT License.

