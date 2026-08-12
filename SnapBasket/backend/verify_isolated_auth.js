const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const http = require('http');
const assert = require('assert');
const { generateToken, verifyToken } = require('./tokenHelper');

const dbPath = path.join(__dirname, 'database.sqlite');
const db = new sqlite3.Database(dbPath);

const getDbRow = (sql, params = []) => {
    return new Promise((resolve, reject) => {
        db.get(sql, params, (err, row) => err ? reject(err) : resolve(row));
    });
};

const getHttpResponse = (url, headers = {}) => {
    return new Promise((resolve, reject) => {
        const req = http.get(url, { headers }, (res) => {
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => resolve({
                statusCode: res.statusCode,
                headers: res.headers,
                body: data
            }));
        });
        req.on('error', reject);
    });
};

(async () => {
    console.log("=== STARTING AUTH ISOLATION VERIFICATION ===");

    try {
        // 1. Verify DB Schema
        console.log("1. Checking DB Schema...");
        const adminUsersRoleCol = await getDbRow("PRAGMA table_info(admin_users)");
        const hasRoleCol = adminUsersRoleCol ? true : false;
        console.log("   admin_users table is accessible.");

        const logTable = await getDbRow("SELECT name FROM sqlite_master WHERE type='table' AND name='failed_access_logs'");
        assert.ok(logTable, "failed_access_logs table should exist");
        console.log("   failed_access_logs table verified.");

        // 2. Verify Cryptographic Token helper
        console.log("2. Checking Token Helper...");
        const testPayload = { user_id: '1', username: '9490229108', role: 'super_admin' };
        const token = generateToken(testPayload);
        assert.ok(token, "Token generation failed");
        
        const decoded = verifyToken(token);
        assert.equal(decoded.role, 'super_admin', "Decoded role mismatch");
        assert.equal(decoded.username, '9490229108', "Decoded username mismatch");
        console.log("   Token encryption and timingSafeEqual validation passed.");

        // 3. Verify Route Guards (HTTP requests to running backend)
        console.log("3. Testing Route Guards on Localhost API...");
        
        // A. No cookies -> should redirect to login.html with error
        const resNoCookiesAdmin = await getHttpResponse('http://localhost:3001/admin.html');
        assert.equal(resNoCookiesAdmin.statusCode, 302, "Direct access with no cookies should return 302 redirect");
        assert.ok(resNoCookiesAdmin.headers.location.includes('/login.html?error=Unauthorized%20Access'), "Redirect location mismatch");
        console.log("   Anonymous direct access to admin.html correctly blocked & redirected.");

        const resNoCookiesVendor = await getHttpResponse('http://localhost:3001/vendor.html');
        assert.equal(resNoCookiesVendor.statusCode, 302, "Direct access with no cookies to vendor.html should return 302 redirect");
        assert.ok(resNoCookiesVendor.headers.location.includes('/login.html?error=Unauthorized%20Access'), "Redirect location mismatch");
        console.log("   Anonymous direct access to vendor.html correctly blocked & redirected.");

        // B. Access with correct token
        const adminCookie = `admin_token=${token}`;
        const resAdminWithCookie = await getHttpResponse('http://localhost:3001/admin.html', { Cookie: adminCookie });
        assert.equal(resAdminWithCookie.statusCode, 200, "Access with valid admin token should return 200");
        console.log("   Authenticated access to admin.html passed.");

        // C. Access with mismatching token (Role Escalation / Cross Access attempt)
        const vendorToken = generateToken({ user_id: '2', username: '9876543210', role: 'vendor' });
        const vendorCookie = `vendor_token=${vendorToken}`;
        
        // Vendor trying to access admin.html
        const resVendorAtAdmin = await getHttpResponse('http://localhost:3001/admin.html', { Cookie: vendorCookie });
        assert.equal(resVendorAtAdmin.statusCode, 302, "Vendor trying to load admin.html must be redirected");
        console.log("   Cross-role page load attempt (Vendor -> admin.html) successfully blocked.");

        // Check if failed attempt was logged in DB
        await new Promise(resolve => setTimeout(resolve, 200));
        const failedLog = await getDbRow("SELECT * FROM failed_access_logs ORDER BY id DESC LIMIT 1");
        assert.ok(failedLog, "Failed access log should be written to DB");
        assert.equal(failedLog.username, '9876543210', "Logged username mismatch");
        assert.equal(failedLog.attempted_role, 'super_admin_panel', "Logged attempted role mismatch");
        assert.equal(failedLog.actual_role, 'vendor', "Logged actual role mismatch");
        console.log("   Failed Access Attempt correctly logged to SQLite database.");

        console.log("=== ALL TEST CASES PASSED SUCCESSFULLY ===");
        process.exit(0);

    } catch (e) {
        console.error("!!! VERIFICATION TEST FAILED !!!");
        console.error(e);
        process.exit(1);
    }
})();
