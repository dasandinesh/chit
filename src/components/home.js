import { useCallback, useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import axios from "axios";
import { Modal } from 'react-bootstrap';
import ResponsiveTable from "./ResponsiveTable";
import PaginatedList from "./PaginatedList";
import CustomerReminderButtons, { reminderPhone } from "./CustomerReminderButtons";
import { formatMoney } from "./PaymentHistory";
import { dashboard_url, chitdue_detail_url, chit_add_url } from "./url/url";
import "../dashboard.css";

const customerLink = (id, action) => `/coustomer?customer=${encodeURIComponent(id)}&action=${action}`;
const cards = [
  { key: "total_pending", label: "Total Pending", money: true, to: "/coustomer", emphasis: true },
  { key: "today_received", label: "Received Today", money: true },
  { key: "month_received", label: "Received This Month", money: true }
];

function ReminderGroups({ items, label, children, pastLabel = 'Overdue' }) {
  const isPast = row => ['Overdue', 'Past'].includes(row.status);
  const upcoming = items.filter(row => !isPast(row));
  const overdue = items.filter(isPast);
  return <>
    {upcoming.length ? <PaginatedList items={upcoming} label={label}>{children}</PaginatedList> : <p className="dashboard-note">No current or upcoming installments.</p>}
    {!!overdue.length && <div className="dashboard-overdue">
      <h4>{pastLabel} ({overdue.length})</h4>
      <PaginatedList items={overdue} label={`${label} overdue`}>{children}</PaginatedList>
    </div>}
  </>;
}

export default function Home() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [selectedGroupId, setSelectedGroupId] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState('');
  const [deleteNotice, setDeleteNotice] = useState('');
  const selectedGroup = data?.notifications?.groups?.find(group => String(group.chit_id) === selectedGroupId);
  const requests = useRef(0);
  const load = useCallback(async () => {
    const version = ++requests.current;
    setLoading(true); setError("");
    try {
      const response = await axios.get(dashboard_url);
      if (version === requests.current) setData(response.data);
    } catch {
      if (version === requests.current) setError("Unable to load dashboard. Check the backend connection and retry.");
    } finally { if (version === requests.current) setLoading(false); }
  }, []);
  const invalidateRequests = useCallback(() => { requests.current++; }, []);
  useEffect(() => { load(); return invalidateRequests; }, [load, invalidateRequests]);
  useEffect(() => {
    const refresh = () => { if (!document.hidden) load(); };
    const timer = setInterval(refresh, 60000);
    window.addEventListener('focus', refresh);
    return () => { clearInterval(timer); window.removeEventListener('focus', refresh); };
  }, [load]);
  const closeGroup = () => { if (!deleting) { setSelectedGroupId(null); setDeleteTarget(null); setDeleteError(''); setDeleteNotice(''); } };
  const deleteInstallment = async permanent => {
    if (!deleteTarget || deleting) return;
    setDeleting(true); setDeleteError(''); setDeleteNotice('');
    let archived = false;
    try {
      if (deleteTarget.due_id) {
        await axios.delete(chitdue_detail_url(deleteTarget.due_id));
        archived = true;
        if (permanent) await axios.delete(`${chitdue_detail_url(deleteTarget.due_id)}/permanent`);
      } else await axios.delete(`${chit_add_url}/${encodeURIComponent(selectedGroupId)}/schedule/${encodeURIComponent(deleteTarget.date)}`);
      setDeleteTarget(null);
      setDeleteNotice(!deleteTarget.due_id ? 'Not Created installment removed from this schedule and its reminders.' : permanent ? 'Installment permanently deleted. You can create it again.' : 'Installment moved to Deleted Records. Payment history is preserved.');
      await load();
    } catch (err) {
      setDeleteError(`${archived ? 'The installment was moved to Deleted Records. ' : ''}${err.response?.data?.message || 'Unable to complete deletion. Please retry.'}`);
      if (archived) await load();
    } finally { setDeleting(false); }
  };

  return <div className="dashboard-page">
    <div className="page-toolbar compact-toolbar">
      <div><h2>Dashboard</h2><p>Your chit groups, collections and outstanding balances.</p></div>
      <button type="button" className="btn-secondary" onClick={load} disabled={loading}>{loading ? "Loading..." : "Refresh"}</button>
    </div>
    {error && <div className="form-error" role="alert">{error} <button className="btn-secondary" onClick={load} disabled={loading}>Retry</button></div>}
    {loading && !data && <p role="status">Loading dashboard...</p>}
    {data && <>
      <div className="dashboard-cards" role="region" aria-label="Dashboard totals">
        {cards.map(card => {
          const content = <><span>{card.label}</span><strong>{card.money ? formatMoney(data.summary[card.key]) : data.summary[card.key]}</strong></>;
          return card.to ? <Link key={card.key} to={card.to} className={`dashboard-card${card.emphasis ? " dashboard-card-emphasis" : ""}`}>{content}</Link>
            : <div key={card.key} className="dashboard-card dashboard-card-collected">{content}</div>;
        })}
      </div>
      <div className="dashboard-shortcuts" aria-label="Quick actions">
        <Link className="btn" to="/coustomer">Customers / Receive Payment</Link>
        <Link className="btn btn-secondary" to="/add_chit">Chit Groups</Link>
        <Link className="btn btn-secondary" to="/ChitMaster">Create Installment</Link>
        <Link className="btn btn-secondary" to="/account">Accounts</Link>
      </div>
      <div className="dashboard-panels">
        <section className="dashboard-panel" aria-labelledby="creation-reminders-title">
          <div className="dashboard-section-heading"><h3 id="creation-reminders-title">Installments to Create</h3><Link to="/add_chit">Manage Schedules</Link></div>
          <p className="dashboard-note">One row per chit group. View all its installments, including created and paid records.</p>
          {!data.notifications?.groups?.length ? <p className="dashboard-empty">No chit groups found. Add a group and set a weekly or monthly schedule to enable reminders.</p> : <PaginatedList items={data.notifications.groups} label="Chit group reminders">{rows => <ResponsiveTable mobileCards={false} className="compact-list-table">
            <thead><tr><th>Chit Group</th><th>Next Creation Date</th><th>To Create</th><th>Missed</th><th>Action</th></tr></thead>
            <tbody>{rows.map(group => <tr key={group.chit_id}><td>{group.chit_name}</td><td>{group.next_date || '—'}</td><td>{group.missing_count}</td><td>{group.overdue_count}</td><td><button className="btn" onClick={() => setSelectedGroupId(String(group.chit_id))} aria-label={`View installments for ${group.chit_name}`}>View</button></td></tr>)}</tbody>
          </ResponsiveTable>}</PaginatedList>}
        </section>
        <section className="dashboard-panel" aria-labelledby="collection-reminders-title">
          <div className="dashboard-section-heading"><h3 id="collection-reminders-title">Installments to Collect</h3><Link to="/ChitMaster">View All</Link></div>
          <p className="dashboard-note">Today first, then all upcoming dates. Overdue balances appear below.</p>
          {!data.notifications?.collection?.length ? <p className="dashboard-empty">No pending installments to collect.</p> : <ReminderGroups items={data.notifications.collection} label="Collection reminders">{rows => <ResponsiveTable mobileCards={false} className="compact-list-table">
            <thead><tr><th>Date</th><th>Chit / Installment</th><th>Status</th><th>Customers</th><th>Pending</th><th>Action</th></tr></thead>
            <tbody>{rows.map(row => <tr key={row.due_id}><td>{row.date}</td><td>{row.chit_name} / {row.chit_list}</td><td>{row.status}</td><td>{row.customers}</td><td>{formatMoney(row.pending)}</td><td><Link className="btn" to={`/ChitMaster?view=${encodeURIComponent(row.due_id)}`}>View / Pay</Link></td></tr>)}</tbody>
          </ResponsiveTable>}</ReminderGroups>}
        </section>
        <section className="dashboard-panel" aria-labelledby="dashboard-pending-title">
          <div className="dashboard-section-heading"><h3 id="dashboard-pending-title">Highest Pending Customers</h3><Link to="/coustomer">View All</Link></div>
          {!data.top_customers.length ? <p className="dashboard-empty">No customer has a pending balance.</p> : <ResponsiveTable mobileCards={false} className="compact-list-table dashboard-customer-table">
            <thead><tr><th>S.No</th><th>Name</th><th>Total Pending</th><th>Actions</th><th>Reminders</th></tr></thead>
            <tbody>{data.top_customers.map((customer, index) => <tr key={customer._id}>
              <td>{index + 1}</td><td>{customer.name}</td><td><strong>{formatMoney(customer.total_pending)}</strong></td>
              <td><div className="table-actions"><Link className="btn btn-secondary" to={customerLink(customer._id, "view")}>View</Link><Link className="btn" to={customerLink(customer._id, "pay")}>Pay</Link>{reminderPhone(customer.phone) ? <a className="btn btn-secondary" href={`tel:+${reminderPhone(customer.phone)}`} aria-label={`Call ${customer.name}`}>Call</a> : <button disabled title="A valid phone number is required.">Call</button>}</div></td>
              <td><CustomerReminderButtons customer={customer} /></td>
            </tr>)}</tbody>
          </ResponsiveTable>}
        </section>
        <section className="dashboard-panel" aria-labelledby="dashboard-payments-title">
          <div className="dashboard-section-heading"><h3 id="dashboard-payments-title">Recent Payments</h3><Link to="/coustomer">Customers</Link></div>
          {!data.recent_payments.length ? <p className="dashboard-empty">No payments have been recorded yet.</p> : <ResponsiveTable mobileCards={false} className="compact-list-table">
            <thead><tr><th>Payment Date</th><th>Customer</th><th>Amount</th><th>Source</th><th>Receipt</th><th>Action</th></tr></thead>
            <tbody>{data.recent_payments.map(payment => <tr key={payment._id}>
              <td>{payment.date || "-"}</td><td>{payment.customer_name}</td><td>{formatMoney(payment.amount)}</td><td>{payment.source === "customer" ? "Customer Payment" : payment.source === "share" ? "Share Payment" : "Earlier Payment"}</td><td title={payment._id}>{String(payment._id).slice(-8)}</td><td><Link className="btn btn-secondary" to={customerLink(payment.customer_id, "view")}>View</Link></td>
            </tr>)}</tbody>
          </ResponsiveTable>}
        </section>
      </div>
      <p className="dashboard-note">Collections use payment dates in India time; this month means month to date. Each receipt is counted once. Opening balances are included in Total Pending.</p>
      <p className="dashboard-note">Updated: {new Date(data.generated_at).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })}{loading ? " (refreshing...)" : ""}</p>
    </>}
    <Modal show={!!selectedGroup} onHide={closeGroup} centered size="lg" className="chit-form-modal" aria-labelledby="group-installments-title" backdrop={deleting ? 'static' : true} keyboard={!deleting}>
      <Modal.Header closeButton={!deleting}><Modal.Title as="h2" id="group-installments-title">{selectedGroup?.chit_name} — All Installments</Modal.Title></Modal.Header>
      <Modal.Body>
        {deleteError && <p role="alert" className="form-error">{deleteError}</p>}
        {deleteNotice && <p role="status" className="success-notice">{deleteNotice}</p>}
        {deleteTarget ? <div>
          <h3>Delete Installment</h3>
          <p>Delete installment <strong>{deleteTarget.chit_list || deleteTarget.installment}</strong> dated <strong>{deleteTarget.date}</strong>?</p>
          <p>{deleteTarget.due_id ? 'Delete moves it to Deleted Records and removes its unpaid balance from customer totals. Payment history is kept.' : 'This removes only this date from the schedule and creation reminders. Other dates and existing Chit Master records are kept.'}</p>
          {deleteTarget.due_id && Number(deleteTarget.paid) === 0 && <p>Permanently Delete also removes the record so you can create it again. This cannot be undone and is allowed only when no payments have been recorded.</p>}
        </div> : selectedGroup && <>
          <p className="form-hint">{selectedGroup.frequency === 'monthly' ? 'Monthly' : selectedGroup.frequency === 'weekly' ? 'Weekly' : 'Manual schedule'} · {selectedGroup.shares} shares · {selectedGroup.customers} customers · {selectedGroup.total_installments} scheduled installments</p>
          <p className="form-hint">Chit amount: {formatMoney(selectedGroup.total_amount)} · Per share: {formatMoney(selectedGroup.amount)}</p>
          <p className="dashboard-note">Today first, then upcoming dates. Past dates appear separately below. Paid installments remain in this history.</p>
          {!selectedGroup.installments.length ? <p className="dashboard-empty">No installments yet. Set a weekly or monthly schedule in Manage Schedules, or create installments manually in Chit Master.</p> : <ReminderGroups key={selectedGroup.chit_id} items={selectedGroup.installments} label="Group installments" pastLabel="Past Installments">{rows => <ResponsiveTable mobileCards={false} className="compact-list-table">
            <thead><tr><th>Date</th><th>Installment</th><th>Timing</th><th>Record Status</th><th>Paid</th><th>Pending</th><th>Action</th></tr></thead>
            <tbody>{rows.map(row => <tr key={row.due_id || `${selectedGroup.chit_id}-${row.date}`}>
              <td>{row.date}</td><td>{row.chit_list || row.installment}</td><td>{row.status}</td><td>{row.due_id ? row.payment_status === 'Paid' ? 'Paid' : 'Created' : 'Not Created'}</td>
              <td>{row.due_id ? formatMoney(row.paid) : '—'}</td><td>{row.due_id ? formatMoney(row.pending) : '—'}</td>
              <td><div className="table-actions">{row.due_id ? <Link className="btn" to={`/ChitMaster?view=${encodeURIComponent(row.due_id)}`}>View / Pay</Link> : <Link className="btn" to={`/ChitMaster?chit=${encodeURIComponent(selectedGroup.chit_id)}&date=${row.date}&installment=${row.installment}`}>Create ChitMaster</Link>}<button className="btn-danger-soft" onClick={() => { setDeleteError(''); setDeleteNotice(''); setDeleteTarget(row); }} aria-label={`Delete installment ${row.chit_list || row.installment} dated ${row.date}`}>Delete</button></div></td>
            </tr>)}</tbody>
          </ResponsiveTable>}</ReminderGroups>}
        </>}
      </Modal.Body>
      <Modal.Footer>{deleteTarget ? <>
        <button className="btn-secondary" disabled={deleting} onClick={() => { setDeleteTarget(null); setDeleteError(''); }}>Cancel</button>
        <button className="btn-danger-soft" disabled={deleting} onClick={() => deleteInstallment(false)}>{deleting ? 'Deleting...' : 'Delete'}</button>
        {deleteTarget.due_id && Number(deleteTarget.paid) === 0 && <button className="btn-danger-soft" disabled={deleting} onClick={() => deleteInstallment(true)}>Permanently Delete</button>}
      </> : <button className="btn-secondary" onClick={closeGroup}>Close</button>}</Modal.Footer>
    </Modal>
  </div>;
}
