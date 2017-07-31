'use strict';

var ethers = require('ethers');

var contracts = require('./contracts');
var utils = require('./utils');

var Contract = ethers.Contract;
var namehash = ethers.utils.namehash;

var keccak = utils.keccak;
var reverse = utils.reverse;

var defaultGasPrice = null;

function confirm(provider, transactionPromise) {

    if (provider.isTestRPC) { return transactionPromise; }

    return transactionPromise.then(function(tx) {
        return provider.waitForTransaction(tx.hash).then(function(tx) {
            return tx;
        });
    });
}

function deploy(account, contract, args) {
    if (!args) { args = []; }
    args.unshift(contract.interface);
    args.unshift('0x' + contract.bytecode);

    var tx = Contract.getDeployTransaction.apply(Contract, args);
    tx.gasPrice = defaultGasPrice;

    return confirm(account.provider, account.sendTransaction(tx)).then(function(tx) {
        var address = ethers.utils.getContractAddress(tx);
        return new Contract(address, contract.interface, account);
    });
}

function deployEns(ensAccount, ethAccount, resolverAccount, reverseRegistrarAccount, labels) {
    if (!labels) { labels = { }; }

    var provider = ensAccount.provider;
    return deploy(ensAccount, contracts.ens).then(function(ens) {
        return deploy(resolverAccount, contracts.resolver, [ ens.address ]).then(function(resolver) {
            return deploy(reverseRegistrarAccount, contracts.reverseRegistrar, [ ens.address, resolver.address ]).then(function(reverseRegistrar) {


                    // Deploy the reverse registrar
                    var seq = Promise.resolve();

                    // Set ens:eth to the eth owner
                    seq = seq.then(function() {
                        return confirm(provider, ens.setSubnodeOwner('0x00', keccak('eth'), ethAccount.address));
                    });

                    // Register all the .eth labels to their owners
                    seq.then(function() {
                        var ensEth = new Contract(ens.address, ens.interface, ethAccount);
                        var labelsPromise = [];
                        for (var label in labels) {
                            labelsPromise.push(confirm(provider, ensEth.setSubnodeOwner(namehash('eth'), keccak(label), labels[label])));
                        }

                        return Promise.all(labelsPromise);
                    });

                    // Set ens:reverse to the ens owner
                    seq = seq.then(function() {
                         return confirm(provider, ens.setSubnodeOwner('0x00', keccak('reverse'), ensAccount.address));
                    });

                    // Set ens:addr.reverse to the reverseRegistrar
                    seq = seq.then(function() {
                         return confirm(provider, ens.setSubnodeOwner(namehash('reverse'), keccak('addr'), reverseRegistrar.address));
                    });

                    seq = seq.then(function() {
                        return {
                            ens: ens.address,
                            resolver: resolver.address,
                            reverseRegistrar: reverseRegistrar.address
                        }
                    });

                    return seq;
            });
        });
    });
}

function deployFirefly(ownerAccount, adminAccount, ensAddress, resolverAddress, reverseRegistrarAddress) {
    var provider = ownerAccount.provider;

    return deploy(adminAccount, contracts.fireflyRegistrar, [ ensAddress, namehash('firefly.eth'), resolverAddress ]).then(function(fireflyRegistrar) {

        var seq = Promise.resolve();

        // Setup the ens:firefly.eth resovler
        seq = seq.then(function() {
            var ens = new Contract(ensAddress, contracts.ens.interface, ownerAccount);
            var options = { gasPrice: defaultGasPrice };
            return confirm(provider, ens.setResolver(namehash('firefly.eth'), resolverAddress, options));
        });

        // Resolve ens:firefly.eth to the admin
        seq = seq.then(function() {
            var resolver = new Contract(resolverAddress, contracts.resolver.interface, ownerAccount);
            var options = { gasPrice: defaultGasPrice };
            return confirm(provider, resolver.setAddr(namehash('firefly.eth'), adminAccount.address, options));
        });

        // Create the ens:registrar.firefly.eth subname (temporarily owned by adminAccount)
        seq = seq.then(function() {
            var ens = new Contract(ensAddress, contracts.ens.interface, ownerAccount);
            var options = { gasPrice: defaultGasPrice };
            return confirm(provider, ens.setSubnodeOwner(namehash('firefly.eth'), keccak('registrar'), adminAccount.address, options));
        });

        // Setup the ens:registrar.firefly.eth resolver
        seq = seq.then(function() {
            var ens = new Contract(ensAddress, contracts.ens.interface, adminAccount);
            var options = { gasPrice: defaultGasPrice };
            return confirm(provider, ens.setResolver(namehash('registrar.firefly.eth'), resolverAddress, options));
        });

        // Resolve ens:registrar.firefly.eth to the firefly registrar contract
        seq = seq.then(function() {
            var resolver = new Contract(resolverAddress, contracts.resolver.interface, adminAccount);
            var options = { gasPrice: defaultGasPrice };
            return confirm(provider, resolver.setAddr(namehash('registrar.firefly.eth'), fireflyRegistrar.address, options));
        });

        // Change the owner of ens:firefly.eth to the contract (so it can issue subnames)
        seq = seq.then(function() {
            var ens = new Contract(ensAddress, contracts.ens.interface, ownerAccount);
            var options = { gasPrice: defaultGasPrice };
            return confirm(provider, ens.setOwner(namehash('firefly.eth'), fireflyRegistrar.address, options));
        });

        // The contract constructor claimed the admin as the reverse registrar admin;
        // Set up the ens:ADDRESS.addr.reverse resolver
        seq = seq.then(function() {
            var reverseEntry = utils.reverse(fireflyRegistrar.address);
            var ens = new Contract(ensAddress, contracts.ens.interface, adminAccount);
            var options = { gasPrice: defaultGasPrice };
            return confirm(provider, ens.setResolver(reverseEntry, resolverAddress, options));
        });

        // Resolve the ens:ADDRESS.addr.reverse to registrar.firefly.eth
        seq = seq.then(function() {
            var reverseEntry = utils.reverse(fireflyRegistrar.address);
            var resolver = new Contract(resolverAddress, contracts.resolver.interface, adminAccount);
            var options = { gasPrice: defaultGasPrice };
            return confirm(provider, resolver.setName(reverseEntry, 'registrar.firefly.eth', options));
        });

        // Return the address the firefly registrar was deployed at
        seq = seq.then(function() {
            return fireflyRegistrar.address;
        });

        return seq;
    });
}

module.exports = {
    confirm: confirm,
    deploy: deploy,
    deployEns: deployEns,
    deployFirefly: deployFirefly,
    setGasPrice: function(gasPrice) { defaultGasPrice = gasPrice; }
}
