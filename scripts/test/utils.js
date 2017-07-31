'use strict';

var fs = require('fs');

var ethers = require('ethers');
var readlineSync = require('readline-sync');

function keccak(text) {
    return ethers.utils.keccak256(ethers.utils.toUtf8Bytes(text));
}

function reverse(addr) {
    addr = addr.substring(2).toLowerCase()
    return ethers.utils.keccak256(ethers.utils.concat([
        ethers.utils.namehash('addr.reverse'),
        keccak(addr)
    ]));
}


function getPassword(message) {
    if (!message) { message = 'Account Password: '; }
    var password = readlineSync.question(message, {hideEchoBack: true});
    return ethers.utils.toUtf8Bytes(password.normalize('NFKC'));
}

function getWallet(name, filename) {
    var json = fs.readFileSync(filename).toString();
    return ethers.Wallet.fromEncryptedWallet(json, getPassword(name + ' Account Password: '));
}

/*
function setupFirefly() {
    var ensContract = compile(['ENS.sol', 'AbstractENS.sol'])['ENS.sol:ENS'];
    var resolverContract = compile(['PublicResolver.sol', 'AbstractENS.sol'])['PublicResolver.sol:PublicResolver'];
    var reverseRegistrarContract = compile(['ReverseRegistrar.sol', 'AbstractENS.sol'])['ReverseRegistrar.sol:ReverseRegistrar'];
    var registrarContract = compile(['FireflyRegistrar.sol', 'AbstractENS.sol'])
    ['FireflyRegistrar.sol:FireflyRegistrar'];

    // Deploy all the contracts
    return providerPromise().then(function(provider) {
        return deploy(provider.accounts.ensOwner, ensContract).then(function(ens) {
            return deploy(provider.accounts.resolverOwner, resolverContract, [ ens.address ]).then(function(resolver) {
                return deploy(provider.accounts.ensOwner, reverseRegistrarContract, [ ens.address, resolver.address ]).then(function(reverseRegistrar) {

                    // Deploy the reverse registrar
                    var seq = Promise.resolve();
                    seq = seq.then(function() {
                         return ens.setSubnodeOwner('0x00', keccak('reverse'), 
                         provider.accounts.ensOwner.address);
                    });
                    seq = seq.then(function() {
                         return ens.setSubnodeOwner(namehash('reverse'), keccak('addr'), 
                         reverseRegistrar.address);
                    });

                    seq = seq.then(function() {
                        return reverseRegistrar;
                    });

                    return seq;

                }).then(function(reverseRegistrar) {
                    return deploy(provider.accounts.fireflyAdmin, registrarContract, [ ens.address, namehash('firefly.eth'), resolver.address ]).then(function(registrar) {
                        return {
                            ens: ens,
                            ensEth: new Contract(ens.address, ens.interface, provider.accounts.ethOwner),
                            ensFirefly: new Contract(ens.address, ens.interface, provider.accounts.fireflyOwner),
                            ensFireflyAdmin: new Contract(ens.address, ens.interface, provider.accounts.fireflyAdmin),
                            provider: provider,
                            registrar: registrar,
                            resolverFirefly: new Contract(resolver.address, resolver.interface, provider.accounts.fireflyOwner),
                            resolverFireflyAdmin: new Contract(resolver.address, resolver.interface, provider.accounts.fireflyAdmin),
                            reverseRegistrar: reverseRegistrar,
                        }
                    });
                });
            });
        });
    }).then(function(result) {
        // Configure and link the above contracts

        var ens = result.ens;
        var ensEth = result.ensEth;
        var ensFirefly = result.ensFirefly;
        var ensFireflyAdmin = result.ensFireflyAdmin;
        var provider = result.provider;
        var registrar = result.registrar;
        var resolverFirefly = result.resolverFirefly;
        var resolverFireflyAdmin = result.resolverFireflyAdmin;
        var reverseRegistrar = result.reverseRegistrar;

        var seq = Promise.resolve();

        // Set ethOwner as the owner of the `eth` label
        seq = seq.then(function() {
            return ens.setSubnodeOwner('0x00', keccak('eth'), provider.accounts.ethOwner.address);
        });

        // Set fireflyOwner as the owner of the `firefly.eth` label
        seq = seq.then(function() {
            return ensEth.setSubnodeOwner(namehash('eth'), keccak('firefly'), provider.accounts.fireflyOwner.address);
        });

        // Create `registrar.firefly.eth` (temporarily assign the firefly owner)
        seq = seq.then(function() {
            return ensFirefly.setSubnodeOwner(namehash('firefly.eth'), keccak('registrar'), provider.accounts.fireflyOwner.address);
        });


        // Set the resolver for `firefly.eth`
        seq = seq.then(function() {
            return ensFirefly.setResolver(namehash('firefly.eth'), resolverFirefly.address);
        });

        // Set the addr of firefly.eth to the admin
        seq = seq.then(function() {
            return resolverFirefly.setAddr(namehash('firefly.eth'), provider.accounts.fireflyAdmin.address);
        });


        // Set the resolver for `registrar.firefly.eth`
        seq = seq.then(function() {
            return ensFirefly.setResolver(namehash('registrar.firefly.eth'), resolverFirefly.address);
        });

        // Set the addr for `registrar.firefly.eth`
        seq = seq.then(function() {
            return resolverFirefly.setAddr(namehash('registrar.firefly.eth'), registrar.address);
        });


        // Set the registrar as the new owner of the `firefly.eth` label (so it can hand out subnodes)
        seq = seq.then(function() {
            return ensFirefly.setOwner(namehash('firefly.eth'), registrar.address);
        });

        // Set the reverse record for firefly.eth
        / *
        seq = seq.then(function() {
            var address = provider.accounts.fireflyAdmin.address;
            return reverseRegistrar.claim(address).then(function() {
                return address;
            });
        });
        seq = seq.then(function(address) {
            var reverseEntry = reverse(address);
            return ensFireflyAdmin.setResolver(reverseEntry, resolverFirefly.address).then(function() {
                return reverseEntry;
            });
        });
        seq = seq.then(function(reverseEntry) {
            return resolverFireflyAdmin.setName(reverseEntry, 'firefly.eth')
        });
        * /

        // Set the reverse record for registrar.firefly.eth
        seq = seq.then(function() {
            var reverseEntry = reverse(registrar.address);
            return ensFireflyAdmin.setResolver(reverseEntry, resolverFirefly.address).then(function() {
                return reverseEntry;
            });
        });
        seq = seq.then(function(reverseEntry) {
            return resolverFireflyAdmin.setName(reverseEntry, 'registrar.firefly.eth')
        });

        return seq.then(function() {
            return {
                // Read-only ENS
                ens: new Contract(ens.address, ens.interface, ens.provider),

                resolver: resolverFirefly,

                reverseRegistrar: reverseRegistrar,

                // The registrar from various view points
                registrarAdmin: registrar,
                registrarUserA: new Contract(registrar.address, registrar.interface, 
                provider.accounts.userA),
                registrarUserB: new Contract(registrar.address, registrar.interface, 
                provider.accounts.userB),

                provider: provider,

                // Shutdown and destroy the ephemeral blockchain
                shutdown: provider.shutdown,
            }
        });
    });
}
*/
module.exports = {
    keccak: keccak,
    getWallet: getWallet,
    reverse: reverse,
}

