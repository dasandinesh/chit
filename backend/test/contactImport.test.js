const { test } = require('node:test');
const assert = require('node:assert/strict');
const mongoose = require('mongoose');
const app = require('../app');
const { Customer } = require('../model/models');

test('contact imports persist selected balances and skip normalized duplicates including retries', async () => {
  const database = `chit_import_test_${process.pid}_${Date.now()}`;
  await mongoose.connect(`mongodb://127.0.0.1:27017/${database}`);
  const server = app.listen(0, '127.0.0.1');
  await new Promise(resolve => server.once('listening', resolve));
  const headers = await require('./authHelper')(server);
  const request = async contacts => {
    const response = await fetch(`http://127.0.0.1:${server.address().port}/api/customer/import`, { method: 'POST', headers, body: JSON.stringify({ contacts }) });
    return { status: response.status, data: await response.json() };
  };
  try {
    await Customer.create({ name: 'Existing', phone: '9876543210', opening_balance: 500 });
    const contacts = [{ name: 'Duplicate', phone: '+91 98765 43210' }, { name: 'New', phone: '8888888888', opening_balance: '250.50' }, { name: 'Same new', phone: '+918888888888' }, { name: '', phone: '7777777777' }, { name: 'Bad balance', phone: '6666666666', opening_balance: '-1' }];
    const result = await request(contacts);
    assert.equal(result.status, 200);
    assert.equal(result.data.imported, 1);
    assert.equal(result.data.duplicates, 2);
    assert.equal(result.data.failed, 2);
    assert.equal((await Customer.findOne({ name: 'New' })).opening_balance, 250.50);
    assert.equal((await Customer.findOne({ name: 'Existing' })).opening_balance, 500);
    assert.equal((await request(contacts)).data.imported, 0);
    assert.equal(await Customer.countDocuments(), 2);
    const batches = await Promise.all([request([{ name: 'Concurrent', phone: '7777777777' }]), request([{ name: 'Concurrent', phone: '+917777777777' }])]);
    assert.equal(batches.reduce((sum, result) => sum + result.data.imported, 0), 1);
    assert.equal((await request([])).status, 400);
    assert.equal((await request(Array(201).fill({}))).status, 400);
  } finally {
    await new Promise(resolve => server.close(resolve));
    await mongoose.connection.dropDatabase();
    await mongoose.disconnect();
  }
});
