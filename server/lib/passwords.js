const crypto = require('crypto');

// Frontend uses a default password flow ("default").
// Store as a salted SHA256 hash (simple, non-production). Swap to bcrypt in real deployments.
function hashPassword(password) {
  const salt = crypto.randomBytes(16).toString('hex');
  const hash = crypto.createHash('sha256').update(`${salt}:${password}`).digest('hex');
  return `sha256$${salt}$${hash}`;
}

function verifyPassword(password, passwordHash) {
  if (!passwordHash) return false;
  const parts = String(passwordHash).split('$');
  // format: sha256$<salt>$<hash>
  if (parts.length !== 3) return false;
  const [, salt, expected] = parts;
  const actual = crypto.createHash('sha256').update(`${salt}:${password}`).digest('hex');
  return crypto.timingSafeEqual(Buffer.from(actual), Buffer.from(expected));
}

module.exports = {
  hashPassword,
  verifyPassword,
};

