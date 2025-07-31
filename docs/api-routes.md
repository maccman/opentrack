# OpenTrack API Routes Documentation

This document provides comprehensive documentation for all OpenTrack API routes under `/v1/`. OpenTrack implements a Segment-compatible HTTP Tracking API that enables real-time event collection and processing.

## Table of Contents

- [Overview](#overview)
- [Authentication](#authentication)
- [Common Response Format](#common-response-format)
- [Error Handling](#error-handling)
- [API Endpoints](#api-endpoints)
  - [POST /v1/track](#post-v1track)
  - [POST /v1/identify](#post-v1identify)
  - [POST /v1/page](#post-v1page)
  - [POST /v1/group](#post-v1group)
  - [POST /v1/alias](#post-v1alias)
  - [POST /v1/batch](#post-v1batch)
- [Payload Validation](#payload-validation)
- [Integration Processing](#integration-processing)
- [Examples](#examples)

## Overview

OpenTrack provides five core tracking methods plus a batch endpoint:

| Method   | Endpoint       | Purpose                                  |
| -------- | -------------- | ---------------------------------------- |
| Track    | `/v1/track`    | Record user actions and custom events    |
| Identify | `/v1/identify` | Set user traits and associate identities |
| Page     | `/v1/page`     | Record page views and screen navigation  |
| Group    | `/v1/group`    | Associate users with organizations       |
| Alias    | `/v1/alias`    | Merge user identities across sessions    |
| Batch    | `/v1/batch`    | Send multiple events in a single request |

## Authentication

Currently, OpenTrack routes do not require authentication (unlike Segment's write key requirement). This makes it suitable for self-hosted deployments where access is controlled at the infrastructure level.

```bash
# No Authorization header required
curl -X POST https://your-opentrack-deployment.vercel.app/v1/track \
  -H "Content-Type: application/json" \
  -d '{"userId": "user123", "event": "Button Clicked"}'
```

## Common Response Format

### Success Response

All successful requests return a simple success indicator:

```json
{
  "success": true
}
```

**HTTP Status:** `200 OK`

### Error Response

Validation errors return detailed error information:

```json
{
  "error": "Invalid payload",
  "details": [
    {
      "code": "invalid_type",
      "expected": "string",
      "received": "undefined",
      "path": ["event"],
      "message": "Required"
    }
  ]
}
```

**HTTP Status:** `400 Bad Request`

## Error Handling

All routes implement consistent error handling:

1. **Payload Parsing**: Request body is parsed as JSON
2. **Schema Validation**: Zod schemas validate the payload structure
3. **Type Coercion**: The `type` field is automatically added based on the endpoint
4. **Error Response**: Validation failures return detailed error information

## API Endpoints

### POST /v1/track

Records user actions and custom events.

#### Payload Structure

```json
{
  "userId": "string", // Required if anonymousId not provided
  "anonymousId": "string", // Required if userId not provided
  "event": "string", // Required - name of the event
  "properties": {
    // Optional - event-specific data
    "key": "value"
  },
  "context": {
    // Optional - additional context
    "ip": "string",
    "userAgent": "string",
    "page": {
      "url": "string",
      "title": "string"
    }
  },
  "timestamp": "string", // Optional - ISO 8601 timestamp
  "messageId": "string", // Optional - unique message identifier
  "integrations": {
    // Optional - integration settings
    "destination": true
  }
}
```

#### Example Request

```bash
curl -X POST https://your-deployment.vercel.app/v1/track \
  -H "Content-Type: application/json" \
  -d '{
    "userId": "user_12345",
    "event": "Product Purchased",
    "properties": {
      "productId": "widget_001",
      "productName": "Premium Widget",
      "price": 99.99,
      "currency": "USD",
      "category": "Electronics"
    },
    "timestamp": "2025-01-15T14:30:00.000Z"
  }'
```

### POST /v1/identify

Sets user traits and associates anonymous activity with known users.

#### Payload Structure

```json
{
  "userId": "string", // Required if anonymousId not provided
  "anonymousId": "string", // Required if userId not provided
  "traits": {
    // Optional - user attributes
    "email": "string",
    "firstName": "string",
    "lastName": "string",
    "company": "string",
    "plan": "string"
  },
  "context": {
    // Optional - additional context
    "ip": "string",
    "userAgent": "string"
  },
  "timestamp": "string", // Optional - ISO 8601 timestamp
  "messageId": "string", // Optional - unique message identifier
  "integrations": {
    // Optional - integration settings
    "destination": true
  }
}
```

#### Example Request

```bash
curl -X POST https://your-deployment.vercel.app/v1/identify \
  -H "Content-Type: application/json" \
  -d '{
    "userId": "user_12345",
    "anonymousId": "anon_abc123",
    "traits": {
      "email": "john.doe@example.com",
      "firstName": "John",
      "lastName": "Doe",
      "company": "Example Corp",
      "plan": "premium",
      "signupSource": "organic_search"
    },
    "timestamp": "2025-01-15T14:30:00.000Z"
  }'
```

### POST /v1/page

Records page views and screen navigation.

#### Payload Structure

```json
{
  "userId": "string", // Required if anonymousId not provided
  "anonymousId": "string", // Required if userId not provided
  "name": "string", // Optional - human-readable page name
  "category": "string", // Optional - page category
  "properties": {
    // Optional - page-specific data
    "url": "string",
    "title": "string",
    "referrer": "string",
    "path": "string",
    "search": "string"
  },
  "context": {
    // Optional - additional context
    "ip": "string",
    "userAgent": "string",
    "page": {
      "url": "string",
      "title": "string"
    }
  },
  "timestamp": "string", // Optional - ISO 8601 timestamp
  "messageId": "string", // Optional - unique message identifier
  "integrations": {
    // Optional - integration settings
    "destination": true
  }
}
```

#### Example Request

```bash
curl -X POST https://your-deployment.vercel.app/v1/page \
  -H "Content-Type: application/json" \
  -d '{
    "userId": "user_12345",
    "name": "Product Detail",
    "category": "E-commerce",
    "properties": {
      "url": "https://store.example.com/products/widget",
      "title": "Premium Widget - Example Store",
      "referrer": "https://store.example.com/category/electronics",
      "productId": "widget_001",
      "productCategory": "Electronics"
    },
    "timestamp": "2025-01-15T14:30:00.000Z"
  }'
```

### POST /v1/group

Associates users with groups, companies, or accounts (B2B use cases).

#### Payload Structure

```json
{
  "userId": "string", // Required if anonymousId not provided
  "anonymousId": "string", // Required if userId not provided
  "groupId": "string", // Required - unique group identifier
  "traits": {
    // Optional - group attributes
    "name": "string",
    "plan": "string",
    "employees": "number",
    "industry": "string"
  },
  "context": {
    // Optional - additional context
    "ip": "string",
    "userAgent": "string"
  },
  "timestamp": "string", // Optional - ISO 8601 timestamp
  "messageId": "string", // Optional - unique message identifier
  "integrations": {
    // Optional - integration settings
    "destination": true
  }
}
```

#### Example Request

```bash
curl -X POST https://your-deployment.vercel.app/v1/group \
  -H "Content-Type: application/json" \
  -d '{
    "userId": "user_12345",
    "groupId": "company_567",
    "traits": {
      "name": "Example Corporation",
      "plan": "enterprise",
      "employees": 500,
      "industry": "Technology",
      "website": "https://example.com"
    },
    "timestamp": "2025-01-15T14:30:00.000Z"
  }'
```

### POST /v1/alias

Merges user identities across sessions or devices.

#### Payload Structure

```json
{
  "userId": "string", // Required - new user identifier
  "previousId": "string", // Required - previous identifier to merge
  "context": {
    // Optional - additional context
    "ip": "string",
    "userAgent": "string"
  },
  "timestamp": "string", // Optional - ISO 8601 timestamp
  "messageId": "string", // Optional - unique message identifier
  "integrations": {
    // Optional - integration settings
    "destination": true
  }
}
```

#### Example Request

```bash
curl -X POST https://your-deployment.vercel.app/v1/alias \
  -H "Content-Type: application/json" \
  -d '{
    "userId": "user_12345",
    "previousId": "anon_abc123",
    "timestamp": "2025-01-15T14:30:00.000Z"
  }'
```

### POST /v1/batch

Sends multiple events in a single request for improved performance.

#### Payload Structure

```json
{
  "batch": [
    {
      "type": "track|identify|page|group|alias"
      // ... event-specific fields
    },
    {
      "type": "track|identify|page|group|alias"
      // ... event-specific fields
    }
  ]
}
```

#### Success Response

```json
{
  "success": true,
  "processed": 2, // Number of successfully processed events
  "total": 2, // Total number of events in batch
  "errors": [] // Array of errors (if any partial failures)
}
```

#### Partial Success Response

```json
{
  "success": true,
  "processed": 1,
  "total": 2,
  "errors": [
    {
      "error": "Invalid payload",
      "details": [...],
      "type": "track"
    }
  ]
}
```

#### Example Request

```bash
curl -X POST https://your-deployment.vercel.app/v1/batch \
  -H "Content-Type: application/json" \
  -d '{
    "batch": [
      {
        "type": "identify",
        "userId": "user_12345",
        "traits": {
          "email": "john@example.com",
          "plan": "premium"
        }
      },
      {
        "type": "track",
        "userId": "user_12345",
        "event": "Product Purchased",
        "properties": {
          "productId": "widget_001",
          "price": 99.99
        }
      },
      {
        "type": "page",
        "userId": "user_12345",
        "name": "Thank You Page",
        "properties": {
          "url": "https://store.example.com/thank-you"
        }
      }
    ]
  }'
```

## Payload Validation

All routes use Zod schemas for robust payload validation:

- **Track Events**: `trackEventSchema` validates required `event` field and optional properties
- **Identify Events**: `identifyEventSchema` validates user identity and traits
- **Page Events**: `pageEventSchema` validates page information and properties
- **Group Events**: `groupEventSchema` validates group association and traits
- **Alias Events**: `aliasEventSchema` validates identity merging fields
- **Batch Events**: Each event in the batch is validated against its respective schema

### Common Validation Rules

1. **Identity Requirement**: At least one of `userId` or `anonymousId` is required
2. **Type Injection**: The `type` field is automatically added based on the endpoint
3. **Field Constraints**: String length limits, object depth limits, array size limits
4. **Data Types**: Strict type checking for all fields

## Integration Processing

All routes use asynchronous processing via Vercel's `waitUntil` function:

1. **Immediate Response**: Routes return success immediately after validation
2. **Async Processing**: Events are processed by `IntegrationManager` in the background
3. **Integration Fanout**: Events are sent to all enabled integrations (BigQuery, Customer.io, etc.)
4. **Error Resilience**: Integration failures don't affect the API response

```typescript
// Simplified processing flow
const validation = schema.safeParse(payload)
if (!validation.success) {
  return { error: 'Invalid payload', details: validation.error.issues }
}

waitUntil(integrationManager.process(validation.data))
return { success: true }
```

## Examples

### Complete User Journey

```bash
# 1. Anonymous page view
curl -X POST https://your-deployment.vercel.app/v1/page \
  -H "Content-Type: application/json" \
  -d '{
    "anonymousId": "anon_abc123",
    "name": "Landing Page",
    "properties": {
      "url": "https://example.com",
      "utm_source": "google"
    }
  }'

# 2. User signup (identify)
curl -X POST https://your-deployment.vercel.app/v1/identify \
  -H "Content-Type: application/json" \
  -d '{
    "userId": "user_12345",
    "anonymousId": "anon_abc123",
    "traits": {
      "email": "john@example.com",
      "firstName": "John",
      "plan": "free"
    }
  }'

# 3. Merge identities
curl -X POST https://your-deployment.vercel.app/v1/alias \
  -H "Content-Type: application/json" \
  -d '{
    "userId": "user_12345",
    "previousId": "anon_abc123"
  }'

# 4. Purchase event
curl -X POST https://your-deployment.vercel.app/v1/track \
  -H "Content-Type: application/json" \
  -d '{
    "userId": "user_12345",
    "event": "Product Purchased",
    "properties": {
      "productId": "widget_001",
      "revenue": 99.99,
      "currency": "USD"
    }
  }'
```

### Using with Analytics SDKs

```javascript
// analytics-node example
import Analytics from 'analytics-node'

const analytics = new Analytics('dummy-key', {
  host: 'https://your-opentrack-deployment.vercel.app',
})

// Events will be sent to your OpenTrack instance
analytics.track({
  userId: 'user123',
  event: 'Product Purchased',
  properties: {
    productId: '12345',
    revenue: 99.99,
  },
})
```

### Error Handling Examples

```bash
# Missing required field
curl -X POST https://your-deployment.vercel.app/v1/track \
  -H "Content-Type: application/json" \
  -d '{
    "userId": "user123"
    // Missing required "event" field
  }'

# Response: 400 Bad Request
{
  "error": "Invalid payload",
  "details": [
    {
      "code": "invalid_type",
      "expected": "string",
      "received": "undefined",
      "path": ["event"],
      "message": "Required"
    }
  ]
}
```

## Performance Considerations

1. **Async Processing**: Use `waitUntil` to avoid blocking the response
2. **Batch Operations**: Use `/v1/batch` for multiple events to reduce request overhead
3. **Validation**: Zod schemas provide fast validation with detailed error messages
4. **Integration Resilience**: Integration failures don't affect API response times

## Next Steps

- Review individual method documentation for detailed field specifications
- Configure integrations in the `IntegrationManager`
- Implement client-side SDKs pointing to your OpenTrack deployment
- Monitor integration processing and error rates
