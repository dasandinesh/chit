import { useEffect, useState } from 'react';

// Ten-digit local numbers use India's country code; explicit international numbers keep theirs.
export function reminderPhone(value) {
  const raw = String(value || '').trim();
  if (!raw || !/^\+?[\d\s().-]+$/.test(raw)) return null;
  const international = raw.startsWith('+') || raw.startsWith('00');
  let digits = raw.replace(/\D/g, '');
  if (raw.startsWith('00')) digits = digits.slice(2);
  if (!international && digits.length === 11 && digits.startsWith('0')) digits = digits.slice(1);
  if (!international && digits.length === 10) digits = `91${digits}`;
  return /^[1-9]\d{7,14}$/.test(digits) ? digits : null;
}

export function reminderMessage(amount) {
  const value = Number(amount);
  const display = Number.isInteger(value) ? String(value) : value.toFixed(2);
  return `You have a pending amount of Rs. ${display}. Please pay your pending amount. Thank you.`;
}

export function smsLink(phone, message, ios) {
  return `sms:+${phone}${ios ? '&' : '?'}body=${encodeURIComponent(message)}`;
}

export default function CustomerReminderButtons({ customer }) {
  const [copied, setCopied] = useState(false);
  const [showText, setShowText] = useState(false);
  const phone = reminderPhone(customer.phone);
  const pending = Number(customer.total_pending);
  const enabled = phone && Number.isFinite(pending) && pending > 0;
  const reason = !phone ? 'A valid phone number is required.' : 'No pending amount to remind.';
  const message = enabled ? reminderMessage(pending) : '';
  useEffect(() => { setCopied(false); setShowText(false); }, [message, phone]);
  const ios = /iPad|iPhone|iPod/i.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);

  const copyMessage = async () => {
    try {
      await navigator.clipboard.writeText(message);
      setCopied(true);
    } catch { setShowText(true); }
  };
  return <div className="customer-reminders">
    <div className="reminder-actions">
      {enabled ? <>
        <a className="btn btn-sms" href={smsLink(phone, message, ios)} aria-label={`SMS reminder to ${customer.name}`} title={message}>SMS</a>
        <a className="btn btn-whatsapp" href={`https://wa.me/${phone}?text=${encodeURIComponent(message)}`} target="_blank" rel="noopener noreferrer" aria-label={`WhatsApp reminder to ${customer.name}`} title={message}>WhatsApp</a>
        <button type="button" className="btn-secondary" onClick={copyMessage} aria-label={`Copy reminder for ${customer.name}`}>{copied ? 'Copied' : 'Copy'}</button>
      </> : <>
        <button type="button" className="btn-sms" disabled title={reason}>SMS</button>
        <button type="button" className="btn-whatsapp" disabled title={reason}>WhatsApp</button>
      </>}
    </div>
    {!enabled && !phone && <span className="reminder-help">{reason}</span>}
    {copied && <span className="reminder-help" role="status">Message copied. You can paste it in your messaging app.</span>}
    {showText && <textarea className="reminder-copy-text" aria-label={`Reminder text for ${customer.name}`} rows={3} autoFocus readOnly value={message} onFocus={event => event.target.select()} />}
  </div>;
}
