# Segment API Overview

## Introduction

Segment is a Customer Data Platform (CDP) that provides a unified API for collecting, cleaning, and controlling customer data. The Segment API enables real-time data collection and routing to hundreds of downstream tools and destinations.

## Core Architecture

### Data Flow

```
Source → Segment API → Destinations
   ↓
Identity Resolution & Data Processing
   ↓
Warehouse & Analytics
```

1. **Sources** collect data from websites, mobile apps, servers, and other systems
2. **Segment API** receives, validates, and processes data in real-time
3. **Destinations** receive cleaned, transformed data for activation
4. **Warehouses** store historical data for analytics and reporting

### Key Components

#### Sources

- **Web Sources**: JavaScript SDK, Analytics.js
- **Mobile Sources**: iOS, Android, React Native SDKs
- **Server Sources**: Node.js, Python, Ruby, Go, Java SDKs
- **Cloud Sources**: Database, SaaS, and file-based integrations

#### API Layer

- **HTTP Tracking API**: REST endpoints for data collection
- **Public API**: Management and configuration endpoints
- **Streaming API**: Real-time data access

#### Processing Engine

- **Identity Resolution**: Links user activities across devices and sessions
- **Data Validation**: Schema enforcement and data quality checks
- **Transformations**: Real-time data processing and enrichment
- **Privacy Controls**: PII detection and data governance

## Data Collection Model

### Five Core Methods

Segment standardizes all customer data collection into five core methods:

| Method       | Purpose                            | Use Case                           |
| ------------ | ---------------------------------- | ---------------------------------- |
| **Track**    | Record events and user actions     | Button clicks, purchases, signups  |
| **Identify** | Set user traits and identity       | User registration, profile updates |
| **Page**     | Record page/screen views           | Navigation, content consumption    |
| **Group**    | Associate users with organizations | B2B account management             |
| **Alias**    | Merge user identities              | Cross-device user matching         |

### Event Structure

All Segment events follow a common JSON structure:

```json
{
  "type": "track|identify|page|group|alias",
  "userId": "unique_user_identifier",
  "anonymousId": "anonymous_session_identifier",
  "timestamp": "2025-01-15T10:30:00.000Z",
  "context": {
    "ip": "192.168.1.1",
    "userAgent": "Mozilla/5.0...",
    "page": {...},
    "device": {...}
  },
  "integrations": {...},
  "messageId": "unique_message_id",
  // Method-specific fields
  "event": "Event Name",
  "properties": {...},
  "traits": {...}
}
```

## Identity Model

### User Identity Resolution

Segment maintains a sophisticated identity graph that connects user activities across:

- **Anonymous Sessions**: Tracked via `anonymousId`
- **Identified Users**: Tracked via `userId`
- **Cross-Device**: Linked through `alias` calls
- **Account-Level**: Connected via `group` associations

### Identity Lifecycle

1. **Anonymous Tracking**: User visits site, assigned `anonymousId`
2. **Identification**: User signs up/logs in, `identify` called with `userId`
3. **Merging**: `alias` links `anonymousId` to `userId`
4. **Enrichment**: Additional traits added via subsequent `identify` calls
5. **Group Association**: User associated with organization via `group`

### Identity Persistence

- **Client-side**: Stored in browser localStorage/cookies
- **Server-side**: Maintained in Segment's identity service
- **Cross-domain**: Shared via first-party data collection

## Data Processing Pipeline

### Real-time Processing

1. **Ingestion**: Events received via HTTP API
2. **Validation**: Schema validation and data quality checks
3. **Enrichment**: IP geolocation, user-agent parsing, UTM attribution
4. **Identity Resolution**: User matching and identity merging
5. **Routing**: Event forwarding to enabled destinations
6. **Storage**: Archival in data warehouse (if configured)

### Data Quality & Governance

- **Schema Controls**: Enforce data structure and validation rules
- **PII Detection**: Automatic detection of sensitive information
- **Consent Management**: Respect user privacy preferences
- **Data Retention**: Configurable retention policies
- **Access Controls**: Role-based permissions and audit trails

## Regional Data Processing

### Data Residency Options

- **Global/US**: Default processing in US-based infrastructure
- **EU**: European data residency for GDPR compliance
- **Regional Routing**: Data stays within specified geographic boundaries

### Compliance Features

- **GDPR**: Right to access, portability, and deletion
- **CCPA**: California Consumer Privacy Act compliance
- **HIPAA**: Healthcare data protection (Enterprise)
- **SOC 2**: Security and availability auditing

## Rate Limits & Performance

### API Limits

- **Request Rate**: 1000 requests/second per source
- **Payload Size**: 500KB max per request
- **Batch Size**: 100 events per batch recommended
- **Message Size**: 32KB max per individual message

### Performance Optimization

- **Batching**: Multiple events in single request
- **Compression**: Gzip encoding supported
- **CDN**: Global edge locations for low latency
- **Queuing**: Client-side queuing with retry logic

## Integration Patterns

### Client-side Tracking

```javascript
// Initialize
analytics.load('writeKey')

// Track events
analytics.track('Product Purchased', {
  productId: '12345',
  revenue: 99.99,
})

// Identify users
analytics.identify('userId', {
  email: 'user@example.com',
  name: 'John Doe',
})
```

### Server-side Tracking

```javascript
// Node.js example
const Analytics = require('@segment/analytics-node')

const analytics = new Analytics({
  writeKey: 'your-write-key',
})

analytics.track({
  userId: 'userId',
  event: 'Server Event',
  properties: {
    value: 'example',
  },
})
```

### HTTP API

```bash
curl -X POST https://api.segment.io/v1/track \
  -H "Authorization: Basic $(echo -n 'writeKey:' | base64)" \
  -H "Content-Type: application/json" \
  -d '{
    "userId": "userId",
    "event": "HTTP Event",
    "properties": {
      "value": "example"
    }
  }'
```

## Next Steps

- Review [API Endpoints](./02-api-endpoints.md) for technical implementation details
- Explore individual methods starting with [Track](./03-track.md)
- Understand [Common Fields](./08-common-fields.md) shared across all methods
