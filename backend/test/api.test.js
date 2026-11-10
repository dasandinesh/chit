const { test } = require('node:test');
const assert = require('node:assert/strict');
const mongoose = require('mongoose');
const app = require('../app');
test('customer, chit, dues, payments and accounts persist with validation', async () => {
  const database = `chit_test_${process.pid}_${Date.now()}`;
  await mongoose.connect(`mongodb://127.0.0.1:27017/${database}`);
  const { Due } = require('../model/models');
  await Due.init();
  const server = app.listen(0, '127.0.0.1');
  await new Promise(resolve => server.once('listening', resolve));
  const headers = await require('./authHelper')(server);
  const request = async (path, body, method = 'POST', expected = 201) => {
    const response = await fetch(`http://127.0.0.1:${server.address().port}/api/${path}`, { method, headers, ...(body ? { body: JSON.stringify(body) } : {}) });
    const data = await response.json();
    assert.equal(response.status, expected, JSON.stringify(data));
    return data;
  };
  try {
    const customer = await request('customeradd', { name: 'Test Member', phone: '1234567890' });
    const chitData = { chit_det: { chit_name: 'Test Group', Tolal_amount: 1000, Due_amount: 100, time_preiod: 10 }, member_list: [{ member_id: customer._id }] };
    const chit = await request('chitadd', chitData);
    const unused = await request('chitadd', { ...chitData, chit_det: { ...chitData.chit_det, chit_name: 'Unused group' } });
    await request(`chitadd/${unused._id}`, null, 'DELETE', 200);
    await request(`chitadd/${unused._id}`, null, 'DELETE', 404);
    await request('chitdueadd', { chit_id: unused._id, chit_list: '1', date: '2026-11-05', amount: 100 }, 'POST', 404);
    const scheduledData = { ...chitData, chit_det: { ...chitData.chit_det, frequency: 'monthly', first_due_date: '2026-01-31' } };
    const scheduled = await request(`chitadd/${chit._id}`, scheduledData, 'PUT', 200);
    assert.equal(scheduled.chit_det.frequency, 'monthly');
    assert.equal(scheduled.chit_det.first_due_date, '2026-01-31');
    await request(`chitadd/${chit._id}`, { ...scheduledData, chit_det: { ...scheduledData.chit_det, first_due_date: '2026-02-30' } }, 'PUT', 400);
    await request(`chitadd/${chit._id}`, chitData, 'PUT', 200);
    const dueData = { chit_id: chit._id, chit_list: '1', date: '2026-11-05', amount: 100 };
    const due = await request('chitdueadd', dueData);
    await request(`chitadd/${chit._id}`, null, 'DELETE', 409);
    await request('chitdueadd', dueData, 'POST', 409);
    const pay = { id: due._id, memberId: customer._id, current_paid_amount: 40, date: '2026-11-05' };
    const partial = await request('chitdueamountupdate', pay, 'POST', 200);
    assert.equal(partial.member[0].pending_amount, 60);
    assert.equal(partial.member[0].paidStatus, 'not paid');
    await request('chitdueamountupdate', { ...pay, current_paid_amount: 61 }, 'POST', 400);
    await request('chitdueamountupdate', { ...pay, current_paid_amount: -1 }, 'POST', 400);
    const full = await request('chitdueamountupdate', { ...pay, current_paid_amount: 60 }, 'POST', 200);
    assert.equal(full.member[0].paid_amount, 100);
    assert.equal(full.member[0].paidStatus, 'paid');
    assert.equal(full.member[0].payments.length, 2);
    const flat = await request('dueamountunwind', null, 'GET', 200);
    assert.equal(flat[0].member.pending_amount, 0);
    await request('postcredit', { memberName: customer.name, date: '2026-11-05', credit: 50, debit: 0 });
    await request('postcredit', { memberName: customer.name, date: '2026-11-05', credit: 0, debit: 20, transactionType: 'personal' });
    assert.equal((await request('getaccount', null, 'GET', 200)).length, 2);
    await request('postcredit', { memberName: customer.name, date: '2026-11-05', credit: 10, debit: 10 }, 'POST', 400);
    const multiple = await request('chitadd', { ...chitData, member_list: Array.from({ length: 3 }, () => ({ member_id: customer._id })) });
    assert.equal(new Set(multiple.member_list.map(m => m.share_id)).size, 3);
    const edited = await request(`chitadd/${multiple._id}`, multiple, 'PUT', 200);
    assert.deepEqual(edited.member_list.map(m => m.share_id), multiple.member_list.map(m => m.share_id));
    const multipleDue = await request('chitdueadd', { ...dueData, chit_id: multiple._id });
    assert.equal(multipleDue.member.length, 3);
    const multiplePay = { ...pay, id: multipleDue._id, share_id: multipleDue.member[1].share_id };
    const paidSecond = await request('chitdueamountupdate', multiplePay, 'POST', 200);
    assert.deepEqual(paidSecond.member.map(m => m.paid_amount), [0, 40, 0]);
    assert.deepEqual(paidSecond.member.map(m => m.pending_amount), [100, 60, 100]);
    await request('chitdueamountupdate', { ...pay, id: multipleDue._id }, 'POST', 400);
    await request('chitdueamountupdate', { ...multiplePay, share_id: multipleDue.member[2].share_id, current_paid_amount: 100 }, 'POST', 200);
    const persisted = (await request('chitdue', null, 'GET', 200)).find(d => d._id === multipleDue._id);
    assert.deepEqual(persisted.member.map(m => m.paid_amount), [0, 40, 100]);
    // Existing dues without share IDs remain independently payable by stable row identifiers.
    const legacyDue = await request('chitdueadd', { ...dueData, chit_id: multiple._id, chit_list: 'legacy' });
    await Due.updateOne({ _id: legacyDue._id }, { $unset: { 'member.$[].share_id': '' } });
    const legacy = (await request('chitdue', null, 'GET', 200)).find(d => d._id === legacyDue._id);
    const legacyPaid = await request('chitdueamountupdate', { ...multiplePay, id: legacyDue._id, share_id: legacy.member[0].share_id, current_paid_amount: 10 }, 'POST', 200);
    assert.deepEqual(legacyPaid.member.map(m => m.paid_amount), [10, 0, 0]);

    // Opening balance first, then chronological installments across every share.
    const fifoCustomer = await request('customeradd', { name: 'FIFO Customer', phone: '9999999999', opening_balance: 200 });
    const fifoChit = await request('chitadd', { ...chitData, member_list: Array.from({ length: 3 }, () => ({ member_id: fifoCustomer._id })) });
    const newerDue = await request('chitdueadd', { ...dueData, chit_id: fifoChit._id, date: '2026-11-06', chit_list: 'newer' });
    const olderDue = await request('chitdueadd', { ...dueData, chit_id: fifoChit._id, date: '2026-10-01', chit_list: 'older' });
    const customerPath = `customer/${fifoCustomer._id}`;
    let balance = await request(`${customerPath}/balance`, null, 'GET', 200);
    assert.equal(balance.total_pending, 800);
    assert.equal(balance.total_shares, 3);
    const collection = { amount: 450, date: '2026-11-06', reference: 'customer-payment-001' };
    const received = await request(`${customerPath}/pay`, collection);
    assert.deepEqual(received.receipt.allocations.map(a => a.amount), [200, 100, 100, 50]);
    assert.equal(received.receipt.allocations[0].kind, 'opening');
    assert.ok(received.receipt.allocations.slice(1).every(a => a.due_id === olderDue._id));
    assert.equal(received.balance.total_pending, 350);
    const repeated = await request(`${customerPath}/pay`, collection, 'POST', 200);
    assert.equal(repeated.receipt._id, received.receipt._id);
    assert.equal(repeated.balance.total_pending, 350);
    await request(`${customerPath}/pay`, { ...collection, amount: 451 }, 'POST', 409);
    await request(`${customerPath}/pay`, { ...collection, amount: 351, reference: 'overpayment-test' }, 'POST', 400);
    await request(`${customerPath}/pay`, { ...collection, amount: -1, reference: 'negative-test' }, 'POST', 400);
    await request(`${customerPath}/pay`, { ...collection, amount: 0.001, reference: 'precision-test' }, 'POST', 400);
    await request(`${customerPath}/opening-balance`, { opening_balance: 199 }, 'PATCH', 400);
    await request(`${customerPath}/opening-balance`, { opening_balance: 250 }, 'PATCH', 200);
    let effectiveDues = await request('chitdue', null, 'GET', 200);
    assert.deepEqual(effectiveDues.find(d => d._id === olderDue._id).member.map(m => m.paid_amount), [100, 100, 50]);
    assert.deepEqual(effectiveDues.find(d => d._id === newerDue._id).member.map(m => m.paid_amount), [0, 0, 0]);
    assert.equal(effectiveDues.find(d => d._id === olderDue._id).member[2].payments[0].source, 'customer');
    // Direct share payments and customer-wide payments share the same balance ledger.
    await request('chitdueamountupdate', { id: newerDue._id, memberId: fifoCustomer._id, share_id: newerDue.member[2].share_id,
      current_paid_amount: 20, date: '2026-11-06', reference: 'direct-share-001' }, 'POST', 200);
    balance = await request(`${customerPath}/balance`, null, 'GET', 200);
    assert.equal(balance.total_pending, 380);
    const { Customer } = require('../model/models');
    const originalUpdate = Customer.findOneAndUpdate;
    Customer.findOneAndUpdate = async () => null;
    try {
      await request(`${customerPath}/pay`, { amount: 10, date: '2026-11-06', reference: 'conflict-test-001' }, 'POST', 409);
    } finally { Customer.findOneAndUpdate = originalUpdate; }
    assert.equal((await request(`${customerPath}/balance`, null, 'GET', 200)).total_pending, 380);
    const parallelPay = reference => fetch(`http://127.0.0.1:${server.address().port}/api/${customerPath}/pay`, {
      method: 'POST', headers, body: JSON.stringify({ amount: 300, date: '2026-11-06', reference })
    });
    const parallel = await Promise.all([parallelPay('parallel-payment-001'), parallelPay('parallel-payment-002')]);
    assert.equal(parallel.filter(r => r.status === 201).length, 1);
    assert.ok(parallel.some(r => [400, 409].includes(r.status)));
    assert.equal((await request(`${customerPath}/balance`, null, 'GET', 200)).total_pending, 80);
    await request(`${customerPath}/pay`, { amount: 80, date: '2026-11-06', reference: 'final-payment-001' });
    balance = await request(`${customerPath}/balance`, null, 'GET', 200);
    assert.equal(balance.total_pending, 0);
    assert.ok(balance.shares.every(m => m.pending_amount === 0));
    const listed = (await request('customer', null, 'GET', 200)).find(c => c._id === fifoCustomer._id);
    assert.equal(listed.total_pending, 0);
    assert.equal(listed.opening_paid, 250);
    // No other customer's balances were changed by this customer's collection.
    assert.equal((await request(`customer/${customer._id}/balance`, null, 'GET', 200)).total_pending, 450);
    // Chit Master editing preserves receipts and recalculates every share's pending amount.
    const editPath = `chitdue/${newerDue._id}`;
    const beforeEdit = await request(editPath, null, 'GET', 200);
    await request(editPath, { date: '2026-11-07', chit_list: 'revised', amount: 99 }, 'PUT', 400);
    const revised = await request(editPath, { date: '2026-11-07', chit_list: 'revised', amount: 120 }, 'PUT', 200);
    assert.deepEqual(revised.member.map(m => m.paid_amount), [100, 100, 100]);
    assert.deepEqual(revised.member.map(m => m.pending_amount), [20, 20, 20]);
    assert.deepEqual(revised.member.map(m => m.share_id), beforeEdit.member.map(m => m.share_id));
    assert.deepEqual(revised.member.map(m => m.payments.length), beforeEdit.member.map(m => m.payments.length));
    assert.ok(revised.member.every(m => m.date === '2026-11-07'));
    assert.equal((await request(`${customerPath}/balance`, null, 'GET', 200)).total_pending, 60);
    await request(editPath, { date: '2026-10-01', chit_list: 'older', amount: 120 }, 'PUT', 409);
    await request(`${customerPath}/pay`, { amount: 30, date: '2026-11-07', reference: 'after-edit-payment' });
    const receiptsBeforeDelete = (await request(`${customerPath}/balance`, null, 'GET', 200)).receipts.length;
    await request(editPath, null, 'DELETE', 200);
    assert.ok(!(await request('chitdue', null, 'GET', 200)).some(d => d._id === newerDue._id));
    assert.ok(!(await request('dueamountunwind', null, 'GET', 200)).some(d => d._id === newerDue._id));
    assert.equal((await request(`${customerPath}/balance`, null, 'GET', 200)).total_pending, 0);
    const archived = await request(editPath, null, 'GET', 200);
    assert.ok(archived.deletedAt);
    assert.deepEqual(archived.member.map(m => m.paid_amount), [120, 110, 100]);
    assert.ok((await request('chitdue?include_deleted=true', null, 'GET', 200)).some(d => d._id === newerDue._id));
    await request(editPath, { date: '2026-11-07', chit_list: 'changed', amount: 130 }, 'PUT', 409);
    await request('chitdueamountupdate', { id: newerDue._id, memberId: fifoCustomer._id, share_id: newerDue.member[2].share_id,
      current_paid_amount: 5, date: '2026-11-07', reference: 'deleted-share-pay' }, 'POST', 409);
    assert.equal((await request(`${customerPath}/balance`, null, 'GET', 200)).receipts.length, receiptsBeforeDelete);
    await request(`${editPath}/restore`, {}, 'POST', 200);
    assert.equal((await request(`${customerPath}/balance`, null, 'GET', 200)).total_pending, 30);
    assert.equal((await request(editPath, null, 'GET', 200)).deletedAt, null);
    // A payment racing an amount reduction must never leave a negative share balance.
    const raceDue = await request('chitdueadd', { ...dueData, chit_id: fifoChit._id, date: '2026-12-01', chit_list: 'race' });
    const raceRequest = (path, method, body) => fetch(`http://127.0.0.1:${server.address().port}/api/${path}`, { method,
      headers, body: JSON.stringify(body) });
    const race = await Promise.all([
      raceRequest('chitdueamountupdate', 'POST', { id: raceDue._id, memberId: fifoCustomer._id, share_id: raceDue.member[0].share_id,
        current_paid_amount: 80, date: '2026-12-01', reference: 'racing-payment-001' }),
      raceRequest(`chitdue/${raceDue._id}`, 'PUT', { date: '2026-12-01', chit_list: 'race', amount: 50 })
    ]);
    assert.equal(race.filter(r => r.status === 200).length, 1);
    const afterRace = await request(`chitdue/${raceDue._id}`, null, 'GET', 200);
    assert.ok(afterRace.member.every(m => m.pending_amount >= 0 && m.paid_amount <= m.amount));
    const overview = await request('dashboard', null, 'GET', 200);
    const allBalances = await request('customer', null, 'GET', 200);
    assert.equal(overview.summary.customers, allBalances.length);
    assert.equal(overview.summary.total_pending, allBalances.reduce((total, c) => total + Math.round(c.total_pending * 100), 0) / 100);
    assert.ok(overview.top_customers.length <= 5);
    assert.ok(overview.recent_payments.length <= 5);
  } finally {
    await new Promise(resolve => server.close(resolve));
    await mongoose.connection.dropDatabase();
    await mongoose.disconnect();
  }
});

