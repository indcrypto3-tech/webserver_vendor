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

```env
MONGO_URI=mongodb://127.0.0.1:27017/vendor_db
JWT_SECRET=replace_with_a_long_random_secret
PORT=3000
UPLOAD_DIR=./uploads
ENABLE_MOCK_ORDERS=true
MOCK_ORDERS_SECRET=dev-mock-secret
INTERNAL_API_KEY=replace_with_secure_internal_key
SERVICE_API_KEY=replace_with_secure_service_key
FIREBASE_SERVICE_ACCOUNT_PATH=./config/firebase-service-account.json
ENABLE_SOCKET_IO=false
ENABLE_WORK_TYPES=true
```

### Environment Variables Explained

| Variable | Required | Description |
|----------|----------|-------------|
| `MONGO_URI` | Yes | MongoDB connection string |
| `JWT_SECRET` | Yes | Secret key for signing JWT tokens |
| `PORT` | No | Server port (default: 3000) |
| `UPLOAD_DIR` | No | Directory for file uploads (default: ./uploads) |
| `ENABLE_MOCK_ORDERS` | No | Enable mock order endpoints for testing |
| `MOCK_ORDERS_SECRET` | No | Secret for mock order endpoint authentication |
| `INTERNAL_API_KEY` | No | Key for earnings proxy endpoints (backend-to-backend) |
| `SERVICE_API_KEY` | No | Key for fetchlist proxy endpoints (backend-to-backend) |
| `FIREBASE_SERVICE_ACCOUNT_PATH` | No | Path to Firebase service account JSON |
| `ENABLE_SOCKET_IO` | No | Enable Socket.IO for real-time updates |
| `ENABLE_WORK_TYPES` | No | Enable work types API endpoints |

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

All tests:
```powershell
npm test
```

Specific test suite:
```powershell
npm test -- tests/ordersFetchList.test.js
```

## Dev helpers / seeding

Insert orders for a specific vendor:

```powershell
node .\scripts\insert_orders_for_vendor.js <VENDOR_ID>
```

Seed fake vendors and orders:

```powershell
node .\scripts\seed_fake_orders.js
```

## API Authentication

### Vendor Authentication (JWT)
Used for vendor-facing endpoints (`/api/orders/fetchlist`, `/api/earnings/*`, etc.)

```bash
Authorization: Bearer <JWT_TOKEN>
```

### Service Authentication (API Key)
Used for backend-to-backend proxy endpoints:

**Earnings Proxy:** `/api/proxy/earnings/*`
```bash
x-internal-key: <INTERNAL_API_KEY>
```

**Fetchlist Proxy:** `/api/orders/fetchlist/vendor/:vendorId`
```bash
X-Service-Token: <SERVICE_API_KEY>
```

## Generating Secure Keys

### PowerShell (Windows)
```powershell
# Generate a 32-byte (256-bit) random key in base64
[Convert]::ToBase64String((1..32 | ForEach-Object { Get-Random -Maximum 256 }))

# Generate a 64-byte (512-bit) random key in hex
-join ((1..64) | ForEach-Object { '{0:x2}' -f (Get-Random -Maximum 256) })

# Generate using .NET SecureRandom (recommended)
Add-Type -AssemblyName System.Security
$rng = [System.Security.Cryptography.RNGCryptoServiceProvider]::new()
$bytes = [byte[]]::new(32)
$rng.GetBytes($bytes)
[Convert]::ToBase64String($bytes)
```

### Linux/macOS (Bash)
```bash
# Generate a 32-byte random key in base64
openssl rand -base64 32

# Generate a 64-byte random key in hex
openssl rand -hex 64

# Using /dev/urandom
head -c 32 /dev/urandom | base64
```

### Node.js
```javascript
// Generate in Node.js REPL or script
require('crypto').randomBytes(32).toString('base64')
require('crypto').randomBytes(64).toString('hex')
```

### Online (Use with Caution)
```bash
# Using 1Password CLI
op generate --length=32 --symbols

# Using LastPass CLI
lpass generate --length=32 --no-symbols
```

### Recommended Key Lengths
- **JWT_SECRET**: 32+ bytes (256+ bits)
- **INTERNAL_API_KEY**: 32+ bytes (256+ bits)
- **SERVICE_API_KEY**: 32+ bytes (256+ bits)
- **MOCK_ORDERS_SECRET**: 16+ bytes (128+ bits)

## Notes & Security
- ⚠️ **Never commit `.env` or any secret files to version control**
- Use different keys for development, staging, and production
- Rotate API keys periodically (every 90 days recommended)
- Use a secrets manager (AWS Secrets Manager, HashiCorp Vault) for production
- Keep JWT_SECRET at least 32 characters long
- Use strong, random values for all API keys (generated with crypto-safe methods)
- Never share keys via email, Slack, or insecure channels
- Use environment-specific keys (never reuse across environments)

## Troubleshooting

### MongoDB Connection Issues
- Ensure MongoDB is running locally or connection string is correct
- Check firewall settings for cloud MongoDB (Atlas)

### JWT Token Errors
- Verify `JWT_SECRET` matches between environments
- Check token expiration (default: 30 days)

### Service Auth Failures
- Confirm `SERVICE_API_KEY` is set in environment
- Verify header name is exactly `X-Service-Token` (case-sensitive)

### File Upload Issues
- Ensure `UPLOAD_DIR` exists and has write permissions
- On Vercel/serverless, use cloud storage instead (uploads don't persist)

## Related Documentation

- [API Fetchlist Endpoints](./patches/API_FETCHLIST_ENDPOINTS.md)
- [API Earnings Endpoints](./patches/API_patch_earning.md)
- [Mobile App API Guide](./patches/MOBILE_APP_API_GUIDE.md)
- [Server Structure](./patches/structure_server/Server_v3.md)

