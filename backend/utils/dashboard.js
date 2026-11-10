const ledger = require('./paymentLedger');
const notifications = require('./notifications');
const cents = value => Math.round(Number(value || 0) * 100);

function indiaDate(now) {
  const parts = Object.fromEntries(new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata', year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(now).map(part => [part.type, part.value]));
  return `${parts.year}-${parts.month}-${parts.day}`;
}

module.exports = function dashboard({ customers, chits, dues }, now = new Date()) {
  const today = indiaDate(now), month = today.slice(0, 7);
  const effective = dues.filter(due => !due.deletedAt).map(due => ledger.applyLedger(due, customers));
  const balances = customers.map(customer => {
    const { shares, ...balance } = ledger.summary(customer, effective, chits);
    return balance;
  });
  // One customer receipt is one collection, even when split over many shares.
  const payments = customers.flatMap(customer => (customer.receipts || []).map(receipt => ({
    _id: String(receipt._id), customer_id: customer._id, customer_name: customer.name,
    amount: receipt.amount, date: receipt.date, source: receipt.source,
    recorded_at: receipt.createdAt, allocation_count: receipt.allocations.length
  })));
  // Include old, explicitly recorded payments without counting new ledger allocations again.
  for (const due of dues) due.member.forEach((member, index) => (member.payments || []).forEach((payment, paymentIndex) => {
    payments.push({ _id: String(payment._id || `legacy-${due._id}-${index}-${paymentIndex}`), customer_id: member.member_id,
      customer_name: customers.find(c => String(c._id) === String(member.member_id))?.name || member.name,
      amount: payment.amount, date: payment.date, source: 'legacy', recorded_at: payment.createdAt, allocation_count: 1 });
  }));
  const sum = (rows, key) => rows.reduce((total, row) => total + cents(row[key]), 0) / 100;
  const recent = [...payments].sort((a, b) => {
    const first = new Date(a.recorded_at || `${a.date}T00:00:00Z`).getTime() || 0;
    const second = new Date(b.recorded_at || `${b.date}T00:00:00Z`).getTime() || 0;
    return second - first || String(b._id).localeCompare(String(a._id));
  }).slice(0, 5);
  return {
    generated_at: now.toISOString(), today, time_zone: 'Asia/Kolkata',
    notifications: notifications(chits, effective, today),
    summary: { customers: customers.length, chit_groups: chits.length, shares: chits.reduce((total, chit) => total + chit.member_list.length, 0),
      opening_pending: sum(balances, 'opening_pending'), chit_pending: sum(balances, 'chit_pending'), total_pending: sum(balances, 'total_pending'),
      today_received: sum(payments.filter(payment => payment.date === today), 'amount'),
      month_received: sum(payments.filter(payment => payment.date?.startsWith(month) && payment.date <= today), 'amount') },
    top_customers: balances.filter(customer => customer.total_pending > 0).sort((a, b) => b.total_pending - a.total_pending || a.name.localeCompare(b.name) || String(a._id).localeCompare(String(b._id))).slice(0, 5),
    recent_payments: recent
  };
};
