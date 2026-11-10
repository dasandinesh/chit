# Chit fund management

React frontend and Express/Mongoose backend, organized like the backend in D:/market: config, routes, controller, model and middleware.

## Run locally

MongoDB must be running on port 27017. This app uses its own `chit` database; it does not use the market database.

1. Install frontend packages: `npm install`
2. Install backend packages: `npm install --prefix backend`
3. Copy `backend/config/config.env.example` to `backend/config/config.env` if missing.
4. Start the API: `npm run backend` (http://localhost:5001).
5. In a second terminal run `npm start` (http://localhost:3000).

On PowerShell systems blocking npm.ps1, use `npm.cmd` instead of `npm`.

## Configuration

Backend `config/config.env`: `DB_LOCAL_URL` (local MongoDB URI or your Atlas URI), `PORT`, `HOST`, and `CLIENT_ORIGIN` (comma-separated frontend origins). Default binding is localhost. Credentials belong only in this ignored backend file.

Frontend defaults to same-origin `/api`. During `npm start`, the package.json proxy forwards requests to http://127.0.0.1:5001, so the frontend works through both localhost and the computer's Wi-Fi IP. Keep `REACT_APP_API_URL=/api` for local/mobile development. Restart the frontend after changing proxy or environment settings. For a hosted frontend, provide an accessible HTTPS backend URL and configure CLIENT_ORIGIN accordingly. Netlify only hosts the frontend; the API needs a Node host and database.

## API

All paths have the `/api` prefix. List responses are arrays to match the existing UI.

| Method | Path | Purpose |
| --- | --- | --- |
| GET | /health | MongoDB connection status |
| GET | /customer | List customers |
| POST | /customeradd | Create customer, optionally with opening_balance |
| GET | /customer/:id/balance | Opening, all-share balances and receipt allocations |
| POST | /customer/:id/pay | Receive a payment: amount, date, unique reference |
| PATCH | /customer/:id/opening-balance | Set original opening amount (cannot be below opening amount already paid) |
| GET | /chit | List chit groups |
| POST | /chitadd | Create group |
| PUT | /chitadd/:id | Edit group |
| GET | /chitdue | List active dues; include_deleted=true also returns deleted records |
| GET | /chitdue/:id | Full installment details, balances and payment histories |
| PUT | /chitdue/:id | Edit list label, date and per-share amount |
| DELETE | /chitdue/:id | Move installment to deleted records |
| POST | /chitdue/:id/restore | Restore a deleted installment |
| POST | /chitdueadd | Create dues from the stored group members |
| GET | /dueamountunwind | List one record per due/member |
| POST | /chitdueamountupdate | Record payment using id, memberId, current_paid_amount and date |
| GET | /getaccount | List account entries |
| POST | /postcredit | Create credit/debit entry |

Balances and paid status are calculated by the API. Customers can hold multiple independent shares. Customer-wide payments clear opening balance first, then due installments ordered by due date, creation time and ID; same-date shares use their stored row order. Overpayments, negative payments, precision beyond two decimal places and duplicate due lists are rejected. Share-specific payments remain available in Chit Master and Due List.

New receipts and their individual opening/share allocations are saved atomically on the customer document. The due APIs combine legacy stored payments with these allocations and return updated paid amounts, pending amounts and payment history. Do not manually overwrite due balances from API results: the new receipt ledger is the source of truth for new payments. This works on standalone local MongoDB without requiring a replica set. Optimistic customer version checks protect concurrent payments; retry the same receipt reference and details after a network error to avoid duplicate payments. A changed balance can return HTTP 409; refresh and retry. Existing due rows and old payments are preserved; existing customers have an opening balance of zero until set through Customer > View.

Customer lists include original opening balance, remaining opening balance, all-share installment balance, total pending and registered share count. View shows per-share installments and individual receipt allocations. Chit Master shows each share's paid/pending amounts and payment history, including customer-wide allocations. Account notes remain separate manual ledger entries; receipts do not create duplicate account notes.

The API preserves existing field names such as `Tolal_amount` and `time_preiod`. Collections are customers, chits, dues and accounts. Existing remote data is not automatically migrated. SMS remains a placeholder and needs a real provider. Authentication from the market application has not been copied: this local API has no login or roles; add authentication before exposing it publicly.

## Verification

`npm run backend:test` runs an API integration test against a temporary local MongoDB database and removes that test database afterward. `npm run build` builds the frontend. The original frontend App.test.js is still the CRA starter test and needs replacement for this app.

## Chit Master management

View opens full installment details in a popup, including all customer shares, total paid/pending, receipt history and share payments. Edit changes the installment date, list label and per-share amount, preserving customer share identities and receipts. The new amount cannot be below any share's effective paid amount. Chit group and member identities are fixed on existing installments. Receipt allocation labels remain historical snapshots of the original payment.

Delete is recoverable: the installment moves to Deleted Records. Its remaining liability is excluded from Customer balances, Due List and future payment allocation; historical receipts stay intact and no refund is generated. View deleted records and choose Restore Record to reinstate outstanding balances. The original unique group/list/date combination remains reserved even after deletion.

Run this local backend as one API process: installment mutations and receipt writes share an in-process queue, with customer version checks for receipt conflicts. Multi-process hosting requires a shared database lock or MongoDB transaction strategy for concurrent installment edits and receipts.

## Responsive interface

All active list views (Customers, Chit Groups, Due List, Accounts, Chit Master and payment histories) share a responsive table component: desktop/tablet tables have local horizontal scrolling and phone screens up to 767px show labelled record cards using the same data and buttons. Navigation collapses below 992px, indicates the current route, and closes after a selection. On phones forms stack, controls use 44px touch targets and 16px inputs, pagination wraps into a compact grid, and React Bootstrap dialogs occupy the viewport with scrollable content and accessible header/footer controls. The footer supports narrow screens and safe-area insets.

Interface checks: `npm test -- --watchAll=false --runInBand --runTestsByPath src/components/ResponsiveTable.test.js src/components/Navbars.test.js src/components/chit_master.test.js src/components/add_chit.test.js src/components/coustomer.test.js src/components/PaginatedList.test.js`. Browser visual QA still requires checking phone viewport sizes; the available Computer Use connection stopped because it could not verify the current browser URL.

## Customer payment reminders

Customer rows include SMS, WhatsApp and Copy actions using the displayed Total Pending (opening remainder plus all shares). SMS opens the device composer and WhatsApp uses its official click-to-chat URL with a prefilled reminder. These actions prepare a draft; the user taps Send in the messaging app. No provider credentials or automated sending service are used. SMS text prefilling depends on the device/app; Copy copies the reminder, or displays selectable text if clipboard access is unavailable.

Ten-digit local phone numbers default to India (+91). Store an explicit international number (+country code) for other countries. Missing/invalid phone numbers and nonpositive balances disable reminders. No sent/delivered status is recorded because opening an app does not confirm delivery.

References: https://faq.whatsapp.com/5913398998672934 and https://developer.apple.com/library/archive/featuredarticles/iPhoneURLScheme_Reference/SMSLinks/SMSLinks.html

## Open on a phone on the same Wi-Fi

Keep both the frontend and backend running on the computer. Open `http://<computer-wifi-ip>:3000/coustomer` on the phone, using the network URL printed by `npm start`. The phone must not use `localhost`, since that refers to the phone itself. The frontend proxies `/api` to the loopback-only backend, so no separate backend network binding or mobile CORS exception is needed. The Wi-Fi IP may change when reconnecting to the router. For separate production hosting, explicitly configure an accessible HTTPS API URL rather than the development proxy.

Receipt reference generation supports local-network HTTP through crypto.getRandomValues when crypto.randomUUID is unavailable. Clipboard copying still uses the selectable-text fallback where clipboard access requires HTTPS.

## Home dashboard

GET /api/dashboard returns totals for customers, chit groups, registered shares (including repeated customer shares), opening pending, all-share pending, total pending, today's receipts and month-to-date receipts. Collections use payment dates in Asia/Kolkata. New customer receipts count once regardless of allocation count; explicitly dated legacy payment entries are also included. Deleted installments do not contribute remaining liability, but their historical collections are retained. Legacy balances without payment entries cannot be attributed to a collection date. Manual account notes are excluded from receipt totals.

The dashboard includes the five highest-pending customers and five most recently recorded payments. View/Pay customer links open the existing customer dialog; Call and reminder links use the saved phone and total pending. Refresh reloads all dashboard data.

Home reminders: Edit a Chit Group to select Weekly or Monthly and a First Due Date. Total Installments limits the schedule; existing groups default to Manual with no creation reminders. Monthly dates retain the original day and clamp to the last day of shorter months. The dashboard shows all missing scheduled installments and all unpaid active installments. Today comes first, followed by future dates in ascending order in India time; overdue items appear in separate paginated lists below. Creating an active installment for the same group/date clears its creation reminder; deleting it makes the reminder return. Fully settled installments leave the collection list. The dashboard refreshes every minute while visible and on window focus. These are in-app lists; SMS and WhatsApp buttons open message drafts for manual sending.


The Home page creation panel lists each chit group once with its next missing installment date, total missing count and missed count. View opens a paginated popup containing scheduled missing installments and all active created installments (including paid and off-schedule records). Today and upcoming dates come first; past installments appear separately. Manual groups show their existing records and can enable schedules through Manage Schedules. Archived records are excluded; their scheduled dates become available to create again.

Customer CSV import: Customers ? Import Contacts accepts Google Contacts CSV exports (UTF-8, up to 10,000 contacts and 10 MB). Review the paginated preview, edit names/phones/opening balances, deselect unwanted entries and press Import Selected. The first valid exported phone is used per contact. Indian local 10-digit numbers use +91; explicit international numbers are retained. Opening balance defaults to zero. Existing normalized phone numbers and duplicate numbers within the CSV are excluded. The backend checks again at save time; retries and concurrent imports in the same API process skip existing numbers. Import results show imported, duplicate and failed counts. Existing customers are never updated by import. Google sign-in is not required for this CSV workflow.

Large CSV selections save in batches of 100 with processed progress. If a batch fails, confirmed batches remain saved and the remaining selection can be retried; phone duplicate checks protect retries.


Single-admin login: All business API endpoints now require an authenticated admin session. The first server start creates exactly one admin if it does not exist. Default username is admin; a random initial password is written to backend/config/admin-login.txt (ignored by Git). Optional ADMIN_USERNAME / ADMIN_PASSWORD environment values override initial creation only; passwords must be 6 to 128 characters. Existing customers, groups, installments and balances remain shared by this single admin. There is no public registration route. Log in, use Change Password in the navigation to replace the initial password, and use Logout when finished. Initial credentials in the local file become obsolete after a password change.

Passwords use salted scrypt hashes; MongoDB sessions store hashes of random tokens, expire after 8 hours, and persist across server restarts. Password changes revoke every existing session. API writes require the X-Chit-Request header (the app sets it automatically); login attempts are limited to 10 per 15 minutes per API client IP. For an HTTPS deployment set COOKIE_SECURE=true, configure CLIENT_ORIGIN to the actual frontend origin and serve the frontend/API on the same site. The localhost/LAN development proxy uses HTTP with HTTP-only SameSite=Strict cookies. Do not publish backend/config/admin-login.txt or backend/config/config.env.

Chit Groups now has a Delete action with a confirmation popup. Only active Chit Master records prevent group deletion. Groups with only deleted installments are archived out of the list; their installment and payment history is retained. Restoring an installment restores its group. Customers and their opening balances are retained. Group deletion and installment creation are serialized in the local API process to prevent creating an installment for a concurrently removed group.

Deleted Chit Master installments can be permanently removed through Deleted Records ? View ? Permanently Delete ? confirmation. Only archived installments without any recorded payment or receipt allocation can be purged. This cannot be undone and releases the group/list/date unique key so the installment can be created again. Installments with payments must be restored or edited instead. Ordinary Delete still archives records for recovery.

Home ? All Installments also supports Delete for Not Created rows. This stores that date in the group's skipped_dates, removing only that scheduled occurrence from creation reminders and the popup after refresh. Other installment numbers/dates are unchanged. Existing Chit Master records are never deleted by this schedule action; a date that already has an active installment must use the created-record Delete action. An explicit manual installment created later remains visible even on a skipped date.
