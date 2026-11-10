const iso = date => date.toISOString().slice(0, 10);
function scheduledDate(first, frequency, index) {
  const date = new Date(`${first}T00:00:00Z`);
  if (frequency === 'weekly') date.setUTCDate(date.getUTCDate() + index * 7);
  else {
    const day = date.getUTCDate();
    date.setUTCDate(1);
    date.setUTCMonth(date.getUTCMonth() + index);
    const last = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + 1, 0)).getUTCDate();
    date.setUTCDate(Math.min(day, last));
  }
  return iso(date);
}
module.exports = function notifications(chits, effectiveDues, today) {
  const tomorrowDate = new Date(`${today}T00:00:00Z`);
  tomorrowDate.setUTCDate(tomorrowDate.getUTCDate() + 1);
  const tomorrow = iso(tomorrowDate);
  const status = date => date < today ? 'Overdue' : date === today ? 'Today' : date === tomorrow ? 'Tomorrow' : 'Upcoming';
  const creation = [];
  const existing = new Set(effectiveDues.map(d => `${d.chit_id}|${d.date}`));
  for (const chit of chits) {
    const det = chit.chit_det || {};
    if (!['weekly', 'monthly'].includes(det.frequency) || !/^\d{4}-\d{2}-\d{2}$/.test(det.first_due_date || '')) continue;
    const count = Math.min(1200, Math.max(0, Number(det.time_preiod) || 0));
    const skipped = new Set(chit.skipped_dates || []);
    for (let i = 0; i < count; i++) {
      const date = scheduledDate(det.first_due_date, det.frequency, i);
      if (skipped.has(date)) continue;
      if (!existing.has(`${chit._id}|${date}`)) creation.push({ chit_id: chit._id, chit_name: det.chit_name, date, installment: i + 1, amount: det.Due_amount, status: status(date) });
    }
  }
  const collection = effectiveDues.filter(d => d.date).map(d => ({
    due_id: d._id, chit_name: d.chit_name, chit_list: d.chit_list, date: d.date, status: status(d.date),
    pending: d.member.reduce((total, m) => total + Math.round(Number(m.pending_amount || 0) * 100), 0) / 100,
    customers: new Set(d.member.filter(m => m.pending_amount > 0).map(m => String(m.member_id))).size
  })).filter(d => d.pending > 0);
  const sort = (a, b) => Number(a.date < today) - Number(b.date < today) || a.date.localeCompare(b.date) || String(a.chit_name).localeCompare(String(b.chit_name));
  const groups = chits.map(chit => {
    const det = chit.chit_det || {};
    const missing = creation.filter(row => String(row.chit_id) === String(chit._id)).sort(sort);
    const records = effectiveDues.filter(due => chit._id != null && due.date && String(due.chit_id) === String(chit._id)).map(due => {
      const pending = due.member.reduce((total, member) => total + Math.round(Number(member.pending_amount || 0) * 100), 0) / 100;
      const paid = due.member.reduce((total, member) => total + Math.round(Number(member.paid_amount || 0) * 100), 0) / 100;
      return { due_id: due._id, chit_name: det.chit_name, chit_list: due.chit_list, date: due.date, amount: due.amount,
        pending, paid, status: due.date < today && pending === 0 ? 'Past' : status(due.date), payment_status: pending > 0 ? 'Pending' : 'Paid' };
    });
    return { chit_id: chit._id, chit_name: det.chit_name, frequency: det.frequency || 'none',
      total_amount: det.Tolal_amount, amount: det.Due_amount, total_installments: det.time_preiod,
      shares: (chit.member_list || []).length, customers: new Set((chit.member_list || []).map(m => String(m.member_id))).size,
      missing_count: missing.length, overdue_count: missing.filter(row => row.date < today).length,
      next_date: missing.find(row => row.date >= today)?.date || null,
      installments: [...missing, ...records].sort(sort) };
  }).sort((a, b) => (a.next_date || '9999').localeCompare(b.next_date || '9999') || String(a.chit_name).localeCompare(String(b.chit_name)));
  return { creation: creation.sort(sort), collection: collection.sort(sort), groups };
};
module.exports.scheduledDate = scheduledDate;
