import { useEffect, useState } from 'react';
import axios from 'axios';
import { Modal } from 'react-bootstrap';
import Footer from './Footer';
import { auth_url } from './url/url';

if (axios.defaults) {
  axios.defaults.withCredentials = true;
  axios.defaults.headers.common['X-Chit-Request'] = '1';
}

export default function AdminLogin({ children }) {
  const [user, setUser] = useState(null);
  const [checking, setChecking] = useState(true);
  const [username, setUsername] = useState('admin');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const [change, setChange] = useState(false);
  const [passwords, setPasswords] = useState({ currentPassword: '', newPassword: '', confirm: '' });
  useEffect(() => {
    let active = true;
    axios.get(`${auth_url}/session`).then(({ data }) => { if (active) setUser(data.authenticated ? data : null); })
      .catch(() => { if (active) setError('Unable to connect. Refresh to retry.'); })
      .finally(() => { if (active) setChecking(false); });
    const interceptor = axios.interceptors?.response.use(response => response, err => {
      if (active && err.response?.status === 401 && !err.config?.url?.endsWith('/login')) {
        setUser(null); setChange(false); setPassword(''); setError('Your session expired. Please log in again.');
      }
      return Promise.reject(err);
    });
    return () => { active = false; if (interceptor !== undefined) axios.interceptors.response.eject(interceptor); };
  }, []);
  const login = async event => {
    event.preventDefault(); setBusy(true); setError(''); setMessage('');
    try { const { data } = await axios.post(`${auth_url}/login`, { username: username.trim(), password }); setUser(data); setPassword(''); }
    catch (err) { setError(err.response?.data?.message || 'Unable to log in. Check the connection and retry.'); }
    finally { setBusy(false); }
  };
  const logout = async () => {
    setBusy(true); setError('');
    try { await axios.post(`${auth_url}/logout`); setUser(null); setPassword(''); setMessage('Logged out.'); }
    catch { setError('Unable to log out. Please retry.'); }
    finally { setBusy(false); }
  };
  const changePassword = async event => {
    event.preventDefault(); setError('');
    if (passwords.newPassword !== passwords.confirm) { setError('New passwords do not match.'); return; }
    setBusy(true);
    try {
      await axios.post(`${auth_url}/password`, { currentPassword: passwords.currentPassword, newPassword: passwords.newPassword });
      setUser(null); setChange(false); setPasswords({ currentPassword: '', newPassword: '', confirm: '' }); setMessage('Password changed. Log in with your new password.');
    } catch (err) { setError(err.response?.data?.message || 'Unable to change password.'); }
    finally { setBusy(false); }
  };
  if (checking) return <div className="app-shell"><main className="app-content"><p role="status">Checking login...</p></main><Footer /></div>;
  if (!user) return <div className="app-shell"><main className="app-content login-page"><form className="login-card" onSubmit={login}>
    <h1>Chit Manager</h1><h2>Admin Login</h2>
    {error && <p role="alert" className="form-error">{error}</p>}{message && <p role="status" className="success-notice">{message}</p>}
    <label htmlFor="admin-username">Username</label><input id="admin-username" autoComplete="username" maxLength="100" required value={username} onChange={e => setUsername(e.target.value)} />
    <label htmlFor="admin-password">Password</label><input id="admin-password" type="password" autoComplete="current-password" maxLength="128" required value={password} onChange={e => setPassword(e.target.value)} />
    <button disabled={busy}>{busy ? 'Logging in...' : 'Log In'}</button>
  </form></main><Footer /></div>;
  return <>
    {error && !change && <p role="alert" className="form-error">{error}</p>}
    {children({ username: user.username, logout, busy, openPassword: () => { setError(''); setPasswords({ currentPassword: '', newPassword: '', confirm: '' }); setChange(true); } })}
    <Modal show={change} onHide={() => { if (!busy) { setChange(false); setError(''); setPasswords({ currentPassword: '', newPassword: '', confirm: '' }); } }} centered className="chit-form-modal" backdrop={busy ? 'static' : true} keyboard={!busy} aria-labelledby="admin-password-title">
      <Modal.Header closeButton={!busy}><Modal.Title as="h2" id="admin-password-title">Change Password</Modal.Title></Modal.Header>
      <form onSubmit={changePassword}><Modal.Body>
        {error && <p role="alert" className="form-error">{error}</p>}
        <p className="form-hint">Use 6 to 128 characters. Changing the password signs out all sessions.</p>
        {['currentPassword', 'newPassword', 'confirm'].map((key, index) => <div key={key}><label htmlFor={`admin-${key}`}>{['Current Password', 'New Password', 'Confirm New Password'][index]}</label><input id={`admin-${key}`} type="password" autoComplete={index === 0 ? 'current-password' : 'new-password'} minLength={index === 0 ? undefined : 6} maxLength="128" required value={passwords[key]} onChange={e => setPasswords({ ...passwords, [key]: e.target.value })} /></div>)}
      </Modal.Body><Modal.Footer><button disabled={busy}>{busy ? 'Saving...' : 'Change Password'}</button></Modal.Footer></form>
    </Modal>
  </>;
}
