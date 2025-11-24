# Mobile App API Integration Guide

**Base URL:** `https://webserver-vendor.vercel.app`

This document provides complete API specification for integrating the vendor backend with your Flutter/React Native mobile app.

---

## Authentication Flow

### 1. Send OTP
### 2. Verify OTP → Receive JWT Token
### 3. Create Vendor Profile (optional, if not exists)
### 4. Access Protected Routes with JWT Token

---

## API Endpoints

## 1. Send OTP

**Endpoint:** `POST /api/auth/send-otp`

**Description:** Sends a 4-digit OTP to the mobile number (dev mode: always returns `1234`)

**Request:**
```json
{
  "mobile": "9876543210"
}
```

**Response (200 OK):**
```json
{
  "message": "OTP sent (dev-only)",
  "otp": "1234"
}
```

**Error Response (400):**
```json
{
  "message": "Mobile number is required"
}
```

**Flutter Example:**
```dart
Future<Map<String, dynamic>> sendOTP(String mobile) async {
  final response = await http.post(
    Uri.parse('https://webserver-vendor.vercel.app/api/auth/send-otp'),
    headers: {'Content-Type': 'application/json'},
    body: jsonEncode({'mobile': mobile}),
  );
  return jsonDecode(response.body);
}
```

---

## 2. Verify OTP

**Endpoint:** `POST /api/auth/verify-otp`

**Description:** Verifies the OTP code and returns a JWT token. If vendor exists, returns vendor data. If new user, returns token only.

**Request:**
```json
{
  "mobile": "9876543210",
  "code": "1234"
}
```

**Response - Existing Vendor (200 OK):**
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

**Response - New User (200 OK):**
```json
{
  "message": "verified",
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "vendorId": null
}
```

**Error Response (400):**
```json
{
  "message": "Invalid OTP code"
}
```

**Flutter Example:**
```dart
Future<Map<String, dynamic>> verifyOTP(String mobile, String code) async {
  final response = await http.post(
    Uri.parse('https://webserver-vendor.vercel.app/api/auth/verify-otp'),
    headers: {'Content-Type': 'application/json'},
    body: jsonEncode({'mobile': mobile, 'code': code}),
  );
  return jsonDecode(response.body);
}
```

---

## 3. Create Vendor Profile

**Endpoint:** `POST /api/vendors`

**Description:** Creates a new vendor profile with optional image uploads

**Content-Type:** `multipart/form-data`

**Required Fields:**
- `vendorName` (String) - Vendor's full name
- `mobile` (String) - Mobile number (must be unique)

**Optional Text Fields:**
- `gender` (String) - "male", "female", "other", or empty string
- `businessName` (String) - Business name
- `businessAddress` (String) - Full business address
- `businessType` (String) - Type of business (e.g., "Plumbing", "Electrical", "Carpentry")
- `selectedServices` (String) - JSON array as string, e.g., `"[\"Service1\",\"Service2\"]"`

**Optional File Fields (Images only: JPEG/PNG/WEBP, max 25MB each):**
- `profile` - Profile photo
- `id` - ID card image
- `cert` - Certificate/license image

**Response (201 Created):**
```json
{
  "message": "Vendor created successfully",
  "vendor": {
    "_id": "673c8a1f2e4b5c001a2f3d4e",
    "vendorName": "John Doe",
    "mobile": "9876543210",
    "mobileVerified": true,
    "gender": "male",
    "businessName": "John's Services",
    "businessAddress": "123 Main St, City",
    "businessType": "Plumbing",
    "selectedServices": ["Pipe Repair", "Installation", "Maintenance"],
    "identityImages": {
      "profile": "/uploads/profile-1234567890-123456789.jpg",
      "id": "/uploads/id-1234567890-987654321.jpg",
      "cert": "/uploads/cert-1234567890-456789123.jpg"
    },
    "createdAt": "2025-11-24T10:00:00.000Z",
    "updatedAt": "2025-11-24T10:00:00.000Z"
  },
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
}
```

**Error Response (400):**
```json
{
  "message": "vendorName and mobile are required"
}
```

**Error Response (409 Conflict):**
```json
{
  "message": "Vendor with this mobile number already exists"
}
```

**Flutter Example:**
```dart
import 'package:http/http.dart' as http;
import 'dart:convert';
import 'dart:io';

Future<Map<String, dynamic>> createVendor({
  required String vendorName,
  required String mobile,
  String? gender,
  String? businessName,
  String? businessAddress,
  String? businessType,
  List<String>? selectedServices,
  File? profileImage,
  File? idImage,
  File? certImage,
}) async {
  var request = http.MultipartRequest(
    'POST',
    Uri.parse('https://webserver-vendor.vercel.app/api/vendors'),
  );

  // Add text fields
  request.fields['vendorName'] = vendorName;
  request.fields['mobile'] = mobile;
  
  if (gender != null) request.fields['gender'] = gender;
  if (businessName != null) request.fields['businessName'] = businessName;
  if (businessAddress != null) request.fields['businessAddress'] = businessAddress;
  if (businessType != null) request.fields['businessType'] = businessType;
  
  if (selectedServices != null && selectedServices.isNotEmpty) {
    request.fields['selectedServices'] = jsonEncode(selectedServices);
  }

  // Add image files
  if (profileImage != null) {
    request.files.add(await http.MultipartFile.fromPath('profile', profileImage.path));
  }
  if (idImage != null) {
    request.files.add(await http.MultipartFile.fromPath('id', idImage.path));
  }
  if (certImage != null) {
    request.files.add(await http.MultipartFile.fromPath('cert', certImage.path));
  }

  final streamedResponse = await request.send();
  final response = await http.Response.fromStream(streamedResponse);
  
  return jsonDecode(response.body);
}
```

---

## 4. Get Current Vendor Profile

**Endpoint:** `GET /api/vendors/me`

**Description:** Retrieves the authenticated vendor's profile

**Headers Required:**
```
Authorization: Bearer YOUR_JWT_TOKEN
```

**Response (200 OK):**
```json
{
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

**Error Response (401 Unauthorized):**
```json
{
  "message": "Authorization token required"
}
```

**Error Response (404 Not Found - if vendor not created yet):**
```json
{
  "message": "Vendor profile not created yet",
  "mobile": "9876543210"
}
```

**Flutter Example:**
```dart
Future<Map<String, dynamic>> getVendorProfile(String token) async {
  final response = await http.get(
    Uri.parse('https://webserver-vendor.vercel.app/api/vendors/me'),
    headers: {
      'Authorization': 'Bearer $token',
    },
  );
  return jsonDecode(response.body);
}
```

---

## 5. Update Vendor Profile

**Endpoint:** `PATCH /api/vendors/me`

**Description:** Updates the authenticated vendor's profile (partial update supported)

**Content-Type:** `multipart/form-data`

**Headers Required:**
```
Authorization: Bearer YOUR_JWT_TOKEN
```

**Updatable Fields:**
- `vendorName` (String)
- `gender` (String)
- `businessName` (String)
- `businessAddress` (String)
- `businessType` (String)
- `selectedServices` (String) - JSON array as string
- `profile` (File) - New profile image
- `id` (File) - New ID card image
- `cert` (File) - New certificate image

**Note:** You can update any combination of fields. Only send the fields you want to update.

**Response (200 OK):**
```json
{
  "message": "Vendor updated successfully",
  "vendor": {
    "_id": "673c8a1f2e4b5c001a2f3d4e",
    "vendorName": "John Doe",
    "mobile": "9876543210",
    "businessName": "Updated Business Name",
    "businessAddress": "New Address 456",
    ...
  }
}
```

**Error Response (401 Unauthorized):**
```json
{
  "message": "Invalid or expired token"
}
```

**Error Response (404 Not Found):**
```json
{
  "message": "Vendor profile not created yet. Use POST /api/vendors to create.",
  "mobile": "9876543210"
}
```

**Flutter Example:**
```dart
Future<Map<String, dynamic>> updateVendorProfile({
  required String token,
  String? vendorName,
  String? businessName,
  String? businessAddress,
  List<String>? selectedServices,
  File? profileImage,
}) async {
  var request = http.MultipartRequest(
    'PATCH',
    Uri.parse('https://webserver-vendor.vercel.app/api/vendors/me'),
  );

  // Add authorization header
  request.headers['Authorization'] = 'Bearer $token';

  // Add fields to update
  if (vendorName != null) request.fields['vendorName'] = vendorName;
  if (businessName != null) request.fields['businessName'] = businessName;
  if (businessAddress != null) request.fields['businessAddress'] = businessAddress;
  
  if (selectedServices != null) {
    request.fields['selectedServices'] = jsonEncode(selectedServices);
  }

  // Add new image if provided
  if (profileImage != null) {
    request.files.add(await http.MultipartFile.fromPath('profile', profileImage.path));
  }

  final streamedResponse = await request.send();
  final response = await http.Response.fromStream(streamedResponse);
  
  return jsonDecode(response.body);
}
```

---

## Complete User Flow Example

### Scenario: New User Registration

```dart
// Step 1: Send OTP
final otpResponse = await sendOTP('9876543210');
// Show OTP to user (in dev mode, it's always "1234")

// Step 2: User enters OTP and verifies
final verifyResponse = await verifyOTP('9876543210', '1234');
final token = verifyResponse['token'];
final vendorId = verifyResponse['vendorId'];

// Step 3: Check if vendor profile exists
if (vendorId == null) {
  // New user - navigate to profile creation screen
  final createResponse = await createVendor(
    vendorName: 'John Doe',
    mobile: '9876543210',
    gender: 'male',
    businessName: 'John\'s Services',
    businessType: 'Plumbing',
    selectedServices: ['Pipe Repair', 'Installation'],
    profileImage: selectedProfileImage,
  );
  
  // Save new token from create response
  final newToken = createResponse['token'];
  // Save token to secure storage
  await storage.write(key: 'auth_token', value: newToken);
  
  // Navigate to home screen
} else {
  // Existing user - save token and navigate to home
  await storage.write(key: 'auth_token', value: token);
  // Navigate to home screen
}

// Step 4: On home screen, fetch profile
final profileResponse = await getVendorProfile(token);
final vendor = profileResponse['vendor'];
```

### Scenario: Existing User Login

```dart
// Step 1: Send OTP
await sendOTP('9876543210');

// Step 2: Verify OTP
final verifyResponse = await verifyOTP('9876543210', '1234');
final token = verifyResponse['token'];
final vendor = verifyResponse['vendor']; // Will have vendor data

// Step 3: Save token and navigate to home
await storage.write(key: 'auth_token', value: token);
// Navigate to home screen
```

---

## Data Models

### Vendor Model

```dart
class Vendor {
  final String id;
  final String vendorName;
  final String mobile;
  final bool mobileVerified;
  final String? gender;
  final String? businessName;
  final String? businessAddress;
  final String? businessType;
  final List<String> selectedServices;
  final IdentityImages identityImages;
  final DateTime createdAt;
  final DateTime updatedAt;

  Vendor({
    required this.id,
    required this.vendorName,
    required this.mobile,
    required this.mobileVerified,
    this.gender,
    this.businessName,
    this.businessAddress,
    this.businessType,
    required this.selectedServices,
    required this.identityImages,
    required this.createdAt,
    required this.updatedAt,
  });

  factory Vendor.fromJson(Map<String, dynamic> json) {
    return Vendor(
      id: json['_id'],
      vendorName: json['vendorName'],
      mobile: json['mobile'],
      mobileVerified: json['mobileVerified'],
      gender: json['gender'],
      businessName: json['businessName'],
      businessAddress: json['businessAddress'],
      businessType: json['businessType'],
      selectedServices: List<String>.from(json['selectedServices'] ?? []),
      identityImages: IdentityImages.fromJson(json['identityImages']),
      createdAt: DateTime.parse(json['createdAt']),
      updatedAt: DateTime.parse(json['updatedAt']),
    );
  }
}

class IdentityImages {
  final String? profile;
  final String? id;
  final String? cert;

  IdentityImages({this.profile, this.id, this.cert});

  factory IdentityImages.fromJson(Map<String, dynamic> json) {
    return IdentityImages(
      profile: json['profile'],
      id: json['id'],
      cert: json['cert'],
    );
  }
  
  // Get full URL for images
  String? getProfileUrl() => profile != null 
    ? 'https://webserver-vendor.vercel.app$profile' 
    : null;
    
  String? getIdUrl() => id != null 
    ? 'https://webserver-vendor.vercel.app$id' 
    : null;
    
  String? getCertUrl() => cert != null 
    ? 'https://webserver-vendor.vercel.app$cert' 
    : null;
}
```

---

## Important Notes

### 1. File Uploads on Vercel
⚠️ **WARNING:** Files uploaded to Vercel will NOT persist permanently due to serverless architecture. The files will be accessible during the session but may disappear after deployment or function execution.

**Recommendation for Production:**
- Integrate cloud storage (AWS S3, Cloudinary, Google Cloud Storage)
- Or deploy backend to a traditional hosting platform (Railway, Render, Heroku)

### 2. OTP in Development
- OTP is currently fixed to `1234` for development/testing
- In production, integrate a real SMS provider (Twilio, AWS SNS, etc.)

### 3. Token Management
- JWT tokens expire after 30 days
- Store tokens securely using Flutter Secure Storage
- Handle 401 errors by redirecting to login

### 4. Error Handling
Always handle these HTTP status codes:
- `200` - Success
- `201` - Created
- `400` - Bad Request (validation error)
- `401` - Unauthorized (invalid/expired token)
- `404` - Not Found
- `409` - Conflict (duplicate mobile number)
- `500` - Server Error

### 5. Image URLs
- Image paths are relative (e.g., `/uploads/image.jpg`)
- Prepend base URL: `https://webserver-vendor.vercel.app/uploads/image.jpg`
- Check if image exists before displaying

---

## Testing the API

Use these curl commands to test endpoints:

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

# Get profile
curl -X GET https://webserver-vendor.vercel.app/api/vendors/me \
  -H "Authorization: Bearer YOUR_TOKEN"
```

---

## Support

For backend issues or API questions, refer to the backend repository or contact the backend developer.

**API Version:** 1.0.0  
**Last Updated:** November 24, 2025
