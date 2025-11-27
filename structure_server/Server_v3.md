
[ File name ]
`package.json`
[its path ]
`/package.json`
[What that file does]
Contains project metadata, dependencies, scripts for running tests and starting the server.
[What is use of that file in prjoject ]
Used by npm/yarn to install packages and run scripts such as tests and start commands.
[Type of that file e.g helper / main endpoint ....etc]
Configuration / manifest

[ File name ]
`server.js`
[its path ]
`/server.js`
[What that file does]
Main Express application entrypoint. Sets up middleware, static uploads route, mounts API routes (`/api/*`), health and root endpoints, connects to MongoDB, seeds work types, and conditionally mounts dev routes.
[What is use of that file in prjoject ]
Bootstraps and exports the Express `app` for local servers and serverless platforms (Vercel). Also starts HTTP server when not serverless.
[Type of that file e.g helper / main endpoint ....etc]
Application entry / server bootstrap

[ File name ]
`jest.config.js`
[its path ]
`/jest.config.js`
[What that file does]
Configuration for Jest test runner used by the repository's unit/integration tests.
[What is use of that file in prjoject ]
Controls test environment, setup files, and coverage collection behavior for running tests.
[Type of that file e.g helper / main endpoint ....etc]
Test configuration

[ File name ]
`vercel.json`
[its path ]
`/vercel.json`
[What that file does]
Configuration for deploying the project to Vercel (serverless deployment settings, build and route behavior).
[What is use of that file in prjoject ]
Ensures the app is compatible with Vercel serverless environment and configures build/runtime.
[Type of that file e.g helper / main endpoint ....etc]
Deployment configuration

[ File name ]
`README.md`
[its path ]
`/README.md`
[What that file does]
Repository README with overview, setup, and developer notes.
[What is use of that file in prjoject ]
Onboarding and documentation for developers.
[Type of that file e.g helper / main endpoint ....etc]
Documentation

[ File name ]
`test-order.sh`
[its path ]
`/test-order.sh`
[What that file does]
Shell script used to run order-related tests or helper commands in CI/dev flows.
[What is use of that file in prjoject ]
Convenience script for running tests or integrations locally.
[Type of that file e.g helper / main endpoint ....etc]
Script / dev helper

[ File name ]
`config/` (folder)
[its path ]
`/config`
[What that file does]
Holds runtime configuration and Firebase admin SDK setup. Includes environment-sensitive configuration and secrets (service account JSON is present but should be secured).
[What is use of that file in prjoject ]
Centralized configuration used across the server (mongo URI, ports, upload dir, mock feature flags, etc.).
[Type of that file e.g helper / main endpoint ....etc]
Configuration module(s)

[ File name ]
`config/firebase.js`
[its path ]
`/config/firebase.js`
[What that file does]
Initializes Firebase Admin SDK using the provided service account when needed (push notifications, etc.).
[What is use of that file in prjoject ]
Provides `initializeFirebase()` helper used by `server.js` and services that send FCM notifications.
[Type of that file e.g helper / main endpoint ....etc]
Service integration helper

[ File name ]
`config/firebase-service-account.json`
[its path ]
`/config/firebase-service-account.json`
[What that file does]
Service account credentials for Firebase Admin SDK (contains sensitive keys).
[What is use of that file in prjoject ]
Used to authenticate server to Firebase for push notifications. Should be kept secret and not committed in public repos.
[Type of that file e.g helper / main endpoint ....etc]
Credentials (sensitive)

[ File name ]
`config/index.js`
[its path ]
`/config/index.js`
[What that file does]
Exports configuration values (mongo URI, port, uploadDir, feature flags like `enableMockOrders`, `mockOrdersSecret`, etc.).
[What is use of that file in prjoject ]
Central configuration import point used throughout the app.
[Type of that file e.g helper / main endpoint ....etc]
Configuration helper

[ File name ]
`middleware/` (folder)
[its path ]
`/middleware`
[What that folder does]
Contains Express middleware such as authentication, rate limiting, and upload handling.
[What is use of that folder in prjoject ]
Middleware modules are applied globally or per-route (e.g., `authenticate` protects routes, `upload` handles multipart form data, `rateLimiter` prevents abuse).
[Type of that file e.g helper / main endpoint ....etc]
Middleware collection

[ File name ]
`middleware/auth.js`
[its path ]
`/middleware/auth.js`
[What that file does]
Provides `authenticate` middleware which validates JWTs and attaches vendor/user to `req.user`.
[What is use of that file in prjoject ]
Protects routes that require vendor authentication.
[Type of that file e.g helper / main endpoint ....etc]
Authentication middleware

[ File name ]
`middleware/rateLimiter.js`
[its path ]
`/middleware/rateLimiter.js`
[What that file does]
Provides rate limiter middleware variants (presence rate limiter, dev order rate limiter, strict presence rate limiter) to throttle requests.
[What is use of that file in prjoject ]
Prevents abuse of endpoints by limiting frequency of requests.
[Type of that file e.g helper / main endpoint ....etc]
Middleware / security

[ File name ]
`middleware/upload.js`
[its path ]
`/middleware/upload.js`
[What that file does]
Handles multipart file uploads (identity images), provides error handling wrapper for upload middleware.
[What is use of that file in prjoject ]
Used by vendor creation and update endpoints to accept files like profile/id/cert.
[Type of that file e.g helper / main endpoint ....etc]
Upload middleware

[ File name ]
`middleware/requestId.js`
[its path ]
`/middleware/requestId.js`
[What that file does]
Generates and attaches a unique request ID to every incoming request for request tracing and structured logging.
[What is use of that file in prjoject ]
Applied globally in `server.js`; assigns `req.id` used by structured logger and logged in responses.
[Type of that file e.g helper / main endpoint ....etc]
Middleware / request tracing

[ File name ]
`controllers/` (folder)
[its path ]
`/controllers`
[What that folder does]
Contains route handler logic (business rules) for orders, vendors, presence, dev endpoints, and work types.
[What is use of that folder in prjoject ]
Controllers are invoked by routes; they call services/models and return JSON responses.
[Type of that file e.g helper / main endpoint ....etc]
Route controllers / handlers

[ File name ]
`controllers/orderController.js`
[its path ]
`/controllers/orderController.js`
[What that file does]
Handles order-related actions: `getOrder`, `acceptOrder`, `rejectOrder`. Implements logic to atomically claim orders and notify stakeholders.
[What is use of that file in prjoject ]
Called by `routes/orders.js` to perform order workflows for vendors.
[Type of that file e.g helper / main endpoint ....etc]
Controller (orders)

[ File name ]
`controllers/ordersController.js`
[its path ]
`/controllers/ordersController.js`
[What that file does]
Extended order workflow controller with full lifecycle actions: `listOrders`, `getOrder`, `acceptOrder`, `rejectOrder`, `startOrder`, `completeOrder`, `cancelOrder`. Includes atomic status transitions and idempotency handling.
[What is use of that file in prjoject ]
Provides vendor-facing order management endpoints with structured logging and conflict detection.
[Type of that file e.g helper / main endpoint ....etc]
Controller (orders - extended)

[ File name ]
`controllers/devOrdersController.js`
[its path ]
`/controllers/devOrdersController.js`
[What that file does]
Contains dev-only endpoints and middleware: `checkDevKey`, `createMockOrder`, `getMockOrderStats` for testing/mock order creation.
[What is use of that file in prjoject ]
Mounted under `/api/dev` when mock orders are enabled; used for testing and development.
[Type of that file e.g helper / main endpoint ....etc]
Controller / dev endpoints

[ File name ]
`controllers/presenceController.js`
[its path ]
`/controllers/presenceController.js`
[What that file does]
Manages vendor presence records (online/offline status, location TTL), provides `updatePresence`, `getPresence`, `getOnlineVendors`, `getNearbyVendors`.
[What is use of that file in prjoject ]
Called by presence routes to update and query vendor real-time availability.
[Type of that file e.g helper / main endpoint ....etc]
Controller (presence)

[ File name ]
`controllers/vendorController.js`
[its path ]
`/controllers/vendorController.js`
[What that file does]
Handles vendor profile creation and updates (`createVendor`, `getMe`, `updateMe`) and FCM token registration/removal. Includes helpers for sanitization and validation.
[What is use of that file in prjoject ]
Used by `/api/vendors` endpoints to manage vendor lifecycle and profile data.
[Type of that file e.g helper / main endpoint ....etc]
Controller (vendors)

[ File name ]
`controllers/workTypesController.js`
[its path ]
`/controllers/workTypesController.js`
[What that file does]
Provides `getWorkTypes` (returns active work types) and `seedWorkTypes` to populate DB fallback defaults.
[What is use of that file in prjoject ]
Supplies work type data to clients (e.g., list of services) and seeds DB on startup.
[Type of that file e.g helper / main endpoint ....etc]
Controller (work types)

[ File name ]
`controllers/earningsController.js`
[its path ]
`/controllers/earningsController.js`
[What that file does]
Handles earnings-related endpoints: `getSummary` (aggregated earnings totals) and `getHistory` (paginated confirmed payments). Includes date validation, admin override support, and error handling.
[What is use of that file in prjoject ]
Used by `/api/earnings` endpoints to provide vendor earnings data.
[Type of that file e.g helper / main endpoint ....etc]
Controller (earnings)

[ File name ]
`routes/` (folder)
[its path ]
`/routes`
[What that folder does]
Defines Express routers that map HTTP endpoints to controller functions. Mounted under `/api/*` in `server.js`.
[What is use of that file in prjoject ]
Provides route definitions and middleware per group (auth, vendors, orders, presence, work-types, dev).
[Type of that file e.g helper / main endpoint ....etc]
Routing layer

[ File name ]
`routes/auth.js`
[its path ]
`/routes/auth.js`
[What that file does]
Auth-related endpoints: `POST /send-otp` and `POST /verify-otp`. Uses `utils/otpStore` and `utils/jwt` and checks vendor existence.
[What is use of that file in prjoject ]
Used by clients to perform OTP flow and receive JWT tokens.
[Type of that file e.g helper / main endpoint ....etc]
Route definitions (auth)

[ File name ]
`routes/vendors.js`
[its path ]
`/routes/vendors.js`
[What that file does]
Vendor-related endpoints: create vendor (`POST /`), `GET /me`, `PATCH /me`, `POST /me/fcm-token`, `DELETE /me/fcm-token`. Integrates upload middleware and auth.
[What is use of that file in prjoject ]
Exposes vendor management endpoints to mobile/web clients.
[Type of that file e.g helper / main endpoint ....etc]
Route definitions (vendors)

[ File name ]
`routes/presence.js`
[its path ]
`/routes/presence.js`
[What that file does]
Presence endpoints: `POST /me/presence`, `GET /me/presence`, `GET /presence/online`, `GET /presence/nearby`.
[What is use of that file in prjoject ]
Allows vendors to report presence and allows internal/admin queries for online/nearby vendors.
[Type of that file e.g helper / main endpoint ....etc]
Route definitions (presence)

[ File name ]
`routes/orders.js`
[its path ]
`/routes/orders.js`
[What that file does]
Order endpoints: `GET /` (list orders with pagination), `GET /:id`, `POST /:id/accept`, `POST /:id/reject`, `POST /:id/start`, `POST /:id/complete`, `POST /:id/cancel`. Uses `authenticate` middleware and `ordersController`.
[What is use of that file in prjoject ]
Exposes full order lifecycle management actions to vendors (list, view, accept, reject, start, complete, cancel).
[Type of that file e.g helper / main endpoint ....etc]
Route definitions (orders)

[ File name ]
`routes/workTypes.js`
[its path ]
`/routes/workTypes.js`
[What that file does]
Simple endpoint `GET /` that returns available work types.
[What is use of that file in prjoject ]
Used by client to display available categories/services.
[Type of that file e.g helper / main endpoint ....etc]
Route definitions (work types)

[ File name ]
`routes/earnings.js`
[its path ]
`/routes/earnings.js`
[What that file does]
Earnings endpoints: `GET /summary` (aggregated earnings totals) and `GET /history` (paginated confirmed payments). Uses `authenticate` middleware.
[What is use of that file in prjoject ]
Exposes vendor earnings data endpoints for mobile/web clients.
[Type of that file e.g helper / main endpoint ....etc]
Route definitions (earnings)

[ File name ]
`routes/devOrders.js`
[its path ]
`/routes/devOrders.js`
[What that file does]
Development-only routes: `POST /orders/mock` to create mock orders and `GET /orders/stats` for usage statistics. Protected by `x-dev-key` middleware.
[What is use of that file in prjoject ]
Used for testing and simulating order flows when `ENABLE_MOCK_ORDERS=true`.
[Type of that file e.g helper / main endpoint ....etc]
Route definitions (dev)

[ File name ]
`routes/vendorLocation.js`
[its path ]
`/routes/vendorLocation.js`
[What that file does]
Vendor location update endpoint: `POST /location` to store vendor's current location.
[What is use of that file in prjoject ]
Allows vendors to report their current location for tracking and analytics.
[Type of that file e.g helper / main endpoint ....etc]
Route definitions (vendor location)

[ File name ]
`services/` (folder)
[its path ]
`/services`
[What that folder does]
Contains business services such as `orderService`, `devOrdersService`, `notificationService`, and `socketService` which perform lower-level logic and integrate with external systems.
[What is use of that file in prjoject ]
Services are called by controllers to perform DB operations, notifications, and socket communication.
[Type of that file e.g helper / main endpoint ....etc]
Service layer

[ File name ]
`services/orderService.js`
[its path ]
`/services/orderService.js`
[What that file does]
Provides helper functions for creating orders, validating order data, finding nearby online vendors, broadcasting orders, and auto-assignment logic.
[What is use of that file in prjoject ]
Abstracts order creation and vendor discovery logic for controllers.
[Type of that file e.g helper / main endpoint ....etc]
Service (orders)

[ File name ]
`services/ordersService.js`
[its path ]
`/services/ordersService.js`
[What that file does]
Extended order service with atomic status transition helpers (`transitionOrderAtomic`) to prevent race conditions during accept/reject flows.
[What is use of that file in prjoject ]
Provides safe DB operations for order state changes used by `ordersController`.
[Type of that file e.g helper / main endpoint ....etc]
Service (orders - extended)

[ File name ]
`services/devOrdersService.js`
[its path ]
`/services/devOrdersService.js`
[What that file does]
Logic to create mock orders and return idempotency info and stats for dev endpoints.
[What is use of that file in prjoject ]
Supports `controllers/devOrdersController.js` for test flows.
[Type of that file e.g helper / main endpoint ....etc]
Service (development)

[ File name ]
`services/earningsService.js`
[its path ]
`/services/earningsService.js`
[What that file does]
Provides MongoDB aggregation functions to compute vendor earnings from confirmed payment requests. Includes `getEarningsSummary` (today/month/all-time totals + pending) and `getEarningsHistory` (paginated confirmed payments).
[What is use of that file in prjoject ]
Supports `controllers/earningsController.js` for earnings endpoints.
[Type of that file e.g helper / main endpoint ....etc]
Service (earnings)

[ File name ]
`services/notificationService.js`
[its path ]
`/services/notificationService.js`
[What that file does]
Wraps push-notification logic (FCM) and prepares messages for vendor/customer notifications.
[What is use of that file in prjoject ]
Notifies vendors/customers about order status changes.
[Type of that file e.g helper / main endpoint ....etc]
Service (notifications)

[ File name ]
`services/socketService.js`
[its path ]
`/services/socketService.js`
[What that file does]
Socket.IO related helpers (initialization and event emitters) for real-time updates. Note: Socket.IO usage is disabled for serverless deployments.
[What is use of that file in prjoject ]
Used to emit order/presence events to connected clients in non-serverless deployments.
[Type of that file e.g helper / main endpoint ....etc]
Service (realtime)

[ File name ]
`models/` (folder)
[its path ]
`/models`
[What that folder does]
Mongoose models representing domain entities: `vendor`, `order`, `vendorPresence`, `workType`, plus test/mocks.
[What is use of that file in prjoject ]
Defines schemas and helper instance/static methods to shape persistence layer.
[Type of that file e.g helper / main endpoint ....etc]
Data models

[ File name ]
`models/order.js`
[its path ]
`/models/order.js`
[What that file does]
Mongoose schema for orders with helper `toPublicJSON` and status fields.
[What is use of that file in prjoject ]
Persists and queries order documents for business flows.
[Type of that file e.g helper / main endpoint ....etc]
Model (order)

[ File name ]
`models/vendor.js`
[its path ]
`/models/vendor.js`
[What that file does]
Vendor schema including identity images, fcmTokens, mobile verification and helper `toPublicJSON`.
[What is use of that file in prjoject ]
Represents vendor users for authentication and profile management.
[Type of that file e.g helper / main endpoint ....etc]
Model (vendor)

[ File name ]
`models/vendorPresence.js`
[its path ]
`/models/vendorPresence.js`
[What that file does]
Schema for online vendor presence with TTL, geoJSON `loc`, and helper static methods `findOnlineVendors`, `findNearby`.
[What is use of that file in prjoject ]
Stores transient presence info used by presence endpoints.
[Type of that file e.g helper / main endpoint ....etc]
Model (presence)

[ File name ]
`models/vendorLocation.js`
[its path ]
`/models/vendorLocation.js`
[What that file does]
Schema for storing vendor location history with timestamps and coordinates (for tracking and analytics).
[What is use of that file in prjoject ]
Persists vendor location updates submitted via `POST /api/vendor/location`.
[Type of that file e.g helper / main endpoint ....etc]
Model (vendor location)

[ File name ]
`models/workType.js`
[its path ]
`/models/workType.js`
[What that file does]
Schema for work types/categories; used to seed DB and return active types.
[What is use of that file in prjoject ]
Provides persistent list of services available in the app.
[Type of that file e.g helper / main endpoint ....etc]
Model (work type)

[ File name ]
`models/mockOrderCall.js`
[its path ]
`/models/mockOrderCall.js`
[What that file does]
Used by dev endpoints to persist idempotency and stats about mock order calls.
[What is use of that file in prjoject ]
Helps idempotency and analytics for `devOrders` mock endpoints.
[Type of that file e.g helper / main endpoint ....etc]
Model (dev/testing)

[ File name ]
`utils/` (folder)
[its path ]
`/utils`
[What that folder does]
Utility modules including `jwt` helpers and `otpStore` (dev-only in-memory OTP storage).
[What is use of that file in prjoject ]
Shared helpers used by routes/controllers for auth and OTP flows.
[Type of that file e.g helper / main endpoint ....etc]
Utilities / helpers

[ File name ]
`utils/jwt.js`
[its path ]
`/utils/jwt.js`
[What that file does]
Signs and verifies JWT tokens used for vendor authentication.
[What is use of that file in prjoject ]
Used by `/routes/auth.js` and `middleware/auth.js` to manage tokens.
[Type of that file e.g helper / main endpoint ....etc]
Utility (auth)

[ File name ]
`utils/otpStore.js`
[its path ]
`/utils/otpStore.js`
[What that file does]
In-memory OTP sender and verifier (dev-only). Stores OTP codes temporarily and optionally returns codes for testing.
[What is use of that file in prjoject ]
Used by `routes/auth.js` for OTP flows in development.
[Type of that file e.g helper / main endpoint ....etc]
Utility (OTP dev)

[ File name ]
`tests/` (folder)
[its path ]
`/tests`
[What that folder does]
Contains Jest tests for core features and integration tests (vendor profile flows, presence, socket push integration).
[What is use of that file in prjoject ]
Verifies behavior and prevents regressions.
[Type of that file e.g helper / main endpoint ....etc]
Tests

[ File name ]
`uploads/` (folder)
[its path ]
`/uploads`
[What that folder does]
Local storage path for uploaded identity/profile images; created at runtime if writable.
[What is use of that file in prjoject ]
Stores files uploaded by clients (profile/id/cert). On serverless platforms this directory may be read-only.
[Type of that file e.g helper / main endpoint ....etc]
Storage (uploads)

[ File name ]
`coverage/` (folder)
[its path ]
`/coverage`
[What that folder does]
Code coverage artifacts from test runs (lcov, HTML reports).
[What is use of that file in prjoject ]
Reviewing test coverage / CI reporting.
[Type of that file e.g helper / main endpoint ....etc]
Test artifacts

[ File name ]
`patches/` (folder)
[its path ]
`/patches`
[What that folder does]
Documentation and design notes related to API changes, presence, push notifications and server structure. Also contains this `Server_v3.md`.
[What is use of that file in prjoject ]
Developer notes and migration/patch guides.
[Type of that file e.g helper / main endpoint ....etc]
Documentation / patches

---

[ every API end point of this project supports ]

- `GET /` : Root info (version & basic endpoints list)
- `GET /health` : Health check

- `POST /api/auth/send-otp` : Send OTP to a mobile number (dev-only OTP store)
- `POST /api/auth/verify-otp` : Verify OTP and receive JWT token

- `POST /api/vendors` : Create a new vendor (multipart form data for identity images)
- `GET /api/vendors/me` : Get current vendor profile (requires `authenticate`)
- `PATCH /api/vendors/me` : Update vendor profile (requires `authenticate`, accepts multipart updates)
- `POST /api/vendors/me/fcm-token` : Register FCM token for push notifications (requires `authenticate`)
- `DELETE /api/vendors/me/fcm-token` : Remove FCM token (requires `authenticate`)

- `POST /api/vendors/me/presence` : Update vendor presence (online/offline and location) (requires `authenticate`)
- `GET /api/vendors/me/presence` : Get the authenticated vendor's presence (requires `authenticate`)
- `GET /api/vendors/presence/online` : Get list of online vendors (requires `authenticate`)
- `GET /api/vendors/presence/nearby` : Find online vendors near a location (query: `lat`, `lng`, optional `maxDistance`) (requires `authenticate`)

- `GET /api/work-types` : List available work types (public, gated by ENABLE_WORK_TYPES flag)

- `GET /api/orders` : List orders for authenticated vendor with pagination (query: `page`, `limit`) (requires `authenticate`)
- `GET /api/orders/:id` : Get order details by ID (requires `authenticate`)
- `POST /api/orders/:id/accept` : Accept an order (vendor) (requires `authenticate`)
- `POST /api/orders/:id/reject` : Reject an assigned order (requires `authenticate`)
- `POST /api/orders/:id/start` : Start an accepted order (requires `authenticate`)
- `POST /api/orders/:id/complete` : Complete an in-progress order (requires `authenticate`)
- `POST /api/orders/:id/cancel` : Cancel an order (requires `authenticate`)
- `PATCH /api/orders/:id/fare` : Update canonical order fare before creating a payment request (requires `authenticate`)
- `POST /api/orders/:id/payment-request` : Create payment request for an order (Module 3) (requires `authenticate`)
- `POST /api/orders/:id/request-otp` : Generate and send OTP for arrival/completion verification (Module 3) (requires `authenticate`)
- `POST /api/orders/:id/verify-otp` : Verify OTP and update order status (Module 3) (requires `authenticate`)

- `GET /api/earnings/summary` : Get earnings summary (today/month/all-time totals + pending) (requires `authenticate`)
- `GET /api/earnings/history` : Get paginated earnings history (confirmed payments) (requires `authenticate`)

- `POST /api/vendor/location` : Update vendor's current location (requires `authenticate`)

- `POST /api/dev/orders/mock` : Create a mock order (dev only, requires `x-dev-key` header and `ENABLE_MOCK_ORDERS=true`)
- `GET /api/dev/orders/stats` : Get statistics about mock orders (dev only, requires `x-dev-key`)

Notes:
- Many protected endpoints use the `authenticate` middleware which expects a signed JWT (generated by `utils/jwt.js`).
- Dev endpoints under `/api/dev` are only mounted when `config.enableMockOrders` is true; they require an `x-dev-key` header validated against `config.mockOrdersSecret`.
- Upload endpoints use `middleware/upload.js` and store files in `/uploads` when writable.

---

## Module 3: Payment & OTP Endpoints Documentation

### POST /api/orders/:orderId/payment-request

Create a payment request for an order. Supports auto-confirmation for testing.

**Authentication:** Required (JWT Bearer token)

**Request Body:**
```json
{
  "amount": 150,            // OPTIONAL: if omitted, server uses the canonical order `fare`
  "currency": "INR",
  "autoConfirm": false
}
```

**Parameters:**
- `amount` (number, optional): Payment amount. If omitted the server will use the order's `fare` (fare-first workflow).
- `currency` (string, optional): Currency code (default: "INR")
- `autoConfirm` (boolean, optional): If true, immediately confirms payment (dev/test mode only)

Note: `notes` are deprecated in the payment-request creation flow — vendors should update `order.fare` via `PATCH /api/orders/:id/fare` before creating a payment request.

**Response:**
```json
{
  "ok": true,
  "paymentRequestId": "a42d4b37-7710-4098-85cf-d4b9cc50dddc",
  "autoConfirmed": false
}
```

**Auto-Confirm Response (when autoConfirm=true):**
```json
{
  "ok": true,
  "paymentRequestId": "a42d4b37-7710-4098-85cf-d4b9cc50dddc",
  "autoConfirmed": true,
  "paymentRequest": {
    "id": "a42d4b37-7710-4098-85cf-d4b9cc50dddc",
    "amount": 150,
    "currency": "INR",
    "notes": "Additional charges",
    "status": "confirmed",
    "createdAt": "2025-11-26T10:00:00.000Z",
    "confirmedAt": "2025-11-26T10:00:00.100Z"
  }
}
```

**Errors:**
- `400` - invalid_amount: Amount must be a positive number
- `404` - order_not_found: Order does not exist

Additional notes:
- If `amount` is omitted and `order.fare` is absent or invalid, the server will respond with `400` / `invalid_amount`.

**Curl Example:**
```bash
curl -X POST http://localhost:3000/api/orders/507f1f77bcf86cd799439011/payment-request \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "amount": 150,
    "currency": "INR",
    "notes": "Additional charges"
  }'
```

---

### POST /api/orders/:orderId/request-otp

Generate and send OTP for arrival or completion verification.

**Authentication:** Required (JWT Bearer token)

**Request Body:**
```json
{
  "purpose": "arrival",
  "ttlSeconds": 300
}
```

**Parameters:**
- `purpose` (string, required): Either "arrival" or "completion"
- `ttlSeconds` (number, optional): Time to live in seconds (default: 300)

**Response:**
```json
{
  "ok": true,
  "otpId": "c8e2f9a0-1234-5678-9abc-def012345678",
  "sent": true,
  "devCode": "123456"
}
```

**Notes:**
- `devCode` is only returned when `NODE_ENV !== 'production'` for testing automation
- OTP is sent via FCM push notification (SMS integration pending)
- A new OTP request with different purpose will replace existing OTP
- Same-purpose OTP requests are blocked if previous OTP is still valid (429 error)

**Errors:**
- `400` - invalid_purpose: Purpose must be "arrival" or "completion"
- `404` - order_not_found: Order does not exist
- `429` - otp_already_sent: An active OTP already exists for this purpose

**Curl Example:**
```bash
curl -X POST http://localhost:3000/api/orders/507f1f77bcf86cd799439011/request-otp \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "purpose": "arrival",
    "ttlSeconds": 300
  }'
```

---

### POST /api/orders/:orderId/verify-otp

Verify OTP code and update order status based on purpose.

**Authentication:** Required (JWT Bearer token)

**Request Body:**
```json
{
  "otp": "123456",
  "purpose": "arrival"
}
```

**Parameters:**
- `otp` (string, required): 6-digit OTP code
- `purpose` (string, required): Must match the OTP purpose ("arrival" or "completion")

**Response:**
```json
{
  "ok": true,
  "verified": true,
  "status": "arrival_confirmed"
}
```

**Status Transitions:**
- `purpose: "arrival"` → Order status becomes `arrival_confirmed`
- `purpose: "completion"` → Order status becomes `completed` (sets completedAt timestamp)

**Errors:**
- `400` - invalid_otp: OTP is required or invalid format
- `400` - invalid_purpose: Purpose must be "arrival" or "completion"
- `400` - no_otp: No OTP found for this order
- `400` - purpose_mismatch: OTP purpose doesn't match request
- `401` - invalid_otp: OTP code is incorrect
- `404` - order_not_found: Order does not exist
- `410` - otp_expired: OTP has expired
- `429` - too_many_attempts: Maximum verification attempts exceeded (5 attempts)

**Curl Example:**
```bash
curl -X POST http://localhost:3000/api/orders/507f1f77bcf86cd799439011/verify-otp \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "otp": "123456",
    "purpose": "arrival"
  }'
```

---

## Environment Variables

**Module 3 Related:**
- `NODE_ENV` - Set to "production" to hide OTP codes in API responses (default: development)
- `FIREBASE_SERVICE_ACCOUNT_PATH` - Path to Firebase service account JSON for FCM push notifications (optional)
- `ENABLE_MOCK_ORDERS` - Enable dev mock order endpoints (default: false)

**Existing:**
- `MONGO_URI` - MongoDB connection string (required)
- `JWT_SECRET` - Secret key for JWT token signing (required)
- `PORT` - Server port (default: 3000)
- `UPLOAD_DIR` - Directory for file uploads (default: ./uploads)
- `ENABLE_SOCKET_IO` - Enable Socket.IO for real-time updates (default: false, set false for serverless)
- `ENABLE_WORK_TYPES` - Enable work types endpoint (default: false)

---

## Order Status Flow (Updated with Module 3)

```
pending → assigned → accepted → in_progress → completed
                  ↓                    ↓
              rejected            cancelled

Module 3 additions:
accepted → payment_requested → payment_confirmed
in_progress → arrival_confirmed → completed
```

**New Statuses:**
- `payment_requested`: Vendor has requested payment from customer
- `payment_confirmed`: Customer has confirmed payment
- `arrival_confirmed`: Vendor arrival verified via OTP

---

## Data Models (Module 3 Updates)

### Order Schema Extensions

**Payment Requests Array:**
```javascript
paymentRequests: [
  {
    id: String (UUID),
    amount: Number,
    currency: String,
    notes: String, // deprecated: not used by the current fare-first creation flow
    status: 'requested' | 'confirmed' | 'rejected',
    createdAt: Date,
    confirmedAt: Date,
    meta: Object
  }
]
```

**OTP Object:**
```javascript
otp: {
  otpId: String (UUID),
  codeHash: String (bcrypt hash),
  purpose: 'arrival' | 'completion',
  createdAt: Date,
  expiresAt: Date,
  attempts: Number,
  verified: Boolean
}
```

---

## Testing

**Run Module 3 Tests:**
```bash
npm test -- tests/paymentOtp.test.js
```

**Run All Tests:**
```bash
npm test
```

**Test Coverage:**
- Payment request creation and auto-confirmation
- OTP generation with TTL
- OTP verification with status transitions
- Error handling (invalid amount, expired OTP, too many attempts)
- Idempotency and conflict detection
- Integration with existing order endpoints

---

## Earnings Module Documentation

### GET /api/earnings/summary

Get aggregated earnings summary for the authenticated vendor.

**Authentication:** Required (JWT Bearer token)

**Query Parameters:**
- `start` (optional): Start date for filtering (ISO 8601 format)
- `end` (optional): End date for filtering (ISO 8601 format)
- `tz` (optional): Timezone identifier
- `vendorId` (optional, admin only): Override vendor ID to query another vendor's earnings

**Response:**
```json
{
  "ok": true,
  "summary": {
    "currency": "INR",
    "totalToday": 150.00,
    "totalMonth": 1250.50,
    "totalAllTime": 15750.75,
    "pending": 200.00
  }
}
```

**Fields:**
- `totalToday`: Sum of confirmed payments for today (midnight to now)
- `totalMonth`: Sum of confirmed payments for current calendar month
- `totalAllTime`: Sum of all confirmed payments
- `pending`: Sum of non-confirmed payment requests (status != 'confirmed')

**Errors:**
- `400` - invalid_date: Start or end date is invalid
- `401` - unauthorized: Missing or invalid authentication token
- `500` - Internal server error

**Curl Example:**
```bash
curl -H "Authorization: Bearer <token>" \
  "http://localhost:3000/api/earnings/summary"

# With date filters
curl -H "Authorization: Bearer <token>" \
  "http://localhost:3000/api/earnings/summary?start=2025-11-01&end=2025-11-30"
```

---

### GET /api/earnings/history

Get paginated list of confirmed payments for the authenticated vendor.

**Authentication:** Required (JWT Bearer token)

**Query Parameters:**
- `from` (optional): Start date filter (ISO 8601 format)
- `to` (optional): End date filter (ISO 8601 format)
- `limit` (optional, default 50, max 200): Items per page
- `offset` (optional, default 0): Number of items to skip
- `page` (optional): Page number (alternative to offset)
- `perPage` (optional): Items per page (alternative to limit)
- `tz` (optional): Timezone identifier
- `vendorId` (optional, admin only): Override vendor ID

**Response:**
```json
{
  "ok": true,
  "page": 1,
  "perPage": 50,
  "totalItems": 120,
  "totalPages": 3,
  "rows": [
    {
      "id": "pay_abc123",
      "orderId": "507f1f77bcf86cd799439011",
      "amount": 150.00,
      "currency": "INR",
      "confirmedAt": "2025-11-20T10:34:12.000Z",
      "paymentMethod": "cod",
      "status": "completed",
      "notes": null
    }
  ]
}
```

**Pagination:**
- Use `limit` and `offset` for direct control
- Or use `page` and `perPage` for page-based navigation
- Results are always sorted by `confirmedAt` descending (newest first)

**Errors:**
- `400` - invalid_date: From or to date is invalid
- `400` - invalid_param: Invalid limit or offset value
- `401` - unauthorized: Missing or invalid authentication token
- `500` - Internal server error

**Curl Examples:**
```bash
# Get first page (default 50 items)
curl -H "Authorization: Bearer <token>" \
  "http://localhost:3000/api/earnings/history"

# Get specific date range with pagination
curl -H "Authorization: Bearer <token>" \
  "http://localhost:3000/api/earnings/history?from=2025-11-01&to=2025-11-30&limit=20&offset=0"

# Using page/perPage
curl -H "Authorization: Bearer <token>" \
  "http://localhost:3000/api/earnings/history?page=2&perPage=25"
```

**Notes:**
- Only confirmed payment requests are included in history
- All amounts are rounded to 2 decimal places
- Maximum limit is enforced at 200 items per request
- Date filters use `confirmedAt` timestamp for matching
- Vendors can only access their own earnings unless admin override is used
 
---

## Example JSON Structures (Request & Response)

Below are example request and response JSON bodies for the most important endpoints. Use these as quick references when integrating clients.

Auth
- `POST /api/auth/send-otp` Request:
```json
{
  "phone": "+919999999999"
}
```
Response (dev):
```json
{
  "ok": true,
  "sent": true,
  "devCode": "123456"
}
```

- `POST /api/auth/verify-otp` Request:
```json
{
  "phone": "+919999999999",
  "code": "123456"
}
```
Response:
```json
{
  "ok": true,
  "token": "eyJhbGci...",
  "vendorId": "6926df56ae18dd54a9b00814"
}
```

Vendors
- `POST /api/vendors` (multipart; example JSON representation of fields):
```json
{
  "name": "Test Vendor",
  "phone": "+919999999999",
  "email": "vendor@example.com",
  "workTypeId": "7b8f..."
}
```
Response:
```json
{
  "ok": true,
  "vendor": { "id": "6926df56ae18dd54a9b00814", "name": "Test Vendor", "phone": "+919999999999" }
}
```

- `GET /api/vendors/me` Response:
```json
{
  "ok": true,
  "vendor": {
    "id": "6926df56ae18dd54a9b00814",
    "name": "Test Vendor",
    "phone": "+919999999999",
    "fcmTokens": []
  }
}
```

Presence
- `POST /api/vendors/me/presence` Request:
```json
{
  "online": true,
  "lat": 12.9716,
  "lng": 77.5946,
  "ttlSeconds": 60
}
```
Response:
```json
{ "ok": true, "presenceId": "5f1e9b..." }
```

- `GET /api/vendors/presence/nearby?lat=..&lng=..` Response (example):
```json
{
  "ok": true,
  "rows": [ { "vendorId": "6926...", "lat": 12.97, "lng": 77.59, "distance": 120 } ]
}
```

Work types
- `GET /api/work-types` Response:
```json
{
  "ok": true,
  "workTypes": [ { "id": "wt_1", "name": "Plumbing" }, { "id": "wt_2", "name": "Electrical" } ]
}
```

Orders
- `GET /api/orders?page=1&limit=20` Response:
```json
{
  "ok": true,
  "page": 1,
  "perPage": 20,
  "totalItems": 42,
  "rows": [ { "id": "507f1f77bcf86cd799439011", "status": "assigned", "fare": 250 } ]
}
```

- `GET /api/orders/:id` Response:
```json
{
  "ok": true,
  "order": {
    "id": "507f1f77bcf86cd799439011",
    "status": "assigned",
    "fare": 250,
    "paymentRequests": []
  }
}
```

- `POST /api/orders/:id/accept` Request: (no body required)
Response:
```json
{ "ok": true, "status": "accepted", "orderId": "507f1f77bcf86cd799439011" }
```

- `PATCH /api/orders/:id/fare` Request:
```json
{ "fare": 300 }
```
Response:
```json
{ "ok": true, "orderId": "507f1f77bcf86cd799439011", "fare": 300 }
```

- `POST /api/orders/:id/payment-request` Request examples:
1) Using explicit amount:
```json
{ "amount": 150, "currency": "INR" }
```
2) Omitted amount (server uses `order.fare`):
```json
{}
```
Response (created):
```json
{ "ok": true, "paymentRequestId": "a42d4b37-7710-4098-85cf-d4b9cc50dddc", "autoConfirmed": false }
```

- `POST /api/orders/:id/request-otp` Request:
```json
{ "purpose": "arrival", "ttlSeconds": 300 }
```
Response (dev):
```json
{ "ok": true, "otpId": "c8e2f9a0-1234", "devCode": "123456" }
```

- `POST /api/orders/:id/verify-otp` Request:
```json
{ "otp": "123456", "purpose": "arrival" }
```
Response (success):
```json
{ "ok": true, "verified": true, "status": "arrival_confirmed" }
```

Earnings
- `GET /api/earnings/summary` Response:
```json
{
  "ok": true,
  "summary": { "currency": "INR", "totalToday": 150.00, "totalMonth": 1250.50, "totalAllTime": 15750.75, "pending": 200.00 }
}
```

- `GET /api/earnings/history?limit=20&offset=0` Response:
```json
{
  "ok": true,
  "page": 1,
  "perPage": 20,
  "totalItems": 120,
  "rows": [ { "id": "pay_abc123", "orderId": "507f1f77...", "amount": 150.00, "confirmedAt": "2025-11-20T10:34:12.000Z" } ]
}
```

Proxy (backend-to-backend)
- `POST /api/proxy/earnings/summary` Request:
```json
{ "vendorId": "6926df56ae18dd54a9b00814", "start": "2025-11-01", "end": "2025-11-30" }
```
Response: same as `GET /api/earnings/summary` above.

Dev / Mock endpoints
- `POST /api/dev/orders/mock` Request:
```json
{ "workTypeId": "wt_1", "address": "Test address", "fare": 120 }
```
Response:
```json
{ "ok": true, "orderId": "507f...", "created": true }
```

Errors (example format)
```json
{ "ok": false, "error": "invalid_amount", "message": "Amount must be a positive number" }
```

---

## Recently Added Files & Scripts (2025 updates)

These items were added to support the earnings module, proxy access and developer tooling.

- `controllers/proxyController.js`
  - Provides backend-to-backend proxy handlers (e.g. `/api/proxy/earnings/*`). Validates `x-internal-key` and forwards queries to service layer.

- `routes/proxy.js`
  - Router that mounts proxy endpoints under `/api/proxy` and protects them with internal key validation.

- `scripts/seed_fake_orders.js`
  - Dev helper to create fake vendors and orders for local testing. Prints example vendor JWTs and sample curl commands.

- `scripts/insert_orders_for_vendor.js`
  - Inserts sample orders for a provided `vendorId` (CLI or env input). Useful for quickly populating a vendor's order history.

- `patches/API_details.md`
  - Project-level API reference created from developer notes. Contains per-endpoint examples, proxy usage, and SDK snippets.

- `API_details.md` (optional root copy)
  - A copy of the full API reference placed at repository root for quick access (may be present depending on workflow).

- `config/index.js` (minor update)
  - New/optional `internalApiKey` (`INTERNAL_API_KEY` env) added to support proxy endpoints. Keep this secret.

- `middleware/auth.js` (logging)
  - Enhanced structured logging for auth failures (missing Authorization header, invalid token, vendor not found) to simplify debugging 401s.

Notes:
- Proxy endpoints are for trusted backends; do not expose `INTERNAL_API_KEY` to clients.
- Seed and insert scripts are intended for development/testing and may create non-production data. Use with caution against production DBs.

