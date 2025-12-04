# Customer Webserver Order Format

This document defines the expected JSON format for service orders that customer webservers should send to the external orders API.

## API Endpoint
```
POST https://webserver-vendor.vercel.app/api/external/orders
```

## Authentication Header
```
x-customer-secret: 7c3a762645e64b89d513a2a2dde29605a9595d368826a762918fbb8e04412824
```

## Request Body Format

### Required Fields
All fields marked as **required** must be included in every request.

```json
{
  "customerId": "string",           // **Required** - Unique customer identifier
  "customerName": "string",         // **Required** - Customer's full name
  "customerPhone": "string",        // **Required** - Customer's phone number
  "customerAddress": "string",      // **Required** - Customer's full address
  "workType": "string",             // **Required** - Type of service needed
  "description": "string",          // **Required** - Detailed work description
  "location": {                     // **Required** - Customer's location coordinates
    "latitude": number,             // **Required** - Latitude (-90 to 90)
    "longitude": number             // **Required** - Longitude (-180 to 180)
  },
  "estimatedPrice": number,         // Optional - Estimated price (default: 0)
  "urgency": "string"               // Optional - Priority level (default: "normal")
}
```

### Field Specifications

| Field | Type | Required | Description | Example |
|-------|------|----------|-------------|---------|
| `customerId` | string | ✅ | Unique identifier for the customer | `"customer_12345"` |
| `customerName` | string | ✅ | Customer's full name | `"John Smith"` |
| `customerPhone` | string | ✅ | Customer's contact number | `"+1555123456"` |
| `customerAddress` | string | ✅ | Complete service address | `"123 Main St, New York, NY 10001"` |
| `workType` | string | ✅ | Service category | `"plumber"`, `"electrician"`, `"carpenter"`, `"hvac"` |
| `description` | string | ✅ | Detailed work description | `"Fix leaking kitchen faucet"` |
| `location.latitude` | number | ✅ | GPS latitude coordinate | `40.7128` |
| `location.longitude` | number | ✅ | GPS longitude coordinate | `-74.0060` |
| `estimatedPrice` | number | ❌ | Estimated service cost | `150.00` |
| `urgency` | string | ❌ | Priority level | `"low"`, `"normal"`, `"high"`, `"emergency"` |

## Complete Example Requests

### 1. Plumber Service Request
```json
{
  "customerId": "cust_001_plumber",
  "customerName": "Alice Johnson",
  "customerPhone": "+1555987654",
  "customerAddress": "789 Broadway Ave, Manhattan, NY 10003",
  "workType": "plumber",
  "description": "Kitchen sink is completely blocked, water backing up",
  "location": {
    "latitude": 40.7505,
    "longitude": -73.9934
  },
  "estimatedPrice": 120.00,
  "urgency": "high"
}
```

### 2. Electrician Service Request
```json
{
  "customerId": "cust_002_electrical",
  "customerName": "Michael Chen",
  "customerPhone": "+1555456789",
  "customerAddress": "456 Oak Street, Brooklyn, NY 11201",
  "workType": "electrician",
  "description": "Install ceiling fan in master bedroom, existing wiring available",
  "location": {
    "latitude": 40.6892,
    "longitude": -73.9442
  },
  "estimatedPrice": 200.00,
  "urgency": "normal"
}
```

### 3. HVAC Service Request
```json
{
  "customerId": "cust_003_hvac",
  "customerName": "Sarah Williams",
  "customerPhone": "+1555321987",
  "customerAddress": "321 Pine Road, Queens, NY 11375",
  "workType": "hvac",
  "description": "Air conditioning unit not cooling, needs diagnostic and repair",
  "location": {
    "latitude": 40.7282,
    "longitude": -73.7949
  },
  "estimatedPrice": 250.00,
  "urgency": "high"
}
```

### 4. Carpenter Service Request
```json
{
  "customerId": "cust_004_carpenter",
  "customerName": "David Rodriguez",
  "customerPhone": "+1555654321",
  "customerAddress": "654 Elm Drive, Staten Island, NY 10314",
  "workType": "carpenter",
  "description": "Build custom kitchen cabinet, customer has materials ready",
  "location": {
    "latitude": 40.5795,
    "longitude": -74.1502
  },
  "estimatedPrice": 400.00,
  "urgency": "low"
}
```

### 5. Emergency Service Request
```json
{
  "customerId": "cust_005_emergency",
  "customerName": "Emma Thompson",
  "customerPhone": "+1555111222",
  "customerAddress": "111 Emergency Lane, Bronx, NY 10451",
  "workType": "electrician",
  "description": "Power outage in entire apartment, urgent electrical issue",
  "location": {
    "latitude": 40.8176,
    "longitude": -73.9182
  },
  "estimatedPrice": 300.00,
  "urgency": "emergency"
}
```

## Expected Response

### Success Response (201 Created)
```json
{
  "ok": true,
  "message": "Order created successfully",
  "data": {
    "orderId": "693141d0c06d953195c7db5c",
    "status": "pending",
    "broadcast": {
      "success": true,
      "notifiedVendors": 3,
      "failedNotifications": 0
    }
  }
}
```

### Error Responses

#### Authentication Error (401)
```json
{
  "ok": false,
  "error": "Authentication required: Missing x-customer-secret header"
}
```

#### Validation Error (400)
```json
{
  "ok": false,
  "error": "Validation failed",
  "details": [
    "customerName is required",
    "location.latitude must be a number between -90 and 90"
  ]
}
```

#### Server Error (500)
```json
{
  "ok": false,
  "error": "Order creation failed",
  "details": "Internal server error"
}
```

## Integration Notes

1. **Content-Type**: Always use `application/json`
2. **Authentication**: Include `x-customer-secret` header with every request
3. **Coordinates**: Use decimal degrees format (e.g., 40.7128, not degrees/minutes/seconds)
4. **Phone Format**: Include country code (e.g., "+1555123456")
5. **Work Types**: Use lowercase strings ("plumber", "electrician", "carpenter", "hvac")
6. **Urgency Levels**: "low", "normal", "high", "emergency" (case-sensitive)

## cURL Examples

### Basic Service Request
```bash
curl -X POST "https://webserver-vendor.vercel.app/api/external/orders" \
  -H "Content-Type: application/json" \
  -H "x-customer-secret: 7c3a762645e64b89d513a2a2dde29605a9595d368826a762918fbb8e04412824" \
  -d '{
    "customerId": "test_customer_001",
    "customerName": "Test Customer",
    "customerPhone": "+1555000001",
    "customerAddress": "123 Test Street, Test City, NY 10001",
    "workType": "plumber",
    "description": "Test plumbing service request",
    "location": {
      "latitude": 40.7128,
      "longitude": -74.0060
    },
    "estimatedPrice": 100.00,
    "urgency": "normal"
  }'
```

### Emergency Request
```bash
curl -X POST "https://webserver-vendor.vercel.app/api/external/orders" \
  -H "Content-Type: application/json" \
  -H "x-customer-secret: 7c3a762645e64b89d513a2a2dde29605a9595d368826a762918fbb8e04412824" \
  -d '{
    "customerId": "emergency_001",
    "customerName": "Emergency Customer",
    "customerPhone": "+1555911911",
    "customerAddress": "911 Emergency Ave, Urgent City, NY 10911",
    "workType": "electrician",
    "description": "Power outage - immediate assistance needed",
    "location": {
      "latitude": 40.7589,
      "longitude": -73.9851
    },
    "estimatedPrice": 200.00,
    "urgency": "emergency"
  }'
```

This API enables seamless integration between customer management systems and the vendor dispatch platform.