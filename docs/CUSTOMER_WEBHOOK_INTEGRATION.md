# Customer Webhook Integration

This document describes how the vendor server sends order status updates back to the customer server via HTTP webhooks.

## Overview

When a customer server creates an order via `POST /api/external/orders`, the vendor server will send HTTP POST callbacks to the customer server whenever the order status changes. This enables real-time updates about order progress.

## Configuration

### Environment Variables

Add the following environment variable to enable webhook notifications:

```bash
# Customer server webhook URL for order status updates
CUSTOMER_WEBHOOK_URL=https://your-customer-server.com/api/vendor/order-updates

# Customer server secret for webhook authentication (same as order creation)
CUSTOMER_SERVER_SECRET=your-secret-key-here
```

### Setting Up Webhook URL

```bash
# Example: Set webhook URL via environment
export CUSTOMER_WEBHOOK_URL="https://your-customer-server.com/api/vendor/order-updates"
export CUSTOMER_SERVER_SECRET="your-secret-key-here"
```

## Webhook Format

### Headers

The vendor server will send the following headers with each webhook:

```http
Content-Type: application/json
x-vendor-server-secret: {CUSTOMER_SERVER_SECRET}
x-webhook-event: order.status_changed
x-webhook-timestamp: 2023-12-04T10:30:00.000Z
x-webhook-order-id: {orderId}
User-Agent: VendorServer-Webhook/1.0
```

### Payload

```json
{
  "orderId": "64a7b2c8f9e4d1a2b3c4d5e6",
  "customerId": "customer-123",
  "status": "accepted",
  "previousStatus": "pending", 
  "updatedAt": "2023-12-04T10:30:00.000Z",
  "orderData": {
    "fare": 250,
    "paymentMethod": "cod",
    "paymentStatus": "pending",
    "pickup": {
      "address": "123 Main Street, City",
      "coordinates": [77.1025, 28.7041]
    },
    "drop": {
      "address": "456 Oak Avenue, City", 
      "coordinates": [77.1125, 28.7141]
    },
    "items": [
      {
        "title": "Electronics Repair: Fix smartphone screen",
        "qty": 1,
        "price": 250
      }
    ],
    "customerNotes": "Handle with care",
    "vendorNotes": "Parts will be ordered",
    "scheduledAt": null,
    "assignedAt": "2023-12-04T10:25:00.000Z",
    "acceptedAt": "2023-12-04T10:30:00.000Z",
    "completedAt": null,
    "cancelledAt": null,
    "cancellationReason": null,
    "cancelledBy": null,
    "createdAt": "2023-12-04T10:20:00.000Z",
    "metadata": {
      "orderType": "service",
      "workType": "electronics_repair",
      "customerName": "John Doe",
      "customerPhone": "+919876543210",
      "urgency": "normal"
    }
  },
  "vendorDetails": {
    "vendorId": "64a7b2c8f9e4d1a2b3c4d5e7",
    "vendorName": "Tech Repair Services",
    "mobile": "+918765432109", 
    "businessAddress": "789 Service Lane, City",
    "selectedServices": ["electronics_repair", "appliance_repair"]
  }
}
```

## Status Values

The webhook will be triggered for the following status changes:

| Status | Description |
|--------|-------------|
| `pending` | Order created, waiting for vendor assignment |
| `assigned` | Order assigned to a vendor |
| `accepted` | Vendor accepted the order |
| `in_progress` | Vendor is working on the order |
| `payment_requested` | Vendor requested payment from customer |
| `payment_confirmed` | Customer confirmed payment |
| `arrival_confirmed` | Vendor confirmed arrival at location |
| `completed` | Order completed successfully |
| `cancelled` | Order cancelled by customer/vendor/admin |

## Customer Server Implementation

### Basic Webhook Endpoint

```javascript
const express = require('express');
const app = express();

app.use(express.json());

// Webhook endpoint to receive order status updates
app.post('/api/vendor/order-updates', (req, res) => {
  // Verify webhook authentication
  const providedSecret = req.headers['x-vendor-server-secret'];
  if (providedSecret !== process.env.CUSTOMER_SERVER_SECRET) {
    return res.status(401).json({ error: 'Invalid webhook secret' });
  }

  const { orderId, status, previousStatus, orderData, vendorDetails } = req.body;
  
  console.log(`Order ${orderId} status changed: ${previousStatus} → ${status}`);
  
  // Update order in your database
  updateOrderInDatabase(orderId, status, orderData, vendorDetails);
  
  // Notify your customer via email/SMS/push notification
  notifyCustomer(orderData.customerId, orderId, status);
  
  // Respond with success
  res.status(200).json({ 
    success: true, 
    message: 'Webhook received successfully' 
  });
});

async function updateOrderInDatabase(orderId, status, orderData, vendorDetails) {
  // Your database update logic
  console.log(`Updating order ${orderId} with status ${status}`);
}

async function notifyCustomer(customerId, orderId, status) {
  // Your customer notification logic
  console.log(`Notifying customer ${customerId} about order ${orderId}: ${status}`);
}
```

### Python/Django Implementation

```python
from django.http import JsonResponse
from django.views.decorators.csrf import csrf_exempt
from django.views.decorators.http import require_http_methods
import json
import os

@csrf_exempt
@require_http_methods(["POST"])
def vendor_order_webhook(request):
    # Verify webhook authentication
    provided_secret = request.headers.get('x-vendor-server-secret')
    if provided_secret != os.environ.get('CUSTOMER_SERVER_SECRET'):
        return JsonResponse({'error': 'Invalid webhook secret'}, status=401)
    
    try:
        webhook_data = json.loads(request.body)
        order_id = webhook_data['orderId']
        status = webhook_data['status']
        previous_status = webhook_data['previousStatus']
        order_data = webhook_data['orderData']
        vendor_details = webhook_data.get('vendorDetails')
        
        print(f"Order {order_id} status changed: {previous_status} → {status}")
        
        # Update order in your database
        update_order_in_database(order_id, status, order_data, vendor_details)
        
        # Notify customer
        notify_customer(order_data['customerId'], order_id, status)
        
        return JsonResponse({
            'success': True,
            'message': 'Webhook received successfully'
        })
        
    except Exception as e:
        print(f"Webhook error: {e}")
        return JsonResponse({'error': 'Processing failed'}, status=500)
```

## Webhook Reliability

### Retry Logic

The vendor server implements automatic retries with exponential backoff:

- **Retries**: 3 attempts by default
- **Timeout**: 10 seconds per request
- **Backoff**: 1s, 2s, 3s between retries
- **Error Handling**: 4xx client errors are not retried (except 408, 429)

### Error Responses

Your webhook endpoint should return appropriate HTTP status codes:

- **200-299**: Success - webhook processed
- **400-499**: Client error - will not retry (except 408, 429)
- **500-599**: Server error - will retry with backoff
- **Timeout**: No response within 10 seconds - will retry

### Webhook Verification

Always verify the webhook authenticity:

```javascript
function verifyWebhook(req) {
  const providedSecret = req.headers['x-vendor-server-secret'];
  const expectedSecret = process.env.CUSTOMER_SERVER_SECRET;
  
  if (!providedSecret || providedSecret !== expectedSecret) {
    throw new Error('Invalid webhook authentication');
  }
  
  // Additional verification
  const timestamp = req.headers['x-webhook-timestamp'];
  const timeDiff = Date.now() - new Date(timestamp).getTime();
  
  // Reject webhooks older than 5 minutes
  if (timeDiff > 5 * 60 * 1000) {
    throw new Error('Webhook timestamp too old');
  }
  
  return true;
}
```

## Testing Webhooks

### Test Endpoint

Use the vendor server's test endpoint to verify your webhook:

```bash
curl -X POST "https://webserver-vendor.vercel.app/api/external/webhook-test" \
  -H "Content-Type: application/json" \
  -H "x-vendor-server-secret: ${CUSTOMER_SERVER_SECRET}" \
  -d '{
    "webhookUrl": "https://your-customer-server.com/api/vendor/order-updates"
  }'
```

### Integration Testing

1. **Create Test Order**: Use the external order creation API
2. **Update Order Status**: Use vendor mobile app or external vendor API 
3. **Verify Webhook**: Check your webhook endpoint received the status update
4. **Check Logs**: Review vendor server logs for webhook delivery status

## Troubleshooting

### Common Issues

1. **Webhook URL not configured**: Set `CUSTOMER_WEBHOOK_URL` environment variable
2. **Authentication failures**: Verify `CUSTOMER_SERVER_SECRET` matches
3. **Timeout errors**: Ensure your webhook endpoint responds within 10 seconds
4. **SSL/TLS errors**: Use HTTPS URLs with valid certificates

### Debug Logs

Enable debug logging on vendor server:

```bash
# Enable detailed webhook logging
export DEBUG_WEBHOOKS=1

# View webhook logs
tail -f vendor-server.log | grep "webhook"
```

### Webhook Status Monitoring

Monitor webhook delivery through vendor server logs:

```bash
# Successful webhooks
grep "Customer webhook sent successfully" vendor-server.log

# Failed webhooks  
grep "Customer webhook failed" vendor-server.log

# Webhook retry attempts
grep "Customer webhook failed, retrying" vendor-server.log
```

## Security Considerations

1. **Use HTTPS**: Always use HTTPS URLs for webhook endpoints
2. **Verify Signatures**: Check `x-vendor-server-secret` header
3. **Validate Timestamps**: Reject old webhook requests
4. **Rate Limiting**: Implement rate limiting on your webhook endpoint
5. **Idempotency**: Handle duplicate webhook deliveries gracefully
6. **Input Validation**: Validate all webhook payload data

## Example Flow

1. Customer server creates order via `POST /api/external/orders`
2. Vendor server broadcasts order to online vendors
3. Vendor accepts order via mobile app
4. Vendor server sends webhook: `pending` → `accepted`
5. Customer server updates order status and notifies customer
6. Vendor marks order in progress
7. Vendor server sends webhook: `accepted` → `in_progress`
8. Customer server provides real-time updates to customer
9. Vendor completes work and marks order complete
10. Vendor server sends webhook: `in_progress` → `completed`
11. Customer server finalizes order and processes payment