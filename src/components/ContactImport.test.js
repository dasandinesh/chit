import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import axios from 'axios';
import ContactImport from './ContactImport';
jest.mock('axios', () => ({ get: jest.fn(), post: jest.fn() }));
beforeEach(() => jest.clearAllMocks());

test('file preview blocks duplicates, supports corrections, and imports only selected contacts', async () => {
  const onImported = jest.fn();
  axios.post.mockResolvedValue({ data: { imported: 1, duplicates: 0, failed: 0, results: [{ index: 0, status: 'imported' }] } });
  axios.get.mockResolvedValue({ data: [{ name: 'New', phone: '+918888888888' }] });
  render(<ContactImport customers={[{ phone: '9876543210' }]} onClose={jest.fn()} onImported={onImported} />);
  const file = new File(['Name,Phone 1 - Value\nExisting,+919876543210\nNew,8888888888\nAnother,7777777777'], 'contacts.csv', { type: 'text/csv' });
  fireEvent.change(screen.getByLabelText('Google CSV file'), { target: { files: [file] } });
  await screen.findByText('Already a customer');
  expect(axios.post).not.toHaveBeenCalled();
  expect(screen.getByLabelText('Select contact 1')).toBeDisabled();
  fireEvent.click(screen.getByLabelText('Select contact 3'));
  fireEvent.change(screen.getByLabelText('Opening balance for contact 2'), { target: { value: '250.50' } });
  fireEvent.click(screen.getByRole('button', { name: 'Import Selected (1)' }));
  await waitFor(() => expect(axios.post).toHaveBeenCalledWith(expect.stringMatching(/customer\/import$/), { contacts: [{ name: 'New', phone: '+918888888888', opening_balance: '250.50' }] }));
  expect(await screen.findByRole('status')).toHaveTextContent('1 imported');
  await waitFor(() => expect(onImported).toHaveBeenCalled());
});

test('invalid CSV and network failures keep the dialog usable', async () => {
  axios.post.mockRejectedValue(new Error('offline'));
  render(<ContactImport customers={[]} onClose={jest.fn()} onImported={jest.fn()} />);
  fireEvent.change(screen.getByLabelText('Google CSV file'), { target: { files: [new File(['wrong,columns\na,b'], 'bad.csv')] } });
  expect(await screen.findByRole('alert')).toHaveTextContent('Google CSV');
  fireEvent.change(screen.getByLabelText('Google CSV file'), { target: { files: [new File(['Name,Phone\nNew,8888888888'], 'good.csv')] } });
  fireEvent.click(await screen.findByRole('button', { name: 'Import Selected (1)' }));
  expect(await screen.findByRole('alert')).toHaveTextContent('Retry safely');
  expect(screen.getByRole('button', { name: 'Import Selected (1)' })).toBeEnabled();
});

test('imports more than 2000 selected contacts in bounded batches with progress', async () => {
  axios.get.mockResolvedValue({ data: [] });
  axios.post.mockImplementation((url, { contacts }) => Promise.resolve({ data: { imported: contacts.length, duplicates: 0, failed: 0, results: contacts.map((row, index) => ({ index, status: 'imported' })) } }));
  render(<ContactImport customers={[]} onClose={jest.fn()} onImported={jest.fn()} />);
  const csv = 'Name,Phone\n' + Array.from({ length: 2001 }, (_, i) => `Contact ${i},${9000000000 + i}`).join('\n');
  fireEvent.change(screen.getByLabelText('Google CSV file'), { target: { files: [new File([csv], 'large.csv')] } });
  fireEvent.click(await screen.findByRole('button', { name: 'Import Selected (2001)' }));
  await waitFor(() => expect(screen.getByRole('status')).toHaveTextContent('2001 imported'), { timeout: 10000 });
  expect(axios.post).toHaveBeenCalledTimes(21);
  expect(axios.post.mock.calls.every(([, body]) => body.contacts.length <= 100)).toBe(true);
  expect(axios.post.mock.calls.flatMap(([, body]) => body.contacts)).toHaveLength(2001);
  expect(screen.getByLabelText('Contact import progress')).toHaveAttribute('value', '2001');
});

test('a failed later batch keeps saved progress and retries only remaining contacts', async () => {
  axios.get.mockResolvedValue({ data: [] });
  const success = (url, { contacts }) => Promise.resolve({ data: { imported: contacts.length, duplicates: 0, failed: 0, results: contacts.map((row, index) => ({ index, status: 'imported' })) } });
  axios.post.mockImplementationOnce(success).mockRejectedValueOnce(new Error('offline')).mockImplementation(success);
  render(<ContactImport customers={[]} onClose={jest.fn()} onImported={jest.fn()} />);
  const csv = 'Name,Phone\n' + Array.from({ length: 201 }, (_, i) => `Contact ${i},${9000000000 + i}`).join('\n');
  fireEvent.change(screen.getByLabelText('Google CSV file'), { target: { files: [new File([csv], 'retry.csv')] } });
  fireEvent.click(await screen.findByRole('button', { name: 'Import Selected (201)' }));
  expect(await screen.findByRole('alert')).toHaveTextContent('Retry safely');
  expect(screen.getByRole('status')).toHaveTextContent('100 of 201 processed');
  fireEvent.click(screen.getByRole('button', { name: 'Import Selected (101)' }));
  await waitFor(() => expect(screen.getByRole('status')).toHaveTextContent('101 imported'));
  expect(axios.post.mock.calls[2][1].contacts[0].name).toBe('Contact 100');
  expect(axios.post.mock.calls[3][1].contacts).toHaveLength(1);
});
