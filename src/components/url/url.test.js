import { customer_get_url, customer_balance_url, chitdue_get_url } from './url';

test('default API routes stay on the same origin for localhost and mobile LAN access', () => {
  expect(customer_get_url).toBe('/api/customer');
  expect(customer_balance_url('customer-id')).toBe('/api/customer/customer-id/balance');
  expect(chitdue_get_url).toBe('/api/chitdue');
  expect(new URL(customer_get_url, 'http://192.168.0.103:3000/coustomer').href).toBe('http://192.168.0.103:3000/api/customer');
});
