import { fireEvent, render, screen, within, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import axios from 'axios';
import Home from './home';

jest.mock('axios', () => ({ get: jest.fn(), delete: jest.fn() }));
const data = { generated_at: '2026-11-06T10:00:00Z', summary: { customers: 12, chit_groups: 3, shares: 20, opening_pending: 200, chit_pending: 300, total_pending: 500, today_received: 50, month_received: 150 },
  top_customers: [{ _id: 'c1', name: 'Ravi', phone: '9876543210', total_pending: 500 }],
  recent_payments: [{ _id: 'receipt-1', customer_id: 'c1', customer_name: 'Ravi', amount: 50, date: '2026-11-06', source: 'customer' }] };
const show = () => render(<MemoryRouter><Home /></MemoryRouter>);
beforeEach(() => jest.clearAllMocks());

test('dashboard shows real totals, top customer actions and recent payments', async () => {
  axios.get.mockResolvedValue({ data });
  show();
  const totals = await screen.findByRole('region', { name: 'Dashboard totals' });
  ['Customers', 'Chit Groups', 'Customer Shares', 'Opening Balance Pending', 'All Shares Pending'].forEach(label => {
    expect(within(totals).queryByText(label)).not.toBeInTheDocument();
  });
  expect(within(totals).getByText('Total Pending').parentElement).toHaveTextContent('500.00');
  expect(within(totals).getByText('Received Today').parentElement).toHaveTextContent('50.00');
  expect(within(totals).getByText('Received This Month').parentElement).toHaveTextContent('150.00');
  const top = screen.getByRole('region', { name: 'Highest Pending Customers' });
  expect(within(top).getByRole('link', { name: 'Pay', exact: true })).toHaveAttribute('href', '/coustomer?customer=c1&action=pay');
  expect(within(top).getByRole('link', { name: 'Call Ravi' })).toHaveAttribute('href', 'tel:+919876543210');
  expect(within(top).getByRole('link', { name: 'WhatsApp reminder to Ravi' })).toHaveAttribute('href', expect.stringContaining('wa.me/919876543210'));
  expect(within(screen.getByRole('region', { name: 'Recent Payments' })).getByText('Customer Payment')).toBeInTheDocument();
});

test('empty dashboard shows zeros and useful empty states', async () => {
  axios.get.mockResolvedValue({ data: { ...data, summary: Object.fromEntries(Object.keys(data.summary).map(key => [key, 0])), top_customers: [], recent_payments: [] } });
  show();
  await screen.findByText('No customer has a pending balance.');
  expect(screen.getByText('No payments have been recorded yet.')).toBeInTheDocument();
});

test('failed dashboard fetch offers a working retry', async () => {
  axios.get.mockRejectedValueOnce(new Error('offline')).mockResolvedValue({ data });
  show();
  await screen.findByRole('alert');
  fireEvent.click(screen.getByRole('button', { name: 'Retry' }));
  await screen.findByRole('region', { name: 'Dashboard totals' });
  expect(screen.queryByRole('alert')).not.toBeInTheDocument();
});

const group = { chit_id: 'c1', chit_name: 'Monthly', next_date: '2026-11-21', missing_count: 2, overdue_count: 1,
  frequency: 'monthly', shares: 3, customers: 2, total_installments: 4, total_amount: 1000, amount: 100,
  installments: [
    { date: '2026-11-21', installment: 2, status: 'Today' },
    { date: '2026-12-21', chit_list: '3', due_id: 'd3', paid: 20, pending: 280, status: 'Upcoming', payment_status: 'Pending' },
    { date: '2026-09-21', installment: 1, status: 'Overdue' },
    { date: '2026-10-21', chit_list: 'Paid history', due_id: 'd1', paid: 300, pending: 0, status: 'Past', payment_status: 'Paid' }
  ] };

test('one group row opens its full installment history and correct creation/payment actions', async () => {
  axios.get.mockResolvedValue({ data: { ...data, notifications: { groups: [group], collection: [] } } });
  show();
  const region = await screen.findByRole('region', { name: 'Installments to Create' });
  expect(within(region).getAllByRole('row')).toHaveLength(2);
  fireEvent.click(within(region).getByRole('button', { name: 'View installments for Monthly' }));
  const dialog = await screen.findByRole('dialog', { name: /Monthly.*All Installments/ });
  const tables = within(dialog).getAllByRole('table');
  expect(tables).toHaveLength(2);
  expect(within(tables[0]).getAllByRole('row')[1]).toHaveTextContent('2026-11-21');
  expect(within(tables[0]).getAllByRole('row')[2]).toHaveTextContent('2026-12-21');
  expect(within(tables[0]).getByRole('link', { name: 'Create ChitMaster' })).toHaveAttribute('href', '/ChitMaster?chit=c1&date=2026-11-21&installment=2');
  expect(within(tables[0]).getByRole('link', { name: 'View / Pay' })).toHaveAttribute('href', '/ChitMaster?view=d3');
  expect(within(dialog).getByRole('heading', { name: 'Past Installments (2)' })).toBeInTheDocument();
  expect(within(tables[1]).getByText('Paid history')).toBeInTheDocument();
  expect(within(tables[1]).getByRole('cell', { name: 'Paid', exact: true })).toBeInTheDocument();
  fireEvent.click(within(dialog).getByText('Close', { exact: true }));
});

test('switching groups shows only the selected group with local pagination', async () => {
  const other = { ...group, chit_id: 'other', chit_name: 'Weekly', installments: Array.from({ length: 11 }, (_, i) => ({ date: '2026-12-01', installment: i + 1, due_id: 'weekly-' + i, chit_list: 'Week ' + (i + 1), status: 'Upcoming', payment_status: 'Paid', paid: 100, pending: 0 })) };
  axios.get.mockResolvedValue({ data: { ...data, notifications: { groups: [group, other], collection: [] } } });
  show();
  fireEvent.click(await screen.findByRole('button', { name: 'View installments for Weekly' }));
  const dialog = await screen.findByRole('dialog', { name: /Weekly.*All Installments/ });
  expect(within(dialog).queryByText('Paid history')).not.toBeInTheDocument();
  fireEvent.click(within(dialog).getByRole('button', { name: 'Group installments: next page' }));
  expect(within(dialog).getByText('Week 11')).toBeInTheDocument();
  expect(within(dialog).queryByText('Week 1')).not.toBeInTheDocument();
});


test('Home installment delete confirms, supports cancel and refreshes the open popup after success', async () => {
  const initial = { ...data, notifications: { groups: [group], collection: [] } };
  const refreshed = { ...initial, notifications: { groups: [{ ...group, installments: group.installments.filter(row => row.due_id !== 'd3') }], collection: [] } };
  axios.get.mockResolvedValue({ data: initial });
  axios.delete.mockImplementation(() => { axios.get.mockResolvedValue({ data: refreshed }); return Promise.resolve({ data: {} }); });
  show();
  fireEvent.click(await screen.findByRole('button', { name: 'View installments for Monthly' }));
  const dialog = await screen.findByRole('dialog', { name: /Monthly.*All Installments/ });
  fireEvent.click(within(dialog).getByRole('button', { name: 'Delete installment 3 dated 2026-12-21' }));
  expect(within(dialog).queryByRole('button', { name: 'Permanently Delete' })).not.toBeInTheDocument();
  fireEvent.click(within(dialog).getByRole('button', { name: 'Cancel' }));
  expect(axios.delete).not.toHaveBeenCalled();
  fireEvent.click(within(dialog).getByRole('button', { name: 'Delete installment 3 dated 2026-12-21' }));
  fireEvent.click(within(dialog).getByRole('button', { name: 'Delete', exact: true }));
  await waitFor(() => expect(axios.delete).toHaveBeenCalledWith(expect.stringMatching(/chitdue\/d3$/)));
  expect(await within(dialog).findByRole('status')).toHaveTextContent('moved to Deleted Records');
  await waitFor(() => expect(within(dialog).queryByRole('button', { name: 'Delete installment 3 dated 2026-12-21' })).not.toBeInTheDocument());
});

test('Home can permanently delete an unpaid created installment after confirmation', async () => {
  const unpaid = { ...group, installments: [{ date: '2026-12-21', chit_list: '2', due_id: 'unpaid', paid: 0, pending: 300, status: 'Upcoming' }] };
  axios.get.mockResolvedValue({ data: { ...data, notifications: { groups: [unpaid], collection: [] } } });
  axios.delete.mockResolvedValue({ data: {} });
  show();
  fireEvent.click(await screen.findByRole('button', { name: 'View installments for Monthly' }));
  const dialog = await screen.findByRole('dialog', { name: /Monthly.*All Installments/ });
  fireEvent.click(within(dialog).getByRole('button', { name: 'Delete installment 2 dated 2026-12-21' }));
  expect(axios.delete).not.toHaveBeenCalled();
  fireEvent.click(within(dialog).getByRole('button', { name: 'Permanently Delete' }));
  await waitFor(() => expect(axios.delete).toHaveBeenCalledTimes(2));
  expect(axios.delete.mock.calls.map(([url]) => url)).toEqual(['/api/chitdue/unpaid', '/api/chitdue/unpaid/permanent']);
  expect(await within(dialog).findByRole('status')).toHaveTextContent('permanently deleted');
});

test('Home delete failures stay in the popup and do not remove installment rows', async () => {
  axios.get.mockResolvedValue({ data: { ...data, notifications: { groups: [group], collection: [] } } });
  axios.delete.mockRejectedValue({ response: { data: { message: 'Unable to delete record.' } } });
  show();
  fireEvent.click(await screen.findByRole('button', { name: 'View installments for Monthly' }));
  const dialog = await screen.findByRole('dialog', { name: /Monthly.*All Installments/ });
  fireEvent.click(within(dialog).getByRole('button', { name: 'Delete installment 3 dated 2026-12-21' }));
  fireEvent.click(within(dialog).getByRole('button', { name: 'Delete', exact: true }));
  expect(await within(dialog).findByRole('alert')).toHaveTextContent('Unable to delete record');
  fireEvent.click(within(dialog).getByRole('button', { name: 'Cancel' }));
  expect(within(dialog).getByRole('button', { name: 'Delete installment 3 dated 2026-12-21' })).toBeInTheDocument();
});

test('Not Created installments can be deleted from the schedule after confirmation', async () => {
  const initial = { ...data, notifications: { groups: [group], collection: [] } };
  axios.get.mockResolvedValue({ data: initial });
  axios.delete.mockImplementation(() => {
    axios.get.mockResolvedValue({ data: { ...initial, notifications: { groups: [{ ...group, missing_count: 1, installments: group.installments.filter(row => row.date !== '2026-11-21') }], collection: [] } } });
    return Promise.resolve({ data: {} });
  });
  show();
  fireEvent.click(await screen.findByRole('button', { name: 'View installments for Monthly' }));
  const dialog = await screen.findByRole('dialog', { name: /Monthly.*All Installments/ });
  fireEvent.click(within(dialog).getByRole('button', { name: 'Delete installment 2 dated 2026-11-21' }));
  expect(axios.delete).not.toHaveBeenCalled();
  expect(within(dialog).queryByRole('button', { name: 'Permanently Delete' })).not.toBeInTheDocument();
  fireEvent.click(within(dialog).getByRole('button', { name: 'Delete', exact: true }));
  await waitFor(() => expect(axios.delete).toHaveBeenCalledWith('/api/chitadd/c1/schedule/2026-11-21'));
  expect(await within(dialog).findByRole('status')).toHaveTextContent('removed from this schedule');
  await waitFor(() => expect(within(dialog).queryByRole('button', { name: 'Delete installment 2 dated 2026-11-21' })).not.toBeInTheDocument());
});
