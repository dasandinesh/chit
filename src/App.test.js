import { render, screen } from '@testing-library/react';
import App from './App';
import axios from 'axios';

jest.mock('axios', () => ({ get: jest.fn() }));
test('home route renders dashboard with the shared footer', async () => {
  const dashboard = { generated_at: '2026-11-06T10:00:00Z', summary: { customers: 0, chit_groups: 0, shares: 0, opening_pending: 0, chit_pending: 0, total_pending: 0, today_received: 0, month_received: 0 }, top_customers: [], recent_payments: [] };
  axios.get.mockImplementation(url => Promise.resolve({ data: url.endsWith('/session') ? { authenticated: true, username: 'admin' } : dashboard }));
  render(<App />);
  expect(await screen.findByRole('heading', { name: 'Dashboard' })).toBeInTheDocument();
  await screen.findByText('No customer has a pending balance.');
  expect(screen.getByRole('contentinfo')).toHaveTextContent('Chit Manager');
});
