import { reminderPhone } from '../components/CustomerReminderButtons';
export const MAX_CONTACTS = 10000;

// Google CSV uses quoted fields, escaped quotes and occasionally embedded newlines.
export function parseContactCsv(text) {
  const source = String(text).replace(/^\uFEFF/, '');
  const headerLine = source.split(/\r?\n/, 1)[0];
  const delimiter = headerLine.includes(';') && !headerLine.includes(',') ? ';' : ',';
  const rows = [];
  let row = [], field = '', quoted = false, closed = false;
  const finish = () => { row.push(field); field = ''; closed = false; };
  for (let i = 0; i < source.length; i++) {
    const c = source[i];
    if (quoted) {
      if (c === '"') {
        if (source[i + 1] === '"') { field += '"'; i++; }
        else { quoted = false; closed = true; }
      } else field += c;
    } else if (c === '"' && !field && !closed) quoted = true;
    else if (c === delimiter) finish();
    else if (c === '\n' || c === '\r') {
      if (c === '\r' && source[i + 1] === '\n') i++;
      finish(); if (row.some(value => value.trim())) rows.push(row); row = [];
      if (rows.length > MAX_CONTACTS + 1) throw new Error('Import up to 10,000 contacts per CSV. Export a smaller selection.');
    } else if (closed && c.trim()) throw new Error('Invalid CSV quoting. Export the file as Google CSV again.');
    else if (!closed) field += c;
  }
  if (quoted) throw new Error('The CSV contains an unfinished quoted field.');
  finish(); if (row.some(value => value.trim())) rows.push(row);
  if (rows.length < 2) throw new Error('The CSV has no contacts.');
  if (rows.length > MAX_CONTACTS + 1) throw new Error('Import up to 10,000 contacts per CSV.');
  const normalizeHeader = value => value.replace(/\uFEFF/g, '').trim().toLowerCase().replace(/[_\s]+/g, ' ');
  const headers = rows.shift().map(normalizeHeader);
  const column = name => headers.indexOf(name);
  const phoneColumns = headers.map((name, index) => /^(phone\s*\d*\s*-\s*value|phone|mobile|mobile phone)$/.test(name) ? index : -1).filter(i => i >= 0);
  const nameHeaders = ['name', 'full name', 'fullname', 'display name', 'displayname', 'contact name', 'first name', 'given name', 'last name', 'family name', 'nickname', 'organization name', 'organization 1 - name', 'company'];
  if (!phoneColumns.length || !nameHeaders.some(name => column(name) >= 0)) throw new Error('Use Google CSV with Name / First Name and Phone 1 - Value columns.');
  return rows.map((values, index) => {
    const get = name => (values[column(name)] || '').trim();
    const name = get('name') || get('full name') || get('fullname') || get('display name') || get('displayname') || get('contact name') ||
      [get('first name') || get('given name'), get('middle name') || get('additional name'), get('last name') || get('family name')].filter(Boolean).join(' ') ||
      get('nickname') || get('organization name') || get('organization 1 - name') || get('company');
    const phones = phoneColumns.flatMap(i => (values[i] || '').split(/\s*:::\s*/)).map(phone => phone.trim()).filter(Boolean);
    return { id: index, name, phone: phones.find(phone => reminderPhone(phone)) || phones[0] || '', opening_balance: '0' };
  });
}

export function reviewContacts(rows, customers) {
  const existing = new Set(customers.map(customer => reminderPhone(customer.phone)).filter(Boolean));
  const seen = new Set();
  return rows.map(row => {
    const phone = reminderPhone(row.phone);
    let issue = !row.name.trim() ? 'Name required' : row.name.trim().length > 150 ? 'Name is too long' : !phone ? 'Invalid / missing phone' : '';
    if (!issue && (row.opening_balance === '' || !Number.isFinite(Number(row.opening_balance)) || Number(row.opening_balance) < 0 || !/^\d+(\.\d{1,2})?$/.test(String(row.opening_balance)))) issue = 'Invalid opening balance';
    if (!issue && existing.has(phone)) issue = 'Already a customer';
    if (!issue && seen.has(phone)) issue = 'Duplicate in CSV';
    if (!issue) seen.add(phone);
    return { ...row, normalizedPhone: phone, issue };
  });
}
