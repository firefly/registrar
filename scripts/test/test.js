'use strict';

process.on('unhandledRejection', function(reason, p){
    console.log("Possibly Unhandled Rejection at: Promise ", p, " reason: ", reason);
});

var assert = require('assert');

var ethers = require('ethers');

var contracts = require('./contracts');
var getTestProvider = require('./test-provider').getTestProvider;
var deployer = require('./deployer');
/*
function getWallets(provider) {
    return Promise.all([
        getWallet('Owner', 'wallet-testnet-owner.json', provider),
        getWallet('Admin', 'wallet-testnet-admin.json', provider),
    ]);
}
*/
// This contains:
//   - ens             - contract connected to the ENS (read-only)
//   - resovler        - contract connected to the resovler (@todo: need this??)
//   - registrarAdmin  - contract connected to the FireflyResovler with the admin
//   - registrarUserA  - contract connected to the FireflyResovler with a signer (A)
//   - registrarUserB  - contract connected to the FireflyResovler with a signer (B)
//   - shutdown        - function to kill the TestRPC service

var firefly = null;

function confirm(tx) {
    return deployer.confirm(firefly.provider, tx);
}

var wallets = null;

var target = 'testnet';

var events = [];

beforeEach(function() {

    var accountNames = [
        'ensOwner',
        'ethOwner',
        'resolverOwner',
        'reverseRegistrarOwner',
        'fireflyOwner',
        'fireflyAdmin',
        'userA',
        'userB',
    ];

    // It can take a moment to get everything going (more than 2s)
    //this.timeout(60000);
    function setupFirefly(provider, fireflyOwnerAccount, fireflyAdminAccount, ensAddress, resolverAddress, reverseRegistrarAddress) {
        return deployer.deployFirefly(fireflyOwnerAccount, fireflyAdminAccount, ensAddress, resolverAddress, reverseRegistrarAddress).then(function(fireflyRegistrarAddress) {

            var Contract = ethers.Contract;

            firefly = {

                // Read-only ENS
                ens: new Contract(ensAddress, contracts.ens.interface, provider),

                // Read-only resolver
                resolver: new Contract(resolverAddress, contracts.resolver.interface, provider),

                // Read-only reverse registrar
                reverseRegistrar: new Contract(reverseRegistrarAddress, contracts.reverseRegistrar.interface, provider),

                // The registrar from various view points
                registrarAdmin: new Contract(fireflyRegistrarAddress, contracts.fireflyRegistrar.interface, fireflyAdminAccount),
                registrarUserA: new Contract(fireflyRegistrarAddress, contracts.fireflyRegistrar.interface, provider.accounts.userA),
                registrarUserB: new Contract(fireflyRegistrarAddress, contracts.fireflyRegistrar.interface, provider.accounts.userB),

                provider: provider,

                // Shutdown and destroy the ephemeral blockchain
                shutdown: provider.shutdown,
            };

            events = [];

            // Subscrive to all events (on any of the firefly registrar instances)
            [
                'adminChanged', 'feeChanged', 'defaultResolverChanged',
                'didWithdraw', 'nameRegistered', 'donation'
            ].forEach(function(eventName) {
                firefly.registrarAdmin['on' + eventName.toLowerCase()] = function() {
                    events.push({ event: eventName, params: Array.prototype.slice.call(arguments) });
                };
            });

            return Promise.resolve(firefly);
        });
    }

    /*
    if (target === 'testnet') {
        // Only need to load and decrypt the wallets once
        if (!wallets) { wallets = getWallets(); }

        var provider = ethers.providers.getDefaultProvider(true);
        return wallets.then(function(results) {
            results.forEach(function(account) { account.provider = provider; })

            var ensAddress = '0x112234455c3a32fd11230c42e7bccd4a84e02010';
            var resolverAddress = '0x5FfC014343cd971B7eb70732021E26C35B744cc4';
            var reverseRegistrarAddress = '0x67d5418a000534a8f1f5ff4229cc2f439e63bbe2'
            return setupFirefly(provider, results[0], results[1], ensAddress, resolverAddress, reverseRegistrarAddress);
        });
    }
    */

    return getTestProvider(accountNames).then(function(provider) {
        var ensAccount = provider.accounts.ensOwner;
        var ethAccount = provider.accounts.ethOwner;
        var resolverAccount = provider.accounts.resolverOwner;
        var reverseRegistrarAccount = provider.accounts.reverseRegistrarOwner;
        var labels = { firefly: provider.accounts.fireflyOwner.address };
        return deployer.deployEns(ensAccount, ethAccount, resolverAccount, reverseRegistrarAccount, labels).then(function(result) {
            var ensAddress = result.ens;
            var resolverAddress = result.resolver;
            var reverseRegistrarAddress = result.reverseRegistrar;

            var fireflyOwnerAccount = provider.accounts.fireflyOwner;
            var fireflyAdminAccount = provider.accounts.fireflyAdmin;

            return setupFirefly(provider, fireflyOwnerAccount, fireflyAdminAccount, ensAddress, resolverAddress, reverseRegistrarAddress);
        });
    });
});

function clearEvents() {
    events = [];
}

function checkEvent(eventName, names, params) {
    return new Promise(function(resolve, reject) {
        var count = 0;
        var timer = setInterval(function() {

            if (count++ > 40) {
                reject(new Error('timeout'));
                clearInterval(timer);
                return;
            }

            events.forEach(function(event) {
                if (event.event !== eventName) { return; }

                event.params.forEach(function(v, i) {
                    var info = 'the event value matches - ' + names[i] + ' = ' + params[i] + ' / ' + v;
                    if (v.toHexString) {
                        assert.ok(v.eq(params[i]), info);
                    } else {
                        assert.equal(params[i], v, info);
                    }
                });

                clearInterval(timer);
                resolve();
                eventName = '_done';
            });
        }, 1000);
    });
}

afterEach(function() {
    // Shutdown the TestRPC server
    firefly.shutdown();
});

var fee = ethers.utils.parseEther('0.1');

describe('setupUniverse', function() {
    it('has registrar.firefly.eth set to the registrar.', function() {
        return Promise.all([
            firefly.ens.owner(ethers.utils.namehash('firefly.eth')),
            firefly.resolver.addr(ethers.utils.namehash('registrar.firefly.eth'))
        ]).then(function(result) {
            assert.equal(result[0][0], firefly.registrarAdmin.address, 'firefly.eth is owned by the registrar.');
            assert.equal(result[1][0], firefly.registrarAdmin.address, 'the registrar.firefly.eth points to the registrar.');
        });
    });

    it('has the reverse registrar set to registrar.firefly.eth', function() {
        var seq = Promise.resolve();

        seq = seq.then(function() {
            return firefly.reverseRegistrar.node(firefly.registrarAdmin.address);
        });

        seq = seq.then(function(result) {
            var node = result[0];
            return firefly.ens.resolver(node).then(function(result) {
                var addr = result[0];
                assert.equal(addr, firefly.resolver.address, 'the reverse resolver matches the resolver');
                return firefly.resolver.name(node);
            });
        });

        seq = seq.then(function(result) {
            var name = result[0];
            assert.equal(name, 'registrar.firefly.eth', 'the reverse registrar is configured for registrar.firefly.eth');
        });

        return seq;
    });
/*
    it('has the reverse registrar for admin set to firefly.eth', function() {
        var address = firefly.provider.accounts.fireflyAdmin.address;

        var seq = Promise.resolve();

        seq = seq.then(function() {
            return firefly.reverseRegistrar.node(address);
        });

        seq = seq.then(function(result) {
            var node = result[0];
            console.log(result, address);
            return firefly.ens.resolver(node).then(function(result) {
            console.log(22, result);
                var addr = result[0];
                assert.equal(addr, address, 'the reverse resolver matches the resolver');
                return firefly.resolver.name(node);
            });
        });

        seq = seq.then(function(result) {
            console.log(result);
            var name = result[0];
            assert.equal(name, 'firefly.eth', 'the reverse registrar is configured for firefly.eth');
        });

        return seq;
    });
    */
});


// Special namehash that doesn't case about illegal characters
var Zeros = [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0];
var Partition = new RegExp("^((.*)\\.)?([^.]+)$");
function namehash(name) {
    name = name.toLowerCase();

    var result = Zeros;
    while (name.length) {
        var partition = name.match(Partition);
        var label = ethers.utils.toUtf8Bytes(partition[3]);
        result = ethers.utils.keccak256(ethers.utils.concat([result, ethers.utils.keccak256(label)]));

        name = partition[2] || '';
    }

    return ethers.utils.hexlify(result);
}

var Zero = '0x0000000000000000000000000000000000000000';

function register(contract, name, value, shouldPass) {
    var info = {
        name: name,
        target: contract.signer.address,
    }

    return confirm(firefly.registrarUserA.register(name, { value: value })).then(function(tx) {
        info.success = true;
    }, function(error) {
        info.error = error.message

    }).then(function() {
        var nodeHash = namehash(name + '.firefly.eth');
        try {
            if (nodeHash !== ethers.utils.namehash(name + '.firefly.eth')) {
                throw new Error('custom namehash is broken; ' + name);
            }
        } catch (error) {
            if (error.message !== 'contains invalid UseSTD3ASCIIRules characters') {
                throw error;
            }
        }


        return Promise.all([
            firefly.ens.owner(nodeHash),
            firefly.resolver.addr(nodeHash)
        ]).then(function(result) {
            info.addr = result[1][0];
            info.owner = result[0][0];

            if (!shouldPass) { return info; }

            return checkEvent(
                'nameRegistered',
                ['nodeHash', 'address', 'fee'],
                [nodeHash, firefly.registrarUserA.signer.address, value]
            ).then(function() {
                return info;
            });
        });
    });
}


describe('register', function() {

    it('allows an available name to be registered', function() {
        return register(firefly.registrarUserA, 'hello', fee, true).then(function(result) {
            assert.equal(result.target, result.addr, 'resovler addr was set to owner');
            assert.equal(result.target, result.owner, 'owner addr was set to owner');
        });
    });

    it('forbids an unavailable name from being registered', function() {
        return register(firefly.registrarUserA, 'hello', fee, true).then(function(result1) {
            assert.ok(!result1.error, 'no error occurred registering an available name');
            assert.equal(result1.addr, result1.target, 'resovler addr was set to owner');
            assert.equal(result1.owner, result1.target, 'owner addr was set to owner');
            return register(firefly.registrarUserB, 'hello', fee, false).then(function(result2) {
                assert.ok(result2.error, 'error occurred registering an unavailable name');
                assert.ok(result1.target != result2.target, 'users are different');
                assert.equal(result2.addr, result1.addr, 'resovler addr was set to owner');
                assert.equal(result2.owner, result1.owner, 'owner addr was set to owner');
            });
        });
    });

    it('allows additional donation', function() {
        return register(firefly.registrarUserA, 'im-rich', fee.mul(2), true).then(function(result) {
            assert.ok(!result.error, 'no error occurred registering an available name');
            assert.equal(result.addr, result.target, 'resovler addr was set to owner');
            assert.equal(result.owner, result.target, 'owner addr was set to owner');
            return checkEvent(
                'donation',
                ['nodeHash', 'amount'],
                [ethers.utils.namehash('im-rich.firefly.eth'), fee.mul(2)]
            );

        }).then(function() {
            clearEvents();
            return firefly.registrarAdmin.donations(ethers.utils.namehash('im-rich.firefly.eth'));

        }).then(function(result) {
            assert.ok(result.donation.eq(fee.mul(2)), 'donations reflect fee paid');

            // Add donation to name
            return confirm(firefly.registrarUserB.donate(ethers.utils.namehash('im-rich.firefly.eth'), { value: 103 }));

        }).then(function(tx) {
            return checkEvent(
                'donation',
                ['nodeHash', 'amount'],
                [ethers.utils.namehash('im-rich.firefly.eth'), ethers.utils.bigNumberify(103)]
            );

        }).then(function() {
            return firefly.registrarUserB.donations(ethers.utils.namehash('im-rich.firefly.eth'));

        }).then(function(result) {
            assert.ok(result.donation.eq(fee.mul(2).add(103)), 'donations reflect fee paid + donations');
        });
    });

    it('forbids using too low a fee', function() {
        return register(firefly.registrarUserA, 'im-cheap', fee.sub(1), false).then(function(result) {
            assert.ok(result.error, 'error occurred registering with too low a fee');
            assert.equal(result.addr, Zero, 'too low fee has no addr');
            assert.equal(result.owner, Zero, 'too low fee has no owner');
        });
    });

    function invalidNames(names) {

        var seq = Promise.resolve();

        names.forEach(function(name) {
            seq = seq.then(function() {
                return register(firefly.registrarUserA, name, fee, false).then(function(result) {
                    assert.ok(result.error, 'error occurred for invalid name; ' + name);
                    assert.equal(result.addr, Zero, 'invalid name has no addr; ' + name);
                    assert.equal(result.owner, Zero, 'invalid name has no owner; ' + name);
                });
            });
            return seq;
        });

        return seq;
    }

    it('forbids names less than 4 characters', function() {
        return invalidNames([ 'a', 'bc', 'def']);
    });

    it('forbids names over 20 characters', function() {
        return invalidNames([
             'abcdefghijklmnopqrstu',
             'abcdefghijklmnopqrstuv',
             'abcdefghijklmnopqrstuvwxyz',
        ]);
    });

    it('forbids invalid characters', function() {
        return invalidNames([
             'hello_world',
             'hello world',
             'hello$world',
             'hello!world',
             'hello' + ethers.utils.etherSymbol + 'world',
        ]);
    });
});

describe('admin', function() {
    function getBeforeAfter(contract, func, args) {
        return contract.config().then(function(resultBefore) {
            return confirm(contract[func].apply(contract, args)).then(function(tx) {
                return firefly.registrarAdmin.config();
            }).then(function(resultAfter) {
                return {
                    after: resultAfter,
                    before: resultBefore,
                };
            }, function(error) {
                return {
                    error: error.message,
                    after: resultBefore,
                    before: resultBefore,
                };
            });
        });
    }

    function getStats() {
        return Promise.all([
            firefly.registrarAdmin.stats(),
            firefly.provider.getBalance(firefly.registrarAdmin.address),
            firefly.registrarAdmin.signer.getBalance(),
            firefly.registrarUserB.signer.getBalance(),
        ]).then(function(result) {
            if (!result[1].eq(result[0].balance)) { throw new Error('balance mismatch!'); }
            return {
                address: address,
                nameCount: result[0].nameCount,
                totalPaid: result[0].totalPaid,
                contractBalance: result[1],
                adminBalance: result[2],
                targetBalance: result[3]
            };
        });
    }


    it('allows the admin to update the fee', function() {
        var target = ethers.utils.parseEther('3.14159');
        return getBeforeAfter(firefly.registrarAdmin, 'setFee', [ target ]).then(function(result) {
            assert.ok(!result.error, 'no error during admin update');
            assert.ok(!target.eq(result.before.fee), 'fee not equal to target fee before admin update');
            assert.ok(target.eq(result.after.fee), 'fee equal to target fee after admin update');
            return checkEvent(
                'feeChanged',
                ['oldFee', 'newFee'],
                [result.before.fee, result.after.fee]
            );
        });
    });

    it('forbids non-admin to update the fee', function() {
        var target = ethers.utils.parseEther('3.14159');
        return getBeforeAfter(firefly.registrarUserA, 'setFee', [ target ]).then(function(result) {
            assert.ok(result.error, 'error during non-admin update');
            assert.ok(!target.eq(result.before.fee), 'fee not equal to target fee before non-admin update');
            assert.ok(result.before.fee.eq(result.after.fee), 'fee did not change after non-admin update');
        });
    });


    it('allows the admin to update the defaultResolver', function() {
        var target = '0x46Fa84b9355dB0708b6A57cd6ac222950478Be1d';
        return getBeforeAfter(firefly.registrarAdmin, 'setDefaultResolver', [ target ]).then(function(result) {
            assert.ok(!result.error, 'no error during admin update');
            assert.ok(target !== result.before.defaultResolver, 'defaultResolver not equal to target defaultResolver before admin update');
            assert.ok(target === result.after.defaultResolver, 'defaultResolver equal to target defaultResolver after admin update');
            return checkEvent(
                'defaultResolverChanged',
                ['oldDefaultResolver', 'newDefaultResolver'],
                [result.before.defaultResolver, result.after.defaultResolver]
            );
        });
    });

    it('forbids non-admin to update the defaultResolver', function() {
        var target = '0x46Fa84b9355dB0708b6A57cd6ac222950478Be1d';
        return getBeforeAfter(firefly.registrarUserA, 'setDefaultResolver', [ target ]).then(function(result) {
            assert.ok(result.error, 'error during non-admin update');
            assert.ok(target !== result.before.defaultResolver, 'defaultResolver not equal to target defaultResolver before non-admin update');
            assert.ok(result.before.defaultResolver === result.after.defaultResolver, 'defaultResolver did not change after non-admin update');
        });
    });


    it('allows the admin to update the admin', function() {
        var target = '0x46Fa84b9355dB0708b6A57cd6ac222950478Be1d';
        var seq = Promise.resolve();

        seq = seq.then(function() {
            return firefly.resolver.addr(namehash('firefly.eth')).then(function(result) {
                assert.equal(result[0], firefly.provider.accounts.fireflyAdmin.address, 'firefly.eth addr resolves to admin before');
            });
        });

        seq = seq.then(function() {
            return getBeforeAfter(firefly.registrarAdmin, 'setAdmin', [ target ]).then(function(result) {
                assert.ok(!result.error, 'no error during admin update');
                assert.ok(target !== result.before.admin, 'admin not equal to target admin before admin update');
                assert.ok(target === result.after.admin, 'admin equal to target admin after admin update');
                return checkEvent(
                    'adminChanged',
                    ['oldAdmin', 'newAdmin'],
                    [result.before.admin, result.after.admin]
                );
            });
        });

        seq = seq.then(function() {
            return firefly.resolver.addr(namehash('firefly.eth')).then(function(result) {
                assert.equal(result[0], target, 'firefly.eth addr resolves to admin after');
            });
        });

        return seq;
    });

    it('forbids non-admin to update the admin', function() {
        var target = '0x46Fa84b9355dB0708b6A57cd6ac222950478Be1d';
        return getBeforeAfter(firefly.registrarUserA, 'setAdmin', [ target ]).then(function(result) {
            assert.ok(result.error, 'error during non-admin update');
            assert.ok(target !== result.before.admin, 'admin not equal to target admin before non-admin update');
            assert.ok(result.before.admin === result.after.admin, 'admin did not change after non-admin update');
        });
    });


    it('allows the admin to withdraw', function() {
        return getStats().then(function(result1) {
            return register(firefly.registrarUserA, 'hello', fee, true).then(function(result) {
                return getStats();
            }).then(function(result2) {
                return confirm(firefly.registrarAdmin.withdraw(firefly.registrarUserB.signer.address, 654321)).then(function(tx) {
                    return getStats();
                }).then(function(result3) {
                    return {
                        target1: result1.targetBalance,
                        target2: result2.targetBalance,
                        target3: result3.targetBalance,
                        contract1: result1.contractBalance,
                        contract2: result2.contractBalance,
                        contract3: result3.contractBalance,
                        total1: result1.totalPaid,
                        total2: result2.totalPaid,
                        total3: result3.totalPaid,
                    };
                });
            });
        }).then(function(result) {
            // UserA -> Contract (fee)
            assert.ok(result.target2.eq(result.target1), 'no change in target balance');
            assert.ok(result.contract2.eq(result.contract1.add(fee)), 'contract received FEE funds');
            assert.ok(result.total2.eq(result.total1.add(fee)), 'totalPaid increased');

            // Contract -> Admin (654321)
            assert.ok(result.target3.eq(result.target2.add(654321)), 'target balance increased by 654321');
            assert.ok(result.contract3.eq(result.contract2.sub(654321)), 'contract seny 654321 funds to admin');
            assert.ok(result.total3.eq(result.total2), 'no change in totalPaid');

            return checkEvent(
                'didWithdraw',
                ['target', 'amount'],
                [firefly.registrarUserB.signer.address, ethers.utils.bigNumberify(654321)]
            );
        });
    });

    it('forbids non-admin from withdraw', function() {
        return getStats().then(function(result) {

            // Make sure we have a registered name, so we have some funds
            return register(firefly.registrarUserA, 'hello', fee, true).then(function(result) {
                return getStats();
            }).then(function(result1) {

                // Have userA call withdraw to userB
                return confirm(firefly.registrarUserA.withdraw(firefly.registrarUserB.signer.address, 654321)).then(function(tx) {
                    return getStats();

                }, function(error) {
                    return getStats().then(function(stats) {
                        stats.error = error;
                        return stats;
                    });

                }).then(function(result2) {
                    assert.ok(result2.error, 'error occurred for non-admin calling withdraw');
                    assert.ok(result1.contractBalance.eq(fee), 'contract has FEE balance');
                    assert.ok(result2.contractBalance.eq(fee), 'contract still has FEE balance');
                    assert.ok(result2.targetBalance.eq(result1.targetBalance), 'target did not withdraw funds');
                });
            });
        });
    });
});

