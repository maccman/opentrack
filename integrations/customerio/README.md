# Customer.io Integration

A comprehensive Customer.io integration for libroseg that implements all core tracking methods using the Pipelines API.

## Features

- ✅ **Identify**: Add and update user profiles
- ✅ **Track**: Send custom events and conversions
- ✅ **Page**: Track page views and navigation
- ✅ **Group**: Associate users with organizations/groups
- ✅ **Alias**: Merge user identities and resolve duplicates
- 🌍 **Multi-region support**: US and EU data centers
- 🔄 **Automatic retries**: Exponential backoff for resilient delivery
- 🛡️ **Error handling**: Comprehensive error mapping and validation
- 📊 **TypeScript**: Full type safety and IntelliSense support

## Installation

Install the required dependencies:

```bash
npm install customerio-node
```

## Configuration

### Environment Variables

Set the following environment variables:

```bash
CUSTOMERIO_SITE_ID=your_site_id
CUSTOMERIO_API_KEY=your_api_key
CUSTOMERIO_REGION=US  # or EU
```

### Programmatic Configuration

```typescript
import { CustomerioIntegration } from '@app/customerio';

// Create from environment variables
const customerio = CustomerioIntegration.fromEnvironment();

// Or create with explicit configuration
const customerio = new CustomerioIntegration({
  siteId: 'your_site_id',
  apiKey: 'your_api_key',
  region: 'US', // or 'EU'
  timeout: 10000, // optional, default 10s
  retryAttempts: 3, // optional, default 3
});
```

## Usage

### Identify Users

Add or update user profiles with attributes:

```typescript
await customerio.identify({
  userId: 'user_123',
  traits: {
    email: 'user@example.com',
    name: 'John Doe',
    plan: 'premium',
    company: 'Acme Corp',
    createdAt: new Date(),
  },
});
```

### Track Events

Send custom events and conversions:

```typescript
// Purchase event
await customerio.track({
  userId: 'user_123',
  event: 'Purchase Completed',
  properties: {
    orderId: 'order_456',
    revenue: 99.99,
    currency: 'USD',
    items: ['Product A', 'Product B'],
  },
});

// Anonymous event (before user login)
await customerio.track({
  event: 'Product Viewed',
  anonymousId: 'visitor_789',
  properties: {
    productId: 'prod_123',
    category: 'Electronics',
    price: 299.99,
  },
});
```

### Track Page Views

Monitor user navigation and engagement:

```typescript
await customerio.page({
  userId: 'user_123',
  category: 'Product',
  name: 'iPhone 15',
  properties: {
    url: '/products/iphone-15',
    title: 'iPhone 15 - Apple',
    referrer: '/products',
    search: '?color=blue',
  },
});
```

### Group Users

Associate users with organizations or accounts:

```typescript
await customerio.group({
  userId: 'user_123',
  groupId: 'company_456',
  traits: {
    name: 'Acme Corporation',
    industry: 'Technology',
    employees: 1500,
    plan: 'Enterprise',
  },
});
```

### Alias Users

Merge different user identities:

```typescript
// Merge anonymous visitor with registered user
await customerio.alias({
  userId: 'user_123',          // New permanent ID
  previousId: 'visitor_789',   // Previous anonymous/temporary ID
});
```

## Regional Configuration

Customer.io supports both US and EU data centers:

```typescript
// US region (default)
const customerioUS = new CustomerioIntegration({
  siteId: 'site_id',
  apiKey: 'api_key',
  region: 'US',
});

// EU region for GDPR compliance
const customerioEU = new CustomerioIntegration({
  siteId: 'site_id',
  apiKey: 'api_key',
  region: 'EU',
});

// Change region dynamically
customerio.setRegion('EU');
```

## Error Handling

The integration provides comprehensive error handling:

```typescript
try {
  await customerio.identify({
    userId: 'user_123',
    traits: { email: 'invalid-email' },
  });
} catch (error) {
  if (error.code === 'VALIDATION_ERROR') {
    console.log('Invalid data:', error.message);
  } else if (error.code === 'AUTHENTICATION_ERROR') {
    console.log('Check your credentials');
  } else if (error.code === 'RATE_LIMIT_ERROR') {
    console.log('Rate limited, will retry automatically');
  }
}
```

### Error Types

- `VALIDATION_ERROR`: Invalid request data
- `AUTHENTICATION_ERROR`: Invalid credentials
- `AUTHORIZATION_ERROR`: Insufficient permissions
- `RATE_LIMIT_ERROR`: Too many requests (auto-retried)
- `SERVER_ERROR`: Customer.io server issues (auto-retried)
- `NETWORK_ERROR`: Connection problems (auto-retried)
- `TIMEOUT_ERROR`: Request timeout (auto-retried)

## Testing

Test your Customer.io connection:

```typescript
const isConnected = await customerio.testConnection();
if (isConnected) {
  console.log('Customer.io connection successful');
} else {
  console.log('Customer.io connection failed - check credentials');
}
```

## Best Practices

### 1. User Identification

Always identify users with a consistent `userId`:

```typescript
// ✅ Good: Consistent user ID
await customerio.identify({
  userId: 'user_12345',
  traits: { email: 'user@example.com' },
});

// ❌ Bad: Using email as user ID (emails can change)
await customerio.identify({
  userId: 'user@example.com',
  traits: { name: 'John' },
});
```

### 2. Event Naming

Use clear, descriptive event names:

```typescript
// ✅ Good: Clear and descriptive
await customerio.track({
  userId: 'user_123',
  event: 'Purchase Completed',
  properties: { revenue: 99.99 },
});

// ❌ Bad: Vague or unclear
await customerio.track({
  userId: 'user_123',
  event: 'action',
  properties: { value: 99.99 },
});
```

### 3. Property Structure

Keep properties flat and JSON-serializable:

```typescript
// ✅ Good: Flat structure
await customerio.track({
  userId: 'user_123',
  event: 'Purchase Completed',
  properties: {
    order_id: 'ord_123',
    product_name: 'iPhone 15',
    revenue: 999.99,
    currency: 'USD',
  },
});

// ❌ Bad: Deep nesting
await customerio.track({
  userId: 'user_123',
  event: 'Purchase Completed',
  properties: {
    order: {
      id: 'ord_123',
      items: [
        { product: { name: 'iPhone 15' } },
      ],
    },
  },
});
```

### 4. Anonymous Tracking

Use consistent anonymous IDs for better user journey tracking:

```typescript
// Store anonymous ID in browser storage
const anonymousId = localStorage.getItem('anonymousId') || generateAnonymousId();

await customerio.track({
  event: 'Product Viewed',
  anonymousId,
  properties: { productId: 'prod_123' },
});

// Later, when user logs in, connect the data
await customerio.alias({
  userId: 'user_123',
  previousId: anonymousId,
});
```

## Advanced Configuration

### Custom Timeout and Retries

```typescript
const customerio = new CustomerioIntegration({
  siteId: 'site_id',
  apiKey: 'api_key',
  timeout: 15000,      // 15 second timeout
  retryAttempts: 5,    // Retry up to 5 times
});
```

### Development vs Production

```typescript
const customerio = new CustomerioIntegration({
  siteId: process.env.NODE_ENV === 'production' 
    ? process.env.CUSTOMERIO_SITE_ID_PROD
    : process.env.CUSTOMERIO_SITE_ID_DEV,
  apiKey: process.env.NODE_ENV === 'production'
    ? process.env.CUSTOMERIO_API_KEY_PROD
    : process.env.CUSTOMERIO_API_KEY_DEV,
});
```

## Troubleshooting

### Common Issues

1. **Authentication Errors**
   - Verify your Site ID and API Key
   - Check that you're using the correct region

2. **Invalid Email Errors**
   - Ensure email addresses are valid format
   - Use the built-in email validation

3. **Rate Limiting**
   - The integration automatically retries with exponential backoff
   - Consider reducing request frequency if persistent

4. **Connection Timeouts**
   - Check your network connectivity
   - Increase timeout configuration if needed

### Debug Mode

Enable debug logging to troubleshoot issues:

```typescript
// Set environment variable
process.env.DEBUG = 'customerio:*';

// Or use the test connection method
const connected = await customerio.testConnection();
console.log('Connection status:', connected);
```

## Support

For issues specific to this integration, please check:

1. [Customer.io API Documentation](https://customer.io/docs/api/)
2. [Customer.io Node.js SDK](https://github.com/customerio/customerio-node)
3. [Integration Tests](./src/__tests__/) for usage examples

## License

MIT License - see [LICENSE](../../LICENSE) for details.