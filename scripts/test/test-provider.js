var ethers = require('ethers');
var TestRPC = require('ethereumjs-testrpc');

function getTestProvider(accounts) {
    return new Promise(function(resolve, reject) {
        var testRPCServer = TestRPC.server();
        testRPCServer.listen(8549, function(error, blockchain) {
            if (error) {
                reject(error);
            } else {
                var provider = new ethers.providers.JsonRpcProvider('http://localhost:8549')
                provider.isTestRPC = true;
                provider.shutdown = function() { testRPCServer.close(); }
                provider.accounts = [];
                for (var address in blockchain.accounts) {
                    var account = blockchain.accounts[address];
                    provider.accounts.push(new ethers.Wallet(account.secretKey, provider));
                }

                // Allow accounts to be accessed by a more obvious name
                for (var i = 0; i < accounts.length; i++) {
                    provider.accounts[accounts[i]] = provider.accounts[i];
                }
                resolve(provider);
            }
        });
    });
}

module.exports = {
    getTestProvider: getTestProvider
}
