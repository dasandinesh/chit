const { test } = require('node:test');
const assert = require('node:assert/strict');
const mongoose = require('mongoose');
const app = require('../app');
const { Admin, Session, hashPassword } = require('../auth');

test('single admin authentication protects API, revokes sessions and limits login attempts', async () => {
  await mongoose.connect(`mongodb://127.0.0.1:27017/chit_auth_test_${process.pid}_${Date.now()}`);
  const server = app.listen(0, '127.0.0.1');
  await new Promise(resolve => server.once('listening', resolve));
  const request = async (path, body, cookie, csrf = true) => {
    const response = await fetch(`http://127.0.0.1:${server.address().port}/api/${path}`, { method: body === undefined ? 'GET' : 'POST',
      headers: { 'Content-Type': 'application/json', ...(cookie ? { Cookie: cookie } : {}), ...(csrf ? { 'X-Chit-Request': '1' } : {}) },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }) });
    return { status: response.status, data: await response.json(), cookie: response.headers.get('set-cookie') };
  };
  const credentials = { username: 'admin', password: 'TestPassword123!' };
  try {
    await Admin.create({ _id: 'admin', username: 'admin', passwordHash: await hashPassword(credentials.password) });
    await assert.rejects(Admin.create({ _id: 'another', username: 'another', passwordHash: 'anything' }));
    assert.equal((await request('customer')).status, 401);
    assert.equal((await request('dashboard')).status, 401);
    assert.equal((await request('auth/session')).data.authenticated, false);
    assert.equal((await request('auth/login', credentials, null, false)).status, 403);
    assert.equal((await request('auth/login', { ...credentials, password: 'wrong' })).status, 401);
    const login = await request('auth/login', credentials);
    assert.equal(login.status, 200);
    assert.match(login.cookie, /HttpOnly/);
    assert.match(login.cookie, /SameSite=Strict/);
    const cookie = login.cookie.split(';')[0];
    assert.equal((await request('auth/session', undefined, cookie)).data.authenticated, true);
    assert.equal((await request('customer', undefined, cookie)).status, 200);
    assert.equal((await request('customeradd', { name: 'X', phone: '123' }, cookie, false)).status, 403);
    const stored = await Session.findOne().lean();
    assert.notEqual(stored._id, cookie.split('=')[1]);
    assert.equal((await request('auth/password', { currentPassword: 'wrong', newPassword: 'New123' }, cookie)).status, 400);
    assert.equal((await request('auth/password', { currentPassword: credentials.password, newPassword: 'short' }, cookie)).status, 400);
    const second = (await request('auth/login', credentials)).cookie.split(';')[0];
    assert.equal((await request('auth/password', { currentPassword: credentials.password, newPassword: 'New123' }, cookie)).status, 200);
    assert.equal((await request('customer', undefined, cookie)).status, 401);
    assert.equal((await request('customer', undefined, second)).status, 401);
    assert.equal((await request('auth/login', credentials)).status, 401);
    const next = (await request('auth/login', { ...credentials, password: 'New123' })).cookie.split(';')[0];
    await Session.updateMany({}, { expiresAt: new Date(Date.now() - 1000) });
    assert.equal((await request('customer', undefined, next)).status, 401);
    const last = (await request('auth/login', { ...credentials, password: 'New123' })).cookie.split(';')[0];
    assert.equal((await request('auth/logout', {}, last)).status, 200);
    assert.equal((await request('customer', undefined, last)).status, 401);
    for (let i = 0; i < 10; i++) await request('auth/login', { ...credentials, password: 'wrong' });
    assert.equal((await request('auth/login', credentials)).status, 429);
  } finally {
    await new Promise(resolve => server.close(resolve));
    await mongoose.connection.dropDatabase(); await mongoose.disconnect();
  }
});
