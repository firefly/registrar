'use strict';

var fs = require('fs');

var ethers = require('ethers');

var readlineSync = require('readline-sync');
var getopts = require('ethers-cli/lib/utils').getopts;

var registrarInterface = [{"constant":false,"inputs":[{"name":"fee","type":"uint256"}],"name":"setFee","outputs":[],"payable":false,"type":"function"},{"constant":false,"inputs":[{"name":"admin","type":"address"}],"name":"setAdmin","outputs":[],"payable":false,"type":"function"},{"constant":true,"inputs":[],"name":"config","outputs":[{"name":"ens","type":"address"},{"name":"nodeHash","type":"bytes32"},{"name":"admin","type":"address"},{"name":"fee","type":"uint256"},{"name":"defaultResolver","type":"address"}],"payable":false,"type":"function"},{"constant":true,"inputs":[{"name":"nodeHash","type":"bytes32"}],"name":"donations","outputs":[{"name":"donation","type":"uint256"}],"payable":false,"type":"function"},{"constant":false,"inputs":[{"name":"nodeHash","type":"bytes32"}],"name":"donate","outputs":[],"payable":true,"type":"function"},{"constant":false,"inputs":[{"name":"defaultResolver","type":"address"}],"name":"setDefaultResolver","outputs":[],"payable":false,"type":"function"},{"constant":true,"inputs":[],"name":"stats","outputs":[{"name":"nameCount","type":"uint256"},{"name":"totalPaid","type":"uint256"},{"name":"balance","type":"uint256"}],"payable":false,"type":"function"},{"constant":true,"inputs":[],"name":"fee","outputs":[{"name":"fee","type":"uint256"}],"payable":false,"type":"function"},{"constant":false,"inputs":[{"name":"label","type":"string"}],"name":"register","outputs":[],"payable":true,"type":"function"},{"constant":false,"inputs":[{"name":"target","type":"address"},{"name":"amount","type":"uint256"}],"name":"withdraw","outputs":[],"payable":false,"type":"function"},{"inputs":[{"name":"ens","type":"address"},{"name":"nodeHash","type":"bytes32"},{"name":"defaultResolver","type":"address"}],"payable":false,"type":"constructor"},{"payable":true,"type":"fallback"},{"anonymous":false,"inputs":[{"indexed":false,"name":"oldAdmin","type":"address"},{"indexed":false,"name":"newAdmin","type":"address"}],"name":"adminChanged","type":"event"},{"anonymous":false,"inputs":[{"indexed":false,"name":"oldFee","type":"uint256"},{"indexed":false,"name":"newFee","type":"uint256"}],"name":"feeChanged","type":"event"},{"anonymous":false,"inputs":[{"indexed":false,"name":"oldResolver","type":"address"},{"indexed":false,"name":"newResolver","type":"address"}],"name":"defaultResolverChanged","type":"event"},{"anonymous":false,"inputs":[{"indexed":false,"name":"target","type":"address"},{"indexed":false,"name":"amount","type":"uint256"}],"name":"didWithdraw","type":"event"},{"anonymous":false,"inputs":[{"indexed":true,"name":"nodeHash","type":"bytes32"},{"indexed":false,"name":"owner","type":"address"},{"indexed":false,"name":"fee","type":"uint256"}],"name":"nameRegistered","type":"event"},{"anonymous":false,"inputs":[{"indexed":true,"name":"nodeHash","type":"bytes32"},{"indexed":false,"name":"amount","type":"uint256"}],"name":"donation","type":"event"}];

var command = null;
var provider = null;
var accountPromise = null;

process.on('unhandledRejection', function(reason, p){
    console.log("Possibly Unhandled Rejection at: Promise ", p, " reason: ", reason);
});


function showHelp(error) {
    console.log('Usage:');
    console.log('    admin.js info');
    console.log('    admin.js set-admin ADDRESS');
    console.log('    admin.js set-resolver ADDRESS');
    console.log('    admin.js set-fee FEE');
    console.log('    admin.js withdraw ADDRESS AMOUNT');
    console.log('');
    console.log('Options');
    console.log('    --help               Show this help');
    console.log('    --testnet            Use testnet');
    console.log('    --rpc URL            Use the specific JSON-RPC node');
    console.log('    --account FILENAME   Use the JSON wallet');
    console.log('');

    if (error) {
        console.log(error.message);
        console.log('');
        process.exit(1);
    }

    process.exit(0);
}

function getPassword(message) {
    if (!message) { message = 'Account Password: '; }
    var password = readlineSync.question(message, { hideEchoBack: true });
    return ethers.utils.toUtf8Bytes(password.normalize('NFKC'));
}

function getRegistrar() {
    var address = '0x6fC21092DA55B392b045eD78F4732bff3C580e2c';
    //0xDfD2C8A63AC8fDb66804269fe5267eB9e60a6fD8';
    return accountPromise.then(function(account) {
        return new ethers.Contract(address, registrarInterface, account);
    });
}

try {
    var opts = getopts({
        account: '',
        rpc: '',
    }, {
        help: false,
        testnet: false
    });

    if (opts.flags.help) { showHelp(''); };

    if (opts.args.length < 1) {
        throw new Error('no command specified');
    }

    command = opts.args.shift();

    if (opts.options.rpc) {
        provider = new ethers.providers.JsonRpcProvider(opts.options.rpc, opts.flags.testnet);
    } else {
        provider = ethers.providers.getDefaultProvider(opts.flags.testnet);
    }

    function ensureArgs(count, message) {
        if (opts.args.length !== count) {
            throw new Error(message);
        }
    }

    function requireAccount() {
        if (!opts.options.account) {
            throw new Error(command + ' requires --account ACCOUNT');
        }

        var json = fs.readFileSync(opts.options.account).toString();

        accountPromise = ethers.Wallet.fromEncryptedWallet(json, getPassword()).then(function(account) {
            account.provider = provider;
            return account;
        }).catch(function(error) {
            showHelp(error);
        });
    }

    function check(key, func, message) {
        try {
            if (typeof(key) === 'string') {
                opts.options[key] = func(opts.options[key]);
            } else {
                opts.args[key] = func(opts.args[key]);
            }
        } catch (error) {
            throw new Error(message);
        }
    }

    switch (command) {
        case 'info':
            accountPromise = Promise.resolve({ provider: provider });
            break;
        case 'set-admin':
            ensureArgs(1, 'set-admin requires ADDRESS');
            check(0, ethers.utils.getAddress, 'invalid address')
            requireAccount();
            break;
        case 'set-fee':
            ensureArgs(1, 'set-fee requires FEE');
            check(0, ethers.utils.parseEther, 'invalid fee')
            requireAccount();
            break;
        case 'set-resolver':
            ensureArgs(1, 'set-resolver requires ADDRESS');
            check(0, ethers.utils.getAddress, 'invalid address')
            requireAccount();
            break;
        case 'withdraw':
            ensureArgs(2, 'withdraw requires ADDRESS and AMOUNT');
            check(0, ethers.utils.getAddress, 'invalid address')
            check(1, ethers.utils.parseEther, 'invalid amount')
            requireAccount();
            break;
        default:
            throw new Error('unknown command: ' + command);
    }

} catch (error) {
    showHelp(error);
}

switch (command) {
    case 'info':
        (function() {
            getRegistrar().then(function(registrar) {
                Promise.all([
                    registrar.config(),
                    registrar.stats()
                ]).then(function(results) {
                    console.log('Config');
                    console.log('  ENS Address: ' + results[0][0]);
                    console.log('  Node Hash:   ' + results[0][1]);
                    console.log('  Admin:       ' + results[0][2]);
                    console.log('  Fee:         ' + ethers.utils.formatEther(results[0][3]));
                    console.log('  Resolver:    ' + results[0][4]);
                    console.log('Stats');
                    console.log('  Name Count:  ' + results[1][0]);
                    console.log('  Total Paid:  ' + ethers.utils.formatEther(results[1][1]));
                    console.log('  Balance:     ' + ethers.utils.formatEther(results[1][2]));
                });
            });
        })();
        break;
    case 'set-admin':
        (function() {
            var address = opts.args.shift();
            getRegistrar().then(function(registrar) {
                return registrar.setAdmin(address)
            }).then(function(tx) {
                console.log('Transaction Hash: ' + tx.hash);
            });
        })();
        break;
    case 'set-fee':
        (function() {
            var fee = opts.args.shift();
            getRegistrar().then(function(registrar) {
                return registrar.setFee(fee)
            }).then(function(tx) {
                console.log('Transaction Hash: ' + tx.hash);
            });
        })();
        break;
    case 'set-resolver':
        (function() {
            var address = opts.args.shift();
            getRegistrar().then(function(registrar) {
                return registrar.setDefaultResolver(address)
            }).then(function(tx) {
                console.log('Transaction Hash: ' + tx.hash);
            });
        })();
        break;
    case 'withdraw':
        (function() {
            var address = opts.args.shift();
            var fee = opts.args.shift();
            getRegistrar().then(function(registrar) {
                return registrar.withdraw(address, fee);
            }).then(function(tx) {
                console.log('Transaction Hash: ' + tx.hash);
            });
        })();
        break;
}

