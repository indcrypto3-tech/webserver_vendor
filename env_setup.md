# Environment Setup — Server (Local & Deployment)

This document explains how to set up the backend server locally and for deployment. It includes required environment variables, example `.env` content, commands for running and testing, and notes about seeding and proxy/internal keys.

---

## Prerequisites
- Node.js (recommended v16+)
- npm (or yarn)
- MongoDB (local or Atlas)
- Optional: Firebase service account JSON (for FCM push)

## Clone & Install

```powershell
git clone <repo-url> backend_server
cd backend_server
npm ci
# or: npm install
```

## Example `.env` file

Create a `.env` file in the project root with the following keys. Use secure, random values for secrets in production.

```
MONGO_URI=mongodb://127.0.0.1:27017/vendor_db
JWT_SECRET=replace_with_a_long_random_secret
PORT=3000
UPLOAD_DIR=./uploads
ENABLE_MOCK_ORDERS=true
MOCK_ORDERS_SECRET=dev-mock-secret
INTERNAL_API_KEY=replace_with_secure_internal_key
FIREBASE_SERVICE_ACCOUNT_PATH=./config/firebase-service-account.json
ENABLE_SOCKET_IO=false
ENABLE_WORK_TYPES=true
```

## Running the server

Development (auto-reload):

```powershell
npm run dev
```

Production:

```powershell
npm start
```

## Running tests

```powershell
npm test
```

## Dev helpers / seeding

Run the insert script:

```powershell
node .\scripts\insert_orders_for_vendor.js <VENDOR_ID>
```

Run the seed script:

```powershell
node .\scripts\seed_fake_orders.js
```

## Proxy / Internal API

Set `INTERNAL_API_KEY` in `.env` and call proxy endpoints with header `x-internal-key: <INTERNAL_API_KEY>`.

## Notes & Security
- Do not commit `.env` or any secret files.
- Use a secrets manager for production.
# Environment Setup — Server (Local & Deployment)

This document explains how to set up the backend server locally and for deployment. It includes required environment variables, example `.env` content, commands for running and testing, and notes about seeding and proxy/internal keys.

---

## Prerequisites
- Node.js (recommended v16+)
- npm (or yarn)
- MongoDB (local or Atlas)
- Optional: Firebase service account JSON (for FCM push)

## Clone & Install

```powershell
git clone <repo-url> backend_server
cd backend_server
npm ci
# or: npm install
```

## Example `.env` file

```
MONGO_URI=mongodb://127.0.0.1:27017/vendor_db
JWT_SECRET=replace_with_a_long_random_secret
PORT=3000
UPLOAD_DIR=./uploads
ENABLE_MOCK_ORDERS=true
MOCK_ORDERS_SECRET=dev-mock-secret
INTERNAL_API_KEY=replace_with_secure_internal_key
FIREBASE_SERVICE_ACCOUNT_PATH=./config/firebase-service-account.json
ENABLE_SOCKET_IO=false
ENABLE_WORK_TYPES=true
```

## Running the server

Development (auto-reload):

```powershell
npm run dev
```

Production:

```powershell
npm start
```

## Running tests

```powershell
npm test
```

## Dev helpers / seeding

Run the insert script:

```powershell
node .\scripts\insert_orders_for_vendor.js <VENDOR_ID>
```

Run the seed script:

```powershell
node .\scripts\seed_fake_orders.js
```

## Proxy / Internal API

Set `INTERNAL_API_KEY` in `.env` and call proxy endpoints with header `x-internal-key: <INTERNAL_API_KEY>`.

## Notes & Security
- Do not commit `.env` or any secret files.
- Use a secrets manager for production.
