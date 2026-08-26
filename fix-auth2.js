var fs = require('fs');
var f = process.argv[2];
var c = fs.readFileSync(f, 'utf8');

// Fix handleAdminLogin to use signAdminToken
var old = "  pruneAdminTokens();\n  var tok = crypto.randomBytes(24).toString('hex');\n  ADMIN_TOKENS.set(tok, Date.now() + 12 * 3600 * 1000);";
var newCode = "  var tok = signAdminToken(Date.now() + 12 * 3600 * 1000);";

if (c.indexOf(old) === -1) { console.log('LOGIN MARKER NOT FOUND'); process.exit(1); }
c = c.replace(old, newCode);

// Remove any remaining pruneAdminTokens calls
c = c.replace(/pruneAdminTokens\(\);\n/g, '');

// Remove orphaned ADMIN_TOKENS references
c = c.replace(/ADMIN_TOKENS\.set\([^)]+\);/g, '/* ADMIN_TOKENS removed — using HMAC */');
c = c.replace(/ADMIN_TOKENS\.get\([^)]+\)/g, 'false /* ADMIN_TOKENS removed */');
c = c.replace(/ADMIN_TOKENS\.delete\([^)]+\);/g, '');

fs.writeFileSync(f, c, 'utf8');
console.log('Done fixing handleAdminLogin');
