# Patch: Fix enum validation error for `gender`

Summary
-------
Error observed: "Vendor validation failed: `Male` is not a valid enum value for path `gender`."

- Where the error comes from: server-side validation. The server rejects the value `Male` because its enum validation expects one of the allowed values (for example `male`, `female`, `other`) and comparison is case-sensitive.
- Short-term options: normalize input on the server (recommended), or change client to send canonical values.

Root cause
----------
Most server-side validations for enums are case-sensitive (and DB enum types are usually exact-match). If the server's allowed gender values are lowercase (`male`, `female`, `other`) and the client sends `Male` (capitalized), validation will fail with the exact message you saw.

Recommended server-side fixes (apply one or more)
------------------------------------------------
1) Normalize `gender` before validation (best, minimal change)

  - In your request handler / validation middleware, coerce `gender` to a lowercase string before running the enum validation.

  Example (Express / plain JS):

  ```js
  // normalize middleware (simple)
  function normalizeVendorInputs(req, res, next) {
    if (req.body && req.body.gender) {
      req.body.gender = String(req.body.gender).toLowerCase();
    }
    next();
  }

  // usage
  app.post('/api/vendors', normalizeVendorInputs, validateVendor, createVendorHandler);
  ```

  Example (inline):

  ```js
  const gender = req.body.gender ? String(req.body.gender).toLowerCase() : undefined;
  // then validate using your existing schema with lowercase values
  ```

2) Make validation case-insensitive (if using a validator library)

  - Joi example (lowercase before validating is still simplest). If you prefer to use Joi's transform:

  ```js
  const schema = Joi.object({
    gender: Joi.string().valid('male','female','other').insensitive(),
    // other fields
  });
  // or normalize inside schema
  const schema = Joi.object({
    gender: Joi.string().lowercase().valid('male','female','other')
  });
  ```

  - For Zod (TS):

  ```ts
  const vendorSchema = z.object({
    gender: z.string().transform((s) => s.toLowerCase()).refine(v => ['male','female','other'].includes(v))
  });
  ```

3) If using Mongoose / DB enum: normalize before saving

  - Mongoose schema example:

  ```js
  const VendorSchema = new mongoose.Schema({
    gender: { type: String, enum: ['male','female','other'] },
    // ...
  });

  // normalize on save
  VendorSchema.pre('save', function(next) {
    if (this.gender) this.gender = this.gender.toLowerCase();
    next();
  });
  ```

  - If using a SQL DB with an enum type (Postgres), map/normalize before inserting.

Deployment / test instructions
----------------------------
1) Add a small unit/integration test that POSTs vendor payloads with various `gender` casing (`Male`, `MALE`, `male`) and assert success.

2) Quick manual curl test (PowerShell-friendly):

```powershell
curl -i -X POST "https://<your-host>/api/vendors" `
  -H "Authorization: Bearer <TOKEN>" `
  -F "vendorName=Test" `
  -F "mobile=+123456" `
  -F "gender=Male" `
  -F "businessName=TestBiz" `
  -F "selectedServices=[\"svc\"]"
```

If normalization is in place the request should pass the enum validation.

Notes & alternatives
--------------------
- Client-side fix: you can also change the client to always send lowercase enum values (e.g., `gender.toLowerCase()` on the client). This is quick but less robust — server normalization is recommended because it protects the API from any client.
- If you want to accept more enum synonyms (e.g., `m`, `f`, `other`), normalize/mapping logic can be added (map `m` -> `male`). Keep the API contract clear in docs.
- If the server is running on Vercel serverless functions, avoid relying on ephemeral local state; normalization before validation still applies.

Rollback / safety
-----------------
- Deploy the normalization behind a feature flag if you have strict change control. The change is low risk: it only converts casing for a single field expected to be short and safe.

Summary checklist
-----------------
- [ ] Normalize `gender` to lowercase before validation
- [ ] Add/adjust validation schema to expect lowercase values
- [ ] Add tests for different casings
- [ ] Optionally update client to send canonical values (lowercase)

If you want, I can also prepare a small server patch PR for your repository — tell me which server stack you use (Express, Next.js API route, Fastify, NestJS, etc.) and I'll produce the concrete patch.
