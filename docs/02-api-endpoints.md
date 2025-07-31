# API Endpoints

## Base URLs

Segment provides regional endpoints for data residency and compliance:

| Region    | Base URL                 | Purpose                                   |
| --------- | ------------------------ | ----------------------------------------- |
| Global/US | `https://api.segment.io` | Default endpoint for global usage         |
| EU        | `https://api.segment.eu` | European data residency (GDPR compliance) |

## Authentication

### Write Key Authentication

All tracking API requests use HTTP Basic Authentication with your Write Key:

```
Authorization: Basic {base64(writeKey:)}
```

**Example:**

```bash
# If your write key is "abc123"
echo -n "abc123:" | base64
# Returns: YWJjMTIzOg==

curl -H "Authorization: Basic YWJjMTIzOg==" \
     -H "Content-Type: application/json" \
     https://api.segment.io/v1/track
```

### Write Key Security

- **Client-side Safe**: Write keys can be exposed in client-side code
- **Source-specific**: Each source has its own write key
- **Limited Permissions**: Can only send data, not read or configure
- **Rotation**: Keys can be regenerated in Segment dashboard

## Core Tracking Endpoints

### Track Events

```
POST /v1/track
```

Records user actions and custom events.

### Identify Users

```
POST /v1/identify
```

Sets user traits and associates anonymous activity with known users.

### Page Views

```
POST /v1/page
```

Records page views and screen navigation.

### Group Association

```
POST /v1/group
```

Associates users with groups, companies, or accounts.

### Alias Users

```
POST /v1/alias
```

Merges user identities across sessions or devices.

## Request Format

### Content Type

```
Content-Type: application/json
```

### Request Body Structure

All endpoints accept JSON payloads with a common structure:

```json
{
  "type": "track|identify|page|group|alias",
  "userId": "string",
  "anonymousId": "string",
  "timestamp": "ISO 8601 string",
  "context": {
    "ip": "string",
    "userAgent": "string",
    "library": {
      "name": "string",
      "version": "string"
    }
  },
  "integrations": {
    "destination": true|false
  },
  "messageId": "string",
  // Method-specific fields...
}
```

### Batch Requests

Send multiple events in a single request:

```json
{
  "batch": [
    {
      "type": "track",
      "userId": "user123",
      "event": "Button Clicked"
    },
    {
      "type": "identify",
      "userId": "user123",
      "traits": {
        "email": "user@example.com"
      }
    }
  ]
}
```

**Batch Endpoint:**

```
POST /v1/batch
```

## Rate Limits

### Standard Limits

- **Requests per second**: 1,000 per source
- **Events per request**: 100 (recommended batch size)
- **Maximum payload size**: 500KB per request
- **Maximum event size**: 32KB per individual event

### Enterprise Limits

Enterprise customers can request higher limits:

- **Requests per second**: Up to 10,000+ per source
- **Payload size**: Up to 2MB per request
- **Custom batching**: Larger batch sizes available

### Rate Limit Headers

```
X-RateLimit-Limit: 1000
X-RateLimit-Remaining: 999
X-RateLimit-Reset: 1642684800
```

### Rate Limit Handling

When rate limited, the API returns:

```
HTTP/1.1 429 Too Many Requests
Content-Type: application/json

{
  "error": {
    "type": "rate_limit_exceeded",
    "message": "Rate limit exceeded"
  }
}
```

**Best Practices:**

- Implement exponential backoff
- Use batch requests to reduce total requests
- Monitor rate limit headers
- Queue events client-side during rate limits

## Request/Response Examples

### Successful Request

```bash
curl -X POST https://api.segment.io/v1/track \
  -H "Authorization: Basic $(echo -n 'writeKey:' | base64)" \
  -H "Content-Type: application/json" \
  -d '{
    "userId": "user123",
    "event": "Product Purchased",
    "properties": {
      "productId": "12345",
      "revenue": 99.99,
      "currency": "USD"
    }
  }'
```

**Response:**

```
HTTP/1.1 200 OK
Content-Type: application/json

{
  "success": true
}
```

### Error Response

```
HTTP/1.1 400 Bad Request
Content-Type: application/json

{
  "error": {
    "type": "validation_error",
    "message": "Missing required field: userId or anonymousId"
  }
}
```

## Response Codes

| Code | Status                | Description                                       |
| ---- | --------------------- | ------------------------------------------------- |
| 200  | OK                    | Request processed successfully                    |
| 400  | Bad Request           | Invalid request format or missing required fields |
| 401  | Unauthorized          | Invalid or missing authentication                 |
| 429  | Too Many Requests     | Rate limit exceeded                               |
| 500  | Internal Server Error | Server error, retry with backoff                  |
| 502  | Bad Gateway           | Temporary server issue, retry                     |
| 503  | Service Unavailable   | Service temporarily unavailable                   |

## Error Types

### Validation Errors (400)

```json
{
  "error": {
    "type": "validation_error",
    "message": "Missing required field: event",
    "field": "event"
  }
}
```

### Authentication Errors (401)

```json
{
  "error": {
    "type": "authentication_error",
    "message": "Invalid write key"
  }
}
```

### Rate Limit Errors (429)

```json
{
  "error": {
    "type": "rate_limit_exceeded",
    "message": "Rate limit exceeded",
    "retryAfter": 60
  }
}
```

## Best Practices

### Performance Optimization

1. **Use Batching**: Combine multiple events in batch requests
2. **Enable Compression**: Use `Content-Encoding: gzip`
3. **Implement Queuing**: Queue events client-side with retry logic
4. **Cache Write Keys**: Don't fetch write keys on every request

### Error Handling

1. **Retry Logic**: Implement exponential backoff for 5xx errors
2. **Validate Data**: Check required fields before sending
3. **Log Errors**: Monitor and log API responses
4. **Graceful Degradation**: Continue app functionality if tracking fails

### Security

1. **Use HTTPS**: Always use encrypted connections
2. **Rotate Keys**: Regularly rotate write keys
3. **Environment Separation**: Use different keys for dev/staging/prod
4. **Monitor Usage**: Track API usage and detect anomalies

### Data Quality

1. **Consistent Naming**: Use consistent event and property names
2. **Validate Schema**: Implement client-side schema validation
3. **Standardize Types**: Use consistent data types across events
4. **Document Events**: Maintain documentation of tracked events

## Regional Considerations

### EU Data Residency

```bash
# Route to EU servers
curl -X POST https://api.segment.eu/v1/track \
  -H "Authorization: Basic $(echo -n 'writeKey:' | base64)" \
  -H "Content-Type: application/json" \
  -d '{"userId": "user123", "event": "Page Viewed"}'
```

### GDPR Compliance

- Data processed within EU borders
- Support for user data deletion requests
- Consent management integration
- Privacy-first data collection

## Testing and Development

### Test Mode

Use separate write keys for testing:

- Development environment write key
- Staging environment write key
- Production environment write key

### Debugging

Enable debug mode in SDKs to see request/response details:

```javascript
analytics.debug(true)
```

### Validation

Test API integration:

```bash
# Test connection
curl -X POST https://api.segment.io/v1/track \
  -H "Authorization: Basic $(echo -n 'testWriteKey:' | base64)" \
  -H "Content-Type: application/json" \
  -d '{"anonymousId": "test", "event": "Test Event"}'
```

## Next Steps

- Implement [Track method](./03-track.md) for event collection
- Set up [Identify method](./04-identify.md) for user identification
- Review [Common Fields](./08-common-fields.md) for payload structure details
