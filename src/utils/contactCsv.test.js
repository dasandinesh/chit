import { parseContactCsv, reviewContacts } from './contactCsv';

test('parses Google CSV BOM, quoted commas, quotes, newlines and multiple phones', () => {
  const rows = parseContactCsv('\uFEFFName,Phone 1 - Value,Phone 2 - Value,Notes\r\n"Ravi, ""K""",bad,9876543210,"line 1\nline 2"\r\nTamil,+919999999999 ::: 8888888888,,');
  expect(rows[0]).toMatchObject({ name: 'Ravi, "K"', phone: '9876543210', opening_balance: '0' });
  expect(rows[1].phone).toBe('+919999999999');
});

test('new Google first/middle/last name fields and semicolon exports work', () => {
  expect(parseContactCsv('First Name;Middle Name;Last Name;Phone 1 - Value\nRavi;K;S;9876543210')[0].name).toBe('Ravi K S');
  expect(() => parseContactCsv('Name,Email\nRavi,a@example.com')).toThrow(/Google CSV/);
  expect(() => parseContactCsv('Name,Phone\n"unfinished,123')).toThrow(/unfinished/);
  expect(() => parseContactCsv('Name,Phone\n' + 'A,9876543210\n'.repeat(10001))).toThrow(/10,000/);
  expect(parseContactCsv('Name,Phone\n' + 'A,9876543210\n'.repeat(2501))).toHaveLength(2501);
});

test('phone normalization catches existing and CSV duplicates and invalid balances', () => {
  const rows = parseContactCsv('Name,Phone\nExisting,09876543210\nNew,8888888888\nAgain,+918888888888\nNo phone,\n,7777777777');
  const reviewed = reviewContacts(rows, [{ phone: '+91 98765 43210' }]);
  expect(reviewed.map(row => row.issue)).toEqual(['Already a customer', '', 'Duplicate in CSV', 'Invalid / missing phone', 'Name required']);
  expect(reviewContacts([{ ...rows[1], opening_balance: '-1' }], [])[0].issue).toBe('Invalid opening balance');
});

test('reads full/display names, last-name-only contacts and business names', () => {
  expect(parseContactCsv('Full Name,Phone\nRavi Kumar,9876543210')[0].name).toBe('Ravi Kumar');
  expect(parseContactCsv('Name,Display Name,Phone\n,Ravi,9876543210')[0].name).toBe('Ravi');
  expect(parseContactCsv('Last Name,Phone 1 - Value\nKumar,9876543210')[0].name).toBe('Kumar');
  expect(parseContactCsv('First_Name,Last_Name,Phone\nRavi,Kumar,9876543210')[0].name).toBe('Ravi Kumar');
  expect(parseContactCsv('Name,Organization 1 - Name,Phone\n,Shop,9876543210')[0].name).toBe('Shop');
  expect(parseContactCsv('Name,Phone\n,9876543210')[0].name).toBe('');
});
