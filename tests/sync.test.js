// Checks that the core inlined in index.html is identical to tests/fem-core.js.
// Run with: node tests/sync.test.js
const fs = require("fs"), path = require("path");
const html = fs.readFileSync(path.join(__dirname, "..", "index.html"), "utf8");
const core = fs.readFileSync(path.join(__dirname, "fem-core.js"), "utf8").replace(/\n+$/, "");
const m = /\/\/ BEGIN fem-core\n([\s\S]*?)\n\/\/ END fem-core/.exec(html);
if (!m) { console.log("FAIL: markers not found in index.html"); process.exit(1); }
if (m[1] !== core) { console.log("FAIL: inlined core differs from tests/fem-core.js; re-inline it"); process.exit(1); }
console.log("sync ok: index.html core matches tests/fem-core.js");
