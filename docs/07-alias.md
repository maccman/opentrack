# Alias Method

## Overview

The `alias` method merges two user identities, linking a user's anonymous activity with their identified profile. It's essential for connecting user behavior across different sessions, devices, or identification states.

## Endpoint

```
POST /v1/alias
```

## When to Use Alias

Use `alias` to:

- **Link Anonymous Activity**: Connect pre-signup behavior to identified users
- **Merge User Profiles**: Combine duplicate user profiles or identities
- **Cross-Device Tracking**: Link user activity across different devices
- **Identity Consolidation**: Resolve identity conflicts and duplicates
- **Historical Data Connection**: Retroactively associate past events with known users

## Required Fields

| Field        | Type   | Description                                          |
| ------------ | ------ | ---------------------------------------------------- |
| `userId`     | String | The primary identity (new/preferred identifier)      |
| `previousId` | String | The identity to be merged (old/temporary identifier) |

## Payload Structure

```json
{
  "type": "alias",
  "userId": "string",
  "previousId": "string",
  "context": {
    "ip": "string",
    "userAgent": "string",
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

#### userId (required)

- **Type**: String
- **Description**: The primary user identifier (the identity to keep)
- **Constraints**: Max 255 characters
- **Usage**: This becomes the canonical identifier for the merged profile

#### previousId (required)

- **Type**: String
- **Description**: The identifier to be merged into userId
- **Constraints**: Max 255 characters
- **Usage**: This identity will be aliased to userId (historical events will be attributed to userId)

### Important Notes

#### No traits field

The `alias` method does not accept a `traits` field. It only creates a connection between two identities without setting user attributes.

#### One-way operation

Aliasing is typically a one-way operation. Once `previousId` is aliased to `userId`, the connection is permanent in most downstream systems.

#### Order matters

The order of `userId` and `previousId` is important:

- `userId`: The identity you want to keep
- `previousId`: The identity you want to merge away

## Complete Examples

### Post-Registration Alias

```json
{
  "type": "alias",
  "userId": "user_12345",
  "previousId": "anon_abc123",
  "context": {
    "ip": "192.168.1.1",
    "userAgent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)...",
    "page": {
      "url": "https://app.example.com/signup/complete",
      "title": "Registration Complete - Example App"
    },
    "library": {
      "name": "analytics.js",
      "version": "4.1.0"
    }
  },
  "timestamp": "2025-01-15T14:30:00.000Z",
  "messageId": "ajs-alias-67890"
}
```

### Cross-Device Identity Merge

```json
{
  "type": "alias",
  "userId": "user_12345",
  "previousId": "anon_def456",
  "context": {
    "ip": "10.0.1.5",
    "userAgent": "Mozilla/5.0 (iPhone; CPU iPhone OS 17_2 like Mac OS X)...",
    "device": {
      "type": "mobile",
      "manufacturer": "Apple",
      "model": "iPhone 15"
    },
    "library": {
      "name": "analytics-ios",
      "version": "4.1.2"
    }
  },
  "timestamp": "2025-01-15T14:35:00.000Z"
}
```

### User Profile Consolidation

```json
{
  "type": "alias",
  "userId": "user_primary_12345",
  "previousId": "user_duplicate_67890",
  "context": {
    "ip": "192.168.1.1",
    "library": {
      "name": "analytics-node",
      "version": "6.2.0"
    }
  },
  "timestamp": "2025-01-15T14:40:00.000Z"
}
```

## HTTP Examples

### cURL Request

```bash
curl -X POST https://api.segment.io/v1/alias \
  -H "Authorization: Basic $(echo -n 'YOUR_WRITE_KEY:' | base64)" \
  -H "Content-Type: application/json" \
  -d '{
    "userId": "user_12345",
    "previousId": "anon_abc123"
  }'
```

### JavaScript SDK

```javascript
// After user registration/login
analytics.alias('user_12345', 'anon_abc123')

// Or using current anonymous ID
analytics.alias('user_12345') // Uses current anonymousId automatically
```

### Node.js SDK

```javascript
analytics.alias({
  userId: 'user_12345',
  previousId: 'anon_abc123',
})
```

### Python SDK

```python
analytics.alias(
    user_id='user_12345',
    previous_id='anon_abc123'
)
```

## Identity Resolution Workflow

### 1. Anonymous User Session

```javascript
// User visits site - anonymous tracking starts
// Segment automatically generates anonymousId
analytics.page('Home Page')
analytics.track('Button Clicked', { button: 'get_started' })
// Events are attributed to: anonymousId = "anon_abc123"
```

### 2. User Registration

```javascript
// User completes registration
analytics.identify('user_12345', {
  email: 'john@example.com',
  firstName: 'John',
  lastName: 'Doe',
})

// Link anonymous activity to known user
analytics.alias('user_12345', 'anon_abc123')
// All previous events from "anon_abc123" now attributed to "user_12345"
```

### 3. Subsequent Activity

```javascript
// Future events automatically use userId
analytics.track('Product Purchased', {
  productId: '12345',
  revenue: 99.99,
})
// Event attributed to: userId = "user_12345"
```

### 4. Cross-Device Scenario

```javascript
// User opens mobile app and logs in
analytics.identify('user_12345', {
  email: 'john@example.com',
  lastLogin: new Date(),
})

// Link mobile anonymous activity
analytics.alias('user_12345', 'anon_mobile_def456')
// Mobile activity now also attributed to "user_12345"
```

## Common Use Cases

### Registration Flow

```javascript
class UserRegistration {
  constructor() {
    this.anonymousId = analytics.user().anonymousId()
  }

  async register(userData) {
    // Create user account
    const user = await createAccount(userData)

    // Identify the user
    analytics.identify(user.id, {
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      createdAt: user.createdAt,
    })

    // Link anonymous activity
    analytics.alias(user.id, this.anonymousId)

    // Track registration event
    analytics.track('User Registered', {
      method: 'email',
      plan: 'free',
    })
  }
}
```

### Login Flow

```javascript
async function handleLogin(credentials) {
  const user = await authenticate(credentials)
  const currentAnonymousId = analytics.user().anonymousId()

  // Check if we need to alias
  if (currentAnonymousId && !analytics.user().id()) {
    // User was anonymous, now identified
    analytics.identify(user.id, {
      email: user.email,
      lastLogin: new Date(),
    })

    analytics.alias(user.id, currentAnonymousId)
  } else {
    // User already identified or no anonymous activity
    analytics.identify(user.id, {
      email: user.email,
      lastLogin: new Date(),
    })
  }

  analytics.track('User Logged In', {
    method: 'email',
  })
}
```

### Social Login Integration

```javascript
function handleSocialLogin(provider, socialId, userProfile) {
  const anonymousId = analytics.user().anonymousId()
  const userId = `${provider}_${socialId}`

  // Identify user with social profile
  analytics.identify(userId, {
    email: userProfile.email,
    firstName: userProfile.firstName,
    lastName: userProfile.lastName,
    avatar: userProfile.avatar,
    provider: provider,
  })

  // Link anonymous activity if exists
  if (anonymousId) {
    analytics.alias(userId, anonymousId)
  }

  analytics.track('User Logged In', {
    method: provider,
    isNewUser: !userProfile.existingUser,
  })
}
```

### User Merge Operation

```javascript
async function mergeUserAccounts(primaryUserId, duplicateUserId) {
  // Merge user data in your database
  await mergeDatabaseAccounts(primaryUserId, duplicateUserId)

  // Alias the duplicate to primary
  analytics.alias(primaryUserId, duplicateUserId)

  // Track the merge operation
  analytics.track('User Accounts Merged', {
    primaryUserId: primaryUserId,
    mergedUserId: duplicateUserId,
    mergedAt: new Date().toISOString(),
  })

  // Update user with consolidated profile
  analytics.identify(primaryUserId, {
    accountsMerged: true,
    lastMergeDate: new Date().toISOString(),
  })
}
```

## Best Practices

### Timing

```javascript
// ✓ Correct: Call alias immediately after identification
analytics.identify('user_12345', userTraits)
analytics.alias('user_12345', 'anon_abc123')

// ✗ Incorrect: Significant delay between identify and alias
analytics.identify('user_12345', userTraits)
// ... other operations ...
setTimeout(() => {
  analytics.alias('user_12345', 'anon_abc123') // Too late!
}, 5000)
```

### ID Management

```javascript
// ✓ Correct: Consistent ID usage
const userId = 'user_12345'
analytics.identify(userId, traits)
analytics.alias(userId, anonymousId)

// ✗ Incorrect: Inconsistent IDs
analytics.identify('user_12345', traits)
analytics.alias('user_54321', anonymousId) // Different userId!
```

### Error Handling

```javascript
function safeAlias(userId, previousId) {
  try {
    if (!userId || !previousId) {
      throw new Error('Both userId and previousId are required')
    }

    if (userId === previousId) {
      console.warn('Attempting to alias user to themselves')
      return
    }

    analytics.alias(userId, previousId)
  } catch (error) {
    console.error('Alias failed:', error)
    // Continue with application flow
  }
}
```

## Identity Graph Considerations

### Alias Chain Resolution

```
Anonymous ID: anon_abc123
       ↓ (alias)
User ID: user_temp_456
       ↓ (alias)
User ID: user_final_789

Result: All events attributed to user_final_789
```

### Cross-Platform Identity

```javascript
// Web session
analytics.alias('user_12345', 'anon_web_abc123')

// Mobile session
analytics.alias('user_12345', 'anon_mobile_def456')

// Desktop app session
analytics.alias('user_12345', 'anon_desktop_ghi789')

// Result: All platform activity linked to user_12345
```

### Identity Conflicts

```javascript
// Detect potential conflicts before aliasing
function checkAliasConflict(userId, previousId) {
  const currentUserId = analytics.user().id()

  if (currentUserId && currentUserId !== userId) {
    console.warn(
      `Identity conflict: current user ${currentUserId}, attempting to alias to ${userId}`,
    )
    return false
  }

  return true
}

if (checkAliasConflict(newUserId, anonymousId)) {
  analytics.alias(newUserId, anonymousId)
}
```

## Platform-Specific Considerations

### Web Applications

```javascript
// SPA with routing
router.beforeEach((to, from, next) => {
  const user = getCurrentUser()
  const anonymousId = analytics.user().anonymousId()

  if (user && anonymousId && !analytics.user().id()) {
    analytics.identify(user.id, user.traits)
    analytics.alias(user.id, anonymousId)
  }

  next()
})
```

### Mobile Applications

```swift
// iOS - Handle app launch after authentication
func handleAuthenticatedAppLaunch(user: User) {
    let anonymousId = analytics.user().anonymousId

    if let anonId = anonymousId, !anonId.isEmpty {
        analytics.identify(user.id, traits: user.traits)
        analytics.alias(user.id, previousId: anonId)
    } else {
        analytics.identify(user.id, traits: user.traits)
    }
}
```

### Server-Side Integration

```javascript
// Server-side user registration
app.post('/register', async (req, res) => {
  const { email, password, anonymousId } = req.body

  try {
    const user = await createUser({ email, password })

    // Server-side identification
    analytics.identify({
      userId: user.id,
      traits: {
        email: user.email,
        createdAt: user.createdAt,
      },
    })

    // Link anonymous activity if provided
    if (anonymousId) {
      analytics.alias({
        userId: user.id,
        previousId: anonymousId,
      })
    }

    res.json({ success: true, userId: user.id })
  } catch (error) {
    res.status(400).json({ error: error.message })
  }
})
```

## Privacy and Compliance

### Data Retention

```javascript
// Alias calls don't contain PII but create data connections
analytics.alias('user_12345', 'anon_abc123')

// Consider data retention implications
// Anonymous events become identifiable after aliasing
```

### GDPR Right to Deletion

```javascript
// Handle user deletion requests
async function handleUserDeletion(userId) {
  // Delete user data from your systems
  await deleteUserData(userId)

  // Note: Some destinations may retain alias relationships
  // Check with each destination's data retention policies

  // Track deletion for audit purposes (if legally permissible)
  analytics.track('User Data Deleted', {
    userId: userId,
    deletedAt: new Date().toISOString(),
    requestType: 'gdpr_deletion',
  })
}
```

### Consent Management

```javascript
// Only alias if user has consented to tracking
function conditionalAlias(userId, previousId) {
  if (hasUserConsentedToTracking()) {
    analytics.alias(userId, previousId)
  } else {
    // Start fresh without linking anonymous activity
    analytics.identify(userId, userTraits)
  }
}
```

## Validation and Errors

### Common Validation Errors

#### Missing Required Fields

```json
{
  "error": {
    "type": "validation_error",
    "message": "Missing required field: userId"
  }
}
```

#### Self-Alias Attempt

```json
{
  "error": {
    "type": "validation_error",
    "message": "Cannot alias user to themselves"
  }
}
```

### Client-Side Validation

```javascript
function validateAlias(userId, previousId) {
  if (!userId) {
    throw new Error('userId is required for alias')
  }

  if (!previousId) {
    throw new Error('previousId is required for alias')
  }

  if (userId === previousId) {
    throw new Error('Cannot alias user to themselves')
  }

  if (userId.length > 255 || previousId.length > 255) {
    throw new Error('User IDs must be 255 characters or less')
  }

  return true
}
```

## Performance Considerations

### Batch Processing

```javascript
// For bulk alias operations (e.g., data migration)
const aliasOperations = [
  { userId: 'user_1', previousId: 'anon_1' },
  { userId: 'user_2', previousId: 'anon_2' },
  // ... more operations
]

// Process in batches to avoid rate limits
const batchSize = 50
for (let i = 0; i < aliasOperations.length; i += batchSize) {
  const batch = aliasOperations.slice(i, i + batchSize)

  await Promise.all(
    batch.map((op) => analytics.alias(op.userId, op.previousId)),
  )

  // Small delay between batches
  await new Promise((resolve) => setTimeout(resolve, 100))
}
```

### Async Processing

```javascript
// Non-blocking alias calls
function asyncAlias(userId, previousId) {
  return new Promise((resolve) => {
    analytics.alias(userId, previousId, () => {
      resolve()
    })
  })
}

// Usage
async function handleRegistration(userData) {
  const user = await createUser(userData)

  // Don't block on tracking calls
  Promise.all([
    analytics.identify(user.id, user.traits),
    asyncAlias(user.id, getAnonymousId()),
  ]).catch((error) => {
    console.error('Tracking failed:', error)
  })

  // Continue with application flow
  return user
}
```

## Debugging and Testing

### Debug Mode

```javascript
// Enable debug mode to see alias calls
analytics.debug(true)

// Test alias functionality
analytics.alias('test_user_123', 'test_anon_456')
// Check browser console for request details
```

### Identity Verification

```javascript
// Verify identity state after alias
function verifyAliasSuccess(expectedUserId) {
  const currentUserId = analytics.user().id()
  const currentAnonymousId = analytics.user().anonymousId()

  console.log('Current user ID:', currentUserId)
  console.log('Current anonymous ID:', currentAnonymousId)

  if (currentUserId === expectedUserId) {
    console.log('✓ Alias successful')
  } else {
    console.error('✗ Alias failed - user ID mismatch')
  }
}
```

## Next Steps

- Review [Common Fields](./08-common-fields.md) for payload structure details
- Explore [Data Model](./09-data-model.md) for identity relationship mapping
- Understand how alias affects downstream destinations and warehouses
