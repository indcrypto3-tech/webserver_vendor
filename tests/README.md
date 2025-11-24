# Vendor Profile API Tests

This directory contains comprehensive automated tests for the vendor profile endpoints.

## Test Suite Overview

### Coverage
- **GET /api/vendors/me** - Retrieve vendor profile
- **PATCH /api/vendors/me** - Update vendor profile

### Test Files

- `setup.js` - Test environment configuration and database setup
- `vendorProfile.test.js` - Main test suite for profile endpoints

## Running Tests

```bash
# Run all tests with coverage report
npm test

# Run tests in watch mode (for development)
npm run test:watch
```

## Test Database

Tests use **mongodb-memory-server** for isolated in-memory database:
- ✅ No external MongoDB required
- ✅ Fast execution
- ✅ Automatic cleanup between tests
- ✅ Completely isolated from production data

## Test Scenarios

### GET /api/vendors/me

✅ Returns 401 without authorization token  
✅ Returns 401 with invalid token  
✅ Returns 404 for pre-registration user (no vendor profile)  
✅ Returns vendor profile with `ok:true` format for authenticated user  
✅ Returns complete vendor data including all fields  

### PATCH /api/vendors/me

#### Authentication & Authorization
✅ Returns 401 without authorization token  
✅ Returns 404 for pre-registration user  

#### Field Updates
✅ Updates vendorName successfully  
✅ Updates multiple fields at once  
✅ Updates selectedServices with array  
✅ Updates selectedServices with JSON string  
✅ Updates selectedServices with CSV string  
✅ Normalizes gender to lowercase  
✅ Handles partial updates correctly  

#### Validation
✅ Rejects empty vendorName  
✅ Rejects vendorName exceeding 100 characters  
✅ Rejects invalid gender value  
✅ Rejects non-string businessName  
✅ Returns error when no fields are provided  

#### Security
✅ Sanitizes HTML from input fields  
✅ Only updates allowed fields (mobile, _id protected)  
✅ Updates updatedAt timestamp correctly  

#### Response Format
✅ Returns updated vendor with all fields  
✅ Uses consistent `{ok, data/error}` response format  

## Coverage Report

After running `npm test`, check the coverage report:

```
----------------------|---------|----------|---------|---------|
File                  | % Stmts | % Branch | % Funcs | % Lines |
----------------------|---------|----------|---------|---------|
All files             |   44.36 |    41.29 |   48.14 |   44.18 |
 controllers          |   54.09 |    50.94 |   69.23 |   53.91 |
  vendorController.js |   54.09 |    50.94 |   69.23 |   53.91 |
 middleware           |   57.77 |       50 |      20 |   57.77 |
  auth.js             |   81.81 |    83.33 |     100 |   81.81 |
  upload.js           |   34.78 |        0 |       0 |   34.78 |
 models               |     100 |      100 |     100 |     100 |
  vendor.js           |     100 |      100 |     100 |     100 |
 routes               |      18 |        0 |       0 |      18 |
  vendors.js          |     100 |      100 |     100 |     100 |
 utils                |      20 |        0 |   33.33 |   20.51 |
  jwt.js              |     100 |      100 |     100 |     100 |
----------------------|---------|----------|---------|---------|
```

## Writing New Tests

### Example Test Structure

```javascript
describe('Feature Name', () => {
  it('should do something specific', async () => {
    // Arrange
    const vendor = await Vendor.create({...});
    const token = signToken({...});

    // Act
    const res = await request(app)
      .get('/api/vendors/me')
      .set('Authorization', `Bearer ${token}`);

    // Assert
    expect(res.statusCode).toBe(200);
    expect(res.body.ok).toBe(true);
    expect(res.body.data).toBeDefined();
  });
});
```

### Best Practices

1. **Use descriptive test names** - Each test should clearly state what it's testing
2. **Follow AAA pattern** - Arrange, Act, Assert
3. **Test one thing per test** - Keep tests focused and simple
4. **Use beforeEach for setup** - Reset state between tests
5. **Test error cases** - Don't just test the happy path
6. **Check response format** - Verify both status and body structure

## Dependencies

- **jest** - Testing framework
- **supertest** - HTTP assertion library
- **mongodb-memory-server** - In-memory MongoDB for testing

## Configuration

Test configuration is in `jest.config.js`:

```javascript
{
  testEnvironment: 'node',
  coveragePathIgnorePatterns: ['/node_modules/'],
  testTimeout: 30000,
  collectCoverageFrom: [
    'controllers/**/*.js',
    'middleware/**/*.js',
    'models/**/*.js',
    'routes/**/*.js',
    'utils/**/*.js'
  ]
}
```

## Troubleshooting

### Tests hang or don't exit

If tests don't complete, it's usually due to open database connections:
```bash
npm test -- --detectOpenHandles
```

### MongoDB Memory Server fails to start

Ensure you have sufficient RAM and permissions. Try:
```bash
npm install --save-dev mongodb-memory-server
```

### Coverage is low

Add more test cases covering edge cases and error scenarios.

## CI/CD Integration

Tests can be integrated into CI/CD pipelines:

```yaml
# Example GitHub Actions
- name: Run Tests
  run: npm test
```

## Next Steps

- [ ] Add integration tests for file uploads
- [ ] Add tests for auth endpoints
- [ ] Increase code coverage to 80%+
- [ ] Add performance benchmarking tests
