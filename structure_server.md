# Server Structure & API Endpoints Documentation

**Base URL:** `https://webserver-vendor.vercel.app`  
**Version:** 1.0.0  
**Last Updated:** November 24, 2025

---

## Table of Contents

1. [Project Structure](#project-structure)
2. [API Endpoints Overview](#api-endpoints-overview)
3. [Authentication Endpoints](#authentication-endpoints)
4. [Vendor Endpoints](#vendor-endpoints)
5. [Utility Endpoints](#utility-endpoints)
6. [Data Models](#data-models)
7. [Error Responses](#error-responses)

---

## Project Structure

```
backend_server/
├── config/
│   └── index.js                    # Environment configuration & constants
├── controllers/
│   └── vendorController.js         # Business logic for vendor operations
├── middleware/
│   ├── auth.js                     # JWT authentication middleware
│   └── upload.js                   # Multer file upload configuration
├── models/
│   └── vendor.js                   # Mongoose Vendor schema
├── routes/
│   ├── auth.js                     # Authentication routes (OTP)
│   └── vendors.js                  # Vendor CRUD routes
├── tests/
│   ├── setup.js                    # Test configuration & database setup
│   └── vendorProfile.test.js       # Vendor profile endpoint tests
├── utils/
│   ├── jwt.js                      # JWT sign/verify helpers
│   └── otpStore.js                 # In-memory OTP storage
├── uploads/                        # Local file storage directory
├── .env                            # Environment variables (not in git)
├── .env.example                    # Environment template
├── jest.config.js                  # Jest testing configuration
├── package.json                    # Dependencies
├── server.js                       # Main application entry
└── README.md                       # Documentation
```

---

## API Endpoints Overview

| Method | Endpoint | Authentication | Purpose |
|--------|----------|----------------|---------|
| GET | `/` | No | API information |
| GET | `/health` | No | Health check |
| POST | `/api/auth/send-otp` | No | Send OTP to mobile |
| POST | `/api/auth/verify-otp` | No | Verify OTP & get JWT |
| POST | `/api/vendors` | No | Create vendor profile |
| GET | `/api/vendors/me` | Yes | Get current vendor |
| PATCH | `/api/vendors/me` | Yes | Update current vendor |
| GET | `/api/work-types` | No | Get available work types |
| POST | `/api/vendors/me/work-types` | Yes | Update vendor work types |
| POST | `/api/auth/verify-otp` | No | Verify OTP & get JWT |
| POST | `/api/vendors` | No | Create vendor profile |
| GET | `/api/vendors/me` | Yes | Get current vendor |
| PATCH | `/api/vendors/me` | Yes | Update current vendor |

---

## Authentication Endpoints

### 1. Send OTP

**Purpose:** Generate and send a 4-digit OTP to a mobile number for authentication.

**Endpoint:** `POST /api/auth/send-otp`

**Authentication:** None required

**Request Body:**
```json
{
  "mobile": "9876543210"
}
```

**Success Response (200):**
```json
{
  "message": "OTP sent (dev-only)",
  "otp": "1234"
}
```

**Error Responses:**
- `400` - Mobile number missing or invalid

**Usage:**
- First step in authentication flow
- OTP is fixed to `1234` in development
- In production, integrate real SMS provider
- OTP expires after 5 minutes
- Stored in-memory (not persisted to database)

**Implementation Details:**
- File: `routes/auth.js`
- Uses: `utils/otpStore.js` for OTP generation and storage
- Configuration: `config/index.js` (OTP length, expiry time)

---

### 2. Verify OTP

**Purpose:** Verify the OTP code and issue a JWT token. Returns vendor data if exists.

**Endpoint:** `POST /api/auth/verify-otp`

**Authentication:** None required

**Request Body:**
```json
{
  "mobile": "9876543210",
  "code": "1234"
}
```

**Success Response - Existing Vendor (200):**
```json
{
  "message": "verified",
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "vendorId": "673c8a1f2e4b5c001a2f3d4e",
  "vendor": {
    "_id": "673c8a1f2e4b5c001a2f3d4e",
    "vendorName": "John Doe",
    "mobile": "9876543210",
    "mobileVerified": true,
    "gender": "male",
    "businessName": "John's Services",
    "businessAddress": "123 Main St",
    "businessType": "Plumbing",
    "selectedServices": ["Pipe Repair", "Installation"],
    "identityImages": {
      "profile": "/uploads/profile-123.jpg",
      "id": "/uploads/id-456.jpg",
      "cert": "/uploads/cert-789.jpg"
    },
    "createdAt": "2025-11-24T10:00:00.000Z",
    "updatedAt": "2025-11-24T10:00:00.000Z"
  }
}
```

**Success Response - New User (200):**
```json
{
  "message": "verified",
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "vendorId": null
}
```

**Error Responses:**
- `400` - Mobile or code missing
- `400` - Invalid OTP code
- `400` - OTP expired

**Usage:**
- Second step in authentication flow
- Returns JWT token valid for 30 days
- If vendor exists: marks mobile as verified, returns vendor data
- If new user: returns token with mobile only (vendorId = null)
- Client should check `vendorId` to determine if profile needs creation

**Implementation Details:**
- File: `routes/auth.js`
- Uses: `utils/otpStore.js` for OTP verification
- Uses: `utils/jwt.js` for token generation
- Uses: `models/vendor.js` to check if vendor exists

---

## Vendor Endpoints

### 3. Create Vendor Profile

**Purpose:** Create a new vendor profile with business details and optional identity images.

**Endpoint:** `POST /api/vendors`

**Authentication:** None required (but should have verified mobile via OTP)

**Content-Type:** `multipart/form-data`

**Request Fields:**

**Required:**
- `vendorName` (string) - Full name of vendor
- `mobile` (string) - Mobile number (must be unique)

**Optional Text Fields:**
- `gender` (string) - Gender: "male", "female", "other", or empty (case-insensitive)
- `businessName` (string) - Name of business
- `businessAddress` (string) - Full business address
- `businessType` (string) - Type of business (e.g., "Plumbing", "Electrical")
- `selectedServices` (string) - JSON array or CSV (e.g., `["Service1","Service2"]`)

**Optional Files:**
- `profile` (file) - Profile photo (JPEG/PNG/WEBP, max 25MB)
- `id` (file) - ID card image (JPEG/PNG/WEBP, max 25MB)
- `cert` (file) - Certificate image (JPEG/PNG/WEBP, max 25MB)

**Success Response (201):**
```json
{
  "ok": true,
  "message": "Vendor created successfully",
  "data": {
    "_id": "673c8a1f2e4b5c001a2f3d4e",
    "vendorName": "John Doe",
    "mobile": "9876543210",
    "mobileVerified": true,
    "gender": "male",
    "businessName": "John's Services",
    "businessAddress": "123 Main St, City",
    "businessType": "Plumbing",
    "selectedServices": ["Pipe Repair", "Installation"],
    "identityImages": {
      "profile": "/uploads/profile-1234567890.jpg",
      "id": "/uploads/id-1234567890.jpg",
      "cert": "/uploads/cert-1234567890.jpg"
    },
    "createdAt": "2025-11-24T10:00:00.000Z",
    "updatedAt": "2025-11-24T10:00:00.000Z"
  },
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
}
```

**Error Responses:**

`400 Bad Request` - Missing required fields:
```json
{
  "ok": false,
  "error": "vendorName and mobile are required"
}
```

`400 Bad Request` - Validation error:
```json
{
  "ok": false,
  "error": "Validation error",
  "details": ["vendorName must not exceed 100 characters"]
}
```

`409 Conflict` - Duplicate mobile:
```json
{
  "ok": false,
  "error": "Vendor with this mobile number already exists"
}
```

`500 Server Error`:
```json
{
  "ok": false,
  "error": "Server error occurred while creating vendor"
}
```

**Usage:**
- Third step in onboarding flow (after OTP verification)
- Creates vendor profile in database
- Uploads and stores identity images
- Returns new JWT token with vendorId
- Sets `mobileVerified: true` automatically
- Gender field is normalized to lowercase before saving

**Implementation Details:**
- Controller: `controllers/vendorController.js`
- Routes: `routes/vendors.js`
- Uses: `middleware/upload.js` for file handling
- Uses: `models/vendor.js` for database operations
- Uses: `utils/jwt.js` for token generation
- Helper functions: `parseSelectedServices()`, `getFilePaths()`, `normalizeGender()`, `sanitizeString()`
- Validation: Mobile format (10 digits), vendorName length, input sanitization

---

### 4. Get Current Vendor Profile

**Purpose:** Retrieve the authenticated vendor's complete profile data.

**Endpoint:** `GET /api/vendors/me`

**Authentication:** Required (JWT Bearer token)

**Request Headers:**
```
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

**Success Response (200):**
```json
{
  "ok": true,
  "data": {
    "_id": "673c8a1f2e4b5c001a2f3d4e",
    "vendorName": "John Doe",
    "mobile": "9876543210",
    "mobileVerified": true,
    "gender": "male",
    "businessName": "John's Services",
    "businessAddress": "123 Main St",
    "businessType": "Plumbing",
    "selectedServices": ["Pipe Repair", "Installation"],
    "identityImages": {
      "profile": "/uploads/profile-123.jpg",
      "id": "/uploads/id-456.jpg",
      "cert": "/uploads/cert-789.jpg"
    },
    "createdAt": "2025-11-24T10:00:00.000Z",
    "updatedAt": "2025-11-24T10:00:00.000Z"
  }
}
```

**Error Responses:**

`401 Unauthorized` - Missing or invalid token:
```json
{
  "message": "Authorization token required"
}
```

`404 Not Found` - Vendor profile not created yet:
```json
{
  "ok": false,
  "error": "Vendor profile not created yet"
}
```

`500 Server Error`:
```json
{
  "ok": false,
  "error": "Server error occurred while fetching profile"
}
```

**Usage:**
- Fetch current user's profile data
- Display profile information in app
- Check profile completion status
- Load vendor dashboard
- Verify authentication status

**Implementation Details:**
- File: `controllers/vendorController.js`
- Routes: `routes/vendors.js`
- Uses: `middleware/auth.js` to verify JWT and load vendor
- Returns vendor data from `req.user` (set by auth middleware)
- Excludes sensitive internal fields

---

### 5. Update Vendor Profile

**Purpose:** Update the authenticated vendor's profile with partial data and/or new images.

**Endpoint:** `PATCH /api/vendors/me`

**Authentication:** Required (JWT Bearer token)

**Content-Type:** `multipart/form-data` or `application/json`

**Request Headers:**
```
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

**Editable Fields:**

| Field | Type | Validation | Example |
|-------|------|------------|--------|
| `vendorName` | string | Required, 1-100 chars | "John Doe" |
| `gender` | string | Optional: "male", "female", "other", "" (case-insensitive) | "male" or "FEMALE" |
| `businessName` | string | Optional, any length | "John's Services" |
| `businessAddress` | string | Optional, any length | "123 Main St, City" |
| `businessType` | string | Optional, any length | "Plumbing" |
| `selectedServices` | array/string | Optional, accepts array, JSON string, or CSV | `["Service1"]` or `"Service1, Service2"` |
| `profile` | file | Optional, image only, max 25MB | profile.jpg |
| `id` | file | Optional, image only, max 25MB | id_card.png |
| `cert` | file | Optional, image only, max 25MB | certificate.jpg |

**Note:** 
- Only send fields you want to update. Partial updates are supported.
- Fields not sent will remain unchanged.
- Mobile number (`mobile`) cannot be changed via this endpoint.
- All text inputs are sanitized to prevent XSS attacks.
- Gender is automatically normalized to lowercase.

**Example Request (JSON):**
```json
{
  "vendorName": "Updated Name",
  "businessName": "New Business Name",
  "selectedServices": ["Service A", "Service B"]
}
```

**Example Request (Form Data with File):**
```bash
curl -X PATCH https://webserver-vendor.vercel.app/api/vendors/me \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -F "vendorName=Updated Name" \
  -F "businessName=New Business" \
  -F "profile=@/path/to/photo.jpg"
```

**Success Response (200):**
```json
{
  "ok": true,
  "data": {
    "_id": "673c8a1f2e4b5c001a2f3d4e",
    "vendorName": "Updated Name",
    "mobile": "9876543210",
    "mobileVerified": true,
    "gender": "male",
    "businessName": "New Business Name",
    "businessAddress": "New Address 456",
    "businessType": "Plumbing",
    "selectedServices": ["Service A", "Service B"],
    "identityImages": {
      "profile": "/uploads/profile-updated.jpg",
      "id": "/uploads/id-456.jpg",
      "cert": "/uploads/cert-789.jpg"
    },
    "createdAt": "2025-11-24T10:00:00.000Z",
    "updatedAt": "2025-11-24T12:30:00.000Z"
  }
}
```

**Error Responses:**

`400 Bad Request` - Validation error:
```json
{
  "ok": false,
  "error": "Validation failed",
  "details": [
    "vendorName must be a non-empty string",
    "vendorName must not exceed 100 characters"
  ]
}
```

`400 Bad Request` - No fields provided:
```json
{
  "ok": false,
  "error": "No valid fields provided for update"
}
```

`400 Bad Request` - Invalid gender:
```json
{
  "ok": false,
  "error": "Validation failed",
  "details": [
    "gender must be one of: male, female, other, or empty string"
  ]
}
```

`401 Unauthorized` - Missing token:
```json
{
  "message": "Authorization token required"
}
```

`404 Not Found` - Profile not created:
```json
{
  "ok": false,
  "error": "Vendor profile not created yet. Use POST /api/vendors to create."
}
```

`500 Server Error`:
```json
{
  "ok": false,
  "error": "Server error occurred while updating profile"
}
```

**Validation Rules:**

1. **vendorName:**
   - Must be a non-empty string
   - Maximum 100 characters
   - HTML tags are stripped (sanitized)

2. **gender:**
   - Must be one of: "male", "female", "other", or empty string
   - Case-insensitive ("MALE" becomes "male")
   - Invalid values are rejected

3. **businessName, businessAddress, businessType:**
   - Must be strings
   - HTML tags are stripped (sanitized)
   - No length restrictions

4. **selectedServices:**
   - Accepts array: `["Service1", "Service2"]`
   - Accepts JSON string: `'["Service1", "Service2"]'`
   - Accepts CSV string: `"Service1, Service2, Service3"`

5. **Files (profile, id, cert):**
   - Allowed formats: JPEG, PNG, WEBP
   - Maximum size: 25MB per file
   - Old file is replaced if new one uploaded

**Security Features:**
- JWT authentication required
- Input sanitization (removes HTML/script tags)
- Vendor can only update their own profile
- Protected fields (mobile, mobileVerified, _id) cannot be changed
- File type and size validation

**Usage:**
- Update profile information in settings screen
- Change business details
- Upload new identity images
- Modify service offerings
- Edit personal information

**Implementation Details:**
- Controller: `controllers/vendorController.js`
- Routes: `routes/vendors.js`
- Uses: `middleware/auth.js` for authentication
- Uses: `middleware/upload.js` for file handling
- Only updates fields provided in request
- Files are replaced if new ones uploaded
- Helper functions: `parseSelectedServices()`, `getFilePaths()`, `normalizeGender()`, `sanitizeString()`, `validateVendorUpdate()`

---

## Work Type Endpoints

### 6. Get Available Work Types

**Purpose:** Retrieve the master list of available work types for vendors to choose from.

**Endpoint:** `GET /api/work-types`

**Authentication:** None required

**Success Response (200):**
```json
{
  "ok": true,
  "data": [
    {
      "slug": "plumbing",
      "title": "Plumbing",
      "description": "Pipe repair, installation, and maintenance services",
      "icon": "🔧",
      "isActive": true,
      "createdAt": "2025-11-24T10:00:00.000Z",
      "updatedAt": "2025-11-24T10:00:00.000Z"
    },
    {
      "slug": "electrical",
      "title": "Electrical",
      "description": "Electrical wiring, repairs, and installations",
      "icon": "⚡",
      "isActive": true,
      "createdAt": "2025-11-24T10:00:00.000Z",
      "updatedAt": "2025-11-24T10:00:00.000Z"
    }
  ]
}
```

**Default Work Types (when database is empty):**
- `plumbing` - Plumbing services
- `electrical` - Electrical services
- `carpentry` - Carpentry and woodwork
- `painting` - Painting services
- `cleaning` - Cleaning services
- `gardening` - Gardening and landscaping
- `hvac` - HVAC services
- `appliance-repair` - Appliance repair
- `pest-control` - Pest control
- `handyman` - General handyman services

**Error Response (500):**
```json
{
  "ok": false,
  "error": "Server error occurred while fetching work types"
}
```

**Usage:**
- Display available work types in registration/profile screens
- Allow vendors to select their expertise areas
- Populate dropdown/checkbox lists in mobile app
- No authentication required - public endpoint

**Implementation Details:**
- Controller: `controllers/workTypesController.js`
- Routes: `routes/workTypes.js`
- Model: `models/workType.js`
- Data source: MongoDB `work_types` collection (falls back to hardcoded defaults)
- Auto-seeded on server startup if database is empty
- Only returns active work types (`isActive: true`)
- Sorted alphabetically by title

---

### 7. Update Vendor Work Types

**Purpose:** Update the authenticated vendor's selected work types (areas of expertise).

**Endpoint:** `POST /api/vendors/me/work-types`

**Authentication:** Required (JWT Bearer token)

**Content-Type:** `application/json`

**Request Headers:**
```
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

**Request Body:**
```json
{
  "workTypes": ["plumbing", "electrical", "hvac"]
}
```

**Field Details:**

| Field | Type | Required | Validation |
|-------|------|----------|------------|
| `workTypes` | array | Yes | Must be array of valid slugs from GET /api/work-types |

**Success Response (200):**
```json
{
  "ok": true,
  "data": {
    "_id": "673c8a1f2e4b5c001a2f3d4e",
    "vendorName": "John Doe",
    "mobile": "9876543210",
    "mobileVerified": true,
    "gender": "male",
    "businessName": "John's Services",
    "businessAddress": "123 Main St",
    "businessType": "Plumbing",
    "selectedServices": ["Service1", "Service2"],
    "workTypes": ["plumbing", "electrical", "hvac"],
    "identityImages": {
      "profile": "/uploads/profile-123.jpg",
      "id": "/uploads/id-456.jpg",
      "cert": "/uploads/cert-789.jpg"
    },
    "createdAt": "2025-11-24T10:00:00.000Z",
    "updatedAt": "2025-11-24T12:45:00.000Z"
  }
}
```

**Error Responses:**

`400 Bad Request` - Missing field:
```json
{
  "ok": false,
  "error": "workTypes field is required"
}
```

`400 Bad Request` - Invalid type:
```json
{
  "ok": false,
  "error": "workTypes must be an array"
}
```

`400 Bad Request` - Invalid slugs:
```json
{
  "ok": false,
  "error": "Invalid work type slugs",
  "details": [
    "Invalid slugs: invalid-slug, another-invalid. Valid options: plumbing, electrical, carpentry, painting, cleaning, gardening, hvac, appliance-repair, pest-control, handyman"
  ]
}
```

`401 Unauthorized`:
```json
{
  "message": "Authorization token required"
}
```

`404 Not Found` - Profile not created:
```json
{
  "ok": false,
  "error": "Vendor profile not created yet. Use POST /api/vendors to create."
}
```

**Validation Rules:**

1. **workTypes field:**
   - Must be present in request body
   - Must be an array
   - Can be empty array `[]` (clears all work types)
   - Each item must be a string

2. **Slug validation:**
   - All slugs must exist in the work types master list
   - Validated against database work types if available
   - Falls back to default work types if database is empty
   - Invalid slugs are rejected with detailed error message

3. **Updates:**
   - Replaces entire workTypes array (not additive)
   - Can be updated multiple times
   - Vendor can select multiple work types

**Usage:**
- Set vendor's areas of expertise during onboarding
- Update work types in profile settings
- Clear work types by sending empty array
- Used for vendor search and filtering

**Implementation Details:**
- Controller: `controllers/workTypesController.js`
- Routes: `routes/workTypes.js`
- Uses: `middleware/auth.js` for authentication
- Validates slugs against master work types list
- Updates `workTypes` field in Vendor model
- Returns full updated vendor object

---

## Utility Endpoints

### 8. API Information

**Purpose:** Display API information and available endpoints.

**Endpoint:** `GET /`

**Authentication:** None required

**Success Response (200):**
```json
{
  "message": "Vendor Backend API",
  "version": "1.0.0",
  "endpoints": {
    "auth": {
      "sendOtp": "POST /api/auth/send-otp",
      "verifyOtp": "POST /api/auth/verify-otp"
    },
    "vendors": {
      "create": "POST /api/vendors",
      "getMe": "GET /api/vendors/me",
      "updateMe": "PATCH /api/vendors/me"
    },
    "health": "GET /health"
  }
}
```

**Usage:**
- Quick reference for available endpoints
- API discovery
- Version information

**Implementation Details:**
- File: `server.js`
- Static response with endpoint documentation

---

### 7. Health Check

**Purpose:** Check if the server is running and responsive.

**Endpoint:** `GET /health`

**Authentication:** None required

**Success Response (200):**
```json
{
  "status": "ok",
  "timestamp": "2025-11-24T10:30:45.123Z",
  "uptime": 12345.678
}
```

**Usage:**
- Monitor server availability
- Health checks for deployment platforms
- Load balancer health probes
- Uptime monitoring

**Implementation Details:**
- File: `server.js`
- Returns current timestamp and process uptime

---

## Data Models

### Vendor Schema

**Collection:** `vendors`

**Fields:**

| Field | Type | Required | Unique | Default | Description |
|-------|------|----------|--------|---------|-------------|
| `_id` | ObjectId | Auto | Yes | Auto | MongoDB document ID |
| `vendorName` | String | Yes | No | - | Vendor's full name |
| `mobile` | String | Yes | Yes | - | Mobile number (indexed) |
| `mobileVerified` | Boolean | No | No | false | Mobile verification status |
| `gender` | String | No | No | '' | Gender: male/female/other |
| `businessName` | String | No | No | '' | Name of business |
| `businessAddress` | String | No | No | '' | Business address |
| `businessType` | String | No | No | '' | Type of business (indexed) |
| `selectedServices` | [String] | No | No | [] | Array of service offerings |
| `identityImages.profile` | String | No | No | '' | Profile image path |
| `identityImages.id` | String | No | No | '' | ID card image path |
| `identityImages.cert` | String | No | No | '' | Certificate image path |
| `createdAt` | Date | Auto | No | Auto | Creation timestamp |
| `updatedAt` | Date | Auto | No | Auto | Last update timestamp |

**Indexes:**
- `mobile` - Unique index for fast lookup and uniqueness constraint
- `businessType` - Non-unique index for filtering by business type

**Validation Rules:**
- `vendorName`: Required, trimmed
- `mobile`: Required, unique, trimmed
- `gender`: Enum values (case-insensitive): male, female, other, empty string
- All strings are trimmed before saving

**File:** `models/vendor.js`

---

## Error Responses

### Standard Error Format

All error responses follow this structure:

```json
{
  "message": "Error description"
}
```

### HTTP Status Codes

| Code | Meaning | When Used |
|------|---------|-----------|
| 200 | OK | Successful GET, POST (verify-otp) |
| 201 | Created | Successful POST (create vendor) |
| 400 | Bad Request | Missing required fields, validation errors, invalid OTP |
| 401 | Unauthorized | Missing/invalid/expired JWT token |
| 404 | Not Found | Route not found, vendor not found |
| 409 | Conflict | Duplicate mobile number |
| 500 | Internal Server Error | Database errors, server crashes |

### Common Error Messages

**Authentication Errors:**
- `"Authorization token required"` - No Bearer token in header
- `"Invalid or expired token"` - JWT verification failed
- `"Mobile number is required"` - Missing mobile in request
- `"Mobile and code are required"` - Missing OTP verification data
- `"Invalid OTP code"` - Wrong OTP entered
- `"OTP expired"` - OTP older than 5 minutes

**Validation Errors:**
- `"vendorName and mobile are required"` - Missing required fields
- `"Vendor with this mobile number already exists"` - Duplicate mobile (409)
- `"File too large. Maximum size is 25MB"` - File size exceeded
- `"Invalid file type. Only image/jpeg, image/png, image/webp are allowed"` - Wrong file type

**Not Found Errors:**
- `"Route not found"` - Invalid endpoint (404)
- `"Vendor not found"` - Vendor doesn't exist in database
- `"Vendor profile not created yet"` - Token valid but no profile

---

## Authentication Flow

### Complete Flow Diagram

```
Client                          Server                      Database
  |                               |                             |
  |--POST /api/auth/send-otp----->|                             |
  |  {mobile: "9876543210"}       |                             |
  |                               |--Generate OTP (1234)        |
  |                               |--Store in memory            |
  |<--{otp: "1234"}---------------|                             |
  |                               |                             |
  |--POST /api/auth/verify-otp--->|                             |
  |  {mobile:"...", code:"1234"}  |                             |
  |                               |--Verify OTP                 |
  |                               |--Check vendor-------------->|
  |                               |<--Vendor data (or null)-----|
  |                               |--Generate JWT               |
  |<--{token, vendorId, vendor}---|                             |
  |                               |                             |
  |--POST /api/vendors----------->|                             |
  |  (multipart form data)        |                             |
  |                               |--Validate data              |
  |                               |--Save files                 |
  |                               |--Create vendor------------->|
  |                               |<--Vendor saved--------------|
  |                               |--Generate new JWT           |
  |<--{vendor, token}-------------|                             |
  |                               |                             |
  |--GET /api/vendors/me--------->|                             |
  |  Authorization: Bearer token  |                             |
  |                               |--Verify JWT                 |
  |                               |--Load vendor--------------->|
  |                               |<--Vendor data---------------|
  |<--{vendor}--------------------|                             |
```

---

## Configuration & Environment

### Environment Variables

**File:** `.env`

| Variable | Description | Default | Required |
|----------|-------------|---------|----------|
| `PORT` | Server port | 3000 | No |
| `MONGO_URI` | MongoDB connection string | mongodb://localhost:27017/vendor-db | Yes |
| `JWT_SECRET` | Secret key for JWT signing | - | Yes |
| `UPLOAD_DIR` | Directory for file uploads | uploads | No |
| `NODE_ENV` | Environment (development/production) | development | No |

### Configuration File

**File:** `config/index.js`

**Exports:**
- `port` - Server port (from env)
- `mongoUri` - MongoDB URI (from env)
- `jwtSecret` - JWT secret (from env)
- `uploadDir` - Upload directory (from env)
- `jwtExpiry` - Token expiry (30 days)
- `otpExpiry` - OTP expiry (5 minutes)
- `otpLength` - OTP length (4 digits)
- `maxFileSize` - Max file size (25MB)
- `allowedImageTypes` - Allowed MIME types for images

---

## Middleware

### 1. Authentication Middleware

**File:** `middleware/auth.js`

**Function:** `authenticate(req, res, next)`

**Purpose:** Validates JWT token and attaches vendor to `req.user`

**Usage:**
```javascript
router.get('/api/vendors/me', authenticate, handler);
```

**Process:**
1. Extract token from `Authorization: Bearer <token>` header
2. Verify token using JWT secret
3. If token contains `vendorId`: load vendor from database
4. If token contains only `mobile`: attach mobile to `req.user`
5. Call `next()` to proceed to route handler

**Sets:**
- `req.user` - Vendor document (if vendorId in token)
- `req.user.mobile` - Mobile number (if only mobile in token)
- `req.user.isPreRegistration` - True if vendor not created yet

---

### 2. File Upload Middleware

**File:** `middleware/upload.js`

**Function:** `uploadIdentityImages`

**Purpose:** Handle multipart file uploads with validation

**Accepts:**
- `profile` - Profile photo (1 file max)
- `id` - ID card (1 file max)
- `cert` - Certificate (1 file max)

**Validation:**
- File types: JPEG, JPG, PNG, WEBP only
- Max size: 25MB per file
- Generates unique filenames: `basename-timestamp-random.ext`

**Usage:**
```javascript
router.post('/api/vendors', uploadIdentityImages, handleUploadErrors, handler);
```

**Storage:**
- Local: Saves to `uploads/` directory
- TODO: Replace with cloud storage (S3/Cloudinary) for production

---

## Utilities

### 1. JWT Utilities

**File:** `utils/jwt.js`

**Functions:**
- `signToken(payload)` - Create JWT with 30-day expiry
- `verifyToken(token)` - Verify and decode JWT

**Payload Structure:**
```javascript
{
  vendorId: "673c8a1f...",  // MongoDB ObjectId (or null)
  mobile: "9876543210"       // Mobile number
}
```

---

### 2. OTP Store

**File:** `utils/otpStore.js`

**Type:** In-memory Map (development only)

**Functions:**
- `sendOtp(mobile)` - Generate and store OTP
- `verifyOtp(mobile, code)` - Verify OTP code

**OTP Generation:**
- Development: Always returns `1234`
- Production: Random 4-digit number

**Storage Structure:**
```javascript
Map {
  "9876543210" => { code: "1234", expiresAt: 1732456789000 }
}
```

**Cleanup:** Auto-cleanup every 10 minutes

**TODO:** Replace with Redis for production/multi-instance deployments

---

## Deployment Notes

### Vercel (Current)

**Pros:**
- Easy deployment
- Auto-scaling
- Free tier available

**Cons:**
- File uploads don't persist (serverless filesystem)
- In-memory OTP store may not work across instances

**Workaround:**
- File uploads work during request but disappear after
- Use cloud storage (Cloudinary/S3) for permanent files

### Alternative Hosting (Recommended for File Uploads)

**Railway / Render / Heroku:**
- Traditional hosting with persistent filesystem
- No code changes needed
- File uploads work permanently

---

## Testing

### Automated Testing

**Framework:** Jest + Supertest  
**Test Files:** `tests/vendorProfile.test.js`

**Run Tests:**
```bash
# Run all tests with coverage
npm test

# Run tests in watch mode
npm run test:watch
```

**Test Coverage:**
- ✅ GET /api/vendors/me
  - Authentication validation
  - Pre-registration state handling
  - Profile retrieval with correct response format
  - Complete field verification
- ✅ PATCH /api/vendors/me
  - Authentication validation
  - Field validation (vendorName, gender, etc.)
  - Partial updates
  - Multiple field updates
  - selectedServices parsing (array, JSON, CSV)
  - Gender normalization
  - HTML/XSS sanitization
  - Protected field isolation
  - Timestamp updates

**Test Database:**
- Uses mongodb-memory-server for isolated testing
- Automatic setup/teardown
- No external database required

### Manual API Testing

**Quick Test Commands:**

```bash
# Health check
curl https://webserver-vendor.vercel.app/health

# Send OTP
curl -X POST https://webserver-vendor.vercel.app/api/auth/send-otp \
  -H "Content-Type: application/json" \
  -d '{"mobile": "9876543210"}'

# Verify OTP
curl -X POST https://webserver-vendor.vercel.app/api/auth/verify-otp \
  -H "Content-Type: application/json" \
  -d '{"mobile": "9876543210", "code": "1234"}'

# Create vendor (save token from verify-otp)
curl -X POST https://webserver-vendor.vercel.app/api/vendors \
  -F "vendorName=Test User" \
  -F "mobile=9876543210" \
  -F "businessName=Test Business"

# Get profile
curl -X GET https://webserver-vendor.vercel.app/api/vendors/me \
  -H "Authorization: Bearer YOUR_TOKEN"

# Update profile
curl -X PATCH https://webserver-vendor.vercel.app/api/vendors/me \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"vendorName": "Updated Name", "businessName": "New Business"}'
```

---

## Version History

**v1.1.0** (November 24, 2025)
- ✨ NEW: Controllers layer for separation of concerns
- ✨ NEW: Comprehensive input validation and sanitization
- ✨ NEW: Automated test suite with Jest
- 🔄 CHANGED: Response format to `{ok, data/error}` structure
- 🔄 CHANGED: Enhanced error messages with validation details
- ✅ FIXED: Security improvements (XSS protection)
- ✅ FIXED: Vendor profile endpoints now fully stable and documented

**v1.0.0** (November 24, 2025)
- Initial release
- Authentication with OTP
- Vendor CRUD operations
- File upload support
- JWT authentication
- MongoDB integration

---

## Support & Documentation

- **API Guide for Mobile Apps:** `MOBILE_APP_API_GUIDE.md`
- **Testing Guide:** `test-api.md`
- **Setup Instructions:** `README.md`
- **Repository:** https://github.com/indcrypto3-tech/webserver_vendor
