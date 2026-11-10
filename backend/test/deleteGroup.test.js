const { test } = require('node:test');
const assert = require('node:assert/strict');
const mongoose = require('mongoose');
const app = require('../app');
test('groups with only deleted installments can leave the list without losing payments', async () => {
  await mongoose.connect(`mongodb://127.0.0.1:27017/chit_delete_test_${process.pid}_${Date.now()}`);
  const server = app.listen(0, '127.0.0.1');
  await new Promise(resolve => server.once('listening', resolve));
  const headers = await require('./authHelper')(server);
  const request = async (path, method = 'GET', body, status = 200) => {
    const response = await fetch(`http://127.0.0.1:${server.address().port}/api/${path}`, { method, headers, ...(body ? { body: JSON.stringify(body) } : {}) });
    const result = await response.json(); assert.equal(response.status, status, JSON.stringify(result)); return result;
  };
  try {
    const customer = await request('customeradd', 'POST', { name: 'Member', phone: '9876543210' }, 201);
    const group = await request('chitadd', 'POST', { chit_det: { chit_name: 'Group', Tolal_amount: 1000, Due_amount: 100, time_preiod: 10 }, member_list: [{ member_id: customer._id }] }, 201);
    const installment = { chit_id: group._id, date: '2026-11-06', chit_list: '1', amount: 100 };
    const due = await request('chitdueadd', 'POST', installment, 201);
    await request(`chitadd/${group._id}`, 'DELETE', null, 409);
    await request(`customer/${customer._id}/pay`, 'POST', { amount: 40, date: '2026-11-06', reference: 'delete-group-payment' }, 201);
    await request(`chitdue/${due._id}`, 'DELETE');
    await request(`chitadd/${group._id}`, 'DELETE');
    assert.equal((await request('chit')).length, 0);
    assert.equal((await request('dashboard')).notifications.groups.length, 0);
    const balance = await request(`customer/${customer._id}/balance`);
    assert.equal(balance.total_pending, 0);
    assert.equal(balance.total_shares, 0);
    assert.equal(balance.receipts.length, 1);
    assert.equal((await request(`chitdue/${due._id}`)).member[0].paid_amount, 40);
    await request('chitdueadd', 'POST', installment, 404);
    await request(`chitdue/${due._id}/restore`, 'POST');
    assert.equal((await request('chit')).length, 1);
    assert.equal((await request(`customer/${customer._id}/balance`)).total_pending, 60);
    await request(`chitdue/${due._id}/permanent`, 'DELETE', null, 409);
    await request(`chitdue/${due._id}`, 'DELETE');
    await request(`chitdue/${due._id}/permanent`, 'DELETE', null, 409);
    const mistaken = await request('chitdueadd', 'POST', { ...installment, chit_list: 'mistake' }, 201);
    await request(`chitdue/${mistaken._id}/permanent`, 'DELETE', null, 409);
    await request(`chitdue/${mistaken._id}`, 'DELETE');
    await request(`chitdue/${mistaken._id}/permanent`, 'DELETE');
    await request(`chitdue/${mistaken._id}`, 'GET', null, 404);
    await request('chitdueadd', 'POST', { ...installment, chit_list: 'mistake' }, 201);
    const scheduled = await request('chitadd', 'POST', { chit_det: { chit_name: 'Scheduled', Tolal_amount: 1000, Due_amount: 100, time_preiod: 3, frequency: 'monthly', first_due_date: '2026-11-09' }, member_list: [{ member_id: customer._id }] }, 201);
    const skipPath = `chitadd/${scheduled._id}/schedule/2026-12-09`;
    await request(skipPath, 'DELETE');
    await request(skipPath, 'DELETE');
    const overview = await request('dashboard');
    const schedule = overview.notifications.groups.find(row => row.chit_id === scheduled._id);
    assert.equal(schedule.missing_count, 2);
    assert.ok(!schedule.installments.some(row => row.date === '2026-12-09'));
    assert.ok(!(await request('chit')).find(row => row._id === scheduled._id).skipped_dates.includes('2027-01-09'));
    await request(`chitadd/${scheduled._id}/schedule/2026-12-10`, 'DELETE', null, 400);
    await request('chitdueadd', 'POST', { ...installment, chit_id: scheduled._id, date: '2026-11-09' }, 201);
    await request(`chitadd/${scheduled._id}/schedule/2026-11-09`, 'DELETE', null, 409);
  } finally {
    await new Promise(resolve => server.close(resolve));
    await mongoose.connection.dropDatabase(); await mongoose.disconnect();
  }
});
