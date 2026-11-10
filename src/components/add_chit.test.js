import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import axios from 'axios';
import AddChit from './add_chit';

jest.mock('axios', () => ({ get: jest.fn(), put: jest.fn(), post: jest.fn(), delete: jest.fn() }));

beforeEach(() => jest.clearAllMocks());

test('Add Chit opens a dialog, Cancel clears it and saving closes it', async () => {
  axios.get.mockResolvedValue({ data: [] });
  axios.post.mockResolvedValue({ data: {} });
  render(<AddChit />);
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: '+ Add Chit' }));
  expect(await screen.findByRole('dialog', { name: 'Add Chit' })).toBeInTheDocument();
  fireEvent.change(screen.getByLabelText('Chit Name:'), { target: { value: 'Unsaved group' } });
  fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
  await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
  expect(axios.post).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole('button', { name: '+ Add Chit' }));
  expect(await screen.findByLabelText('Chit Name:')).toHaveValue('');
  fireEvent.change(screen.getByLabelText('Chit Name:'), { target: { value: 'New group' } });
  fireEvent.click(screen.getByRole('button', { name: 'Submit' }));
  await waitFor(() => expect(axios.post).toHaveBeenCalled());
  await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
});

test('editing a group on page two and removing a share on page two preserves other shares', async () => {
  const groups = Array.from({ length: 11 }, (_, i) => ({
    _id: `group-${i}`,
    chit_det: { chit_name: `Group ${i}`, Tolal_amount: 1000, Due_amount: 100, time_preiod: 10 },
    member_list: Array.from({ length: 12 }, (_, share) => ({ name: 'Customer', member_id: 'customer-id', share_id: `share-${share}` }))
  }));
  axios.get.mockImplementation(url => Promise.resolve({ data: url.endsWith('/customer') ? [{ _id: 'customer-id', name: 'Customer' }] : groups }));
  axios.put.mockResolvedValue({ data: {} });
  render(<AddChit />);
  await screen.findByText('Group 0');
  fireEvent.click(screen.getByRole('button', { name: 'Chit groups: next page' }));
  fireEvent.click(screen.getByRole('button', { name: 'Edit' }));
  await waitFor(() => expect(screen.getByPlaceholderText('Chit Name')).toHaveValue('Group 10'));
  fireEvent.click(screen.getByRole('button', { name: 'Member entry rows: next page' }));
  expect(screen.getAllByRole('button', { name: 'Remove' })).toHaveLength(2);
  fireEvent.click(screen.getAllByRole('button', { name: 'Remove' })[0]);
  fireEvent.click(screen.getByRole('button', { name: 'Submit' }));
  await waitFor(() => expect(axios.put).toHaveBeenCalled());
  const [url, payload] = axios.put.mock.calls[0];
  expect(url).toMatch(/\/chitadd\/group-10$/);
  expect(payload.member_list).toHaveLength(11);
  expect(payload.member_list.map(m => m.share_id)).toEqual(['share-0', 'share-1', 'share-2', 'share-3', 'share-4', 'share-5', 'share-6', 'share-7', 'share-8', 'share-9', 'share-11']);
});

test('Delete confirms the selected group on page two, cancel does nothing, and success removes the row', async () => {
  const groups = Array.from({ length: 11 }, (_, i) => ({ _id: `g-${i}`, chit_det: { chit_name: `Group ${i}`, Tolal_amount: 1000, Due_amount: 100, time_preiod: 10 }, member_list: [] }));
  axios.get.mockResolvedValue({ data: groups });
  axios.delete.mockResolvedValue({ data: {} });
  render(<AddChit />);
  await screen.findByText('Group 0');
  fireEvent.click(screen.getByRole('button', { name: 'Chit groups: next page' }));
  fireEvent.click(screen.getByRole('button', { name: 'Delete', exact: true }));
  let dialog = await screen.findByRole('dialog', { name: 'Delete Chit Group' });
  expect(within(dialog).getByText('Group 10')).toBeInTheDocument();
  fireEvent.click(within(dialog).getByRole('button', { name: 'Cancel' }));
  await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
  expect(axios.delete).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole('button', { name: 'Delete', exact: true }));
  dialog = await screen.findByRole('dialog', { name: 'Delete Chit Group' });
  fireEvent.click(within(dialog).getByRole('button', { name: 'Delete Group' }));
  await waitFor(() => expect(axios.delete).toHaveBeenCalledWith(expect.stringMatching(/chitadd\/g-10$/)));
  await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
  expect(screen.queryByText('Group 10')).not.toBeInTheDocument();
  expect(screen.getByRole('status')).toHaveTextContent('Chit group deleted');
  expect(screen.getByText('Group 0')).toBeInTheDocument();
});

test('a group with installment history reports the backend restriction without removing it', async () => {
  axios.get.mockResolvedValue({ data: [{ _id: 'g1', chit_det: { chit_name: 'Existing', Tolal_amount: 100, Due_amount: 10, time_preiod: 10 }, member_list: [] }] });
  axios.delete.mockRejectedValue({ response: { data: { message: 'This group has Chit Master records.' } } });
  render(<AddChit />);
  fireEvent.click(await screen.findByRole('button', { name: 'Delete', exact: true }));
  const dialog = await screen.findByRole('dialog', { name: 'Delete Chit Group' });
  fireEvent.click(within(dialog).getByRole('button', { name: 'Delete Group' }));
  expect(await within(dialog).findByRole('alert')).toHaveTextContent('Chit Master records');
  expect(screen.getAllByText('Existing')).toHaveLength(2);
});
