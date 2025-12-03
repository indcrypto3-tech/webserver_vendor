#!/bin/bash

# Test order creation - sends push notification to all online vendors

curl -X POST https://webserver-vendor.vercel.app/api/dev/orders/mock \
  -H "Content-Type: application/json" \
  -H "x-dev-key: dd8cc5385c63fbec8f239a6295e807029c3a220e7b58ff2475fcd7c87eddedfc" \
  -d '{
    "pickup": {
      "lat": 37.4219983,
      "lng": -122.084,
      "address": "1600 Amphitheatre Parkway, Mountain View, CA"
    },
    "drop": {
      "lat": 37.4249,
      "lng": -122.0822,
      "address": "500 Castro St, Mountain View, CA"
    },
    "items": [
      {
        "title": "Emergency Plumbing Repair",
        "qty": 1,
        "price": 150
      }
    ],
    "fare": 150,
    "paymentMethod": "cod",
    "autoAssignVendor": true
  }'
