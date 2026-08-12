const fs = require('fs');
const acorn = require('acorn');

const adminCode = fs.readFileSync('./frontend/admin-script.js', 'utf8');
try {
    acorn.parse(adminCode, { ecmaVersion: 'latest', sourceType: 'module' });
    console.log("admin-script.js AST parsed successfully!");
} catch (e) {
    console.error("admin-script.js parse error:", e);
}

const vendorCode = fs.readFileSync('./frontend/vendor-script.js', 'utf8');
try {
    acorn.parse(vendorCode, { ecmaVersion: 'latest', sourceType: 'module' });
    console.log("vendor-script.js AST parsed successfully!");
} catch (e) {
    console.error("vendor-script.js parse error:", e);
}
