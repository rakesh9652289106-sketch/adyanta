const crypto = require('crypto');
const SECRET = process.env.JWT_SECRET || 'adyanta_secure_gateway_secret_key_2026';

/**
 * Generate a cryptographically signed token (custom lightweight JWT)
 * @param {Object} payload 
 * @param {number} expiresInDays 
 * @returns {string} token
 */
function generateToken(payload, expiresInDays = 30) {
    const exp = Date.now() + expiresInDays * 24 * 60 * 60 * 1000;
    const data = JSON.stringify({ ...payload, exp });
    const payloadBase64 = Buffer.from(data).toString('base64url');
    const signature = crypto.createHmac('sha256', SECRET).update(payloadBase64).digest('base64url');
    return `${payloadBase64}.${signature}`;
}

/**
 * Verify a cryptographically signed token
 * @param {string} token 
 * @returns {Object|null} payload if valid, null otherwise
 */
function verifyToken(token) {
    if (!token) return null;
    const parts = token.split('.');
    if (parts.length !== 2) return null;
    const [payloadBase64, signature] = parts;
    const expectedSignature = crypto.createHmac('sha256', SECRET).update(payloadBase64).digest('base64url');
    
    // Constant time verification to prevent timing attacks
    try {
        const sigBuf = Buffer.from(signature, 'base64url');
        const expectedBuf = Buffer.from(expectedSignature, 'base64url');
        if (sigBuf.length !== expectedBuf.length || !crypto.timingSafeEqual(sigBuf, expectedBuf)) {
            return null;
        }
    } catch (e) {
        return null;
    }

    try {
        const payload = JSON.parse(Buffer.from(payloadBase64, 'base64url').toString('utf8'));
        if (Date.now() > payload.exp) {
            return null; // Expired
        }
        return payload;
    } catch (e) {
        return null;
    }
}

module.exports = { generateToken, verifyToken };
