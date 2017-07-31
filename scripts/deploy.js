'use strict';

var ethers = require('ethers');
var readlineSync = require('readline-sync');
var getopts = require('ethers-cli/lib/utils').getopts;

var contracts = require('./test/contracts');
var deployer = require('./test/deployer');
var utils = require('./test/utils');

var provider = null;
var gasPrice = 0

process.on('unhandledRejection', function(reason, p){
    console.log("Possibly Unhandled Rejection at: Promise ", p, " reason: ", reason);
});

function showHelp(error) {
    console.log('Usage:');
    console.log('  deploy.js OWNER_FILENAME ADMIN_FILENAME [--rpc NODE] [--testnet]');
    console.log('');

    if (error) {
        console.log(error);
        console.log('');
        process.exit(1);
    }

    process.exit(0);
}

try {
    var opts = getopts({
        admin: '',
        owner: '',
        rpc: '',
    }, {
        help: false,
        testnet: false
    });

    if (opts.flags.help) { showHelp(''); };

    if (opts.args.length !== 2) {
        throw new Error('must specify OWNER_FILENAME and ADMIN_FILENAME');
    }

    if (opts.options.rpc) {
        provider = new ethers.providers.JsonRpcProvider(opts.options.rpc, opts.flags.testnet);
    } else {
        provider = ethers.providers.getDefaultProvider(opts.flags.testnet);
    }

} catch (error) {
    showHelp(error);
}



var nodeAddrReverse = '0x91d1777781884d03a6757a803996e38de2a42967fb37eeaca72729271025a9e2';

var ensAddress = '0x314159265dd8dbb310642f98f50c066173c1259b';
var resolverAddress = '0x5FfC014343cd971B7eb70732021E26C35B744cc4';
var reverseRegistrarAddress = '0x9062c0a6dbd6108336bcbe4593a3d1ce05512069'

if (provider.testnet) {
    ensAddress = '0x112234455c3a32fd11230c42e7bccd4a84e02010';
    reverseRegistrarAddress = '0x67d5418a000534a8f1f5ff4229cc2f439e63bbe2'
    if (!gasPrice) { gasPrice = 54321000000; }
} else {
    if (!gasPrice) { gasPrice = 1100000000; }
}

console.log('Testnet:   ' + provider.testnet);
console.log('Gas Price: ' + (gasPrice / 1000000000));
console.log('ABI Parameters:', ethers.utils.hexlify(ethers.utils.concat([
    ethers.utils.padZeros(ensAddress, 32),
    ethers.utils.namehash('firefly.eth'),
    ethers.utils.padZeros(resolverAddress, 32)
])));

deployer.setGasPrice(gasPrice);

Promise.all([
    utils.getWallet('Owner', opts.args[0]),
    utils.getWallet('Admin', opts.args[1]),
]).then(function(results) {
    results.forEach(function(account) { account.provider = provider; });
    return deployer.deployFirefly(results[0], results[1], ensAddress, resolverAddress, reverseRegistrarAddress);
}).then(function(fireflyRegistrarAddress) {
    console.log('Deployed:', fireflyRegistrarAddress);
});;

