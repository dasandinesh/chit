import { paymentReference } from './PaymentHistory';

test('receipt references work on phone LAN HTTP without crypto.randomUUID', () => {
  const descriptor = Object.getOwnPropertyDescriptor(window, 'crypto');
  Object.defineProperty(window, 'crypto', { configurable: true, value: {
    getRandomValues: values => require('crypto').randomFillSync(values)
  } });
  try {
    const first = paymentReference(), second = paymentReference();
    expect(first).toMatch(/^[a-f0-9]{32}$/);
    expect(second).not.toBe(first);
  } finally {
    if (descriptor) Object.defineProperty(window, 'crypto', descriptor);
    else delete window.crypto;
  }
});
