import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import axios from 'axios';
import Coustomer from './coustomer';

jest.mock('axios', () => ({ get: jest.fn(), post: jest.fn(), patch: jest.fn() }));
jest.mock('./PaymentHistory', () => {
  const actual = jest.requireActual('./PaymentHistory');
  return { __esModule: true, ...actual, paymentReference: () => 'customer-test-reference' };
});
const customer = { _id: 'customer-1', name: 'Ravi', phone: '9999999999', opening_balance: 200,
  opening_paid: 0, opening_pending: 200, chit_pending: 200, total_pending: 400, total_shares: 2 };
const detail = { ...customer, receipts: [], shares: [
  { due_id: 'due-1', share_id: 'share-1', share_number: 1, chit_name: 'Group A', chit_list: '1', date: '2026-10-01', paid_amount: 0, pending_amount: 100 },
  { due_id: 'due-1', share_id: 'share-2', share_number: 2, chit_name: 'Group A', chit_list: '1', date: '2026-10-01', paid_amount: 0, pending_amount: 100 }
] };
beforeEach(() => {
  jest.clearAllMocks();
  axios.get.mockImplementation(url => Promise.resolve({ data: url.endsWith('/balance') ? detail : [customer] }));
});

test('customer creation includes the opening balance', async () => {
  axios.post.mockResolvedValue({ data: {} });
  render(<Coustomer />);
  fireEvent.click(screen.getByRole('button', { name: 'Add Customer' }));
  const dialog = await screen.findByRole('dialog', { name: 'Add Customer' });
  fireEvent.change(within(dialog).getByLabelText('Name'), { target: { value: 'New customer' } });
  fireEvent.change(within(dialog).getByLabelText('Phone'), { target: { value: '1234567890' } });
  fireEvent.change(within(dialog).getByLabelText('Opening Balance'), { target: { value: '250' } });
  fireEvent.click(within(dialog).getByRole('button', { name: 'Add' }));
  await waitFor(() => expect(axios.post).toHaveBeenCalledWith(expect.stringMatching(/customeradd$/), expect.objectContaining({ opening_balance: '250', name: 'New customer' })));
  await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
});

test('Dashboard Pay link opens the correct customer payment popup', async () => {
  const original = window.location.pathname + window.location.search;
  window.history.replaceState({}, '', '/coustomer?customer=customer-1&action=pay');
  try {
    render(<Coustomer />);
    const dialog = await screen.findByRole('dialog', { name: /Receive Payment.*Ravi/ });
    expect(await within(dialog).findByLabelText('Amount Received')).toBeInTheDocument();
    expect(axios.get).toHaveBeenCalledWith(expect.stringMatching(/customer\/customer-1\/balance$/));
    fireEvent.click(within(dialog).getByRole('button', { name: 'Cancel' }));
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
  } finally { window.history.replaceState({}, '', original); }
});

test('customer Pay previews opening-first allocation and sends one receipt request', async () => {
  axios.post.mockResolvedValue({ data: { receipt: { _id: 'receipt-1', amount: 250, date: '2026-11-06', allocations: [
    { kind: 'opening', amount: 200 }, { kind: 'due', amount: 50, chit_name: 'Group A', chit_list: '1', share_number: 1, due_date: '2026-10-01' }
  ] } } });
  render(<Coustomer />);
  fireEvent.click(await screen.findByRole('button', { name: 'Pay' }));
  const dialog = await screen.findByRole('dialog', { name: /Receive Payment/ });
  const input = await within(dialog).findByLabelText('Amount Received');
  fireEvent.change(input, { target: { value: '250' } });
  fireEvent.change(within(dialog).getByLabelText('Payment Date'), { target: { value: '2026-11-06' } });
  expect(within(dialog).getByText('Allocation Preview')).toBeInTheDocument();
  expect(within(dialog).getByText('Opening Balance')).toBeInTheDocument();
  expect(within(dialog).getByText('Group A / 1 / Share 1 (2026-10-01)')).toBeInTheDocument();
  fireEvent.click(within(dialog).getByRole('button', { name: 'Record Payment' }));
  await waitFor(() => expect(axios.post).toHaveBeenCalledWith(expect.stringMatching(/customer\/customer-1\/pay$/), { amount: '250', date: '2026-11-06', reference: 'customer-test-reference' }));
  await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
  expect(screen.getByText(/Payment recorded/)).toBeInTheDocument();
});

test('name, actual pending status and strict amount limits work together and can be cleared', async () => {
  const customers = [customer,
    { ...customer, _id: 'customer-2', name: 'Mala', total_pending: 0, pending_flag: true },
    { ...customer, _id: 'customer-3', name: 'RAVI Kumar', total_pending: 100, pending_flag: false },
    { ...customer, _id: 'customer-4', name: 'Kumar', total_pending: 1000 }
  ];
  axios.get.mockResolvedValue({ data: customers });
  render(<Coustomer />);
  await screen.findByText('Ravi');
  expect(screen.queryByText('Mala')).not.toBeInTheDocument();
  fireEvent.change(screen.getByLabelText('Pending Status'), { target: { value: 'all' } });
  expect(screen.getByText('Mala')).toBeInTheDocument();
  fireEvent.change(screen.getByLabelText('Customer Name'), { target: { value: '  ravi ' } });
  fireEvent.change(screen.getByLabelText('Pending Status'), { target: { value: 'pending' } });
  fireEvent.change(screen.getByLabelText('Pending More Than'), { target: { value: '100' } });
  fireEvent.change(screen.getByLabelText('Pending Less Than'), { target: { value: '500' } });
  expect(screen.getByText('Ravi')).toBeInTheDocument();
  expect(screen.queryByText('RAVI Kumar')).not.toBeInTheDocument();
  expect(screen.queryByText('Mala')).not.toBeInTheDocument();
  fireEvent.change(screen.getByLabelText('Pending Less Than'), { target: { value: '400' } });
  expect(screen.getByText('No customers match these filters.')).toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: 'Clear Filters' }));
  expect(screen.queryByText('Mala')).not.toBeInTheDocument();
  expect(screen.getByLabelText('Pending Status')).toHaveValue('pending');
  expect(screen.getByLabelText('Customer Name')).toHaveValue('');
  expect(screen.getByLabelText('Pending More Than')).toHaveValue(null);
  fireEvent.change(screen.getByLabelText('Pending Status'), { target: { value: 'notPending' } });
  expect(screen.getByText('Mala')).toBeInTheDocument();
  expect(screen.queryByText('Ravi')).not.toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'Pay' })).toBeDisabled();
});

test('filtering a later page returns to the first matching page', async () => {
  axios.get.mockResolvedValue({ data: Array.from({ length: 25 }, (_, i) => ({ ...customer, _id: `customer-${i}`, name: `Customer ${i}` })) });
  render(<Coustomer />);
  await screen.findByText('Customer 0');
  fireEvent.click(screen.getByRole('button', { name: 'Customers: next page' }));
  expect(screen.getByText('Customer 10')).toBeInTheDocument();
  fireEvent.change(screen.getByLabelText('Customer Name'), { target: { value: 'Customer 20' } });
  expect(screen.getByText('Customer 20')).toBeInTheDocument();
  expect(screen.getByText('Page 1 of 1')).toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: 'Clear Filters' }));
  expect(screen.getByText('Customer 0')).toBeInTheDocument();
});

test('a settled customer disappears from the Pending filter after payment refresh', async () => {
  axios.get.mockImplementation(url => Promise.resolve({ data: url.endsWith('/balance') ? detail : [customer] }));
  axios.post.mockImplementation(() => {
    axios.get.mockResolvedValue({ data: [{ ...customer, total_pending: 0, opening_pending: 0, chit_pending: 0 }] });
    return Promise.resolve({ data: { receipt: { _id: 'receipt-settled', amount: 400, date: '2026-11-06', allocations: [{ kind: 'opening', amount: 200 }] } } });
  });
  render(<Coustomer />);
  await screen.findByText('Ravi');
  fireEvent.change(screen.getByLabelText('Pending Status'), { target: { value: 'pending' } });
  fireEvent.click(screen.getByRole('button', { name: 'Pay' }));
  const dialog = await screen.findByRole('dialog', { name: /Receive Payment/ });
  fireEvent.change(await within(dialog).findByLabelText('Amount Received'), { target: { value: '400' } });
  fireEvent.click(within(dialog).getByRole('button', { name: 'Record Payment' }));
  await screen.findByText('No customers match these filters.');
  await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
  expect(screen.getByLabelText('Pending Status')).toHaveValue('pending');
});
