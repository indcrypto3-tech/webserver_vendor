# External Vendor Update API

This document defines the vendor update endpoint that accepts updates from external partner systems.

## API Endpoint
```
POST https://webserver-vendor.vercel.app/api/external/vendor-update
```

## Authentication Header
```
x-vendor-secret: [EXTERNAL_VENDOR_SECRET]
```

## Environment Variable Required
Set `EXTERNAL_VENDOR_SECRET` in your environment or .env file:
```bash
EXTERNAL_VENDOR_SECRET=your-secure-secret-key-here
```

## Request Format

### Canonical Fields (Internal Schema)
```json
{
  "vendorId": "string",            // Required - external vendor identifier
  "vendorName": "string",          // Optional - vendor display name
  "vendorPhone": "string",         // Optional - vendor contact number
  "vendorAddress": "string",       // Optional - vendor business address  
  "serviceType": "string",         // Optional - type of service provided
  "assignedOrderId": "string",     // Optional - order ID to update
  "status": "string"               // Optional - vendor status (accepted|rejected|enroute|completed|cancelled)
}
```

### Flexible Field Mapping
The API accepts various field name formats from external systems:

| Canonical Field | Accepted Variations |
|----------------|-------------------|
| `vendorId` | `vendorId`, `id`, `vendor_id`, `vendor_id_str` |
| `vendorName` | `vendorName`, `name`, `vendor_name` |
| `vendorPhone` | `vendorPhone`, `phone`, `mobile` |
| `vendorAddress` | `vendorAddress`, `address`, `addr` |
| `serviceType` | `serviceType`, `service`, `type` |
| `assignedOrderId` | `assignedOrderId`, `orderId`, `order_id`, `assigned_order` |
| `status` | `status`, `state`, `vendorStatus` |

## Example Requests

### 1. Create New Vendor
```bash
curl -X POST https://webserver-vendor.vercel.app/api/external/vendor-update \
  -H "Content-Type: application/json" \
  -H "x-vendor-secret: ${EXTERNAL_VENDOR_SECRET}" \
  -d '{
    "id": "vendor-123",
    "name": "John'\''s Kitchen",
    "mobile": "+911234567890",
    "address": "123 Main St, Mumbai",
    "service": "food-delivery"
  }'
```

### 2. Update Vendor with Order Assignment
```bash
curl -X POST https://webserver-vendor.vercel.app/api/external/vendor-update \
  -H "Content-Type: application/json" \
  -H "x-vendor-secret: ${EXTERNAL_VENDOR_SECRET}" \
  -d '{
    "vendor_id": "vendor-456", 
    "vendor_name": "Quick Fix Services",
    "phone": "+12125551234",
    "addr": "456 Oak Ave, New York",
    "type": "repair",
    "assigned_order": "order-789",
    "vendorStatus": "accepted"
  }'
```

### 3. Update Vendor Status Only
```bash
curl -X POST https://webserver-vendor.vercel.app/api/external/vendor-update \
  -H "Content-Type: application/json" \
  -H "x-vendor-secret: ${EXTERNAL_VENDOR_SECRET}" \
  -d '{
    "id": "vendor-789",
    "orderId": "order-456", 
    "state": "enroute"
  }'
```

### 4. Complete Service Order
```bash
curl -X POST https://webserver-vendor.vercel.app/api/external/vendor-update \
  -H "Content-Type: application/json" \
  -H "x-vendor-secret: ${EXTERNAL_VENDOR_SECRET}" \
  -d '{
    "vendor_id_str": "vendor-abc",
    "order_id": "order-xyz",
    "status": "completed"
  }'
```

## Response Formats

### Success Response (200)
```json
{
  "success": true,
  "vendorId": "vendor-123",
  "upserted": true,
  "orderUpdated": false
}
```

**Response Fields:**
- `success`: Always `true` for successful requests
- `vendorId`: The canonical vendor ID that was processed
- `upserted`: `true` if new vendor created, `false` if existing vendor updated
- `orderUpdated`: `true` if associated order was updated, `false` otherwise

### Authentication Error (401)
```json
{
  "error": "missing vendor secret"
}
```

```json
{
  "error": "invalid vendor secret"
}
```

### Validation Error (400)
```json
{
  "error": "validation error",
  "details": [
    "vendorId is required",
    "status must be one of [accepted, rejected, enroute, completed, cancelled]"
  ]
}
```

### Server Error (500)
```json
{
  "error": "internal server error"
}
```

## Database Behavior

### Vendor Upsert Logic
- **Create**: If `vendorId` doesn't exist, creates new vendor with provided fields
- **Update**: If `vendorId` exists, updates the vendor record with new field values
- **Idempotency**: Multiple identical requests will update the same vendor record

### Order Update Logic (Optional)
If `assignedOrderId` is provided:
1. Attempts to find order by `_id` or `orderId` field
2. Updates order's vendor reference and status if found
3. Maps vendor status to order status:
   - `accepted` → `assigned`
   - `enroute` → `in_progress`  
   - `completed` → `completed`
   - `cancelled` → `cancelled`
   - `rejected` → `pending`

## Field Validation Rules

### Required Fields
- `vendorId`: Non-empty string

### Optional Field Constraints
- `status`: Must be one of: `accepted`, `rejected`, `enroute`, `completed`, `cancelled`
- All other fields: Must be strings if provided

### Security Features
- Authentication via `x-vendor-secret` header
- No vendor existence information leaked in error responses
- Request logging for audit trails
- Validation error details provided for debugging

## Integration Examples

### Node.js/JavaScript
```javascript
const axios = require('axios');

async function updateVendor(vendorData) {
  try {
    const response = await axios.post(
      'https://webserver-vendor.vercel.app/api/external/vendor-update',
      vendorData,
      {
        headers: {
          'Content-Type': 'application/json',
          'x-vendor-secret': process.env.EXTERNAL_VENDOR_SECRET
        }
      }
    );
    
    console.log('Vendor updated:', response.data);
    return response.data;
  } catch (error) {
    console.error('Vendor update failed:', error.response?.data || error.message);
    throw error;
  }
}

// Usage
await updateVendor({
  id: 'vendor-001',
  name: 'Express Delivery Co',
  phone: '+15551234567',
  address: '123 Business Ave',
  service: 'delivery',
  orderId: 'order-001',
  status: 'accepted'
});
```

### Python
```python
import requests
import os

def update_vendor(vendor_data):
    url = 'https://webserver-vendor.vercel.app/api/external/vendor-update'
    headers = {
        'Content-Type': 'application/json',
        'x-vendor-secret': os.getenv('EXTERNAL_VENDOR_SECRET')
    }
    
    response = requests.post(url, json=vendor_data, headers=headers)
    
    if response.status_code == 200:
        print('Vendor updated:', response.json())
        return response.json()
    else:
        print('Update failed:', response.json())
        raise Exception(f'HTTP {response.status_code}: {response.text}')

# Usage
update_vendor({
    'vendor_id': 'vendor-002',
    'vendor_name': 'Fast Food Express', 
    'mobile': '+919876543210',
    'addr': '456 Food Street',
    'type': 'restaurant',
    'assigned_order': 'order-002',
    'state': 'enroute'
})
```

## Testing

Run the test suite:
```bash
npm test -- --testNamePattern="External Vendor Update"
```

Set up test environment:
```bash
export EXTERNAL_VENDOR_SECRET=test-secret-123
npm test
```

## Monitoring & Logging

The endpoint logs the following events:
- **Info**: Request arrival with vendor ID and order ID
- **Warning**: Authentication failures and validation errors  
- **Error**: Database errors and internal server issues

Log entries include request metadata (IP, route, method) for audit trails.

## Rate Limiting & Security

- Use HTTPS in production
- Rotate `EXTERNAL_VENDOR_SECRET` regularly
- Monitor for unusual request patterns
- Consider implementing rate limiting for production use

This API enables seamless integration between external partner systems and the vendor management platform.