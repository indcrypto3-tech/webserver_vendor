# API Testing Guide

Base URL: `https://webserver-vendor.vercel.app`

## 1. Health Check

```bash
curl https://webserver-vendor.vercel.app/health
```

**Expected Response:**
```json
{
  "status": "ok",
  "timestamp": "2025-11-24T...",
  "uptime": 123.456
}
```

---

## 2. Send OTP

```bash
curl -X POST https://webserver-vendor.vercel.app/api/auth/send-otp ^
  -H "Content-Type: application/json" ^
  -d "{\"mobile\": \"9876543210\"}"
```

**Expected Response:**
```json
{
  "message": "OTP sent (dev-only)",
  "otp": "1234"
}
```

**Note:** Copy the OTP code from the response or check Vercel logs.

---

## 3. Verify OTP

Replace `1234` with the actual OTP from step 2:

```bash
curl -X POST https://webserver-vendor.vercel.app/api/auth/verify-otp ^
  -H "Content-Type: application/json" ^
  -d "{\"mobile\": \"9876543210\", \"code\": \"1234\"}"
```

**Expected Response (New User):**
```json
{
  "message": "verified",
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "vendorId": null
}
```

**Save the token for next steps!**

---

## 4. Create Vendor Profile

Replace `YOUR_TOKEN` with the token from step 3:

**Without files:**
```bash
curl -X POST https://webserver-vendor.vercel.app/api/vendors ^
  -H "Content-Type: application/json" ^
  -d "{\"vendorName\": \"John Doe\", \"mobile\": \"9876543210\", \"businessName\": \"John's Services\", \"businessType\": \"Plumbing\", \"selectedServices\": [\"Pipe Repair\", \"Installation\"]}"
```

**With files (multipart):**
```bash
curl -X POST https://webserver-vendor.vercel.app/api/vendors ^
  -F "vendorName=John Doe" ^
  -F "mobile=9876543210" ^
  -F "gender=male" ^
  -F "businessName=John's Services" ^
  -F "businessAddress=123 Main St, City" ^
  -F "businessType=Plumbing" ^
  -F "selectedServices=[\"Pipe Repair\",\"Installation\",\"Maintenance\"]" ^
  -F "profile=@C:\path\to\your\image.jpg"
```

**Expected Response:**
```json
{
  "message": "Vendor created successfully",
  "vendor": {
    "_id": "...",
    "vendorName": "John Doe",
    "mobile": "9876543210",
    "mobileVerified": true,
    "businessName": "John's Services",
    ...
  },
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
}
```

**Save the new token!**

---

## 5. Get Current Vendor Profile

Replace `YOUR_TOKEN` with the token from step 4:

```bash
curl -X GET https://webserver-vendor.vercel.app/api/vendors/me ^
  -H "Authorization: Bearer YOUR_TOKEN"
```

**Expected Response:**
```json
{
  "vendor": {
    "_id": "...",
    "vendorName": "John Doe",
    "mobile": "9876543210",
    "businessName": "John's Services",
    ...
  }
}
```

---

## 6. Update Vendor Profile

Replace `YOUR_TOKEN` with your token:

**Update text fields only:**
```bash
curl -X PATCH https://webserver-vendor.vercel.app/api/vendors/me ^
  -H "Authorization: Bearer YOUR_TOKEN" ^
  -H "Content-Type: application/json" ^
  -d "{\"businessName\": \"Updated Business Name\", \"businessAddress\": \"New Address 456\"}"
```

**Update with files:**
```bash
curl -X PATCH https://webserver-vendor.vercel.app/api/vendors/me ^
  -H "Authorization: Bearer YOUR_TOKEN" ^
  -F "businessName=Updated Business" ^
  -F "selectedServices=[\"New Service\",\"Another Service\"]" ^
  -F "profile=@C:\path\to\new-image.jpg"
```

**Expected Response:**
```json
{
  "message": "Vendor updated successfully",
  "vendor": {
    "_id": "...",
    "vendorName": "John Doe",
    "businessName": "Updated Business Name",
    ...
  }
}
```

---

## Complete Test Flow

1. **Send OTP** → Get OTP code
2. **Verify OTP** → Get token (vendorId: null)
3. **Create Vendor** → Get new token (vendorId: "...")
4. **Get Profile** → View vendor data
5. **Update Profile** → Modify vendor data

---

## Quick Test Script (PowerShell)

Save this as `test.ps1`:

```powershell
# 1. Send OTP
Write-Host "=== Sending OTP ===" -ForegroundColor Green
$otpResponse = curl -X POST https://webserver-vendor.vercel.app/api/auth/send-otp `
  -H "Content-Type: application/json" `
  -d '{"mobile": "9876543210"}' | ConvertFrom-Json

Write-Host "OTP: $($otpResponse.otp)" -ForegroundColor Yellow

# 2. Verify OTP (use the OTP from above)
Read-Host "Press Enter to verify OTP"
$verifyResponse = curl -X POST https://webserver-vendor.vercel.app/api/auth/verify-otp `
  -H "Content-Type: application/json" `
  -d "{`"mobile`": `"9876543210`", `"code`": `"$($otpResponse.otp)`"}" | ConvertFrom-Json

$token = $verifyResponse.token
Write-Host "Token: $token" -ForegroundColor Yellow

# 3. Create Vendor
Read-Host "Press Enter to create vendor"
curl -X POST https://webserver-vendor.vercel.app/api/vendors `
  -H "Content-Type: application/json" `
  -d '{"vendorName": "Test User", "mobile": "9876543210", "businessName": "Test Business"}'

# 4. Get Profile (update token if needed from create response)
Read-Host "Press Enter to get profile"
curl -X GET https://webserver-vendor.vercel.app/api/vendors/me `
  -H "Authorization: Bearer $token"
```

Run with: `.\test.ps1`

---

## Testing with Postman

**Environment Variables:**
- `BASE_URL`: `https://webserver-vendor.vercel.app`
- `TOKEN`: (will be set after verify-otp)

**Collection:**
1. Health Check: `GET {{BASE_URL}}/health`
2. Send OTP: `POST {{BASE_URL}}/api/auth/send-otp`
3. Verify OTP: `POST {{BASE_URL}}/api/auth/verify-otp` (save token to environment)
4. Create Vendor: `POST {{BASE_URL}}/api/vendors`
5. Get Profile: `GET {{BASE_URL}}/api/vendors/me` (use Bearer token)
6. Update Profile: `PATCH {{BASE_URL}}/api/vendors/me` (use Bearer token)

---

## Common Issues

**409 Conflict:** Mobile number already exists - use a different number or test with existing vendor

**401 Unauthorized:** Token expired or invalid - get a new token via verify-otp

**400 Bad Request:** Check request body format - ensure JSON is valid

**500 Server Error:** Check Vercel logs for detailed error messages
