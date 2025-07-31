# Page Method

## Overview

The `page` method records page views and screen navigation. It captures when users view pages on websites or screens in mobile applications, providing essential data for understanding user journeys and content consumption.

## Endpoint

```
POST /v1/page
```

## When to Use Page

Use `page` to record:

- **Website Page Views**: Traditional page navigation on websites
- **Single Page App Navigation**: Route changes in SPAs
- **Mobile Screen Views**: Screen navigation in mobile apps
- **Content Consumption**: Article reads, video views, document access
- **User Journey Tracking**: Navigation patterns and user flow analysis

## Required Fields

| Field                     | Type   | Description                             |
| ------------------------- | ------ | --------------------------------------- |
| `userId` OR `anonymousId` | String | User identifier (at least one required) |

## Payload Structure

```json
{
  "type": "page",
  "userId": "string",
  "anonymousId": "string",
  "name": "string",
  "category": "string",
  "properties": {
    "url": "string",
    "title": "string",
    "referrer": "string",
    "path": "string",
    "search": "string",
    "keywords": ["string"]
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

#### name (optional)

- **Type**: String
- **Description**: Human-readable name for the page
- **Examples**: `"Home"`, `"Product Detail"`, `"Checkout"`, `"Article Page"`
- **Best Practice**: Use consistent, descriptive names

#### category (optional)

- **Type**: String
- **Description**: Category or section the page belongs to
- **Examples**: `"Marketing"`, `"Product"`, `"Support"`, `"Blog"`
- **Use Case**: Grouping pages for analysis

#### properties (optional)

- **Type**: Object
- **Description**: Page-specific data and metadata
- **Common Properties**: URL, title, referrer, UTM parameters

### Page Properties

#### Standard Web Properties

```json
{
  "properties": {
    "url": "https://example.com/products/widget",
    "title": "Premium Widget - Example Store",
    "referrer": "https://google.com/search?q=widgets",
    "path": "/products/widget",
    "search": "?utm_source=google&utm_medium=cpc",
    "hash": "#specifications",

    // UTM Parameters
    "utm_source": "google",
    "utm_medium": "cpc",
    "utm_campaign": "product_launch",
    "utm_term": "premium widgets",
    "utm_content": "ad_variant_a",

    // Page metadata
    "keywords": ["widget", "premium", "electronics"],
    "author": "Product Team",
    "publishedAt": "2025-01-10T00:00:00.000Z",
    "category": "Electronics",
    "tags": ["featured", "new"],

    // Performance
    "loadTime": 1.2,
    "pageSize": "2.3MB"
  }
}
```

#### Mobile App Properties

```json
{
  "properties": {
    "screenName": "ProductDetail",
    "screenClass": "ProductViewController",
    "previousScreen": "ProductList",
    "productId": "12345",
    "category": "Electronics",
    "sessionId": "session_abc123"
  }
}
```

#### Content Properties

```json
{
  "properties": {
    "contentId": "article_456",
    "contentType": "blog-post",
    "wordCount": 1200,
    "readingTime": 5,
    "author": "Jane Smith",
    "publishDate": "2025-01-15",
    "topics": ["analytics", "data", "tutorial"]
  }
}
```

## Complete Examples

### Website Page View

```json
{
  "type": "page",
  "userId": "user_12345",
  "name": "Product Detail",
  "category": "E-commerce",
  "properties": {
    "url": "https://store.example.com/products/premium-widget",
    "title": "Premium Widget - Example Store",
    "referrer": "https://store.example.com/category/electronics",
    "path": "/products/premium-widget",
    "search": "?color=blue&size=large",
    "productId": "widget_12345",
    "productName": "Premium Widget",
    "productCategory": "Electronics",
    "price": 99.99,
    "inStock": true,
    "utm_source": "email",
    "utm_medium": "newsletter",
    "utm_campaign": "january_sale"
  },
  "context": {
    "ip": "192.168.1.1",
    "userAgent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)...",
    "page": {
      "url": "https://store.example.com/products/premium-widget",
      "title": "Premium Widget - Example Store",
      "referrer": "https://store.example.com/category/electronics"
    },
    "screen": {
      "width": 1920,
      "height": 1080,
      "density": 2
    }
  },
  "timestamp": "2025-01-15T14:30:00.000Z",
  "messageId": "ajs-page-12345"
}
```

### Blog Article View

```json
{
  "type": "page",
  "anonymousId": "anon_abc123",
  "name": "Getting Started with Analytics",
  "category": "Blog",
  "properties": {
    "url": "https://blog.example.com/getting-started-analytics",
    "title": "Getting Started with Analytics | Example Blog",
    "referrer": "https://google.com",
    "path": "/getting-started-analytics",
    "articleId": "post_789",
    "author": "John Doe",
    "publishedAt": "2025-01-10T10:00:00.000Z",
    "wordCount": 1500,
    "estimatedReadTime": 6,
    "category": "Tutorial",
    "tags": ["analytics", "beginner", "tutorial"],
    "contentType": "blog-post",
    "language": "en-US"
  },
  "timestamp": "2025-01-15T14:25:00.000Z"
}
```

### Mobile App Screen View

```json
{
  "type": "page",
  "userId": "user_67890",
  "name": "Dashboard",
  "category": "App",
  "properties": {
    "screenName": "Dashboard",
    "screenClass": "DashboardViewController",
    "previousScreen": "Login",
    "sessionId": "session_xyz789",
    "appVersion": "2.1.0",
    "osVersion": "iOS 17.2",
    "deviceModel": "iPhone 15 Pro",
    "networkType": "wifi",
    "batteryLevel": 85
  },
  "context": {
    "app": {
      "name": "Example App",
      "version": "2.1.0",
      "build": "123"
    },
    "device": {
      "type": "mobile",
      "manufacturer": "Apple",
      "model": "iPhone 15 Pro",
      "name": "John's iPhone"
    },
    "os": {
      "name": "iOS",
      "version": "17.2"
    },
    "network": {
      "wifi": true,
      "carrier": "Verizon"
    }
  },
  "timestamp": "2025-01-15T14:35:00.000Z"
}
```

### Single Page Application Navigation

```json
{
  "type": "page",
  "userId": "user_11111",
  "name": "User Profile",
  "category": "Account",
  "properties": {
    "url": "https://app.example.com/profile",
    "title": "Profile Settings - Example App",
    "path": "/profile",
    "hash": "#personal-info",
    "previousPage": "/dashboard",
    "navigationMethod": "click",
    "loadType": "soft",
    "section": "personal-info"
  },
  "timestamp": "2025-01-15T14:40:00.000Z"
}
```

## HTTP Examples

### cURL Request

```bash
curl -X POST https://api.segment.io/v1/page \
  -H "Authorization: Basic $(echo -n 'YOUR_WRITE_KEY:' | base64)" \
  -H "Content-Type: application/json" \
  -d '{
    "userId": "user123",
    "name": "Home Page",
    "properties": {
      "url": "https://example.com",
      "title": "Welcome to Example"
    }
  }'
```

### JavaScript SDK

```javascript
// Basic page call
analytics.page()

// Named page with category
analytics.page('Product', 'Product Detail', {
  productId: '12345',
  category: 'Electronics',
  price: 99.99,
})

// SPA navigation
analytics.page('Dashboard', {
  section: 'analytics',
  previousPage: 'profile',
})
```

### Node.js SDK

```javascript
analytics.page({
  userId: 'user123',
  name: 'Product Detail',
  category: 'E-commerce',
  properties: {
    url: 'https://store.example.com/products/12345',
    productId: '12345',
    productName: 'Premium Widget',
  },
})
```

### Python SDK

```python
analytics.page(
    user_id='user123',
    name='Product Detail',
    category='E-commerce',
    properties={
        'url': 'https://store.example.com/products/12345',
        'productId': '12345',
        'productName': 'Premium Widget'
    }
)
```

### Mobile SDKs

#### iOS (Swift)

```swift
analytics.page(
    "Product Detail",
    category: "E-commerce",
    properties: [
        "productId": "12345",
        "productName": "Premium Widget",
        "price": 99.99
    ]
)
```

#### Android (Kotlin)

```kotlin
analytics.page(
    "Product Detail",
    mapOf(
        "category" to "E-commerce",
        "productId" to "12345",
        "productName" to "Premium Widget",
        "price" to 99.99
    )
)
```

## Auto-Tracking vs Manual Tracking

### Automatic Page Tracking

Most Segment SDKs can automatically track page views:

#### Web (Analytics.js)

```javascript
// Enable automatic page tracking
analytics.load('writeKey', {
  integrations: {
    'Segment.io': {
      trackPageViews: true,
    },
  },
})
```

#### Single Page Applications

```javascript
// Track route changes
analytics.load('writeKey', {
  trackPageViews: {
    trackNamedPages: true,
    trackCategorizedPages: true,
  },
})

// Manual SPA tracking
window.addEventListener('popstate', () => {
  analytics.page()
})
```

### Manual Page Tracking

For greater control and additional context:

```javascript
// Custom page tracking with rich data
function trackPageView(pageName, category, additionalProps = {}) {
  const properties = {
    url: window.location.href,
    title: document.title,
    referrer: document.referrer,
    ...additionalProps,
  }

  analytics.page(pageName, category, properties)
}

// Usage
trackPageView('Product Detail', 'E-commerce', {
  productId: '12345',
  productCategory: 'Electronics',
  inStock: true,
})
```

## Page Naming Strategies

### Naming Conventions

#### Descriptive Names

```javascript
// Good: Clear and descriptive
analytics.page('Product Detail')
analytics.page('Shopping Cart')
analytics.page('User Profile')

// Avoid: Too generic
analytics.page('Page')
analytics.page('View')
```

#### Hierarchical Naming

```javascript
// Category > Section > Page
analytics.page('E-commerce', 'Product Detail')
analytics.page('Account', 'Settings', 'Privacy')
analytics.page('Support', 'Knowledge Base', 'FAQ')
```

#### URL-Based Naming

```javascript
// Map URLs to friendly names
const pageNames = {
  '/': 'Home',
  '/products': 'Product Catalog',
  '/products/[id]': 'Product Detail',
  '/cart': 'Shopping Cart',
  '/checkout': 'Checkout',
  '/profile': 'User Profile',
}

analytics.page(pageNames[currentPath] || 'Unknown Page')
```

## UTM Parameter Tracking

### Automatic UTM Capture

```javascript
// UTM parameters automatically captured
// URL: https://example.com?utm_source=google&utm_medium=cpc
analytics.page('Landing Page', {
  campaign: 'product_launch', // Additional context
})

// Automatically includes:
// utm_source: "google"
// utm_medium: "cpc"
// utm_campaign: "product_launch"
```

### Manual UTM Handling

```javascript
function getUtmParams() {
  const urlParams = new URLSearchParams(window.location.search)
  return {
    utm_source: urlParams.get('utm_source'),
    utm_medium: urlParams.get('utm_medium'),
    utm_campaign: urlParams.get('utm_campaign'),
    utm_term: urlParams.get('utm_term'),
    utm_content: urlParams.get('utm_content'),
  }
}

analytics.page('Landing Page', {
  ...getUtmParams(),
  customProperty: 'value',
})
```

## Performance Considerations

### Page Load Tracking

```javascript
// Track page performance
window.addEventListener('load', () => {
  const navigation = performance.getEntriesByType('navigation')[0]

  analytics.page('Home', {
    loadTime: navigation.loadEventEnd - navigation.loadEventStart,
    domContentLoaded:
      navigation.domContentLoadedEventEnd -
      navigation.domContentLoadedEventStart,
    firstContentfulPaint: performance.getEntriesByName(
      'first-contentful-paint',
    )[0]?.startTime,
  })
})
```

### Bundle Size Optimization

```javascript
// Lazy load page tracking for non-critical pages
async function loadPageTracking() {
  const { analytics } = await import('./analytics')
  return analytics
}

// Use in route handlers
router.on('route:change', async (route) => {
  const analytics = await loadPageTracking()
  analytics.page(route.name, route.category)
})
```

## Privacy and Compliance

### URL Sanitization

```javascript
// Remove sensitive data from URLs
function sanitizeUrl(url) {
  const urlObj = new URL(url)

  // Remove sensitive query parameters
  urlObj.searchParams.delete('token')
  urlObj.searchParams.delete('password')
  urlObj.searchParams.delete('secret')

  return urlObj.toString()
}

analytics.page('Secure Page', {
  url: sanitizeUrl(window.location.href),
})
```

### PII Protection

```javascript
// Avoid capturing PII in page properties
analytics.page('User Profile', {
  userId: user.id, // ✓ ID is OK
  userType: user.type, // ✓ Categorization OK
  email: user.email, // ✗ Avoid PII
  hasEmail: !!user.email, // ✓ Boolean flags OK
})
```

## Common Patterns

### E-commerce Page Tracking

```javascript
// Category page
analytics.page('Product Category', 'E-commerce', {
  category: 'Electronics',
  itemCount: 24,
  sortBy: 'price_asc',
  filters: ['brand:apple', 'price:100-500'],
})

// Product detail page
analytics.page('Product Detail', 'E-commerce', {
  productId: 'iphone-15',
  productName: 'iPhone 15',
  category: 'Electronics',
  price: 999,
  inStock: true,
  images: 4,
  reviews: 156,
})

// Checkout pages
analytics.page('Checkout Step 1', 'E-commerce', {
  step: 1,
  stepName: 'shipping',
  cartValue: 299.97,
  itemCount: 3,
})
```

### Content Site Tracking

```javascript
// Article page
analytics.page('Article', 'Blog', {
  articleId: 'analytics-guide-2025',
  title: 'Complete Analytics Guide 2025',
  author: 'Data Team',
  category: 'Tutorials',
  tags: ['analytics', 'tutorial'],
  wordCount: 2500,
  publishDate: '2025-01-15',
})

// Video page
analytics.page('Video', 'Media', {
  videoId: 'intro-to-segment',
  title: 'Introduction to Segment',
  duration: 300,
  category: 'Educational',
  quality: '1080p',
})
```

### Application Page Tracking

```javascript
// Dashboard pages
analytics.page('Dashboard', 'App', {
  section: 'analytics',
  widgets: ['revenue', 'users', 'conversions'],
  timeRange: 'last_30_days',
  dataRefreshed: new Date().toISOString(),
})

// Settings pages
analytics.page('Settings', 'App', {
  section: 'privacy',
  previousSection: 'profile',
  changesUnsaved: false,
})
```

## Best Practices

### Data Collection

- Track all meaningful page/screen views
- Include relevant context in properties
- Use consistent naming conventions
- Capture user journey information

### Performance

- Don't block page rendering for tracking
- Batch page calls when possible
- Use async/non-blocking tracking calls
- Consider lazy loading for non-critical tracking

### Privacy

- Sanitize URLs containing sensitive data
- Avoid capturing PII in page properties
- Respect user consent preferences
- Implement proper data retention policies

### Analysis

- Use categories to group related pages
- Track navigation patterns with referrer data
- Include business-relevant metadata
- Monitor page performance metrics

## Next Steps

- Review [Group method](./06-group.md) for B2B account association
- Explore [Alias method](./07-alias.md) for identity management
- Understand [Common Fields](./08-common-fields.md) for payload structure
