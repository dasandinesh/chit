const { test } = require('node:test');
const assert = require('node:assert/strict');
const notifications = require('../utils/notifications');
test('monthly schedules clamp dates without drifting and stop at installment count', () => {
  assert.equal(notifications.scheduledDate('2028-01-31', 'monthly', 1), '2028-02-29');
  assert.equal(notifications.scheduledDate('2028-01-31', 'monthly', 2), '2028-03-31');
  const chits = [{ _id: 'c', chit_det: { chit_name: 'Monthly', frequency: 'monthly', first_due_date: '2028-01-31', time_preiod: 3, Due_amount: 100 } }];
  const result = notifications(chits, [{ chit_id: 'c', date: '2028-01-31', member: [] }], '2028-03-30');
  assert.deepEqual(result.creation.map(r => [r.date, r.status]), [['2028-03-31', 'Tomorrow'], ['2028-02-29', 'Overdue']]);
  assert.equal(notifications(chits, [], '2029-01-01').creation.length, 3);
});
test('all weekly dates are included; collection uses remaining balances', () => {
  const chits = [{ _id: 'c', chit_det: { frequency: 'weekly', first_due_date: '2026-11-07', time_preiod: 3 } }, { _id: 'old', member_list: [] }];
  const dues = [{ _id: 'd', chit_id: 'c', date: '2026-11-07', member: [{ member_id: 'a', pending_amount: 20 }, { member_id: 'a', pending_amount: 30 }, { member_id: 'b', pending_amount: 0 }] }, { date: '2026-11-05', member: [{ pending_amount: 0 }] }, { date: '2026-11-08', member: [{ pending_amount: 100 }] }];
  assert.equal(notifications(chits, [], '2026-11-05').creation.length, 3);
  const result = notifications(chits, dues, '2026-11-06');
  assert.deepEqual(result.creation.map(r => r.date), ['2026-11-14', '2026-11-21']);
  assert.equal(result.collection.length, 2);
  assert.equal(result.collection[0].pending, 50);
  assert.equal(result.collection[0].customers, 1);
  assert.equal(result.collection[0].status, 'Tomorrow');
  assert.equal(result.collection[1].status, 'Upcoming');
});
test('November 21 is first on November 21, with future dates next and overdue dates last', () => {
  const chits = [{ _id: 'c', chit_det: { chit_name: 'Weekly', frequency: 'weekly', first_due_date: '2026-11-07', time_preiod: 6 } }];
  const dates = ['2026-11-28', '2026-11-07', '2026-12-12', '2026-11-21', '2026-12-05', '2026-11-14'];
  const dues = dates.map(date => ({ _id: date, chit_id: 'other', chit_name: 'Other', date, member: [{ pending_amount: 100 }] }));
  const result = notifications(chits, dues, '2026-11-21');
  const expected = ['2026-11-21', '2026-11-28', '2026-12-05', '2026-12-12', '2026-11-07', '2026-11-14'];
  assert.deepEqual(result.creation.map(r => r.date), expected);
  assert.deepEqual(result.collection.map(r => r.date), expected);
  assert.equal(result.creation[0].status, 'Today');
  const nextDay = notifications(chits, dues, '2026-11-22');
  assert.equal(nextDay.creation[0].date, '2026-11-28');
  assert.equal(nextDay.collection[0].date, '2026-11-28');
});

test('group popup includes missing, created, paid and off-schedule records without duplicates', () => {
  const chits = [{ _id: 'c', chit_det: { chit_name: 'Monthly', frequency: 'monthly', first_due_date: '2026-10-21', time_preiod: 4 }, member_list: [{ member_id: 'a' }, { member_id: 'a' }, { member_id: 'b' }] }, { _id: 'manual', chit_det: { chit_name: 'Manual' }, member_list: [] }];
  const due = (id, date, pending, paid) => ({ _id: id, chit_id: 'c', chit_name: 'Monthly', date, chit_list: id, amount: 100, member: [{ member_id: 'a', pending_amount: pending, paid_amount: paid }] });
  const result = notifications(chits, [due('paid', '2026-10-21', 0, 100), due('created', '2026-12-21', 80, 20), due('extra', '2026-11-25', 100, 0)], '2026-11-21');
  const group = result.groups.find(g => g.chit_id === 'c');
  assert.equal(group.next_date, '2026-11-21');
  assert.equal(group.missing_count, 2);
  assert.equal(group.customers, 2);
  assert.equal(group.shares, 3);
  assert.deepEqual(group.installments.map(r => r.date), ['2026-11-21', '2026-11-25', '2026-12-21', '2027-01-21', '2026-10-21']);
  assert.equal(group.installments.find(r => r.due_id === 'paid').payment_status, 'Paid');
  assert.equal(group.installments.find(r => r.due_id === 'paid').status, 'Past');
  assert.equal(group.installments.find(r => r.due_id === 'created').pending, 80);
  assert.equal(result.groups.find(g => g.chit_id === 'manual').installments.length, 0);
  assert.equal(result.collection.length, 2);
});
