import { fireEvent, render, screen, within } from '@testing-library/react';
import PaginatedList from './PaginatedList';

test('main pagination stays above the footer on all screens while nested pagination stays inline', () => {
  const items = Array.from({ length: 12 }, (_, i) => `Customer ${i + 1}`);
  render(<>
    <main><PaginatedList footerPagination items={items} label="Customers">{rows => <ul>{rows.map(row => <li key={row}>{row}</li>)}</ul>}</PaginatedList>
      <PaginatedList items={['Share 1']} label="Nested shares">{rows => <p>{rows[0]}</p>}</PaginatedList>
    </main>
    <div id="pagination-footer" data-testid="pagination-footer" />
    <footer>Chit Manager</footer>
  </>);
  const footerSlot = screen.getByTestId('pagination-footer');
  expect(within(footerSlot).getByRole('navigation', { name: 'Customers pagination' })).toBeInTheDocument();
  expect(within(footerSlot).queryByRole('navigation', { name: 'Nested shares pagination' })).not.toBeInTheDocument();
  expect(screen.getByRole('navigation', { name: 'Nested shares pagination' }).closest('main')).not.toBeNull();
  fireEvent.click(within(footerSlot).getByRole('button', { name: 'Customers: next page' }));
  expect(screen.getByText('Customer 11')).toBeInTheDocument();
  expect(within(footerSlot).getByText('Page 2 of 2')).toBeInTheDocument();
});
