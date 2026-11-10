module.exports = function contactPhone(value) {
  const raw = String(value || '').trim();
  if (!raw || !/^\+?[\d\s().-]+$/.test(raw)) return null;
  const international = raw.startsWith('+') || raw.startsWith('00');
  let digits = raw.replace(/\D/g, '');
  if (raw.startsWith('00')) digits = digits.slice(2);
  if (!international && digits.length === 11 && digits.startsWith('0')) digits = digits.slice(1);
  if (!international && digits.length === 10) digits = `91${digits}`;
  return /^[1-9]\d{7,14}$/.test(digits) ? digits : null;
};
