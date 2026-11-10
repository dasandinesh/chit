import ResponsiveTable from "./ResponsiveTable";
import PaginatedList from './PaginatedList';

export const formatMoney = value => new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR' }).format(Number(value || 0));
export const localDate = () => new Date().toLocaleDateString('en-CA');
export const paymentReference = () => {
  if (window.crypto.randomUUID) return window.crypto.randomUUID();
  // randomUUID requires HTTPS; getRandomValues also works on local-network HTTP.
  const bytes = new Uint8Array(16);
  window.crypto.getRandomValues(bytes);
  return Array.from(bytes, byte => byte.toString(16).padStart(2, '0')).join('');
};

export default function PaymentHistory({ receipts = [] }) {
  const rows = [...receipts].reverse().flatMap(receipt => receipt.allocations.map((allocation, index) => ({ receipt, allocation, index })));
  return (
    <PaginatedList items={rows} label="Payment allocations">
      {page => <ResponsiveTable>
        <thead><tr><th>Payment Date</th><th>Receipt</th><th>Allocated To</th><th>Amount</th></tr></thead>
        <tbody>{page.map(({ receipt, allocation, index }) => <tr key={`${receipt._id}:${index}`}>
          <td>{receipt.date}</td>
          <td title={receipt._id}>{String(receipt._id).slice(-8)}</td>
          <td>{allocation.kind === 'opening' ? 'Opening Balance' : `${allocation.chit_name} / ${allocation.chit_list} / Share ${allocation.share_number} (${allocation.due_date})`}</td>
          <td>{formatMoney(allocation.amount)}</td>
        </tr>)}</tbody>
      </ResponsiveTable>}
    </PaginatedList>
  );
}
