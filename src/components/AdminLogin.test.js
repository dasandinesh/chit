import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import axios from 'axios';
import AdminLogin from './AdminLogin';
jest.mock('axios', () => ({ get: jest.fn(), post: jest.fn() }));
beforeEach(() => { jest.resetAllMocks(); });
const show = () => render(<AdminLogin>{auth => <><h1>Private Dashboard</h1><button onClick={auth.logout}>Logout</button><button onClick={auth.openPassword}>Change Password</button></>}</AdminLogin>);

test('private content stays hidden until login succeeds, and logout hides it again', async () => {
  axios.get.mockResolvedValue({ data: { authenticated: false } });
  axios.post.mockResolvedValue({ data: { authenticated: true, username: 'admin' } });
  show();
  await screen.findByRole('heading', { name: 'Admin Login' });
  expect(screen.queryByText('Private Dashboard')).not.toBeInTheDocument();
  fireEvent.change(screen.getByLabelText('Password'), { target: { value: 'TestPassword123!' } });
  fireEvent.click(screen.getByRole('button', { name: 'Log In' }));
  await screen.findByText('Private Dashboard');
  fireEvent.click(screen.getByRole('button', { name: 'Logout' }));
  await screen.findByRole('heading', { name: 'Admin Login' });
  expect(screen.queryByText('Private Dashboard')).not.toBeInTheDocument();
});

test('wrong login reports error and password change signs the admin out', async () => {
  axios.get.mockResolvedValue({ data: { authenticated: true, username: 'admin' } });
  axios.post.mockResolvedValue({ data: {} });
  show();
  fireEvent.click(await screen.findByRole('button', { name: 'Change Password' }));
  fireEvent.change(screen.getByLabelText('Current Password'), { target: { value: 'TestPassword123!' } });
  fireEvent.change(screen.getByLabelText('New Password'), { target: { value: 'New123' } });
  fireEvent.change(screen.getByLabelText('Confirm New Password'), { target: { value: 'New123' } });
  fireEvent.click(screen.getAllByRole('button', { name: 'Change Password', exact: true }).slice(-1)[0]);
  await screen.findByRole('heading', { name: 'Admin Login' });
  expect(axios.post).toHaveBeenCalledWith(expect.stringMatching(/auth\/password$/), { currentPassword: 'TestPassword123!', newPassword: 'New123' });
  axios.post.mockRejectedValue({ response: { data: { message: 'Invalid username or password.' } } });
  fireEvent.change(screen.getByLabelText('Password'), { target: { value: 'wrong' } });
  fireEvent.click(screen.getByRole('button', { name: 'Log In' }));
  await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent('Invalid username or password.'));
});
