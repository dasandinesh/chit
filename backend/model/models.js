const mongoose = require('mongoose');
const { Schema } = mongoose;
const text = { type: String, required: true, trim: true };
const money = { type: Number, required: true, min: 0 };
const allocation = new Schema({
  kind: { type: String, enum: ['opening', 'due'], required: true },
  due_id: Schema.Types.ObjectId, share_id: String, chit_name: String, chit_list: String,
  due_date: String, share_number: Number, amount: money
}, { _id: false });
const receipt = new Schema({
  reference: { type: String, required: true }, amount: money, date: text,
  source: { type: String, enum: ['customer', 'share'], required: true },
  allocations: [allocation], createdAt: { type: Date, default: Date.now }
});
const customer = new Schema({ name: text, phone: text, pending_flag: { type: Boolean, default: false },
  opening_balance: { type: Number, min: 0, default: 0 }, receipts: [receipt]
}, { timestamps: true });
const chit = new Schema({ deletedAt: { type: Date, default: null }, chit_det: { chit_name: text, Tolal_amount: money, Due_amount: money, time_preiod: { type: Number, required: true, min: 1 },
  frequency: { type: String, enum: ['none', 'weekly', 'monthly'], default: 'none' }, first_due_date: String }, skipped_dates: [String],
  member_list: [{ _id: false, share_id: String, name: text, member_id: { type: Schema.Types.ObjectId, required: true, ref: 'Customer' } }] }, { timestamps: true });
const due = new Schema({ deletedAt: { type: Date, default: null }, chit_id: { type: Schema.Types.ObjectId, required: true, ref: 'Chit' }, chit_name: text, chit_list: text, date: text, amount: money,
  member: [{ _id: false, share_id: String, name: text, member_id: { type: Schema.Types.ObjectId, required: true }, date: text, amount: money,
    paid_amount: { type: Number, default: 0, min: 0 }, pending_amount: money, paidStatus: { type: String, default: 'not paid' },
    payments: [{ amount: money, date: text, createdAt: { type: Date, default: Date.now } }] }] }, { timestamps: true });
due.index({ chit_id: 1, chit_list: 1, date: 1 }, { unique: true });
const account = new Schema({ memberName: text, date: text, description: { type: String, default: '' },
  debitCredit: { type: String, enum: ['credit', 'Debit'], required: true }, credit: money, debit: money,
  transactionType: { type: String, enum: ['personal', 'cash'], default: 'cash' } }, { timestamps: true });
module.exports = { Customer: mongoose.model('Customer', customer), Chit: mongoose.model('Chit', chit), Due: mongoose.model('Due', due), Account: mongoose.model('Account', account) };
