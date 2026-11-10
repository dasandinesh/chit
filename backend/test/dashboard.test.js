const { test } = require('node:test');
const assert = require('node:assert/strict');
const dashboard = require('../utils/dashboard');

test('empty dashboard uses zero totals and India date at the UTC day boundary', () => {
  const result = dashboard({ customers: [], chits: [], dues: [] }, new Date('2026-11-05T18:30:00Z'));
  assert.equal(result.today, '2026-11-06');
  assert.ok(Object.values(result.summary).every(value => value === 0));
  assert.deepEqual(result.recent_payments, []);
});

test('receipt allocations are counted once; archived liabilities and future collections are excluded', () => {
  const now = new Date('2026-11-06T10:00:00Z');
  const customers = [
    { _id: 'a', name: 'A', opening_balance: 100, receipts: [
      { _id: 'r1', amount: 150, date: '2026-11-06', source: 'customer', createdAt: '2026-11-06T08:00:00Z', allocations: [
        { kind: 'opening', amount: 100 }, { kind: 'due', due_id: 'd1', share_id: 's1', amount: 25 }, { kind: 'due', due_id: 'd1', share_id: 's2', amount: 25 }
      ] },
      { _id: 'r2', amount: 30, date: '2026-10-31', source: 'share', createdAt: '2026-11-06T09:00:00Z', allocations: [{ kind: 'due', due_id: 'd1', share_id: 's1', amount: 30 }] },
      { _id: 'r3', amount: 10, date: '2026-11-07', source: 'share', createdAt: '2026-11-06T07:00:00Z', allocations: [{ kind: 'due', due_id: 'd1', share_id: 's1', amount: 10 }] }
    ] },
    { _id: 'b', name: 'B', opening_balance: 200, receipts: [{ _id: 'r4', amount: 90, date: '2026-11-06', source: 'share', createdAt: '2026-11-06T06:00:00Z', allocations: [{ kind: 'due', due_id: 'archived', share_id: 's3', amount: 90 }] }] }
  ];
  const chits = [{ member_list: [{ member_id: 'a', share_id: 's1' }, { member_id: 'a', share_id: 's2' }] }];
  const dues = [
    { _id: 'd1', member: ['s1', 's2'].map(share_id => ({ member_id: 'a', share_id, paid_amount: 0, pending_amount: 100, payments: [] })) },
    { _id: 'archived', deletedAt: now, member: [{ member_id: 'b', share_id: 's3', paid_amount: 0, pending_amount: 100, payments: [] }] },
    { _id: 'legacy', member: [{ member_id: 'a', paid_amount: 20, pending_amount: 0, payments: [{ _id: 'old', amount: 20, date: '2026-11-06', createdAt: '2026-11-06T05:00:00Z' }] }] }
  ];
  const result = dashboard({ customers, chits, dues }, now);
  assert.deepEqual(result.summary, { customers: 2, chit_groups: 1, shares: 2, opening_pending: 200, chit_pending: 110, total_pending: 310, today_received: 260, month_received: 260 });
  assert.deepEqual(result.top_customers.map(c => c._id), ['b', 'a']);
  assert.equal(result.recent_payments.length, 5);
  assert.equal(result.recent_payments[0]._id, 'r2');
  assert.equal(result.recent_payments.filter(p => p._id === 'r1').length, 1);
});

test('highest pending list is limited to five and excludes settled customers', () => {
  const customers = Array.from({ length: 8 }, (_, i) => ({ _id: String(i), name: `Customer ${i}`, opening_balance: i, receipts: [] }));
  const result = dashboard({ customers, chits: [], dues: [] });
  assert.deepEqual(result.top_customers.map(c => c.total_pending), [7, 6, 5, 4, 3]);
});
