# API Order Requirements (Mobile App)

Purpose: concise checklist for backend engineers describing the exact endpoints, request/response shapes, push payloads, WS envelopes and QA items required so the mobile app's order popup and flows work reliably.

---

## Auth & Headers
- All protected endpoints must accept `Authorization: Bearer <token>` header.
- Requests from the app include `Content-Type: application/json` and `Accept: application/json`.
- Mobile client stores token under `vendor_token` (and legacy `authToken`); both should be valid tokens.

---

## Minimal Order Object (fields the mobile app expects)
Provide the order object with these fields (tolerant alternatives accepted):

- `id` (string) — alternatives: `orderId`, `order_id`, `_id`
- `customerName` (string) — alternatives: `customer_name`, `customer`
- `customerPhone` (string) — optional; alternatives: `customer_phone`
- `amount` (number) — alternatives: `total`, `price`, `totalAmount`
- `status` (string) — expected values: `assigned`, `accepted`, `rejected`, `in_progress`, `payment_requested`, `payment_confirmed`, `arrival_confirmed`, `completed`, `cancelled`
- `items` (array) — optional, each item: `{ name, quantity, price }`
- `pickup` / `pickupAddress` / `pickup_address` — object: `{ address | street, city, lat | latitude, lng | longitude }`
- `drop` / `dropAddress` / `drop_address` / `delivery` — same shape as pickup
- `createdAt` (ISO string or epoch) — optional but helpful
- Any additional fields should be returned; the client stores them under `raw` for UI fallbacks (e.g., `fare`, `paymentMethod`, `notes`).

---

## Endpoints & Examples

### GET single order
- `GET /api/orders/{orderId}`
- Acceptable successful (200) response shapes:
  1) Direct object: `{ ...order... }`
  2) Wrapped: `{ "order": { ...order... } }`
  3) Wrapped: `{ "data": { ...order... } }`

Example response (minimal):
```json
{ "order": {
  "id": "ord_12345",
  "customerName": "Alice",
  "amount": 150.00,
  "status": "assigned",
  "items": [{"name":"Burger","quantity":1,"price":150}],
  "pickup": {"address":"Shop A","city":"Mumbai","lat":19.07,"lng":72.88},
  "drop": {"address":"Home","city":"Mumbai","lat":19.08,"lng":72.89},
  "createdAt": "2025-12-04T10:00:00Z"
}}
```

---

### GET orders list / assigned
- `GET /api/orders?page=X&per_page=Y&status=assigned` — used by fallback polling.
- `GET /api/orders` may also return list in `data`, `orders`, `results`, or raw list — mobile client is tolerant.

### Fetchlist (UI pagination)
- `GET /api/orders/fetchlist?page=X&limit=Y&status=Z` — expected JSON:
```json
{ "ok": true, "limit": 10, "offset": 0, "rows": [ ...orders... ], "returned": 10, "remaining": 0 }
```
- `rows` are parsed into `Order` objects; `remaining` used to compute `hasMore`.

---

### Accept order
- `POST /api/orders/{orderId}/accept`
- Request: no body required
- Success (200): return updated order object (any accepted wrapper form)

Example:
```json
{ "order": { "id":"ord_12345", "status":"accepted", "acceptedAt":"2025-12-04T10:00:10Z" } }
```

---

### Reject order
- `POST /api/orders/{orderId}/reject`
- Request body: `{ "reason": "<text>" }`
- Success (200): return updated order (status `rejected`, include rejection reason)

Example:
```json
{ "order": { "id":"ord_12345", "status":"rejected", "rejection_reason":"Too far" } }
```

---

### Other order actions
- `POST /api/orders/{orderId}/start` → returns updated order
- `POST /api/orders/{orderId}/complete` → returns updated order
- `POST /api/orders/{orderId}/cancel` body `{ reason }` → returns updated order
- `POST /api/orders/{orderId}/payment-request` body `{ amount, currency?, notes?, autoConfirm? }` → returns PaymentRequestResponse
- `POST /api/orders/{orderId}/request-otp` and `POST /api/orders/{orderId}/verify-otp` → OTP flows

Return 200 with expected object for success; non-200 should return JSON error (`message` or `error`).

---

## Push (FCM) payloads — what triggers the popup
- The mobile app requires a data payload containing an order identifier. Minimal data:
```json
{ "data": { "orderId": "ord_12345" }, "priority": "high" }
```
- The app will call `GET /api/orders/{orderId}` upon receipt — so only `orderId` is required.
- Optional: include small `short` or `order` preview, but server must still provide the full GET endpoint.

Notification tap example:
```json
{ "notification": { "title":"New order assigned", "body":"Order #ord_12345" }, "data": { "orderId":"ord_12345" } }
```

---

## WebSocket envelope (if using WS)
- WS path client uses in dashboard: `/ws/orders?token=<token>` (wss for https)
- Accepted envelopes:
```json
{ "type": "order", "payload": { ...order... } }
```
or
```json
{ "order": { ...order... } }
```
- If server sends order via WS, the client will refresh recent orders or handle the order depending on envelope.

---

## Error format & status codes
- Use JSON bodies for errors with `message` or `error` keys: `{ "ok": false, "error": "invalid_request", "message": "Reason" }`
- HTTP codes: 200 success, 400 bad request, 401 unauthorized, 404 not found, 500 server error.
- For 401 responses, the client expects authentication/reauth flows to be triggered.

---

## QA checklist (backend must validate)
- [ ] `GET /api/orders/{id}` returns order object (one of the tolerated shapes) and includes `id`, `status`, and either `amount` or `items` and at least one address (pickup or drop).
- [ ] `POST /api/orders/{id}/accept` returns 200 and updated order with `status: "accepted"`.
- [ ] `POST /api/orders/{id}/reject` accepts `{ reason }` and returns 200 with `status: "rejected"` and rejection reason.
- [ ] `GET /api/orders?status=assigned` returns assigned orders for the authenticated vendor (used in polling).
- [ ] `GET /api/orders/fetchlist` returns `{ ok, limit, offset, rows, returned, remaining }`.
- [ ] FCM data messages include `orderId` so mobile can fetch full order.
- [ ] WS `/ws/orders?token=` (if used) can push orders with `type: "order" payload: {...}` envelope.
- [ ] Error responses are JSON with `message`/`error` fields.

---

## Quick cURL examples
- Fetch order:
```bash
curl -H "Authorization: Bearer <token>" \
  https://YOUR_API/api/orders/ord_12345
```

- Accept order:
```bash
curl -X POST -H "Authorization: Bearer <token>" \
  https://YOUR_API/api/orders/ord_12345/accept
```

- Reject order:
```bash
curl -X POST -H "Content-Type: application/json" -H "Authorization: Bearer <token>" \
  -d '{"reason":"Too far"}' https://YOUR_API/api/orders/ord_12345/reject
```

---

If you'd like, I can also:
- Add this file to the repo root (done) and link it to a PR, or
- Add more concrete contract tests or Postman/curl collection for backend verification.

