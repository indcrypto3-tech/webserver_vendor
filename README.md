# Vendor Backend Server

A flexible, modular Node.js/Express backend for vendor management with MongoDB, JWT authentication, OTP verification, and local file uploads. Designed to be integrated into existing projects with easy extensibility.

## Features

- ✅ **MongoDB** with Mongoose ODM
- ✅ **JWT Authentication** with Bearer tokens
- ✅ **OTP Verification** (4-digit, in-memory for dev)
- ✅ **File Uploads** using Multer (local storage, extensible to S3/GCS)
- ✅ **Modular Architecture** (routes, models, middleware, utils)
- ✅ **RESTful API** with JSON responses
- ✅ **CORS Enabled**
- ✅ **Environment Configuration** via `.env`

## Tech Stack

- **Runtime**: Node.js >= 16.0.0
- **Framework**: Express.js
- **Database**: MongoDB + Mongoose
- **Authentication**: JWT (jsonwebtoken)
- **File Upload**: Multer
- **Environment**: dotenv

## Project Structure

```
backend_server/
├── config/
│   └── index.js           # Environment configuration
├── middleware/
│   ├── auth.js            # JWT authentication middleware
│   └── upload.js          # Multer file upload configuration
├── models/
│   └── vendor.js          # Mongoose Vendor schema
├── routes/
│   ├── auth.js            # OTP send/verify endpoints
│   └── vendors.js         # Vendor CRUD endpoints
├── utils/
│   ├── jwt.js             # JWT sign/verify helpers
│   └── otpStore.js        # In-memory OTP storage (dev-only)
├── uploads/               # Local file storage (auto-created)
├── .env.example           # Environment variables template
├── package.json           # Dependencies and scripts
├── server.js              # Main application entry point
└── README.md              # This file
```

## Installation

### 1. Clone or Copy Files

Copy this backend server directory into your project.

### 2. Install Dependencies

```bash
npm install
```

### 3. Configure Environment

Copy `.env.example` to `.env` and configure your settings:

```bash
cp .env.example .env
```

Edit `.env`:

```env
PORT=3000
MONGO_URI=mongodb://localhost:27017/vendor-db
JWT_SECRET=your-super-secret-jwt-key-change-in-production
UPLOAD_DIR=uploads
```

### 4. Start MongoDB

Ensure MongoDB is running locally or use a cloud MongoDB service (MongoDB Atlas).

```bash
# If using local MongoDB
mongod
```

### 5. Run the Server

**Development mode** (with auto-restart):

```bash
npm run dev
```

**Production mode**:

```bash
npm start
```

Server will start at `http://localhost:3000`

## API Endpoints

### Authentication

#### 1. Send OTP

Send a 4-digit OTP to a mobile number (dev-only: logged to console).

```bash
curl -X POST http://localhost:3000/api/auth/send-otp \
  -H "Content-Type: application/json" \
  -d "{\"mobile\": \"1234567890\"}"
```

**Response:**
```json
{
  "message": "OTP sent (dev-only)",
  "otp": "1234"
}
```

#### 2. Verify OTP

Verify the OTP code and receive a JWT token.

```bash
curl -X POST http://localhost:3000/api/auth/verify-otp \
  -H "Content-Type: application/json" \
  -d "{\"mobile\": \"1234567890\", \"code\": \"1234\"}"
```

**Response (existing vendor):**
```json
{
  "message": "verified",
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "vendorId": "507f1f77bcf86cd799439011",
  "vendor": { ... }
}
```

**Response (new user):**
```json
{
  "message": "verified",
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "vendorId": null
}
```

### Vendor Management

#### 3. Create Vendor

Create a new vendor profile with optional file uploads.

```bash
curl -X POST http://localhost:3000/api/vendors \
  -F "vendorName=John Doe" \
  -F "mobile=1234567890" \
  -F "gender=male" \
  -F "businessName=John's Services" \
  -F "businessAddress=123 Main St" \
  -F "businessType=Plumbing" \
  -F "selectedServices=[\"Pipe Repair\",\"Installation\"]" \
  -F "profile=@/path/to/profile.jpg" \
  -F "id=@/path/to/id-card.jpg" \
  -F "cert=@/path/to/certificate.jpg"
```

**Response:**
```json
{
  "message": "Vendor created successfully",
  "vendor": {
    "_id": "507f1f77bcf86cd799439011",
    "vendorName": "John Doe",
    "mobile": "1234567890",
    "mobileVerified": true,
    "gender": "male",
    "businessName": "John's Services",
    "businessAddress": "123 Main St",
    "businessType": "Plumbing",
    "selectedServices": ["Pipe Repair", "Installation"],
    "identityImages": {
      "profile": "/uploads/profile-1234567890-123456789.jpg",
      "id": "/uploads/id-card-1234567890-987654321.jpg",
      "cert": "/uploads/certificate-1234567890-456789123.jpg"
    },
    "createdAt": "2025-11-24T10:00:00.000Z",
    "updatedAt": "2025-11-24T10:00:00.000Z"
  },
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
}
```

#### 4. Get Current Vendor Profile

Get the authenticated vendor's profile (requires JWT token).

```bash
curl -X GET http://localhost:3000/api/vendors/me \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

**Response:**
```json
{
  "vendor": {
    "_id": "507f1f77bcf86cd799439011",
    "vendorName": "John Doe",
    "mobile": "1234567890",
    ...
  }
}
```

#### 5. Update Current Vendor Profile

Update the authenticated vendor's profile with partial data and optional file uploads.

```bash
curl -X PATCH http://localhost:3000/api/vendors/me \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -F "businessName=Updated Business Name" \
  -F "selectedServices=[\"New Service\",\"Another Service\"]" \
  -F "profile=@/path/to/new-profile.jpg"
```

**Response:**
```json
{
  "message": "Vendor updated successfully",
  "vendor": { ... }
}
```

### Health Check

```bash
curl http://localhost:3000/health
```

**Response:**
```json
{
  "status": "ok",
  "timestamp": "2025-11-24T10:00:00.000Z",
  "uptime": 123.456
}
```

## Data Models

### Vendor Schema

```javascript
{
  vendorName: String (required),
  mobile: String (required, unique),
  mobileVerified: Boolean (default: false),
  gender: String (enum: 'male', 'female', 'other', ''),
  businessName: String,
  businessAddress: String,
  businessType: String (indexed),
  selectedServices: [String],
  identityImages: {
    profile: String,
    id: String,
    cert: String
  },
  createdAt: Date (auto),
  updatedAt: Date (auto)
}
```

**Indexes:**
- `mobile` (unique)
- `businessType` (indexed for faster queries)

## File Uploads

### Current Implementation: Local Storage

Files are stored in the `uploads/` directory using Multer.

**Constraints:**
- Accepted formats: `jpeg`, `jpg`, `png`, `webp`
- Max file size: **25MB** per file
- Fields: `profile`, `id`, `cert`

**Accessing uploaded files:**
```
http://localhost:3000/uploads/filename.jpg
```

### Switching to S3/GCS (Future)

To switch from local storage to cloud storage:

1. Create `utils/storageAdapter.js`:
```javascript
// Example S3 adapter
async function uploadFile(file, folder) {
  // Use AWS SDK to upload to S3
  // Return public URL
}
```

2. Update `middleware/upload.js`:
```javascript
// Replace multer.diskStorage with multer.memoryStorage
// Call storageAdapter.uploadFile() in route handlers
```

3. Update route handlers in `routes/vendors.js`:
```javascript
// Instead of saving local paths, save S3 URLs
```

**NOTE**: Local file uploads are **not suitable for serverless deployments** (e.g., Vercel, AWS Lambda). Use a standard Node.js host (e.g., DigitalOcean, Heroku, Railway) or switch to S3/GCS.

## Authentication Flow

1. **Send OTP**: Client sends mobile number → Server generates 4-digit OTP → OTP stored in-memory (logged to console)
2. **Verify OTP**: Client sends mobile + OTP → Server verifies → Issues JWT token
   - If vendor exists: Returns vendor data + token with `vendorId`
   - If vendor doesn't exist: Returns token with `mobile` only
3. **Create Vendor**: Client sends vendor data with token → Server creates vendor → Returns vendor + updated token
4. **Protected Routes**: Client includes `Authorization: Bearer <token>` → Server validates JWT → Grants access

## Security Notes

### Development vs Production

**Current setup is for DEVELOPMENT:**
- OTP is stored in-memory (not suitable for multi-instance deployments)
- OTP is logged to console
- JWT secret should be a strong, random value in production

**For Production:**
- Replace in-memory OTP store with **Redis** or similar distributed cache
- Integrate real SMS provider (Twilio, AWS SNS, etc.)
- Use environment-specific secrets (never commit `.env` to version control)
- Add rate limiting for OTP endpoints
- Add request validation and sanitization
- Enable HTTPS
- Consider adding refresh tokens

### TODO: Production Hardening

See inline comments in the code marked with `TODO:` for areas requiring production hardening:
- `utils/otpStore.js`: Replace with Redis for multi-instance deployments
- `middleware/upload.js`: Swap local storage with S3/GCS adapter
- Add rate limiting middleware
- Add request validation with libraries like Joi or express-validator
- Add logging with Winston or similar
- Add monitoring/error tracking (Sentry, etc.)

## Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `PORT` | Server port | `3000` |
| `MONGO_URI` | MongoDB connection string | `mongodb://localhost:27017/vendor-db` |
| `JWT_SECRET` | Secret key for JWT signing | `dev-secret-key` |
| `UPLOAD_DIR` | Directory for file uploads | `uploads` |

## Deployment

### Standard Node.js Hosting (Recommended for file uploads)

Works on:
- **DigitalOcean App Platform**
- **Heroku**
- **Railway**
- **AWS EC2 / Elastic Beanstalk**
- **Google Cloud Run** (with persistent storage)

Steps:
1. Set environment variables on your platform
2. Ensure MongoDB is accessible (use MongoDB Atlas for cloud DB)
3. Deploy code
4. Server will auto-create `uploads/` directory

### Serverless Platforms (Vercel, AWS Lambda)

⚠️ **Local file uploads won't work on serverless platforms** because the filesystem is ephemeral.

**Solution**: Switch to S3/GCS before deploying to serverless (see "Switching to S3/GCS" section above).

## Testing with Postman

1. Import the API endpoints from this README
2. Set up environment variables in Postman:
   - `BASE_URL`: `http://localhost:3000`
   - `TOKEN`: (save after verify-otp response)
3. Test the flow: send-otp → verify-otp → create vendor → get/update vendor

## Troubleshooting

### MongoDB Connection Error

```
Error: connect ECONNREFUSED 127.0.0.1:27017
```

**Solution**: Ensure MongoDB is running. Start it with `mongod` or check your `MONGO_URI` in `.env`.

### File Upload Error: "LIMIT_FILE_SIZE"

```
File too large. Maximum size is 25MB
```

**Solution**: Reduce file size or increase `maxFileSize` in `config/index.js`.

### JWT Verification Failed

```
Invalid or expired token
```

**Solution**: Token may be expired (30 days by default). Request a new token via verify-otp.

### Vendor Already Exists (409 Conflict)

```
Vendor with this mobile number already exists
```

**Solution**: Mobile number must be unique. Use a different number or update existing vendor via PATCH `/api/vendors/me`.

## Integration into Existing Projects

This backend is designed to be modular and easy to integrate:

1. Copy the entire `backend_server/` directory into your project
2. Run `npm install` in the directory
3. Configure `.env` with your settings
4. Start the server with `npm run dev`
5. Your existing frontend/mobile app can call these APIs

**No hardcoded paths** - all paths use environment variables and `path.join()`.

## License

ISC

## Support

For issues or questions, please refer to the inline code comments or extend functionality as needed. This server is designed to be flexible and modular for easy customization.

---

**Happy Coding!** 🚀
