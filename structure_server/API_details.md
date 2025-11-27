# API Reference (Complete)

This document lists every HTTP endpoint exposed by the server, with descriptions, parameters, and runnable examples (curl, Node.js, and Dart). It includes the backend-to-backend proxy endpoints and operational notes for testing locally and from an Android emulator.

---

## Quick Notes
- Authentication: most protected endpoints require a JWT sent as `Authorization: Bearer <token>`.
- Local emulator: use `http://10.0.2.2:3000` from Android emulator to reach a local server.
- Proxy endpoints: require `x-internal-key: <INTERNAL_API_KEY>` header. This key must remain secret and only be used by trusted backends.

## Environment variables
- `MONGO_URI` — MongoDB connection string (required)
- `JWT_SECRET` — JWT signing secret used by this server
- `PORT` — server port (default `3000`)
- `INTERNAL_API_KEY` — secret for backend-to-backend proxy endpoints
- `ENABLE_MOCK_ORDERS` — enable dev mock order endpoints (default false)

---

## Root & Health

- `GET /`
  - Returns server info and basic endpoints

- `GET /health`
  - Health check. Returns 200 when healthy.

---

## Authentication

- `POST /api/auth/send-otp`
  - Purpose: request an OTP for a phone number (dev-only OTP store may return code in response).
  - Body: `{ "phone": "+919999999999" }`

- `POST /api/auth/verify-otp`
  - Purpose: verify OTP and obtain a JWT for subsequent requests.
  - Body: `{ "phone": "+919999999999", "code": "123456" }`
  - Success: `{ "ok": true, "token": "<JWT>", "vendorId": "<id>" }`

Example curl:
```
curl -X POST http://localhost:3000/api/auth/verify-otp \
  -H "Content-Type: application/json" \
  -d '{"phone":"+919999999999","code":"123456"}'
```

---

## Vendors

- `POST /api/vendors`
  - Create a vendor. Accepts `multipart/form-data` for profile images.

- `GET /api/vendors/me`
  - Get current vendor profile. Requires `Authorization`.

- `PATCH /api/vendors/me`
  - Update current vendor profile. Requires `Authorization`.

- `POST /api/vendors/me/fcm-token`
  - Register FCM token for push notifications.

- `DELETE /api/vendors/me/fcm-token`
  - Remove an FCM token.

---

## Presence

- `POST /api/vendors/me/presence`
  - Update online/offline presence and optionally location. Requires `Authorization`.
  - Example body: `{ "online": true, "lat": 12.34, "lng": 56.78 }`

- `GET /api/vendors/me/presence`
  - Retrieve the authenticated vendor's presence record.

- `GET /api/vendors/presence/online`
  - Get list of online vendors. Requires `Authorization`.

- `GET /api/vendors/presence/nearby?lat=&lng=&maxDistance=`
  - Find vendors near a coordinate. Query params: `lat`, `lng`, optional `maxDistance` (meters).

---

## Work Types

- `GET /api/work-types`
  - Public endpoint returning available work/service types.

---

## Orders

These endpoints support the vendor order lifecycle and payment flow.

- `GET /api/orders`
  - List orders assigned to the authenticated vendor.
  - Pagination via `page`/`limit` or `offset`/`limit`.

- `GET /api/orders/:id`
  - Retrieve order details by ID.

- `POST /api/orders/:id/accept`
  - Accept an assigned order. Requires `Authorization`.

- `POST /api/orders/:id/reject`
  - Reject an assigned order.

- `POST /api/orders/:id/start`
  - Mark an accepted order as started.

- `POST /api/orders/:id/complete`
  - Complete an in-progress order.

- `POST /api/orders/:id/cancel`
  - Cancel an order (following business rules).

- `PATCH /api/orders/:id/fare`
  - Update canonical fare for the order.
  - Important: the server blocks fare updates when the order has status `paid` — other statuses allow updates.
  - Body example: `{ "fare": 200 }`

- `POST /api/orders/:id/payment-request`
  - Create a payment request for this order. If `amount` is omitted the server will use `order.fare`.
  - Body fields:
    - `amount` (number, optional): override the fare amount
    - `currency` (string, optional): default `INR`
    - `autoConfirm` (boolean, optional): dev-only: immediately confirms the payment request
  - Success (created):
    ```json
    { "ok": true, "paymentRequestId": "<uuid>", "autoConfirmed": false }
    ```
  - Auto-confirm (dev): returns `autoConfirmed: true` and `paymentRequest` object including `confirmedAt` timestamp.
  - Common errors: `400 invalid_amount`, `404 order_not_found`, `401 unauthorized`.

- `POST /api/orders/:id/request-otp`
  - Generate and send OTP for arrival or completion verification.
  - Body: `{ "purpose": "arrival" | "completion", "ttlSeconds": 300 }`

- `POST /api/orders/:id/verify-otp`
  - Verify OTP and update order status accordingly.
  - Body: `{ "otp": "123456", "purpose": "arrival" }`

Example: create a payment request (curl)
```
curl -X POST "http://localhost:3000/api/orders/507f1f77bcf86cd799439011/payment-request" \
  -H "Authorization: Bearer <JWT>" \
  -H "Content-Type: application/json" \
  -d '{"amount":150, "currency":"INR"}'
```

---

## Earnings

- `GET /api/earnings/summary`
  - Aggregated earnings summary for the authenticated vendor.
  - Query params: `start`, `end` (ISO dates), `tz` (optional), admin-only `vendorId` override.
  - Response example:
    ```json
    { "ok": true, "summary": { "currency":"INR", "totalToday":150.00, "totalMonth":1250.50, "totalAllTime":15750.75, "pending":200.00 } }
    ```

- `GET /api/earnings/history`
  - Paginated list of confirmed payment requests.
  - Query params: `from`, `to`, `limit` (default 50, max 200), `offset`, or `page`/`perPage`.
  - Sorted by `confirmedAt` descending.

Example: earnings summary (curl)
```
curl -H "Authorization: Bearer <JWT>" "http://localhost:3000/api/earnings/summary"
```

---

## Vendor location

- `POST /api/vendor/location`
  - Store vendor location history. Requires `Authorization`.

---

## Development / Mock endpoints (dev-only)

These are only mounted when `ENABLE_MOCK_ORDERS=true`.

- `POST /api/dev/orders/mock`
  - Create a mock order for testing. Requires `x-dev-key` header validated against `config.mockOrdersSecret`.

- `GET /api/dev/orders/stats`
  - Return stats for mock order usage. Requires `x-dev-key`.

---

## Backend-to-backend Proxy endpoints

These endpoints allow a trusted backend (holding `INTERNAL_API_KEY`) to query vendor data without exposing admin keys to client apps.

- `POST /api/proxy/earnings/summary`
  - Headers: `x-internal-key: <INTERNAL_API_KEY>`
  - Body: JSON with the same query parameters the target endpoint accepts, e.g. `{ "vendorId": "<id>", "start": "2025-11-01", "end": "2025-11-30" }`

- `POST /api/proxy/earnings/history`
  - Same contract: `x-internal-key` required and JSON body with filters/pagination.

Proxy example (curl):
```
curl -X POST "https://your-server.example.com/api/proxy/earnings/summary" \
  -H "Content-Type: application/json" \
  -H "x-internal-key: ${INTERNAL_API_KEY}" \
  -d '{"vendorId":"6926df56ae18dd54a9b00814","start":"2025-11-01","end":"2025-11-30"}'
```

Security note: do not embed `INTERNAL_API_KEY` in client apps. It must be stored server-side.

---

## Request/Response Examples

1) Verify OTP (curl)
```
curl -X POST http://localhost:3000/api/auth/verify-otp \
  -H "Content-Type: application/json" \
  -d '{"phone":"+919999999999","code":"123456"}'
```

Response:
```json
{ "ok": true, "token": "<JWT>", "vendorId": "6926df56ae18dd54a9b00814" }
```

2) Create vendor (curl, multipart)
```
curl -X POST http://localhost:3000/api/vendors \
  -F "name=Test Vendor" \
  -F "phone=+919999999999" \
  -F "profileImage=@./avatar.jpg"
```

3) Update fare (curl)
```
curl -X PATCH http://localhost:3000/api/orders/507f1f77bcf86cd799439011/fare \
  -H "Authorization: Bearer <JWT>" \
  -H "Content-Type: application/json" \
  -d '{"fare": 250}'
```

4) Create payment request (curl)
```
curl -X POST "http://localhost:3000/api/orders/507f1f77bcf86cd799439011/payment-request" \
  -H "Authorization: Bearer <JWT>" \
  -H "Content-Type: application/json" \
  -d '{"amount":150, "currency":"INR"}'
```

---

## SDK snippets

Node.js (payment-request):
```js
const fetch = require('node-fetch');
async function createPayment(orderId, jwt){
  const res = await fetch(`http://localhost:3000/api/orders/${orderId}/payment-request`,{
    method:'POST',
    headers:{ 'Authorization':`Bearer ${jwt}`, 'Content-Type':'application/json' },
    body: JSON.stringify({ amount:150 })
  });
  return res.json();
}
```

Proxy (Node.js):
```js
const fetch = require('node-fetch');
async function proxyEarningsSummary(internalKey, payload){
  const res = await fetch('https://your-server.example.com/api/proxy/earnings/summary',{
    method:'POST',
    headers:{ 'Content-Type':'application/json', 'x-internal-key': internalKey },
    body: JSON.stringify(payload)
  });
  return res.json();
}
```

Flutter (Dart) (payment-request):
```dart
import 'dart:convert';
import 'package:http/http.dart' as http;

Future<void> createPayment(String orderId, String jwt) async {
  final uri = Uri.parse('https://your-server.example.com/api/orders/$orderId/payment-request');
  final resp = await http.post(uri, headers: {
    'Authorization': 'Bearer $jwt',
    'Content-Type': 'application/json',
  }, body: jsonEncode({'amount':150}));

  if (resp.statusCode == 200) print(resp.body);
  else print('Error: ${resp.statusCode} ${resp.body}');
}
```

---

## Operational tips
- Android emulator: use `http://10.0.2.2:3000` to reach local server.
- JWTs must be obtained from the same server instance being called (they are signed with `JWT_SECRET`).
- For debugging 401s: verify the Authorization header is present and the token is issued by the same server.
- Use proxy endpoints for server-to-server access rather than embedding admin credentials in clients.

## Where to find the implementation in this repo
- `server.js` — app entry & route mounting
- `routes/` — route definitions (`orders.js`, `earnings.js`, `proxy.js`, ...)
- `controllers/` — handler logic (`ordersController.js`, `earningsController.js`, `proxyController.js`)
- `services/earningsService.js` — aggregation logic used by earnings endpoints

---

If you'd like, I can also generate an OpenAPI spec or Postman collection from this doc, or split the doc into per-endpoint files under `patches/`.
