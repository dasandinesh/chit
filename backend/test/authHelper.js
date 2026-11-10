const { Admin, hashPassword } = require('../auth');
module.exports = async function loginAdmin(server) {
  await Admin.create({ _id: 'admin', username: 'admin', passwordHash: await hashPassword('TestPassword123!') });
  const response = await fetch(`http://127.0.0.1:${server.address().port}/api/auth/login`, {
    method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Chit-Request': '1' },
    body: JSON.stringify({ username: 'admin', password: 'TestPassword123!' })
  });
  if (!response.ok) throw new Error('Test login failed');
  return { 'Content-Type': 'application/json', 'X-Chit-Request': '1', Cookie: response.headers.get('set-cookie').split(';')[0] };
};
