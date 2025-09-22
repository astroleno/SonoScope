// Bridge file to support legacy require('./test-utils') imports
// Re-export everything from the CJS implementation
module.exports = require('./test-utils.cjs');
