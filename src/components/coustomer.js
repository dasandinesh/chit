import ResponsiveTable from "./ResponsiveTable";
import ContactImport from './ContactImport';
import CustomerReminderButtons, { reminderPhone } from "./CustomerReminderButtons";
import PaginatedList from "./PaginatedList";
import PaymentHistory, { formatMoney, localDate, paymentReference } from "./PaymentHistory";
import axios from "axios";
import React, { useCallback, useEffect, useState, useRef } from "react";
import { Modal } from "react-bootstrap";
import { customer_get_url, customer_add_url, customer_balance_url, customer_pay_url, customer_opening_url } from "./url/url";
import "./coustomer.css";

const blankCustomer = () => ({ name: "", phone: "", pending_flag: false, opening_balance: "0" });
const blankFilters = () => ({ name: "", status: "pending", moreThan: "", lessThan: "" });
const Coustomer = () => {
  const requestVersion = useRef(0);
  const linkedAction = useRef(false);
  const [customers, setCustomers] = useState([]);
  const [filters, setFilters] = useState(blankFilters);
  const [form, setForm] = useState(blankCustomer);
  const [showAdd, setShowAdd] = useState(false);
  const [showImport, setShowImport] = useState(false);
  const [dialog, setDialog] = useState(null);
  const [detail, setDetail] = useState(null);
  const [opening, setOpening] = useState("0");
  const [payment, setPayment] = useState({ amount: "", date: localDate(), reference: "" });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [pageError, setPageError] = useState("");
  const [lastReceipt, setLastReceipt] = useState(null);

  const fetchCustomers = async () => {
    try { const response = await axios.get(customer_get_url); setCustomers(response.data); setPageError(""); }
    catch { setPageError("Unable to load customers. Please refresh."); }
  };
  useEffect(() => { fetchCustomers(); }, []);

  const openCustomer = useCallback(async (customer, mode) => {
    const version = ++requestVersion.current;
    setError(""); setDetail(null); setDialog({ id: customer._id, name: customer.name, mode });
    setPayment({ amount: "", date: localDate(), reference: paymentReference() });
    try {
      const response = await axios.get(customer_balance_url(customer._id));
      if (version !== requestVersion.current) return;
      setDetail(response.data); setOpening(String(response.data.opening_balance));
    } catch { if (version === requestVersion.current) setError("Unable to load this customer's balance. Close and retry."); }
  }, []);
  useEffect(() => {
    if (linkedAction.current) return;
    const params = new URLSearchParams(window.location.search);
    const mode = params.get('action');
    if (!['view', 'pay'].includes(mode)) return;
    const customer = customers.find(row => String(row._id) === params.get('customer'));
    if (customer) { linkedAction.current = true; openCustomer(customer, mode); }
  }, [customers, openCustomer]);
  const closeDialog = () => { if (!saving) { requestVersion.current++; setDialog(null); setDetail(null); setError(""); } };
  const closeAdd = () => { if (!saving) { setShowAdd(false); setForm(blankCustomer()); setError(""); } };
  const addCustomer = async event => {
    event.preventDefault(); setSaving(true); setError("");
    try {
      await axios.post(customer_add_url, form);
      setShowAdd(false); setForm(blankCustomer()); await fetchCustomers();
    } catch (err) { setError(err.response?.data?.message || "Unable to save customer"); }
    finally { setSaving(false); }
  };
  const payCustomer = async event => {
    event.preventDefault(); setSaving(true); setError("");
    try {
      const response = await axios.post(customer_pay_url(dialog.id), payment);
      setLastReceipt(response.data.receipt); setDialog(null); setDetail(null); await fetchCustomers();
    } catch (err) { setError(err.response?.data?.message || "Unable to confirm payment. Retry with the same details to check this receipt safely."); }
    finally { setSaving(false); }
  };
  const updateOpening = async event => {
    event.preventDefault(); setSaving(true); setError("");
    try {
      await axios.patch(customer_opening_url(dialog.id), { opening_balance: opening });
      const response = await axios.get(customer_balance_url(dialog.id));
      setDetail(response.data); await fetchCustomers();
    } catch (err) { setError(err.response?.data?.message || "Unable to update opening balance"); }
    finally { setSaving(false); }
  };
  const changePayment = (key, value) => setPayment(previous => ({ ...previous, [key]: value, reference: paymentReference() }));
  const changeFilter = event => setFilters(previous => ({ ...previous, [event.target.name]: event.target.value }));
  const filteredCustomers = customers.filter(customer => {
    const pending = Math.round(Number(customer.total_pending || 0) * 100);
    return String(customer.name || "").toLowerCase().includes(filters.name.trim().toLowerCase()) &&
      (filters.status === "all" || (filters.status === "pending" ? pending > 0 : pending === 0)) &&
      (filters.moreThan === "" || pending > Math.round(Number(filters.moreThan) * 100)) &&
      (filters.lessThan === "" || pending < Math.round(Number(filters.lessThan) * 100));
  });
  const filteredPending = filteredCustomers.reduce((total, customer) => total + Math.round(Number(customer.total_pending || 0) * 100), 0) / 100;
  const preview = [];
  let remaining = Math.round(Number(payment.amount || 0) * 100);
  if (detail && remaining > 0) {
    const openingAmount = Math.min(remaining, Math.round(detail.opening_pending * 100));
    if (openingAmount > 0) { preview.push({ label: "Opening Balance", amount: openingAmount / 100 }); remaining -= openingAmount; }
    for (const share of detail.shares) {
      const applied = Math.min(remaining, Math.round(share.pending_amount * 100));
      if (applied > 0) { preview.push({ label: `${share.chit_name} / ${share.chit_list} / Share ${share.share_number} (${share.date})`, amount: applied / 100 }); remaining -= applied; }
    }
  }

  return <div>
    <div className="page-toolbar customer-toolbar">
      <h2>Customers</h2>
      <button onClick={() => { setError(""); setForm(blankCustomer()); setShowAdd(true); }}>Add Customer</button>
      <button className="btn-secondary" onClick={() => setShowImport(true)}>Import Contacts</button>
    </div>
    {showImport && <ContactImport customers={customers} onClose={() => setShowImport(false)} onImported={setCustomers} />}
    {pageError && <p role="alert" className="form-error">{pageError}</p>}
    {lastReceipt && <section className="receipt-notice" role="status">
      <strong>Payment recorded: {formatMoney(lastReceipt.amount)}</strong>
      <PaymentHistory receipts={[lastReceipt]} />
      <button className="btn-secondary" onClick={() => setLastReceipt(null)}>Dismiss</button>
    </section>}
    <section className="customer-filters" aria-label="Customer filters">
      <div className="filter-grid customer-filter-row">
        <div><label htmlFor="customer-filter-name">Customer Name</label><input id="customer-filter-name" name="name" type="search" value={filters.name} onChange={changeFilter} placeholder="Search by name" /></div>
        <div><label htmlFor="customer-filter-status">Pending Status</label><select id="customer-filter-status" name="status" value={filters.status} onChange={changeFilter}><option value="all">All Customers</option><option value="pending">Pending</option><option value="notPending">Not Pending</option></select></div>
        <div><label htmlFor="customer-filter-more">Pending More Than</label><input id="customer-filter-more" name="moreThan" type="number" min="0" step="0.01" value={filters.moreThan} onChange={changeFilter} placeholder="Amount in INR" /></div>
        <div><label htmlFor="customer-filter-less">Pending Less Than</label><input id="customer-filter-less" name="lessThan" type="number" min="0" step="0.01" value={filters.lessThan} onChange={changeFilter} placeholder="Amount in INR" /></div>
        <button type="button" className="btn-secondary" onClick={() => setFilters(blankFilters())}>Clear Filters</button>
      </div>
      <div className="customer-filter-summary">
        <p aria-live="polite">{filteredCustomers.length} of {customers.length} customers · Filtered pending: <strong>{formatMoney(filteredPending)}</strong></p>
      </div>
    </section>
    {customers.length > 0 && filteredCustomers.length === 0 && <p role="status" className="empty-list-message">No customers match these filters.</p>}
    <PaginatedList footerPagination items={filteredCustomers} label="Customers" resetKey={JSON.stringify(filters)}>
      {(pageCustomers, start) => <ResponsiveTable mobileCards={false} className="customer-list-table">
        <thead><tr><th>S.No</th><th>Name</th><th>Phone</th><th>Shares</th><th>Opening Balance</th><th>Opening Pending</th><th>Chit Pending</th><th>Total Pending</th><th>Status</th><th>Actions</th><th>Reminders</th></tr></thead>
        <tbody>{pageCustomers.map((customer, index) => <tr key={customer._id}>
          <td>{start + index + 1}</td><td>{customer.name}</td><td>{customer.phone}</td><td>{customer.total_shares}</td>
          <td>{formatMoney(customer.opening_balance)}</td><td>{formatMoney(customer.opening_pending)}</td>
          <td>{formatMoney(customer.chit_pending)}</td><td><strong>{formatMoney(customer.total_pending)}</strong></td>
          <td><span className={Number(customer.total_pending || 0) > 0 ? "pending-badge" : "paid-badge"}>{Number(customer.total_pending || 0) > 0 ? "Pending" : "Not Pending"}</span></td>
          <td><div className="table-actions">
            <button className="btn-secondary" onClick={() => openCustomer(customer, "view")}>View</button>
            <button disabled={customer.total_pending <= 0} onClick={() => openCustomer(customer, "pay")}>Pay</button>
            {reminderPhone(customer.phone) ? <a className="btn btn-secondary" href={`tel:+${reminderPhone(customer.phone)}`} aria-label={`Call ${customer.name}`}>Call</a> : <button type="button" disabled title="A valid phone number is required.">Call</button>}
          </div></td>
          <td><CustomerReminderButtons customer={customer} /></td>
        </tr>)}</tbody>
      </ResponsiveTable>}
    </PaginatedList>

    <Modal show={showAdd} onHide={closeAdd} className="chit-form-modal" centered aria-labelledby="customer-add-title" backdrop={saving ? "static" : true} keyboard={!saving}>
      <Modal.Header closeButton={!saving}><Modal.Title as="h2" id="customer-add-title">Add Customer</Modal.Title></Modal.Header>
      <form onSubmit={addCustomer}><Modal.Body>
        {error && <p role="alert" className="form-error">{error}</p>}
        <label htmlFor="customer-name">Name</label><input id="customer-name" required value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} />
        <label htmlFor="customer-phone">Phone</label><input id="customer-phone" type="tel" required value={form.phone} onChange={e => setForm({ ...form, phone: e.target.value })} />
        <label htmlFor="customer-opening">Opening Balance</label><input id="customer-opening" type="number" min="0" step="0.01" required value={form.opening_balance} onChange={e => setForm({ ...form, opening_balance: e.target.value })} />
        <label><input type="checkbox" checked={form.pending_flag} onChange={e => setForm({ ...form, pending_flag: e.target.checked })} /> Pending Flag</label>
      </Modal.Body><Modal.Footer><button type="button" className="btn-secondary" disabled={saving} onClick={closeAdd}>Cancel</button><button disabled={saving}>{saving ? "Saving..." : "Add"}</button></Modal.Footer></form>
    </Modal>

    <Modal show={!!dialog} onHide={closeDialog} className="chit-form-modal" centered aria-labelledby="customer-balance-title" backdrop={saving ? "static" : true} keyboard={!saving}>
      <Modal.Header closeButton={!saving}><Modal.Title as="h2" id="customer-balance-title">{dialog?.mode === "pay" ? "Receive Payment" : "Customer Balance"} ? {dialog?.name}</Modal.Title></Modal.Header>
      <Modal.Body>
        {error && <p role="alert" className="form-error">{error}</p>}
        {!detail && !error && <p>Loading balance...</p>}
        {detail && <>
          <div className="balance-cards"><div><span>Opening Pending</span><strong>{formatMoney(detail.opening_pending)}</strong></div><div><span>All Shares Pending</span><strong>{formatMoney(detail.chit_pending)}</strong></div><div><span>Total Pending</span><strong>{formatMoney(detail.total_pending)}</strong></div></div>
          {dialog?.mode === "pay" ? <form onSubmit={payCustomer}>
            <p className="form-hint">Payment clears opening balance first, then the oldest installments across all shares.</p>
            <label htmlFor="receipt-amount">Amount Received</label><input id="receipt-amount" type="number" min="0.01" max={detail.total_pending} step="0.01" required value={payment.amount} onChange={e => changePayment("amount", e.target.value)} />
            <label htmlFor="receipt-date">Payment Date</label><input id="receipt-date" type="date" required value={payment.date} onChange={e => changePayment("date", e.target.value)} />
            {preview.length > 0 && <><h6>Allocation Preview</h6><ResponsiveTable><thead><tr><th>Allocated To</th><th>Amount</th></tr></thead><tbody>{preview.map((item, i) => <tr key={i}><td>{item.label}</td><td>{formatMoney(item.amount)}</td></tr>)}</tbody></ResponsiveTable></>}
            {remaining > 0 && <p className="form-error">Payment exceeds the total pending balance.</p>}
            <div className="dialog-actions"><button type="button" className="btn-secondary" onClick={closeDialog} disabled={saving}>Cancel</button><button disabled={saving || !(Number(payment.amount) > 0) || remaining > 0}>{saving ? "Saving..." : "Record Payment"}</button></div>
          </form> : <>
            <form className="opening-balance-form" onSubmit={updateOpening}><label htmlFor="edit-opening">Opening Balance (original amount)</label><input id="edit-opening" type="number" min={detail.opening_paid} step="0.01" required value={opening} onChange={e => setOpening(e.target.value)} /><button disabled={saving}>{saving ? "Saving..." : "Update Opening Balance"}</button></form>
            <p className="form-hint">Opening balance paid: {formatMoney(detail.opening_paid)}. Existing customers start at zero; set their old outstanding amount here.</p>
            <h6>All Share Installments</h6>
            <PaginatedList items={detail.shares} label="Customer shares">{page => <ResponsiveTable><thead><tr><th>Chit / List</th><th>Share</th><th>Due Date</th><th>Paid</th><th>Pending</th></tr></thead><tbody>{page.map(share => <tr key={`${share.due_id}:${share.share_id}`}><td>{share.chit_name} / {share.chit_list}</td><td>{share.share_number}</td><td>{share.date}</td><td>{formatMoney(share.paid_amount)}</td><td>{formatMoney(share.pending_amount)}</td></tr>)}</tbody></ResponsiveTable>}</PaginatedList>
            <h6>Payment Allocations</h6><PaymentHistory receipts={detail.receipts} />
          </>}
        </>}
      </Modal.Body>
    </Modal>
  </div>;
};
export default Coustomer;
