import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import Navbars from './Navbars';

test('navigation opens and closes the phone menu, changes routes and marks the current page', async () => {
  render(<MemoryRouter initialEntries={['/chit']}><Navbars /></MemoryRouter>);
  const toggle = screen.getByRole('button', { name: 'Toggle navigation' });
  expect(toggle).toHaveAttribute('aria-expanded', 'false');
  fireEvent.click(toggle);
  expect(screen.getByRole('navigation', { name: 'Main navigation' })).toBeInTheDocument();
  expect(screen.getByRole('link', { name: 'Dues' })).toHaveAttribute('aria-current', 'page');
  expect(toggle).toHaveAttribute('aria-expanded', 'true');
  fireEvent.click(screen.getByRole('link', { name: 'Customers' }));
  expect(toggle).toHaveAttribute('aria-expanded', 'false');
  await waitFor(() => expect(screen.getByRole('link', { name: 'Customers' })).toHaveAttribute('aria-current', 'page'));
});
