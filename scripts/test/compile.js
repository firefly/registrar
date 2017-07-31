var fs = require('fs');
var path = require('path');

var solc = require('solc');
var ethers = require('ethers');

var compileCache = {};

function getPath(filename) {
    return path.resolve(__dirname, '..', '..', 'contracts', filename);
}

function compile(filenames) {
    var cacheKey = filenames.join('\0');
    if (compileCache[cacheKey]) { return compileCache[cacheKey]; }

    var sources = {};

    filenames.forEach(function(filename) {
        sources[filename] = fs.readFileSync(getPath(filename)).toString();
    });

    var output = solc.compile({sources: sources}, 1);
    if (output.errors) {
        output.errors.forEach(function(error) {
            console.log(error);
        });
        throw new Error('fail to compile: ' + filenames.join(', '));
    }

    compileCache[cacheKey] = output.contracts;

    return output.contracts;
}

module.exports = compile;
