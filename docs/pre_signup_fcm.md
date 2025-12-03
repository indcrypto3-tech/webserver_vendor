# Pre-signup FCM token registration

This document describes the unauthenticated API that allows mobile apps to register Firebase Cloud Messaging (FCM) tokens before a user completes signup or authentication. The server can then use these tokens to deliver OTPs via push during signup/verification flows.

## Endpoint

- URL: `POST /api/public/fcm-token`
- Auth: None (unauthenticated)
- Rate-limited: default 10 requests/minute per IP (server-enforced)
- Token TTL: stored tokens expire automatically (default 24 hours)

## Request body (JSON)

- Required:
  - `phone` (string) — phone number to associate with the token (E.164 or local formats)
  - `fcmToken` (string) — FCM device token provided by the Firebase SDK
- Optional:
  - `deviceType` (string) — e.g. `android`, `ios`, `web`
  - `deviceId` (string) — platform device identifier (helps dedupe)
  - `meta` (object) — optional metadata (app version, platform info)

Example request:

```json
{
  "phone": "+919876543210",
  "fcmToken": "fcm_token_from_firebase_sdk",
  "deviceType": "android",
  "deviceId": "device-uuid-123",
  "meta": { "appVersion": "1.2.3" }
}
```

## Successful response

- HTTP 201 Created
- Body:

```json
{
  "status": "ok",
  "id": "<record-id>"
}
```

Semantics: the server stores or updates a record for the given token and phone. Records are deduplicated by `fcmToken` or by (`phone` + `deviceId`) when provided. Re-posting a token is safe and will update expiry.

## Error responses

- `400 Bad Request` — missing or invalid fields (e.g. missing `phone` or `fcmToken`).
- `429 Too Many Requests` — rate limit exceeded. Mobile should use exponential backoff when retrying.
- `500 Internal Server Error` — transient server error; retry with backoff.

Example error body:

```json
{
  "error": "invalid_request",
  "message": "phone is required"
}
```

## Privacy & security notes

- Do not include OTPs, PINs, or other secrets in this request. This endpoint only collects FCM tokens and a phone number.
- Tokens are stored temporarily and removed automatically after expiry (TTL). If longer retention is needed, coordinate with the backend team.
- The server records IP and User-Agent for each registration for operational and abuse detection.

## Best practices for mobile clients

- Call this endpoint when:
  - you obtain an FCM token (initial app start / registration)
  - the token is refreshed by the Firebase SDK
  - immediately before requesting an OTP for signup/login
- Send `deviceId` when available to allow backend deduplication of tokens from the same device.
- Implement exponential backoff for `429`/`5xx` responses (e.g., 500ms, 1s, 2s, 4s; max 4 retries).
- Avoid re-posting unnecessarily — only send after token change or when about to request OTP.

## Examples

### curl

```bash
curl -X POST https://api.example.com/api/public/fcm-token \
  -H "Content-Type: application/json" \
  -d '{
    "phone": "+919876543210",
    "fcmToken": "fcm_token_from_firebase_sdk",
    "deviceType": "android",
    "deviceId": "device-uuid-123",
    "meta": {"appVersion":"1.2.3"}
  }'
```

### Flutter (Dart) sample

```dart
import 'dart:convert';
import 'package:http/http.dart' as http;

Future<void> registerFcmToken({
  required String phone,
  required String fcmToken,
  required String deviceId,
  required String baseUrl,
  String deviceType = 'android',
}) async {
  final url = Uri.parse('\$baseUrl/api/public/fcm-token');
  final body = jsonEncode({
    'phone': phone,
    'fcmToken': fcmToken,
    'deviceType': deviceType,
    'deviceId': deviceId,
  });

  final resp = await http.post(url, headers: {'Content-Type': 'application/json'}, body: body);
  if (resp.statusCode == 201) return;
  if (resp.statusCode == 429 || resp.statusCode >= 500) {
    // retry with backoff
    throw Exception('Retryable error: \\${resp.statusCode}');
  }
  throw Exception('Registration failed: \\${resp.statusCode}');
}
```

### Android (Kotlin) sample (OkHttp)

```kotlin
val url = "https://api.example.com/api/public/fcm-token"
val json = JSONObject().apply {
  put("phone", phone)
  put("fcmToken", fcmToken)
  put("deviceType", "android")
  put("deviceId", deviceId)
}
val body = RequestBody.create(MediaType.parse("application/json; charset=utf-8"), json.toString())
val req = Request.Builder().url(url).post(body).build()
client.newCall(req).enqueue(object: Callback {
  override fun onResponse(call: Call, response: Response) {
    when (response.code()) {
      201 -> { /* success */ }
      429 -> { /* backoff & retry */ }
      else -> { /* handle error */ }
    }
  }
  override fun onFailure(call: Call, e: IOException) { /* retry */ }
})
```

## Integration checklist

- [ ] Mobile posts FCM token prior to requesting OTP.
- [ ] Mobile re-posts token when Firebase issues a token refresh event.
- [ ] Client implements retry/backoff for `429` and `5xx`.
- [ ] Confirm TTL (default 24h) is sufficient for your signup flow.

If you want this content added to a different docs location (API reference, Confluence, or `structure_server/API_details.md`), tell me which file and I'll copy it there.
