import ResponsiveTable from "./ResponsiveTable";
import PaginatedList from "./PaginatedList";
import { formatMoney, paymentReference, localDate } from "./PaymentHistory";
import React, { useCallback, useEffect, useState, useRef } from "react";
import CustomerReminderButtons, { reminderPhone } from './CustomerReminderButtons';
import { Modal } from "react-bootstrap";
import axios from "axios";
import { chit_get_url, customer_get_url, chitdue_get_url, chitdue_add_url, chitdue_amount_update_url, chitdue_detail_url } from "./url/url";

const blankInstallment = () => ({ chit_id: "", date: localDate(), chit_list: "", amount: "" });
const sum = (members, field) => members.reduce((total, member) => total + Math.round(Number(member[field] || 0) * 100), 0) / 100;

export default function ChitMaster() {
  const [dues, setDues] = useState([]);
  const [chits, setChits] = useState([]);
  const [customers, setCustomers] = useState([]);
  const linkedAction = useRef(false);
  const [createForm, setCreateForm] = useState(blankInstallment);
  const [recordFilter, setRecordFilter] = useState("active");
  const [mode, setMode] = useState(null);
  const [record, setRecord] = useState(null);
  const [editForm, setEditForm] = useState({ date: "", chit_list: "", amount: "" });
  const [paymentDate, setPaymentDate] = useState(localDate);
  const [paidAmounts, setPaidAmounts] = useState({});
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(false);
  const [pageError, setPageError] = useState("");
  const [dialogError, setDialogError] = useState("");
  const [message, setMessage] = useState("");
  const requests = useRef(0);
  const references = useRef({});

  const loadDues = async () => {
    const response = await axios.get(`${chitdue_get_url}?include_deleted=true`);
    setDues(response.data);
  };
  useEffect(() => {
    loadDues().catch(() => setPageError("Unable to load Chit Master records."));
    axios.get(chit_get_url).then(response => setChits(response.data)).catch(() => setPageError("Unable to load chit groups."));
    axios.get(customer_get_url).then(response => setCustomers(Array.isArray(response.data) ? response.data : [])).catch(() => {});
  }, []);

  const closeDialog = () => {
    if (busy) return;
    requests.current++;
    setMode(null); setRecord(null); setDialogError("");
  };
  const openDialog = useCallback(async (selected, nextMode) => {
    const version = ++requests.current;
    setMode(nextMode); setRecord(selected); setLoading(true); setDialogError("");
    setPaidAmounts({}); references.current = {}; setPaymentDate(localDate());
    try {
      const response = await axios.get(chitdue_detail_url(selected._id));
      if (version !== requests.current) return;
      setRecord(response.data);
      setEditForm({ date: response.data.date, chit_list: response.data.chit_list, amount: String(response.data.amount) });
    } catch (error) {
      if (version === requests.current) { setRecord(null); setDialogError(error.response?.data?.message || "Unable to load record details. Close and retry."); }
    } finally { if (version === requests.current) setLoading(false); }
  }, []);
  useEffect(() => {
    if (linkedAction.current) return;
    const params = new URLSearchParams(window.location.search);
    if (params.get('view')) {
      const selected = dues.find(d => String(d._id) === params.get('view'));
      if (selected) { linkedAction.current = true; openDialog(selected, 'view'); }
    } else if (params.get('chit')) {
      const selected = chits.find(c => String(c._id) === params.get('chit'));
      if (selected) {
        linkedAction.current = true;
        setCreateForm({ chit_id: selected._id, date: params.get('date') || localDate(), chit_list: params.get('installment') || '', amount: selected.chit_det.Due_amount });
      }
    }
  }, [chits, dues, openDialog]);
  const refreshList = async () => {
    try { await loadDues(); } catch { setPageError("The change was saved, but the list could not refresh. Please reload."); }
  };
  const createDue = async event => {
    event.preventDefault(); setBusy(true); setPageError(""); setMessage("");
    try {
      await axios.post(chitdue_add_url, createForm);
      setCreateForm(blankInstallment()); setMessage("Installment created."); await refreshList();
    } catch (error) { setPageError(error.response?.data?.message || "Unable to create installment"); }
    finally { setBusy(false); }
  };
  const saveEdit = async event => {
    event.preventDefault(); setBusy(true); setDialogError("");
    try {
      await axios.put(chitdue_detail_url(record._id), editForm);
      setMode(null); setRecord(null); setMessage("Installment updated. Customer balances have been recalculated."); await refreshList();
    } catch (error) { setDialogError(error.response?.data?.message || "Unable to update installment"); }
    finally { setBusy(false); }
  };
  const deleteRecord = async () => {
    setBusy(true); setDialogError("");
    try {
      await axios.delete(chitdue_detail_url(record._id));
      setMode(null); setRecord(null); setMessage("Record moved to Deleted Records. Payment history is preserved."); await refreshList();
    } catch (error) { setDialogError(error.response?.data?.message || "Unable to delete installment"); }
    finally { setBusy(false); }
  };
  const restoreRecord = async () => {
    setBusy(true); setDialogError("");
    try {
      await axios.post(`${chitdue_detail_url(record._id)}/restore`);
      setMode(null); setRecord(null); setMessage("Record restored. Customer balances have been recalculated."); await refreshList();
    } catch (error) { setDialogError(error.response?.data?.message || "Unable to restore installment"); }
    finally { setBusy(false); }
  };
  const permanentlyDeleteRecord = async () => {
    setBusy(true); setDialogError('');
    try {
      await axios.delete(`${chitdue_detail_url(record._id)}/permanent`);
      setMode(null); setRecord(null); setMessage('Installment permanently deleted. You can create the same date and installment again.'); await refreshList();
    } catch (error) { setDialogError(error.response?.data?.message || 'Unable to permanently delete installment.'); }
    finally { setBusy(false); }
  };
  const receivePayment = async member => {
    setBusy(true); setDialogError("");
    references.current[member.share_id] ||= paymentReference();
    try {
      const response = await axios.post(chitdue_amount_update_url, { id: record._id, memberId: member.member_id,
        share_id: member.share_id, current_paid_amount: paidAmounts[member.share_id], date: paymentDate, reference: references.current[member.share_id] });
      setRecord(response.data); setPaidAmounts(previous => ({ ...previous, [member.share_id]: "" }));
      delete references.current[member.share_id]; await refreshList();
    } catch (error) { setDialogError(error.response?.data?.message || "Unable to confirm payment. Retry the same details safely."); }
    finally { setBusy(false); }
  };
  const visibleDues = dues.filter(due => recordFilter === "deleted" ? !!due.deletedAt : !due.deletedAt);
  const title = mode === 'permanent' ? 'Permanently Delete Installment' : mode === "edit" ? "Edit Chit Master" : mode === "delete" ? "Delete Chit Master Record" : "Chit Master Details";

  return <div className="container">
    <div className="page-toolbar compact-toolbar"><div><h2>Chit Master</h2><p>Create installments and manage every customer share.</p></div></div>
    {pageError && <p role="alert" className="form-error">{pageError}</p>}
    {message && <p role="status" className="success-notice">{message}</p>}
    <form onSubmit={createDue} className="installment-create-form compact-installment-form">
      <div><label htmlFor="master-group">Chit Group</label><select id="master-group" required value={createForm.chit_id} onChange={e => setCreateForm({ ...createForm, chit_id: e.target.value })}><option value="">Select a Chit</option>{chits.map(chit => <option key={chit._id} value={chit._id}>{chit.chit_det.chit_name}</option>)}</select></div>
      <div><label htmlFor="master-date">Due Date</label><input id="master-date" type="date" required value={createForm.date} onChange={e => setCreateForm({ ...createForm, date: e.target.value })} /></div>
      <div><label htmlFor="master-list">List / Installment</label><input id="master-list" required value={createForm.chit_list} onChange={e => setCreateForm({ ...createForm, chit_list: e.target.value })} placeholder="e.g. November / Week 1" /></div>
      <div><label htmlFor="master-amount">Amount per Share</label><input id="master-amount" type="number" min="0.01" step="0.01" required value={createForm.amount} onChange={e => setCreateForm({ ...createForm, amount: e.target.value })} /></div>
      <button disabled={busy}>Create</button>
    </form>
    <div className="record-filter compact-record-filter"><label htmlFor="master-record-filter">Show</label><select id="master-record-filter" value={recordFilter} onChange={e => setRecordFilter(e.target.value)}><option value="active">Active Records</option><option value="deleted">Deleted Records</option></select></div>
    <PaginatedList footerPagination items={visibleDues} label="Chit Master" resetKey={recordFilter}>
      {page => <div className="table-scroll"><ResponsiveTable mobileCards={false} className="compact-list-table">
        <thead><tr><th>Chit Name</th><th>List / Installment</th><th>Due Date</th><th>Per Share</th><th>Shares</th><th>Total Paid</th><th>Total Pending</th><th>Actions</th></tr></thead>
        <tbody>{page.map(due => <tr key={due._id}>
          <td>{due.chit_name}</td><td>{due.chit_list}</td><td>{due.date}</td><td>{formatMoney(due.amount)}</td><td>{due.member.length}</td><td>{formatMoney(sum(due.member, "paid_amount"))}</td><td>{formatMoney(sum(due.member, "pending_amount"))}</td>
          <td><div className="table-actions"><button className="btn-secondary" onClick={() => openDialog(due, "view")}>View</button>{!due.deletedAt && <><button onClick={() => openDialog(due, "edit")}>Edit</button><button className="btn-danger-soft" onClick={() => openDialog(due, "delete")}>Delete</button></>}</div></td>
        </tr>)}</tbody>
      </ResponsiveTable></div>}
    </PaginatedList>

    <Modal show={!!mode} onHide={closeDialog} centered className="chit-form-modal chit-master-modal" aria-labelledby="master-dialog-title" backdrop={busy ? "static" : true} keyboard={!busy}>
      <Modal.Header closeButton={!busy}><Modal.Title as="h2" id="master-dialog-title">{title}</Modal.Title></Modal.Header>
      <Modal.Body>
        {dialogError && <p role="alert" className="form-error">{dialogError}</p>}
        {loading ? <p>Loading full details...</p> : record && <>
          <div className="record-heading"><div><h3>{record.chit_name}</h3><p>{record.chit_list} | Due {record.date}</p></div>{record.deletedAt && <span className="deleted-badge">Deleted Record</span>}</div>
          {mode === "edit" ? <form id="master-edit-form" onSubmit={saveEdit}>
            <p className="form-hint">Customer shares and payment history are preserved. Amount changes apply to every share in this installment.</p>
            <label htmlFor="edit-master-list">List / Installment</label><input id="edit-master-list" required value={editForm.chit_list} onChange={e => setEditForm({ ...editForm, chit_list: e.target.value })} />
            <label htmlFor="edit-master-date">Due Date</label><input id="edit-master-date" type="date" required value={editForm.date} onChange={e => setEditForm({ ...editForm, date: e.target.value })} />
            <label htmlFor="edit-master-amount">Amount per Share</label><input id="edit-master-amount" type="number" min={Math.max(.01, ...record.member.map(m => Number(m.paid_amount)))} step="0.01" required value={editForm.amount} onChange={e => setEditForm({ ...editForm, amount: e.target.value })} />
            <p className="form-hint">Minimum allowed: {formatMoney(Math.max(.01, ...record.member.map(m => Number(m.paid_amount))))}. The chit group and customer share identities cannot be changed here.</p>
          </form> : mode === "delete" ? <>
            <p>This moves the entire installment and its {record.member.length} shares to Deleted Records.</p>
            <p>Its unpaid balance of <strong>{formatMoney(sum(record.member, "pending_amount"))}</strong> will be removed from customer totals. Existing payments remain recorded and no money is refunded.</p>
            <p className="form-hint">You can restore the record from Deleted Records; its remaining balance will return to the customer totals.</p>
          </> : mode === 'permanent' ? <>
            <p>Permanently delete this installment? It cannot be restored afterward.</p>
            <p>You can create the same date and installment again. Records with payment history cannot be permanently deleted.</p>
          </> : <>
            <div className="balance-cards">
              <div><span>Amount per Share</span><strong>{formatMoney(record.amount)}</strong></div>
              <div><span>Shares / Customers</span><strong>{record.member.length} / {new Set(record.member.map(m => m.member_id)).size}</strong></div>
              <div><span>Total Amount</span><strong>{formatMoney(sum(record.member, "amount"))}</strong></div>
              <div><span>Total Paid</span><strong>{formatMoney(sum(record.member, "paid_amount"))}</strong></div>
              <div><span>Total Pending</span><strong>{formatMoney(sum(record.member, "pending_amount"))}</strong></div>
            </div>
            <p className="record-metadata">Record ID: {record._id}{record.createdAt ? ` | Created: ${new Date(record.createdAt).toLocaleString('en-IN')}` : ""}</p>
            {!record.deletedAt && <div className="payment-date-field"><label htmlFor="master-payment-date">Payment Date</label><input id="master-payment-date" type="date" value={paymentDate} disabled={busy} onChange={e => { setPaymentDate(e.target.value); references.current = {}; }} /></div>}
            <h6>All Customer Shares</h6>
            {!record.deletedAt && <details><summary>Customer reminders for this installment</summary>
              {Array.from(new Set(record.member.map(m => String(m.member_id)))).map(id => {
                const shares = record.member.filter(m => String(m.member_id) === id);
                const pending = sum(shares, 'pending_amount');
                if (pending <= 0) return null;
                const customer = { ...customers.find(c => String(c._id) === id), name: shares[0].name, total_pending: pending };
                const phone = reminderPhone(customer.phone);
                return <div className="table-actions" key={id}><span>{customer.name}: {formatMoney(pending)}</span>{phone && <a className="btn btn-secondary" href={`tel:+${phone}`}>Call</a>}<CustomerReminderButtons customer={customer} /></div>;
              })}
            </details>}
            <PaginatedList items={record.member} label={`${record.chit_name} due shares`}>
              {members => <div className="table-scroll"><ResponsiveTable>
                <thead><tr><th>Customer</th><th>Share</th><th>Due Amount</th><th>Paid</th><th>Pending</th><th>Status</th><th>Payment History</th>{!record.deletedAt && <><th>Receive Amount</th><th>Action</th></>}</tr></thead>
                <tbody>{members.map(member => <tr key={member.share_id}>
                  <td>{member.name}</td><td>{member.share_number}</td><td>{formatMoney(member.amount)}</td><td>{formatMoney(member.paid_amount)}</td><td>{formatMoney(member.pending_amount)}</td><td><span className={member.pending_amount === 0 ? "paid-badge" : "pending-badge"}>{member.paidStatus}</span></td>
                  <td><details><summary>{member.payments?.length || 0} entries</summary><PaginatedList items={[...(member.payments || [])].reverse()} label={`${member.name} share ${member.share_number} payments`}>
                    {payments => <ResponsiveTable><thead><tr><th>Date</th><th>Amount</th><th>Source</th><th>Receipt</th></tr></thead><tbody>{payments.map((p, i) => <tr key={p._id || i}><td>{p.date}</td><td>{formatMoney(p.amount)}</td><td>{p.source === "customer" ? "Customer Payment" : "Share Payment"}</td><td>{p.receipt_id ? String(p.receipt_id).slice(-8) : "Legacy"}</td></tr>)}</tbody></ResponsiveTable>}
                  </PaginatedList></details></td>
                  {!record.deletedAt && <><td><input aria-label={`Payment for ${member.name} share ${member.share_number}`} className="share-payment-input" type="number" min="0.01" max={member.pending_amount} step="0.01" disabled={busy || member.pending_amount <= 0} value={paidAmounts[member.share_id] || ""} onChange={e => { delete references.current[member.share_id]; setPaidAmounts(previous => ({ ...previous, [member.share_id]: e.target.value })); }} /></td><td><button disabled={busy || !paymentDate || !(Number(paidAmounts[member.share_id]) > 0) || Number(paidAmounts[member.share_id]) > member.pending_amount} onClick={() => receivePayment(member)}>Pay</button></td></>}
                </tr>)}</tbody>
              </ResponsiveTable></div>}
            </PaginatedList>
          </>}
        </>}
      </Modal.Body>
      <Modal.Footer>
        <button className="btn-secondary" onClick={closeDialog} disabled={busy}>{mode === "view" ? "Close" : "Cancel"}</button>
        {!loading && record && !dialogError.startsWith("Unable to load") && <>
          {mode === "edit" && <button type="submit" form="master-edit-form" disabled={busy}>{busy ? "Saving..." : "Save Changes"}</button>}
          {mode === "delete" && <button className="btn-danger-soft" onClick={deleteRecord} disabled={busy}>{busy ? "Deleting..." : "Delete Record"}</button>}
          {mode === 'permanent' && <button className="btn-danger-soft" disabled={busy} onClick={permanentlyDeleteRecord}>{busy ? 'Deleting...' : 'Permanently Delete'}</button>}
          {mode === "view" && (record.deletedAt ? <><button onClick={restoreRecord} disabled={busy}>Restore Record</button><button className="btn-danger-soft" onClick={() => { setDialogError(''); setMode('permanent'); }} disabled={busy}>Permanently Delete</button></> : <><button onClick={() => { setDialogError(""); setEditForm({ date: record.date, chit_list: record.chit_list, amount: String(record.amount) }); setMode("edit"); }} disabled={busy}>Edit Record</button><button className="btn-danger-soft" onClick={() => { setDialogError(""); setMode("delete"); }} disabled={busy}>Delete Record</button></>)}
        </>}
      </Modal.Footer>
    </Modal>
  </div>;
}
