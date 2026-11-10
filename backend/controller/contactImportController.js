const { Customer } = require('../model/models');
const phoneKey = require('../utils/contactPhone');
const exclusive = require('../utils/paymentQueue');

exports.importContacts = (req, res) => exclusive(async () => {
  const contacts = req.body.contacts;
  if (!Array.isArray(contacts) || !contacts.length || contacts.length > 200) {
    return res.status(400).json({ message: 'Select between 1 and 200 contacts.' });
  }
  const existing = new Set((await Customer.find().select('phone').lean()).map(c => phoneKey(c.phone)).filter(Boolean));
  const results = [];
  for (let index = 0; index < contacts.length; index++) {
    const contact = contacts[index] || {};
    const name = typeof contact.name === 'string' ? contact.name.trim() : '';
    const phone = phoneKey(contact.phone);
    const opening = contact.opening_balance ?? 0;
    if (!name || name.length > 150 || !phone || !/^\d+(\.\d{1,2})?$/.test(String(opening)) || !Number.isFinite(Number(opening))) {
      results.push({ index, status: 'invalid', message: 'Check name, phone and opening balance.' }); continue;
    }
    if (existing.has(phone)) { results.push({ index, status: 'duplicate', message: 'Phone already exists.' }); continue; }
    try {
      const customer = await Customer.create({ name, phone: `+${phone}`, opening_balance: Number(opening), pending_flag: false });
      existing.add(phone);
      results.push({ index, status: 'imported', _id: customer._id });
    } catch {
      // Preserve individual results so a partially successful batch can be retried.
      results.push({ index, status: 'failed', message: 'Unable to save this contact. Retry.' });
    }
  }
  res.json({ results, imported: results.filter(r => r.status === 'imported').length,
    duplicates: results.filter(r => r.status === 'duplicate').length, failed: results.filter(r => ['invalid', 'failed'].includes(r.status)).length });
});
