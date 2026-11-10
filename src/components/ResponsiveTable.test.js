import { fireEvent, render, screen, within } from '@testing-library/react';
import ResponsiveTable from './ResponsiveTable';

test('phone labels align with conditional columns and preserve the original action', () => {
  const pay = jest.fn();
  render(<ResponsiveTable>
    <thead><tr><th>Customer</th><><th>Pending</th><th>Action</th></></tr></thead>
    <tbody><tr><td>Ravi</td><><td>100</td><td><button onClick={pay}>Pay</button></td></></tr></tbody>
  </ResponsiveTable>);
  const cells = screen.getAllByRole('cell');
  expect(cells.map(cell => cell.dataset.label)).toEqual(['Customer', 'Pending', 'Action']);
  expect(cells[2]).toHaveAttribute('data-wide', 'true');
  fireEvent.click(screen.getByRole('button', { name: 'Pay' }));
  expect(pay).toHaveBeenCalledTimes(1);
});

test('nested payment tables keep their own header labels and table semantics', () => {
  render(<ResponsiveTable aria-label="Customers">
    <thead><tr><th>Customer</th><th>Payment History</th></tr></thead>
    <tbody><tr><td>Ravi</td><td><ResponsiveTable aria-label="Payments"><thead><tr><th>Date</th><th>Amount</th></tr></thead><tbody><tr><td>2026-11-06</td><td>100</td></tr></tbody></ResponsiveTable></td></tr></tbody>
  </ResponsiveTable>);
  const payments = screen.getByRole('table', { name: 'Payments' });
  expect(within(payments).getAllByRole('cell').map(cell => cell.dataset.label)).toEqual(['Date', 'Amount']);
  expect(screen.getByRole('columnheader', { name: 'Payment History' })).toHaveAttribute('scope', 'col');
});
