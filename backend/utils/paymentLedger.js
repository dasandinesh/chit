const { Customer, Chit, Due } = require('../model/models');
const exclusive = require('./paymentQueue');

function fail(message, status = 400) { const error = new Error(message); error.status = status; throw error; }
function cents(value) { return Math.round(Number(value || 0) * 100); }
function money(value, positive = false) {
  const scaled = Number(value) * 100;
  if (!['number', 'string'].includes(typeof value) || String(value).trim() === '' || !Number.isFinite(scaled) || Number(value) < 0 || (positive && Number(value) <= 0) || Math.abs(scaled - Math.round(scaled)) > 0.000001 || !Number.isSafeInteger(Math.round(scaled))) fail('Enter a valid amount with at most two decimal places');
  return cents(value) / 100;
}
const shareId = (member, index) => member.share_id || `legacy-${index + 1}`;

// Receipts and their allocations are saved together on one customer document.
// Views derive balances from this ledger, so standalone MongoDB needs no multi-document transaction.
function applyLedger(due, customers) {
  const entries = new Map();
  customers.forEach(customer => (customer.receipts || []).forEach(receipt => receipt.allocations.forEach(a => {
    if (a.kind !== 'due' || String(a.due_id) !== String(due._id)) return;
    const key = `${customer._id}:${a.share_id}`;
    const payments = entries.get(key) || [];
    payments.push({ _id: `${receipt._id}:${a.share_id}`, receipt_id: receipt._id, amount: a.amount, date: receipt.date, createdAt: receipt.createdAt, source: receipt.source });
    entries.set(key, payments);
  })));
  return { ...due, member: due.member.map((member, index) => {
    const id = shareId(member, index);
    const payments = entries.get(`${member.member_id}:${id}`) || [];
    const added = payments.reduce((sum, p) => sum + cents(p.amount), 0);
    const paid = (cents(member.paid_amount) + added) / 100;
    const pending = (cents(member.pending_amount) - added) / 100;
    return { ...member, share_id: id, share_number: index + 1, paid_amount: paid, pending_amount: pending,
      paidStatus: pending === 0 ? 'paid' : 'not paid', payments: [...(member.payments || []), ...payments] };
  }) };
}

function summary(customer, dues, chits) {
  const openingPaid = (customer.receipts || []).reduce((sum, receipt) => sum + receipt.allocations.filter(a => a.kind === 'opening').reduce((n, a) => n + cents(a.amount), 0), 0);
  const shares = dues.flatMap(d => d.member.filter(m => String(m.member_id) === String(customer._id)).map(m => ({
    due_id: d._id, chit_name: d.chit_name, chit_list: d.chit_list, date: d.date, ...m
  })));
  const duePending = shares.reduce((sum, m) => sum + cents(m.pending_amount), 0);
  const opening = cents(customer.opening_balance);
  const activeShares = chits.reduce((sum, chit) => sum + chit.member_list.filter(m => String(m.member_id) === String(customer._id)).length, 0);
  return { _id: customer._id, name: customer.name, phone: customer.phone, pending_flag: customer.pending_flag,
    opening_balance: opening / 100, opening_paid: openingPaid / 100, opening_pending: (opening - openingPaid) / 100,
    chit_pending: duePending / 100, total_pending: (opening - openingPaid + duePending) / 100,
    total_shares: activeShares, due_shares: shares.length, shares };
}

async function context(customerId) {
  const customer = await Customer.findById(customerId).lean();
  if (!customer) fail('Customer not found', 404);
  const [rawDues, chits] = await Promise.all([
    Due.find({ 'member.member_id': customer._id, deletedAt: null }).sort({ date: 1, createdAt: 1, _id: 1 }).lean(),
    Chit.find({ 'member_list.member_id': customer._id, deletedAt: null }).lean()
  ]);
  const dues = rawDues.map(d => applyLedger(d, [customer]));
  return { customer, dues, balance: summary(customer, dues, chits) };
}

async function recordPayment(customerId, body, target) {
  const amount = money(body.amount, true);
  if (typeof body.date !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(body.date) || !Number.isFinite(Date.parse(body.date)) || new Date(body.date).toISOString().slice(0, 10) !== body.date) fail('Enter a valid date (YYYY-MM-DD)');
  if (typeof body.reference !== 'string' || !/^[a-zA-Z0-9_-]{8,100}$/.test(body.reference)) fail('A payment reference is required');
  const { customer, balance } = await context(customerId);
  const source = target ? 'share' : 'customer';
  const existing = (customer.receipts || []).find(r => r.reference === body.reference);
  if (existing) {
    const a = existing.allocations[0];
    if (existing.amount !== amount || existing.date !== body.date || existing.source !== source || (target && (String(a.due_id) !== String(target.due_id) || a.share_id !== target.share_id))) fail('Payment reference already used with different details', 409);
    return { receipt: existing, balance, duplicate: true };
  }
  let remaining = cents(amount);
  const allocations = [];
  if (!target) {
    if (remaining > cents(balance.total_pending)) fail('Payment exceeds total pending balance');
    const opening = Math.min(remaining, cents(balance.opening_pending));
    if (opening > 0) { allocations.push({ kind: 'opening', amount: opening / 100 }); remaining -= opening; }
  }
  const shares = target ? balance.shares.filter(m => String(m.due_id) === String(target.due_id) && m.share_id === target.share_id) : balance.shares;
  if (target && !shares.length) fail('Member share not found', 404);
  if (target && remaining > cents(shares[0].pending_amount)) fail('Payment exceeds pending amount');
  for (const share of shares) {
    if (!remaining) break;
    const applied = Math.min(remaining, cents(share.pending_amount));
    if (applied <= 0) continue;
    allocations.push({ kind: 'due', due_id: share.due_id, share_id: share.share_id, share_number: share.share_number,
      chit_name: share.chit_name, chit_list: share.chit_list, due_date: share.date, amount: applied / 100 });
    remaining -= applied;
  }
  if (remaining) fail('Unable to allocate the full payment; refresh balances', 409);
  const receipt = { reference: body.reference, amount, date: body.date, source, allocations };
  const updated = await Customer.findOneAndUpdate({ _id: customer._id, __v: customer.__v },
    { $push: { receipts: receipt }, $inc: { __v: 1 } }, { new: true, runValidators: true });
  if (!updated) fail('Customer balance changed; refresh and retry this payment', 409);
  return { receipt: updated.receipts[updated.receipts.length - 1].toObject(), balance: (await context(customerId)).balance, duplicate: false };
}

module.exports = { applyLedger, summary, context, recordPayment: (...args) => exclusive(() => recordPayment(...args)), money, fail, shareId };
