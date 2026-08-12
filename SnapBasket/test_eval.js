const fs = require('fs');

const code = fs.readFileSync('./frontend/vendor-script.js', 'utf8');

// Check syntax using Function constructor in simulated browser context
try {
    const fn = new Function('window', 'document', 'localStorage', 'sessionStorage', 'navigator', 'location', 'fetch', 'import', code);
    console.log("Syntax valid!");
} catch (e) {
    console.error("Syntax / Evaluation error in vendor-script.js:", e);
}
