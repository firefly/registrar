var compile = require('./compile');

var ens = compile(['ENS.sol', 'AbstractENS.sol'])['ENS.sol:ENS'];
var resolver = compile(['PublicResolver.sol', 'AbstractENS.sol'])['PublicResolver.sol:PublicResolver'];
var reverseRegistrar = compile(['ReverseRegistrar.sol', 'AbstractENS.sol'])['ReverseRegistrar.sol:ReverseRegistrar'];
var fireflyRegistrar = compile(['FireflyRegistrar.sol', 'AbstractENS.sol'])['FireflyRegistrar.sol:FireflyRegistrar'];

module.exports = {
    ens: ens,
    fireflyRegistrar: fireflyRegistrar,
    resolver: resolver,
    reverseRegistrar: reverseRegistrar,
}
