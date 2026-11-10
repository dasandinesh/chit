const fs = require('node:fs/promises');
const path = require('node:path');
const crypto = require('node:crypto');
const { Admin, hashPassword, passwordValid } = require('./auth');
module.exports = async function bootstrapAdmin() {
  if (await Admin.exists({ _id: 'admin' })) return;
  const username = process.env.ADMIN_USERNAME || 'admin';
  const password = process.env.ADMIN_PASSWORD || crypto.randomBytes(18).toString('base64url');
  if (!passwordValid(password)) throw new Error('ADMIN_PASSWORD must contain 6 to 128 characters.');
  // Write initial credentials locally before enabling the account; never log the password.
  if (!process.env.ADMIN_PASSWORD) await fs.writeFile(path.join(__dirname, 'config/admin-login.txt'), `Username: ${username}\nPassword: ${password}\n\nInitial credentials. Change the password inside the application after logging in.\n`, { mode: 0o600 });
  await Admin.create({ _id: 'admin', username, passwordHash: await hashPassword(password) });
};
