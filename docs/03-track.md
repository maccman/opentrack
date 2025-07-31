# Track Method

## Overview

The `track` method records user actions and custom events. It's the core method for capturing user behavior, from simple button clicks to complex business events like purchases or signups.

## Endpoint

```
POST /v1/track
```

## When to Use Track

Use `track` to record:

- **User Actions**: Button clicks, form submissions, video plays
- **Business Events**: Purchases, signups, subscriptions
- **Content Interaction**: Article reads, downloads, shares
- **Application Events**: Feature usage, errors, performance metrics
- **Custom Events**: Any event specific to your business logic

## Required Fields

| Field                     | Type   | Description                             |
| ------------------------- | ------ | --------------------------------------- |
| `userId` OR `anonymousId` | String | User identifier (at least one required) |
| `event`                   | String | Name of the event being tracked         |

## Payload Structure

```json
{
  "type": "track",
  "userId": "string",
  "anonymousId": "string",
  "event": "string",
  "properties": {
    "key": "value"
  },
  "context": {
    "ip": "string",
    "userAgent": "string",
    "page": {
      "url": "string",
      "title": "string",
      "referrer": "string"
    },
    "library": {
      "name": "string",
      "version": "string"
    }
  },
  "timestamp": "2025-01-15T10:30:00.000Z",
  "messageId": "string",
  "integrations": {
    "destination": true|false
  }
}
```

## Field Specifications

### Core Fields

#### event (required)

- **Type**: String
- **Description**: Name of the event being tracked
- **Constraints**:
  - Max length: 200 characters
  - Avoid `$` prefix (reserved for Segment)
  - Use consistent naming conventions

**Examples:**

```json
"event": "Product Purchased"
"event": "Button Clicked"
"event": "Video Played"
"event": "Form Submitted"
```

#### properties (optional)

- **Type**: Object
- **Description**: Event-specific data and context
- **Constraints**:
  - Max 255 properties per event
  - Property names max 255 characters
  - Nested objects max 3 levels deep
  - Arrays max 255 elements

**Common Property Patterns:**

```json
{
  "properties": {
    // E-commerce
    "productId": "12345",
    "productName": "Premium Widget",
    "category": "Electronics",
    "price": 99.99,
    "currency": "USD",
    "quantity": 1,

    // Content
    "contentId": "article-123",
    "contentType": "blog-post",
    "contentTitle": "How to Track Events",
    "author": "John Doe",

    // Application
    "buttonText": "Get Started",
    "formId": "contact-form",
    "errorCode": "404",
    "feature": "search",

    // Custom metadata
    "campaign": "summer-sale",
    "experiment": "checkout-v2",
    "value": 25.0
  }
}
```

### Identity Fields

#### userId (conditional)

- **Type**: String
- **Description**: Unique identifier for known users
- **When to use**: After user registration/login
- **Constraints**: Max 255 characters

#### anonymousId (conditional)

- **Type**: String
- **Description**: Anonymous identifier for unknown users
- **When to use**: Before user identification
- **Constraints**: Max 255 characters
- **Auto-generated**: If not provided, Segment generates one

**Identity Requirements:**

- At least one of `userId` OR `anonymousId` is required
- Both can be provided during identified sessions
- Use consistent identifiers across all events

## Complete Examples

### E-commerce Purchase

```json
{
  "type": "track",
  "userId": "user_12345",
  "event": "Product Purchased",
  "properties": {
    "productId": "SKU-12345",
    "productName": "Premium Headphones",
    "brand": "AudioTech",
    "category": "Electronics",
    "variant": "Black",
    "price": 199.99,
    "currency": "USD",
    "quantity": 1,
    "orderId": "order_98765",
    "cartId": "cart_456",
    "coupon": "SAVE20",
    "discount": 40.0,
    "revenue": 159.99,
    "tax": 12.8,
    "shipping": 9.99,
    "affiliation": "Web Store",
    "paymentMethod": "credit_card"
  },
  "context": {
    "ip": "192.168.1.1",
    "userAgent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)...",
    "page": {
      "url": "https://store.example.com/checkout/complete",
      "title": "Order Complete - Store",
      "referrer": "https://store.example.com/checkout"
    },
    "campaign": {
      "name": "summer_sale",
      "source": "google",
      "medium": "cpc",
      "term": "wireless headphones",
      "content": "ad_variant_a"
    }
  },
  "timestamp": "2025-01-15T14:30:00.000Z",
  "messageId": "ajs-msg-12345"
}
```

### User Signup

```json
{
  "type": "track",
  "userId": "user_67890",
  "event": "User Signed Up",
  "properties": {
    "method": "email",
    "plan": "free",
    "referrer": "friend_invite",
    "utm_source": "facebook",
    "utm_medium": "social",
    "utm_campaign": "growth_2025"
  },
  "context": {
    "ip": "192.168.1.1",
    "userAgent": "Mozilla/5.0...",
    "page": {
      "url": "https://app.example.com/signup",
      "title": "Sign Up - Example App"
    },
    "library": {
      "name": "analytics.js",
      "version": "4.1.0"
    }
  },
  "timestamp": "2025-01-15T14:25:00.000Z"
}
```

### Content Interaction

```json
{
  "type": "track",
  "anonymousId": "anon_abc123",
  "event": "Article Read",
  "properties": {
    "articleId": "blog-post-456",
    "title": "Getting Started with Analytics",
    "category": "tutorials",
    "author": "Jane Smith",
    "wordCount": 1200,
    "readTime": 300,
    "scrollDepth": 85,
    "timeOnPage": 180
  },
  "context": {
    "page": {
      "url": "https://blog.example.com/getting-started-analytics",
      "title": "Getting Started with Analytics | Example Blog",
      "referrer": "https://google.com"
    }
  },
  "timestamp": "2025-01-15T14:20:00.000Z"
}
```

### Application Feature Usage

```json
{
  "type": "track",
  "userId": "user_11111",
  "event": "Feature Used",
  "properties": {
    "feature": "export_data",
    "tool": "dashboard",
    "format": "csv",
    "recordCount": 1500,
    "fileSize": "2.3MB",
    "duration": 12.5
  },
  "timestamp": "2025-01-15T14:35:00.000Z"
}
```

## HTTP Examples

### cURL Request

```bash
curl -X POST https://api.segment.io/v1/track \
  -H "Authorization: Basic $(echo -n 'YOUR_WRITE_KEY:' | base64)" \
  -H "Content-Type: application/json" \
  -d '{
    "userId": "user123",
    "event": "Button Clicked",
    "properties": {
      "buttonText": "Get Started",
      "location": "homepage_hero"
    }
  }'
```

### JavaScript SDK

```javascript
analytics.track('Product Purchased', {
  productId: '12345',
  productName: 'Premium Widget',
  price: 99.99,
  currency: 'USD',
})
```

### Node.js SDK

```javascript
analytics.track({
  userId: 'user123',
  event: 'Product Purchased',
  properties: {
    productId: '12345',
    productName: 'Premium Widget',
    price: 99.99,
    currency: 'USD',
  },
})
```

### Python SDK

```python
analytics.track(
    user_id='user123',
    event='Product Purchased',
    properties={
        'productId': '12345',
        'productName': 'Premium Widget',
        'price': 99.99,
        'currency': 'USD'
    }
)
```

## Reserved Properties

Segment reserves certain property names for special processing:

### Revenue Properties

- `revenue`: Monetary value of the event
- `currency`: ISO 4217 currency code (default: USD)
- `value`: Alternative to revenue for non-monetary value

### E-commerce Properties

- `productId`: Unique product identifier
- `orderId`: Unique order identifier
- `cartId`: Shopping cart identifier
- `checkoutId`: Checkout session identifier

### Content Properties

- `contentId`: Unique content identifier
- `contentType`: Type of content (article, video, etc.)
- `category`: Content category or classification

### Campaign Properties

- `campaign`: Marketing campaign name
- `source`: Traffic source
- `medium`: Marketing medium
- `term`: Search term or keyword
- `content`: Ad content or creative identifier

## Event Naming Best Practices

### Naming Conventions

- Use **Present Tense**: "Product Purchased" not "Product Purchase"
- Be **Specific**: "Video Played" not "Media Interaction"
- Use **Title Case**: "Button Clicked" not "button clicked"
- Be **Consistent**: Standardize across your application

### Event Categories

```
// User Actions
"Button Clicked"
"Form Submitted"
"Link Clicked"
"Search Performed"

// Content
"Article Read"
"Video Played"
"Document Downloaded"
"Image Viewed"

// E-commerce
"Product Purchased"
"Cart Abandoned"
"Checkout Started"
"Payment Failed"

// Application
"Feature Used"
"Error Occurred"
"Page Loaded"
"Session Started"
```

## Validation and Errors

### Common Validation Errors

#### Missing Required Fields

```json
{
  "error": {
    "type": "validation_error",
    "message": "Missing required field: event"
  }
}
```

#### Invalid Event Name

```json
{
  "error": {
    "type": "validation_error",
    "message": "Event name cannot start with '$'"
  }
}
```

#### Payload Too Large

```json
{
  "error": {
    "type": "validation_error",
    "message": "Event payload exceeds 32KB limit"
  }
}
```

### Pre-send Validation

```javascript
// Validate before sending
function validateTrackEvent(event, properties) {
  if (!event || event.length === 0) {
    throw new Error('Event name is required')
  }

  if (event.startsWith('$')) {
    throw new Error('Event name cannot start with $')
  }

  if (JSON.stringify(properties).length > 32000) {
    throw new Error('Properties payload too large')
  }
}
```

## Performance Considerations

### Batching Events

```json
{
  "batch": [
    {
      "type": "track",
      "userId": "user123",
      "event": "Page Viewed",
      "properties": { "page": "home" }
    },
    {
      "type": "track",
      "userId": "user123",
      "event": "Button Clicked",
      "properties": { "button": "signup" }
    }
  ]
}
```

### Client-side Queuing

```javascript
// Queue events during poor connectivity
analytics.track('Event Name', properties, {
  timeout: 5000,
  retries: 3,
})
```

### Async Processing

```javascript
// Non-blocking event tracking
analytics.track('Event Name', properties, (err) => {
  if (err) {
    console.error('Tracking failed:', err)
  }
})
```

## Next Steps

- Review [Identify method](./04-identify.md) for user identification
- Explore [Page method](./05-page.md) for page view tracking
- Understand [Common Fields](./08-common-fields.md) for payload details
