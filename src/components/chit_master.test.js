import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import axios from 'axios';
import ChitMaster from './chit_master';

jest.mock('axios', () => ({ get: jest.fn(), post: jest.fn(), put: jest.fn(), delete: jest.fn() }));
jest.mock('./PaymentHistory', () => ({ __esModule: true, ...jest.requireActual('./PaymentHistory'), paymentReference: () => 'master-test-payment-reference' }));
const records = Array.from({ length: 11 }, (_, i) => ({
  _id: `due-${i}`, chit_id: 'group-1', chit_name: `Group ${i}`, chit_list: `List ${i}`, date: '2026-11-06', amount: 100, deletedAt: null,
  member: [{ member_id: 'customer-1', name: 'Ravi', share_id: `share-${i}`, share_number: 1, amount: 100, paid_amount: 20, pending_amount: 80, paidStatus: 'not paid', payments: [{ _id: 'payment-1', amount: 20, date: '2026-11-06', source: 'customer', receipt_id: 'receipt-1' }] }]
}));
beforeEach(() => {
  jest.clearAllMocks();
  axios.get.mockImplementation(url => Promise.resolve({ data: url.includes('?include_deleted') ? records : url.endsWith('/chit') ? [] : records.find(record => url.endsWith(`/${record._id}`)) }));
});

test('View opens full details and payment history in a popup', async () => {
  render(<ChitMaster />);
  await screen.findByText('Group 0');
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  fireEvent.click(screen.getAllByRole('button', { name: 'View' })[0]);
  const dialog = await screen.findByRole('dialog', { name: 'Chit Master Details' });
  expect(await within(dialog).findByText('Ravi')).toBeInTheDocument();
  expect(within(dialog).getByText('All Customer Shares')).toBeInTheDocument();
  fireEvent.click(within(dialog).getByText('1 entries'));
  expect(within(dialog).getByText('Customer Payment')).toBeInTheDocument();
  fireEvent.click(within(dialog).getByText('Close', { exact: true }));
  await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
});

test('Edit on page two saves the selected record ID', async () => {
  axios.put.mockResolvedValue({ data: {} });
  render(<ChitMaster />);
  await screen.findByText('Group 0');
  fireEvent.click(screen.getByRole('button', { name: 'Chit Master: next page' }));
  fireEvent.click(screen.getByRole('button', { name: 'Edit', exact: true }));
  const dialog = await screen.findByRole('dialog', { name: 'Edit Chit Master' });
  const list = await within(dialog).findByLabelText('List / Installment');
  fireEvent.change(list, { target: { value: 'Revised list' } });
  fireEvent.change(within(dialog).getByLabelText('Amount per Share'), { target: { value: '150' } });
  fireEvent.click(within(dialog).getByRole('button', { name: 'Save Changes' }));
  await waitFor(() => expect(axios.put).toHaveBeenCalledWith(expect.stringMatching(/chitdue\/due-10$/), { date: '2026-11-06', chit_list: 'Revised list', amount: '150' }));
  await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
});

test('a share payment can be recorded from the details popup', async () => {
  axios.post.mockResolvedValue({ data: { ...records[0], member: [{ ...records[0].member[0], paid_amount: 50, pending_amount: 50 }] } });
  render(<ChitMaster />);
  await screen.findByText('Group 0');
  fireEvent.click(screen.getAllByRole('button', { name: 'View' })[0]);
  const dialog = await screen.findByRole('dialog', { name: 'Chit Master Details' });
  fireEvent.change(await within(dialog).findByLabelText('Payment for Ravi share 1'), { target: { value: '30' } });
  fireEvent.change(within(dialog).getByLabelText('Payment Date'), { target: { value: '2026-11-06' } });
  fireEvent.click(within(dialog).getByRole('button', { name: 'Pay', exact: true }));
  await waitFor(() => expect(axios.post).toHaveBeenCalledWith(expect.stringMatching(/chitdueamountupdate$/), {
    id: 'due-0', memberId: 'customer-1', share_id: 'share-0', current_paid_amount: '30', date: '2026-11-06', reference: 'master-test-payment-reference'
  }));
  await waitFor(() => expect(within(dialog).getByLabelText('Payment for Ravi share 1')).toHaveValue(null));
});

test('Delete requires confirmation and deleted records can be restored', async () => {
  axios.delete.mockResolvedValue({ data: {} });
  axios.post.mockResolvedValue({ data: {} });
  render(<ChitMaster />);
  await screen.findByText('Group 0');
  fireEvent.click(screen.getAllByRole('button', { name: 'Delete', exact: true })[0]);
  let dialog = await screen.findByRole('dialog', { name: 'Delete Chit Master Record' });
  await within(dialog).findByText(/This moves the entire installment/);
  expect(axios.delete).not.toHaveBeenCalled();
  fireEvent.click(within(dialog).getByRole('button', { name: 'Cancel' }));
  await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
  expect(axios.delete).not.toHaveBeenCalled();
  fireEvent.click(screen.getAllByRole('button', { name: 'Delete', exact: true })[0]);
  dialog = await screen.findByRole('dialog', { name: 'Delete Chit Master Record' });
  await within(dialog).findByText(/This moves the entire installment/);
  axios.get.mockImplementation(url => Promise.resolve({ data: url.includes('?include_deleted') ? [{ ...records[0], deletedAt: '2026-11-06' }, ...records.slice(1)] : url.endsWith('/chit') ? [] : { ...records[0], deletedAt: '2026-11-06' } }));
  fireEvent.click(within(dialog).getByRole('button', { name: 'Delete Record' }));
  await waitFor(() => expect(axios.delete).toHaveBeenCalledWith(expect.stringMatching(/chitdue\/due-0$/)));
  await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
  fireEvent.change(screen.getByLabelText('Show'), { target: { value: 'deleted' } });
  fireEvent.click(await screen.findByRole('button', { name: 'View', exact: true }));
  dialog = await screen.findByRole('dialog', { name: 'Chit Master Details' });
  fireEvent.click(await within(dialog).findByRole('button', { name: 'Restore Record' }));
  await waitFor(() => expect(axios.post).toHaveBeenCalledWith(expect.stringMatching(/chitdue\/due-0\/restore$/)));
  await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
});

test('dashboard creation link prefills the scheduled group, date, number and amount', async () => {
  window.history.replaceState({}, '', '/ChitMaster?chit=group-1&date=2026-11-07&installment=2');
  axios.get.mockImplementation(url => Promise.resolve({ data: url.endsWith('/chit') ? [{ _id: 'group-1', chit_det: { chit_name: 'Scheduled', Due_amount: 125 } }] : [] }));
  render(<ChitMaster />);
  await waitFor(() => expect(screen.getByLabelText('Chit Group')).toHaveValue('group-1'));
  expect(screen.getByLabelText('Due Date')).toHaveValue('2026-11-07');
  expect(screen.getByLabelText('List / Installment')).toHaveValue('2');
  expect(screen.getByLabelText('Amount per Share')).toHaveValue(125);
  window.history.replaceState({}, '', '/');
});

test('permanent deletion requires confirmation and targets the selected deleted installment', async () => {
  const archived = { ...records[0], deletedAt: '2026-11-06T00:00:00Z', member: [{ ...records[0].member[0], paid_amount: 0, payments: [] }] };
  axios.get.mockImplementation(url => Promise.resolve({ data: url.includes('?include_deleted') ? [archived] : url.endsWith('/chit') || url.endsWith('/customer') ? [] : archived }));
  axios.delete.mockResolvedValue({ data: {} });
  render(<ChitMaster />);
  await screen.findByLabelText('Show');
  fireEvent.change(screen.getByLabelText('Show'), { target: { value: 'deleted' } });
  fireEvent.click(await screen.findByRole('button', { name: 'View', exact: true }));
  let dialog = await screen.findByRole('dialog', { name: 'Chit Master Details' });
  fireEvent.click(await within(dialog).findByRole('button', { name: 'Permanently Delete' }));
  dialog = await screen.findByRole('dialog', { name: 'Permanently Delete Installment' });
  expect(axios.delete).not.toHaveBeenCalled();
  fireEvent.click(within(dialog).getByRole('button', { name: 'Permanently Delete' }));
  await waitFor(() => expect(axios.delete).toHaveBeenCalledWith(expect.stringMatching(/chitdue\/due-0\/permanent$/)));
  await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
});
