# Webhook Integration for Libroseg

This package provides a flexible webhook integration for Libroseg, allowing you to send analytics events to any HTTP endpoint. It supports all Segment event types (track, identify, page, group, alias) and includes robust error handling and retry logic.

## Features

- **Universal HTTP Support**: Send events to any HTTP endpoint using GET, POST, PUT, PATCH, or DELETE methods
- **Flexible Payload Format**: Choose between full payload or minimal payload formats
- **Automatic Retries**: Built-in exponential backoff retry logic for failed requests
- **Error Handling**: Comprehensive error mapping and classification for different types of failures
- **SSL Configuration**: Option to disable SSL validation for development environments
- **Custom Headers**: Support for authentication headers and custom request headers
- **Connection Testing**: Built-in endpoint connectivity testing

## Setup and Configuration

To use the webhook integration, you need to configure the following environment variables.

### Required Variables

- `WEBHOOK_URL`: The HTTP endpoint where events will be sent.

### Example Environment Configuration

```bash
# Basic configuration
WEBHOOK_URL=https://your-webhook-endpoint.com/events
```

The integration uses sensible defaults:

- **Method**: `POST`
- **Timeout**: `10 seconds`
- **Retry Attempts**: `3`
- **Include Full Payload**: `true`
- **SSL Validation**: `true`

For advanced configuration needs, you can create a custom integration instance programmatically with additional options.

## Payload Format

The webhook integration transforms Segment events into a standardized webhook payload format:

### Full Payload Format (default)

```json
{
  "type": "track",
  "messageId": "unique-message-id",
  "timestamp": "2023-01-01T12:00:00.000Z",
  "userId": "user123",
  "anonymousId": "anon123",
  "originalPayload": {
    // Original Segment payload
  },
  "data": {
    "event": "Product Purchased",
    "properties": {
      "productId": "prod123",
      "price": 99.99
    }
  },
  "context": {
    "ip": "192.168.1.1",
    "userAgent": "Mozilla/5.0..."
  },
  "integrations": {
    "webhook": {
      "sentAt": "2023-01-01T12:00:00.000Z",
      "version": "1.0.0"
    }
  }
}
```

### Minimal Payload Format

When `WEBHOOK_INCLUDE_PAYLOAD=false`, the `originalPayload` field is excluded to reduce payload size.

## Event Type Transformations

### Track Events

```json
{
  "type": "track",
  "data": {
    "event": "Product Purchased",
    "properties": {
      /* event properties */
    }
  }
}
```

### Identify Events

```json
{
  "type": "identify",
  "data": {
    "traits": {
      /* user traits */
    }
  }
}
```

### Page Events

```json
{
  "type": "page",
  "data": {
    "name": "Home Page",
    "properties": {
      /* page properties */
    }
  }
}
```

### Group Events

```json
{
  "type": "group",
  "data": {
    "groupId": "group123",
    "traits": {
      /* group traits */
    }
  }
}
```

### Alias Events

```json
{
  "type": "alias",
  "data": {
    "previousId": "old-user-id",
    "userId": "new-user-id"
  }
}
```

## HTTP Methods

### POST/PUT/PATCH (default)

Events are sent in the request body as JSON.

### GET

Events are sent as URL query parameters. Complex objects are JSON-encoded.

### DELETE

Events are sent in the request body as JSON (useful for deletion tracking).

## Error Handling and Retries

The webhook integration includes sophisticated error handling:

### Retryable Errors

- **5xx Server Errors**: 500, 502, 503, 504
- **429 Rate Limited**: Temporary rate limiting
- **Network Errors**: Connection refused, timeouts, connection resets

### Non-Retryable Errors

- **4xx Client Errors**: 400, 401, 403, 404, 422 (except 429)
- **DNS Errors**: Invalid hostname
- **SSL Certificate Errors**: Invalid certificates (when validation enabled)

### Retry Logic

- **Exponential Backoff**: Base delay of 1 second, doubling with each retry
- **Jitter**: Random delay variation to prevent thundering herd
- **Maximum Delay**: Capped at 30 seconds
- **Configurable Attempts**: 0-10 retry attempts

## Authentication

The webhook integration supports various authentication methods through custom headers:

### Bearer Token

```bash
WEBHOOK_HEADERS='{"Authorization":"Bearer your-jwt-token"}'
```

### API Key

```bash
WEBHOOK_HEADERS='{"X-API-Key":"your-api-key"}'
```

### Basic Authentication

```bash
WEBHOOK_HEADERS='{"Authorization":"Basic base64-encoded-credentials"}'
```

### Custom Authentication

```bash
WEBHOOK_HEADERS='{"X-Custom-Auth":"your-custom-auth-value"}'
```

## Development and Testing

### Connection Testing

The integration includes a built-in connection test method:

```typescript
import { WebhookIntegration } from '@integrations/webhook'

const webhook = new WebhookIntegration({
  url: 'https://webhook.example.com/events',
})

const isConnected = await webhook.testConnection()
console.log('Webhook connection:', isConnected ? 'OK' : 'Failed')
```

### Local Development

For local testing, you can disable SSL validation:

```bash
WEBHOOK_URL=https://localhost:3000/webhook
WEBHOOK_VALIDATE_SSL=false
```

### Debugging

Enable debug logging by setting the Libroseg debug environment variable:

```bash
LIBROSEG_DEBUG=true
```

## Example Webhook Receivers

### Express.js Server

```javascript
const express = require('express')
const app = express()

app.use(express.json())

app.post('/webhook', (req, res) => {
  console.log('Received webhook:', req.body)

  // Process the event data
  const { type, data, userId } = req.body

  switch (type) {
    case 'track':
      console.log(`User ${userId} performed: ${data.event}`)
      break
    case 'identify':
      console.log(`User ${userId} identified with traits:`, data.traits)
      break
    // Handle other event types...
  }

  res.status(200).send('OK')
})

app.listen(3000, () => {
  console.log('Webhook server running on port 3000')
})
```

### Serverless Function (Vercel/Netlify)

```javascript
export default function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const { type, data, userId } = req.body

  // Process webhook data
  console.log(`Received ${type} event for user ${userId}`)

  res.status(200).json({ success: true })
}
```

## Security Considerations

### HTTPS Only

Always use HTTPS endpoints in production to encrypt data in transit.

### Authentication

Implement proper authentication on your webhook endpoint to prevent unauthorized access.

### Validation

Validate incoming webhook payloads to ensure data integrity:

```javascript
function validateWebhook(payload) {
  const requiredFields = ['type', 'messageId', 'timestamp']

  for (const field of requiredFields) {
    if (!payload[field]) {
      throw new Error(`Missing required field: ${field}`)
    }
  }

  return true
}
```

### IP Allowlisting

Consider restricting webhook endpoint access to known IP ranges if possible.

## Troubleshooting

### Common Issues

1. **Connection Refused**: Check that the webhook URL is correct and the endpoint is running
2. **SSL Certificate Errors**: Verify SSL certificates or set `WEBHOOK_VALIDATE_SSL=false` for testing
3. **Authentication Failures**: Ensure headers are properly formatted JSON and credentials are valid
4. **Timeout Errors**: Increase `WEBHOOK_TIMEOUT` or optimize your webhook endpoint performance
5. **Rate Limiting**: Implement proper rate limiting on your endpoint or increase retry delays

### Testing Webhook Endpoints

You can test your webhook endpoint manually using curl:

```bash
curl -X POST https://your-webhook-endpoint.com/events \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer your-token" \
  -d '{
    "type": "test",
    "messageId": "test-123",
    "timestamp": "2023-01-01T12:00:00.000Z",
    "data": {
      "message": "Test webhook"
    }
  }'
```

## Performance Considerations

- **Endpoint Response Time**: Keep webhook endpoint response times under 5 seconds
- **Payload Size**: Consider using minimal payload format for high-volume applications
- **Batch Processing**: Implement batch processing in your webhook receiver for better performance
- **Async Processing**: Use async processing to avoid blocking the webhook response
