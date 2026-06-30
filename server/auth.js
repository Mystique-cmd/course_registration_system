const bcrypt = require('bcryptjs');

const SALT_ROUNDS = 10;

async function hashPassword(plain) {
  return bcrypt.hash(String(plain), SALT_ROUNDS);
}

async function verifyPassword(plain, hash) {
  return bcrypt.compare(String(plain), hash);
}

module.exports = { hashPassword, verifyPassword };

