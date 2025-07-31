# Identify Method

## Overview

The `identify` method associates user behavior with a specific user identity and sets user traits. It's essential for building user profiles and linking anonymous activity to known users.

## Endpoint

```
POST /v1/identify
```

## When to Use Identify

Use `identify` to:

- **Link Anonymous Users**: Connect anonymous activity to known users after signup/login
- **Set User Traits**: Store user profile information and characteristics
- **Update User Data**: Modify existing user traits when information changes
- **Enrich Profiles**: Add additional context and attributes to user profiles

## Required Fields

| Field                     | Type   | Description                             |
| ------------------------- | ------ | --------------------------------------- |
| `userId` OR `anonymousId` | String | User identifier (at least one required) |

## Payload Structure

```json
{
  "type": "identify",
  "userId": "string",
  "anonymousId": "string",
  "traits": {
    "key": "value"
  },
  "context": {
    "ip": "string",
    "userAgent": "string",
    "page": {
      "url": "string",
      "title": "string"
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

#### userId (conditional)

- **Type**: String
- **Description**: Unique identifier for the user in your database
- **Constraints**: Max 255 characters
- **Examples**: `"user_12345"`, `"john.doe@example.com"`, `"uuid-v4-string"`

#### anonymousId (conditional)

- **Type**: String
- **Description**: Anonymous identifier before user identification
- **When to use**: During the identification process to link anonymous activity
- **Auto-generated**: By Segment if not provided

#### traits (optional but recommended)

- **Type**: Object
- **Description**: User attributes and characteristics
- **Constraints**:
  - Max 255 traits per user
  - Trait names max 255 characters
  - Nested objects max 3 levels deep

**Trait Categories:**

```json
{
  "traits": {
    // Identity
    "email": "john.doe@example.com",
    "firstName": "John",
    "lastName": "Doe",
    "username": "johndoe",
    "phone": "+1-555-123-4567",

    // Demographics
    "age": 32,
    "birthday": "1992-01-15",
    "gender": "male",
    "address": {
      "street": "123 Main St",
      "city": "San Francisco",
      "state": "CA",
      "postalCode": "94105",
      "country": "USA"
    },

    // Business
    "company": "Example Corp",
    "title": "Software Engineer",
    "industry": "Technology",
    "employees": 500,

    // Preferences
    "plan": "premium",
    "logins": 15,
    "language": "en-US",
    "timezone": "America/Los_Angeles",

    // Custom
    "signupSource": "google_ads",
    "referralCode": "REF123",
    "isVip": true
  }
}
```

## Complete Examples

### New User Registration

```json
{
  "type": "identify",
  "userId": "user_12345",
  "anonymousId": "anon_abc123",
  "traits": {
    "email": "john.doe@example.com",
    "firstName": "John",
    "lastName": "Doe",
    "phone": "+1-555-123-4567",
    "age": 32,
    "plan": "free",
    "signupSource": "organic_search",
    "createdAt": "2025-01-15T14:30:00.000Z",
    "address": {
      "city": "San Francisco",
      "state": "CA",
      "country": "USA"
    }
  },
  "context": {
    "ip": "192.168.1.1",
    "userAgent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)...",
    "page": {
      "url": "https://app.example.com/signup/complete",
      "title": "Welcome - Example App",
      "referrer": "https://app.example.com/signup"
    },
    "campaign": {
      "source": "google",
      "medium": "organic",
      "term": "productivity app"
    }
  },
  "timestamp": "2025-01-15T14:30:00.000Z",
  "messageId": "ajs-msg-67890"
}
```

### User Login (Existing User)

```json
{
  "type": "identify",
  "userId": "user_12345",
  "anonymousId": "anon_def456",
  "traits": {
    "email": "john.doe@example.com",
    "lastLogin": "2025-01-15T14:25:00.000Z",
    "logins": 47,
    "plan": "premium",
    "isActive": true
  },
  "context": {
    "ip": "192.168.1.1",
    "page": {
      "url": "https://app.example.com/dashboard",
      "title": "Dashboard - Example App"
    }
  },
  "timestamp": "2025-01-15T14:25:00.000Z"
}
```

### Profile Update

```json
{
  "type": "identify",
  "userId": "user_12345",
  "traits": {
    "plan": "enterprise",
    "company": "New Company Inc",
    "title": "Senior Software Engineer",
    "employees": 1000,
    "updatedAt": "2025-01-15T14:35:00.000Z"
  },
  "timestamp": "2025-01-15T14:35:00.000Z"
}
```

### B2B User Identification

```json
{
  "type": "identify",
  "userId": "user_98765",
  "traits": {
    "email": "sarah.smith@enterprise.com",
    "firstName": "Sarah",
    "lastName": "Smith",
    "company": "Enterprise Corp",
    "industry": "Financial Services",
    "title": "Product Manager",
    "department": "Product",
    "employees": 5000,
    "revenue": 500000000,
    "plan": "enterprise",
    "accountId": "account_567",
    "role": "admin",
    "permissions": ["read", "write", "admin"]
  },
  "timestamp": "2025-01-15T14:40:00.000Z"
}
```

## Reserved Traits

Segment reserves certain trait names for special processing:

### Identity Traits

- `id`: Unique user identifier (automatically set to userId)
- `email`: User's email address
- `firstName`: User's first name
- `lastName`: User's last name
- `name`: User's full name
- `username`: User's username
- `phone`: User's phone number

### Demographic Traits

- `age`: User's age in years
- `birthday`: User's birthday (ISO 8601 date)
- `gender`: User's gender
- `title`: User's job title
- `address`: User's address (object with street, city, state, etc.)

### Business Traits

- `company`: User's company name
- `industry`: User's industry
- `employees`: Number of employees at user's company
- `website`: User's or company's website

### Timestamps

- `createdAt`: When the user was created (ISO 8601)
- `updatedAt`: When the user was last updated (ISO 8601)

### Custom Traits

Any trait not in the reserved list is considered custom:

```json
{
  "traits": {
    "plan": "premium",
    "source": "google_ads",
    "isVip": true,
    "preferences": {
      "notifications": true,
      "theme": "dark"
    }
  }
}
```

## HTTP Examples

### cURL Request

```bash
curl -X POST https://api.segment.io/v1/identify \
  -H "Authorization: Basic $(echo -n 'YOUR_WRITE_KEY:' | base64)" \
  -H "Content-Type: application/json" \
  -d '{
    "userId": "user123",
    "traits": {
      "email": "user@example.com",
      "firstName": "John",
      "plan": "premium"
    }
  }'
```

### JavaScript SDK

```javascript
// At signup/login
analytics.identify('user123', {
  email: 'john.doe@example.com',
  firstName: 'John',
  lastName: 'Doe',
  plan: 'premium',
})

// Update traits later
analytics.identify({
  plan: 'enterprise',
  company: 'New Company',
})
```

### Node.js SDK

```javascript
analytics.identify({
  userId: 'user123',
  traits: {
    email: 'john.doe@example.com',
    firstName: 'John',
    lastName: 'Doe',
    plan: 'premium',
    createdAt: new Date(),
  },
})
```

### Python SDK

```python
analytics.identify(
    user_id='user123',
    traits={
        'email': 'john.doe@example.com',
        'firstName': 'John',
        'lastName': 'Doe',
        'plan': 'premium',
        'createdAt': datetime.now().isoformat()
    }
)
```

## Identity Resolution Workflow

### 1. Anonymous User Activity

```javascript
// User visits site - anonymous tracking
analytics.track('Page Viewed', {
  page: 'homepage',
})
// Creates: anonymousId = "anon_abc123"
```

### 2. User Registration/Login

```javascript
// User signs up - identify with traits
analytics.identify('user_12345', {
  email: 'john@example.com',
  firstName: 'John',
  plan: 'free',
})
// Links: anonymousId "anon_abc123" → userId "user_12345"
```

### 3. Continued Activity

```javascript
// Subsequent events automatically include userId
analytics.track('Product Purchased', {
  productId: '12345',
  revenue: 99.99,
})
// Event includes: userId = "user_12345"
```

### 4. Cross-Device Linking

```javascript
// User logs in on different device
analytics.identify('user_12345', {
  email: 'john@example.com',
  lastLogin: new Date(),
})
// Links new anonymousId to existing userId
```

## Trait Update Strategies

### Full Profile Updates

```javascript
// Set complete user profile
analytics.identify('user123', {
  email: 'john@example.com',
  firstName: 'John',
  lastName: 'Doe',
  company: 'Example Corp',
  plan: 'premium',
})
```

### Incremental Updates

```javascript
// Update only changed fields
analytics.identify('user123', {
  plan: 'enterprise',
  lastLogin: new Date(),
})
```

### Conditional Updates

```javascript
// Only update if trait doesn't exist
if (!user.company) {
  analytics.identify(user.id, {
    company: 'Inferred Company',
  })
}
```

## Privacy Considerations

### PII Handling

```javascript
// Be careful with sensitive data
analytics.identify('user123', {
  email: 'john@example.com', // ✓ Generally OK
  firstName: 'John', // ✓ Generally OK
  ssn: '123-45-6789', // ✗ Avoid PII
  creditCard: '4111...', // ✗ Never store payment data
  hashedEmail: 'a1b2c3...', // ✓ Hashed identifiers OK
})
```

### Data Minimization

```javascript
// Only collect necessary traits
analytics.identify('user123', {
  plan: 'premium', // ✓ Needed for analytics
  favoriteColor: 'blue', // ? Is this needed?
  internalNotes: '...', // ✗ Internal data
})
```

### Consent Management

```javascript
// Respect user consent preferences
if (user.hasConsented) {
  analytics.identify(user.id, user.traits)
} else {
  analytics.identify(user.id, {
    plan: user.plan, // Only business-critical traits
  })
}
```

## Validation and Errors

### Common Validation Errors

#### Missing Identity

```json
{
  "error": {
    "type": "validation_error",
    "message": "Missing required field: userId or anonymousId"
  }
}
```

#### Invalid Trait Names

```json
{
  "error": {
    "type": "validation_error",
    "message": "Trait name cannot contain '$' prefix"
  }
}
```

#### Trait Value Constraints

```javascript
// Validate trait values
function validateTraits(traits) {
  for (const [key, value] of Object.entries(traits)) {
    if (key.startsWith('$')) {
      throw new Error(`Invalid trait name: ${key}`)
    }

    if (typeof value === 'string' && value.length > 255) {
      throw new Error(`Trait value too long: ${key}`)
    }
  }
}
```

## Best Practices

### Timing

- Call `identify` immediately after user registration/login
- Update traits when user information changes
- Don't call `identify` on every page load for known users

### Data Quality

- Use consistent trait names across your application
- Validate email addresses and phone numbers before sending
- Normalize data formats (e.g., always use ISO 8601 for dates)

### Performance

- Batch trait updates when possible
- Don't send unchanged traits repeatedly
- Use incremental updates for large user profiles

### Security

- Never send passwords or sensitive authentication data
- Hash or encrypt PII when possible
- Respect user privacy preferences and consent

## Common Patterns

### User Lifecycle Tracking

```javascript
// Registration
analytics.identify(userId, {
  email: email,
  firstName: firstName,
  signupSource: 'organic',
  plan: 'free',
  createdAt: new Date(),
})

// Subscription upgrade
analytics.identify(userId, {
  plan: 'premium',
  billingCycle: 'monthly',
  upgradedAt: new Date(),
})

// Profile completion
analytics.identify(userId, {
  avatar: avatarUrl,
  company: company,
  profileComplete: true,
})
```

### Progressive Profiling

```javascript
// Collect traits over time
const traits = {}

// Initial registration
if (email) {
  traits.email = email
}
if (firstName) {
  traits.firstName = firstName
}

// Later interactions
if (company) {
  traits.company = company
}
if (industry) {
  traits.industry = industry
}

// Only send if we have new traits
if (Object.keys(traits).length > 0) {
  analytics.identify(userId, traits)
}
```

## Next Steps

- Explore [Page method](./05-page.md) for page view tracking
- Review [Group method](./06-group.md) for B2B account association
- Understand [Common Fields](./08-common-fields.md) for payload structure
