import { fireEvent, render, screen } from '@testing-library/react';
import CustomerReminderButtons, { reminderPhone, reminderMessage } from './CustomerReminderButtons';

const customer = { name: 'Ravi', phone: '9876543210', total_pending: 5000 };
const clipboardDescriptor = Object.getOwnPropertyDescriptor(navigator, 'clipboard');
afterEach(() => {
  jest.restoreAllMocks();
  if (clipboardDescriptor) Object.defineProperty(navigator, 'clipboard', clipboardDescriptor);
  else delete navigator.clipboard;
});

test('SMS and WhatsApp drafts use the correct recipient and current pending amount', () => {
  const { rerender } = render(<CustomerReminderButtons customer={customer} />);
  const whatsapp = new URL(screen.getByRole('link', { name: 'WhatsApp reminder to Ravi' }).href);
  expect(whatsapp.origin).toBe('https://wa.me');
  expect(whatsapp.pathname).toBe('/919876543210');
  expect(whatsapp.searchParams.get('text')).toBe(reminderMessage(5000));
  expect(decodeURIComponent(screen.getByRole('link', { name: 'SMS reminder to Ravi' }).getAttribute('href'))).toContain('sms:+919876543210?body=You have a pending amount of Rs. 5000.');
  rerender(<CustomerReminderButtons customer={{ ...customer, total_pending: 1234.50 }} />);
  expect(new URL(screen.getByRole('link', { name: 'WhatsApp reminder to Ravi' }).href).searchParams.get('text')).toContain('Rs. 1234.50');
});

test('iPhone uses its SMS body separator and explicit international numbers keep their country code', () => {
  jest.spyOn(navigator, 'userAgent', 'get').mockReturnValue('Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X)');
  render(<CustomerReminderButtons customer={{ ...customer, phone: '+44 7700 900123' }} />);
  expect(screen.getByRole('link', { name: 'SMS reminder to Ravi' })).toHaveAttribute('href', `sms:+447700900123&body=${encodeURIComponent(reminderMessage(5000))}`);
  expect(reminderPhone('0091 98765 43210')).toBe('919876543210');
  expect(reminderPhone('09876543210')).toBe('919876543210');
});

test('invalid phones and zero balances cannot open reminder drafts', () => {
  const { rerender } = render(<CustomerReminderButtons customer={{ ...customer, phone: 'invalid 123' }} />);
  expect(screen.queryByRole('link')).not.toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'SMS' })).toBeDisabled();
  rerender(<CustomerReminderButtons customer={{ ...customer, total_pending: 0 }} />);
  expect(screen.queryByRole('link')).not.toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'WhatsApp' })).toBeDisabled();
});

test('copy fallback displays selectable text when clipboard access is unavailable', async () => {
  Object.defineProperty(navigator, 'clipboard', { configurable: true, value: undefined });
  render(<CustomerReminderButtons customer={customer} />);
  fireEvent.click(screen.getByRole('button', { name: 'Copy reminder for Ravi' }));
  expect(await screen.findByRole('textbox', { name: 'Reminder text for Ravi' })).toHaveValue(reminderMessage(5000));
});
