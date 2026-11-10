import { useMemo, useRef, useState } from 'react';
import { Modal } from 'react-bootstrap';
import axios from 'axios';
import { parseContactCsv, reviewContacts } from '../utils/contactCsv';
import { customer_get_url, customer_import_url } from './url/url';
import PaginatedList from './PaginatedList';
import ResponsiveTable from './ResponsiveTable';

export default function ContactImport({ customers, onClose, onImported }) {
  const [rows, setRows] = useState([]);
  const [selected, setSelected] = useState(new Set());
  const [existing, setExisting] = useState(customers);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [progress, setProgress] = useState(null);
  const reading = useRef(0);
  const reviewed = useMemo(() => reviewContacts(rows, existing), [rows, existing]);
  const eligible = reviewed.filter(row => !row.issue);
  const chosen = eligible.filter(row => selected.has(row.id));
  const close = () => { if (!busy) { reading.current++; onClose(); } };
  const readFile = event => {
    const file = event.target.files?.[0];
    const version = ++reading.current;
    setRows([]); setSelected(new Set()); setError(''); setMessage(''); setProgress(null);
    if (!file) return;
    if (file.size > 10 * 1024 * 1024) { setError('Choose a CSV file no larger than 10 MB.'); return; }
    const reader = new FileReader();
    reader.onload = () => {
      if (version !== reading.current) return;
      try {
        const contacts = parseContactCsv(reader.result);
        setRows(contacts);
        setSelected(new Set(reviewContacts(contacts, existing).filter(row => !row.issue).map(row => row.id)));
      } catch (err) { setError(err.message); }
    };
    reader.onerror = () => { if (version === reading.current) setError('Unable to read this file. Choose it again.'); };
    reader.readAsText(file, 'UTF-8');
  };
  const change = (id, field, value) => {
    setRows(previous => previous.map(row => row.id === id ? { ...row, [field]: value } : row));
    setMessage('');
  };
  const importSelected = async () => {
    if (!chosen.length || busy) return;
    setBusy(true); setError(''); setMessage('');
    const totals = { imported: 0, duplicates: 0, failed: 0, processed: 0, total: chosen.length };
    setProgress({ ...totals });
    try {
      // Keep requests below the API body limit, including Unicode contact names.
      for (let start = 0; start < chosen.length; start += 100) {
        const batch = chosen.slice(start, start + 100);
        const response = await axios.post(customer_import_url, { contacts: batch.map(row => ({ name: row.name.trim(), phone: `+${row.normalizedPhone}`, opening_balance: row.opening_balance })) });
        const result = response.data;
        totals.imported += result.imported; totals.duplicates += result.duplicates; totals.failed += result.failed; totals.processed += batch.length;
        const saved = new Set(result.results.filter(r => ['imported', 'duplicate'].includes(r.status)).map(r => batch[r.index]?.id));
        setRows(previous => previous.filter(row => !saved.has(row.id)));
        setSelected(previous => new Set([...previous].filter(id => !saved.has(id))));
        setProgress({ ...totals });
      }
    } catch (err) {
      setError(err.response?.data?.message || 'Import stopped. Retry safely: saved batches are kept and existing phone numbers are skipped.');
    } finally {
      setMessage(`${totals.imported} imported; ${totals.duplicates} duplicates skipped; ${totals.failed} could not be imported. ${totals.processed} of ${totals.total} processed.`);
      try {
        const fresh = await axios.get(customer_get_url);
        setExisting(fresh.data); onImported(fresh.data);
      } catch { setError(previous => `${previous ? `${previous} ` : ''}Unable to refresh customers. Refresh the page to see saved contacts.`); }
      setBusy(false);
    }
  };
  return <Modal show onHide={close} centered size="lg" className="chit-form-modal contact-import-modal" aria-labelledby="contact-import-title" backdrop={busy ? 'static' : true} keyboard={!busy}>
    <Modal.Header closeButton={!busy}><Modal.Title as="h2" id="contact-import-title">Import Google Contacts</Modal.Title></Modal.Header>
    <Modal.Body>
      <p className="form-hint">In Google Contacts, select contacts → Export → Google CSV. Choose that file below (up to 10,000 contacts, 10 MB). Review and select the customers to add. Large imports save automatically in batches of 100.</p>
      <p className="form-hint">The first valid phone is used. Indian 10-digit numbers use +91. Opening balances start at 0 and can be edited. Existing customers are not changed.</p>
      <label htmlFor="google-contacts-file">Google CSV file</label><input id="google-contacts-file" type="file" accept=".csv,text/csv" disabled={busy} onChange={readFile} />
      {error && <p role="alert" className="form-error">{error}</p>}
      {message && <p role="status" className="success-notice">{message}</p>}
      {progress && <div className="contact-import-progress"><progress aria-label="Contact import progress" value={progress.processed} max={progress.total} /><span>{progress.processed} / {progress.total} processed</span></div>}
      {!!rows.length && <>
        <div className="table-actions"><button type="button" className="btn-secondary" disabled={busy} onClick={() => setSelected(new Set(eligible.map(row => row.id)))}>Select valid</button><button type="button" className="btn-secondary" disabled={busy} onClick={() => setSelected(new Set())}>Clear selection</button><span aria-live="polite">{chosen.length} selected / {rows.length} contacts</span></div>
        <PaginatedList items={reviewed} label="Contact import preview">{page => <ResponsiveTable mobileCards={false} className="compact-list-table">
          <thead><tr><th>Select</th><th>Name</th><th>Phone</th><th>Opening Balance</th><th>Status</th></tr></thead>
          <tbody>{page.map(row => <tr key={row.id}>
            <td><input type="checkbox" aria-label={`Select contact ${row.id + 1}`} disabled={busy || !!row.issue} checked={!row.issue && selected.has(row.id)} onChange={e => setSelected(previous => { const next = new Set(previous); e.target.checked ? next.add(row.id) : next.delete(row.id); return next; })} /></td>
            <td><input aria-label={`Name for contact ${row.id + 1}`} placeholder="Enter customer name" maxLength="150" disabled={busy} value={row.name} onChange={e => change(row.id, 'name', e.target.value)} /></td>
            <td><input aria-label={`Phone for contact ${row.id + 1}`} type="tel" disabled={busy} value={row.phone} onChange={e => change(row.id, 'phone', e.target.value)} /></td>
            <td><input aria-label={`Opening balance for contact ${row.id + 1}`} type="number" min="0" step="0.01" disabled={busy} value={row.opening_balance} onChange={e => change(row.id, 'opening_balance', e.target.value)} /></td>
            <td>{row.issue || 'Ready'}</td>
          </tr>)}</tbody>
        </ResponsiveTable>}</PaginatedList>
      </>}
    </Modal.Body>
    <Modal.Footer><button className="btn-secondary" disabled={busy} onClick={close}>Close</button><button disabled={busy || !chosen.length} onClick={importSelected}>{busy ? 'Importing...' : `Import Selected (${chosen.length})`}</button></Modal.Footer>
  </Modal>;
}
