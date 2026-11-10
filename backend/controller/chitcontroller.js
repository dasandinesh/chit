const { Customer, Chit, Due, Account } = require('../model/models');
const ledger = require('../utils/paymentLedger');
const exclusive = require('../utils/paymentQueue');
const { Types } = require('mongoose');
const shareId = (member, index) => member.share_id || `legacy-${index + 1}`;
function fail(message, status = 400) { const error = new Error(message); error.status = status; throw error; }
function amount(value, positive = false) {
  if (value === '' || value == null || !Number.isFinite(Number(value)) || Number(value) < 0 || (positive && Number(value) === 0)) fail('Enter a valid amount');
  return Math.round(Number(value) * 100) / 100;
}
function date(value) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value) || !Number.isFinite(Date.parse(value)) || new Date(value).toISOString().slice(0, 10) !== value) fail('Enter a valid date (YYYY-MM-DD)');
  return value;
}
exports.customers = async (req, res) => {
  const [customers, rawDues, chits] = await Promise.all([Customer.find().sort({ createdAt: 1 }).lean(), Due.find({ deletedAt: null }).sort({ date: 1, createdAt: 1, _id: 1 }).lean(), Chit.find({ deletedAt: null }).lean()]);
  const dues = rawDues.map(d => ledger.applyLedger(d, customers));
  res.json(customers.map(customer => {
    const { shares, ...balance } = ledger.summary(customer, dues, chits);
    return balance;
  }));
};
exports.addCustomer = async (req, res) => {
  const { name, phone, pending_flag } = req.body;
  const opening_balance = ledger.money(req.body.opening_balance ?? 0);
  const customer = await Customer.create({ name, phone, opening_balance, pending_flag: pending_flag === true || pending_flag === 'true' });
  res.status(201).json({ _id: customer._id, name: customer.name, phone: customer.phone, opening_balance: customer.opening_balance });
};
exports.customerBalance = async (req, res) => {
  const { customer, balance } = await ledger.context(req.params.id);
  res.json({ ...balance, receipts: customer.receipts || [] });
};
exports.customerPay = async (req, res) => {
  const result = await ledger.recordPayment(req.params.id, req.body);
  res.status(result.duplicate ? 200 : 201).json(result);
};
exports.openingBalance = async (req, res) => {
  const opening = ledger.money(req.body.opening_balance);
  const { customer, balance } = await ledger.context(req.params.id);
  if (opening < balance.opening_paid) fail('Opening balance cannot be less than the opening amount already paid');
  const updated = await Customer.findOneAndUpdate({ _id: customer._id, __v: customer.__v }, { $set: { opening_balance: opening }, $inc: { __v: 1 } }, { new: true, runValidators: true });
  if (!updated) fail('Customer balance changed; refresh and try again', 409);
  res.json((await ledger.context(req.params.id)).balance);
};
exports.chits = async (req, res) => res.json(await Chit.find({ deletedAt: null }).sort({ createdAt: 1 }));
exports.skipScheduledInstallment = async (req, res) => exclusive(async () => {
  const dueDate = date(req.params.date);
  const chit = await Chit.findOne({ _id: req.params.id, deletedAt: null });
  if (!chit) fail('Chit group not found', 404);
  const det = chit.chit_det;
  const { scheduledDate } = require('../utils/notifications');
  const count = Math.min(1200, Number(det.time_preiod) || 0);
  if (!['weekly', 'monthly'].includes(det.frequency) || !det.first_due_date || !Array.from({ length: count }, (_, index) => scheduledDate(det.first_due_date, det.frequency, index)).includes(dueDate)) fail('This date is not in the group schedule.');
  if (await Due.exists({ chit_id: chit._id, date: dueDate, deletedAt: null })) fail('This installment has already been created. Refresh and delete its Chit Master record instead.', 409);
  await Chit.updateOne({ _id: chit._id }, { $addToSet: { skipped_dates: dueDate } });
  res.json({ message: 'Scheduled installment removed.', date: dueDate });
});
exports.deleteChit = async (req, res) => exclusive(async () => {
  const chit = await Chit.findOne({ _id: req.params.id, deletedAt: null });
  if (!chit) fail('Chit group not found', 404);
  if (await Due.exists({ chit_id: chit._id, deletedAt: null })) fail('This group has active Chit Master records. Move those installments to Deleted Records before deleting the group.', 409);
  await Chit.updateOne({ _id: chit._id }, { $set: { deletedAt: new Date() } });
  res.json({ _id: chit._id, message: 'Chit group deleted.' });
});
exports.saveChit = async (req, res) => {
  const { chit_det, member_list } = req.body;
  if (!chit_det || !Array.isArray(member_list) || !member_list.length) fail('Chit details and at least one member are required');
  const frequency = chit_det.frequency || 'none';
  if (!['none', 'weekly', 'monthly'].includes(frequency)) fail('Select weekly or monthly schedule');
  if (frequency !== 'none' && (!Number.isInteger(Number(chit_det.time_preiod)) || Number(chit_det.time_preiod) < 1 || Number(chit_det.time_preiod) > 1200)) fail('Scheduled installments must be between 1 and 1200');
  const first_due_date = frequency === 'none' ? '' : date(chit_det.first_due_date);
  const ids = member_list.map(m => String(m.member_id));
  const customers = await Customer.find({ _id: { $in: ids } });
  if (customers.length !== new Set(ids).size) fail('Select existing customers');
  const shares = member_list.map(m => m.share_id || new Types.ObjectId().toString());
  if (shares.some(id => typeof id !== 'string' || !Types.ObjectId.isValid(id)) || new Set(shares).size !== shares.length) fail('Each share must have a unique valid ID');
  const data = { chit_det: { chit_name: chit_det.chit_name, Tolal_amount: amount(chit_det.Tolal_amount, true), Due_amount: amount(chit_det.Due_amount, true), time_preiod: chit_det.time_preiod, frequency, first_due_date },
    member_list: ids.map((id, index) => ({ share_id: shares[index], member_id: id, name: customers.find(c => String(c._id) === id).name })) };
  if (req.method === 'PUT') {
    const chit = await Chit.findOneAndUpdate({ _id: req.params.id, deletedAt: null }, { $set: data }, { new: true, runValidators: true });
    if (!chit) fail('Chit not found', 404);
    return res.json(chit);
  }
  res.status(201).json(await Chit.create(data));
};
exports.dues = async (req, res) => {
  const [dues, customers] = await Promise.all([Due.find(req.query.include_deleted === 'true' ? {} : { deletedAt: null }).sort({ createdAt: 1 }).lean(), Customer.find().lean()]);
  res.json(dues.map(d => ledger.applyLedger(d, customers)));
};
exports.flatDues = async (req, res) => {
  const [dues, customers] = await Promise.all([Due.find({ deletedAt: null }).sort({ createdAt: 1 }).lean(), Customer.find().lean()]);
  res.json(dues.map(d => ledger.applyLedger(d, customers)).flatMap(d => d.member.map(member => ({ ...d, member }))));
};
exports.addDue = async (req, res) => exclusive(async () => {
  const chit = req.body.chit_id ? await Chit.findOne({ _id: req.body.chit_id, deletedAt: null }) : await Chit.findOne({ 'chit_det.chit_name': req.body.chit_name, deletedAt: null });
  if (!chit) fail('Chit not found', 404);
  const dueAmount = ledger.money(req.body.amount, true), dueDate = date(req.body.date);
  res.status(201).json(await Due.create({ chit_id: chit._id, chit_name: chit.chit_det.chit_name, chit_list: req.body.chit_list, date: dueDate, amount: dueAmount,
    member: chit.member_list.map(m => ({ share_id: m.share_id || new Types.ObjectId().toString(), name: m.name, member_id: m.member_id, date: dueDate, amount: dueAmount, paid_amount: 0, pending_amount: dueAmount, paidStatus: 'not paid' })) }));
});
exports.getDue = async (req, res) => {
  const due = await Due.findById(req.params.id).lean();
  if (!due) fail('Chit Master record not found', 404);
  const customers = await Customer.find({ _id: { $in: due.member.map(m => m.member_id) } }).lean();
  res.json(ledger.applyLedger(due, customers));
};
exports.editDue = async (req, res) => exclusive(async () => {
  const due = await Due.findById(req.params.id).lean();
  if (!due) fail('Chit Master record not found', 404);
  if (due.deletedAt) fail('Restore this record before editing', 409);
  if (req.body.chit_id && String(req.body.chit_id) !== String(due.chit_id)) fail('The chit group cannot be changed on an existing installment');
  const nextAmount = ledger.money(req.body.amount, true), nextDate = date(req.body.date);
  const nextList = typeof req.body.chit_list === 'string' ? req.body.chit_list.trim() : '';
  if (!nextList) fail('List name / number is required');
  const customers = await Customer.find({ _id: { $in: due.member.map(m => m.member_id) } }).lean();
  const effective = ledger.applyLedger(due, customers);
  if (effective.member.some(m => Math.round(m.paid_amount * 100) > Math.round(nextAmount * 100))) fail('Amount per share cannot be less than the amount already paid on any share');
  const members = due.member.map(m => ({ ...m, date: nextDate, amount: nextAmount,
    pending_amount: (Math.round(nextAmount * 100) - Math.round(m.paid_amount * 100)) / 100 }));
  const updated = await Due.findOneAndUpdate({ _id: due._id, __v: due.__v, deletedAt: null },
    { $set: { date: nextDate, chit_list: nextList, amount: nextAmount, member: members }, $inc: { __v: 1 } }, { new: true, runValidators: true });
  if (!updated) fail('Record changed; refresh and try again', 409);
  res.json(ledger.applyLedger(updated.toObject(), customers));
});
exports.deleteDue = async (req, res) => exclusive(async () => {
  const due = await Due.findById(req.params.id);
  if (!due) fail('Chit Master record not found', 404);
  if (!due.deletedAt) {
    due.deletedAt = new Date();
    await due.save();
  }
  res.json({ message: 'Chit Master record moved to deleted records. Receipt history is preserved.', _id: due._id });
});
exports.permanentlyDeleteDue = async (req, res) => exclusive(async () => {
  const due = await Due.findById(req.params.id).lean();
  if (!due) fail('Chit Master record not found', 404);
  if (!due.deletedAt) fail('Move this installment to Deleted Records first.', 409);
  const paid = due.member.some(member => member.paid_amount > 0 || member.payments?.length);
  if (paid || await Customer.exists({ 'receipts.allocations.due_id': due._id })) fail('This installment has payment history. It cannot be permanently deleted; restore or edit it instead.', 409);
  await Due.deleteOne({ _id: due._id, deletedAt: { $ne: null } });
  res.json({ _id: due._id, message: 'Installment permanently deleted. You can create it again.' });
});
exports.restoreDue = async (req, res) => exclusive(async () => {
  const due = await Due.findByIdAndUpdate(req.params.id, { $set: { deletedAt: null }, $inc: { __v: 1 } }, { new: true });
  if (!due) fail('Chit Master record not found', 404);
  await Chit.updateOne({ _id: due.chit_id }, { $set: { deletedAt: null } });
  res.json({ message: 'Chit Master record restored', _id: due._id });
});
exports.pay = async (req, res) => {
  const due = await Due.findById(req.body.id).lean();
  if (!due) fail('Due not found', 404);
  if (due.deletedAt) fail('Cannot receive payment for a deleted record', 409);
  const matches = due.member.map((member, index) => ({ member, index })).filter(({ member, index }) =>
    String(member.member_id) === String(req.body.memberId) && (!req.body.share_id || shareId(member, index) === req.body.share_id));
  if (!matches.length) fail('Member share not found', 404);
  if (matches.length > 1) fail('Select a specific share for this customer');
  const { member, index } = matches[0];
  await ledger.recordPayment(member.member_id, { amount: req.body.current_paid_amount, date: req.body.date || req.body.amount_date,
    reference: req.body.reference || new Types.ObjectId().toString() }, { due_id: due._id, share_id: shareId(member, index) });
  const customers = await Customer.find({ _id: { $in: due.member.map(m => m.member_id) } }).lean();
  res.json(ledger.applyLedger(await Due.findById(due._id).lean(), customers));
};
exports.accounts = async (req, res) => res.json(await Account.find().sort({ createdAt: 1 }));
exports.addAccount = async (req, res) => {
  const credit = amount(req.body.credit), debit = amount(req.body.debit);
  if ((credit > 0) === (debit > 0)) fail('Enter either a credit or a debit amount');
  res.status(201).json(await Account.create({ memberName: req.body.memberName, date: date(req.body.date), description: req.body.description,
    credit, debit, debitCredit: credit > 0 ? 'credit' : 'Debit', transactionType: req.body.transactionType }));
};
