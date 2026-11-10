// Use the frontend's origin on both localhost and a phone on the local network.
// The development server forwards /api to the local backend through package.json's proxy.
const API_URL = (process.env.REACT_APP_API_URL || '/api').replace(/\/$/, '');
export const auth_url = `${API_URL}/auth`;
export const dashboard_url = `${API_URL}/dashboard`;
export const chit_get_url = `${API_URL}/chit`;
export const chit_add_url = `${API_URL}/chitadd`;
export const customer_get_url = `${API_URL}/customer`;
export const customer_add_url = `${API_URL}/customeradd`;
export const customer_import_url = `${API_URL}/customer/import`;
export const customer_balance_url = id => `${API_URL}/customer/${id}/balance`;
export const customer_pay_url = id => `${API_URL}/customer/${id}/pay`;
export const customer_opening_url = id => `${API_URL}/customer/${id}/opening-balance`;
export const chitdue_get_url = `${API_URL}/chitdue`;
export const chitdue_detail_url = id => `${API_URL}/chitdue/${id}`;
export const chitdue_add_url = `${API_URL}/chitdueadd`;
export const due = `${API_URL}/chitdue`;
export const chitdue_amount_update_url = `${API_URL}/chitdueamountupdate`;
export const dueamountunwind_url = `${API_URL}/dueamountunwind`;
export const getaccount_url = `${API_URL}/getaccount`;
export const postcredit_url = `${API_URL}/postcredit`;
