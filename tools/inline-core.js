// Re-inlines tests/fem-core.js into index.html between the BEGIN/END markers.
// Usage: node tools/inline-core.js [template.html]   (default: index.html, edited in place)
const fs = require("fs"), path = require("path");
const target = process.argv[2] || path.join(__dirname, "..", "index.html");
const core = fs.readFileSync(path.join(__dirname, "..", "tests", "fem-core.js"), "utf8").replace(/\n+$/, "");
const html = fs.readFileSync(target, "utf8");
const re = /(\/\/ BEGIN fem-core\n)[\s\S]*?(\n\/\/ END fem-core)/;
if (!re.test(html)) throw new Error("markers not found");
fs.writeFileSync(path.join(__dirname, "..", "index.html"), html.replace(re, (_, a, b) => a + core + b));
