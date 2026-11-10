const crypto = require('node:crypto');
const { promisify } = require('node:util');
const mongoose = require('mongoose');
const scrypt = promisify(crypto.scrypt);
const Admin = mongoose.model('Admin', new mongoose.Schema({
  _id: { type: String, default: 'admin', enum: ['admin'] }, username: { type: String, required: true },
  passwordHash: { type: String, required: true }, version: { type: Number, default: 0 }
}));
const Session = mongoose.model('AdminSession', new mongoose.Schema({
  _id: String, version: Number, expiresAt: { type: Date, index: { expires: 0 } }
}));
const hashToken = token => crypto.createHash('sha256').update(token).digest('hex');
async function hashPassword(password) {
  const salt = crypto.randomBytes(16).toString('hex');
  const key = await scrypt(password, salt, 64);
  return `${salt}:${key.toString('hex')}`;
}
async function verifyPassword(password, hash) {
  const [salt, hex] = hash.split(':');
  const key = await scrypt(password, salt, 64);
  const expected = Buffer.from(hex, 'hex');
  return expected.length === key.length && crypto.timingSafeEqual(expected, key);
}
function passwordValid(value) { return typeof value === 'string' && value.length >= 6 && value.length <= 128; }
function token(req) {
  return (req.headers.cookie || '').split(';').map(c => c.trim()).find(c => c.startsWith('chit_session='))?.slice(13) || '';
}
const cookieOptions = () => ({ httpOnly: true, sameSite: 'strict', secure: process.env.COOKIE_SECURE === 'true', path: '/api' });
function clearCookie(res) { res.clearCookie('chit_session', cookieOptions()); }
async function authenticate(req) {
  const value = token(req);
  if (!/^[a-f0-9]{64}$/.test(value)) return null;
  const [session, admin] = await Promise.all([Session.findById(hashToken(value)).lean(), Admin.findById('admin').lean()]);
  if (!session || !admin || session.expiresAt <= new Date() || session.version !== admin.version) return null;
  return admin;
}
const wrap = handler => (req, res, next) => Promise.resolve(handler(req, res, next)).catch(next);
const requireAdmin = wrap(async (req, res, next) => {
  req.admin = await authenticate(req);
  if (!req.admin) return res.status(401).json({ message: 'Please log in.' });
  next();
});
function protectWrites(req, res, next) {
  if (!['GET', 'HEAD', 'OPTIONS'].includes(req.method) && req.get('X-Chit-Request') !== '1') return res.status(403).json({ message: 'Invalid request. Refresh the application.' });
  next();
}
const attempts = new Map();
function rateLimit(req, res, next) {
  const now = Date.now(), key = req.ip;
  for (const [ip, attempt] of attempts) if (attempt.until <= now) attempts.delete(ip);
  const attempt = attempts.get(key) || { count: 0, until: now + 15 * 60 * 1000 };
  if (attempt.count >= 10 || attempts.size >= 5000) return res.status(429).json({ message: 'Too many attempts. Try again in 15 minutes.' });
  attempt.count++; attempts.set(key, attempt); next();
}
const router = require('express').Router();
router.get('/session', wrap(async (req, res) => {
  const admin = await authenticate(req);
  res.json({ authenticated: !!admin, ...(admin ? { username: admin.username } : {}) });
}));
router.post('/login', protectWrites, rateLimit, wrap(async (req, res) => {
  const { username, password } = req.body;
  const admin = await Admin.findById('admin');
  if (typeof password !== 'string' || password.length > 128 || !admin) return res.status(401).json({ message: 'Invalid username or password.' });
  const valid = await verifyPassword(password, admin.passwordHash);
  if (!valid || username !== admin.username) return res.status(401).json({ message: 'Invalid username or password.' });
  attempts.delete(req.ip);
  if (token(req)) await Session.deleteOne({ _id: hashToken(token(req)) });
  const value = crypto.randomBytes(32).toString('hex');
  await Session.create({ _id: hashToken(value), version: admin.version, expiresAt: new Date(Date.now() + 8 * 60 * 60 * 1000) });
  res.cookie('chit_session', value, { ...cookieOptions(), maxAge: 8 * 60 * 60 * 1000 });
  res.json({ authenticated: true, username: admin.username });
}));
router.post('/logout', protectWrites, wrap(async (req, res) => {
  if (token(req)) await Session.deleteOne({ _id: hashToken(token(req)) });
  clearCookie(res); res.json({ message: 'Logged out.' });
}));
router.post('/password', protectWrites, requireAdmin, rateLimit, wrap(async (req, res) => {
  const { currentPassword, newPassword } = req.body;
  if (!passwordValid(newPassword)) return res.status(400).json({ message: 'Use a password between 6 and 128 characters.' });
  if (typeof currentPassword !== 'string' || currentPassword.length > 128 || !(await verifyPassword(currentPassword, req.admin.passwordHash))) return res.status(400).json({ message: 'Current password is incorrect.' });
  const updated = await Admin.updateOne({ _id: 'admin', version: req.admin.version }, { $set: { passwordHash: await hashPassword(newPassword) }, $inc: { version: 1 } });
  if (!updated.modifiedCount) return res.status(409).json({ message: 'Password changed elsewhere. Log in again.' });
  clearCookie(res); attempts.delete(req.ip);
  res.json({ message: 'Password changed. Log in with your new password.' });
}));
module.exports = { Admin, Session, hashPassword, passwordValid, router, requireAdmin, protectWrites };
