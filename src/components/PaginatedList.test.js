import { fireEvent, render, screen } from '@testing-library/react';
import PaginatedList from './PaginatedList';

const items = Array.from({ length: 26 }, (_, i) => `Record ${i + 1}`);
const list = (values = items, resetKey = '') => (
  <PaginatedList items={values} label="Test records" resetKey={resetKey}>
    {(rows, start) => <ol start={start + 1}>{rows.map(row => <li key={row}>{row}</li>)}</ol>}
  </PaginatedList>
);

test('navigates complete pages and the partial last page without losing records', () => {
  render(list());
  expect(screen.getAllByRole('listitem')).toHaveLength(10);
  expect(screen.getByRole('button', { name: 'Test records: previous page' })).toBeDisabled();
  fireEvent.click(screen.getByRole('button', { name: 'Test records: next page' }));
  expect(screen.getByText('Record 11')).toBeInTheDocument();
  expect(screen.queryByText('Record 1')).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: 'Test records: last page' }));
  expect(screen.getAllByRole('listitem')).toHaveLength(6);
  expect(screen.getByText('21–26 of 26')).toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'Test records: next page' })).toBeDisabled();
});

test('changing page size or filters resets the page and handles an empty result', () => {
  const { rerender } = render(list());
  fireEvent.click(screen.getByRole('button', { name: 'Test records: last page' }));
  fireEvent.change(screen.getByLabelText('Rows'), { target: { value: '25' } });
  expect(screen.getAllByRole('listitem')).toHaveLength(25);
  expect(screen.getByText('Page 1 of 2')).toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: 'Test records: next page' }));
  rerender(list(items, 'new filter'));
  expect(screen.getByText('Page 1 of 2')).toBeInTheDocument();
  rerender(list([], 'empty filter'));
  expect(screen.getByText('No records')).toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'Test records: next page' })).toBeDisabled();
});

test('shrinking a list clamps the current page to avoid blank pages', () => {
  const { rerender } = render(list());
  fireEvent.click(screen.getByRole('button', { name: 'Test records: last page' }));
  rerender(list(items.slice(0, 12)));
  expect(screen.getByText('Page 2 of 2')).toBeInTheDocument();
  expect(screen.getAllByRole('listitem')).toHaveLength(2);
});
